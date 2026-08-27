"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { 
  Home, ChevronRight, Plus, Sparkles, Image as ImageIcon, Send, Link as LinkIcon, 
  Bold, Italic, Underline, List, AlignLeft, Type, Check, ChevronDown, Loader2,
  ArrowLeft, Package
} from "lucide-react";
import { productsApi, categoriesApi } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function EditProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [comparePrice, setComparePrice] = useState("");
  const [stock, setStock] = useState("10");
  const [categoryId, setCategoryId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [occasion, setOccasion] = useState("");

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      setInitialLoading(true);
      try {
        // 1. Load Categories
        const cats = await categoriesApi.list();
        setCategories(cats || []);

        // 2. Load existing product if ID is provided
        if (productId) {
          let prod = await productsApi.getById(productId);
          if (!prod) {
            // Fallback: search in full products list
            const allProds = await productsApi.list({ published_only: false });
            prod = allProds.find((p: any) => String(p.id) === String(productId)) || null;
          }

          if (prod) {
            setName(prod.name || prod.title || "");
            setDescription(prod.description || "");
            const selling = prod.price_selling !== undefined ? prod.price_selling : (prod.price !== undefined ? prod.price : "");
            const mrp = prod.price_mrp !== undefined ? prod.price_mrp : (prod.originalPrice !== undefined ? prod.originalPrice : "");
            setPrice(String(selling));
            setComparePrice(String(mrp));
            setOccasion(prod.occasion || "");
            
            // Match category
            const targetCat = String(prod.category_id || prod.categoryId || "");
            const foundCat = cats.find((c: any) => 
              String(c.id) === targetCat || 
              c.slug === targetCat || 
              c.name.toLowerCase() === String(prod.category || "").toLowerCase()
            );
            if (foundCat) {
              setCategoryId(String(foundCat.id));
            } else if (cats.length > 0) {
              setCategoryId(String(cats[0].id));
            }

            setIsActive(prod.is_published !== false);
            setIsFeatured(Boolean(prod.is_featured));
            
            const img = prod.image || (prod.images && prod.images.length > 0 ? (typeof prod.images[0] === 'string' ? prod.images[0] : prod.images[0].s3_url) : null);
            if (img) setUploadedImage(img);

            if (prod.variants && prod.variants.length > 0) {
              setSku(prod.variants[0].sku || "");
              setStock(String(prod.variants[0].stock_qty || "10"));
            } else {
              setSku(prod.sku || `VAST-${String(prod.id).slice(0, 6).toUpperCase()}`);
              setStock(String(prod.stock ?? prod.inventoryCount ?? "10"));
            }
          }
        } else if (cats.length > 0) {
          setCategoryId(String(cats[0].id));
        }
      } catch (err) {
        console.error("Failed to load product details:", err);
      } finally {
        setInitialLoading(false);
      }
    }
    loadData();
  }, [productId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !price) {
      alert("Please enter a product name and price");
      return;
    }

    setLoading(true);
    try {
      const p = parseFloat(price) || 0;
      const cp = comparePrice ? parseFloat(comparePrice) : p;
      
      const payload = {
        name: name.trim(),
        description: description.trim(),
        category_id: categoryId || (categories.length > 0 ? categories[0].id : "apparel"),
        price_selling: p,
        price_mrp: cp,
        is_published: isActive,
        is_featured: isFeatured,
        occasion: occasion || undefined,
        variants: [{ sku: sku || `SKU-${Date.now().toString().slice(-6)}`, size: "Standard", stock_qty: parseInt(stock || "10") }],
        images: uploadedImage ? [{ s3_url: uploadedImage, display_order: 0 }] : []
      };

      if (productId) {
        await productsApi.update(productId, payload);
      } else {
        await productsApi.create(payload);
      }
      
      router.push("/products");
    } catch (err: any) {
      console.error("Save error:", err);
      router.push("/products");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-accent mr-2" />
        <span>Loading garment details...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/products" className="hover:text-foreground transition-colors">Products</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">{productId ? "Edit Product" : "New Product"}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/products" 
            className="p-2 rounded-full bg-surface hover:bg-surface-hover text-muted-foreground hover:text-foreground border border-border transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {productId ? `Edit: ${name || "Product"}` : "Create New Product"}
            </h1>
            <p className="text-muted-foreground text-xs mt-0.5">
              Update haute couture pricing, imagery, variants, and collection classification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push("/products")}
            className="px-5 py-2 rounded-full bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-xs transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={loading || !name.trim() || !price}
            className="flex items-center gap-2 px-6 py-2 rounded-full bg-accent hover:bg-accent/90 text-white font-semibold text-xs transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {productId ? "Save Changes" : "Publish Product"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* LEFT COLUMN - 2/3 Width */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* General Information */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground">Garment Information</h2>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Product Title <span className="text-accent">*</span></label>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Silk Satin Trench Coat"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Description &amp; Editorial Details</label>
              <textarea 
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Handcrafted tailoring, premium silhouette..."
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
            </div>
          </div>

          {/* Pricing & Inventory */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground">Pricing &amp; Inventory</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Selling Price ($) <span className="text-accent">*</span></label>
                <input 
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="240.00"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Compare Price / MRP ($)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={comparePrice}
                  onChange={(e) => setComparePrice(e.target.value)}
                  placeholder="320.00"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">SKU (Stock Keeping Unit)</label>
                <input 
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="VAST-0092"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Stock Quantity</label>
                <input 
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="10"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          {/* Media & Photography */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground">Garment Imagery</h2>
            
            {uploadedImage ? (
              <div className="relative w-48 h-64 rounded-xl border border-border overflow-hidden bg-background group">
                <img src={uploadedImage} alt="Product" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setUploadedImage(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black text-white text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-accent rounded-xl p-8 text-center cursor-pointer transition-colors bg-background/50 hover:bg-surface-hover/30"
              >
                <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold text-foreground">Click to upload high-res imagery</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">JPEG, PNG, or WebP up to 10MB</p>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                  className="hidden" 
                />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - 1/3 Width */}
        <div className="space-y-6">
          {/* Category Classification */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground">Category Classification</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Collection Category</label>
                <div className="relative mt-1.5">
                  <select 
                    value={categoryId} 
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none appearance-none cursor-pointer"
                  >
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <List className="w-3 h-3 text-muted-foreground" />
                  Occasion
                </label>
                <div className="relative mt-1.5">
                  <select 
                    value={occasion} 
                    onChange={(e) => setOccasion(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Select Occasion (Optional)</option>
                    <option value="Wedding / Festive">Wedding / Festive</option>
                    <option value="Office / Work">Office / Work</option>
                    <option value="Casual / Everyday">Casual / Everyday</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Assigning a category indexes this garment into boutique filter collections.
            </p>
          </div>

          {/* Publishing Status & Badges */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground">Publishing &amp; Visibility</h2>
            
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <p className="text-xs font-semibold text-foreground">Published Status</p>
                <p className="text-[10px] text-muted-foreground">Visible on luxury storefront</p>
              </div>
              <input 
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded accent-accent cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-xs font-semibold text-foreground">Featured Piece</p>
                <p className="text-[10px] text-muted-foreground">Promote on hero banner and top reels</p>
              </div>
              <input 
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="w-4 h-4 rounded accent-accent cursor-pointer"
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function EditProductPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-accent mr-2" />
        <span>Loading...</span>
      </div>
    }>
      <EditProductForm />
    </Suspense>
  );
}
