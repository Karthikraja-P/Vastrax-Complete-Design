"use client";

import { useState, useRef, useEffect } from "react";
import { User, ShoppingBag, Search, Menu, ChevronRight, ChevronLeft, ArrowRight } from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { productsApi, categoriesApi } from "@/lib/api";

const defaultCategories = [
  { name: "T-Shirts", image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=300&auto=format&fit=crop" },
  { name: "Hoodies & Sweatshirts", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=300&auto=format&fit=crop" },
  { name: "Jackets & Outerwear", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=300&auto=format&fit=crop" },
  { name: "Pants & Trousers", image: "https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=300&auto=format&fit=crop" },
  { name: "Shirts", image: "https://images.unsplash.com/photo-1596755094514-f87e32f85e2c?q=80&w=300&auto=format&fit=crop" },
  { name: "Shoes & Sneakers", image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=300&auto=format&fit=crop" },
  { name: "Hats", image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=300&auto=format&fit=crop" },
];

export default function StorefrontHome() {
  const { data: session } = useSession();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  
  const [collections, setCollections] = useState<any[]>([]);
  const [categories, setCategories] = useState(defaultCategories);
  
  // Sync NextAuth session with local state for seamless transition
  useEffect(() => {
    if (session?.user?.name) {
      setIsLoggedIn(true);
      setUserName(session.user.name);
    }
  }, [session]);
  
  // Fetch real products and categories from unified API
  useEffect(() => {
    async function fetchData() {
      try {
        const data = await productsApi.list();
        const mapped = data.map((p: any, idx: number) => ({
          id: String(idx + 1).padStart(2, '0'),
          dbId: p.id,
          title: p.name || p.title,
          image: p.image || p.images?.[0]?.s3_url || (typeof p.images?.[0] === 'string' ? p.images[0] : "") || "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop"
        }));
        setCollections(mapped);
      } catch (err) {
        console.error("Failed to fetch featured products:", err);
      }
    }
    fetchData();
  }, []);
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeCollection, setActiveCollection] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const handleOpenStylist = () => setIsStylistOpen(true);
    window.addEventListener("open-stylist", handleOpenStylist);
    return () => window.removeEventListener("open-stylist", handleOpenStylist);
  }, []);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener("resize", handleScroll);
    return () => window.removeEventListener("resize", handleScroll);
  }, []);

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 350, behavior: "smooth" });
    }
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -350, behavior: "smooth" });
    }
  };

  const getCollectionHeight = (idx: number) => {
    const diff = Math.abs(idx - activeCollection);
    if (diff === 0) return "100%";
    if (diff === 1) return "90%";
    if (diff === 2) return "80%";
    if (diff === 3) return "70%";
    return "65%";
  };

  return (
    <div className="min-h-screen bg-surface text-foreground font-sans flex flex-col">
      {/* Storefront Header */}
      <header className="h-20 flex items-center justify-between relative px-6 md:px-12 sticky top-2 md:top-4 bg-background z-40 rounded-[2rem] shadow-sm border border-border/50 mx-2 md:mx-4 mt-2 md:mt-4">
        {/* Left Side: Navigation */}
        <div className="flex items-center gap-6">
          <button className="md:hidden text-muted-foreground hover:text-foreground transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-lg font-medium hover:text-accent transition-colors">New Arrivals</a>
            <a href="#" className="text-lg font-medium hover:text-accent transition-colors">Women</a>
            <a href="#" className="text-lg font-medium hover:text-accent transition-colors">Men</a>
            <a href="/storefront/collections" className="text-lg font-medium hover:text-accent transition-colors">Collections</a>
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
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-full transition-all text-sm w-48 lg:w-64 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search" 
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <button className="md:hidden text-muted-foreground hover:text-accent transition-colors">
            <Search className="w-5 h-5" />
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors"
            >
              {isLoggedIn ? (
                <>
                  <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xs font-bold uppercase">
                    {userName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium hidden md:block">{userName}</span>
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
            className="text-muted-foreground hover:text-accent transition-colors relative"
            aria-label="Open Shopping Bag"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-accent-foreground text-[10px] font-bold rounded-full flex items-center justify-center">2</span>
          </button>
        </div>
      </header>

      {/* Hero Section Wrapper with Gap */}
      <div className="flex-1 bg-surface px-2 pb-2 md:px-4 md:pb-4 pt-4">
        <main className="relative h-full min-h-[calc(100vh-120px)] rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-background shadow-sm border border-border/50">
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=2000&auto=format&fit=crop" 
              alt="Hero Fashion" 
              className="w-full h-full object-cover opacity-90 dark:opacity-60 transition-opacity duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent dark:from-background dark:via-background/90" />
          </div>
          
          <div className="relative z-10 h-full flex items-center px-6 md:px-12 max-w-7xl mx-auto py-20">
            <div className="max-w-xl text-foreground">
              <h1 className="text-6xl md:text-8xl font-light tracking-tight leading-[1.05] mb-6">
                Elevate <br /> your Style
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground font-light mb-10 max-w-lg">
                "In the language of beauty, every detail tells a tale."
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="/storefront/product" className="inline-block px-10 py-4 bg-accent text-accent-foreground text-lg hover:bg-accent-hover rounded-full font-semibold transition-colors duration-300">
                  Shop Now &rarr;
                </a>
                <button className="px-10 py-4 bg-transparent border border-border text-foreground text-lg hover:bg-surface hover:border-foreground rounded-full font-semibold transition-colors duration-300">
                  New Arrivals
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Categories Section */}
        <section className="py-20 w-full mt-4 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-background shadow-sm border border-border/50">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4 max-w-7xl mx-auto px-6 md:px-12">
            <div>
              <p className="text-accent text-xs font-bold tracking-[0.2em] uppercase mb-2">Find Your Style</p>
              <h2 className="text-4xl md:text-5xl font-light text-foreground">
                Shop by <span className="font-semibold">Category</span>
              </h2>
            </div>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-accent transition-colors flex items-center gap-1">
              View All &rarr;
            </a>
          </div>
          
          <div className="relative group/slider mt-4 max-w-7xl mx-auto px-6 md:px-12">
            {canScrollLeft && (
              <button 
                onClick={scrollLeft}
                className="absolute -left-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-background border border-border shadow-lg rounded-full hidden md:flex items-center justify-center text-foreground hover:text-accent hover:border-accent transition-all opacity-0 group-hover/slider:opacity-100"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-6 h-6 mr-1" />
              </button>
            )}

            <div 
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex gap-4 md:gap-8 overflow-x-auto pb-6 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {categories.map((cat, idx) => (
                <a key={idx} href="/storefront/collections" className="flex-shrink-0 w-52 md:w-[280px] snap-start group">
                  <div className="bg-background rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-sm border border-border/30 h-72 md:h-[360px] flex flex-col items-center justify-between transition-transform duration-300 group-hover:-translate-y-2 group-hover:shadow-md">
                    <div className="flex-1 w-full relative flex items-center justify-center overflow-hidden rounded-xl mb-4 md:mb-6">
                      <img 
                        src={cat.image} 
                        alt={cat.name} 
                        className="w-full h-full object-cover dark:opacity-90"
                      />
                    </div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground text-center">{cat.name}</h3>
                  </div>
                </a>
              ))}
            </div>

            {canScrollRight && (
              <button 
                onClick={scrollRight}
                className="absolute -right-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-background border border-border shadow-lg rounded-full hidden md:flex items-center justify-center text-foreground hover:text-accent hover:border-accent transition-all opacity-0 group-hover/slider:opacity-100"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-6 h-6 ml-1" />
              </button>
            )}
          </div>
        </section>

        {/* Shop by Collection Section */}
        <section className="py-20 w-full relative mt-4 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-background shadow-sm border border-border/50">
          <div className="max-w-7xl mx-auto mb-10 px-6 md:px-12">
            <p className="text-accent text-xs font-bold tracking-[0.2em] uppercase mb-2">Curated Looks</p>
            <h2 className="text-4xl md:text-5xl font-light text-foreground">
              Shop by <span className="font-semibold">Collection</span>
            </h2>
          </div>

          <div className="relative group/colSlider max-w-7xl mx-auto px-6 md:px-12">
            <div 
              ref={scrollRef} // Reusing the same ref or we can just scroll the target directly
              className="h-[400px] md:h-[500px] flex items-center justify-start gap-2 md:gap-4 w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-4"
            >
              {collections.map((col, idx) => {
                const isActive = activeCollection === idx;
                
                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setActiveCollection(idx)}
                  onClick={() => setActiveCollection(idx)}
                  className={`relative overflow-hidden bg-[#1f1f1f] rounded-2xl md:rounded-[2rem] cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] flex items-end shrink-0
                    ${isActive ? 'w-[280px] md:w-[450px] lg:w-[550px]' : 'w-20 md:w-28 lg:w-36'}
                  `}
                  style={{ height: getCollectionHeight(idx) }}
                >
                  <img
                    src={col.image}
                    alt={col.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105 opacity-90"
                  />
                  
                  {/* Inactive Vertical Text */}
                  <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isActive ? 'opacity-0' : 'opacity-100 delay-200'}`}>
                    <span className="text-white/80 text-xs md:text-sm tracking-[0.3em] -rotate-90 whitespace-nowrap font-medium">{col.id}</span>
                  </div>

                  {/* Active Content */}
                  <div className={`relative z-10 w-full p-6 md:p-10 flex items-end justify-between transition-opacity duration-500 delay-100 ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <div className="min-w-0 pr-4">
                      <p className="text-white/70 text-[10px] md:text-xs font-bold tracking-[0.2em] mb-2">{col.id} / 06</p>
                      <h3 className="text-white text-lg md:text-3xl font-light tracking-widest truncate drop-shadow-md">
                        {col.title}
                      </h3>
                    </div>
                    <a href={`/storefront/product?id=${col.dbId || col.id}`} className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/40 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all shrink-0">
                      <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                    </a>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Scroll Right Arrow */}
            <button 
              onClick={(e) => {
                const container = e.currentTarget.previousElementSibling;
                if (container) {
                  container.scrollBy({ left: 350, behavior: "smooth" });
                }
              }}
              className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-background border border-border shadow-lg rounded-full hidden md:flex items-center justify-center text-foreground hover:text-accent hover:border-accent transition-all opacity-0 group-hover/colSlider:opacity-100"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-6 h-6 ml-1" />
            </button>
          </div>
        </section>
      </div>

      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        initialMode={authMode} 
        onSuccess={(name) => {
          setIsLoggedIn(true);
          setUserName(name);
        }}
      />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <StylistDrawer isOpen={isStylistOpen} onClose={() => setIsStylistOpen(false)} />
    </div>
  );
}
