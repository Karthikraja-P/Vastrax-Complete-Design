"use client";

import { useState, useEffect } from "react";
import { Search, Heart, Star, ShoppingBag, Menu, User, ChevronRight, SlidersHorizontal } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/auth/AuthModal";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";

// --- Mock Data ---

const banners = [
  {
    title: "Coats for the season ahead",
    subtitle: "COLD WEATHER",
    desc: "Wool overcoats and layers built for real winters.",
    image: "https://images.unsplash.com/photo-1539533018408-ea9fac8f14d0?q=80&w=1200&auto=format&fit=crop",
    cta: "Shop outerwear"
  },
  {
    title: "The Denim Collection",
    subtitle: "NEW ARRIVALS",
    desc: "Premium selvage denim crafted to last a lifetime.",
    image: "https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=1200&auto=format&fit=crop",
    cta: "Shop Denim"
  },
  {
    title: "Essential Basics",
    subtitle: "EVERYDAY WEAR",
    desc: "Elevate your daily uniform with premium cotton basics.",
    image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=1200&auto=format&fit=crop",
    cta: "Shop Basics"
  }
];

const categories = [
  { name: "All Categories", count: 120, icon: "❖" },
  { name: "T-Shirts", count: 45, icon: "👕" },
  { name: "Hoodies & Sweatshirts", count: 32, icon: "🧥" },
  { name: "Jackets & Outerwear", count: 18, icon: "🧥" },
  { name: "Pants & Trousers", count: 24, icon: "👖" },
  { name: "Shirts", count: 15, icon: "👔" },
  { name: "Shoes & Sneakers", count: 28, icon: "👟" },
  { name: "Hats", count: 12, icon: "🧢" },
];

