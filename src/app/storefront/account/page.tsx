"use client";
import Image from "next/image";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, User, ChevronRight, Clock, CheckCircle2, Truck, ExternalLink, Plus, Trash2, Edit2, LogOut } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import { performSignOut } from "@/lib/auth-utils";
import { fetchApi } from "@/lib/api";

export const dynamic = "force-dynamic";

type MarketingPreferences = {
  email_marketing: boolean;
  email_marketing_changed_at: string | null;
  sms_marketing: boolean;
  sms_marketing_changed_at: string | null;
  history: Array<{ channel: string; granted: boolean; recorded_at: string }>;
};


interface OrderItem {
  id: string;
  orderNumber: string;
  date: string;
  total: string;
  status: "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED";
  items: {
    name: string;
    variant: string;
    price: string;
    image: string;
  }[];
  trackingNumber?: string;
  shippingAddress: string;
}

interface AccountAddress {
  id: string | number;
  name?: string;
  title?: string;
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  zip?: string;
  phone?: string;
  isDefault?: boolean;
}

const mockCustomerOrders: OrderItem[] = [];

export default function CustomerAccountPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CustomerAccountContent />
    </React.Suspense>
  );
}

function CustomerAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [activeTab, setActiveTab] = useState<"orders" | "profile">(
    searchParams.get("tab") === "profile" ? "profile" : "orders"
  );
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);
  
  useEffect(() => {
    const handleOpenStylist = () => setIsStylistOpen(true);
    window.addEventListener("open-stylist", handleOpenStylist);
    return () => window.removeEventListener("open-stylist", handleOpenStylist);
  }, []);

  // Profile state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [headerName, setHeaderName] = useState("Your account");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [marketing, setMarketing] = useState<MarketingPreferences>({
    email_marketing: false, email_marketing_changed_at: null,
    sms_marketing: false, sms_marketing_changed_at: null, history: [],
  });
  const [marketingError, setMarketingError] = useState("");
  const [marketingSaved, setMarketingSaved] = useState(false);
  const [savingMarketing, setSavingMarketing] = useState(false);

  useEffect(() => {
    fetchApi<{ full_name?: string; email?: string; phone_number?: string }>("/users/me")
      .then((profile) => {
        const fullName = (profile.full_name || "").trim();
        const parts = fullName.split(/\s+/);
        setFirstName(parts.shift() || "");
        setLastName(parts.join(" "));
        setHeaderName(fullName || "Your account");
        setEmail(profile.email || "");
        setPhone(profile.phone_number || "");
      })
      .catch(() => setProfileError("Unable to load your profile."));
    fetchApi<MarketingPreferences>("/users/me/marketing-consent")
      .then(setMarketing)
      .catch(() => setMarketingError("Unable to load marketing preferences."));
  }, []);

  // Address state
  const [addresses] = useState<AccountAddress[]>([]);
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      await fetchApi("/users/me", {
        method: "PUT",
        body: JSON.stringify({ full_name: fullName, phone_number: phone }),
      });
      setHeaderName(fullName);
      setSavedSuccess(true);
      if (returnTo === "/storefront/checkout") {
        router.replace("/storefront/checkout");
      }
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      setProfileError("Profile update failed. Please try again.");
    }
  };

  const saveMarketingPreferences = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingMarketing(true);
    setMarketingError("");
    setMarketingSaved(false);
    try {
      const updated = await fetchApi<MarketingPreferences>("/users/me/marketing-consent", {
        method: "PATCH",
        body: JSON.stringify({
          email_marketing: marketing.email_marketing,
          sms_marketing: marketing.sms_marketing,
        }),
      });
      setMarketing(updated);
      setMarketingSaved(true);
    } catch (error) {
      setMarketingError(error instanceof Error ? error.message : "Could not save marketing preferences.");
    } finally {
      setSavingMarketing(false);
    }
  };

  const handleDownloadInvoice = async (order: OrderItem) => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    
    // Add company logo/header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("VASTRAX", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("INVOICE", 105, 30, { align: "center" });
    
    // Order details
    doc.setFontSize(12);
    doc.text(`Order Number: ${order.orderNumber}`, 20, 50);
    doc.text(`Date: ${order.date}`, 20, 60);
    doc.text(`Status: ${order.status}`, 20, 70);
    
    if (order.trackingNumber) {
      doc.text(`Tracking Number: ${order.trackingNumber}`, 20, 80);
    }
    
    // Shipping Address
    doc.text("Shipping Address:", 20, 100);
    doc.setFontSize(10);
    doc.text(order.shippingAddress, 20, 110);
    
    // Items
    doc.setFontSize(12);
    doc.text("Items:", 20, 130);
    
    let yPos = 140;
    order.items.forEach((item, index) => {
      doc.setFontSize(10);
      doc.text(`${index + 1}. ${item.name} (${item.variant})`, 20, yPos);
      doc.text(item.price, 170, yPos);
      yPos += 10;
    });
    
    // Total
    doc.line(20, yPos + 5, 190, yPos + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Total: ${order.total}`, 140, yPos + 15);
    
    // Footer
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Thank you for your purchase.", 105, 280, { align: "center" });
    
    // Save the PDF
    doc.save(`Invoice_${order.orderNumber}.pdf`);
  };

  const getStatusBadge = (status: OrderItem["status"]) => {
    switch (status) {
      case "DELIVERED":
        return <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Delivered</span>;
      case "SHIPPED":
        return <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-accent/10 text-accent border border-accent/20">In Transit</span>;
      case "PROCESSING":
        return <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">Processing</span>;
      default:
        return <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Confirmed</span>;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onOpenCart={() => setIsCartOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-8">
          <Link href="/storefront/home" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">Profile</span>
        </div>

        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-border/40">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-accent to-[#d95f26] p-0.5 shadow-[0_0_20px_rgba(224,122,63,0.3)]">
              <div className="w-full h-full rounded-full bg-surface flex items-center justify-center text-xl font-bold text-foreground uppercase">
                {headerName.charAt(0)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{headerName}</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{email}</p>
            </div>
          </div>
          <div>
            <button
              onClick={() => performSignOut("/storefront/home")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-all shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Portal Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1 space-y-2">
            {([
              { id: "orders", label: "Orders & Shipments", icon: Package },
              { id: "profile", label: "Account Profile", icon: User },
            ] as const).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-lg font-medium transition-all ${
                    isActive 
                      ? "bg-accent/15 text-accent border border-accent/30 shadow-[0_0_15px_rgba(224,122,63,0.15)]" 
                      : "text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-accent" : "text-muted-foreground"}`} />
                    <span>{tab.label}</span>
                  </div>
                </button>
              );
            })}

            <div className="pt-4 border-t border-border/40">
              <button
                onClick={() => performSignOut("/storefront/home")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="lg:col-span-3">
            {/* ORDERS TAB */}
            {activeTab === "orders" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Orders</h2>
                </div>

                <div className="space-y-6">
                  {mockCustomerOrders.length === 0 ? (
                    <div className="rounded-2xl border border-border/80 bg-surface/60 px-6 py-12 text-center">
                      <Package className="mx-auto h-10 w-10 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold text-foreground">No order yet</h3>
                      <p className="mt-2 text-sm text-muted-foreground">Your orders and shipment updates will appear here after you place an order.</p>
                    </div>
                  ) : mockCustomerOrders.map((order) => (
                    <div 
                      key={order.id}
                      className="bg-surface/60 border border-border/80 rounded-2xl p-6 transition-all hover:border-border backdrop-blur-md shadow-lg"
                    >
                      {/* Order Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-base font-bold text-foreground">{order.orderNumber}</span>
                            {getStatusBadge(order.status)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Placed on {order.date} • Total: <span className="text-foreground font-semibold">{order.total}</span></p>
                        </div>

                        {order.trackingNumber && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-surface-hover/80 px-3 py-1.5 rounded-lg border border-border">
                            <Truck className="w-3.5 h-3.5 text-accent" />
                            <span>Tracking: <strong className="text-foreground font-mono">{order.trackingNumber}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Visual Fulfillment Timeline */}
                      <div className="py-6 border-b border-border/60">
                        <div className="relative flex items-center justify-between max-w-xl mx-auto">
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-border w-full -z-0" />
                          <div 
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-accent -z-0 transition-all duration-500" 
                            style={{ 
                              width: order.status === "DELIVERED" ? "100%" : order.status === "SHIPPED" ? "66%" : order.status === "PROCESSING" ? "33%" : "5%" 
                            }} 
                          />

                          {[
                            { step: "Confirmed", icon: CheckCircle2, done: true },
                            { step: "Processing", icon: Clock, done: order.status !== "CONFIRMED" },
                            { step: "In Transit", icon: Truck, done: order.status === "SHIPPED" || order.status === "DELIVERED" },
                            { step: "Delivered", icon: Package, done: order.status === "DELIVERED" },
                          ].map((s, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-2 relative z-10">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors ${
                                s.done ? "bg-accent text-white shadow-[0_0_12px_rgba(224,122,63,0.4)]" : "bg-surface border border-border text-muted-foreground"
                              }`}>
                                <s.icon className="w-3.5 h-3.5" />
                              </div>
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${s.done ? "text-foreground" : "text-muted-foreground"}`}>
                                {s.step}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Items Listing */}
                      <div className="pt-4 space-y-3">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <Image width={1200} height={900} unoptimized src={item.image} alt={item.name} className="w-12 h-16 object-contain rounded-lg border border-border bg-[#f8f7f4] p-0.5" />
                              <div>
                                <h4 className="text-sm font-semibold text-foreground">{item.name}</h4>
                                <p className="text-xs text-muted-foreground">{item.variant}</p>
                              </div>
                            </div>
                            <span className="text-sm font-medium text-foreground">{item.price}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Ship to: {order.shippingAddress}</span>
                        <button 
                          onClick={() => handleDownloadInvoice(order)}
                          className="text-accent hover:underline flex items-center gap-1 font-medium"
                        >
                          Download Invoice <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Client Profile</h2>
                  <p className="text-base text-muted-foreground mt-1">Personal details and concierge preferences.</p>
                </div>

                <form onSubmit={handleSaveProfile} className="bg-surface/60 border border-border/80 rounded-2xl p-6 space-y-4 max-w-xl">
                  {profileError && <p role="alert" className="text-red-400">{profileError}</p>}
                  {savedSuccess && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl text-lg font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" /> Profile successfully updated.
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-base font-semibold text-foreground uppercase tracking-wider mb-2">First Name <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value.replace(/[^a-zA-Z\s-]/g, ''))}
                        className="w-full bg-surface border border-border/50 rounded-xl px-4 py-3 text-lg text-foreground focus:outline-none focus:border-accent transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-base font-semibold text-foreground uppercase tracking-wider mb-2">Last Name <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value.replace(/[^a-zA-Z\s-]/g, ''))}
                        className="w-full bg-surface border border-border/50 rounded-xl px-4 py-3 text-lg text-foreground focus:outline-none focus:border-accent transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-foreground uppercase tracking-wider mb-2">Email Address <span className="text-red-500">*</span></label>
                    <input 
                      type="email" 
                      value={email}
                      readOnly
                      className="w-full bg-surface border border-border/50 rounded-xl px-4 py-3 text-lg text-foreground focus:outline-none focus:border-accent transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-foreground uppercase tracking-wider mb-2">Phone Number</label>
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-surface border border-border/50 rounded-xl px-4 py-3 text-lg text-foreground focus:outline-none focus:border-accent transition-colors"
                      required
                    />
                  </div>

                  <div className="pt-4 border-t border-border/40">
                    <button 
                      type="submit"
                      className="px-8 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl text-lg font-bold uppercase tracking-wider transition-all shadow-md shadow-accent/20"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>

                <form onSubmit={saveMarketingPreferences} className="mt-8 bg-surface/60 border border-border/80 rounded-2xl p-6 max-w-xl space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Marketing preferences</h3>
                    <p className="text-sm text-muted-foreground mt-1">Optional product and offer updates. Order and delivery messages are not affected.</p>
                  </div>
                  {marketingError && <p role="alert" className="text-sm text-red-400">{marketingError}</p>}
                  {marketingSaved && <p role="status" className="text-sm text-emerald-500">Your preferences were saved.</p>}
                  <label className="flex items-start gap-3 border-t border-border/40 pt-4">
                    <input type="checkbox" checked={marketing.email_marketing} onChange={event => setMarketing(current => ({ ...current, email_marketing: event.target.checked }))} className="mt-1 accent-accent" />
                    <span><span className="block text-sm font-semibold text-foreground">Email offers and product updates</span><span className="text-xs text-muted-foreground">{marketing.email_marketing ? "You have opted in." : "You have not opted in."}</span></span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={marketing.sms_marketing} onChange={event => setMarketing(current => ({ ...current, sms_marketing: event.target.checked }))} className="mt-1 accent-accent" />
                    <span><span className="block text-sm font-semibold text-foreground">SMS offers and product updates</span><span className="text-xs text-muted-foreground">{marketing.sms_marketing ? "You have opted in." : "You have not opted in."}</span></span>
                  </label>
                  <button disabled={savingMarketing} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{savingMarketing ? "Saving…" : "Save preferences"}</button>
                </form>

                <div className="mt-12 bg-surface/60 border border-border/80 rounded-2xl p-6 max-w-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Security Settings</h3>
                      <p className="text-sm text-muted-foreground mt-1">Manage your account security.</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-4 border-t border-border/40">
                    <div>
                      <p className="text-base font-semibold text-foreground">Two-Factor Authentication (SMS)</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Require a 6-digit code sent to your mobile device when logging in.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIs2FAEnabled(!is2FAEnabled)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        is2FAEnabled ? "bg-accent" : "bg-border/60"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          is2FAEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-12">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">Delivery Addresses</h3>
                      <p className="text-base text-muted-foreground mt-1">Manage shipping locations for express delivery.</p>
                    </div>
                    {!isAddingAddress && (
                      <button 
                        onClick={() => setIsAddingAddress(true)}
                        className="px-4 py-2 rounded-full bg-accent hover:bg-accent/90 text-white text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(224,122,63,0.3)]"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Address
                      </button>
                    )}
                  </div>

                  {isAddingAddress ? (
                    <div className="bg-surface/60 border border-border/80 rounded-2xl p-6">
                      <h4 className="text-sm font-bold mb-4">Add New Address</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase">Street Number & Name<span className="text-red-500 ml-1">*</span></label>
                          <input type="text" placeholder="e.g. 123 Main St" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent" required />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase">Nearby Landmark</label>
                          <input type="text" placeholder="e.g. Opposite Central Park" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase">City<span className="text-red-500 ml-1">*</span></label>
                          <input type="text" onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z\s-]/g, ''); }} className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent" required />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase">State / Province<span className="text-red-500 ml-1">*</span></label>
                          <input type="text" onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z\s-]/g, ''); }} className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent" required />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase">Country<span className="text-red-500 ml-1">*</span></label>
                          <input type="text" onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z\s-]/g, ''); }} className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent" required />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase">Zip / Postal Code<span className="text-red-500 ml-1">*</span></label>
                          <input type="text" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent" required />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase">Mobile Number<span className="text-red-500 ml-1">*</span></label>
                          <input type="tel" onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ''); }} placeholder="5550000000" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent" required />
                        </div>
                      </div>
                      <div className="mt-6 flex justify-end gap-3">
                        <button 
                          onClick={() => setIsAddingAddress(false)}
                          className="px-6 py-2.5 bg-transparent border border-border hover:bg-surface-hover text-foreground rounded-full text-xs font-semibold uppercase tracking-wider transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => setIsAddingAddress(false)}
                          className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-full text-xs font-semibold uppercase tracking-wider transition-colors"
                        >
                          Save Address
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {addresses.map((addr) => (
                        <div key={addr.id} className="bg-surface/60 border border-border/80 rounded-2xl p-5 relative flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-accent">{addr.title}</span>
                              {addr.isDefault && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/10 text-accent border border-accent/20">Default</span>
                              )}
                            </div>
                            <h4 className="font-semibold text-foreground text-sm">{addr.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1">{addr.street}</p>
                            <p className="text-xs text-muted-foreground">{addr.city}, {addr.state} {addr.zip}</p>
                          </div>

                          <div className="mt-6 pt-3 border-t border-border/40 flex items-center justify-end gap-3 text-xs">
                            <button className="text-muted-foreground hover:text-foreground flex items-center gap-1">
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            {!addr.isDefault && (
                              <button className="text-red-400 hover:text-red-300 flex items-center gap-1">
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <StylistDrawer isOpen={isStylistOpen} onClose={() => setIsStylistOpen(false)} />
    </div>
  );
}
