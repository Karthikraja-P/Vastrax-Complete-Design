"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Home, ChevronRight, Search, ChevronDown, Filter, RotateCcw,
  RotateCw, Trash2, AlertCircle, Loader2, ArrowLeft, Package, Sparkles
} from "lucide-react";
import Link from "next/link";
import { productsApi } from "@/lib/api";

const DELETED_PRODUCTS_KEY = "vastrax_deleted_products";

export default function DeletedProductsPage() {
  const [deletedProducts, setDeletedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("default");
  const [productToRestore, setProductToRestore] = useState<any | null>(null);
  const [productToPurge, setProductToPurge] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Load deleted products from persistent local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DELETED_PRODUCTS_KEY);
      if (stored) {
        setDeletedProducts(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed to load deleted products:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveDeletedProducts = (items: any[]) => {
    setDeletedProducts(items);
    try {
      localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to save deleted products:", e);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSortOrder("default");
    setCurrentPage(1);
  };

  const handleRestore = async (prod: any) => {
    setIsProcessing(true);
    try {
      // Recreate product in active database catalog
      const payload = {
        name: prod.name,
        description: prod.description || "Restored couture piece",
        category_id: prod.categoryId || prod.category_id || "cat-dresses",
        price_selling: prod.rawPrice || parseFloat(String(prod.price).replace(/[^0-9.]/g, "")) || 100,
        price_mrp: prod.originalPrice ? parseFloat(String(prod.originalPrice).replace(/[^0-9.]/g, "")) : undefined,
        is_published: true,
        is_featured: Boolean(prod.isFeatured),
        variants: [{ sku: prod.sku || `SKU-${Date.now().toString().slice(-6)}`, size: "Standard", stock_qty: prod.stock || 10 }],
        images: prod.image ? [{ s3_url: prod.image, display_order: 0 }] : []
      };

      await productsApi.create(payload);
      const updated = deletedProducts.filter(p => p.id !== prod.id);
      saveDeletedProducts(updated);
      setProductToRestore(null);
      setFeedbackToast(`Product "${prod.name}" has been restored to the active catalog.`);
      setTimeout(() => setFeedbackToast(null), 4000);
    } catch (err: any) {
      console.error("Restore failed:", err);
      alert(`Restore error: ${err?.message || "Failed to restore product"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async (prod: any) => {
    setIsProcessing(true);
    try {
      // Ensure backend permanently deletes if record still exists
      await productsApi.delete(prod.id).catch(() => null);
      const updated = deletedProducts.filter(p => p.id !== prod.id);
      saveDeletedProducts(updated);
      setProductToPurge(null);
      setFeedbackToast(`Product "${prod.name}" was permanently deleted.`);
      setTimeout(() => setFeedbackToast(null), 4000);
    } catch (err: any) {
      console.error("Purge failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    let result = deletedProducts.filter((prod) => {
      const matchesSearch = !searchQuery.trim() || 
        (prod.name && prod.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (prod.sku && prod.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (prod.category && prod.category.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    });

    if (sortOrder === "asc") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortOrder === "desc") {
      result.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    }

    return result;
  }, [deletedProducts, searchQuery, sortOrder]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div className="fixed top-6 right-6 z-50 bg-surface border border-accent/40 text-foreground px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-3">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-semibold">{feedbackToast}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <Link href="/" className="cursor-pointer hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/products" className="cursor-pointer hover:text-foreground transition-colors">Products</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Deleted Products</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link 
              href="/products" 
              className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Deleted Products</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm pl-11">Review, restore, or permanently purge deleted pieces from the catalog</p>
        </div>
        <Link 
          href="/products" 
          className="flex items-center gap-2 px-5 py-2.5 bg-surface hover:bg-surface-hover border border-border text-foreground font-medium text-sm rounded-full transition-colors shrink-0"
        >
          <Package className="w-4 h-4 text-accent" />
          Back to Active Products
        </Link>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div className="relative bg-surface border-y border-r border-border rounded-xl p-4 overflow-hidden border-l-[3px] border-l-red-500 shadow-[-4px_0_15px_rgba(239,68,68,0.2)] transition-all duration-300">
          <div className="flex items-center justify-between gap-2">
            <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-red-500">
              <Trash2 className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-500">In Trash</span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-3xl font-bold text-foreground">{deletedProducts.length}</span>
            <Trash2 className="w-12 h-12 opacity-5 absolute -bottom-2 -right-2 text-red-500" />
          </div>
        </div>

        <div className="relative bg-surface border-y border-r border-border rounded-xl p-4 overflow-hidden border-l-[3px] border-l-accent shadow-[-4px_0_15px_rgba(224,122,63,0.3)] transition-all duration-300">
          <div className="flex items-center justify-between gap-2">
            <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-accent">
              <RotateCw className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent">Restorable</span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-3xl font-bold text-foreground">{deletedProducts.length}</span>
            <RotateCw className="w-12 h-12 opacity-5 absolute -bottom-2 -right-2 text-accent" />
          </div>
        </div>

        <div className="relative bg-surface border-y border-r border-border rounded-xl p-4 overflow-hidden border-l-[3px] border-l-border transition-all duration-300">
          <div className="flex items-center justify-between gap-2">
            <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground">
              <Package className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Retention Policy</span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-xs text-muted-foreground">Items are archived for 30 days before automatic purge</span>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-surface border border-border rounded-xl p-5 mt-6 space-y-4">
        <div className="flex flex-col lg:flex-row items-end gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full">
            {/* Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Search Deleted</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Search by product name, SKU, category..." 
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            {/* Sort Order */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Sort By</label>
              <div className="relative">
                <select 
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer"
                >
                  <option value="default">Default (Recent First)</option>
                  <option value="asc">Name (A - Z)</option>
                  <option value="desc">Name (Z - A)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <button 
            onClick={handleResetFilters}
            className="flex items-center justify-center gap-2 px-5 py-2 bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm rounded-lg transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
            Reset
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-background/50 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border font-bold">
              <tr>
                <th className="px-6 py-4">Product Info</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Deleted Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-10 w-44 bg-surface-hover rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-20 bg-surface-hover rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-surface-hover rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 bg-surface-hover rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-20 bg-surface-hover rounded" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-8 w-24 bg-surface-hover rounded ml-auto" /></td>
                  </tr>
                ))
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center mb-3 text-muted-foreground/60">
                        <Trash2 className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-foreground">No Deleted Products Found</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                        {searchQuery ? "No items matching your search criteria." : "Products removed from the active catalog will appear here for 30 days."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((prod) => (
                  <tr key={prod.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-background border border-border shrink-0 flex items-center justify-center">
                          {prod.image ? (
                            <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{prod.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{prod.description || "Archived product"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {prod.sku || `PRD-${String(prod.id).slice(0, 8)}`}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface border border-border text-foreground">
                        {prod.category || "Apparel"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-foreground">
                      {prod.price || "$0.00"}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {prod.deletedAt || "Recently"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setProductToRestore(prod)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/10 hover:bg-accent hover:text-white text-accent text-xs font-semibold transition-all"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          Restore
                        </button>
                        <button 
                          onClick={() => setProductToPurge(prod)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 text-xs font-semibold transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Purge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
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

      {/* Restore Confirmation Modal */}
      {productToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isProcessing && setProductToRestore(null)}
          />
          <div className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full border border-accent/40 bg-accent/10 flex items-center justify-center mb-4 text-accent">
              <RotateCw className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Restore this product?</h2>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Product <span className="font-semibold text-foreground">"{productToRestore.name}"</span> will be restored to your active catalog and storefront immediately.
            </p>
            <div className="flex items-center gap-3 w-full justify-center">
              <button 
                onClick={() => handleRestore(productToRestore)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(224,122,63,0.3)]"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Restore
              </button>
              <button 
                onClick={() => setProductToRestore(null)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-background border border-border hover:bg-surface-hover text-foreground text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Purge Confirmation Modal */}
      {productToPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isProcessing && setProductToPurge(null)}
          />
          <div className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full border border-red-500/40 bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Permanently purge product?</h2>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Product <span className="font-semibold text-foreground">"{productToPurge.name}"</span> will be permanently deleted from archive history. This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 w-full justify-center">
              <button 
                onClick={() => handlePermanentDelete(productToPurge)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Permanently Delete
              </button>
              <button 
                onClick={() => setProductToPurge(null)}
                disabled={isProcessing}
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
