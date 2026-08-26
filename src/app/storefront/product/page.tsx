"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  ChevronRight, Heart, Star, Share2, Ruler, Truck, ShieldCheck, 
  Minus, Plus, ChevronLeft, ArrowRight, Menu, Search, User, ShoppingBag,
  Phone, Link as LinkIcon, RefreshCw, Check, Sparkles, Shirt, Box
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/auth/AuthModal";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import { GarmentViewer3D } from "@/components/3d/GarmentViewer3D";
import { Product3DModal } from "@/components/3d/Product3DModal";

import { productsApi } from "@/lib/api";

const colors = [
  { name: 'Black', value: '#1a1a1a' },
  { name: 'Brown', value: '#4a3b32' },
  { name: 'Navy', value: '#1d2b45' },
  { name: 'Teal', value: '#244c5a' },
];

function ProductContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get("id") || searchParams.get("product_id");

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);
  const [bagItems, setBagItems] = useState<any[]>([]);
  const [activeColor, setActiveColor] = useState('Black');
  const [activeSize, setActiveSize] = useState('M');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('Description');
  const [favorites, setFavorites] = useState<string[]>([]);
  
  const { data: session } = useSession();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const [is3DMode, setIs3DMode] = useState(false);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);

  // Dynamic Product State
  const [product, setProduct] = useState<{
    id: string;
    name: string;
    categoryName: string;
    price: number;
    originalPrice?: number;
    description: string;
    fabric: string;
    colour: string;
    image: string;
    images: string[];
    rating: number;
    reviewsCount: number;
    model3dUrl?: string;
  }>({
    id: "vtx-default",
    name: "Cyber Silk Trench Coat",
    categoryName: "Jackets & Outerwear",
    price: 4999,
    originalPrice: 5999,
    description: "High-end luxury trench coat tailored with precision silk blend fabric.",
    fabric: "Silk Blend",
    colour: "Onyx Black",
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800&auto=format&fit=crop",
    images: ["https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800&auto=format&fit=crop"],
    rating: 4.9,
    reviewsCount: 12,
    model3dUrl: "/models/3d/garment2_textured.glb"
  });

  const getFallbackImage = (name: string, catName: string) => {
    const p = (name + " " + catName).toLowerCase();
    if (/frock|dress/i.test(p)) return "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=800&auto=format&fit=crop";
    if (/jacket|coat|outerwear|puffer|trench/i.test(p)) return "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800&auto=format&fit=crop";
    if (/hoodie|sweatshirt/i.test(p)) return "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800&auto=format&fit=crop";
    if (/pant|trouser|cargo|denim|jean/i.test(p)) return "https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=800&auto=format&fit=crop";
    if (/shirt/i.test(p)) return "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=800&auto=format&fit=crop";
    if (/shoe|sneaker|loafer/i.test(p)) return "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=800&auto=format&fit=crop";
    return "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800&auto=format&fit=crop";
  };

  const get3DModelForProduct = (name: string, catName: string) => {
    const p = (name + " " + catName).toLowerCase();
    if (/frock|dress/i.test(p)) return "/models/3d/garment3_multiview.glb";
    if (/limitless|graphic|white/i.test(p)) return "/models/3d/garment2_textured.glb";
    if (/pant|trouser/i.test(p)) return "/models/3d/garment_photo_textured.glb";
    return "/models/3d/garment2_textured.glb";
  };

  useEffect(() => {
    async function loadProduct() {
      try {
        if (productId) {
          const item: any = await productsApi.getById(productId);
          if (item) {
            const catName = item.category?.name || item.category || "Apparel";
            const img = item.image || item.images?.[0]?.s3_url || (typeof item.images?.[0] === 'string' ? item.images[0] : "") || getFallbackImage(item.name || item.title || "", catName);
            const allImgs = item.images?.length 
              ? item.images.map((i: any) => typeof i === 'string' ? i : i.s3_url || img) 
              : [img];
            const modelUrl = item.model3dUrl || get3DModelForProduct(item.name || item.title || "", catName);

            setProduct({
              id: String(item.id),
              name: item.name || item.title || "Luxury Item",
              categoryName: catName,
              price: Number(item.price_selling || item.price || 0),
              originalPrice: item.price_mrp || item.originalPrice ? Number(item.price_mrp || item.originalPrice) : undefined,
              description: item.description || "Crafted with premium materials and designed for supreme comfort and modern elegance.",
              fabric: item.fabric || "Premium Cotton Blend",
              colour: item.colour || "Default",
              image: img,
              images: allImgs,
              rating: item.rating || 4.8,
              reviewsCount: item.reviewsCount || 9,
              model3dUrl: modelUrl
            });
            if (item.colour) setActiveColor(item.colour);
            if (item.name?.toLowerCase().includes("3d") || item.name?.toLowerCase().includes("limitless")) {
              setIs3DMode(true);
            }
            return;
          }
        }

        const allItems = await productsApi.list();
        if (allItems.length > 0) {
          const item: any = allItems[0];
          const catName = item.category?.name || item.category || "Jackets & Outerwear";
          const img = item.image || item.images?.[0]?.s3_url || (typeof item.images?.[0] === 'string' ? item.images[0] : "") || getFallbackImage(item.name || item.title || "", catName);
          const allImgs = item.images?.length 
            ? item.images.map((i: any) => typeof i === 'string' ? i : i.s3_url || img) 
            : [img];
          const modelUrl = item.model3dUrl || get3DModelForProduct(item.name || item.title || "", catName);

          setProduct({
            id: String(item.id),
            name: item.name || item.title || "Cyber Silk Trench Coat",
            categoryName: catName,
            price: Number(item.price_selling || item.price || 0),
            originalPrice: item.price_mrp || item.originalPrice ? Number(item.price_mrp || item.originalPrice) : undefined,
            description: item.description || "Crafted with premium materials and designed for supreme comfort and modern elegance.",
            fabric: item.fabric || "Silk Blend",
            colour: item.colour || "Onyx Black",
            image: img,
            images: allImgs,
            rating: item.rating || 4.9,
            reviewsCount: item.reviewsCount || 14,
            model3dUrl: modelUrl
          });
          if (item.colour) setActiveColor(item.colour);
        }
      } catch (err) {
        console.error("Failed to load product details:", err);
      }
    }
    loadProduct();
  }, [productId]);

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

  const toggleFavorite = (p: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const savedStr = localStorage.getItem("vastrax_favorites");
    let currentFavs = savedStr ? JSON.parse(savedStr) : [];
    
    if (currentFavs.some((f: any) => f.id === p.id)) {
      currentFavs = currentFavs.filter((f: any) => f.id !== p.id);
      setFavorites(prev => prev.filter(id => id !== p.id));
    } else {
      currentFavs.push({
        id: p.id,
        name: p.name,
        price: `₹${p.price || 0}`,
        image: p.image
      });
      setFavorites(prev => [...prev, p.id]);
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
    
    const existingIndex = currentCart.findIndex((i: any) => i.id === product.id && i.size === activeSize);
    if (existingIndex >= 0) {
      currentCart[existingIndex].quantity += quantity;
    } else {
      currentCart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        size: activeSize,
        color: activeColor,
        image: product.image
      });
    }
    
    localStorage.setItem("vastrax_cart", JSON.stringify(currentCart));
    setBagItems(currentCart);
  };

  const handleOpenTryOn = () => {
    if (!isLoggedIn && !session?.user) {
      setAuthMode("signin");
      setIsAuthOpen(true);
      return;
    }
    router.push(`/storefront/product/${product.id}/tryon`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="h-20 flex items-center justify-between relative px-6 md:px-12 sticky top-2 md:top-4 bg-surface z-50 rounded-[2rem] shadow-md border border-border/50 mx-2 md:mx-4 mt-2 md:mt-4 transition-colors duration-300">
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
        
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          <Link href="/storefront/home" className="text-3xl md:text-4xl font-bold tracking-[0.25em] uppercase pointer-events-auto">
            VASTRAX
          </Link>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <ThemeToggle />
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
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 bg-background px-4 md:px-8 pb-10 pt-4 transition-colors duration-300">
        <div className="max-w-[1200px] mx-auto">
          
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-foreground/50 mb-6 font-medium px-2">
            <Link href="/storefront/home" className="hover:text-foreground transition-colors flex items-center gap-2">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            </Link>
            <span className="text-foreground/30">&gt;</span>
            <Link href="/storefront/collections" className="hover:text-foreground transition-colors">Collections</Link>
            <span className="text-foreground/30">&gt;</span>
            <span className="hover:text-foreground transition-colors">{product.categoryName}</span>
            <span className="text-foreground/30">&gt;</span>
            <span className="text-foreground font-bold truncate max-w-xs">{product.name}</span>
          </div>

          {/* Top Product Section */}
          <main className="bg-surface rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-border/50 p-6 md:p-10 mb-12 transition-colors duration-300">
            <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">
              
              {/* Left: Image Gallery & 3D Interactive Viewer */}
              <div className="w-full lg:w-[55%]">
                <div className="bg-[#f5f5f5] dark:bg-[#1a1a1a] rounded-[2.5rem] aspect-square relative flex items-center justify-center p-4 sm:p-8 transition-colors duration-300 overflow-hidden">
                  {/* Top Left: Wishlist */}
                  <button 
                    onClick={(e) => toggleFavorite(product, e)}
                    className="absolute top-6 left-6 w-12 h-12 rounded-full bg-white dark:bg-[#2a2a2a] flex items-center justify-center text-black/60 dark:text-white hover:text-[#e07a3f] transition-colors z-30 shadow-md border border-black/5 dark:border-white/10"
                  >
                    <Heart className={`w-5 h-5 ${favorites.includes(product.id) ? 'fill-[#e07a3f] text-[#e07a3f]' : ''}`} />
                  </button>

                  {/* Top Right: 2D Photo / 3D Interactive Mode Toggle */}
                  <div className="absolute top-6 right-6 z-30 flex items-center bg-black/60 dark:bg-white/10 backdrop-blur-xl border border-white/10 rounded-full p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => setIs3DMode(false)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${!is3DMode ? 'bg-white text-black shadow' : 'text-white/70 hover:text-white'}`}
                    >
                      Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => setIs3DMode(true)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${is3DMode ? 'bg-[#38bdf8] text-black shadow' : 'text-white/70 hover:text-white'}`}
                    >
                      <Box className="w-3.5 h-3.5" />
                      <span>3D Mesh</span>
                    </button>
                  </div>

                  {/* Bottom Action Badges */}
                  <div className="absolute bottom-6 left-6 right-6 z-30 flex items-center justify-between pointer-events-none">
                    <button 
                      onClick={() => setIs3DModalOpen(true)}
                      className="pointer-events-auto px-4 py-2.5 rounded-full bg-black/70 hover:bg-black text-white text-xs font-semibold backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-xl hover:scale-105 transition-all cursor-pointer"
                    >
                      <Box className="w-3.5 h-3.5 text-[#38bdf8]" />
                      <span>Expand 3D</span>
                    </button>

                    <button 
                      onClick={handleOpenTryOn}
                      className="pointer-events-auto px-4 py-2.5 rounded-full bg-[#0A192F]/90 hover:bg-[#0A192F] text-white text-xs font-semibold backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-xl hover:scale-105 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#e07a3f]" />
                      <span>Virtual Try-On</span>
                    </button>
                  </div>

                  {/* Main Display: 3D Garment Viewer vs 2D Photo */}
                  {is3DMode ? (
                    <div className="w-full h-full">
                      <GarmentViewer3D
                        src={product.model3dUrl || "/models/3d/garment2_textured.glb"}
                        alt={product.name}
                        poster={product.image}
                        badgeTitle="Hunyuan3D-2.1 PBR"
                        className="w-full h-full"
                      />
                    </div>
                  ) : (
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover rounded-2xl drop-shadow-2xl animate-fade-in"
                    />
                  )}
                </div>
              </div>

              {/* Right: Product Info */}
              <div className="w-full lg:w-[45%] flex flex-col pt-2">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[#e07a3f] text-[10px] font-bold tracking-[0.2em] uppercase">{product.categoryName}</span>
                </div>

                <h1 className="text-3xl lg:text-4xl font-bold mb-4 leading-[1.15] text-foreground">{product.name}</h1>
                
                <p className="text-foreground/70 text-sm leading-relaxed mb-6 max-w-md">
                  {product.description}
                </p>

                <div className="flex items-center gap-2 mb-6">
                  <div className="flex text-[#e07a3f]">
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                  <span className="text-xs text-foreground/50">({product.reviewsCount} Reviews)</span>
                </div>

                <div className="w-full h-[1px] bg-border/50 mb-6" />

                <div className="mb-6">
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-bold text-foreground">₹{product.price.toLocaleString()}</span>
                    {product.originalPrice && (
                      <span className="text-lg text-muted-foreground line-through">₹{product.originalPrice.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-foreground/40 mt-1">Inclusive of all taxes • Fabric: {product.fabric}</div>
                </div>

                <div className="w-full h-[1px] bg-border/50 mb-6" />

                {/* Size Selector */}
                <div className="mb-8">
                  <div className="text-sm font-bold mb-3 text-foreground">Select Size</div>
                  <div className="flex items-center gap-2">
                    {["S", "M", "L", "XL", "XXL"].map((sz) => (
                      <button
                        key={sz}
                        onClick={() => setActiveSize(sz)}
                        className={`w-11 h-11 rounded-full border text-sm font-medium transition-all ${activeSize === sz ? 'border-[#e07a3f] bg-[#e07a3f] text-white shadow-md' : 'border-border hover:border-foreground/40'}`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

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

                <div className="space-y-3 mb-8">
                  <button 
                    onClick={handleOpenTryOn}
                    className="w-full bg-[#0A192F] hover:bg-[#112240] text-white border border-[#D4AF37]/50 h-[52px] rounded-full font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/10 group cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-[#D4AF37] group-hover:rotate-12 transition-transform" />
                    <span>Virtual Try-On (AI Fitting Room)</span>
                    {!isLoggedIn && (
                      <span className="text-[10px] bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ml-1">
                        Sign In
                      </span>
                    )}
                  </button>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <a 
                      href="/storefront/checkout"
                      onClick={() => addToCart()}
                      className="flex-1 bg-[#e07a3f] hover:bg-[#d06a2f] text-white h-[52px] rounded-full font-medium text-sm transition-colors shadow-lg shadow-[#e07a3f]/20 flex items-center justify-center cursor-pointer"
                    >
                      Buy Now
                    </a>
                    <button 
                      onClick={() => {
                        addToCart();
                        setIsCartOpen(true);
                      }}
                      className="flex-1 bg-transparent border border-foreground/20 hover:border-foreground/50 hover:bg-foreground/5 text-foreground h-[52px] rounded-full font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px] text-[#e07a3f]/80">
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Free shipping on all premium orders</span>
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

            {/* Tabs Section */}
            <div className="mt-16 border-t border-border/50 pt-8">
              <div className="flex items-center gap-8 border-b border-border/50 mb-8 px-2">
                {['Description', 'Specifications', 'Reviews'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 text-sm font-medium relative transition-colors ${activeTab === tab ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/70'}`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#e07a3f]" />
                    )}
                  </button>
                ))}
              </div>

              {activeTab === 'Description' && (
                <div className="px-2 max-w-4xl space-y-4 pb-8 text-foreground">
                  <h3 className="text-lg font-bold">Product Details</h3>
                  <p className="text-foreground/70 text-sm leading-relaxed">{product.description}</p>
                </div>
              )}

              {activeTab === 'Specifications' && (
                <div className="px-2 max-w-4xl space-y-3 pb-8 text-sm">
                  <div className="grid grid-cols-2 max-w-md gap-2">
                    <span className="text-muted-foreground">Fabric:</span>
                    <span className="font-semibold">{product.fabric}</span>
                    <span className="text-muted-foreground">Colour:</span>
                    <span className="font-semibold">{product.colour}</span>
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-semibold">{product.categoryName}</span>
                  </div>
                </div>
              )}
            </div>
          </main>

        </div>
      </div>

      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        initialMode={authMode}
        onSuccess={(name) => {
          setIsLoggedIn(true);
          setUserName(name);
          setIsAuthOpen(false);
          router.push(`/storefront/product/${product.id}/tryon`);
        }}
      />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <StylistDrawer isOpen={isStylistOpen} onClose={() => setIsStylistOpen(false)} />
      <Product3DModal 
        isOpen={is3DModalOpen} 
        onClose={() => setIs3DModalOpen(false)} 
        product={{
          id: product.id,
          name: product.name,
          category: product.categoryName,
          price: product.price,
          image: product.image,
          model3dUrl: product.model3dUrl || "/models/3d/garment2_textured.glb"
        }}
        onAddToBag={addToCart}
      />
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading luxury garment...</div>}>
      <ProductContent />
    </Suspense>
  );
}
