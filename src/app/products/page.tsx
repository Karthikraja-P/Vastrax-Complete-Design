import { Plus, Search, Filter, SlidersHorizontal, Package, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";
import { ProductTable } from "@/components/products/ProductTable";

export default function ProductsPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">All Products</h1>
          <p className="text-muted-foreground mt-1">Manage your catalogue, inventory, and AI-generated media.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface-hover border border-border rounded-md text-sm font-medium transition-colors">
            Export
          </button>
          <Link href="/products/add" className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-foreground rounded-md text-sm font-medium transition-colors shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-background rounded-lg border border-border">
            <Package className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Products</p>
            <h3 className="text-2xl font-bold mt-1">2,543</h3>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-background rounded-lg border border-border">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Active Listings</p>
            <h3 className="text-2xl font-bold mt-1">2,104</h3>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-background rounded-lg border border-border">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Needs Attention</p>
            <h3 className="text-2xl font-bold mt-1">12</h3>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button className="flex items-center gap-2 px-3 py-2 bg-background border border-border hover:bg-surface-hover rounded-md text-sm transition-colors">
            Category <Filter className="w-3 h-3" />
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-background border border-border hover:bg-surface-hover rounded-md text-sm transition-colors">
            Status <Filter className="w-3 h-3" />
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-background border border-border hover:bg-surface-hover rounded-md text-sm transition-colors">
            <SlidersHorizontal className="w-4 h-4 mr-1" />
            More Filters
          </button>
          <button className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
            Reset
          </button>
        </div>
      </div>

      <ProductTable />
    </div>
  );
}
