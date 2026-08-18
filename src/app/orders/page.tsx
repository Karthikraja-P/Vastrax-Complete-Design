"use client";

import React, { useState, useEffect } from "react";
import { 
  Home, ChevronRight, ShoppingCart, Clock, Truck, 
  CheckCircle2, Ban, Search, ChevronDown, Filter, RotateCcw, Loader2
} from "lucide-react";
import { ordersApi, OrderItemRecord } from "@/lib/api";

const initialOrders = [
  { id: "#ORD-2026-1030", customer: "James Garcia", email: "james.garcia@example.com", items: 2, total: "$811.65", progress: 20, status: "Confirmed", statusColor: "text-accent border-accent", date: "Aug 17, 2026" },
  { id: "#ORD-2026-1000", customer: "James Garcia", email: "james.garcia@example.com", items: 4, total: "$1095.15", progress: 55, status: "Processing", statusColor: "text-accent border-accent", date: "Aug 17, 2026" },
  { id: "#ORD-2026-1031", customer: "John Doe", email: "john.doe@example.com", items: 4, total: "$639.45", progress: 80, status: "Shipped", statusColor: "text-accent border-accent", date: "Aug 16, 2026" },
  { id: "#ORD-2026-1001", customer: "John Doe", email: "john.doe@example.com", items: 1, total: "$77.19", progress: 100, status: "Delivered", statusColor: "text-emerald-500 border-emerald-500", date: "Aug 16, 2026" },
  { id: "#ORD-2026-1032", customer: "Jane Smith", email: "jane.smith@example.com", items: 1, total: "$138.24", progress: 55, status: "Processing", statusColor: "text-accent border-accent", date: "Aug 15, 2026" },
  { id: "#ORD-2026-1002", customer: "Jane Smith", email: "jane.smith@example.com", items: 4, total: "$582.75", progress: 20, status: "Confirmed", statusColor: "text-accent border-accent", date: "Aug 15, 2026" },
  { id: "#ORD-2026-1033", customer: "Emily Davis", email: "emily.davis@example.com", items: 1, total: "$196.65", progress: 20, status: "Confirmed", statusColor: "text-accent border-accent", date: "Aug 14, 2026" },
];

const metrics = [
  { label: "Total Orders", value: "70", icon: ShoppingCart, color: "text-accent", glow: "shadow-[-4px_0_15px_rgba(224,122,63,0.3)]", border: "border-l-accent" },
  { label: "Pending", value: "5", icon: Clock, color: "text-yellow-500", glow: "shadow-[-4px_0_15px_rgba(234,179,8,0.2)]", border: "border-l-yellow-500" },
  { label: "Processing", value: "20", icon: Truck, color: "text-blue-500", glow: "shadow-[-4px_0_15px_rgba(59,130,246,0.2)]", border: "border-l-blue-500" },
  { label: "Delivered", value: "21", icon: CheckCircle2, color: "text-emerald-500", glow: "shadow-[-4px_0_15px_rgba(16,185,129,0.2)]", border: "border-l-emerald-500" },
  { label: "Cancelled", value: "1", icon: Ban, color: "text-red-500", glow: "shadow-[-4px_0_15px_rgba(239,68,68,0.2)]", border: "border-l-red-500" },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadOrders = async () => {
    setLoading(true);
    const data = await ordersApi.list();
    if (data && data.length > 0) {
      const formatted = data.map((o, idx) => ({
        id: o.orderNumber || `#ORD-2026-${1030 + idx}`,
        customer: o.customerName || "Customer",
        email: o.customerEmail || "customer@example.com",
        items: o.itemsCount || 1,
        total: `$${typeof o.totalAmount === 'number' ? o.totalAmount.toFixed(2) : o.totalAmount}`,
        progress: o.status === "DELIVERED" ? 100 : o.status === "SHIPPED" ? 80 : o.status === "PROCESSING" ? 55 : 20,
        status: o.status || "Confirmed",
        statusColor: o.status === "DELIVERED" ? "text-emerald-500 border-emerald-500" : "text-accent border-accent",
        date: new Date(o.createdAt || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      }));
      setOrders(formatted);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, []);
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors">Dashboard</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Orders</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Orders</h1>
        <p className="text-muted-foreground mt-1 text-sm">View and manage customer orders</p>
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
      <div className="bg-surface border border-border rounded-xl p-4 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-semibold text-foreground">Search</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search orders..." 
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-semibold text-foreground">Order Status</label>
            <div className="relative">
              <select defaultValue="" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-muted-foreground appearance-none cursor-pointer">
                <option value="" disabled>Select status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-semibold text-foreground">Payment Status</label>
            <div className="relative">
              <select defaultValue="" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-muted-foreground appearance-none cursor-pointer">
                <option value="" disabled>Select payment status</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="refunded">Refunded</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-semibold text-foreground">Date</label>
            <div className="relative">
              <select defaultValue="newest" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="flex items-end gap-3 lg:col-span-1 pt-1.5">
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-lg transition-colors shadow-[0_0_10px_rgba(224,122,63,0.3)]">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button className="flex items-center justify-center px-4 py-2 bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm rounded-lg transition-colors">
              <RotateCcw className="w-4 h-4" />
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
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Order #</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      <span>Loading orders from API...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.map((order, index) => (
                <tr key={order.id || index} className="hover:bg-surface-hover transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-xs font-bold text-foreground">
                        {order.customer.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{order.customer}</p>
                        <p className="text-[11px] text-muted-foreground">{order.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                    {order.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {order.items}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-foreground">
                    {order.total}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {/* Circular Progress Indicator */}
                      <div className={`relative w-7 h-7 flex items-center justify-center rounded-full border-2 border-background bg-background shadow-sm overflow-hidden ${order.statusColor.split(' ')[0]}`}>
                         <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 32 32">
                           <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                           <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="88" strokeDashoffset={88 - (88 * order.progress) / 100} className="transition-all duration-1000 ease-out" />
                         </svg>
                         <span className="relative text-[8px] font-bold">{order.progress}</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-background/50 ${order.statusColor}`}>
                        {order.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                      Paid
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground">
                    {order.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background border border-border hover:bg-border/50 text-xs font-medium text-foreground transition-colors">
                      Actions
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </button>
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
          Showing <span className="font-bold text-foreground">1</span> to <span className="font-bold text-foreground">10</span> of <span className="font-bold text-foreground">70</span> results
        </p>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md border border-border bg-background hover:bg-surface-hover text-xs font-medium text-foreground transition-colors">Previous</button>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-md bg-accent text-white font-bold text-xs shadow-[0_0_8px_rgba(224,122,63,0.4)]">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-surface-hover font-medium text-xs text-foreground transition-colors">2</button>
            <span className="px-1 text-muted-foreground">...</span>
            <button className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-surface-hover font-medium text-xs text-foreground transition-colors">7</button>
          </div>
          <button className="px-3 py-1.5 rounded-md border border-border bg-background hover:bg-surface-hover text-xs font-medium text-foreground transition-colors">Next</button>
        </div>
      </div>

    </div>
  );
}
