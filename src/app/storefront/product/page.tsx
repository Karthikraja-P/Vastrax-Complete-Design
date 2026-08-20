"use client";

import { useState, useRef, useEffect } from "react";
import { 
  ChevronRight, Heart, Star, Share2, Ruler, Truck, ShieldCheck, 
  Minus, Plus, ChevronLeft, ArrowRight, Menu, Search, User, ShoppingBag,
  Phone, Link as LinkIcon, RefreshCw, Check
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/auth/AuthModal";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";

const relatedProducts = [
  { id: 101, name: "Camel Wool Flat Cap", price: 45, originalPrice: 55, rating: 3.8, image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop" },
  { id: 102, name: "Rust Corduroy Baseball Cap", price: 39, originalPrice: 49, rating: 4.1, image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=400&auto=format&fit=crop" },
  { id: 103, name: "Forest Green Ribbed Beanie", price: 32, rating: 4.0, image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=400&auto=format&fit=crop" },
  { id: 104, name: "Mustard Bucket Hat", price: 35, rating: 4.2, image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=400&auto=format&fit=crop" },
];

const colors = [
  { name: 'Black', value: '#1a1a1a' },
  { name: 'Brown', value: '#4a3b32' },
  { name: 'Navy', value: '#1d2b45' },
  { name: 'Teal', value: '#244c5a' },
];

export default function ProductPage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);
  const [bagItems, setBagItems] = useState<number[]>([101]);
  const [activeColor, setActiveColor] = useState('Black');
  const [activeSize, setActiveSize] = useState('One Size');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('Description');

  const [favorites, setFavorites] = useState<number[]>([]);
  
  const { data: session } = useSession();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  useEffect(() => {
    if (session?.user?.name) {
      setIsLoggedIn(true);
      setUserName(session.user.name);
    }
  }, [session]);

  useEffect(() => {
    const saved = localStorage.getItem("vastrax_favorites");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFavorites(parsed.map((f: any) => f.id));
      } catch (e) {}
    }
  }, []);

  const toggleFavorite = (product: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const savedStr = localStorage.getItem("vastrax_favorites");
    let currentFavs = savedStr ? JSON.parse(savedStr) : [];
    
    if (currentFavs.some((f: any) => f.id === product.id)) {
      currentFavs = currentFavs.filter((f: any) => f.id !== product.id);
      setFavorites(prev => prev.filter(id => id !== product.id));
    } else {
      currentFavs.push({
        id: product.id,
        name: product.name,
        price: `$${product.price || 0}.00`,
        image: product.image
      });
      setFavorites(prev => [...prev, product.id]);
    }
    localStorage.setItem("vastrax_favorites", JSON.stringify(currentFavs));
  };

  useEffect(() => {
    const handleOpenStylist = () => setIsStylistOpen(true);
    window.addEventListener("open-stylist", handleOpenStylist);
    return () => window.removeEventListener("open-stylist", handleOpenStylist);
  }, []);

  const addToCart = () => {
    const saved = localStorage.getItem("vastrax_cart");
    const currentCart = saved ? JSON.parse(saved) : [];
    
    // Check if it already exists
    const existingIndex = currentCart.findIndex((i: any) => i.id === 101);
    if (existingIndex >= 0) {
      currentCart[existingIndex].quantity += quantity;
    } else {
      currentCart.push({
        id: 101,
        name: "Camel Wool Flat Cap",
        price: 45,
        quantity: quantity,
        size: activeSize,
        color: activeColor,
        image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop"
      });
    }
    
    localStorage.setItem("vastrax_cart", JSON.stringify(currentCart));
    setBagItems([101]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col transition-colors duration-300">
      {/* Reused Header Style */}
      <header className="h-20 flex items-center justify-between relative px-6 md:px-12 sticky top-2 md:top-4 bg-surface z-50 rounded-[2rem] shadow-md border border-border/50 mx-2 md:mx-4 mt-2 md:mt-4 transition-colors duration-300">
        {/* Left Side: Navigation */}
        <div className="flex items-center gap-6">
          <button className="md:hidden text-foreground/70 hover:text-foreground transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">New Arrivals</a>
            <a href="#" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">Women</a>
            <a href="#" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">Men</a>
            <a href="/storefront/collections" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">Collections</a>
          </nav>
        </div>
        
        {/* Center: Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          <div className="text-3xl md:text-4xl font-bold tracking-[0.25em] uppercase pointer-events-auto">
            VASTRAX
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-4 md:gap-6">
          <ThemeToggle />
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-foreground/5 border border-border/50 rounded-full transition-all text-sm w-48 lg:w-64 focus-within:border-[#e07a3f] focus-within:ring-1 focus-within:ring-[#e07a3f]">
            <Search className="w-4 h-4 text-foreground/50" />
            <input 
              type="text" 
              placeholder="Search" 
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-foreground/50"
            />
          </div>
          <button className="md:hidden text-foreground/70 hover:text-[#e07a3f] transition-colors">
            <Search className="w-5 h-5" />
          </button>

          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 text-foreground/70 hover:text-[#e07a3f] transition-colors"
            >
              {isLoggedIn ? (
                <>
                  <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xs font-bold uppercase">
                    {userName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium hidden md:block text-foreground">{userName}</span>
                </>
              ) : (
                <User className="w-5 h-5" />
              )}
            </button>
            
            {isUserMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsUserMenuOpen(false)} 
                />
                <div className="absolute right-0 mt-4 w-48 bg-background border border-border rounded-xl shadow-lg py-2 z-50 overflow-hidden">
                  {isLoggedIn ? (
                    <>
                      <Link 
                        href="/storefront/account"
                        className="block w-full text-left px-4 py-3 text-sm font-medium text-foreground hover:bg-surface transition-colors"
                      >
                        My Account
                      </Link>
                      <button 
                        onClick={() => { 
                          if (session) {
                            signOut();
                          } else {
                            setIsLoggedIn(false); 
                            setUserName(""); 
                          }
                          setIsUserMenuOpen(false); 
                        }}
                        className="w-full text-left px-4 py-3 text-sm font-medium text-red-500 hover:bg-surface transition-colors"
                      >
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => { setAuthMode("signin"); setIsAuthOpen(true); setIsUserMenuOpen(false); }}
                        className="w-full text-left px-4 py-3 text-sm font-medium text-foreground hover:bg-surface transition-colors"
                      >
                        Sign In
                      </button>
                      <button 
                        onClick={() => { setAuthMode("signup"); setIsAuthOpen(true); setIsUserMenuOpen(false); }}
                        className="w-full text-left px-4 py-3 text-sm font-medium text-foreground hover:bg-surface transition-colors"
                      >
                        Create Account
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <button 
            onClick={() => setIsCartOpen(true)}
            className="text-foreground/70 hover:text-[#e07a3f] transition-colors relative"
            aria-label="Open Shopping Bag"
          >
            <ShoppingBag className="w-5 h-5" />
            {bagItems.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#e07a3f] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {bagItems.length}
              </span>
            )}
          </button>
        </div>
      </header>
      
      {/* Main Content Area */}
      <div className="flex-1 bg-background px-4 md:px-8 pb-10 pt-4 transition-colors duration-300">
        <div className="max-w-[1200px] mx-auto">
          
          {/* Breadcrumb - On Main Background */}
          <div className="flex items-center gap-2 text-xs text-foreground/50 mb-6 font-medium px-2">
            <a href="#" className="hover:text-foreground transition-colors flex items-center gap-2"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg></a>
            <span className="text-foreground/30">&gt;</span>
            <a href="#" className="hover:text-foreground transition-colors">Shop</a>
            <span className="text-foreground/30">&gt;</span>
            <a href="#" className="hover:text-foreground transition-colors">Hats</a>
            <span className="text-foreground/30">&gt;</span>
            <span className="text-foreground font-bold">Teal Five-Panel Cap</span>
          </div>

          {/* Top Product Section - Inside White Card */}
          <main className="bg-surface rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-border/50 p-6 md:p-10 mb-12 transition-colors duration-300">
            <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">
              
              {/* Left: Image Gallery */}
              <div className="w-full lg:w-[55%]">
                <div className="bg-[#f5f5f5] rounded-[2.5rem] aspect-square relative flex items-center justify-center p-10 transition-colors duration-300">
                  <button 
                    onClick={(e) => toggleFavorite({ id: 999, name: "Teal Five-Panel Cap", price: 45, image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=800&auto=format&fit=crop" }, e)}
                    className="absolute top-6 left-6 w-12 h-12 rounded-full bg-white flex items-center justify-center text-black/60 hover:text-[#e07a3f] transition-colors z-10 shadow-md border border-black/5"
                  >
                    <Heart className={`w-5 h-5 ${favorites.includes(999) ? 'fill-[#e07a3f] text-[#e07a3f]' : ''}`} />
                  </button>
                  <img 
                    src="https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=800&auto=format&fit=crop" 
                    alt="Teal Five-Panel Cap" 
                    className="w-full h-full object-contain mix-blend-multiply opacity-90 drop-shadow-2xl"
                  />
                </div>
              </div>

              {/* Right: Product Info */}
              <div className="w-full lg:w-[45%] flex flex-col pt-2">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[#e07a3f] text-[10px] font-bold tracking-[0.2em] uppercase">Hats</span>
                  <div className="flex items-center gap-3 text-foreground/40">
                    <span className="text-[10px] mr-1">Share on</span>
                    <button className="w-7 h-7 rounded-full bg-foreground/5 flex items-center justify-center hover:bg-foreground/10 hover:text-foreground transition-colors">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
                    </button>
                    <button className="w-7 h-7 rounded-full bg-foreground/5 flex items-center justify-center hover:bg-foreground/10 hover:text-foreground transition-colors">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                    </button>
                    <button className="w-7 h-7 rounded-full bg-foreground/5 flex items-center justify-center hover:bg-foreground/10 hover:text-foreground transition-colors"><Phone className="w-3.5 h-3.5" /></button>
                    <button className="w-7 h-7 rounded-full bg-foreground/5 flex items-center justify-center hover:bg-foreground/10 hover:text-foreground transition-colors"><LinkIcon className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <h1 className="text-4xl lg:text-5xl font-bold mb-6 leading-[1.15] text-foreground">Teal Five-Panel<br/>Cap</h1>
                
                <p className="text-foreground/60 text-sm leading-relaxed mb-6 max-w-md">
                  Low-profile five-panel cap in deep teal cotton, with a flat brim and a woven adjuster strap.
                </p>

                <div className="flex items-center gap-2 mb-8">
                  <div className="flex text-[#e07a3f]">
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 stroke-[#e07a3f] fill-transparent opacity-50" />
                  </div>
                  <span className="text-xs text-foreground/50">(9 Reviews)</span>
                </div>

                <div className="w-full h-[1px] bg-border/50 mb-6" />

                <div className="mb-6">
                  <div className="text-4xl font-bold mb-1 text-foreground">$37.00</div>
                  <div className="text-[10px] text-foreground/40">Inclusive of all taxes</div>
                </div>

                <div className="w-full h-[1px] bg-border/50 mb-6" />

                {/* Color Selector */}
                <div className="mb-8">
                  <div className="text-sm font-bold mb-4 text-foreground">Choose a Color <span className="text-foreground/60 font-normal ml-1">{activeColor}</span></div>
                  <div className="flex items-center gap-3">
                    {colors.map(color => (
                      <button
                        key={color.name}
                        onClick={() => setActiveColor(color.name)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${activeColor === color.name ? 'ring-1 ring-[#e07a3f] ring-offset-4 ring-offset-surface' : 'hover:scale-110'}`}
                      >
                        <div className="w-full h-full rounded-full border border-black/20 dark:border-white/20" style={{ backgroundColor: color.value }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size Selector */}
                <div className="mb-8">
                  <div className="text-sm font-bold mb-4 text-foreground">Select Size</div>
                  <button className="px-6 py-2.5 rounded-full border border-[#e07a3f] text-[#e07a3f] text-sm font-medium hover:bg-[#e07a3f]/10 transition-colors">
                    One Size
                  </button>
                </div>

                <div className="w-full h-[1px] bg-border/50 mb-8" />

                {/* Quantity & Add to Cart */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 mb-8">
                  <div className="flex items-center bg-[#f5f5f5] dark:bg-[#1c1c1c] border border-border/50 rounded-full h-12 w-fit transition-colors duration-300">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-12 h-full flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-foreground">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-12 h-full flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs text-foreground/50 font-medium">In stock and ready to ship</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <a 
                    href="/storefront/checkout"
                    className="flex-1 bg-[#e07a3f] hover:bg-[#d06a2f] text-white h-[52px] rounded-full font-medium text-sm transition-colors shadow-lg shadow-[#e07a3f]/20 flex items-center justify-center"
                  >
                    Buy Now
                  </a>
                  <button 
                    onClick={() => {
                      addToCart();
                      setIsCartOpen(true);
                    }}
                    className="flex-1 bg-transparent border border-foreground/20 hover:border-foreground/50 hover:bg-foreground/5 text-foreground h-[52px] rounded-full font-medium text-sm transition-all flex items-center justify-center gap-2"
                  >
                    Add to Cart
                  </button>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px] text-[#e07a3f]/80">
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Free shipping on orders over $150</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Free 30-day returns</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Secure checkout, encrypted end to end</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Tabs Section - Inside Main Card */}
            <div className="mt-16 border-t border-border/50 pt-8">
              <div className="flex items-center gap-8 border-b border-border/50 mb-8 px-2">
              {['Description', 'Reviews'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-4 text-sm font-medium relative transition-colors ${activeTab === tab ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/70'}`}
                >
                  {tab} {tab === 'Reviews' && <span className="ml-1 bg-foreground/10 text-foreground/80 text-[10px] px-2 py-0.5 rounded-full">9</span>}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#e07a3f]" />
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'Description' && (
              <div className="px-2 max-w-4xl space-y-10 pb-8 text-foreground">
                
                <div>
                  <h3 className="text-lg font-bold mb-4">Product Description</h3>
                  <p className="text-foreground/60 text-sm">Low-profile five-panel cap in deep teal cotton, with a flat brim and a woven adjuster strap.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-4">Benefits</h3>
                  <ul className="space-y-3">
                    {[
                      "Reinforced seams and finished edges throughout.",
                      "Colour-fast dye that resists fading in the wash."
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-foreground/60">
                        <Check className="w-4 h-4 text-[#e07a3f] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-4">Product Details</h3>
                  <ul className="space-y-3">
                    {[
                      "Category: Hats",
                      "Reference: HAT-005",
                      "Approximate weight: 0.11 kg",
                      "Imported. Model is 186 cm and wears size M."
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-foreground/60">
                        <Check className="w-4 h-4 text-[#e07a3f] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-4">Care Instructions</h3>
                  <ul className="space-y-3">
                    {[
                      "Machine wash cold with like colours.",
                      "Tumble dry low or hang to dry.",
                      "Warm iron if needed, do not bleach."
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-foreground/60">
                        <Check className="w-4 h-4 text-[#e07a3f] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            )}
            </div>
          </main>

          {/* Related Products Grid - On Main Background */}
          <div className="mb-4 px-2">
            <h2 className="text-2xl font-bold mb-8 text-foreground">You May Also Like</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {relatedProducts.map((product) => (
                <div key={product.id} className="bg-surface dark:bg-[#f5f5f5] rounded-3xl p-5 group relative border border-border/50 hover:border-border transition-colors flex flex-col h-[300px]">
                  {/* Top icons */}
                  <div className="flex items-start justify-between z-10 relative mb-4 shrink-0">
                    <button 
                      onClick={(e) => toggleFavorite(product, e)}
                      className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black/60 hover:text-[#e07a3f] transition-colors shadow-sm"
                    >
                      <Heart className={`w-4 h-4 ${favorites.includes(product.id) ? 'fill-[#e07a3f] text-[#e07a3f]' : ''}`} />
                    </button>
                    <div className="bg-foreground/5 dark:bg-black/5 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                      <Star className="w-3 h-3 fill-[#e07a3f] text-[#e07a3f]" />
                      <span className="text-[10px] font-bold text-foreground dark:text-black">{product.rating}</span>
                    </div>
                  </div>
                  
                  {/* Image */}
                  <div className="relative w-full flex-1 mb-4 flex items-center justify-center overflow-hidden">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-contain mix-blend-multiply opacity-90 group-hover:scale-110 transition-transform duration-500 ease-out" 
                    />
                  </div>

                  {/* Bottom Info */}
                  <div className="flex items-end justify-between relative z-10 shrink-0">
                    <div className="flex-1 pr-4">
                      <h3 className="text-sm font-medium text-foreground/90 dark:text-black/90 mb-1.5 line-clamp-1">{product.name}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-foreground dark:text-black">${product.price}</span>
                        {product.originalPrice && <span className="text-xs text-foreground/40 dark:text-black/40 line-through">${product.originalPrice}</span>}
                      </div>
                    </div>
                    
                    {/* Interactive Add to Bag Button */}
                    <button 
                      onClick={() => toggleBag(product.id)}
                      className="w-11 h-11 rounded-full bg-foreground/5 flex items-center justify-center text-foreground relative overflow-hidden group/btn shrink-0 shadow-sm"
                    >
                      {/* Semi-circle hover effect */}
                      <div className={`absolute inset-x-0 bottom-0 bg-[#e07a3f] transition-all duration-300 ease-out ${bagItems.includes(product.id) ? 'h-full' : 'h-0 group-hover/btn:h-1/2 rounded-t-full'}`} />
                      
                      {/* Icon */}
                      <ShoppingBag className={`w-4 h-4 relative z-10 transition-colors duration-300 ${bagItems.includes(product.id) ? 'scale-110 text-white' : 'group-hover/btn:-translate-y-0.5 group-hover/btn:text-white'}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <StylistDrawer isOpen={isStylistOpen} onClose={() => setIsStylistOpen(false)} />
    </div>
  );
}
