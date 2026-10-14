"use client";
import Image from "next/image";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Heart, Star, Ruler, Truck, ShieldCheck, Minus, Plus, ShoppingBag, RefreshCw, Check, Box, Bell, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/auth/AuthModal";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import { GarmentViewer3D } from "@/components/3d/GarmentViewer3D";
import { Product3DModal } from "@/components/3d/Product3DModal";

import { productsApi, fetchApi, ProductItem, ProductVariant } from "@/lib/api";
import { addToCart as addCartItem } from "@/lib/cart";
import { useCartItems } from "@/hooks/useCartItems";
import { isSizeChart, SizeChart, SizeChartRow, WOMENS_SIZE_CHART } from "@/lib/sizeChart";
import { showToast } from "@/lib/toast";
import StorefrontMobileControls from "@/components/layout/StorefrontMobileControls";
import { useFavorites } from "@/hooks/useFavorites";

function resolveSizeChart(value: unknown, gender?: string): SizeChart | undefined {
  if (isSizeChart(value)) {
    const hasMeasurements = value.rows.some((row) =>
      Object.entries(row).some(([key, cell]) => key !== "size" && String(cell ?? "").trim().length > 0)
    );
    if (hasMeasurements) return value;
  }
  return String(gender || "").toLowerCase() === "women" ? WOMENS_SIZE_CHART : undefined;
}

function ProductContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get("id") || searchParams.get("product_id");
  const requestedProductKey = productId || "__featured__";
  const [resolvedProductKey, setResolvedProductKey] = useState<string | null>(null);
  const [failedProductKey, setFailedProductKey] = useState<string | null>(null);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [pendingAction, setPendingAction] = useState<'cart' | 'favorites' | 'buynow' | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);
  const bagItems = useCartItems();
  const [activeColor, setActiveColor] = useState('Black');
  const [activeSize, setActiveSize] = useState('M');
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('Description');
  const { favorites, toggleFavorite: toggleFavoriteStore } = useFavorites();

  const { data: session } = useSession();

  const [is3DMode, setIs3DMode] = useState(false);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);

  // Dynamic Product State
  const [product, setProduct] = useState<{
    id: string;
    name: string;
    categoryName: string;
    price: number;
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
    size_chart?: SizeChart;
    gender?: string;
    variants?: ProductVariant[];
  }>({
    id: "",
    name: "",
    categoryName: "",
    price: 0,
    description: "",
    fabric: "",
    colour: "",
    image: "/product-placeholder.svg",
    images: ["/product-placeholder.svg"],
    rating: 0,
    reviewsCount: 0,
  });

  const [sizeChartUnit, setSizeChartUnit] = useState<"in" | "cm">("in");

  const getFallbackImage = () => "/product-placeholder.svg";
  const getProductSpecificModelUrl = (value?: string) => {
    if (!value) return undefined;
    const filename = value.split(/[?#]/, 1)[0].split("/").pop()?.toLowerCase();
    if (["garment_perfect.glb", "garment2_textured.glb", "textured_garment.glb", "garment_photo_textured.glb"].includes(filename || "")) return undefined;
    return value;
  };


  // Auto-open auth modal when redirected from try-on without login
  useEffect(() => {
    if (searchParams.get("requireAuth") === "1" && !session) {
      void Promise.resolve().then(() => setIsAuthOpen(true));
    }
  }, [searchParams, session]);

  useEffect(() => {
    let cancelled = false;
    const requestKey = productId || "__featured__";

    async function loadProduct() {
      try {
        if (productId) {
          const item = await productsApi.getById(productId);
          if (!item) throw new Error("Product not found");
          if (cancelled) return;

          const catName = item.category_name || item.category || "Apparel";
          const firstImage = item.images?.[0];
          const img = item.image || (typeof firstImage === "string" ? firstImage : firstImage?.s3_url || "") || getFallbackImage();
          const allImgs = item.images?.length
            ? item.images.map((image) => typeof image === "string" ? image : image.s3_url || img)
            : [img];
          const modelUrl = getProductSpecificModelUrl(item.model_path || item.model3dUrl);

          setProduct({
            id: String(item.id),
            name: item.name || item.title || "Product",
            categoryName: catName,
            price: Number(item.price_selling || item.price || 0),
            description: item.description || "",
            fabric: item.fabric || "",
            colour: item.colour || "Default",
            image: img,
            images: allImgs,
            rating: Number(item.rating || item.rating_average || 0),
            reviewsCount: Number(item.rating_count || item.reviewsCount || 0),
            model3dUrl: modelUrl,
            stock: item.stock ?? item.inventoryCount ?? 0,
            size_chart: resolveSizeChart(item.size_chart, item.gender),
            gender: item.gender || "",
            variants: item.variants || []
          });
          if (item.colour) setActiveColor(item.colour);
          setActiveSize(item.variants?.[0]?.size || (isSizeChart(item.size_chart) ? item.size_chart.rows[0]?.size : undefined) || "");
          setActiveImageIndex(0);
          setIs3DMode(false);
          setResolvedProductKey(requestKey);
          setFailedProductKey(null);
          return;
        }

        const allItems = await productsApi.list();
        if (cancelled) return;
        if (allItems.length === 0) throw new Error("No products are available");

        const item: ProductItem = allItems[0];
        const catName = item.category_name || item.category || "Apparel";
        const firstImage = item.images?.[0];
        const img = item.image || (typeof firstImage === "string" ? firstImage : firstImage?.s3_url || "") || getFallbackImage();
        const allImgs = item.images?.length
          ? item.images.map((image) => typeof image === "string" ? image : image.s3_url || img)
          : [img];
        const modelUrl = getProductSpecificModelUrl(item.model_path || item.model3dUrl);

        setProduct({
          id: String(item.id),
          name: item.name || item.title || "Product",
          categoryName: catName,
          price: Number(item.price_selling || item.price || 0),
          description: item.description || "",
          fabric: item.fabric || "",
          colour: item.colour || "Default",
          image: img,
          images: allImgs,
          rating: Number(item.rating_average || item.rating || 0),
          ratingCount: Number(item.rating_count || item.reviewsCount || 0),
          reviewsCount: Number(item.rating_count || item.reviewsCount || 0),
          model3dUrl: modelUrl,
          model_path: item.model_path,
          stock: item.stock ?? item.inventoryCount ?? 0,
          size_chart: resolveSizeChart(item.size_chart, item.gender),
          gender: item.gender || "",
          variants: item.variants || []
        });
        if (item.colour) setActiveColor(item.colour);
        setActiveSize(item.variants?.[0]?.size || (isSizeChart(item.size_chart) ? item.size_chart.rows[0]?.size : undefined) || "");
        setActiveImageIndex(0);
        setIs3DMode(false);
        setResolvedProductKey(requestKey);
        setFailedProductKey(null);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load product details:", err);
          setFailedProductKey(requestKey);
        }
      }
    }

    void loadProduct();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const [notifyEmail, setNotifyEmail] = useState("");
  const [isSubscribingNotify, setIsSubscribingNotify] = useState(false);
  const [isNotifySuccess, setIsNotifySuccess] = useState(false);

  useEffect(() => {
    let active = true;
    fetchApi<{ email?: string }>("/users/me").then((profile) => {
      if (active && profile.email) setNotifyEmail((current) => current || profile.email || "");
    }).catch(() => { /* Guests can enter an email manually. */ });
    return () => { active = false; };
  }, [session]);
  // Derive stock for current active size
  const activeVariant = product.variants?.find(
    (v: ProductVariant) => v.size?.toUpperCase() === activeSize.toUpperCase()
  );
  const currentStock = activeVariant ? Number(activeVariant.stock_qty ?? 0) : 0;
  const isOutOfStock = currentStock <= 0;
  const chartSizes = product.size_chart?.rows.map((row) => row.size.trim()).filter(Boolean) || [];
  const variantSizes = product.variants?.map((variant) => variant.size?.trim()).filter((size): size is string => Boolean(size)) || [];
  const availableSizes = variantSizes.length ? variantSizes : chartSizes;

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
    } catch (err: unknown) {
      console.error("Failed to subscribe for restock:", err);
      showToast({
        title: "Subscription Failed",
        description: err instanceof Error ? err.message : "Could not register for notifications. Please try again.",
        type: "error",
        duration: 4000,
      });
    } finally {
      setIsSubscribingNotify(false);
    }
  };

  const toggleFavorite = (p: typeof product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      setPendingAction('favorites');
      setAuthMode('signin');
      setIsAuthOpen(true);
      return;
    }

    toggleFavoriteStore(p.id, { id: p.id, name: p.name, price: `₹${p.price || 0}`, image: p.image });
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

    addCartItem({
      id: product.id,
      name: product.name,
      price: priceNum,
      quantity: quantity,
      size: activeSize,
      color: activeColor,
      image: product.image
    });

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


  if (resolvedProductKey !== requestedProductKey) {
    const failed = failedProductKey === requestedProductKey;
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          {failed ? (
            <>
              <p className="text-sm text-muted-foreground">This product could not be loaded. Please return to the collection and try again.</p>
              <Link href="/storefront/collections?gender=Women" className="rounded-full bg-[#e07a3f] px-5 py-2.5 text-sm font-semibold text-white">Back to collection</Link>
            </>
          ) : (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-[#e07a3f]" />
              <p className="text-sm text-muted-foreground">Loading product…</p>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="h-16 md:h-20 flex items-center justify-between relative px-3 sm:px-6 md:px-12 sticky top-2 md:top-4 bg-surface z-50 rounded-[1.5rem] sm:rounded-[2rem] shadow-md border border-border/50 mx-2 md:mx-4 mt-2 md:mt-4 transition-colors duration-300">
        <div className="flex items-center gap-2 sm:gap-6 z-10">
          <nav aria-label="Store navigation" className="flex items-center gap-2 sm:gap-4 2xl:gap-8">
            <Link href="/storefront/home" className="text-xs sm:text-sm 2xl:text-lg font-medium hover:text-[#e07a3f] transition-colors">Home</Link>
            <Link href="/storefront/collections?gender=Women" className="text-xs sm:text-sm 2xl:text-lg font-medium hover:text-[#e07a3f] transition-colors">Collections</Link>
          </nav>
          <StorefrontMobileControls showMenu={false} inlineSearch />
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-0">
          <Link href="/storefront/home" className="text-base sm:text-2xl md:text-4xl font-bold tracking-[0.12em] sm:tracking-[0.25em] uppercase pointer-events-auto hover:text-[#e07a3f] transition-colors">
            VASTRAX
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-4 md:gap-6 z-10">
          {String(session?.user?.role || "").toLowerCase() === "admin" && (
            <Link href="/" className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-accent hover:text-accent">Admin</Link>
          )}
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
            <Link href="/storefront/collections?gender=Women" className="hover:text-foreground transition-colors">Collections</Link>
            <span className="text-foreground/30">&gt;</span>
            <span className="text-foreground font-bold truncate max-w-xs">{product.name}</span>
          </div>

          {/* Top Product Section */}
          <main className="bg-surface rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-border/50 p-6 md:p-10 mb-12 transition-colors duration-300">
            <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">

              {/* Left: Image Gallery & 3D Interactive Viewer */}
              <div className="w-full lg:w-[55%]">
                <div className="bg-[#f5f5f5] dark:bg-[#1a1a1a] rounded-[2.5rem] aspect-square relative flex items-center justify-center p-4 sm:p-8 transition-colors duration-300 overflow-hidden">
                  {/* Top Right: Wishlist */}
                  <button
                    onClick={(e) => toggleFavorite(product, e)}
                    aria-label={favorites.includes(String(product.id)) ? "Remove from favorites" : "Add to favorites"}
                    className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white dark:bg-[#2a2a2a] flex items-center justify-center text-black/60 dark:text-white hover:text-[#e07a3f] transition-colors z-30 shadow-md border border-black/5 dark:border-white/10"
                  >
                    <Heart className={`w-5 h-5 ${favorites.includes(String(product.id)) ? 'fill-[#e07a3f] text-[#e07a3f]' : ''}`} />
                  </button>
                  {/* Product photo stays unobstructed; use the thumbnail below for 3D. */}
                  {is3DMode ? (
                    <div className="w-full h-full">
                      <GarmentViewer3D
                        src={product.model3dUrl || ""}
                        alt={product.name}
                        poster={product.images?.[activeImageIndex] || product.image}
                        badgeTitle="Garment Preview"
                        showControls={false}
                        showInteractionHint={false}
                        showBadge={false}
                        className="w-full h-full"
                      />
                    </div>
                  ) : (
                    <Image width={1200} height={900} unoptimized
                      src={product.images?.[activeImageIndex] || product.image}
                      alt={product.name}
                    className="w-full h-full object-contain rounded-2xl bg-[#f8f7f4] p-2 md:p-4 animate-fade-in"
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
                      className={`relative flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden border-2 transition-all bg-[#f8f7f4] ${
                        !is3DMode && activeImageIndex === idx ? 'border-[#e07a3f] shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <Image width={1200} height={900} unoptimized src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-contain p-1" />
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

                <div className="mt-6 px-1">
                  <h1 className="text-2xl md:text-3xl font-bold leading-tight text-foreground">{product.name}</h1>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="text-2xl md:text-3xl font-bold text-foreground">₹{product.price.toLocaleString()}</span>
                    <span className="text-xs text-foreground/40">Inclusive of all taxes</span>
                  </div>
                </div>
              </div>

              {/* Right: Product Details & purchase options */}
              <div className="w-full lg:w-[45%] flex flex-col pt-2">

                {product.description && (
                  <p className="text-foreground/70 text-sm leading-relaxed mb-6 max-w-md">
                    {product.description}
                  </p>
                )}

                {product.reviewsCount > 0 && <div className="flex items-center gap-2 mb-6">
                      <div className="flex text-[#e07a3f]" aria-label="Rated by customers">
                        {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={star <= Math.round(product.rating) ? "w-4 h-4 fill-current" : "w-4 h-4 text-muted-foreground/30"} />)}
                      </div>
                      <span className="text-xs font-bold text-foreground">{product.rating} / 5.0</span>
                      <span className="text-xs text-foreground/50">({product.reviewsCount} Reviews)</span>
                </div>}

                <div className="w-full h-[1px] bg-border/50 mb-6" />

                <Link href={"/storefront/product/" + encodeURIComponent(product.id) + "/tryon"} className="mb-6 block w-full rounded-2xl border border-accent/25 bg-surface px-4 py-4 transition-colors hover:border-accent/50 hover:bg-accent/5">
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><Sparkles className="h-5 w-5" /></span>
                    <span><span className="block text-sm font-semibold text-foreground">Virtual Try-On</span><span className="mt-0.5 block text-xs text-muted-foreground">Upload a photo to preview how this outfit may look on you.</span></span>
                  </span>
                </Link>

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
                    {availableSizes.map((sz) => {
                      const szVar = product.variants?.find(
                        (v: ProductVariant) => v.size?.toUpperCase() === sz.toUpperCase()
                      );
                      const szOos = !szVar || Number(szVar.stock_qty ?? 0) <= 0;
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
                          <span className={szOos ? "line-through decoration-red-500 decoration-2" : ""}>{sz}</span>
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
                {['Description', 'Size Chart', 'Specifications'].map(tab => (
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
                        <span>VASTRAX WOMEN’S SIZE GUIDE</span>
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
                    {product.size_chart === WOMENS_SIZE_CHART && sizeChartUnit === 'in' ? (
                      <Image src="/images/vastrax-womens-size-guide.svg" alt="Vastrax women’s size guide with bust, waist, and hip measurements for sizes XS to 4XL" width={834} height={1390} className="mx-auto h-auto w-full max-w-[834px] rounded-xl" />
                    ) : (() => {
                      const activeSizeChart = product.size_chart;
                      if (!activeSizeChart?.headers?.length || !activeSizeChart.rows?.length) {
                        return <p className="text-sm text-muted-foreground">No size chart has been added for this product.</p>;
                      }
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
                            {activeSizeChart.rows?.map((row: SizeChartRow, rIdx: number) => (
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

                  <p className="px-1 text-xs text-muted-foreground">All values are approximate body measurements, not finished garment measurements.</p>

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


            </div>
          </main>

        </div>
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => { setIsAuthOpen(false); setPendingAction(null); }}
        initialMode={authMode}
        onSuccess={() => {
          setIsAuthOpen(false);
          if (pendingAction === 'buynow') {
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
          model3dUrl: product.model3dUrl
        }}
        onAddToBag={() => addToCart()}
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
