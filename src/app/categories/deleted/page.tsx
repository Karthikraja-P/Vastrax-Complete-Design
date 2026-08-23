"use client";

import React, { useState, useMemo } from "react";
import { 
  Home, ChevronRight, Search, ChevronDown, Filter, RotateCcw,
  RotateCw, Trash2, AlertCircle, Loader2, ArrowLeft, Boxes, LayoutGrid
} from "lucide-react";
import Link from "next/link";
import { categoriesApi } from "@/lib/api";

export default function DeletedCategoriesPage() {
  // Mock initial soft-deleted categories or load from state
  const [deletedCategories, setDeletedCategories] = useState<any[]>([
    {
      id: "del-cat-1",
      name: "Vintage Footwear",
      slug: "vintage-footwear",
      desc: "Archived retro footwear collection",
      products: 0,
      deletedAt: "2 days ago",
      originalStatus: "Inactive"
    },
    {
      id: "del-cat-2",
      name: "Spring Scarves 2025",
      slug: "spring-scarves-2025",
      desc: "Seasonal limited scarves line",
      products: 2,
      deletedAt: "1 week ago",
      originalStatus: "Active"
    }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("default");
  const [categoryToRestore, setCategoryToRestore] = useState<any | null>(null);
  const [categoryToPurge, setCategoryToPurge] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const handleResetFilters = () => {
    setSearchQuery("");
    setSortOrder("default");
    setCurrentPage(1);
  };

  const handleRestore = async (cat: any) => {
    setIsProcessing(true);
    try {
      // Recreate or reactivate category via API
      await categoriesApi.create({ name: cat.name, slug: cat.slug });
      setDeletedCategories(prev => prev.filter(c => c.id !== cat.id));
      setCategoryToRestore(null);
      setFeedbackToast(`Category "${cat.name}" has been restored to the active catalog.`);
      setTimeout(() => setFeedbackToast(null), 4000);
    } catch (err) {
      console.error("Restore failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async (cat: any) => {
    setIsProcessing(true);
    try {
      setDeletedCategories(prev => prev.filter(c => c.id !== cat.id));
      setCategoryToPurge(null);
      setFeedbackToast(`Category "${cat.name}" was permanently deleted.`);
      setTimeout(() => setFeedbackToast(null), 4000);
    } catch (err) {
      console.error("Purge failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter & Sort Logic
  const filteredCategories = useMemo(() => {
    let result = deletedCategories.filter((cat) => {
      const matchesSearch = !searchQuery.trim() || 
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.slug.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });

    if (sortOrder === "asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === "desc") {
      result.sort((a, b) => b.name.localeCompare(a.name));
    }

    return result;
  }, [deletedCategories, searchQuery, sortOrder]);

  const totalPages = Math.ceil(filteredCategories.length / pageSize);
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCategories.slice(start, start + pageSize);
  }, [filteredCategories, currentPage, pageSize]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed top-6 right-6 z-50 bg-accent text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <span>✓</span>
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <Link href="/" className="cursor-pointer hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/categories" className="cursor-pointer hover:text-foreground transition-colors">Categories</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Trash &amp; Deleted</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link 
              href="/categories" 
              className="p-1.5 rounded-full bg-surface-hover hover:bg-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Deleted Categories</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">Review soft-deleted categories, restore accidental deletions, or purge permanently</p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-surface border border-border rounded-xl p-5 mt-6 space-y-4">
        <div className="flex flex-col lg:flex-row items-end gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full">
            {/* Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Search in Trash</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Search deleted collections..." 
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            {/* Sort Order */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Sort Order</label>
              <div className="relative">
                <select 
                  value={sortOrder}
                  onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer"
                >
                  <option value="default">Recently Deleted</option>
                  <option value="asc">Name (A-Z)</option>
                  <option value="desc">Name (Z-A)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Reset Action */}
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
      <div className="bg-surface border border-border rounded-xl overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/50 border-b border-border">
              <tr>
                <th className="px-6 py-4">Deleted Category</th>
                <th className="px-6 py-4">Slug</th>
                <th className="px-6 py-4">Products Linked</th>
                <th className="px-6 py-4">Deleted Timeline</th>
                <th className="px-6 py-4 text-right">Restore / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-surface-hover border border-border flex items-center justify-center mb-3 text-muted-foreground">
                        <Trash2 className="w-5 h-5 opacity-60" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Trash is empty</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">No deleted categories found. Active categories moved to trash will appear here for recovery.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-surface-hover/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-surface-hover border border-border flex items-center justify-center text-muted-foreground overflow-hidden">
                          <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">{cat.name}</span>
                          <span className="text-[11px] text-muted-foreground mt-0.5">{cat.desc}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-muted-foreground">
                      /{cat.slug}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                      {cat.products} products
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-muted-foreground">
                      {cat.deletedAt}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Restore Button */}
                        <button
                          onClick={() => setCategoryToRestore(cat)}
                          title="Restore to Active Catalog"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-500 text-xs font-bold transition-colors"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          Restore
                        </button>
                        
                        {/* Permanent Delete */}
                        <button
                          onClick={() => setCategoryToPurge(cat)}
                          title="Delete Permanently"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 text-xs font-semibold transition-colors"
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

      {/* Pagination Controls — Visible when total rows override page size */}
      {filteredCategories.length > pageSize && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-bold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-foreground">{Math.min(currentPage * pageSize, filteredCategories.length)}</span> of <span className="font-bold text-foreground">{filteredCategories.length}</span> items
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
      {categoryToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isProcessing && setCategoryToRestore(null)} />
          <div className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-500 mx-auto">
              <RotateCw className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Restore &ldquo;{categoryToRestore.name}&rdquo;?</h2>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              This will re-publish this category back to your active store catalog and navigation menus.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleRestore(categoryToRestore)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Restore
              </button>
              <button
                onClick={() => setCategoryToRestore(null)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Purge Modal */}
      {categoryToPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isProcessing && setCategoryToPurge(null)} />
          <div className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 rounded-full border border-red-500/30 bg-red-500/10 flex items-center justify-center mb-4 text-red-500 mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Permanently Purge &ldquo;{categoryToPurge.name}&rdquo;?</h2>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              This will permanently delete this category record from the database. This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handlePermanentDelete(categoryToPurge)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Purge Permanently
              </button>
              <button
                onClick={() => setCategoryToPurge(null)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-xs transition-colors"
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
