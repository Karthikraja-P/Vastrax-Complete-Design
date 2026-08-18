"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Package, MapPin, Heart, User, ChevronRight, 
  Clock, CheckCircle2, Truck, ExternalLink, Plus, Trash2, Edit2, ShoppingBag, LogOut
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";

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

const mockCustomerOrders: OrderItem[] = [
  {
    id: "ord-1",
    orderNumber: "VX-89241",
    date: "Aug 16, 2026",
    total: "$625.00",
    status: "SHIPPED",
    trackingNumber: "TRK-98421894",
    shippingAddress: "742 Evergreen Terrace, Apt 4B, New York, NY 10001",
    items: [
      {
        name: "Noir Silk Evening Blazer",
        variant: "Midnight / Size M",
        price: "$480.00",
        image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=400&auto=format&fit=crop"
      },
      {
        name: "Monochrome Wool Knit Tee",
        variant: "Obsidian / Size L",
        price: "$145.00",
        image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=400&auto=format&fit=crop"
      }
    ]
  },
  {
    id: "ord-2",
    orderNumber: "VX-84102",
    date: "Jul 28, 2026",
    total: "$380.00",
    status: "DELIVERED",
    trackingNumber: "TRK-74120953",
    shippingAddress: "742 Evergreen Terrace, Apt 4B, New York, NY 10001",
    items: [
      {
        name: "Minimalist Cashmere Turtleneck",
        variant: "Charcoal / Size M",
        price: "$380.00",
        image: "https://images.unsplash.com/photo-1624542313043-30df84aee15d?q=80&w=400&auto=format&fit=crop"
      }
    ]
  }
];

export default function CustomerAccountPage() {
  const [activeTab, setActiveTab] = useState<"orders" | "addresses" | "wishlist" | "profile">("orders");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);
  
  // Profile state
  const [name, setName] = useState("Alexandre Vance");
  const [email, setEmail] = useState("a.vance@atelier-vance.com");
  const [phone, setPhone] = useState("+1 (555) 234-5678");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Address state
  const [addresses, setAddresses] = useState([
    {
      id: "addr-1",
      title: "Primary Residence",
      name: "Alexandre Vance",
      street: "742 Evergreen Terrace, Apt 4B",
      city: "New York",
      state: "NY",
      zip: "10001",
      isDefault: true
    },
    {
      id: "addr-2",
      title: "Design Studio",
      name: "Alexandre Vance",
      street: "450 West 14th Street, Studio 8",
      city: "New York",
      state: "NY",
      zip: "10014",
      isDefault: false
    }
  ]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
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
          <span className="text-foreground">Client Portal</span>
        </div>

        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-border/40">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-accent to-[#d95f26] p-0.5 shadow-[0_0_20px_rgba(224,122,63,0.3)]">
              <div className="w-full h-full rounded-full bg-surface flex items-center justify-center text-xl font-bold text-foreground">
                {name.split(" ").map(n => n[0]).join("")}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/20 text-accent border border-accent/30">
                  VIP Concierge
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsStylistOpen(true)}
              className="px-4 py-2 rounded-full border border-accent/30 bg-accent/10 hover:bg-accent/20 text-accent text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-2"
            >
              Consult Personal Stylist
            </button>
            <Link 
              href="/storefront/home"
              className="px-4 py-2 rounded-full border border-border hover:bg-surface-hover text-muted-foreground hover:text-foreground text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" /> Exit
            </Link>
          </div>
        </div>

        {/* Portal Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1 space-y-2">
            {[
              { id: "orders", label: "Orders & Shipments", icon: Package, count: mockCustomerOrders.length },
              { id: "addresses", label: "Saved Addresses", icon: MapPin, count: addresses.length },
              { id: "wishlist", label: "Private Wishlist", icon: Heart, count: 3 },
              { id: "profile", label: "Account Profile", icon: User },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? "bg-accent/15 text-accent border border-accent/30 shadow-[0_0_15px_rgba(224,122,63,0.15)]" 
                      : "text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-accent" : "text-muted-foreground"}`} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.count !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? "bg-accent/20 text-accent font-bold" : "bg-surface-hover text-muted-foreground"}`}>
                      {tab.count}
                    </span>
                  )}
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
                  <h2 className="text-xl font-bold text-foreground">Active & Past Orders</h2>
                  <p className="text-xs text-muted-foreground mt-1">Real-time status, tracking numbers, and receipt history.</p>
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
                        <button className="text-accent hover:underline flex items-center gap-1 font-medium">
                          Download Invoice <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ADDRESSES TAB */}
            {activeTab === "addresses" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Delivery Addresses</h2>
                    <p className="text-xs text-muted-foreground mt-1">Manage shipping locations for express delivery.</p>
                  </div>
                  <button className="px-4 py-2 rounded-full bg-accent hover:bg-accent/90 text-white text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(224,122,63,0.3)]">
                    <Plus className="w-3.5 h-3.5" /> Add Address
                  </button>
                </div>

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
              </div>
            )}

            {/* WISHLIST TAB */}
            {activeTab === "wishlist" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Curated Wishlist</h2>
                  <p className="text-xs text-muted-foreground mt-1">Garments and tailoring pieces saved for future acquisition.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    { name: "Silk Crepe Tailored Trousers", price: "$320.00", image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=400&auto=format&fit=crop" },
                    { name: "Sculpted Cashmere Coat", price: "$890.00", image: "https://images.unsplash.com/photo-1544441893-675973e31985?q=80&w=400&auto=format&fit=crop" },
                    { name: "Architectural Oxford Shirt", price: "$260.00", image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=400&auto=format&fit=crop" },
                  ].map((item, idx) => (
                    <div key={idx} className="group bg-surface/60 border border-border/80 rounded-2xl overflow-hidden flex flex-col justify-between">
                      <div className="aspect-[3/4] overflow-hidden bg-surface-hover">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                      <div className="p-4">
                        <h4 className="font-semibold text-foreground text-sm truncate">{item.name}</h4>
                        <p className="text-xs font-semibold text-accent mt-1">{item.price}</p>
                        <button 
                          onClick={() => setIsCartOpen(true)}
                          className="mt-3 w-full py-2 bg-surface-hover hover:bg-accent hover:text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors border border-border flex items-center justify-center gap-2"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" /> Move to Bag
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
                  <h2 className="text-xl font-bold text-foreground">Client Profile</h2>
                  <p className="text-xs text-muted-foreground mt-1">Personal details and concierge preferences.</p>
                </div>

                <form onSubmit={handleSaveProfile} className="bg-surface/60 border border-border/80 rounded-2xl p-6 space-y-4 max-w-xl">
                  {savedSuccess && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Profile changes successfully updated.
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Full Name</label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Email Address</label>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Phone Number</label>
                    <input 
                      type="tel" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button 
                      type="submit" 
                      className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-full text-xs font-semibold uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)]"
                    >
                      Save Profile
                    </button>
                  </div>
                </form>
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
