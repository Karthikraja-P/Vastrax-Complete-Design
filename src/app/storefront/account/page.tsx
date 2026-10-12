"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Package, Heart, User, ChevronRight,
  Clock, CheckCircle2, Truck, ExternalLink, Plus, Trash2, Edit2, ShoppingBag, LogOut
} from "lucide-react";
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

type FavoriteItem = { id: string | number; image: string; name: string; price: string };
type SavedAddress = { id: string | number; title: string; isDefault: boolean; name: string; street: string; city: string; state: string; zip: string };

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
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#0c0d0e]" />}>
      <CustomerAccountContent />
    </React.Suspense>
  );
}

function CustomerAccountContent() {
  const [activeTab, setActiveTab] = useState<"orders" | "favorites" | "profile">("orders");
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
  const [addresses] = useState<SavedAddress[]>([]);
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem("vastrax_favorites");
      if (!saved) return;
      try {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setFavorites(parsed as FavoriteItem[]);
      } catch {
        // Ignore invalid local favorites and keep the empty list.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleFavorite = (id: string | number) => {
    const newFavorites = favorites.filter(f => f.id !== id);
    setFavorites(newFavorites);
    localStorage.setItem("vastrax_favorites", JSON.line-none focus:border-accent" required />
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
