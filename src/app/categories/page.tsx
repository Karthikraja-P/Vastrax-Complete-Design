"use client";

import React, { useState } from "react";
import { 
  Home, ChevronRight, Plus, LayoutGrid, Check, X as XIcon, Trash2, Boxes, 
  Search, ChevronDown, Filter, RotateCcw, Image as ImageIcon, Eye, Edit2, AlertCircle
} from "lucide-react";

const categoriesData = [
  { name: "T-Shirts", desc: "Everyday tees in soft cotton — from clean...", status: "Active", products: "5", sort: "1" },
  { name: "Hoodies & Sweatshirts", desc: "Heavyweight fleece, zip-ups and pullovers...", status: "Active", products: "5", sort: "2" },
  { name: "Jackets & Outerwear", desc: "Leather, denim, wool — outerwear pieces ...", status: "Active", products: "5", sort: "3" },
  { name: "Pants & Trousers", desc: "Denim, chinos, cargos, joggers and tailore...", status: "Active", products: "5", sort: "4" },
  { name: "Shirts", desc: "Oxfords, flannels, linen and henleys — wo...", status: "Active", products: "5", sort: "5" },
  { name: "Shoes & Sneakers", desc: "Low-tops, high-tops, leather boots and ru...", status: "Active", products: "5", sort: "6" },
  { name: "Hats", desc: "Caps, beanies and brims in colours worth ...", status: "Active", products: "5", sort: "7" },
];

const metrics = [
  { label: "Total Categories", value: "7", icon: LayoutGrid, color: "text-accent", glow: "shadow-[-4px_0_15px_rgba(224,122,63,0.3)]", border: "border-l-accent" },
  { label: "Active", value: "7", icon: Check, color: "text-emerald-500", glow: "shadow-[-4px_0_15px_rgba(16,185,129,0.2)]", border: "border-l-emerald-500" },
  { label: "Inactive", value: "0", icon: XIcon, color: "text-yellow-500", glow: "shadow-[-4px_0_15px_rgba(234,179,8,0.2)]", border: "border-l-yellow-500" },
  { label: "Deleted", value: "0", icon: Trash2, color: "text-red-500", glow: "shadow-[-4px_0_15px_rgba(239,68,68,0.2)]", border: "border-l-red-500" },
  { label: "With Products", value: "7", icon: Boxes, color: "text-blue-500", glow: "shadow-[-4px_0_15px_rgba(59,130,246,0.2)]", border: "border-l-blue-500" },
];