const products = [
  { id: 1, name: "Navy Cotton Canvas Cap", price: 37, rating: 4.8, image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=400&auto=format&fit=crop" },
  { id: 2, name: "Camel Wool Ivy Cap", price: 48, originalPrice: 60, rating: 4.5, image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop", isNew: true },
  { id: 3, name: "Mustard Bucket Hat", price: 39, rating: 4.9, image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=400&auto=format&fit=crop" }
];

export default function CollectionsPage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  
  const [favorites, setFavorites] = useState<number[]>([]);
  const [selectedProductForSize, setSelectedProductForSize] = useState<any | null>(null);

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
        price: `$${product.price}.00`,
        image: product.image
      });
      setFavorites(prev => [...prev, product.id]);
    }
    localStorage.setItem("vastrax_favorites", JSON.stringify(currentFavs));
  };
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [bagItems, setBagItems] = useState<number[]>([]);
  
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState("Recommended");
  const sortOptions = ["Recommended", "Newest Arrivals", "Price: Low to High", "Price: High to Low", "Top Rated"];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOpenStylist = () => setIsStylistOpen(true);
    window.addEventListener("open-stylist", handleOpenStylist);
    return () => window.removeEventListener("open-stylist", handleOpenStylist);
  }, []);

  const toggleBag = (id: number) => {
    setBagItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleAddToBagClick = (product: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (bagItems.includes(product.id)) {
      toggleBag(product.id);
      return;
    }
    
    const isOneSize = /cap|hat|beanie/i.test(product.name);
    
    if (!isOneSize) {
      setSelectedProductForSize(product);
    } else {
      toggleBag(product.id);
    }
  };

  return (
    <div className="min-h-screen bg-surface dark:bg-[#111111] text-foreground dark:text-white font-sans flex flex-col">
      {/* Reused Header Style */}
      <header className="h-20 flex items-center justify-between relative px-6 md:px-12 sticky top-2 md:top-4 bg-surface dark:bg-[#1a1a1a] z-50 rounded-[2rem] shadow-md border border-border dark:border-white/10 mx-2 md:mx-4 mt-2 md:mt-4">
        {/* Left Side: Navigation */}
        <div className="flex items-center gap-6">
          <button className="md:hidden text-muted-foreground hover:text-foreground dark:text-white transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">New Arrivals</a>
            <a href="#" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">Women</a>
            <a href="#" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">Men</a>
            <a href="/storefront/collections" className="text-lg font-medium text-[#e07a3f] transition-colors">Collections</a>
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
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-surface dark:bg-[#222] border border-border dark:border-white/10 rounded-full transition-all text-sm w-48 lg:w-64 focus-within:border-[#e07a3f] focus-within:ring-1 focus-within:ring-[#e07a3f]">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search" 
              className="flex-1 bg-transparent border-none outline-none text-foreground dark:text-white placeholder:text-muted-foreground"
            />
          </div>
          <button className="md:hidden text-muted-foreground hover:text-[#e07a3f] transition-colors">
            <Search className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 text-muted-foreground hover:text-[#e07a3f] transition-colors"
            >
              {isLoggedIn ? (
                <>
                  <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xs font-bold uppercase">
                    {userName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium hidden md:block text-foreground dark:text-white">{userName}</span>
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
            className="text-muted-foreground hover:text-[#e07a3f] transition-colors relative"
            aria-label="Open Shopping Bag"
          >
            <ShoppingBag className="w-5 h-5" />
            {bagItems.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#e07a3f] text-foreground dark:text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {bagItems.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 bg-surface dark:bg-[#111111] px-2 md:px-4 pb-2 md:pb-4 pt-4">
        <main className="relative h-full min-h-[calc(100vh-120px)] rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-background dark:bg-[#161616] shadow-sm border border-border/50 dark:border-white/5 pb-20">
          
          <div className="max-w-[1400px] mx-auto p-4 md:p-10">
            
            {/* 1. Hero Banner Slider */}
            <div className="relative w-full h-[250px] md:h-[350px] lg:h-[400px] rounded-[2rem] overflow-hidden mb-8 md:mb-12 border border-border dark:border-white/10">
              {banners.map((banner, idx) => (
                <div 
                  key={idx}
                  className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === activeBanner ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                >
                  <img src={banner.image} alt={banner.title} className="w-full h-full object-cover mix-blend-screen opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#111] via-[#111]/80 to-transparent flex flex-col justify-center px-8 md:px-16 lg:px-20">
                    <p className="text-[#e07a3f] text-xs font-bold tracking-[0.2em] uppercase mb-2 md:mb-4">{banner.subtitle}</p>
                    <h2 className="text-3xl md:text-5xl lg:text-6xl font-semibold text-foreground dark:text-white mb-3 md:mb-4 max-w-xl leading-tight">{banner.title}</h2>
                    <p className="text-muted-foreground text-sm md:text-lg mb-6 md:mb-8 max-w-md hidden md:block">{banner.desc}</p>
                    <button className="bg-[#e07a3f] hover:bg-[#d06a2f] text-white px-6 md:px-8 py-2.5 md:py-3 rounded-full text-sm md:text-base font-medium w-fit transition-colors shadow-lg shadow-[#e07a3f]/20">
                      {banner.cta}
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Banner Indicators */}
              <div className="absolute bottom-6 right-6 md:right-10 flex gap-2 z-20 bg-surface dark:bg-[#111111]/80 backdrop-blur-sm px-3 py-2 rounded-full border border-border dark:border-white/10">
                {banners.map((_, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setActiveBanner(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeBanner ? 'w-8 bg-[#e07a3f]' : 'w-4 bg-white/30 hover:bg-white/50'}`}
                  />
                ))}
              </div>
            </div>

            {/* Layout Grid: Sidebar + Products */}
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
              
              {/* Mobile Filter Toggle */}
              <div className="lg:hidden flex items-center justify-between">
                <h1 className="text-2xl font-bold">Best Sellers <span className="text-sm font-normal text-muted-foreground ml-2">24 products</span></h1>
                <button 
                  onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                  className="bg-surface dark:bg-[#1a1a1a] border border-border/50 dark:border-white/5 text-sm px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-white/5 transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4" /> Filters
                </button>
              </div>

              {/* 2. Sidebar Filters */}
              <aside className={`w-full lg:w-72 shrink-0 ${isMobileFiltersOpen ? 'block' : 'hidden lg:block'}`}>
                <div className="bg-surface dark:bg-[#1a1a1a] rounded-[2rem] p-6 border border-border/50 dark:border-white/5 sticky top-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg">Filters</h3>
                    <button className="text-[#e07a3f] text-xs font-bold tracking-wider uppercase flex items-center gap-1 hover:underline">
                      Reset Filters
                    </button>
                  </div>
                  
                  {/* Search */}
                  <div className="relative mb-8">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder="Search products..." 
                      className="w-full bg-surface dark:bg-[#111111] border border-border dark:border-white/10 rounded-full py-3 pl-11 pr-4 text-sm text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#e07a3f] transition-colors"
                    />
                  </div>

                  {/* Category */}
                  <div className="mb-8">
                    <h4 className="text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase mb-4">Category</h4>
                    <div className="space-y-1">
                      {categories.map((cat, idx) => (
                        <label key={idx} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${idx === 0 ? 'bg-[#e07a3f]/10 text-[#e07a3f]' : 'hover:bg-white/5 text-muted-foreground'}`}>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${idx === 0 ? 'border-[#e07a3f] bg-[#e07a3f]' : 'border-border dark:border-white/20'}`}>
                            {idx === 0 && <div className="w-1.5 h-1.5 bg-surface dark:bg-[#1a1a1a] rounded-full" />}
                          </div>
                          <span className="text-lg w-6 text-center shrink-0">{cat.icon}</span>
                          <span className="text-sm font-medium flex-1 truncate">{cat.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Price Range */}
                  <div className="mb-8">
                    <h4 className="text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase mb-4">Price Range</h4>
                    {/* Fake dual slider visual */}
                    <div className="px-2 mb-6 mt-2">
                      <div className="h-1 bg-white/10 rounded-full relative">
                        <div className="absolute left-1/4 right-1/4 h-full bg-[#e07a3f] rounded-full" />
                        <div className="absolute left-1/4 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-[#e07a3f] rounded-full ring-4 ring-[#1a1a1a] cursor-pointer hover:scale-125 transition-transform" />
                        <div className="absolute right-1/4 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 bg-[#e07a3f] rounded-full ring-4 ring-[#1a1a1a] cursor-pointer hover:scale-125 transition-transform" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-surface dark:bg-[#111111] border border-border dark:border-white/10 rounded-xl px-3 py-2 flex items-center justify-between focus-within:border-[#e07a3f] transition-colors">
                        <span className="text-muted-foreground text-sm font-medium">$</span>
                        <input type="text" defaultValue="30" className="w-full bg-transparent text-foreground dark:text-white text-sm text-right outline-none font-medium" />
                      </div>
                      <span className="text-muted-foreground">-</span>
                      <div className="flex-1 bg-surface dark:bg-[#111111] border border-border dark:border-white/10 rounded-xl px-3 py-2 flex items-center justify-between focus-within:border-[#e07a3f] transition-colors">
                        <span className="text-muted-foreground text-sm font-medium">$</span>
                        <input type="text" defaultValue="150" className="w-full bg-transparent text-foreground dark:text-white text-sm text-right outline-none font-medium" />
                      </div>
                    </div>
                  </div>

                </div>
              </aside>

              {/* 3. Product Grid Area */}
              <div className="flex-1">
                <div className="hidden lg:flex items-end justify-between mb-8">
                  <div>
                    <h1 className="text-3xl font-bold">Best Sellers <span className="text-sm font-normal text-muted-foreground ml-2">24 products</span></h1>
                  </div>
                  <div className="relative">
                    <button 
                      onClick={() => setIsSortOpen(!isSortOpen)}
                      className="bg-surface dark:bg-[#1a1a1a] border border-border/50 dark:border-white/5 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-white/10 transition-colors min-w-[200px] justify-between"
                    >
                      <span className="text-muted-foreground">Sort by: <span className="text-foreground dark:text-white font-medium">{sortBy}</span></span>
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isSortOpen ? '-rotate-90' : 'rotate-90'}`} />
                    </button>
                    
                    {isSortOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsSortOpen(false)} />
                        <div className="absolute right-0 top-full mt-2 w-full min-w-[200px] bg-surface dark:bg-[#1a1a1a] border border-border/50 dark:border-white/5 rounded-xl shadow-xl overflow-hidden z-20 py-1">
                          {sortOptions.map(option => (
                            <button
                              key={option}
                              onClick={() => {
                                setSortBy(option);
                                setIsSortOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${sortBy === option ? 'text-[#e07a3f] font-medium' : 'text-muted-foreground hover:text-foreground dark:text-white'}`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                  {products.map((product) => (
                    <div key={product.id} className="bg-surface dark:bg-[#1c1c1c] rounded-3xl p-5 group relative border border-border/50 dark:border-white/5 hover:border-border dark:border-white/10 transition-colors flex flex-col h-[340px]">
                      {/* Top icons */}
                      <div className="flex items-start justify-between z-10 relative mb-4 shrink-0">
                        <button 
                          onClick={(e) => toggleFavorite(product, e)}
                          className="w-8 h-8 rounded-full bg-background dark:bg-[#2a2a2a] flex items-center justify-center text-muted-foreground hover:text-[#e07a3f] transition-colors"
                        >
                          <Heart className={`w-4 h-4 ${favorites.includes(product.id) ? 'fill-[#e07a3f] text-[#e07a3f]' : ''}`} />
                        </button>
                        <div className="bg-background dark:bg-[#2a2a2a] px-2.5 py-1 rounded-full flex items-center gap-1.5">
                          <Star className="w-3 h-3 fill-[#e07a3f] text-[#e07a3f]" />
                          <span className="text-[10px] font-bold text-foreground dark:text-white">{product.rating}</span>
                        </div>
                      </div>
                      
                      {/* Image */}
                      <a href="/storefront/product" className="relative w-full flex-1 mb-4 flex items-center justify-center overflow-hidden cursor-pointer">
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-full h-full object-contain mix-blend-screen opacity-90 group-hover:scale-110 transition-transform duration-500 ease-out" 
                        />
                      </a>

                      {/* Bottom Info */}
                      <div className="flex items-end justify-between relative z-10 shrink-0">
                        <div className="flex-1 pr-4">
                          <a href="/storefront/product" className="hover:text-[#e07a3f] transition-colors">
                            <h3 className="text-sm font-medium text-foreground/90 mb-1.5 line-clamp-1">{product.name}</h3>
                          </a>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg font-bold">${product.price}</span>
                            {product.originalPrice && <span className="text-xs text-muted-foreground line-through">${product.originalPrice}</span>}
                            {product.isSale && <span className="text-[9px] bg-[#e07a3f]/20 text-[#e07a3f] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">SALE</span>}
                            {product.isNew && <span className="text-[9px] bg-white/10 text-foreground dark:text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">NEW</span>}
                          </div>
                        </div>
                        
                        {/* Interactive Add to Bag Button */}
                        <button 
                          onClick={(e) => handleAddToBagClick(product, e)}
                          className="w-11 h-11 rounded-full bg-background dark:bg-[#2a2a2a] flex items-center justify-center text-foreground dark:text-white relative overflow-hidden group/btn shrink-0 shadow-sm"
                        >
                          {/* Semi-circle hover effect */}
                          <div className={`absolute inset-x-0 bottom-0 bg-[#e07a3f] transition-all duration-300 ease-out ${bagItems.includes(product.id) ? 'h-full' : 'h-0 group-hover/btn:h-1/2 rounded-t-full'}`} />
                          
                          {/* Icon */}
                          <ShoppingBag className={`w-4 h-4 relative z-10 transition-transform duration-300 ${bagItems.includes(product.id) ? 'scale-110' : 'group-hover/btn:-translate-y-0.5'}`} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination */}
                <div className="flex items-center justify-center gap-2 mt-12">
                  <button className="px-5 py-2.5 rounded-xl bg-surface dark:bg-[#1a1a1a] border border-border/50 dark:border-white/5 text-sm font-medium text-muted-foreground hover:text-foreground dark:text-white hover:bg-white/5 transition-colors">Previous</button>
                  <button className="w-10 h-10 rounded-full bg-[#e07a3f] text-white text-sm font-bold flex items-center justify-center">1</button>
                  <button className="w-10 h-10 rounded-full hover:bg-white/5 text-muted-foreground hover:text-foreground dark:text-white text-sm font-medium flex items-center justify-center transition-colors">2</button>
                  <button className="w-10 h-10 rounded-full hover:bg-white/5 text-muted-foreground hover:text-foreground dark:text-white text-sm font-medium flex items-center justify-center transition-colors">3</button>
                  <button className="px-5 py-2.5 rounded-xl bg-surface dark:bg-[#1a1a1a] border border-border/50 dark:border-white/5 text-sm font-medium text-muted-foreground hover:text-foreground dark:text-white hover:bg-white/5 transition-colors">Next</button>
                </div>

              </div>
            </div>
          </div>
        </main>
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <StylistDrawer isOpen={isStylistOpen} onClose={() => setIsStylistOpen(false)} />

      {/* Size Selection Modal */}
      {selectedProductForSize && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedProductForSize(null)}>
          <div className="bg-surface border border-border/50 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2 text-foreground">Select Size</h3>
            <p className="text-sm text-muted-foreground mb-6 line-clamp-1">Choose a size for {selectedProductForSize.name}</p>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {['S', 'M', 'L', 'XL'].map(size => (
                <button
                  key={size}
                  onClick={() => {
                    toggleBag(selectedProductForSize.id);
                    setSelectedProductForSize(null);
                  }}
                  className="py-2.5 border border-border/50 rounded-xl text-foreground font-medium hover:bg-accent hover:text-white hover:border-accent transition-colors"
                >
                  {size}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectedProductForSize(null)}
              className="w-full py-3 bg-background hover:bg-surface-hover text-foreground font-medium rounded-xl transition-colors border border-border/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
