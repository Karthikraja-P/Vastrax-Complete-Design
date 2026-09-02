import React, { useState, useEffect, useCallback } from "react";
import { X, Trash2, Plus, Minus, ArrowRight, ShieldCheck, ShoppingBag, Sparkles, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { promosApi } from "@/lib/api";
import { CartItem, getCart, updateCartQuantity as updateQty, removeFromCart as removeItemFromCart } from "@/lib/cart";
import { showToast } from "@/lib/toast";

export type { CartItem };

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items?: CartItem[];
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const loadCart = useCallback(() => {
    const items = getCart();
    setCartItems(items);
  }, []);

  // Sync cart on initial mount and when drawer opens
  useEffect(() => {
    loadCart();
  }, [loadCart, isOpen]);

  // Listen to cross-component cart events
  useEffect(() => {
    window.addEventListener("cart-updated", loadCart);
    window.addEventListener("storage", loadCart);
    return () => {
      window.removeEventListener("cart-updated", loadCart);
      window.removeEventListener("storage", loadCart);
    };
  }, [loadCart]);

  const [promoCode, setPromoCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [promoMessage, setPromoMessage] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);

  const updateQuantity = (id: number | string, delta: number, size?: string) => {
    const updated = updateQty(id, delta, size);
    setCartItems(updated);
  };

  const removeItem = (id: number | string, size?: string, name?: string) => {
    const updated = removeItemFromCart(id, size);
    setCartItems(updated);
    showToast({
      title: "Removed from Bag",
      description: name ? `${name} was removed from your bag.` : undefined,
      type: "info",
      duration: 2500,
    });
  };

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    const res = await promosApi.validate(promoCode, subtotal);
    if (res.valid) {
      setDiscountPercent(res.discountPercentage);
      setPromoApplied(true);
      setPromoMessage(res.message);
      setPromoError("");
    } else {
      setPromoError(res.message);
      setPromoMessage("");
      setDiscountPercent(0);
      setPromoApplied(false);
    }
  };

  const discountAmount = (subtotal * discountPercent) / 100;
  const shipping = subtotal > 150 || subtotal === 0 ? 0 : 15;
  const total = Math.max(0, subtotal - discountAmount + shipping);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-surface border-l border-border h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300 text-foreground">
        
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide">Your Shopping Bag</h2>
              <p className="text-xs text-muted-foreground">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} selected</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Free Shipping Progress */}
        <div className="px-6 py-3 bg-accent/5 border-b border-border/50">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-foreground">
              {subtotal >= 150 ? (
                <span className="text-green-500 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> You unlocked Complimentary Global Delivery!
                </span>
              ) : (
                `Add $${(150 - subtotal).toFixed(0)} more for Complimentary Delivery`
              )}
            </span>
            <span className="text-muted-foreground text-[11px]">${subtotal.toFixed(0)} / $150</span>
          </div>
          <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-accent h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (subtotal / 150) * 100)}%` }}
            />
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
              <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center text-muted-foreground border border-border">
                <ShoppingBag className="w-8 h-8 opacity-40" />
              </div>
              <div>
                <p className="text-base font-semibold">Your bag is empty</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">Explore our latest seasonal collections and curated apparel pieces.</p>
              </div>
              <button 
                onClick={onClose}
                className="px-6 py-2 rounded-full bg-accent hover:bg-accent/90 text-white text-xs font-semibold uppercase tracking-wider transition-colors"
              >
                Discover Collections
              </button>
            </div>
          ) : (
            cartItems.map((item) => (
              <div 
                key={`${item.id}-${item.size || 'M'}`}
                className="flex gap-4 p-3 bg-background/60 rounded-xl border border-border/80 group hover:border-accent/30 transition-all"
              >
                <div className="w-20 h-24 rounded-lg bg-surface-hover overflow-hidden shrink-0 border border-border/40">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                
                <div className="flex-1 flex flex-col justify-between py-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-1">{item.name}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.color} · Size: {item.size || "M"}</p>
                    </div>
                    <span className="text-sm font-bold text-foreground">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
                      <button 
                        onClick={() => updateQuantity(item.id, -1, item.size)}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-semibold w-4 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, 1, item.size)}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button 
                      onClick={() => removeItem(item.id, item.size, item.name)}
                      className="text-muted-foreground hover:text-red-400 p-1.5 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Summary */}
        {cartItems.length > 0 && (
          <div className="p-6 border-t border-border bg-surface/90 space-y-4">
            
            {/* Promo Code Input */}
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Promo code (e.g. VASTRAX10)"
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-accent text-foreground uppercase placeholder:normal-case placeholder:text-muted-foreground"
                />
                <button 
                  onClick={applyPromo}
                  className="px-4 py-2 bg-background border border-border hover:bg-surface-hover rounded-lg text-xs font-semibold text-foreground transition-colors"
                >
                  Apply
                </button>
              </div>
              {promoApplied && <p className="text-[11px] text-green-500 font-medium">✓ Promo applied: {discountPercent}% off</p>}
              {promoError && <p className="text-[11px] text-red-400 font-medium">{promoError}</p>}
            </div>

            {/* Price Calculations */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="text-foreground font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-green-500">
                  <span>Discount ({discountPercent}%)</span>
                  <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Estimated Shipping</span>
                <span className="text-foreground font-medium">{shipping === 0 ? "Free" : `₹${shipping.toLocaleString('en-IN')}`}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-border">
                <span>Estimated Total</span>
                <span className="text-accent text-base font-extrabold">₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <div className="space-y-2 pt-2">
              <Link 
                href="/storefront/checkout"
                onClick={onClose}
                className="w-full py-3.5 bg-accent hover:bg-accent/90 text-white rounded-full font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(224,122,63,0.35)]"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" />
              </Link>
              
              <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                <span>Encrypted 256-bit Secure Checkout</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
