"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Home, ChevronRight, Plus, Package, Check, EyeOff, AlertTriangle, Star, 
  Search, ChevronDown, Filter, RotateCcw, Edit2, Trash2, Image as ImageIcon,
  AlertCircle, Loader2, Sparkles
} from "lucide-react";
import Link from "next/link";
import { productsApi, categoriesApi, CategoryItem } from "@/lib/api";

export default function ProductsPage() {
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFeatured, setSelectedFeatured] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        productsApi.list({ published_only: false }),
        categoriesApi.list()
      ]);
      
      if (prods && Array.isArray(prods)) {
        const catMap = new Map((cats || []).map((c: any) => [String(c.id), c.name]));
        const mapped = prods.map((p: any) => {
          let rawImg = p.image;
          if (!rawImg && p.images && p.images.length > 0) {
            rawImg = typeof p.images[0] === 'string' ? p.images[0] : p.images[0].s3_url;
          }
          if (!rawImg) {
            rawImg = "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=400&auto=format&fit=crop";
          }
          return {
            id: String(p.id),
            name: p.name || p.title || "Unnamed Piece",
            sku: p.sku || (p.variants?.[0]?.sku) || `PRD-${String(p.id).slice(0, 8)}`,
            category: catMap.get(String(p.category_id || p.categoryId)) || (cats && cats.length > 0 ? cats[0].name : "Apparel"),
            price: `$${typeof p.price_selling === 'number' ? p.price_selling.toFixed(2) : (typeof p.price === 'number' ? p.price.toFixed(2) : (p.price_selling || p.price || '0.00'))}`,
            originalPrice: p.price_mrp ? `$${Number(p.price_mrp).toFixed(2)}` : (p.originalPrice ? `$${Number(p.originalPrice).toFixed(2)}` : null),
            rawPrice: Number(p.price_selling || p.price || 0),
            stock: p.stock ?? p.inventoryCount ?? (p.variants?.[0]?.stock_qty) ?? 10,
            status: p.is_published === false ? "Draft" : (p.status || "Active"),
            isFeatured: Boolean(p.is_featured),
            categoryId: String(p.category_id || p.categoryId || ""),
            date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent",
            image: rawImg
          };
        });
        setProductsData(mapped);
      }
      setCategories(cats || []);
    } catch(err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedFeatured("");
    setSelectedStatus("");
    setCurrentPage(1);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    const targetId = productToDelete;
    setIsDeleting(true);
    setProductsData(prev => prev.filter(p => String(p.id) !== String(targetId)));
    setProductToDelete(null);
    try {
      await productsApi.delete(targetId);
    } catch (err) {
      console.warn("Delete request notice:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter products based on search & dropdowns
  const filteredProducts = useMemo(() => {
    return productsData.filter((p) => {
      const matchesSearch = !searchQuery.trim() || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !selectedCategory || p.categoryId === selectedCategory;
      
      const matchesFeatured = !selectedFeatured || 
        (selectedFeatured === "true" ? p.isFeatured : !p.isFeatured);
      
      const matchesStatus = !selectedStatus || 
        (selectedStatus === "active" ? p.status === "Active" : 
         selectedStatus === "draft" ? p.status === "Draft" : 
         selectedStatus === "out_of_stock" ? p.stock <= 0 : true);

      return matchesSearch && matchesCategory && matchesFeatured && matchesStatus;
    });
  }, [productsData, searchQuery, selectedCategory, selectedFeatured, selectedStatus]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const metrics = [
    { label: "Total Products", value: String(productsData.length), icon: Package, color: "text-accent", glow: "shadow-[-4px_0_15px_rgba(224,122,63,0.3)]", border: "border-l-accent" },
    { label: "Active", value: String(productsData.filter(p => p.status === "Active" || p.status === "Published").length), icon: Check, color: "text-emerald-500", glow: "shadow-[-4px_0_15px_rgba(16,185,129,0.2)]", border: "border-l-emerald-500" },
    { label: "Draft", value: String(productsData.filter(p => p.status === "Draft" || p.status === "Inactive").length), icon: EyeOff, color: "text-muted-foreground", glow: "shadow-[-4px_0_15px_rgba(161,161,170,0.1)]", border: "border-l-border" },
    { label: "Out of Stock", value: String(productsData.filter(p => p.stock <= 0).length), icon: AlertTriangle, color: "text-red-500", glow: "shadow-[-4px_0_15px_rgba(239,68,68,0.2)]", border: "border-l-red-500" },
    { label: "Featured", value: String(productsData.filter(p => p.isFeatured).length), icon: Star, color: "text-yellow-500", glow: "shadow-[-4px_0_15px_rgba(234,179,8,0.2)]", border: "border-l-yellow-500" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <Link href="/" className="cursor-pointer hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">All Products</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">All Products</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage store inventory, garment catalog, and live pricing</p>
        </div>
        <Link 
          href="/products/create" 
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-full transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Link>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
        {metrics.map((metric, i) => (
          <div 
            key={i} 
            className={`relative bg-surface border-y border-r border-border rounded-xl p-4 overflow-hidden border-l-[3px] ${metric.border} ${metric.glow} transition-all duration-300 hover:bg-surface-hover`}
          >
            <div 
              className="absolute inset-0 opacity-10 pointer-events-none" 
              style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "16px 16px" }} 
            />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex items-center justify-between gap-2">
                <div className={`w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center ${metric.color}`}>
                  <metric.icon className="w-4 h-4" />
                </div>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${metric.color}`}>{metric.label}</span>
              </div>
              <div className="mt-4 flex items-end justify-between">
                {loading ? (
                  <div className="h-8 w-12 bg-surface-hover/80 rounded animate-pulse" />
                ) : (
                  <span className="text-3xl font-bold text-foreground">{metric.value}</span>
                )}
                <metric.icon className={`w-12 h-12 opacity-5 absolute -bottom-2 -right-2 ${metric.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Section */}
      <div className="bg-surface border border-border rounded-xl p-5 mt-6 space-y-4">
        <div className="flex flex-col lg:flex-row items-end gap-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 w-full">
            {/* Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Search</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Search by name, SKU..." 
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            {/* Category Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Category</label>
              <div className="relative">
                <select 
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer"
                >
                  <option value="">All Categories ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Featured */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Featured</label>
              <div className="relative">
                <select 
                  value={selectedFeatured}
                  onChange={(e) => { setSelectedFeatured(e.target.value); setCurrentPage(1); }}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer"
                >
                  <option value="">Any</option>
                  <option value="true">Featured Look</option>
                  <option value="false">Standard Catalog</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Status</label>
              <div className="relative">
                <select 
                  value={selectedStatus}
                  onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer"
                >
                  <option value="">Select Status</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0 mt-4 lg:mt-0 w-full lg:w-auto">
            <button 
              onClick={handleResetFilters}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm rounded-lg transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
              Reset
            </button>
          </div>
          
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-surface border border-border rounded-xl mt-6">
        <div className="overflow-x-auto min-h-[320px] pb-24 overflow-y-visible">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/50 border-b border-border">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date Added</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-accent" />
                      <span>Loading products from database...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm font-semibold text-foreground">No products found</p>
                      <p className="text-xs text-muted-foreground mt-1">Try adjusting your search criteria or add a new piece to the catalog.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-surface-hover/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        {/* Garment Image */}
                        <div className="w-12 h-12 rounded-lg bg-surface border border-border overflow-hidden shrink-0">
                          <img 
                            src={product.image} 
                            alt={product.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=400&auto=format&fit=crop";
                            }}
                          />
                        </div>
                        <div>
                          <p className="font-bold text-foreground hover:text-accent cursor-pointer transition-colors">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">{product.category}</span>
                            {product.isFeatured && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-accent/10 border border-accent/20 text-accent">
                                Featured
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">{product.price}</span>
                        {product.originalPrice && (
                          <span className="text-xs text-muted-foreground line-through">
                            {product.originalPrice}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                      {product.stock} in stock
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold border inline-block min-w-[60px] text-center ${
                        product.status === 'Active' 
                          ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' 
                          : 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10'
                      }`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-muted-foreground">
                      {product.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right relative">
                      <div className="relative inline-block text-left">
                        <button 
                          onClick={() => setOpenActionId(openActionId === product.id ? null : product.id)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-background border border-border hover:bg-surface-hover text-xs font-medium text-foreground transition-colors ml-auto"
                        >
                          Actions
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        </button>
                        
                        {/* Action Dropdown */}
                        {openActionId === product.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenActionId(null)} />
                            <div className="absolute right-0 top-full mt-1.5 w-40 bg-background border border-border rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                              <Link 
                                href={`/products/edit?id=${product.id}`}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface-hover hover:text-accent transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-muted-foreground" /> Edit Product
                              </Link>
                              <Link 
                                href={`/storefront/product/${product.id}/tryon`} 
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface-hover hover:text-accent transition-colors"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-accent" /> Try-On
                              </Link>
                              <div className="h-px bg-border/40 my-1" />
                              <button 
                                onClick={() => {
                                  setProductToDelete(product.id);
                                  setOpenActionId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls — Visible when total rows override page size */}
      {filteredProducts.length > pageSize && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-bold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-foreground">{Math.min(currentPage * pageSize, filteredProducts.length)}</span> of <span className="font-bold text-foreground">{filteredProducts.length}</span> items
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-surface-hover text-xs font-medium text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button 
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                    currentPage === pageNum 
                      ? 'bg-accent text-white shadow-[0_0_8px_rgba(224,122,63,0.4)]' 
                      : 'border border-border bg-background hover:bg-surface-hover text-foreground'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-surface-hover text-xs font-medium text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {productToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isDeleting && setProductToDelete(null)}
          />
          <div className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full border border-accent/40 bg-accent/10 flex items-center justify-center mb-4 text-accent">
              <AlertCircle className="w-7 h-7" />
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2">Delete this product?</h2>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              This product will be permanently deleted from your catalog and database.
            </p>
            
            <div className="flex items-center gap-3 w-full justify-center">
              <button 
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete Product
              </button>
              <button 
                onClick={() => setProductToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-background border border-border hover:bg-surface-hover text-foreground text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
