"use client";
import Image from "next/image";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { ChevronLeft, Lock, CreditCard, CheckCircle2, Phone, Mail, ArrowRight, Loader2, ShoppingBag } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSession } from "next-auth/react";
import { AuthModal } from "@/components/auth/AuthModal";
import { reportBackendReachable, reportBackendUnreachable } from "@/lib/backendStatus";
import { clearCart } from "@/lib/cart";
import { useCartItems } from "@/hooks/useCartItems";
import { showToast } from "@/lib/toast";

const BACKEND_BASE = "/api/v1";

/** Wraps fetch to report backend connectivity — a thrown network error means the backend
 * is unreachable, distinct from a normal HTTP error response (which still reaches the server). */
async function backendFetch(url: string, options: RequestInit) {
  try {
    const res = await fetch(url, options);
    reportBackendReachable();
    return res;
  } catch (err) {
    reportBackendUnreachable();
    throw err;
  }
}

interface OrderItem {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
  image?: string;
}

interface PaymentInitiateData {
  razorpay_key_id: string;
  amount: number;
  currency: string;
  razorpay_order_id: string;
  txn_id: string;
}

interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
}

interface CheckoutProfile {
  full_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
}

interface SavedAddress {
  id: string;
  label: string;
  address_line1: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler(response: RazorpayPaymentResponse): Promise<void>;
  modal: { ondismiss(): void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export default function CheckoutPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CheckoutContent />
    </React.Suspense>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredAddressId = searchParams.get("newAddressId") || "";
  // Step State
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  const { data: session, status } = useSession();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [localToken, setLocalToken] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      void Promise.resolve().then(() => setLocalToken(localStorage.getItem("vastrax_token")));
    }
  }, [status]);

  React.useEffect(() => {
    if (status === "unauthenticated" && !localToken) {
      void Promise.resolve().then(() => setIsAuthOpen(true));
    }
  }, [status, localToken]);

  // Checkout fields start empty and are filled from the signed-in account.
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");

  // Prefill contact and saved default shipping address from the account.
  React.useEffect(() => {
    const token = session?.accessToken || localToken;
    if (!token) return;

    let cancelled = false;
    const headers = { Authorization: "Bearer " + token };
    void Promise.all([
      backendFetch(BACKEND_BASE + "/users/me", { method: "GET", headers }),
      backendFetch(BACKEND_BASE + "/users/me/addresses", { method: "GET", headers }),
    ]).then(async ([profileRes, addressesRes]) => {
      if (cancelled) return;
      const profile: CheckoutProfile = profileRes.ok ? await profileRes.json().catch(() => ({})) : {};
      const addresses: SavedAddress[] = addressesRes.ok ? await addressesRes.json().catch(() => []) : [];
      const fullName = (profile.full_name || session?.user?.name || "").trim();
      const parts = fullName.split(/\s+/).filter(Boolean);
      if (profile.email || session?.user?.email) setEmail(profile.email || session?.user?.email || "");
      if (parts.length) {
        setFirstName(parts[0]);
        setLastName(parts.slice(1).join(" "));
      }
      if (profile.phone_number) setPhone(profile.phone_number);

      setSavedAddresses(addresses);
      const savedAddress = addresses.find((entry) => entry.id === preferredAddressId)
        || addresses.find((entry) => entry.is_default)
        || addresses[0];
      setSelectedAddressId(savedAddress?.id || "");
      if (profileRes.ok && (!fullName || !profile.phone_number?.trim())) {
        router.push("/storefront/account?tab=profile&returnTo=%2Fstorefront%2Fcheckout");
      }
    }).catch(() => {
      if (!cancelled && session?.user) {
        if (session.user.email) setEmail(session.user.email);
        const parts = (session.user.name || "").trim().split(/\s+/).filter(Boolean);
        if (parts.length) {
          setFirstName(parts[0]);
          setLastName(parts.slice(1).join(" "));
        }
      }
    });
    return () => { cancelled = true; };
  }, [session, localToken, router, preferredAddressId]);

  // Razorpay simulation fallback (used when no live Razorpay credentials are configured)
  const [simPayment, setSimPayment] = useState<{ txnId: string; orderId: string } | null>(null);

  // Cart items
  const cartItems = useCartItems();
  const items = useMemo<OrderItem[]>(() => cartItems.map((item) => ({
    id: item.id,
    name: item.name,
    price: Number(item.price) || 0,
    quantity: item.quantity || 1,
    size: item.size,
    color: item.color,
    image: item.image,
  })), [cartItems]);

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const getEffectiveToken = () => {
    return session?.accessToken || localToken || (typeof window !== "undefined" ? localStorage.getItem("vastrax_token") : null);
  };

  const completeOrder = (orderId: string) => {
    setIsProcessing(false);
    setSimPayment(null);
    const shortId = orderId.split('-')[0].toUpperCase();
    setOrderNumber(shortId); // Short mock order ID
    setOrderComplete(true);

    // Save order activity flag and ID for AI Stylist & Account
    try {
      localStorage.setItem("vastrax_has_placed_order", "true");
      localStorage.setItem("vastrax_last_order_id", orderId);
    } catch {}

    // Clear cart across application
    clearCart();

    showToast({
      title: "Order Placed Successfully",
      description: `Order #${shortId} confirmed. Thank you!`,
      type: "success",
      duration: 5000
    });
  };

  const openRazorpayCheckout = (token: string, orderId: string, initiateData: PaymentInitiateData) => {
    if (!window.Razorpay) throw new Error("Payment checkout is still loading. Please try again.");
    const rzp = new window.Razorpay({
      key: initiateData.razorpay_key_id,
      amount: initiateData.amount,
      currency: initiateData.currency,
      order_id: initiateData.razorpay_order_id,
      name: "VASTRAX",
      description: `Order ${orderId}`,
      prefill: { name: `${firstName} ${lastName}`, email, contact: phone },
      theme: { color: "#E07A3F" },
      handler: async (response: RazorpayPaymentResponse) => {
        try {
          const verifyRes = await backendFetch(`${BACKEND_BASE}/payments/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              txn_id: initiateData.txn_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json().catch(() => ({}));
          if (!verifyRes.ok) throw new Error(verifyData.detail || verifyData.message || "Payment verification failed");
          completeOrder(orderId);
        } catch (err: unknown) {
          console.error(err);
          setIsProcessing(false);
          showToast({
            title: "Verification Error",
            description: err instanceof Error ? err.message : "Payment succeeded but verification failed. Please contact support.",
            type: "error",
            duration: 6000,
          });
        }
      },
      modal: {
        ondismiss: () => setIsProcessing(false),
      },
    });
    rzp.open();
  };

  const handleSimulateChoice = async (success: boolean) => {
    if (!simPayment) return;
    const token = getEffectiveToken();
    if (!token) {
      setIsAuthOpen(true);
      return;
    }
    setIsProcessing(true);

    try {
      const res = await backendFetch(`${BACKEND_BASE}/payments/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ txn_id: simPayment.txnId, success }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.message || "Payment simulation failed");

      if (success) {
        completeOrder(simPayment.orderId);
      } else {
        setIsProcessing(false);
        setSimPayment(null);
        showToast({
          title: "Payment Declined",
          description: "Transaction was declined by card issuer. Your order has been cancelled and inventory restored.",
          type: "error",
          duration: 5000,
        });
      }
    } catch (err: unknown) {
      console.error(err);
      setIsProcessing(false);
      showToast({
        title: "Payment Error",
        description: err instanceof Error ? err.message : "Failed to process payment response.",
        type: "error",
        duration: 4000,
      });
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;

    if (items.length === 0) {
      showToast({
        title: "Bag is Empty",
        description: "Please add garments to your bag before proceeding to checkout.",
        type: "error",
      });
      return;
    }

    const token = getEffectiveToken();
    if (!token) {
      setIsAuthOpen(true);
      showToast({
        title: "Sign In Required",
        description: "Please sign in to place your bespoke order.",
        type: "info",
      });
      return;
    }
    if (!selectedAddressId) {
      showToast({
        title: "Delivery Address Required",
        description: "Add a delivery address to your account before placing this order.",
        type: "info",
      });
      router.push("/storefront/account?tab=profile&showAddressForm=1&returnTo=%2Fstorefront%2Fcheckout");
      return;
    }

    setIsProcessing(true);

    try {
      const readinessRes = await backendFetch(`${BACKEND_BASE}/payments/readiness`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const readiness = await readinessRes.json().catch(() => ({}));
      const productionBuild = process.env.NODE_ENV === "production";
      if (!readinessRes.ok || !readiness.checkout_available ||
          (productionBuild && !readiness.razorpay_available)) {
        throw new Error("Razorpay payments are not configured yet. Please try again later.");
      }

      // 2. Create Order
      const orderRes = await backendFetch(`${BACKEND_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          address_id: selectedAddressId,
          payment_method: "UPI",
          total_amount: total,
          delivery_method: "standard",
          items: items.map(item => ({
            product_id: String(item.id),
            size: item.size || "M",
            color: item.color || "Default",
            quantity: item.quantity,
            unit_price: item.price
          }))
        })
      });

      const orderData = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) throw new Error(orderData.detail || orderData.message || "Failed to place order");

      // Payment methods are selected securely inside Razorpay Checkout.
      const initiateRes = await backendFetch(`${BACKEND_BASE}/payments/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          order_id: orderData.id,
          amount: total,
          payment_method: "UPI",
        })
      });
      const initiateData = await initiateRes.json().catch(() => ({}));
      if (!initiateRes.ok) throw new Error(initiateData.detail || initiateData.message || "Failed to initiate payment");

      if (initiateData.mode === "razorpay") {
        setIsProcessing(false);
        openRazorpayCheckout(token, orderData.id, initiateData);
      } else if (initiateData.mode === "simulation" && process.env.NODE_ENV !== "production") {
        setIsProcessing(false);
        setSimPayment({ txnId: initiateData.txn_id, orderId: orderData.id });
      } else {
        throw new Error("Razorpay payments are unavailable right now. Please try again later.");
      }

    } catch (err: unknown) {
      console.error(err);
      setIsProcessing(false);
      showToast({
        title: "Order Failed",
        description: err instanceof Error ? err.message : "Failed to place order. Please verify your items and try again.",
        type: "error",
        duration: 5000,
      });
    }
  };

  const effectiveToken = getEffectiveToken();

  if (status === "loading" && !effectiveToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (status === "unauthenticated" && !effectiveToken) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex flex-col items-center justify-center p-6">
        <div className="bg-surface border border-border/50 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
          <Lock className="w-12 h-12 text-accent mx-auto mb-6 opacity-80" />
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-muted-foreground mb-8">You must be signed in to proceed to checkout and secure your order.</p>
          <button 
            onClick={() => setIsAuthOpen(true)}
            className="w-full px-8 py-4 bg-accent hover:bg-accent-hover text-white rounded-full font-bold uppercase tracking-wider transition-colors shadow-lg shadow-accent/20"
          >
            Sign In to Checkout
          </button>
          <div className="mt-6">
            <Link href="/storefront/home" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Return to Store
            </Link>
          </div>
        </div>
        <AuthModal 
          isOpen={isAuthOpen} 
          onClose={() => {
            setIsAuthOpen(false);
            if (typeof window !== "undefined") setLocalToken(localStorage.getItem("vastrax_token"));
          }} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col transition-colors duration-300 pb-16">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Top Luxury Bar */}
      <header className="h-20 border-b border-border/80 bg-surface/80 backdrop-blur-md sticky top-0 z-40 px-6 md:px-12 flex items-center justify-between">
        <Link 
          href="/storefront/home" 
          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group uppercase tracking-wider"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Storefront
        </Link>

        {/* Center Brand */}
        <Link href="/storefront/home" className="text-base sm:text-2xl md:text-3xl font-black tracking-[0.12em] sm:tracking-[0.3em] uppercase hover:text-accent transition-colors">
          VASTRAX
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 pt-8">
        
        {orderComplete ? (
          /* Order Confirmation Screen */
          <div className="max-w-2xl mx-auto my-12 bg-surface border border-border rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 text-green-500 flex items-center justify-center mx-auto animate-bounce duration-1000">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-accent">Order Confirmed</span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Thank You For Your Order</h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                We&apos;ve received your purchase. A bespoke confirmation email and receipt has been sent to <span className="text-foreground font-medium">{email}</span>.
              </p>
            </div>

            <div className="bg-background rounded-2xl p-6 border border-border text-left space-y-4 max-w-md mx-auto">
              <div className="flex justify-between items-center text-xs pb-3 border-b border-border">
                <span className="text-muted-foreground">Order Reference</span>
                <span className="font-mono font-bold text-accent">{orderNumber}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-3 border-b border-border">
                <span className="text-muted-foreground">Estimated Delivery</span>
                <span className="font-medium text-foreground">
                  Delivery updates will be shared after your order is confirmed
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-bold text-foreground text-sm">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link 
                href="/storefront/home" 
                className="w-full sm:w-auto px-8 py-3 bg-accent hover:bg-accent/90 text-white font-semibold text-xs uppercase tracking-wider rounded-full transition-all shadow-[0_0_20px_rgba(224,122,63,0.3)]"
              >
                Continue Shopping
              </Link>
              <Link 
                href="/" 
                className="w-full sm:w-auto px-8 py-3 bg-background border border-border hover:bg-surface-hover text-foreground font-semibold text-xs uppercase tracking-wider rounded-full transition-colors"
              >
                View in Admin Orders
              </Link>
            </div>
          </div>
        ) : simPayment ? (
          /* Simulated Payment Gateway (no live Razorpay credentials configured) */
          <div className="max-w-md mx-auto my-12 bg-surface border border-border rounded-3xl p-8 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/30 text-accent flex items-center justify-center mx-auto">
              <CreditCard className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-accent">Simulated Payment Gateway</span>
              <h1 className="text-2xl font-extrabold tracking-tight">Complete Test Payment</h1>
              <p className="text-sm text-muted-foreground">
                Razorpay live credentials aren&apos;t configured yet. Simulate the outcome of this ₹{total.toFixed(2)} charge below.
              </p>
            </div>

            <div className="bg-background rounded-2xl p-4 border border-border text-left">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Transaction ID</span>
                <span className="font-mono font-bold text-accent">{simPayment.txnId}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleSimulateChoice(true)}
                className="w-full py-3 bg-accent hover:bg-accent/90 text-white rounded-full font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-75"
              >
                {isProcessing ? "Processing..." : "Pay Successfully"}
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleSimulateChoice(false)}
                className="w-full py-3 bg-background border border-border hover:bg-surface-hover text-foreground rounded-full font-semibold text-xs uppercase tracking-widest transition-colors disabled:opacity-75"
              >
                Cancel Payment
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          /* Empty Bag Screen */
          <div className="max-w-md mx-auto my-16 bg-surface border border-border/60 rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-400">
            <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/30 text-accent flex items-center justify-center mx-auto">
              <ShoppingBag className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-accent">Shopping Bag</span>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Your Bag is Empty</h1>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                You currently have no bespoke garments in your shopping bag. Discover our latest couture collection to place an order.
              </p>
            </div>
            <div className="pt-2">
              <Link 
                href="/storefront/collections" 
                className="inline-flex items-center justify-center w-full px-8 py-3.5 bg-accent hover:bg-accent/90 text-white font-bold text-xs uppercase tracking-wider rounded-full transition-all shadow-[0_0_20px_rgba(224,122,63,0.3)]"
              >
                Discover Collections
              </Link>
            </div>
          </div>
        ) : (
          /* Checkout Grid */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            
            {/* Left Column: Checkout Forms */}
            <form onSubmit={handlePlaceOrder} className="lg:col-span-7 space-y-8">
              
              {/* Step 1: Contact Information */}
              <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">1</div>
                    <h2 className="text-lg font-bold">Contact & Shipping Details</h2>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <p className="text-muted-foreground">Fields marked <span className="text-accent">*</span> are required.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Email Address <span className="text-accent">*</span></label>
                      <div className="relative">
                        <input 
                          type="email" 
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground transition-all"
                        />
                        <Mail className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Phone Number <span className="text-accent">*</span></label>
                      <div className="relative">
                        <input 
                          type="tel" 
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground transition-all"
                        />
                        <Phone className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">First Name <span className="text-accent">*</span></label>
                      <input 
                        type="text" 
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Last Name <span className="text-accent">*</span></label>
                      <input 
                        type="text" 
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-border pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-semibold text-foreground">Delivery Address <span className="text-accent">*</span></h3>
                      <Link
                        href="/storefront/account?tab=profile&showAddressForm=1&returnTo=%2Fstorefront%2Fcheckout"
                        className="text-sm font-semibold text-accent underline underline-offset-4 hover:text-accent/80"
                      >
                        Add delivery address
                      </Link>
                    </div>
                    {savedAddresses.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                        No saved delivery addresses. Add one to continue.
                      </p>
                    ) : (
                      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <legend className="sr-only">Choose a delivery address</legend>
                        {savedAddresses.map((entry) => (
                          <label key={entry.id} className={"flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors " + (selectedAddressId === entry.id ? "border-accent bg-accent/5" : "border-border bg-background")}>
                            <input
                              type="radio"
                              name="checkout-delivery-address"
                              value={entry.id}
                              checked={selectedAddressId === entry.id}
                              onChange={() => setSelectedAddressId(entry.id)}
                              className="mt-1 accent-accent"
                            />
                            <span className="text-sm">
                              <span className="block font-semibold text-foreground">{entry.label}{entry.is_default ? " · Default" : ""}</span>
                              <span className="mt-1 block text-muted-foreground">{entry.address_line1}</span>
                              <span className="block text-muted-foreground">{entry.city}, {entry.state} {entry.pincode}</span>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">2</div>
                  <h2 className="text-lg font-bold">Payment Method</h2>
                </div>
                <div className="flex items-start gap-4 rounded-xl border border-accent bg-accent/5 p-5">
                  <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">Pay securely with Razorpay</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      UPI, cards, net banking and wallets will be available in Razorpay Checkout when payment credentials are configured. Your payment details are entered securely with Razorpay.
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit"
                disabled={isProcessing}
                className="w-full py-4 bg-accent hover:bg-accent/90 text-white rounded-full font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all shadow-[0_0_25px_rgba(224,122,63,0.4)] disabled:opacity-75"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Authorizing Payment...
                  </>
                ) : (
                  <>
                    Place Order · ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Right Column: Order Summary */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-6 sticky top-28 shadow-xl">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <h3 className="font-bold text-base">Order Summary</h3>
                  <span className="text-xs text-muted-foreground">{items.length} Pieces</span>
                </div>

                {/* Items List */}
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4 items-center">
                      <div className="w-16 h-20 rounded-lg bg-background overflow-hidden shrink-0 border border-border relative">
                        <Image width={1200} height={900} unoptimized src={item.image || "/placeholder.svg"} alt={item.name} className="w-full h-full object-contain bg-[#f8f7f4] p-1" />
                        <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xs font-semibold text-foreground">{item.name}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{item.color} · {item.size}</p>
                      </div>
                      <span className="text-xs font-bold text-foreground">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>

                {/* Calculations */}
                <div className="space-y-2.5 pt-4 border-t border-border text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="text-foreground font-medium">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span className="text-foreground font-medium">Quote pending</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Estimated Sales Tax (8%)</span>
                    <span className="text-foreground font-medium">₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-foreground pt-3 border-t border-border">
                    <span>Total Amount</span>
                    <span className="text-accent">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

      </main>
      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => {
          setIsAuthOpen(false);
          if (typeof window !== "undefined") setLocalToken(localStorage.getItem("vastrax_token"));
        }} 
      />
    </div>
  );
}
