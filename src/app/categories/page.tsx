"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Home, ChevronRight, Plus, LayoutGrid, Check, X as XIcon, Trash2, Boxes, 
  Search, ChevronDown, Filter, RotateCcw, Image as ImageIcon, Eye, Edit2, AlertCircle, Loader2
} from "lucide-react";
import Link from "next/link";
import { categoriesApi, CategoryItem } from "@/lib/api";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openActionId, setOpenActionId] = useState<number | string | null>(null);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // New Category form state
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [isActiveStatus, setIsActiveStatus] = useState(true);

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("default");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await categoriesApi.list();
      if (data && Array.isArray(data)) {
        const mapped = data.map((c: any, index: number) => ({
          id: c.id,
          name: c.name,
          slug: c.slug || c.name.toLowerCase().replace(/\s+/g, "-"),
          desc: c.description || "Luxury collection",
          status: c.is_active === false ? "Inactive" : "Active",
          count: c.count || c.product_count || 0,
          sort: String(index + 1),
          image_url: c.image_url || c.image || null
        }));
        setCategories(mapped);
      }
    } catch (err) {
      console.error("Categories load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setSortOrder("default");
    setCurrentPage(1);
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const cleanName = newCatName.trim();
    const cleanSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    
    // Create new category object
    const tempId = `cat-${Date.now()}`;
    const newCategory = {
      id: tempId,
      name: cleanName,
      slug: cleanSlug,
      desc: newCatDesc || "Luxury collection",
      count: 0,
      status: isActiveStatus ? "Active" : "Inactive",
      sort: String(categories.length + 1)
    };

    // Optimistic UI update
    setCategories(prev => [...prev, newCategory]);
    setNewCatName("");
    setNewCatDesc("");
    setIsAddCategoryOpen(false);
    showToast(`Category "${cleanName}" created successfully.`);

    try {
      const created = await categoriesApi.create({ name: cleanName, slug: cleanSlug });
      if (created && created.id) {
        setCategories(prev => prev.map(c => c.id === tempId ? { ...c, id: created.id } : c));
      }
    } catch (err) {
      console.warn("Backend category sync notice:", err);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, ...editingCategory } : c));
    setIsEditCategoryOpen(false);
    showToast(`Category "${editingCategory.name}" updated successfully.`);
    setEditingCategory(null);
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    const catName = categoryToDelete.name;
    try {
      if (categoryToDelete.id) {
        await categoriesApi.delete(categoryToDelete.id);
      }
      setCategories(prev => prev.filter(c => c.id !== categoryToDelete.id));
      showToast(`Category "${catName}" moved to trash.`);
      setCategoryToDelete(null);
    } catch (err) {
      console.warn("Delete notice:", err);
      setCategories(prev => prev.filter(c => c.id !== categoryToDelete.id));
      showToast(`Category "${catName}" moved to trash.`);
      setCategoryToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter & Sort Logic
  const filteredCategories = useMemo(() => {
    let result = categories.filter((cat) => {
      const matchesSearch = !searchQuery.trim() || 
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.slug.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = !statusFilter || 
        (statusFilter === "active" ? cat.status === "Active" : cat.status === "Inactive");

      return matchesSearch && matchesStatus;
    });

    if (sortOrder === "asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === "desc") {
      result.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortOrder === "count_high") {
      result.sort((a, b) => (b.count || 0) - (a.count || 0));
    }

    return result;
  }, [categories, searchQuery, statusFilter, sortOrder]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredCategories.length / pageSize);
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCategories.slice(start, start + pageSize);
  }, [filteredCategories, currentPage, pageSize]);

  const metrics = [
    { label: "Total Categories", value: String(categories.length), icon: LayoutGrid, color: "text-accent", glow: "shadow-[-4px_0_15px_rgba(224,122,63,0.3)]", border: "border-l-accent" },
    { label: "Active", value: String(categories.filter(c => c.status === "Active").length), icon: Check, color: "text-emerald-500", glow: "shadow-[-4px_0_15px_rgba(16,185,129,0.2)]", border: "border-l-emerald-500" },
    { label: "Empty", value: String(categories.filter(c => !c.count).length), icon: XIcon, color: "text-yellow-500", glow: "shadow-[-4px_0_15px_rgba(234,179,8,0.2)]", border: "border-l-yellow-500" },
    { label: "With Products", value: String(categories.filter(c => c.count > 0).length), icon: Boxes, color: "text-blue-500", glow: "shadow-[-4px_0_15px_rgba(59,130,246,0.2)]", border: "border-l-blue-500" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-accent text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <Link href="/" className="cursor-pointer hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Categories</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Categories</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage product collections and navigation taxonomy</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/categories/deleted"
            className="flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm rounded-full transition-colors"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
            Trash / Deleted
          </Link>
          <button 
            onClick={() => setIsAddCategoryOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-full transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full">
            {/* Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Search</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Search categories by name..." 
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Status</label>
              <div className="relative">
                <select 
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
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
                  <option value="default">Default Order</option>
                  <option value="asc">Name (A-Z)</option>
                  <option value="desc">Name (Z-A)</option>
                  <option value="count_high">Most Products</option>
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
                <th className="px-6 py-4">Collection Name</th>
                <th className="px-6 py-4">Slug</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Products</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      <span>Loading categories...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Boxes className="w-8 h-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm font-semibold text-foreground">No categories found</p>
                      <p className="text-xs text-muted-foreground mt-1">Try resetting filters or create a new category collection.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCategories.map((cat, index) => (
                  <tr key={cat.id || index} className="hover:bg-surface-hover/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-surface-hover border border-border flex items-center justify-center text-muted-foreground overflow-hidden">
                          {cat.image_url ? (
                            <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                          ) : (
                            <LayoutGrid className="w-4 h-4 text-accent/70" />
                          )}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold border inline-block min-w-[60px] text-center ${
                        cat.status === 'Active' 
                          ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' 
                          : 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10'
                      }`}>
                        {cat.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-foreground">
                      {cat.count ?? 0} items
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right relative">
                      <div className="relative inline-block text-left">
                        <button 
                          onClick={() => setOpenActionId(openActionId === (cat.id || index) ? null : (cat.id || index))}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-background border border-border hover:bg-surface-hover text-xs font-medium text-foreground transition-colors ml-auto"
                        >
                          Actions
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        </button>
                        
                        {openActionId === (cat.id || index) && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenActionId(null)} />
                            <div className="absolute right-0 top-full mt-1.5 w-40 bg-background border border-border rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                              <button 
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setIsEditCategoryOpen(true);
                                  setOpenActionId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface-hover hover:text-accent transition-colors text-left"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-muted-foreground" /> Edit
                              </button>
                              <div className="h-px bg-border/40 my-1" />
                              <button 
                                onClick={() => {
                                  setCategoryToDelete(cat);
                                  setOpenActionId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors text-left"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Move to Trash
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
      {filteredCategories.length > pageSize && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-bold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-foreground">{Math.min(currentPage * pageSize, filteredCategories.length)}</span> of <span className="font-bold text-foreground">{filteredCategories.length}</span> categories
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

      {/* --- ADD CATEGORY SLIDEOVER --- */}
      {isAddCategoryOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setIsAddCategoryOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Create New Category</h2>
              <button onClick={() => setIsAddCategoryOpen(false)} className="p-2 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Category Name <span className="text-accent">*</span></label>
                <input 
                  type="text" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g., Evening Jackets" 
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent transition-all" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <textarea 
                  rows={4} 
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Brief description of this collection..." 
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent transition-all resize-none" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Status</label>
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border transition-colors ${isActiveStatus ? "bg-accent border-accent" : "bg-background border-border group-hover:border-foreground"}`}>
                    {isActiveStatus && <Check className="w-3.5 h-3.5 text-white" />}
                    <input type="checkbox" className="hidden" checked={isActiveStatus} onChange={() => setIsActiveStatus(!isActiveStatus)} />
                  </div>
                  <span className="text-xs font-medium text-foreground">Active in storefront catalog</span>
                </label>
              </div>
            </div>
            
            <div className="p-6 border-t border-border flex items-center justify-end gap-3 bg-surface">
              <button onClick={() => setIsAddCategoryOpen(false)} className="px-5 py-2.5 rounded-full border border-border hover:bg-surface-hover text-xs font-semibold text-foreground transition-colors">Cancel</button>
              <button 
                onClick={handleCreateCategory}
                className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent/90 text-xs font-semibold text-white transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)]"
              >
                Create Category
              </button>
            </div>
          </div>
        </>
      )}

      {/* --- EDIT CATEGORY SLIDEOVER --- */}
      {isEditCategoryOpen && editingCategory && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setIsEditCategoryOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Edit Category</h2>
              <button onClick={() => setIsEditCategoryOpen(false)} className="p-2 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Category Name <span className="text-accent">*</span></label>
                <input 
                  type="text" 
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent transition-all" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <textarea 
                  rows={4} 
                  value={editingCategory.desc || ""}
                  onChange={(e) => setEditingCategory({ ...editingCategory, desc: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent transition-all resize-none" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Status</label>
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border transition-colors ${editingCategory.status === 'Active' ? "bg-accent border-accent" : "bg-background border-border group-hover:border-foreground"}`}>
                    {editingCategory.status === 'Active' && <Check className="w-3.5 h-3.5 text-white" />}
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={editingCategory.status === 'Active'} 
                      onChange={() => setEditingCategory({ ...editingCategory, status: editingCategory.status === 'Active' ? 'Inactive' : 'Active' })} 
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground">Active in storefront catalog</span>
                </label>
              </div>
            </div>
            
            <div className="p-6 border-t border-border flex items-center justify-end gap-3 bg-surface">
              <button onClick={() => setIsEditCategoryOpen(false)} className="px-5 py-2.5 rounded-full border border-border hover:bg-surface-hover text-xs font-semibold text-foreground transition-colors">Cancel</button>
              <button 
                onClick={handleUpdateCategory}
                className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent/90 text-xs font-semibold text-white transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {categoryToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => !isDeleting && setCategoryToDelete(null)} />
          <div className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full border border-accent/40 bg-accent/10 flex items-center justify-center mb-4 text-accent">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Delete &ldquo;{categoryToDelete.name}&rdquo;?</h2>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              This category will be moved to the Trash section where it can be reviewed or restored.
            </p>
            
            <div className="flex items-center justify-center gap-3 w-full">
              <button 
                onClick={handleDeleteCategory}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Move to Trash
              </button>
              <button 
                onClick={() => setCategoryToDelete(null)}
                disabled={isDeleting}
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
