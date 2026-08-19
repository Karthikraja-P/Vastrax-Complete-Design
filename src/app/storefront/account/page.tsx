"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Package, MapPin, Heart, User, ChevronRight, 
  Clock, CheckCircle2, Truck, ExternalLink, Plus, Trash2, Edit2, ShoppingBag, LogOut
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import jsPDF from "jspdf";

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

const mockCustomerOrders: OrderItem[] = [];

export default function CustomerAccountPage() {
  const [activeTab, setActiveTab] = useState<"orders" | "favorites" | "profile">("orders");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);
  
  // Profile state
  const [firstName, setFirstName] = useState("Aishwarya");
  const [lastName, setLastName] = useState("R");
  const [headerName, setHeaderName] = useState("Aishwarya R");
  const [email, setEmail] = useState("aishwarya.r@outlook.com");
  const [phone, setPhone] = useState("+91 99622 88110");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Address state
  const [addresses, setAddresses] = useState<any[]>([]);
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  const [favorites, setFavorites] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("vastrax_favorites");
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const toggleFavorite = (id: string | number) => {
    const newFavorites = favorites.filter(f => f.id !== id);
    setFavorites(newFavorites);
    localStorage.setItem("vastrax_favorites", JSON.stringify(newFavorites));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setHeaderName(`${firstName} ${lastName}`);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDownloadInvoice = (order: OrderItem) => {
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
    <div className="min-h-screen bg-[#0c0d0e] text-[#ededed]">
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
        </div>

        {/* Portal Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1 space-y-2">
            {[
              { id: "orders", label: "Orders & Shipments", icon: Package },
              { id: "favorites", label: "Favorites", icon: Heart },
              { id: "profile", label: "Account Profile", icon: User },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
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
                  {mockCustomerOrders.map((order) => (
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
                              <img src={item.image} alt={item.name} className="w-12 h-16 object-cover rounded-lg border border-border" />
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

            {/* FAVORITES TAB */}
            {activeTab === "favorites" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Favorites</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {favorites.map((item) => (
                    <div key={item.id} className="group bg-surface/60 border border-border/80 rounded-2xl overflow-hidden flex flex-col justify-between">
                      <div className="aspect-[3/4] overflow-hidden bg-surface-hover relative">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <button 
                          onClick={() => toggleFavorite(item.id)}
                          className="absolute top-3 right-3 p-2 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 transition-colors z-10"
                        >
                          <Heart className="w-4 h-4 text-accent fill-accent" />
                        </button>
                      </div>
                      <div className="p-4">
                        <h4 className="font-semibold text-foreground text-sm truncate">{item.name}</h4>
                        <p className="text-xs font-semibold text-accent mt-1">{item.price}</p>
                        <button 
                          onClick={() => setIsCartOpen(true)}
                          className="mt-4 w-full py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-accent/20 flex items-center justify-center gap-2"
                        >
                          <ShoppingBag className="w-4 h-4" /> Move to Bag
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WISHLIST TAB -> (Removed, Replaced by FAVORITES above) */}            {/* PROFILE TAB */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Client Profile</h2>
                  <p className="text-base text-muted-foreground mt-1">Personal details and concierge preferences.</p>
                </div>

                <form onSubmit={handleSaveProfile} className="bg-surface/60 border border-border/80 rounded-2xl p-6 space-y-4 max-w-xl">
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
                      onChange={(e) => setEmail(e.target.value)}
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
