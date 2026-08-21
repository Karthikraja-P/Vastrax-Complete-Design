"use client";

import React, { useState } from "react";
import { 
  Home, ChevronRight, Plus, Package, Check, EyeOff, AlertTriangle, Star, 
  Search, ChevronDown, Filter, RotateCcw, Eye, Edit2, Trash2, Image as ImageIcon,
  AlertCircle
} from "lucide-react";
import Link from "next/link";

import { productsApi } from "@/lib/api";

// const productsData = [ ... ] // Replaced by dynamic fetch

export default function ProductsPage() {
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const data = await productsApi.list();
        if (data && Array.isArray(data)) {
          const mapped = data.map((p) => ({
            id: p.id,
            name: p.name || p.title,
            sku: p.sku || `PRD-${p.id}`,
            price: `$${typeof p.price === 'number' ? p.price.toFixed(2) : p.price}`,
            oldPrice: p.originalPrice ? `$${Number(p.originalPrice).toFixed(2)}` : null,
            stock: p.stock ?? p.inventoryCount ?? 0,
            status: p.status || "Active",
            date: "Recent",
            image: p.image || p.images?.[0]?.s3_url || p.images?.[0] || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=400&auto=format&fit=crop"
          }));
          setProductsData(mapped);
        }
      } catch(err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const metrics = [
    { label: "Total Products", value: String(productsData.length), icon: Package, color: "text-accent", glow: "shadow-[-4px_0_15px_rgba(224,122,63,0.3)]", border: "border-l-accent" },
    { label: "Active", value: String(productsData.filter(p => p.status === "Active" || p.status === "Published").length), icon: Check, color: "text-emerald-500", glow: "shadow-[-4px_0_15px_rgba(16,185,129,0.2)]", border: "border-l-emerald-500" },
    { label: "Draft", value: String(productsData.filter(p => p.status === "Draft" || p.status === "Inactive").length), icon: EyeOff, color: "text-muted-foreground", glow: "shadow-[-4px_0_15px_rgba(161,161,170,0.1)]", border: "border-l-border" },
    { label: "Out of Stock", value: String(productsData.filter(p => p.stock <= 0).length), icon: AlertTriangle, color: "text-red-500", glow: "shadow-[-4px_0_15px_rgba(239,68,68,0.2)]", border: "border-l-red-500" },
    { label: "In Stock", value: String(productsData.filter(p => p.stock > 0).length), icon: Star, color: "text-yellow-500", glow: "shadow-[-4px_0_15px_rgba(234,179,8,0.2)]", border: "border-l-yellow-500" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors">Dashboard</span>
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors">Products</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">All Products</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">All Products</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage store products and inventory</p>
        </div>
        <Link href="/products/create" className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-full transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] shrink-0">
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
            {/* Dotted background pattern */}
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 w-full">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Search</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search products..." 
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Category</label>
              <div className="relative">
                <select defaultValue="" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-muted-foreground appearance-none cursor-pointer">
                  <option value="" disabled>All categories</option>
                  <option value="hats">Hats</option>
                  <option value="shoes">Shoes</option>
                  <option value="clothing">Clothing</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Featured</label>
              <div className="relative">
                <select defaultValue="" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-muted-foreground appearance-none cursor-pointer">
                  <option value="" disabled>Any</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Status</label>
              <div className="relative">
                <select defaultValue="" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-muted-foreground appearance-none cursor-pointer">
                  <option value="" disabled>Select status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="out_of_stock">Out of Stock</option>
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
      <div className="bg-surface border border-border rounded-xl overflow-visible mt-6 pb-20">
        <div className="overflow-visible">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/50 border-b border-border">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Updated</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {productsData.map((product, index) => (
                <tr key={index} className="hover:bg-surface-hover transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-4">
                      {/* Thumbnail Placeholder */}
                      <div className="w-10 h-10 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground overflow-hidden">
                        <ImageIcon className="w-4 h-4 opacity-50" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground hover:text-accent transition-colors cursor-pointer">{product.name}</span>
                        <span className="text-[11px] text-muted-foreground mt-0.5">{product.sku}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{product.price}</span>
                      {product.oldPrice && (
                        <span className="text-xs text-muted-foreground line-through opacity-70">{product.oldPrice}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                    {product.stock}
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
                  <td className="px-6 py-4 whitespace-nowrap relative">
                    <button 
                      onClick={() => setOpenActionId(openActionId === product.id ? null : product.id)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-background border border-border hover:bg-border/50 text-xs font-medium text-foreground transition-colors"
                    >
                      Actions
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </button>
                    
                    {/* Action Dropdown */}
                    {openActionId === product.id && (
                      <div className="absolute top-full left-6 z-50 w-36 mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="py-1">
                          <Link href="/products/edit" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors rounded-t-lg">
                            <Edit2 className="w-4 h-4 text-muted-foreground" /> Edit
                          </Link>
                          <button 
                            onClick={() => {
                              setProductToDelete(product.id);
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

      {/* Pagination Footer */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-bold text-foreground">1</span> to <span className="font-bold text-foreground">10</span> of <span className="font-bold text-foreground">35</span> results
        </p>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md border border-border bg-background hover:bg-surface-hover text-xs font-medium text-muted-foreground transition-colors opacity-50 cursor-not-allowed">Previous</button>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-md bg-accent text-white font-bold text-xs shadow-[0_0_8px_rgba(224,122,63,0.4)]">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-surface-hover font-medium text-xs text-foreground transition-colors">2</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-surface-hover font-medium text-xs text-foreground transition-colors">3</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-surface-hover font-medium text-xs text-foreground transition-colors">4</button>
          </div>
          <button className="px-3 py-1.5 rounded-md border border-border bg-background hover:bg-surface-hover text-xs font-medium text-foreground transition-colors">Next</button>
        </div>
      </div>

      {/* Delete Product Modal */}
      {productToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setProductToDelete(null)}
          />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full border-2 border-accent flex items-center justify-center mb-6">
              <AlertCircle className="w-8 h-8 text-accent" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-3">Delete this product?</h2>
            <p className="text-muted-foreground mb-8">This product will be moved to trash.</p>
            
            <div className="flex items-center gap-4 w-full justify-center">
              <button 
                onClick={() => setProductToDelete(null)}
                className="px-8 py-2.5 rounded-lg bg-[#cc7a4e] hover:bg-[#b06740] text-white font-medium transition-colors"
              >
                Delete
              </button>
              <button 
                onClick={() => setProductToDelete(null)}
                className="px-8 py-2.5 rounded-lg bg-surface border border-white/10 hover:bg-surface-hover text-white font-medium transition-colors"
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
