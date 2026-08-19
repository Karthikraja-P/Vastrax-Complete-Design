"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ChevronLeft, ShieldCheck, Lock, CreditCard, CheckCircle2, 
  Truck, Sparkles, MapPin, Phone, Mail, User, ArrowRight, Loader2,
  Package, ShoppingBag
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSession } from "next-auth/react";
import { AuthModal } from "@/components/auth/AuthModal";

interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
  image: string;
}

export default function CheckoutPage() {
  // Step State
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  const { data: session, status } = useSession();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      setIsAuthOpen(true);
    }
  }, [status]);

  // Form State
  const [email, setEmail] = useState("alexandra.vance@example.com");
  const [phone, setPhone] = useState("+1 (555) 382-9912");
  const [firstName, setFirstName] = useState("Alexandra");
  const [lastName, setLastName] = useState("Vance");
  const [address, setAddress] = useState("742 Evergreen Terrace");
  const [apartment, setApartment] = useState("Penthouse 4B");
  const [city, setCity] = useState("New York");
  const [postalCode, setPostalCode] = useState("10001");
  const [country, setCountry] = useState("United States");
  
  // Delivery Method
  const [deliveryMethod, setDeliveryMethod] = useState<"standard" | "express" | "concierge">("express");

  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState<"card" | "apple" | "cod">("card");
  const [cardNumber, setCardNumber] = useState("•••• •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("•••");
  const [cardHolder, setCardHolder] = useState("ALEXANDRA VANCE");

  // Cart items
  const items: OrderItem[] = [
    {
      id: 1,
      name: "Camel Wool Flat Cap",
      price: 45,
      quantity: 1,
      size: "M / 58cm",
      color: "Camel Brown",
      image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop"
    },
    {
      id: 2,
      name: "Cream Pullover Hoodie",
      price: 120,
      quantity: 1,
      size: "L",
      color: "Bone White",
      image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=400&auto=format&fit=crop"
    }
  ];

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shippingCost = deliveryMethod === "standard" ? 0 : deliveryMethod === "express" ? 15 : 35;
  const tax = subtotal * 0.08;
  const total = subtotal + shippingCost + tax;

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      setOrderNumber(`VX-${Math.floor(100000 + Math.random() * 900000)}`);
      setOrderComplete(true);
    }, 2000);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (status === "unauthenticated") {
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
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col transition-colors duration-300 pb-16">
      
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
        <Link href="/storefront/home" className="text-2xl md:text-3xl font-black tracking-[0.3em] uppercase">
          VASTRAX
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-surface border border-border px-3 py-1.5 rounded-full">
            <Lock className="w-3.5 h-3.5 text-accent" />
            <span>256-Bit SSL Encrypted</span>
          </div>
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
                We've received your purchase. A bespoke confirmation email and receipt has been sent to <span className="text-foreground font-medium">{email}</span>.
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
                  {deliveryMethod === 'concierge' ? 'Today (by 8:00 PM)' : deliveryMethod === 'express' ? '1-2 Business Days' : '3-5 Business Days'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-bold text-foreground text-sm">${total.toFixed(2)}</span>
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
                  <span className="text-xs text-muted-foreground">Express Guest</span>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Email Address</label>
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
                      <label className="font-medium text-foreground">Phone Number</label>
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
                      <label className="font-medium text-foreground">First Name</label>
                      <input 
                        type="text" 
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Last Name</label>
                      <input 
                        type="text" 
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-medium text-foreground">Street Address</label>
                    <input 
                      type="text" 
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Luxury Blvd"
                      className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Apt / Suite (Optional)</label>
                      <input 
                        type="text" 
                        value={apartment}
                        onChange={(e) => setApartment(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">City</label>
                      <input 
                        type="text" 
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Postal Code</label>
                      <input 
                        type="text" 
                        required
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Delivery Method */}
              <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">2</div>
                  <h2 className="text-lg font-bold">Delivery Method</h2>
                </div>

                <div className="space-y-3">
                  <label 
                    onClick={() => setDeliveryMethod("standard")}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      deliveryMethod === "standard" 
                        ? "border-accent bg-accent/5 ring-1 ring-accent" 
                        : "border-border bg-background hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        deliveryMethod === "standard" ? "border-accent" : "border-muted-foreground"
                      }`}>
                        {deliveryMethod === "standard" && <div className="w-2 h-2 rounded-full bg-accent" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Complimentary Standard Delivery</p>
                        <p className="text-xs text-muted-foreground">3-5 Business Days · Signature upon receipt</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-green-500">Free</span>
                  </label>

                  <label 
                    onClick={() => setDeliveryMethod("express")}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      deliveryMethod === "express" 
                        ? "border-accent bg-accent/5 ring-1 ring-accent" 
                        : "border-border bg-background hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        deliveryMethod === "express" ? "border-accent" : "border-muted-foreground"
                      }`}>
                        {deliveryMethod === "express" && <div className="w-2 h-2 rounded-full bg-accent" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Global Priority Express</p>
                        <p className="text-xs text-muted-foreground">1-2 Business Days · Priority Air Freight</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-foreground">$15.00</span>
                  </label>

                  <label 
                    onClick={() => setDeliveryMethod("concierge")}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      deliveryMethod === "concierge" 
                        ? "border-accent bg-accent/5 ring-1 ring-accent" 
                        : "border-border bg-background hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        deliveryMethod === "concierge" ? "border-accent" : "border-muted-foreground"
                      }`}>
                        {deliveryMethod === "concierge" && <div className="w-2 h-2 rounded-full bg-accent" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                          Private Concierge White-Glove
                          <Sparkles className="w-3.5 h-3.5 text-accent" />
                        </p>
                        <p className="text-xs text-muted-foreground">Same-Day Dedicated Courier with Garment Steaming</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-foreground">$35.00</span>
                  </label>
                </div>
              </div>

              {/* Step 3: Payment Method */}
              <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">3</div>
                  <h2 className="text-lg font-bold">Payment Method</h2>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`py-3 px-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1.5 border transition-all ${
                      paymentMethod === "card" 
                        ? "border-accent bg-accent/10 text-accent" 
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Credit Card
                  </button>

                  <button 
                    type="button"
                    onClick={() => setPaymentMethod("apple")}
                    className={`py-3 px-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1.5 border transition-all ${
                      paymentMethod === "apple" 
                        ? "border-accent bg-accent/10 text-accent" 
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="font-bold text-sm leading-4"> Pay</span>
                    Apple Pay
                  </button>

                  <button 
                    type="button"
                    onClick={() => setPaymentMethod("cod")}
                    className={`py-3 px-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1.5 border transition-all ${
                      paymentMethod === "cod" 
                        ? "border-accent bg-accent/10 text-accent" 
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    Cash / POS
                  </button>
                </div>

                {paymentMethod === "card" && (
                  <div className="space-y-4 pt-2 text-xs animate-in fade-in duration-300">
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Cardholder Name</label>
                      <input 
                        type="text" 
                        required
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground uppercase transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Card Number</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          required
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="4242 •••• •••• ••••"
                          className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground font-mono transition-all pr-12"
                        />
                        <CreditCard className="w-4 h-4 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="font-medium text-foreground">Expiry (MM/YY)</label>
                        <input 
                          type="text" 
                          required
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground font-mono transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-medium text-foreground">CVV / CVC</label>
                        <input 
                          type="password" 
                          maxLength={4}
                          required
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          placeholder="•••"
                          className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-accent text-foreground font-mono transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === "apple" && (
                  <div className="p-6 bg-background rounded-xl border border-border text-center space-y-2">
                    <p className="text-xs font-medium text-foreground">Fast 1-touch checkout with Apple Pay biometric token.</p>
                    <p className="text-[11px] text-muted-foreground">You will be prompted to authenticate with Face ID or Touch ID upon clicking Place Order.</p>
                  </div>
                )}

                {paymentMethod === "cod" && (
                  <div className="p-6 bg-background rounded-xl border border-border text-center space-y-2">
                    <p className="text-xs font-medium text-foreground">Pay via contactless POS or Cash directly to the courier.</p>
                    <p className="text-[11px] text-muted-foreground">Available for all local metropolitan areas.</p>
                  </div>
                )}
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
                    Place Order · ${total.toFixed(2)}
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
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xs font-semibold text-foreground">{item.name}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{item.color} · {item.size}</p>
                      </div>
                      <span className="text-xs font-bold text-foreground">${item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Calculations */}
                <div className="space-y-2.5 pt-4 border-t border-border text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="text-foreground font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping ({deliveryMethod.toUpperCase()})</span>
                    <span className="text-foreground font-medium">{shippingCost === 0 ? "Free" : `$${shippingCost.toFixed(2)}`}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Estimated Sales Tax (8%)</span>
                    <span className="text-foreground font-medium">${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-foreground pt-3 border-t border-border">
                    <span>Total Amount</span>
                    <span className="text-accent">${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="pt-2 border-t border-border space-y-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
                    <span>Complimentary 30-Day Returns & Exchanges</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-accent shrink-0" />
                    <span>Insured Signature Courier Dispatch</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
