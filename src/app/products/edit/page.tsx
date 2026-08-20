"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Home, ChevronRight, Plus, Sparkles, Image as ImageIcon, Send, Link, 
  Bold, Italic, Underline, List, AlignLeft, Type, Check, ChevronDown, Loader2
} from "lucide-react";
import { productsApi, categoriesApi } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function EditProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [comparePrice, setComparePrice] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    categoriesApi.list().then(data => {
      setCategories(data || []);
      if (data && data.length > 0) {
        setCategoryId(data[0].id);
      }
    });
  }, []);

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

  const handleCreate = async () => {
    if (!name || !price || !categoryId) {
      alert("Name, Price, and Category are required");
      return;
    }

    setLoading(true);
    try {
      const p = parseFloat(price);
      const cp = comparePrice ? parseFloat(comparePrice) : p;
      
      const payload = {
        name,
        description,
        category_id: categoryId,
        price_selling: p,
        price_mrp: cp,
        is_published: isActive,
        is_featured: isFeatured,
        variants: sku ? [{ sku, size: "Default", stock_qty: parseInt(stock || "0") }] : [],
        images: uploadedImage ? [{ s3_url: uploadedImage, display_order: 0 }] : []
      };

      await productsApi.create(payload);
      router.push("/products");
    } catch (err: any) {
      alert(err.message || "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors" onClick={() => router.push("/")}>Dashboard</span>
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors" onClick={() => router.push("/products")}>Products</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Edit Product</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Edit Product</h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push("/products")}
            className="px-5 py-2 rounded-full bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-full bg-accent hover:bg-accent/90 text-white font-medium text-sm transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* LEFT COLUMN - 2/3 Width */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* AI Media Area */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <div className="bg-[#111] rounded-lg aspect-video flex flex-col items-center justify-center border border-white/5 relative overflow-hidden group">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-8">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-4 mx-auto border border-white/10">
                  <Sparkles className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-white font-bold text-lg text-center mb-1">Ask for anything about this product</h3>
                <p className="text-muted-foreground text-xs text-center max-w-sm">Write the details, cut a background out, or photograph it on a model.</p>
              </div>

              <div className="absolute bottom-4 left-4 flex gap-2">
                {uploadedImage && (
                  <div className="w-12 h-12 rounded-lg border-2 border-accent bg-[#2a383d] flex items-center justify-center relative shadow-[0_0_10px_rgba(224,122,63,0.2)] overflow-hidden">
                    <img src={uploadedImage} alt="Thumbnail" className="w-full h-full object-cover" />
                  </div>
                )}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 rounded-lg border border-white/10 bg-black/40 hover:bg-white/5 flex flex-col items-center justify-center cursor-pointer transition-colors text-muted-foreground"
                >
                  <Plus className="w-4 h-4 mb-0.5" />
                  <span className="text-[9px] font-medium">Add</span>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              </div>
            </div>
          </div>

          {/* Basic Information Panel */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Basic Information</h2>
            </div>
            
            <div className="p-5 space-y-5">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Product Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter product name" 
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" 
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Description</label>
                <textarea 
                  rows={3} 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Enter product description" 
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50 resize-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-white">SKU</label>
                  <input 
                    type="text" 
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    placeholder="Enter SKU code" 
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - 1/3 Width */}
        <div className="space-y-6">
          
          {/* Pricing & Inventory */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
             <div className="p-4 border-b border-white/5">
              <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Pricing & Inventory</h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Price <span className="text-red-500">*</span></label>
                <input 
                  type="number" 
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0.00" 
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Compare at Price</label>
                <input 
                  type="number" 
                  value={comparePrice}
                  onChange={e => setComparePrice(e.target.value)}
                  placeholder="0.00" 
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Stock Quantity</label>
                <input 
                  type="number" 
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                  placeholder="0" 
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" 
                />
              </div>
            </div>
          </div>

          {/* Organization */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Organization</h2>
            </div>
            <div className="p-5 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Category <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select 
                    value={categoryId} 
                    onChange={e => setCategoryId(e.target.value)} 
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Select category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Settings</h2>
            </div>
            <div className="p-5 space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-lg bg-background border border-white/5 cursor-pointer group">
                <div className={`relative flex items-center justify-center w-5 h-5 rounded border mt-0.5 ${isActive ? 'bg-accent border-accent' : 'bg-transparent border-white/20'}`}>
                  {isActive && <Check className="w-3 h-3 text-white" />}
                  <input type="checkbox" className="hidden" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Active</p>
                  <p className="text-[10px] text-muted-foreground">Product will be visible in store</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-background border border-white/5 cursor-pointer group hover:bg-[#1a1a1a] transition-colors">
                <div className={`relative flex items-center justify-center w-5 h-5 rounded border mt-0.5 ${isFeatured ? 'bg-accent border-accent' : 'bg-transparent border-white/20'}`}>
                  {isFeatured && <Check className="w-3 h-3 text-white" />}
                  <input type="checkbox" className="hidden" checked={isFeatured} onChange={e => setIsFeatured(e.target.checked)} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Featured</p>
                  <p className="text-[10px] text-muted-foreground">Show on homepage featured section</p>
                </div>
              </label>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
