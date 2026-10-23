"use client";
import Image from "next/image";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Heart, Star, Ruler, Minus, Plus, ShoppingBag, RefreshCw, Check, Bell, Sparkles, X, ChevronLeft, ChevronRight } from "lucide-react";
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
import { isSizeChart, SizeChart, WOMENS_SIZE_CHART } from "@/lib/sizeChart";
import { showToast } from "@/lib/toast";
import StorefrontMobileControls from "@/components/layout/StorefrontMobileControls";
import { useFavorites } from "@/hooks/useFavorites";
import { storefrontProductImage } from "@/lib/storefront-images";

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
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOrigin, setZoomOrigin] = useState("center center");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeHandled = useRef(false);
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false);
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
    occasion: string;
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
    occasion: "",
    image: "/product-placeholder.svg",
    images: ["/product-placeholder.svg"],
    rating: 0,
    reviewsCount: 0,
  });

  const galleryImages = product.images?.length ? product.images : [product.image];
  const has3DModel = Boolean(product.model3dUrl || product.model_path);
  const totalSlides = galleryImages.length + Number(has3DModel);
  const currentSlideIndex = is3DMode && has3DModel ? galleryImages.length : activeImageIndex;
  const selectGallerySlide = (index: number) => {
    if (has3DModel && index === galleryImages.length) {
      setIs3DMode(true);
      return;
    }
    setActiveImageIndex(index);
    setIs3DMode(false);
  };
  const showPreviousImage = () => {
    selectGallerySlide((currentSlideIndex - 1 + totalSlides) % totalSlides);
  };
  const showNextImage = () => {
    selectGallerySlide((currentSlideIndex + 1) % totalSlides);
  };

  useEffect(() => {
    if (!isGalleryOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsGalleryOpen(false);
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setZoomScale(1);
        setActiveImageIndex((index) => (index + (event.key === "ArrowRight" ? 1 : -1) + galleryImages.length) % galleryImages.length);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isGalleryOpen, galleryImages.length]);



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
          const uploadedImage = item.image || (typeof firstImage === "string" ? firstImage : firstImage?.s3_url || "") || getFallbackImage();
          const img = storefrontProductImage(item.id, uploadedImage);
          const galleryImages = item.images?.length
            ? item.images.map((image) => typeof image === "string" ? image : image.s3_url || uploadedImage)
            : [];
          const allImgs = [img, ...galleryImages.filter((image) => image !== img)];
          const modelUrl = getProductSpecificModelUrl(item.model_path || item.model3dUrl);

          setProduct({
            id: String(item.id),
            name: item.name || item.title || "Product",
            categoryName: catName,
            price: Number(item.price_selling || item.price || 0),
            description: item.description || "",
            fabric: item.fabric || "",
            colour: item.colour || "Default",
            occasion: item.occasion || "",
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
          occasion: item.occasion || "",
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
    if (!session) {
      const timer = window.setTimeout(() => setNotifyEmail(""), 0);
      return () => { active = false; window.clearTimeout(timer); };
    }
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
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
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
      <header className="vx-header h-16 md:h-20 flex items-center justify-between relative px-3 sm:px-6 md:px-12 sticky top-2 md:top-4 bg-surface z-50 rounded-[1.5rem] sm:rounded-[2rem] shadow-md border border-border/50 mx-2 md:mx-4 mt-2 md:mt-4 transition-colors duration-300">
        <div className="vx-header-nav-search flex items-center gap-2 sm:gap-6 z-10">
          <nav aria-label="Store navigation" className="flex items-center gap-2 sm:gap-4 2xl:gap-8">
            <Link href="/storefront/home" className="text-xs sm:text-sm 2xl:text-lg font-medium hover:text-[#e07a3f] transition-colors">Home</Link>
            <Link href="/storefront/collections?gender=Women" className="text-xs sm:text-sm 2xl:text-lg font-medium hover:text-[#e07a3f] transition-colors">Collections</Link>
          </nav>
          <StorefrontMobileControls showMenu={false} inlineSearch />
        </div>

        <div className="vx-header-brand absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-0">
          <Link href="/storefront/home" className="text-base sm:text-2xl md:text-4xl font-bold tracking-[0.12em] sm:tracking-[0.25em] uppercase pointer-events-auto hover:text-[#e07a3f] transition-colors">
            VASTRAX
          </Link>
        </div>

        <div className="vx-header-actions flex items-center gap-1.5 sm:gap-4 md:gap-6 z-10">
          {String(session?.user?.role || "").toLowerCase() === "admin" && (
            <Link href="/" className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-accent hover:text-accent">Admin</Link>
          )}
          <ThemeToggle />
          <Link href="/storefront/favorites" aria-label="Favorites" className="relative inline-flex h-11 w-11 items-center justify-center text-foreground/70 hover:text-[#e07a3f] transition-colors">
            <Heart className="w-5 h-5" />
          </Link>
          <button
            onClick={() => setIsStylistOpen(true)}
            className="vx-product-header-stylist hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-[#e07a3f]/10 text-[#8d4e2c] border border-[#8d4e2c]/30 hover:bg-[#e07a3f] hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
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
          <div className="flex items-center gap-2 text-xs text-[#62584f] mb-6 font-medium px-2">
            <Link href="/storefront/home" aria-label="Home" className="min-h-11 min-w-11 rounded-lg hover:text-foreground transition-colors flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            </Link>
            <span className="text-foreground/30">&gt;</span>
            <Link href="/storefront/collections?gender=Women" className="inline-flex min-h-11 items-center hover:text-foreground transition-colors">Collections</Link>
            <span className="text-foreground/30">&gt;</span>
            <span className="text-foreground font-bold truncate max-w-xs">{product.name}</span>
          </div>

          {/* Top Product Section */}
          <main id="main-content" tabIndex={-1} className="bg-surface rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-border/50 p-6 md:p-10 mb-12 transition-colors duration-300">
            <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">

              {/* Left: Image Gallery & 3D Interactive Viewer */}
              <div className="w-full lg:w-[55%]">
                <div
                  className="bg-white dark:bg-white rounded-[2.5rem] aspect-square relative flex items-center justify-center p-4 sm:p-8 transition-colors duration-300 overflow-hidden"
                  onTouchStart={(event) => {
                    swipeHandled.current = false;
                    const touch = event.touches[0];
                    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
                  }}
                  onTouchEnd={(event) => {
                    const start = touchStart.current;
                    const touch = event.changedTouches[0];
                    touchStart.current = null;
                    if (!start || !touch || totalSlides < 2) return;
                    const dx = touch.clientX - start.x;
                    const dy = touch.clientY - start.y;
                    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
                      swipeHandled.current = true;
                      if (dx < 0) showNextImage();
                      else showPreviousImage();
                    }
                  }}
                >
                  {/* Top Right: Wishlist */}
                  <button
                    onClick={(e) => toggleFavorite(product, e)}
                    aria-label={favorites.includes(String(product.id)) ? "Remove from favorites" : "Add to favorites"}
                    className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white dark:bg-[#2a2a2a] flex items-center justify-center text-black/60 dark:text-white hover:text-[#e07a3f] transition-colors z-30 shadow-md border border-black/5 dark:border-white/10"
                  >
                    <Heart className={`w-5 h-5 ${favorites.includes(String(product.id)) ? 'fill-[#e07a3f] text-[#e07a3f]' : ''}`} />
                  </button>
                  <Link
                    href={"/storefront/product/" + encodeURIComponent(product.id) + "/tryon"}
                    className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-sm font-semibold text-foreground shadow-md transition-colors hover:bg-white"
                  >
                    <Sparkles className="h-4 w-4 text-accent" />
                    Virtual Try-On
                  </Link>
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
                    <button
                      type="button"
                      onClick={() => {
                        if (swipeHandled.current) { swipeHandled.current = false; return; }
                        setZoomScale(1);
                        setIsGalleryOpen(true);
                      }}
                      aria-label={`Enlarge image ${activeImageIndex + 1} of ${product.name}`}
                      className="h-full w-full cursor-zoom-in rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <Image width={1200} height={900} unoptimized
                        src={product.images?.[activeImageIndex] || product.image}
                        alt={product.name}
                        className="w-full h-full object-contain rounded-2xl bg-white p-2 md:p-4 animate-fade-in"
                      />
                    </button>
                  )}
                  {totalSlides > 1 && (
                    <>
                      <button type="button" onClick={showPreviousImage} aria-label="Previous product image" className="absolute left-4 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#29231f] shadow-md transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a84d25]">
                        <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                      </button>
                      <button type="button" onClick={showNextImage} aria-label="Next product image" className="absolute right-4 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#29231f] shadow-md transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a84d25]">
                        <ChevronRight aria-hidden="true" className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>

                {totalSlides > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2" role="group" aria-label="Product image slides">
                    {Array.from({ length: totalSlides }, (_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectGallerySlide(idx)}
                        aria-label={has3DModel && idx === galleryImages.length ? `Show 3D model of ${product.name}` : `Show image ${idx + 1} of ${product.name}`}
                        aria-pressed={currentSlideIndex === idx}
                        className={`h-2.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a84d25] ${currentSlideIndex === idx ? "w-6 bg-[#a84d25]" : "w-2.5 bg-[#b9afa6] hover:bg-[#8d4e2c]"}`}
                      />
                    ))}
                  </div>
                )}


                <div className="mt-6 px-1">
                  <h1 className="text-2xl md:text-3xl font-bold leading-tight text-foreground">{product.name}</h1>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="text-2xl md:text-3xl font-bold text-foreground">₹{product.price.toLocaleString()}</span>
                    <span className="text-xs text-[#62584f]">Inclusive of all taxes</span>
                  </div>
                </div>
              </div>

              {/* Right: Product Details & purchase options */}
              <div className="w-full lg:w-[45%] flex flex-col pt-2">
                <section className="mb-6">
                  <h2 className="mb-3 text-xl font-bold text-foreground">Product Details</h2>
                  <p className="mb-5 max-w-md text-sm leading-relaxed text-foreground/70">
                    {product.description || "Description not available."}
                  </p>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Specifications</h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Fabric</dt><dd className="font-medium text-foreground">{product.fabric || "Not specified"}</dd>
                    <dt className="text-muted-foreground">Colour</dt><dd className="font-medium text-foreground">{product.colour || "Not specified"}</dd>
                    <dt className="text-muted-foreground">Occasion</dt><dd className="font-medium text-foreground">{product.occasion || "Not specified"}</dd>
                    <dt className="text-muted-foreground">Category</dt><dd className="font-medium text-foreground">{product.categoryName || "Not specified"}</dd>
                  </dl>
                </section>

                {product.reviewsCount > 0 && <div className="flex items-center gap-2 mb-6">
                      <div className="flex text-[#e07a3f]" aria-label="Rated by customers">
                        {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={star <= Math.round(product.rating) ? "w-4 h-4 fill-current" : "w-4 h-4 text-muted-foreground/30"} />)}
                      </div>
                      <span className="text-xs font-bold text-foreground">{product.rating} / 5.0</span>
                      <span className="text-xs text-foreground/50">({product.reviewsCount} Reviews)</span>
                </div>}

                <div className="w-full h-[1px] bg-border/50 mb-6" />

                <div className="w-full h-[1px] bg-border/50 mb-6" />

                <div className="w-full h-[1px] bg-border/50 mb-6" />

                {/* Size Selector */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-foreground">Select Size</div>
                    <button
                      type="button"
                      onClick={() => setIsSizeChartOpen(true)}
                      className="text-sm font-medium text-[#8d4e2c] underline underline-offset-4 hover:text-[#743a20]"
                    >
                      <Ruler className="w-4 h-4" />
                      <span>Size Chart</span>
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
                              ? 'border-border/40 text-[#62584f] hover:border-foreground/30'
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
                        aria-label="Decrease quantity"
                        className="w-12 h-full flex items-center justify-center text-[#62584f] hover:text-foreground transition-colors cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-foreground">{quantity}</span>
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        aria-label="Increase quantity"
                        className="w-12 h-full flex items-center justify-center text-[#62584f] hover:text-foreground transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-xs text-[#62584f] font-medium">In stock and ready to ship</span>
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
                        className="flex-1 min-h-[52px] bg-[#a84d25] hover:bg-[#873b1f] text-white h-[52px] rounded-full font-medium text-sm transition-colors shadow-lg shadow-[#e07a3f]/20 flex items-center justify-center cursor-pointer"
                      >
                        Buy Now
                      </button>
                      <button
                        onClick={() => addToCart(true)}
                        className="flex-1 min-h-[52px] bg-transparent border border-foreground/20 hover:border-foreground/50 hover:bg-foreground/5 text-foreground h-[52px] rounded-full font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Add to Cart
                      </button>
                    </div>
                  )}
                </div>



              </div>
            </div>


          </main>

        </div>
      </div>

      {isSizeChartOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setIsSizeChartOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="size-chart-title"
            className="relative max-h-[88vh] w-full max-w-[380px] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsSizeChartOpen(false)}
              aria-label="Close size chart"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-foreground shadow"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 id="size-chart-title" className="sr-only">Vastrax size chart</h2>
            {product.size_chart === WOMENS_SIZE_CHART ? (
              <Image
                src="/images/vastrax-womens-size-guide.svg"
                alt="Vastrax women’s size guide with bust, waist, and hip measurements for sizes XS to 4XL"
                width={834}
                height={1390}
                className="mx-auto h-auto max-h-[78vh] w-auto max-w-full object-contain"
              />
            ) : product.size_chart?.headers?.length && product.size_chart.rows.length ? (
              <div className="pt-10">
                <h3 className="mb-4 text-center text-lg font-bold text-foreground">Size Chart</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead><tr className="border-b border-border text-xs font-bold uppercase text-muted-foreground">
                      {product.size_chart.headers.map((header, index) => <th key={index} className="px-2 py-3">{header}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-border/50">
                      {product.size_chart.rows.map((row, index) => (
                        <tr key={index}>
                          {Object.entries(row).map(([key, value]) => <td key={key} className="px-2 py-3">{value}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="pt-10 text-center text-sm text-muted-foreground">No size chart is available for this product.</p>
            )}
          </section>
        </div>
      )}

      {isGalleryOpen && (
        <div
          onClick={(event) => { if (event.target === event.currentTarget) setIsGalleryOpen(false); }}
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} image gallery`}
          className="fixed inset-0 z-[130] flex flex-col bg-background text-foreground"
        >
          <div className="relative mx-auto flex min-h-0 w-full max-w-7xl flex-1 items-center justify-center px-12 sm:px-20">
            {galleryImages.length > 1 && (
              <>
                <button type="button" onClick={() => { setZoomScale(1); setActiveImageIndex((index) => (index - 1 + galleryImages.length) % galleryImages.length); }} aria-label="Previous image" className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface/85 text-foreground shadow-sm hover:bg-surface sm:left-5">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button type="button" onClick={() => { setZoomScale(1); setActiveImageIndex((index) => (index + 1) % galleryImages.length); }} aria-label="Next image" className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface/85 text-foreground shadow-sm hover:bg-surface sm:right-5">
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setZoomScale((value) => value === 1 ? 2.5 : 1)}
              onWheel={(event) => {
                event.preventDefault();
                setZoomScale((value) => Math.min(4, Math.max(1, value + (event.deltaY < 0 ? 0.35 : -0.35))));
              }}
              onMouseMove={(event) => {
                if (zoomScale === 1) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                setZoomOrigin(`${((event.clientX - bounds.left) / bounds.width) * 100}% ${((event.clientY - bounds.top) / bounds.height) * 100}%`);
              }}
              aria-label={`Product image, ${zoomScale === 1 ? "click to zoom in" : `${zoomScale.toFixed(1)} times zoom`}`}
              className={`h-full w-full overflow-hidden bg-transparent ${zoomScale > 1 ? "cursor-zoom-out" : "cursor-pointer"}`}
            >
              <Image
                src={galleryImages[activeImageIndex] || product.image}
                alt={`${product.name}, image ${activeImageIndex + 1}`}
                width={1600}
                height={1600}
                unoptimized
                className="h-full w-full object-contain transition-transform duration-150"
                style={{ transform: `scale(${zoomScale})`, transformOrigin: zoomOrigin }}
              />
            </button>
          </div>

          <div className="mx-auto w-full max-w-7xl px-4 pb-4 pt-3 sm:px-8">
            <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="All product images">
              {galleryImages.map((src, index) => (
                <button key={`${src}-${index}`} type="button" onClick={() => { setActiveImageIndex(index); setZoomScale(1); }} aria-label={`View image ${index + 1}`} aria-pressed={activeImageIndex === index}
                  className={`h-16 w-16 shrink-0 overflow-hidden bg-transparent transition sm:h-20 sm:w-20 ${activeImageIndex === index ? "opacity-100" : "opacity-55 hover:opacity-90"}`}>
                  <Image src={src} alt={`${product.name} thumbnail ${index + 1}`} width={96} height={96} unoptimized className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
