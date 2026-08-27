"use client";

import { useState, useEffect } from "react";
import { Search, Heart, Star, ShoppingBag, Menu, User, Box } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/auth/AuthModal";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import { Product3DModal } from "@/components/3d/Product3DModal";
import { productsApi } from "@/lib/api";
import { useFavorites } from "@/hooks/useFavorites";

export default function FavoritesPage() {
  const { data: session } = useSession();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);
  const [bagItems, setBagItems] = useState<number[]>([]);

  const [selectedProductForSize, setSelectedProductForSize] = useState<any | null>(null);
  const [selected3DProduct, setSelected3DProduct] = useState<any | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const data = await productsApi.list();
        const mapped = (data || []).map((p: any) => {
          const fallbackImg = "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop";
          let img = p.image || p.images?.[0]?.s3_url || (typeof p.images?.[0] === 'string' ? p.images[0] : "");
          if (!img || img === "") {
            const pTitle = p.name || p.title || "";
            if (/frock|dress|gown/i.test(pTitle)) img = "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=400&auto=format&fit=crop";
            else img = fallbackImg;
          }

          return {
            id: p.id,
            name: p.name || p.title,
            price: Number(p.price || p.price_selling || 0),
            originalPrice: p.originalPrice || p.price_mrp || p.compareAtPrice ? Number(p.originalPrice || p.price_mrp || p.compareAtPrice) : undefined,
            rating: p.rating || 4.8,
            image: img,
            isNew: p.isNew || p.is_featured,
            categoryId: p.categoryId || p.category_id,
            categoryName: p.category?.name || p.category || "Apparel",
            model3dUrl: p.model3dUrl || (/frock|dress|gown/i.test(p.name || "") ? "/models/3d/garment3_multiview.glb" : /pant|trouser/i.test(p.name || "") ? "/models/3d/garment_photo_textured.glb" : "/models/3d/garment2_textured.glb")
          };
        });
        setProducts(mapped);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (session?.user?.name) {
      setIsLoggedIn(true);
      setUserName(session.user.name);
    }
  }, [session]);

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

  const favoriteProducts = products.filter(p => isFavorite(p.id || p.name));

  return (
    <div className="min-h-screen bg-surface dark:bg-[#111111] text-foreground dark:text-white font-sans flex flex-col">
      {/* Header */}
      <header className="h-20 flex items-center justify-between relative px-6 md:px-12 sticky top-2 md:top-4 bg-surface dark:bg-[#1a1a1a] z-50 rounded-[2rem] shadow-md border border-border dark:border-white/10 mx-2 md:mx-4 mt-2 md:mt-4">
        <div className="flex items-center gap-6">
          <button className="md:hidden text-muted-foreground hover:text-foreground dark:text-white transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">New Arrivals</a>
            <a href="#" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">Women</a>
            <a href="#" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">Men</a>
            <a href="/storefront/collections" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">Collections</a>
          </nav>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          <Link href="/storefront/home" className="text-3xl md:text-4xl font-bold tracking-[0.25em] uppercase pointer-events-auto">
            VASTRAX
          </Link>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <ThemeToggle />
          <Link href="/storefront/favorites" className="relative text-[#e07a3f] transition-colors">
            <Heart className="w-5 h-5 fill-[#e07a3f]" />
          </Link>
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
                  <div className="w-7 h-7 rounded-full bg-[#e07a3f]/20 border border-[#e07a3f]/40 flex items-center justify-center text-[#e07a3f] text-xs font-bold uppercase">
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
                <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                <div className="absolute right-0 mt-4 w-48 bg-background border border-border rounded-xl shadow-lg py-2 z-50 overflow-hidden">
                  {isLoggedIn ? (
                    <>
                      <Link href="/storefront/account" className="block w-full text-left px-4 py-3 text-sm font-medium text-foreground hover:bg-surface transition-colors">
                        My Account
                      </Link>
                      <button
                        onClick={() => {
                          if (session) signOut();
                          else { setIsLoggedIn(false); setUserName(""); }
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
            onClick={() => setIsStylistOpen(true)}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-[#e07a3f]/10 text-[#e07a3f] border border-[#e07a3f]/30 hover:bg-[#e07a3f] hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
          >
            AI Stylist
          </button>

          <button
            onClick={() => setIsCartOpen(true)}
            className="w-10 h-10 rounded-full bg-surface dark:bg-[#2a2a2a] flex items-center justify-center text-foreground dark:text-white hover:text-[#e07a3f] transition-colors relative"
          >
            <ShoppingBag className="w-5 h-5" />
            {bagItems.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#e07a3f] text-[9px] font-bold text-white flex items-center justify-center">
                {bagItems.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col pt-12 md:pt-20 px-4 md:px-8 max-w-[1400px] w-full mx-auto mb-20">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">Your Favorites</h1>
            <p className="text-muted-foreground text-lg">
              {favoriteProducts.length} {favoriteProducts.length === 1 ? 'item' : 'items'} saved
            </p>
          </div>
        </div>

        {loading ? (
          <div className="w-full h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e07a3f]"></div>
          </div>
        ) : favoriteProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 rounded-full bg-[#e07a3f]/10 flex items-center justify-center mb-6">
              <Heart className="w-10 h-10 text-[#e07a3f]" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Your wishlist is empty</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              Tap the heart icon on any product to save it here for later.
            </p>
            <Link
              href="/storefront/collections"
              className="px-8 py-3 bg-[#e07a3f] text-white rounded-full font-semibold hover:bg-[#d06a2f] transition-colors"
            >
              Browse Collections
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {favoriteProducts.map((product) => (
              <div key={product.id} className="group relative flex flex-col h-full">
                <div className="relative w-full aspect-[3/4] mb-4 flex items-center justify-center overflow-hidden cursor-pointer rounded-2xl bg-black/5 dark:bg-white/5">
                  <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(product.id || product.name);
                      }}
                      className="w-8 h-8 rounded-full bg-background dark:bg-[#2a2a2a] flex items-center justify-center text-[#e07a3f] hover:text-red-500 transition-colors shadow-sm"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelected3DProduct(product); }}
                      title="Interactive 3D Preview"
                      className="w-8 h-8 rounded-full bg-background dark:bg-[#2a2a2a] flex items-center justify-center text-muted-foreground hover:text-[#38bdf8] transition-colors shadow-sm cursor-pointer group/3d"
                    >
                      <Box className="w-4 h-4 text-[#38bdf8] group-hover/3d:scale-110 transition-transform" />
                    </button>
                  </div>

                  <Link href={`/storefront/product?id=${product.id}`} className="w-full h-full">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  </Link>
                </div>

                <div className="flex items-end justify-between relative z-10 shrink-0">
                  <div className="flex-1 pr-4">
                    <Link href={`/storefront/product?id=${product.id}`} className="hover:text-[#e07a3f] transition-colors">
                      <h3 className="text-sm font-medium text-foreground/90 mb-1.5 line-clamp-1">{product.name}</h3>
                    </Link>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold">₹{product.price.toLocaleString()}</span>
                      {product.originalPrice && <span className="text-xs text-muted-foreground line-through">₹{product.originalPrice.toLocaleString()}</span>}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleAddToBagClick(product, e)}
                    className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer ${bagItems.includes(product.id)
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                        : 'bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 shadow-black/10'
                      }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
      />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <StylistDrawer isOpen={isStylistOpen} onClose={() => setIsStylistOpen(false)} />

      {selected3DProduct && (
        <Product3DModal
          isOpen={!!selected3DProduct}
          onClose={() => setSelected3DProduct(null)}
          modelUrl={selected3DProduct.model3dUrl}
          productName={selected3DProduct.name}
          posterImage={selected3DProduct.image}
        />
      )}

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