export default function CategoriesPage() {
  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);
  const [isActiveStatus, setIsActiveStatus] = useState(true);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors">Dashboard</span>
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors">Categories</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">All</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Categories</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage product categories and subcategories</p>
        </div>
        <button 
          onClick={() => setIsAddCategoryOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-full transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
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
                <span className="text-3xl font-bold text-foreground">{metric.value}</span>
                <metric.icon className={`w-12 h-12 opacity-5 absolute -bottom-2 -right-2 ${metric.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Section */}
      <div className="bg-surface border border-border rounded-xl p-5 mt-6 space-y-4">
        <div className="flex flex-col lg:flex-row items-end gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 w-full">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Search categories...</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search categories..." 
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Status</label>
              <div className="relative">
                <select defaultValue="" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-muted-foreground appearance-none cursor-pointer">
                  <option value="" disabled>Any status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Parent</label>
              <div className="relative">
                <select defaultValue="" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-muted-foreground appearance-none cursor-pointer">
                  <option value="" disabled>All parents</option>
                  <option value="clothing">Clothing</option>
                  <option value="accessories">Accessories</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Sort Order</label>
              <div className="relative">
                <select defaultValue="default" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-muted-foreground appearance-none cursor-pointer">
                  <option value="default">Default</option>
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 mt-4 lg:mt-0 w-full lg:w-auto">
            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-lg transition-colors shadow-[0_0_10px_rgba(224,122,63,0.3)]">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm rounded-lg transition-colors whitespace-nowrap">
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-surface border border-border rounded-xl overflow-visible mt-6 pb-32">
        <div className="overflow-visible">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/50 border-b border-border">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Products</th>
                <th className="px-6 py-4">Sort Order</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categoriesData.map((cat, index) => (
                <tr key={index} className="hover:bg-surface-hover transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground overflow-hidden shadow-inner">
                        <ImageIcon className="w-4 h-4 opacity-50" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">{cat.name}</span>
                        <span className="text-[11px] text-muted-foreground mt-0.5">{cat.desc}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold border inline-block min-w-[60px] text-center border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                      {cat.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-foreground">
                    {cat.products}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-muted-foreground">
                    {cat.sort}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap relative">
                    <button 
                      onClick={() => setOpenActionId(openActionId === index ? null : index)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-background border border-border hover:bg-border/50 text-xs font-medium text-foreground transition-colors"
                    >
                      Actions
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </button>
                    
                    {openActionId === index && (
                      <div className="absolute top-full left-6 z-50 w-36 mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="py-1">
                          <button 
                            onClick={() => {
                              setIsEditCategoryOpen(true);
                              setOpenActionId(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors rounded-t-lg"
                          >
                            <Edit2 className="w-4 h-4 text-muted-foreground" /> Edit
                          </button>
                          <button 
                            onClick={() => {
                              setCategoryToDelete(index);
                              setOpenActionId(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors rounded-b-lg"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD CATEGORY SLIDEOVER --- */}
      {isAddCategoryOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setIsAddCategoryOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#1a1a1a] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-white/5">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white">Create New Category</h2>
              <button onClick={() => setIsAddCategoryOpen(false)} className="p-2 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter category name" className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent transition-all" />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Icon</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 text-white font-medium text-xs transition-colors">
                    <ImageIcon className="w-3.5 h-3.5" /> Upload Icon
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Description</label>
                <textarea rows={4} placeholder="Enter description" className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent transition-all resize-none" />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Sort Order</label>
                <input type="text" defaultValue="0" className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent transition-all" />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Active Status</label>
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border transition-colors ${isActiveStatus ? "bg-accent border-accent" : "bg-black/40 border-white/20 group-hover:border-white/40"}`}>
                    {isActiveStatus && <Check className="w-3.5 h-3.5 text-white" />}
                    <input type="checkbox" className="hidden" checked={isActiveStatus} onChange={() => setIsActiveStatus(!isActiveStatus)} />
                  </div>
                  <span className="text-sm text-white/80">Category will be visible when active</span>
                </label>
              </div>

            </div>
            
            <div className="p-6 border-t border-white/5 flex items-center justify-end gap-3 bg-[#1a1a1a]">
              <button onClick={() => setIsAddCategoryOpen(false)} className="px-5 py-2.5 rounded-full border border-white/10 hover:bg-white/5 text-sm font-medium text-white transition-colors">Cancel</button>
              <button className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent/90 text-sm font-medium text-white transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)]">Create Category</button>
            </div>
          </div>
        </>
      )}

      {/* --- EDIT CATEGORY SLIDEOVER --- */}
      {isEditCategoryOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setIsEditCategoryOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#1a1a1a] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-white/5">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white">Edit Category</h2>
              <button onClick={() => setIsEditCategoryOpen(false)} className="p-2 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Name <span className="text-red-500">*</span></label>
                <input type="text" defaultValue="T-Shirts" className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent transition-all" />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Icon</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground overflow-hidden relative group">
                    <img src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80" alt="Icon" className="w-full h-full object-cover" />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 text-white font-medium text-xs transition-colors">
                    <ImageIcon className="w-3.5 h-3.5" /> Upload Icon
                  </button>
                  <button className="w-8 h-8 rounded-full border border-white/10 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 text-muted-foreground flex items-center justify-center transition-colors">
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Description</label>
                <textarea rows={4} defaultValue="Everyday tees in soft cotton — from clean classics to oversized statements." className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent transition-all resize-none" />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Sort Order</label>
                <input type="text" defaultValue="1" className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent transition-all" />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Active Status</label>
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border transition-colors ${isActiveStatus ? "bg-accent border-accent" : "bg-black/40 border-white/20 group-hover:border-white/40"}`}>
                    {isActiveStatus && <Check className="w-3.5 h-3.5 text-white" />}
                    <input type="checkbox" className="hidden" checked={isActiveStatus} onChange={() => setIsActiveStatus(!isActiveStatus)} />
                  </div>
                  <span className="text-sm text-white/80">Category will be visible when active</span>
                </label>
              </div>

            </div>
            
            <div className="p-6 border-t border-white/5 flex items-center justify-end gap-3 bg-[#1a1a1a]">
              <button onClick={() => setIsEditCategoryOpen(false)} className="px-5 py-2.5 rounded-full border border-white/10 hover:bg-white/5 text-sm font-medium text-white transition-colors">Cancel</button>
              <button className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent/90 text-sm font-medium text-white transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)]">Update Category</button>
            </div>
          </div>
        </>
      )}

      {/* --- DELETE MODAL --- */}
      {categoryToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setCategoryToDelete(null)} />
          <div className="relative bg-[#111] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full border-2 border-accent/20 flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Are you sure you want to delete this category?</h2>
              <p className="text-sm text-muted-foreground mb-8">This action cannot be undone.</p>
              
              <div className="flex items-center justify-center gap-3 w-full">
                <button 
                  onClick={() => setCategoryToDelete(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white font-medium text-sm transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)]"
                >
                  Delete
                </button>
                <button 
                  onClick={() => setCategoryToDelete(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
