"use client";
import Image from "next/image";

import { useState, useEffect, useRef, useCallback } from "react";
import { User, ShoppingBag, ArrowRight, ArrowLeft, Heart } from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { productsApi, categoriesApi, CategoryItem, ProductItem } from "@/lib/api";
import { useFavorites } from "@/hooks/useFavorites";

import { useCartItems } from "@/hooks/useCartItems";
import { showToast } from "@/lib/toast";
import { performSignOut } from "@/lib/auth-utils";
import StorefrontMobileControls from "@/components/layout/StorefrontMobileControls";
import { storefrontProductImage } from "@/lib/storefront-images";

interface StoreCategory {
  id?: string;
  productId?: string | number;
  name: string;
  title?: string;
  slug: string;
  image: string;
  price?: number;
}

function moveLookCarousel(viewport: HTMLDivElement | null, count: number, direction: -1 | 1) {
  if (!viewport || count < 2) return;
  const slides = Array.from(viewport.querySelectorAll<HTMLElement>("[data-look-slide]"));
  if (!slides.length) return;
  const viewportRect = viewport.getBoundingClientRect();
  const viewportCenter = viewportRect.left + viewport.clientWidth / 2;
  const currentIndex = slides.reduce((bestIndex, slide, index) => {
    const rect = slide.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const bestRect = slides[bestIndex].getBoundingClientRect();
    const bestCenter = bestRect.left + bestRect.width / 2;
    return Math.abs(center - viewportCenter) < Math.abs(bestCenter - viewportCenter) ? index : bestIndex;
  }, 0);
  let targetIndex = currentIndex + direction;
  if (targetIndex < 0) targetIndex += count;
  if (targetIndex >= slides.length) targetIndex -= count;

  const scrollToCenteredSlide = (slide: HTMLElement, behavior: ScrollBehavior) => {
    const rect = slide.getBoundingClientRect();
    const left = viewport.scrollLeft + rect.left - viewportRect.left + rect.width / 2 - viewport.clientWidth / 2;
    viewport.scrollTo({ left, behavior });
  };
  scrollToCenteredSlide(slides[targetIndex], "smooth");

  const equivalentIndex = targetIndex < count
    ? targetIndex + count
    : targetIndex >= count * 2
      ? targetIndex - count
      : targetIndex;
  if (equivalentIndex !== targetIndex) {
    window.setTimeout(() => scrollToCenteredSlide(slides[equivalentIndex], "auto"), 520);
  }
}

