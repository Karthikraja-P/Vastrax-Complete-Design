"use client";
import Image from "next/image";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Heart, Star, ShoppingBag, User, ChevronRight, SlidersHorizontal, Box, Bell } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/auth/AuthModal";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import { Product3DModal } from "@/components/3d/Product3DModal";
import type { AddToCartProduct } from "@/components/3d/Product3DModal";
import { productsApi, categoriesApi, ProductItem, CategoryItem, ProductVariant, StorefrontProduct } from "@/lib/api";
import { reportBackendReachable, reportBackendUnreachable } from "@/lib/backendStatus";
import { addToCart as addCartItem } from "@/lib/cart";
import { useCartItems } from "@/hooks/useCartItems";
import { showToast } from "@/lib/toast";
import { performSignOut } from "@/lib/auth-utils";
import StorefrontMobileControls from "@/components/layout/StorefrontMobileControls";

function CollectionsPageContent() {
  const searchParams = useSearchParams();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [, setAuthMode] = useState<"signin" | "signup">("signin");

  const [favorites, setFavorites] = useState<Array<string | number>>([]);
  const [selectedProductForSize, setSelectedProductForSize] = useState<StorefrontProduct | null>(null);
  const [selected3DProduct, setSelected3DProduct] = useState<StorefrontProduct | null>(null);

  const { data: session } = useSession();
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(session?.user?.name));
  const [userName, setUserName] = useState(session?.user?.name || "");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [categoriesList, setCategoriesList] = useState<{ name: string; icon: string; count?: number }[]>([
    { name: "All Categories", icon: "❖" }
  ]);
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("Women");
  const [searchQuery, setSearchQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("Recommended");
  const [pagination, setPagination] = useState({ filterKey: "", page: 1 });
  const productsPerPage = 12;

  // Keep filters synchronized with links, including query-only navigation.
  useEffect(() => {
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort");
    const timer = window.setTimeout(() => {
      // The public storefront is currently women-only, including legacy links.
      setSelectedDepartment("Women");
      setSelectedCategory(category || "All Categories");
      setSearchQuery(search || "");
      setSortBy(sort === "newest" ? "Newest Arrivals" : "Recommended");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [data, cats] = await Promise.all([
          productsApi.list(),
          categoriesApi.list()
        ]);

        const womenData = data.filter((p: ProductItem) => String(p.gender || "").trim().toLowerCase() === "women");
        const catMap = new Map((cats || []).map((c: CategoryItem) => [String(c.id), c.name]));
        const womenCategoryKeys = new Set<string>();
        for (const product of womenData) {
          const categoryId = String(product.categoryId || product.category_id || "").toLowerCase();
          const categoryName = String(product.category_name || product.category || "").toLowerCase();
          if (categoryId) womenCategoryKeys.add(categoryId);
          if (categoryName) womenCategoryKeys.add(categoryName);
        }

        if (cats && Array.isArray(cats)) {
          setCategoriesList([
            { name: "All Categories", icon: "❖" },
            ...cats.filter((c) =>
              c.is_active !== false &&
              Number(c.count || c.product_count || 0) > 0 &&
              [c.id, c.name, c.slug].some((key) => womenCategoryKeys.has(String(key || "").toLowerCase()))
            ).map((c) => ({
              id: String(c.id),
              name: c.name,
              icon: /frock|dress|gown/i.test(c.name) ? "👗" : /shirt|top/i.test(c.name) ? "👔" : /pant|trouser|denim|jean/i.test(c.name) ? "👖" : "❖",
              count: c.count
            }))
          ]);
        }

        const mapped = womenData.map((p: ProductItem): StorefrontProduct => {
          const fallbackImg = "/product-placeholder.svg";
          const firstImage = p.images?.[0];
          let img = p.image || (typeof firstImage === "string" ? firstImage : firstImage?.s3_url || "");
          if (!img || img === "") img = fallbackImg;

          const rawCatId = String(p.categoryId || p.category_id || "");
          const resolvedCatName = catMap.get(rawCatId) || p.category_name || p.category || "Apparel";

          return {
            id: p.id,
            name: p.name || p.title || "Unnamed Piece",
            price: Number(p.price || p.price_selling || 0),
            originalPrice: p.originalPrice || p.price_mrp || p.compareAtPrice ? Number(p.originalPrice || p.price_mrp || p.compareAtPrice) : undefined,
            rating: Number(p.rating_average || p.rating || 0),
            ratingCount: Number(p.rating_count || 0),
            image: img,
            gender: p.gender || "",
            isNew: Boolean(p.isNew || p.is_featured),
            categoryId: rawCatId,
            stock: p.stock ?? p.inventoryCount,
            isSale: Boolean(p.isSale),
            categoryName: resolvedCatName,
            model3dUrl: p.model_path || p.model3dUrl,
            variants: p.variants || [],
            created_at: p.created_at
          };
        });
        setProducts(mapped);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
      }
    }
    void Promise.resolve().then(fetchData);
  }, []);

  useEffect(() => {
    async function loadWishlist() {
      if (session?.accessToken) {
        // Fetch from backend if logged in
        try {
          const res = await fetch("/api/v1/users/me/wishlist", {
            headers: { Authorization: `Bearer ${session.accessToken}` }
          });
          reportBackendReachable();
          if (res.ok) {
            const data = await res.json();
            setFavorites(data.map((item: { product_id: string | number }) => item.product_id));
            return;
          }
        } catch {
          reportBackendUnreachable();
        }
      }

      // Fallback to local storage if guest or fetch failed
      const saved = localStorage.getItem("vastrax_favorites");
      if (saved) {
        try {
          const parsed: unknown = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setFavorites(parsed.map((favorite: unknown) => typeof favorite === "object" && favorite !== null && "id" in favorite ? String(favorite.id) : String(favorite)));
          }
        } catch { }
      }
    }
    void Promise.resolve().then(loadWishlist);
  }, [session]);

  const toggleFavorite = async (product: StorefrontProduct, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic UI update
    const isFav = favorites.includes(product.id);
    setFavorites(prev => isFav ? prev.filter(id => id !== product.id) : [...prev, product.id]);

    if (session?.accessToken) {
      // Sync with Backend if logged in
      try {
        await fetch(`/api/v1/users/me/wishlist/${product.id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.accessToken}` }
        });
        reportBackendReachable();
      } catch (err) {
        reportBackendUnreachable();
        console.error("Failed to toggle wishlist", err);
      }
    } else {
      // Guest: Sync with LocalStorage
      const savedStr = localStorage.getItem("vastrax_favorites");
      let currentFavs: unknown[] = [];
      try {
        const parsed: unknown = savedStr ? JSON.parse(savedStr) : [];
        if (Array.isArray(parsed)) currentFavs = parsed;
      } catch {
        currentFavs = [];
      }

      if (isFav) {
        currentFavs = currentFavs.filter((favorite) => typeof favorite !== "object" || favorite === null || !("id" in favorite) || String(favorite.id) !== String(product.id));
      } else {
        currentFavs.push({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image
        });
      }
      localStorage.setItem("vastrax_favorites", JSON.stringify(currentFavs));
    }
  };
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortOptions = ["Recommended", "Newest Arrivals", "Price: Low to High", "Price: High to Low", "Top Rated"];

  useEffect(() => {
    const handleOpenStylist = () => setIsStylistOpen(true);
    window.addEventListener("open-stylist", handleOpenStylist);
    return () => window.removeEventListener("open-stylist", handleOpenStylist);
  }, []);

  const bagItems = useCartItems();

  const isItemInBag = (productId: string | number) => {
    return bagItems.some((item) => String(item.id) === String(productId));
  };

  const addItemToBag = (product: AddToCartProduct, size = "M") => {
    const priceNum = typeof product.price === 'string'
      ? parseFloat(String(product.price).replace(/[^0-9.-]+/g, "")) || 0
      : Number(product.price) || 0;

    addCartItem({
      id: product.id,
      name: product.name,
      price: priceNum,
      quantity: 1,
      size: size,
      color: product.colour || "Default",
      image: product.image || ""
    });

    showToast({
      title: "Added to Shopping Bag",
      description: `${product.name} (Size: ${size})`,
      type: "gold",
      image: product.image,
      duration: 3000
    });

    setSelectedProductForSize(null);
  };

  const handleAddToBagClick = (product: StorefrontProduct, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const isOneSize = /cap|hat|beanie/i.test(product.name || "");
    if (!isOneSize) {
      setSelectedProductForSize(product);
    } else {
      addItemToBag(product, "One Size");
    }
  };
  // Compute filtered & sorted products
  const filteredProducts = products.filter((p) => {
    // 1. Category Filter
    if (selectedCategory !== "All Categories") {
      const pCatName = (p.categoryName || "").toLowerCase();
      const pCatId = String(p.categoryId || "").toLowerCase();
      const selCat = selectedCategory.toLowerCase();
      const pName = (p.name || "").toLowerCase();

      // Check direct exact match first
      let isMatch = pCatName === selCat || pCatId === selCat;

      if (!isMatch) {
        if (selCat.includes("dress") || selCat.includes("frock")) {
          isMatch = pCatName.includes("dress") || pCatName.includes("frock") || pCatId.includes("dress") || pCatId.includes("frock") || /dress|frock|gown/i.test(pName);
        } else if (selCat.includes("denim")) {
          isMatch = pCatName.includes("denim") || pCatId.includes("denim") || /denim|jean/i.test(pName);
        } else if (selCat.includes("pant")) {
          isMatch = (pCatName.includes("pant") || pCatName.includes("trouser") || pCatId.includes("pant")) && !selCat.includes("denim");
        } else if (selCat.includes("shirt") && !selCat.includes("t-")) {
          isMatch = (pCatName.includes("shirt") && !pCatName.includes("t-shirt")) || (pCatId.includes("shirt") && !pCatId.includes("t-shirt"));
        } else if (selCat.includes("t-shirt")) {
          isMatch = pCatName.includes("t-shirt") || pCatId.includes("t-shirt") || /t-shirt|tee/i.test(pName);
        } else if (selCat.includes("skirt")) {
          isMatch = pCatName.includes("skirt") || pCatId.includes("skirt") || /skirt/i.test(pName);
        } else if (selCat.includes("top")) {
          isMatch = pCatName.includes("top") || pCatId.includes("top");
        } else if (selCat.includes("jacket")) {
          isMatch = pCatName.includes("jacket") || pCatId.includes("jacket") || /jacket|coat|outerwear/i.test(pName);
        } else if (selCat.includes("hoodie")) {
          isMatch = pCatName.includes("hoodie") || pCatId.includes("hoodie") || /hoodie|sweatshirt/i.test(pName);
        } else if (selCat.includes("shoe")) {
          isMatch = pCatName.includes("shoe") || pCatId.includes("shoe") || /shoe|sneaker|loafer/i.test(pName);
        } else if (selCat.includes("hat")) {
          isMatch = pCatName.includes("hat") || pCatId.includes("hat") || /hat|cap|beanie/i.test(pName);
        }
      }

      if (!isMatch) return false;
    }

    // 2. Department Filter
    if (String(p.gender || "").trim().toLowerCase() !== "women") return false;

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(q) || (p.categoryName && p.categoryName.toLowerCase().includes(q));
      if (!matchSearch) return false;
    }

    // 4. Price Filter
    if (minPrice && p.price < Number(minPrice)) return false;
    if (maxPrice && p.price > Number(maxPrice)) return false;

    return true;
  }).sort((a, b) => {
    if (sortBy === "Price: Low to High") return a.price - b.price;
    if (sortBy === "Price: High to Low") return b.price - a.price;
    if (sortBy === "Top Rated") return (b.rating || 0) - (a.rating || 0);
    if (sortBy === "Newest Arrivals") return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    return 0;
  });

  const pageFilterKey = JSON.stringify([selectedCategory, selectedDepartment, searchQuery, minPrice, maxPrice, sortBy]);
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const currentPage = Math.min(
    pagination.filterKey === pageFilterKey ? pagination.page : 1,
    Math.max(totalPages, 1),
  );
  const changePage = (page: number) => {
    setPagination({ filterKey: pageFilterKey, page: Math.max(1, Math.min(page, Math.max(totalPages, 1))) });
  };
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * productsPerPage, currentPage * productsPerPage);

  return (
    <div className="min-h-screen bg-surface dark:bg-[#111111] text-foreground dark:text-white font-sans flex flex-col">
      {/* Reused Header Style */}
      <header className="h-16 md:h-20 flex items-center justify-between relative px-3 sm:px-6 md:px-12 sticky top-2 md:top-4 bg-surface dark:bg-[#1a1a1a] z-50 rounded-[1.5rem] sm:rounded-[2rem] shadow-md border border-border dark:border-white/10 mx-2 md:mx-4 mt-2 md:mt-4">
        {/* Left Side: Navigation */}
        <div className="flex items-center gap-2 sm:gap-6 z-10">
          <nav aria-label="Store navigation" className="flex items-center gap-2 sm:gap-4 2xl:gap-8">
            <Link href="/storefront/home" className="text-xs sm:text-sm 2xl:text-lg font-medium hover:text-[#e07a3f] transition-colors">Home</Link>
            <Link href="/storefront/collections?gender=Women" onClick={() => setSelectedDepartment("Women")} className="text-xs sm:text-sm 2xl:text-lg font-medium hover:text-[#e07a3f] transition-colors">Collections</Link>
          </nav>
          <StorefrontMobileControls showMenu={false} inlineSearch />
        </div>

        {/* Center: Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-0">
          <Link href="/storefront/home" className="text-base sm:text-2xl md:text-4xl font-bold tracking-[0.12em] sm:tracking-[0.25em] uppercase pointer-events-auto hover:text-accent transition-colors">
            VASTRAX
          </Link>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-4 md:gap-6 z-10">
          {String(session?.user?.role || "").toLowerCase() === "admin" && (
            <Link href="/" className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-accent hover:text-accent">Admin</Link>
          )}
          <ThemeToggle />
          <a href="/storefront/favorites" className="relative p-1 text-muted-foreground hover:text-[#e07a3f] transition-colors">
            <Heart className="w-5 h-5" />
          </a>
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
                          setIsLoggedIn(false);
                          setUserName("");
                          setIsUserMenuOpen(false);
                          performSignOut("/storefront/collections");
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

      {/* Main Content Area */}
      <div className="flex-1 bg-surface dark:bg-[#111111] px-2 md:px-4 pb-2 md:pb-4 pt-4">
        <main className="relative h-full min-h-[calc(100vh-120px)] rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-background dark:bg-[#161616] shadow-sm border border-border/50 dark:border-white/5 pb-20">

          <div className="max-w-[1400px] mx-auto p-4 md:p-10">

            <div className="mb-8 rounded-3xl border border-border/50 bg-gradient-to-br from-surface to-accent/10 p-6 md:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">VastraX Collection</p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">
                {selectedDepartment === "All" ? "Browse products" : selectedDepartment + " collection"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{filteredProducts.length} products available</p>
            </div>

            {/* Layout Grid: Sidebar + Products */}
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">

              {/* Mobile Filter Toggle */}
              <div className="lg:hidden flex items-center justify-between">
                <h1 className="text-2xl font-bold">Best Sellers <span className="text-sm font-normal text-muted-foreground ml-2">{filteredProducts.length} products</span></h1>
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
                    <button
                      onClick={() => { setSelectedCategory("All Categories"); setSelectedDepartment("Women"); setSearchQuery(""); setMinPrice(""); setMaxPrice(""); }}
                      className="text-[#e07a3f] text-xs font-bold tracking-wider uppercase flex items-center gap-1 hover:underline">
                      Reset Filters
                    </button>
                  </div>

                  {/* Search */}
                  <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search products..."
                      className="w-full bg-surface dark:bg-[#111111] border border-border dark:border-white/10 rounded-full py-3 pl-11 pr-4 text-sm text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#e07a3f] transition-colors"
                    />
                  </div>

                  {/* Category */}
                  <div className="mb-8">
                    <h4 className="text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase mb-4">Category</h4>
                    <div className="space-y-1">
                      {categoriesList.map((cat, idx) => (
                        <label key={idx} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${selectedCategory === cat.name ? 'bg-[#e07a3f]/10 text-[#e07a3f]' : 'hover:bg-white/5 text-muted-foreground'}`}>
                          <input type="radio" name="cat" className="hidden" onChange={() => setSelectedCategory(cat.name)} />
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selectedCategory === cat.name ? 'border-[#e07a3f] bg-[#e07a3f]' : 'border-border dark:border-white/20'}`}>
                            {selectedCategory === cat.name && <div className="w-1.5 h-1.5 bg-surface dark:bg-[#1a1a1a] rounded-full" />}
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
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-surface dark:bg-[#111111] border border-border dark:border-white/10 rounded-xl px-3 py-2 flex items-center justify-between focus-within:border-[#e07a3f] transition-colors">
                        <span className="text-muted-foreground text-sm font-medium">₹</span>
                        <input type="text" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-full bg-transparent text-foreground dark:text-white text-sm text-right outline-none font-medium" />
                      </div>
                      <span className="text-muted-foreground">-</span>
                      <div className="flex-1 bg-surface dark:bg-[#111111] border border-border dark:border-white/10 rounded-xl px-3 py-2 flex items-center justify-between focus-within:border-[#e07a3f] transition-colors">
                        <span className="text-muted-foreground text-sm font-medium">₹</span>
                        <input type="text" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full bg-transparent text-foreground dark:text-white text-sm text-right outline-none font-medium" />
                      </div>
                    </div>
                  </div>

                </div>
              </aside>

              {/* 3. Product Grid Area */}
              <div className="flex-1">
                <div className="hidden lg:flex items-end justify-between mb-8">
                  <div>
                    <h1 className="text-3xl font-bold">
                      {selectedDepartment !== "All" ? `${selectedDepartment}'s ${selectedCategory === "All Categories" ? "Collection" : selectedCategory}` : selectedCategory} 
                      <span className="text-sm font-normal text-muted-foreground ml-2">{filteredProducts.length} products</span>
                    </h1>
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

                <div id="product-grid" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                  {paginatedProducts.map((product) => {
                    const isOutOfStock = !product.variants?.length || product.variants.every((variant: ProductVariant) => Number(variant.stock_qty ?? 0) <= 0);

                    return (
                      <div key={product.id} className="bg-surface dark:bg-[#1c1c1c] rounded-3xl p-5 group relative border border-border/50 dark:border-white/5 hover:border-border dark:border-white/10 transition-colors flex flex-col h-[340px]">
                        {/* Top icons */}
                        <div className="flex items-start justify-between z-10 relative mb-4 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => toggleFavorite(product, e)}
                              className="w-8 h-8 rounded-full bg-background dark:bg-[#2a2a2a] flex items-center justify-center text-muted-foreground hover:text-[#e07a3f] transition-colors"
                            >
                              <Heart className={`w-4 h-4 ${favorites.includes(product.id) ? 'fill-[#e07a3f] text-[#e07a3f]' : ''}`} />
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelected3DProduct(product); }}
                              title="Interactive 3D Preview"
                              className="w-8 h-8 rounded-full bg-background dark:bg-[#2a2a2a] flex items-center justify-center text-muted-foreground hover:text-[#38bdf8] transition-colors shadow-sm cursor-pointer group/3d"
                            >
                              <Box className="w-4 h-4 text-[#38bdf8] group-hover/3d:scale-110 transition-transform" />
                            </button>
                          </div>
                          <div className="bg-background dark:bg-[#2a2a2a] px-2.5 py-1 rounded-full flex items-center gap-1.5">
                            <Star className="w-3 h-3 fill-[#e07a3f] text-[#e07a3f]" />
                            <span className="text-[10px] font-bold text-foreground dark:text-white">{product.rating}</span>
                            <span className="text-[9px] text-muted-foreground">({product.ratingCount || 15})</span>
                          </div>
                        </div>

                        {/* Image */}
                        <a href={`/storefront/product?id=${product.id}`} className="relative w-full flex-1 mb-4 flex items-center justify-center overflow-hidden cursor-pointer rounded-2xl bg-black/5">
                          <Image width={1200} height={900} unoptimized
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                          />
                          {isOutOfStock && (
                            <span className="absolute bottom-2 left-2 z-10 bg-red-600/90 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-sm shadow-sm">
                              Sold Out
                            </span>
                          )}
                        </a>

                        {/* Bottom Info */}
                        <div className="flex items-end justify-between relative z-10 shrink-0">
                          <div className="flex-1 pr-4">
                            <a href={`/storefront/product?id=${product.id}`} className="hover:text-[#e07a3f] transition-colors">
                              <h3 className="text-sm font-medium text-foreground/90 mb-1.5 line-clamp-1">{product.name}</h3>
                            </a>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lg font-bold">₹{product.price.toLocaleString()}</span>
                              {product.originalPrice && <span className="text-xs text-muted-foreground line-through">₹{product.originalPrice.toLocaleString()}</span>}
                              {product.isSale && <span className="text-[9px] bg-[#e07a3f]/20 text-[#e07a3f] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">SALE</span>}
                              {product.isNew && <span className="text-[9px] bg-white/10 text-foreground dark:text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">NEW</span>}
                            </div>
                          </div>

                          {/* Action Button: Notify if out of stock, else Add to Bag */}
                          {isOutOfStock ? (
                            <Link
                              href={`/storefront/product?id=${product.id}`}
                              title="Sold Out - Notify Me When Available"
                              className="w-11 h-11 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-colors shrink-0 shadow-sm"
                            >
                              <Bell className="w-4 h-4" />
                            </Link>
                          ) : (
                            <button
                              onClick={(e) => handleAddToBagClick(product, e)}
                              className="w-11 h-11 rounded-full bg-background dark:bg-[#2a2a2a] flex items-center justify-center text-foreground dark:text-white relative overflow-hidden group/btn shrink-0 shadow-sm"
                            >
                              {/* Semi-circle hover effect */}
                              <div className={`absolute inset-x-0 bottom-0 bg-[#e07a3f] transition-all duration-300 ease-out ${isItemInBag(product.id) ? 'h-full' : 'h-0 group-hover/btn:h-1/2 rounded-t-full'}`} />

                              {/* Icon */}
                              <ShoppingBag className={`w-4 h-4 relative z-10 transition-transform duration-300 ${isItemInBag(product.id) ? 'scale-110 text-white' : 'group-hover/btn:-translate-y-0.5'}`} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <nav aria-label="Collection pages" className="mt-12 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        changePage(currentPage - 1);
                        document.getElementById("product-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      disabled={currentPage === 1}
                      className="rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/5 dark:bg-[#1a1a1a]"
                    >Previous</button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        aria-label={`Page ${page}`}
                        aria-current={currentPage === page ? "page" : undefined}
                        onClick={() => {
                          changePage(page);
                          document.getElementById("product-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors ${currentPage === page ? "bg-[#e07a3f] text-white" : "text-muted-foreground hover:bg-white/5 hover:text-foreground dark:text-white"}`}
                      >{page}</button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        changePage(currentPage + 1);
                        document.getElementById("product-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      disabled={currentPage === totalPages}
                      className="rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/5 dark:bg-[#1a1a1a]"
                    >Next</button>
                  </nav>
                )}

              </div>
            </div>
          </div>
        </main>
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <StylistDrawer isOpen={isStylistOpen} onClose={() => setIsStylistOpen(false)} />
      <Product3DModal
        isOpen={!!selected3DProduct}
        onClose={() => setSelected3DProduct(null)}
        product={selected3DProduct}
        onAddToBag={(prod) => {
          addItemToBag(prod, "M");
          setSelected3DProduct(null);
        }}
      />

      {/* Size Selection Modal */}
      {selectedProductForSize && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedProductForSize(null)}>
          <div className="bg-surface border border-border/50 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2 text-foreground">Select Size</h3>
            <p className="text-sm text-muted-foreground mb-6 line-clamp-1">Choose a size for {selectedProductForSize.name}</p>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {(selectedProductForSize.variants || []).map((variant) => {
                const size = variant.size || "";
                const out = Number(variant.stock_qty ?? 0) <= 0;
                return (
                  <button key={variant.id || size} type="button" disabled={out}
                    onClick={() => addItemToBag(selectedProductForSize, size)}
                    className="py-2.5 border border-border/50 rounded-xl text-foreground font-medium hover:bg-accent hover:text-white hover:border-accent disabled:cursor-not-allowed disabled:opacity-40 transition-colors">
                    {size}{out ? " (Out of stock)" : ""}
                  </button>
                );
              })}
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

export default function CollectionsPage() {
  return (
    <Suspense fallback={<main className='min-h-screen bg-background' aria-busy='true' />}>
      <CollectionsPageContent />
    </Suspense>
  );
}
