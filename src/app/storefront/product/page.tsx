"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  ChevronRight, Heart, Star, Share2, Ruler, Truck, ShieldCheck, 
  Minus, Plus, ChevronLeft, ArrowRight, Menu, Search, User, ShoppingBag,
  Phone, Link as LinkIcon, RefreshCw, Check, Sparkles, Shirt, Box,
  Bell, AlertCircle
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/auth/AuthModal";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import { GarmentViewer3D } from "@/components/3d/GarmentViewer3D";
import { Product3DModal } from "@/components/3d/Product3DModal";

import { productsApi, ProductReview } from "@/lib/api";
import { addToCart as addCartItem, getCart } from "@/lib/cart";
import { showToast } from "@/lib/toast";

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
  const [pendingAction, setPendingAction] = useState<'tryon' | 'cart' | 'favorites' | 'buynow' | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);
  const [bagItems, setBagItems] = useState<any[]>([]);
  const [activeColor, setActiveColor] = useState('Black');
  const [activeSize, setActiveSize] = useState('M');
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
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
    ratingCount?: number;
    reviewsCount: number;
    model3dUrl?: string;
    model_path?: string;
    stock?: number;
    size_chart?: any;
    variants?: any[];
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

  const [sizeChartUnit, setSizeChartUnit] = useState<"in" | "cm">("in");

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
    const syncCart = () => {
      setBagItems(getCart());
    };
    syncCart();
    window.addEventListener("cart-updated", syncCart);
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("cart-updated", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  // Auto-open auth modal when redirected from try-on without login
  useEffect(() => {
    if (searchParams.get("requireAuth") === "1" && !session) {
      setAuthMode('signin');
      setIsAuthOpen(true);
    }
  }, [searchParams, session]);

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
            const modelUrl = item.model_path || item.model3dUrl || get3DModelForProduct(item.name || item.title || "", catName);

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
              model3dUrl: modelUrl,
              stock: item.stock ?? item.inventoryCount ?? 10,
              size_chart: item.size_chart,
              variants: item.variants || []
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
          const modelUrl = item.model_path || item.model3dUrl || get3DModelForProduct(item.name || item.title || "", catName);

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
            rating: Number(item.rating_average || item.rating || 4.9),
            ratingCount: Number(item.rating_count || item.reviewsCount || 14),
            reviewsCount: Number(item.rating_count || item.reviewsCount || 14),
            model3dUrl: modelUrl,
            model_path: item.model_path,
            stock: item.stock ?? item.inventoryCount ?? 10,
            size_chart: item.size_chart,
            variants: item.variants || []
          });
          if (item.colour) setActiveColor(item.colour);
        }
      } catch (err) {
        console.error("Failed to load product details:", err);
      }
    }
    loadProduct();
  }, [productId]);

  const [reviewsList, setReviewsList] = useState<ProductReview[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const loadReviews = async () => {
    if (!productId) return;
    const revs = await productsApi.getReviews(productId);
    setReviewsList(revs);
  };

  useEffect(() => {
    loadReviews();
  }, [productId]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      setAuthMode("signin");
      setIsAuthOpen(true);
      return;
    }
    if (isSubmittingReview) return;
    setIsSubmittingReview(true);
    try {
      await productsApi.createReview(product.id, { rating: newRating, comment: newComment });
      showToast({
        title: "Review Submitted",
        description: "Thank you for your rating! Your review is now live.",
        type: "gold",
      });
      setNewComment("");
      
      // Refresh product details & reviews list to update dynamic rating average
      const [item, revs] = await Promise.all([
        productsApi.getById(product.id),
        productsApi.getReviews(product.id)
      ]);
      if (item) {
        setProduct((prev) => ({
          ...prev,
          rating: Number(item.rating_average || item.rating || prev.rating),
          ratingCount: Number(item.rating_count || revs.length),
          reviewsCount: Number(item.rating_count || revs.length),
        }));
      }
      setReviewsList(revs);
    } catch (err: any) {
      showToast({
        title: "Submission Failed",
        description: err?.message || "Could not submit review. Please try again.",
        type: "error",
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (session?.user?.name) {
      setIsLoggedIn(true);
      setUserName(session.user.name);
    }
    if (session?.user?.email && !notifyEmail) {
      setNotifyEmail(session.user.email);
    }
  }, [session]);

  const [notifyEmail, setNotifyEmail] = useState("");
  const [isSubscribingNotify, setIsSubscribingNotify] = useState(false);
  const [isNotifySuccess, setIsNotifySuccess] = useState(false);

  // Derive stock for current active size
  const activeVariant = product.variants?.find(
    (v: any) => v.size?.toUpperCase() === activeSize.toUpperCase()
  );
  const currentStock = activeVariant !== undefined
    ? Number(activeVariant.stock_qty ?? 0)
    : (product.stock ?? 10);
  const isOutOfStock = currentStock <= 0;

  const handleSubscribeNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyEmail || !notifyEmail.includes("@")) {
      showToast({
        title: "Invalid Email",
        description: "Please enter a valid email to receive restock notifications.",
        type: "error",
        duration: 3000,
      });
      return;
    }
    setIsSubscribingNotify(true);
    try {
      await productsApi.subscribeStockNotification(product.id, notifyEmail, activeSize);
      setIsNotifySuccess(true);
      showToast({
        title: "Waitlist Confirmed",
        description: `We will email ${notifyEmail} the moment size ${activeSize} is back in stock!`,
        type: "gold",
        duration: 5000,
      });
    } catch (err: any) {
      console.error("Failed to subscribe for restock:", err);
      showToast({
        title: "Subscription Failed",
        description: err?.message || "Could not register for notifications. Please try again.",
        type: "error",
        duration: 4000,
      });
    } finally {
      setIsSubscribingNotify(false);
    }
  };

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

    if (!session) {
      setPendingAction('favorites');
      setAuthMode('signin');
      setIsAuthOpen(true);
      return;
    }
    
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

  const addToCart = (openDrawer = true) => {
    if (!session) {
      setPendingAction(openDrawer ? 'cart' : 'buynow');
      setAuthMode('signin');
      setIsAuthOpen(true);
      return;
    }

    if (isOutOfStock) {
      showToast({
        title: "Out of Stock",
        description: `${product.name} (Size: ${activeSize}) is currently unavailable. Register below for instant restock alerts.`,
        type: "error",
        duration: 4000,
      });
      return;
    }

    const priceNum = typeof product.price === 'string' 
      ? parseFloat(String(product.price).replace(/[^0-9.-]+/g, "")) || 0
      : Number(product.price) || 0;

    const updated = addCartItem({
      id: product.id,
      name: product.name,
      price: priceNum,
      quantity: quantity,
      size: activeSize,
      color: activeColor,
      image: product.image
    });

    setBagItems(updated);

    showToast({
      title: "Added to Shopping Bag",
      description: `${product.name} (Size: ${activeSize}, Qty: ${quantity})`,
      type: "gold",
      image: product.image,
      duration: 3000
    });

    if (openDrawer) {
      setIsCartOpen(true);
    }
  };

  const handleOpenTryOn = () => {
    if (!session) {
      setPendingAction('tryon');
      setAuthMode('signin');
      setIsAuthOpen(true);
      return;
    }
    router.push(`/storefront/product/${product.id}/tryon`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="h-16 md:h-20 flex items-center justify-between relative px-3 sm:px-6 md:px-12 sticky top-2 md:top-4 bg-surface z-50 rounded-[1.5rem] sm:rounded-[2rem] shadow-md border border-border/50 mx-2 md:mx-4 mt-2 md:mt-4 transition-colors duration-300">
        <div className="flex items-center gap-2 sm:gap-6 z-10">
          <button className="md:hidden text-foreground/70 hover:text-foreground transition-colors p-1">
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/storefront/collections?sort=newest" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">New Arrivals</Link>
            <Link href="/storefront/collections?gender=Women" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">Women</Link>
            <Link href="/storefront/collections?gender=Men" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">Men</Link>
            <Link href="/storefront/collections?gender=Kids" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">Kids</Link>
            <Link href="/storefront/collections" className="text-lg font-medium hover:text-[#e07a3f] transition-colors">Collections</Link>
          </nav>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-0">
          <Link href="/storefront/home" className="text-base sm:text-2xl md:text-4xl font-bold tracking-[0.12em] sm:tracking-[0.25em] uppercase pointer-events-auto hover:text-[#e07a3f] transition-colors">
            VASTRAX
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-4 md:gap-6 z-10">
          <ThemeToggle />
          <Link href="/storefront/favorites" className="relative p-1 text-foreground/70 hover:text-[#e07a3f] transition-colors">
            <Heart className="w-5 h-5" />
          </Link>
          <button 
            onClick={() => setIsStylistOpen(true)}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-[#e07a3f]/10 text-[#e07a3f] border border-[#e07a3f]/30 hover:bg-[#e07a3f] hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
          >
            AI Stylist
          </button>

          <button 
            onClick={() => setIsCartOpen(true)}
            aria-label="Open Shopping Bag"
            className="w-10 h-10 rounded-full bg-surface dark:bg-[#2a2a2a] flex items-center justify-center text-foreground dark:text-white hover:text-[#e07a3f] transition-colors relative"
          >
            <ShoppingBag className="w-5 h-5" />
            {bagItems.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#e07a3f] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-sm animate-in zoom-in">
                {bagItems.reduce((acc, i) => acc + (i.quantity || 1), 0)}
              </span>
            )}
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
                        poster={product.images?.[activeImageIndex] || product.image}
                        badgeTitle="Hunyuan3D-2.1 PBR"
                        className="w-full h-full"
                      />
                    </div>
                  ) : (
                    <img 
                      src={product.images?.[activeImageIndex] || product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover rounded-2xl drop-shadow-2xl animate-fade-in"
                    />
                  )}
                </div>

                {/* Thumbnails Carousel */}
                <div className="mt-4 flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {(product.images || [product.image]).map((img: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveImageIndex(idx);
                        setIs3DMode(false);
                      }}
                      className={`relative flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden border-2 transition-all ${
                        !is3DMode && activeImageIndex === idx ? 'border-[#e07a3f] shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  
                  {/* 3D Model Thumbnail */}
                  {(product.model3dUrl || product.model_path) && (
                    <button
                      onClick={() => setIs3DMode(true)}
                      className={`relative flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden border-2 transition-all flex flex-col items-center justify-center bg-surface-hover ${
                        is3DMode ? 'border-[#38bdf8] shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <Box className="w-6 h-6 text-[#38bdf8] mb-1" />
                      <span className="text-[9px] font-semibold text-foreground/70">3D VIEW</span>
                    </button>
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
                  <span className="text-xs font-bold text-foreground">{product.rating} / 5.0</span>
                  <span className="text-xs text-foreground/50">({product.ratingCount || product.reviewsCount} Reviews)</span>
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
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-foreground">Select Size</div>
                    <button 
                      type="button"
                      onClick={() => {
                        setActiveTab('Size Chart');
                        setTimeout(() => {
                          document.getElementById('size-chart-section')?.scrollIntoView({ behavior: 'smooth' });
                        }, 50);
                      }} 
                      className="text-xs font-semibold text-[#e07a3f] hover:underline flex items-center gap-1.5 cursor-pointer bg-[#e07a3f]/10 px-3 py-1 rounded-full border border-[#e07a3f]/20 transition-all hover:bg-[#e07a3f]/20"
                    >
                      <Ruler className="w-3.5 h-3.5" />
                      <span>Not sure about fit? Look into Size Chart</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {["S", "M", "L", "XL", "XXL"].map((sz) => {
                      const szVar = product.variants?.find(
                        (v: any) => v.size?.toUpperCase() === sz.toUpperCase()
                      );
                      const szOos = szVar !== undefined && Number(szVar.stock_qty ?? 0) <= 0;
                      return (
                        <button
                          key={sz}
                          onClick={() => {
                            setActiveSize(sz);
                            setIsNotifySuccess(false);
                          }}
                          className={`relative w-11 h-11 rounded-full border text-sm font-medium transition-all cursor-pointer ${
                            activeSize === sz
                              ? 'border-[#e07a3f] bg-[#e07a3f] text-white shadow-md'
                              : szOos
                              ? 'border-border/40 text-foreground/40 hover:border-foreground/30'
                              : 'border-border hover:border-foreground/40'
                          }`}
                        >
                          {sz}
                          {szOos && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-background" title="Out of stock" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quantity or Out of Stock Badge */}
                {isOutOfStock ? (
                  <div className="flex items-center gap-2.5 mb-8">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Sold Out — Size {activeSize}
                    </span>
                    <span className="text-xs text-foreground/50">Restock notification available below</span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 mb-8">
                    <div className="flex items-center bg-[#f5f5f5] dark:bg-[#1c1c1c] border border-border/50 rounded-full h-12 w-fit transition-colors duration-300">
                      <button 
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-12 h-full flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-foreground">{quantity}</span>
                      <button 
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-12 h-full flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-xs text-foreground/50 font-medium">In stock and ready to ship</span>
                  </div>
                )}

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

                  {isOutOfStock ? (
                    /* Notify Later / Waitlist Panel */
                    <div className="p-5 rounded-2xl bg-[#0A192F]/5 dark:bg-card/50 border border-[#D4AF37]/40 backdrop-blur-sm space-y-3">
                      <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                        <Bell className="w-4 h-4 text-[#D4AF37]" />
                        <span>Notify Me When Available</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        This garment in Size {activeSize} is currently out of stock. Leave your email to receive an instant priority notification when restocked.
                      </p>
                      {isNotifySuccess ? (
                        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>You&apos;re on the waitlist! We will email you the moment size {activeSize} arrives.</span>
                        </div>
                      ) : (
                        <form onSubmit={handleSubscribeNotify} className="flex flex-col sm:flex-row gap-2 pt-1">
                          <input
                            type="email"
                            required
                            placeholder="Enter your email"
                            value={notifyEmail}
                            onChange={(e) => setNotifyEmail(e.target.value)}
                            className="flex-1 bg-background border border-border/80 focus:border-[#D4AF37] text-foreground text-xs rounded-full px-4 h-11 outline-none transition-colors"
                          />
                          <button
                            type="submit"
                            disabled={isSubscribingNotify}
                            className="bg-[#D4AF37] hover:bg-[#c49f2f] text-black font-semibold text-xs h-11 px-6 rounded-full transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 cursor-pointer shadow-md shadow-[#D4AF37]/20"
                          >
                            {isSubscribingNotify ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Bell className="w-3.5 h-3.5" />
                            )}
                            <span>{isSubscribingNotify ? "Joining..." : "Notify Me"}</span>
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button 
                        onClick={() => {
                          if (!session) { setAuthMode('signin'); setIsAuthOpen(true); return; }
                          addToCart(false);
                          router.push("/storefront/checkout");
                        }}
                        className="flex-1 bg-[#e07a3f] hover:bg-[#d06a2f] text-white h-[52px] rounded-full font-medium text-sm transition-colors shadow-lg shadow-[#e07a3f]/20 flex items-center justify-center cursor-pointer"
                      >
                        Buy Now
                      </button>
                      <button 
                        onClick={() => addToCart(true)}
                        className="flex-1 bg-transparent border border-foreground/20 hover:border-foreground/50 hover:bg-foreground/5 text-foreground h-[52px] rounded-full font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Add to Cart
                      </button>
                    </div>
                  )}
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
              <div className="flex items-center gap-8 border-b border-border/50 mb-8 px-2 overflow-x-auto">
                {['Description', 'Size Chart', 'Specifications', 'Reviews'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 text-sm font-medium relative transition-colors shrink-0 ${activeTab === tab ? 'text-foreground font-bold' : 'text-foreground/40 hover:text-foreground/70'}`}
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

              {activeTab === 'Size Chart' && (
                <div id="size-chart-section" className="px-2 max-w-4xl space-y-6 pb-8 text-foreground animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
                    <div>
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Ruler className="w-5 h-5 text-[#e07a3f]" />
                        <span>Garment Size Chart & Measurement Guide</span>
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Displaying measurements in {sizeChartUnit === 'in' ? 'Inches (in)' : 'Centimeters (cm)'}. Match with your body measurements for optimum comfort.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-surface border border-border p-1 rounded-full">
                      <button
                        type="button"
                        onClick={() => setSizeChartUnit('in')}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${sizeChartUnit === 'in' ? 'bg-[#e07a3f] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Inches (in)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSizeChartUnit('cm')}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${sizeChartUnit === 'cm' ? 'bg-[#e07a3f] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        CM (cm)
                      </button>
                    </div>
                  </div>

                  {/* Size Chart Table */}
                  <div className="overflow-x-auto border border-border rounded-2xl bg-surface/50 p-4 shadow-sm">
                    {(() => {
                      const activeSizeChart = product.size_chart || {
                        unit: "in",
                        headers: ["Size", "Chest (in)", "Waist (in)", "Hips (in)", "Length (in)"],
                        rows: [
                          { size: "XS", chest: "32 - 34", waist: "25 - 26", hips: "35 - 36", length: "38" },
                          { size: "S", chest: "34 - 36", waist: "27 - 28", hips: "37 - 38", length: "39" },
                          { size: "M", chest: "36 - 38", waist: "29 - 30", hips: "39 - 40", length: "40" },
                          { size: "L", chest: "39 - 41", waist: "31 - 33", hips: "41 - 43", length: "41" },
                          { size: "XL", chest: "42 - 44", waist: "34 - 36", hips: "44 - 46", length: "42" },
                          { size: "XXL", chest: "45 - 47", waist: "37 - 39", hips: "47 - 49", length: "43" }
                        ]
                      };
                      return (
                        <table className="w-full text-sm text-left border-collapse">
                          <thead>
                            <tr className="border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              {activeSizeChart.headers?.map((h: string, idx: number) => (
                                <th key={idx} className="py-3 px-4">{sizeChartUnit === 'cm' ? h.replace('(in)', '(cm)') : h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {activeSizeChart.rows?.map((row: any, rIdx: number) => (
                              <tr key={rIdx} className={`hover:bg-[#e07a3f]/5 transition-colors ${activeSize === row.size ? 'bg-[#e07a3f]/15 font-bold' : ''}`}>
                                <td className="py-3 px-4 text-[#e07a3f] font-bold">{row.size}</td>
                                {Object.keys(row).filter(k => k !== 'size').map((k, cIdx) => {
                                  let val = row[k];
                                  if (sizeChartUnit === 'cm' && typeof val === 'string' && val.includes('-')) {
                                    const parts = val.split('-').map(p => Math.round(parseFloat(p.trim()) * 2.54));
                                    val = `${parts[0]} - ${parts[1]}`;
                                  } else if (sizeChartUnit === 'cm' && !isNaN(parseFloat(val))) {
                                    val = `${Math.round(parseFloat(val) * 2.54)}`;
                                  }
                                  return (
                                    <td key={cIdx} className="py-3 px-4 text-foreground/90">{val}</td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>

                  {/* Measurement Instructions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
                      <h4 className="text-xs font-bold text-[#e07a3f] uppercase tracking-wider">1. Bust / Chest</h4>
                      <p className="text-xs text-muted-foreground">Measure under arms around the fullest part of your chest line.</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
                      <h4 className="text-xs font-bold text-[#e07a3f] uppercase tracking-wider">2. Waist</h4>
                      <p className="text-xs text-muted-foreground">Measure around your natural waistline, keeping tape comfortably snug.</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
                      <h4 className="text-xs font-bold text-[#e07a3f] uppercase tracking-wider">3. Hips</h4>
                      <p className="text-xs text-muted-foreground">Stand with feet together and measure around the fullest hip curve.</p>
                    </div>
                  </div>
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

              {activeTab === 'Reviews' && (
                <div className="px-2 max-w-4xl space-y-8 pb-12">
                  {/* Rating Summary Header */}
                  <div className="bg-surface border border-border/50 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="text-center bg-background/50 border border-border/50 rounded-xl px-6 py-4">
                        <span className="text-4xl font-extrabold text-foreground">{product.rating}</span>
                        <div className="flex text-[#e07a3f] justify-center mt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3.5 h-3.5 ${star <= Math.round(product.rating) ? 'fill-current text-[#e07a3f]' : 'text-muted-foreground/30'}`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 block">out of 5.0</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Customer Reviews & Ratings</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Calculated dynamically from {reviewsList.length || product.reviewsCount} verified customer ratings
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Write a Review Form */}
                  <form onSubmit={handleReviewSubmit} className="bg-surface border border-border/50 rounded-2xl p-6 space-y-4 shadow-sm">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">Write a Customer Review</h4>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-medium">Your Rating:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewRating(star)}
                            className="p-1 focus:outline-none hover:scale-110 transition-transform"
                          >
                            <Star className={`w-5 h-5 ${star <= newRating ? 'fill-[#e07a3f] text-[#e07a3f]' : 'text-muted-foreground/40'}`} />
                          </button>
                        ))}
                      </div>
                      <span className="text-xs font-bold text-[#e07a3f] ml-1">{newRating} Stars</span>
                    </div>

                    <textarea
                      rows={3}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Share your experience with this luxury garment (fit, fabric quality, styling)..."
                      className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#e07a3f] transition-colors resize-none"
                    />

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="px-5 py-2.5 rounded-full bg-[#e07a3f] hover:bg-[#c86830] text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md"
                      >
                        {isSubmittingReview ? "Publishing Review..." : "Submit Review"}
                      </button>
                    </div>
                  </form>

                  {/* Reviews List */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">Verified Reviews ({reviewsList.length})</h4>
                    {reviewsList.length === 0 ? (
                      <div className="bg-surface border border-border/50 rounded-2xl p-8 text-center text-xs text-muted-foreground">
                        No customer reviews yet. Be the first to share your rating above!
                      </div>
                    ) : (
                      reviewsList.map((rev) => (
                        <div key={rev.id} className="bg-surface border border-border/50 rounded-2xl p-5 space-y-2 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-[#e07a3f]/20 border border-[#e07a3f]/40 flex items-center justify-center text-[#e07a3f] text-xs font-bold uppercase">
                                {rev.user_name.charAt(0)}
                              </div>
                              <span className="text-xs font-semibold text-foreground">{rev.user_name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/70">
                              {new Date(rev.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                          </div>

                          <div className="flex text-[#e07a3f] gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3 h-3 ${star <= rev.rating ? 'fill-current text-[#e07a3f]' : 'text-muted-foreground/30'}`}
                              />
                            ))}
                          </div>

                          {rev.comment && (
                            <p className="text-xs text-foreground/80 leading-relaxed pt-1">{rev.comment}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </main>

        </div>
      </div>

      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => { setIsAuthOpen(false); setPendingAction(null); }} 
        initialMode={authMode}
        onSuccess={(name) => {
          setIsLoggedIn(true);
          setUserName(name);
          setIsAuthOpen(false);
          if (pendingAction === 'tryon') {
            router.push(`/storefront/product/${product.id}/tryon`);
          } else if (pendingAction === 'buynow') {
            addToCart(false);
            router.push("/storefront/checkout");
          } else if (pendingAction === 'cart') {
            addToCart(true);
          }
          // 'favorites' — user can re-click the heart; no auto-action needed
          setPendingAction(null);
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