export default function StorefrontHome() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const { favorites } = useFavorites();
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(session?.user?.name));
  const [userName, setUserName] = useState(session?.user?.name || "");

  const [collections, setCollections] = useState<StoreCategory[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const lookCarouselRef = useRef<HTMLDivElement>(null);
  const [activeLookIndex, setActiveLookIndex] = useState(1);
  const [isLookCarouselPaused, setIsLookCarouselPaused] = useState(false);
  const moveLookCarouselBy = useCallback((direction: -1 | 1) => {
    if (collections.length < 2) return;
    moveLookCarousel(lookCarouselRef.current, collections.length, direction);
    setActiveLookIndex((current) => (current + direction + collections.length) % collections.length);
  }, [collections.length]);

  useEffect(() => {
    if (collections.length < 2 || isLookCarouselPaused) return;
    const timer = window.setInterval(() => moveLookCarouselBy(1), 2500);
    return () => window.clearInterval(timer);
  }, [collections.length, isLookCarouselPaused, moveLookCarouselBy]);

  useEffect(() => {
    if (collections.length < 2) return;
    const viewport = lookCarouselRef.current;
    const slides = viewport?.querySelectorAll<HTMLElement>("[data-look-slide]");
    const initialSlide = slides?.[collections.length + 1];
    if (!viewport || !initialSlide) return;
    const viewportRect = viewport.getBoundingClientRect();
    const slideRect = initialSlide.getBoundingClientRect();
    const left = viewport.scrollLeft + slideRect.left - viewportRect.left + slideRect.width / 2 - viewport.clientWidth / 2;
    viewport.scrollTo({ left, behavior: "auto" });
  }, [collections.length]);
  const bagItems = useCartItems();

  // Alert if redirected from protected admin routes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "admin_required") {
        showToast({
          title: "Admin Access Required",
          description: "Please sign in with administrator credentials to access the management portal.",
          type: "error"
        });
        window.history.replaceState({}, "", "/storefront/home");
      }
      // Auto-open auth modal when redirected from protected pages (favorites, etc.)
      if (params.get("requireAuth") === "1" && !session) {
        void Promise.resolve().then(() => setIsAuthOpen(true));
        window.history.replaceState({}, "", "/storefront/home");
      }
    }
  }, [session]);

  // Fetch real categories and uploaded products from unified API
  useEffect(() => {
    async function fetchData() {
      try {
        const [cats, prods] = await Promise.all([categoriesApi.list().catch(() => []), productsApi.list().catch(() => [])]);

        // Helper to extract a valid image url from a product
        const getProductImage = (p: ProductItem) => {
          if (!p) return null;
          const uploaded = p.image && typeof p.image === "string" && p.image.trim()
            ? p.image
            : Array.isArray(p.images) && p.images.length > 0
              ? (typeof p.images[0] === "string" ? p.images[0] : p.images[0]?.s3_url)
              : null;
          return storefrontProductImage(p.id, uploaded || undefined);
        };

        const womenProducts = Array.isArray(prods)
          ? prods.filter((p) => String(p.gender || "").trim().toLowerCase() === "women")
          : [];
        const womenCategoryKeys = new Set<string>();
        for (const product of womenProducts) {
          const categoryId = String(product.category_id || product.categoryId || "").toLowerCase();
          const categoryName = String(product.category_name || product.category || "").toLowerCase();
          if (categoryId) womenCategoryKeys.add(categoryId);
          if (categoryName) womenCategoryKeys.add(categoryName);
        }

        // Create category -> latest uploaded women's product image mapping
        const catLatestImageMap = new Map<string, string>();
        for (const p of womenProducts) {
          const img = getProductImage(p);
          if (img) {
            const catId = String(p.category_id || p.categoryId || "").toLowerCase();
            const catName = String(p.category_name || p.category || "").toLowerCase();
            if (catId && !catLatestImageMap.has(catId)) catLatestImageMap.set(catId, img);
            if (catName && !catLatestImageMap.has(catName)) catLatestImageMap.set(catName, img);
          }
        }

        if (cats && Array.isArray(cats) && cats.length > 0) {
          const mapped = cats
            .filter((c: CategoryItem) =>
              c.is_active !== false &&
              Number(c.count || c.product_count || 0) > 0 &&
              [c.id, c.name, c.slug].some((key) => womenCategoryKeys.has(String(key || "").toLowerCase()))
            )
            .map((c: CategoryItem, idx: number) => {
            const catId = String(c.id || "").toLowerCase();
            const catName = String(c.name || "").toLowerCase();
            const catSlug = String(c.slug || "").toLowerCase();

            // Prioritize explicit category image, then real uploaded product image, then default fallback
            const realProductImg = catLatestImageMap.get(catId) || catLatestImageMap.get(catName) || catLatestImageMap.get(catSlug);
            const defaultFallback = "/product-placeholder.svg";

            return {
              id: String(idx + 1).padStart(2, '0'),
              name: c.name,
              title: c.name,
              slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
              image: c.image_url || realProductImg || defaultFallback
            };
          });
          setCategories(mapped);
          setCollections(womenProducts
            .filter((product) => getProductImage(product))
            .map((product, idx) => ({
              id: String(idx + 1).padStart(2, "0"),
              productId: product.id,
              name: product.name || product.title || "Collection",
              title: product.name || product.title || "Collection",
              slug: String(product.name || product.title || "collection").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              image: getProductImage(product) || "/product-placeholder.svg",
              price: Number(product.price_selling || product.price || 0)
            })));
        } else {
          setCategories([]);
          setCollections(womenProducts
            .filter((product) => getProductImage(product))
            .map((product, idx) => ({
              id: String(idx + 1).padStart(2, "0"),
              productId: product.id,
              name: product.name || product.title || "Collection",
              title: product.name || product.title || "Collection",
              slug: String(product.name || product.title || "collection").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              image: getProductImage(product) || "/product-placeholder.svg",
              price: Number(product.price_selling || product.price || 0)
            })));

        }
      } catch (err) {
        console.error("Failed to fetch categories and products:", err);
      }
    }
    void Promise.resolve().then(fetchData);
  }, []);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    const handleOpenStylist = () => setIsStylistOpen(true);
    window.addEventListener("open-stylist", handleOpenStylist);
    return () => window.removeEventListener("open-stylist", handleOpenStylist);
  }, []);

  return (
    <div className="vx-storefront vx-home-storefront min-h-screen bg-surface text-foreground font-sans flex flex-col">
      {/* Storefront Header */}
      <header className="vx-header h-16 md:h-20 flex items-center justify-between relative px-3 sm:px-6 md:px-12 sticky top-0 bg-background z-40 border-b border-border/50">
        {/* Left Side: Navigation */}
        <div className="vx-header-nav-search flex items-center gap-2 sm:gap-6 z-10">
          <nav aria-label="Store navigation" className="flex items-center gap-2 sm:gap-4 2xl:gap-8">
            <Link href="/storefront/home" className="text-xs sm:text-sm 2xl:text-lg font-medium hover:text-accent transition-colors">Home</Link>
            <Link href="/storefront/collections?gender=Women" className="text-xs sm:text-sm 2xl:text-lg font-medium hover:text-accent transition-colors">Collections</Link>
          </nav>
          <StorefrontMobileControls showMenu={false} inlineSearch />
        </div>

        {/* Center: Logo */}
        <div className="vx-header-brand absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-0">
          <Link href="/storefront/home" className="text-base sm:text-2xl md:text-4xl font-bold tracking-[0.12em] sm:tracking-[0.25em] uppercase pointer-events-auto hover:text-accent transition-colors">
            VASTRAX
          </Link>
        </div>

        {/* Right Side: Actions */}
        <div className="vx-header-actions flex items-center gap-1.5 sm:gap-4 md:gap-6 z-10">
          {String(session?.user?.role || "").toLowerCase() === "admin" && (
            <Link href="/" className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-accent hover:text-accent">Admin</Link>
          )}
          <ThemeToggle />
          <button
            onClick={() => {
              if (!session) { setAuthMode('signin'); setIsAuthOpen(true); }
              else router.push('/storefront/favorites');
            }}
            className="relative p-1 text-muted-foreground hover:text-accent transition-colors"
            aria-label="Favorites"
          >
            <Heart className="w-5 h-5" />
            {favorites.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#e07a3f] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-sm">{favorites.length}</span>
            )}
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label={isLoggedIn ? "Open account menu" : "Open sign in menu"}
              aria-expanded={isUserMenuOpen}
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
                          setIsLoggedIn(false);
                          setUserName("");
                          setIsUserMenuOpen(false);
                          performSignOut("/storefront/home");
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
            {bagItems.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-accent-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {bagItems.reduce((acc, item) => acc + (item.quantity || 1), 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Hero Section Wrapper with Gap */}
      <main className="flex-1 bg-surface px-2 pb-2 md:px-4 md:pb-4 pt-4" id="main-content">
        <section className="vx-hero relative min-h-[min(76svh,760px)] overflow-hidden bg-background" aria-labelledby="home-title">
          <Image
            src="/images/hero_hanger_dresses.webp"
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            aria-hidden="true"
            className="vx-hero-image"
          />
          <div className="vx-hero-wash absolute inset-0 z-0" aria-hidden="true" />

          <div className="vx-hero-copy relative z-10 mx-auto flex min-h-[min(76svh,760px)] max-w-[1400px] items-center px-6 py-20 md:px-12">
            <div className="max-w-2xl">
              <h1 id="home-title" className="vx-hero-title mb-6">Two pieces.<br /><span>One complete look.</span></h1>
              <p className="vx-hero-description mb-9 max-w-xl">Explore coordinated two-piece looks available in the VastraX collection.</p>
              <Link href="/storefront/collections?gender=Women" className="vx-primary-cta inline-flex min-h-14 items-center gap-5 rounded-full px-7 py-4 font-semibold">
                Shop the collection <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="vx-category-strip mx-auto mt-5 w-full max-w-[1400px] px-5 py-12 md:px-12 md:py-16" aria-labelledby="category-title">
          <div className="vx-section-heading mb-7">
            <h2 id="category-title">Find your kind of set</h2>
          </div>
          <nav aria-label="Shop by category" className="vx-category-links">
            {categories.length > 0 ? categories.map((cat) => (
              <Link key={cat.slug} href={`/storefront/collections?gender=Women&category=${encodeURIComponent(cat.name)}`} className="vx-category-link">
                <span>{cat.name}</span><ArrowRight aria-hidden="true" className="h-5 w-5" />
              </Link>
            )) : (
              <Link href="/storefront/collections?gender=Women" className="vx-category-link">
                <span>All coordinated sets</span><ArrowRight aria-hidden="true" className="h-5 w-5" />
              </Link>
            )}
          </nav>
        </section>

        <section id="featured-looks" className="vx-edit-section mx-auto mt-2 w-full max-w-[1400px] px-5 pb-16 pt-6 md:px-12 md:pb-24" aria-labelledby="edit-title">
          <div className="vx-section-heading mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="vx-kicker">MADE TO BE WORN TOGETHER</p>
              <h2 id="edit-title">The coordinated edit</h2>
            </div>
            <Link href="/storefront/collections?gender=Women" className="vx-text-link inline-flex items-center gap-2">
              View all pieces <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>

          <div className="vx-look-carousel-wrap">
            {collections.length > 1 && (
              <div className="vx-look-controls" aria-label="Coordinated look carousel controls">
                <button type="button" className="vx-look-control" aria-label="Previous coordinated looks" onClick={() => moveLookCarouselBy(-1)}>
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                </button>
                <button type="button" className="vx-look-control" aria-label="Next coordinated looks" onClick={() => moveLookCarouselBy(1)}>
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            )}
            <div
              ref={lookCarouselRef}
              className="vx-look-grid"
              aria-label="Coordinated looks"
              onTouchStart={() => setIsLookCarouselPaused(true)}
              onTouchEnd={() => {
                window.setTimeout(() => {
                  const viewport = lookCarouselRef.current;
                  if (!viewport) return;
                  const center = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
                  const cards = Array.from(viewport.querySelectorAll<HTMLElement>("[data-look-slide]"));
                  const nearest = cards.reduce<HTMLElement | null>((best, card) => {
                    if (!best) return card;
                    return Math.abs(card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2 - center) < Math.abs(best.getBoundingClientRect().left + best.getBoundingClientRect().width / 2 - center) ? card : best;
                  }, null);
                  if (nearest) setActiveLookIndex(Number(nearest.dataset.lookIndex));
                  setIsLookCarouselPaused(false);
                }, 250);
              }}
              onFocusCapture={() => setIsLookCarouselPaused(true)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsLookCarouselPaused(false);
              }}
            >
              {collections.length > 0 ? [...collections, ...collections, ...collections].map((look, idx) => {
                const cycleIndex = Math.floor(idx / collections.length);
                const isClone = cycleIndex > 0;
                const originalIndex = idx % collections.length;
                return (
                  <Link
                    key={"look-" + cycleIndex + "-" + String(look.productId || look.id)}
                    href={look.productId ? "/storefront/product?id=" + encodeURIComponent(look.productId) : "/storefront/collections?gender=Women"}
                    className={"vx-look-card group " + (originalIndex === (collections.length > 1 ? activeLookIndex : 0) ? "is-active" : "")}
                    data-look-slide
                    data-look-index={originalIndex}
                    aria-hidden={isClone}
                    tabIndex={isClone ? -1 : undefined}
                  >
                    <div className="vx-look-stage">
                      <Image src={look.image} alt={isClone ? "" : look.title || look.name} width={1086} height={1449} sizes="(max-width: 640px) 84vw, (max-width: 1024px) 62vw, 52vw" unoptimized={look.image.startsWith("http")} loading={originalIndex === 0 && !isClone ? "eager" : "lazy"} className="vx-look-image" />
                    </div>
                    <div className="vx-look-meta">
                      <h3>{look.title || look.name}</h3>
                      {typeof look.price === "number" && look.price > 0 && <p>{String.fromCharCode(8377)}{look.price.toLocaleString("en-IN")}</p>}
                    </div>
                  </Link>
                );
              }) : <p className="vx-empty-edit">New coordinated looks will appear here as they are added.</p>}
            </div>
          </div>
        </section>
      </main>

      <div className="vx-mobile-shop-cta md:hidden">
        <Link href="/storefront/collections?gender=Women" className="vx-primary-cta flex min-h-12 items-center justify-center gap-3 rounded-full px-5 font-semibold">
          Shop the collection <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
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
