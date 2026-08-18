"use client";

import React from "react";
import { 
  Home, ChevronRight, Search, ChevronDown, Filter, RotateCcw
} from "lucide-react";

export default function DeletedCategoriesPage() {
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
        <span className="text-foreground">Deleted</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Deleted Categories</h1>
        <p className="text-muted-foreground mt-1 text-sm">View and restore deleted categories</p>
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

      {/* Data Table - Empty State */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden mt-6 pb-4">
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
          <tbody>
            <tr>
              <td colSpan={5}>
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm font-medium text-muted-foreground">Get started by creating your first category</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}
