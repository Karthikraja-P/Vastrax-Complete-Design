"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Home, ChevronRight, ShoppingCart, Clock, Truck, 
  CheckCircle2, Ban, Search, ChevronDown, Filter, RotateCcw, Loader2,
  Eye, PackageCheck, X as XIcon, User, MapPin, CreditCard, Sparkles
} from "lucide-react";
import Link from "next/link";
import { ordersApi, OrderItemRecord } from "@/lib/api";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [sortDate, setSortDate] = useState("newest");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await ordersApi.list();
      if (data && Array.isArray(data)) {
        const formatted = data.map((o: any) => {
          const rawStatus = String(o.status || "CONFIRMED").toUpperCase();
          const progress = rawStatus === "DELIVERED" ? 100 : rawStatus === "SHIPPED" ? 80 : rawStatus === "PROCESSING" ? 55 : 25;
          const statusDisplay = rawStatus.charAt(0) + rawStatus.slice(1).toLowerCase();
          const statusColor = rawStatus === "DELIVERED" ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" : 
                              rawStatus === "CANCELLED" ? "text-red-500 border-red-500/30 bg-red-500/10" : 
                              rawStatus === "SHIPPED" ? "text-blue-400 border-blue-400/30 bg-blue-400/10" : 
                              "text-accent border-accent/30 bg-accent/10";

          return {
            id: String(o.id || ""),
            orderNumber: o.orderNumber || `#ORD-${String(o.id).slice(0, 8).toUpperCase()}`,
            customer: o.customerName || "Customer",
            email: o.customerEmail || "—",
            itemsCount: o.items ? o.items.length : (o.itemsCount || 1),
            rawTotal: Number(o.totalAmount || o.total_amount || 0),
            total: `$${typeof o.totalAmount === 'number' ? o.totalAmount.toFixed(2) : (typeof o.total_amount === 'number' ? o.total_amount.toFixed(2) : (o.totalAmount || o.total_amount || '0.00'))}`,
            progress,
            rawStatus,
            status: statusDisplay,
            statusColor,
            paymentStatus: o.paymentStatus || "Paid",
            shippingAddress: o.shippingAddress || "104 Madison Avenue, Atelier Suite 402, New York, NY 10016",
            date: o.createdAt || o.placed_at ? new Date(o.createdAt || o.placed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent",
            rawDate: new Date(o.createdAt || o.placed_at || Date.now()).getTime(),
            items: o.items || []
          };
        });
        setOrders(formatted);
      }
    } catch (err) {
      console.error("Orders load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setPaymentFilter("");
    setSortDate("newest");
    setCurrentPage(1);
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId || o.orderNumber === orderId) {
        const rawStatus = newStatus.toUpperCase();
        const progress = rawStatus === "DELIVERED" ? 100 : rawStatus === "SHIPPED" ? 80 : rawStatus === "PROCESSING" ? 55 : 25;
        const statusColor = rawStatus === "DELIVERED" ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" : 
                            rawStatus === "CANCELLED" ? "text-red-500 border-red-500/30 bg-red-500/10" : 
                            rawStatus === "SHIPPED" ? "text-blue-400 border-blue-400/30 bg-blue-400/10" : 
                            "text-accent border-accent/30 bg-accent/10";
        return {
          ...o,
          rawStatus,
          status: newStatus.charAt(0).toUpperCase() + newStatus.slice(1).toLowerCase(),
          progress,
          statusColor
        };
      }
      return o;
    }));
    setOpenActionId(null);
  };

  // Filter and Sort Orders
  const filteredOrders = useMemo(() => {
    let result = orders.filter((o) => {
      const matchesSearch = !searchQuery.trim() || 
        o.customer.toLowerCase().includes(searchQuery.toLowerCase()) || 
        o.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = !statusFilter || o.rawStatus.toLowerCase() === statusFilter.toLowerCase();
      const matchesPayment = !paymentFilter || o.paymentStatus.toLowerCase() === paymentFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPayment;
    });

    if (sortDate === "newest") {
      result.sort((a, b) => b.rawDate - a.rawDate);
    } else if (sortDate === "oldest") {
      result.sort((a, b) => a.rawDate - b.rawDate);
    } else if (sortDate === "highest") {
      result.sort((a, b) => b.rawTotal - a.rawTotal);
    } else if (sortDate === "lowest") {
      result.sort((a, b) => a.rawTotal - b.rawTotal);
    }

    return result;
  }, [orders, searchQuery, statusFilter, paymentFilter, sortDate]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const metrics = [
    { label: "Total Orders", value: String(orders.length), icon: ShoppingCart, color: "text-accent", glow: "shadow-[-4px_0_15px_rgba(224,122,63,0.3)]", border: "border-l-accent" },
    { label: "Pending", value: String(orders.filter(o => o.rawStatus === "PENDING" || o.rawStatus === "CONFIRMED").length), icon: Clock, color: "text-yellow-500", glow: "shadow-[-4px_0_15px_rgba(234,179,8,0.2)]", border: "border-l-yellow-500" },
    { label: "Processing", value: String(orders.filter(o => o.rawStatus === "PROCESSING").length), icon: Truck, color: "text-blue-500", glow: "shadow-[-4px_0_15px_rgba(59,130,246,0.2)]", border: "border-l-blue-500" },
    { label: "Delivered", value: String(orders.filter(o => o.rawStatus === "DELIVERED").length), icon: CheckCircle2, color: "text-emerald-500", glow: "shadow-[-4px_0_15px_rgba(16,185,129,0.2)]", border: "border-l-emerald-500" },
    { label: "Cancelled", value: String(orders.filter(o => o.rawStatus === "CANCELLED").length), icon: Ban, color: "text-red-500", glow: "shadow-[-4px_0_15px_rgba(239,68,68,0.2)]", border: "border-l-red-500" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <Link href="/" className="cursor-pointer hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Orders</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Orders</h1>
          <p className="text-muted-foreground mt-1 text-sm">View real-time customer orders, fulfillments, and transaction records</p>
        </div>
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
      <div className="bg-surface border border-border rounded-xl p-4 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Search Input */}
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-semibold text-foreground">Search</label>
            <div className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search orders, client..." 
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Order Status */}
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-semibold text-foreground">Order Status</label>
            <div className="relative">
              <select 
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Payment Status */}
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-semibold text-foreground">Payment Status</label>
            <div className="relative">
              <select 
                value={paymentFilter}
                onChange={(e) => { setPaymentFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer"
              >
                <option value="">All Payments</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="refunded">Refunded</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Sort Date & Total */}
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-semibold text-foreground">Sort By</label>
            <div className="relative">
              <select 
                value={sortDate}
                onChange={(e) => { setSortDate(e.target.value); setCurrentPage(1); }}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest">Highest Amount</option>
                <option value="lowest">Lowest Amount</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Reset Action */}
          <div className="flex items-end gap-3 lg:col-span-1 pt-1.5">
            <button 
              onClick={handleResetFilters}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
              Reset Filters
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
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      <span>Loading orders from database...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <ShoppingCart className="w-8 h-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm font-semibold text-foreground">No orders matching criteria</p>
                      <p className="text-xs text-muted-foreground mt-1">Try resetting filters to view all recorded transactions.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => (
                  <tr key={order.id || index} className="hover:bg-surface-hover/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-hover border border-border flex items-center justify-center text-xs font-bold text-accent">
                          {(order.customer || "C").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{order.customer}</p>
                          <p className="text-[11px] text-muted-foreground">{order.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-semibold text-foreground">
                      {order.orderNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {order.itemsCount} piece{order.itemsCount > 1 ? 's' : ''}
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
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${order.statusColor}`}>
                          {order.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground">
                      {order.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right relative">
                      <div className="relative inline-block text-left">
                        <button 
                          onClick={() => setOpenActionId(openActionId === (order.id || index) ? null : (order.id || index))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border hover:bg-surface-hover text-xs font-medium text-foreground transition-colors ml-auto"
                        >
                          Actions
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        </button>

                        {/* Action Dropdown */}
                        {openActionId === (order.id || index) && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setOpenActionId(null)} />
                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-background border border-border rounded-xl shadow-2xl py-1 z-40 animate-in fade-in zoom-in-95 duration-150">
                              <button 
                                onClick={() => {
                                  setSelectedOrderDetails(order);
                                  setOpenActionId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface-hover hover:text-accent transition-colors text-left"
                              >
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" /> View Details
                              </button>
                              <div className="h-px bg-border/40 my-1" />
                              <div className="px-3.5 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                Set Status
                              </div>
                              <button 
                                onClick={() => handleUpdateOrderStatus(order.id, "PROCESSING")}
                                className="w-full px-3.5 py-1.5 text-xs text-foreground hover:bg-surface-hover hover:text-blue-400 text-left transition-colors"
                              >
                                → Processing
                              </button>
                              <button 
                                onClick={() => handleUpdateOrderStatus(order.id, "SHIPPED")}
                                className="w-full px-3.5 py-1.5 text-xs text-foreground hover:bg-surface-hover hover:text-purple-400 text-left transition-colors"
                              >
                                → Shipped
                              </button>
                              <button 
                                onClick={() => handleUpdateOrderStatus(order.id, "DELIVERED")}
                                className="w-full px-3.5 py-1.5 text-xs text-foreground hover:bg-surface-hover hover:text-emerald-400 text-left transition-colors"
                              >
                                → Delivered
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

      {/* Pagination Controls — ONLY rendered when total rows exceed page size */}
      {filteredOrders.length > pageSize && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-bold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-foreground">{Math.min(currentPage * pageSize, filteredOrders.length)}</span> of <span className="font-bold text-foreground">{filteredOrders.length}</span> orders
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

      {/* --- ORDER DETAILS SLIDEOVER DRAWER --- */}
      {selectedOrderDetails && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setSelectedOrderDetails(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>Order {selectedOrderDetails.orderNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${selectedOrderDetails.statusColor}`}>
                    {selectedOrderDetails.status}
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Placed on {selectedOrderDetails.date}</p>
              </div>
              <button onClick={() => setSelectedOrderDetails(null)} className="p-2 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Customer Information */}
              <div className="bg-background border border-border/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <User className="w-4 h-4 text-accent" />
                  <span>Customer &amp; Recipient</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pl-6">
                  <p className="font-semibold text-foreground">{selectedOrderDetails.customer}</p>
                  <p>{selectedOrderDetails.email}</p>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-background border border-border/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <MapPin className="w-4 h-4 text-accent" />
                  <span>Delivery Address</span>
                </div>
                <p className="text-xs text-muted-foreground pl-6 leading-relaxed">
                  {selectedOrderDetails.shippingAddress}
                </p>
              </div>

              {/* Payment Status */}
              <div className="bg-background border border-border/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <CreditCard className="w-4 h-4 text-accent" />
                  <span>Payment &amp; Billing</span>
                </div>
                <div className="flex items-center justify-between text-xs pl-6">
                  <span className="text-muted-foreground">Payment Status</span>
                  <span className="font-bold text-emerald-500">{selectedOrderDetails.paymentStatus}</span>
                </div>
                <div className="flex items-center justify-between text-xs pl-6">
                  <span className="text-muted-foreground">Total Charged</span>
                  <span className="font-bold text-foreground">{selectedOrderDetails.total}</span>
                </div>
              </div>

              {/* Fulfillment Progress */}
              <div className="bg-background border border-border/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Truck className="w-4 h-4 text-accent" />
                  <span>Fulfillment Progress</span>
                </div>
                <div className="space-y-2 pl-6">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Dispatch Velocity</span>
                    <span className="text-accent">{selectedOrderDetails.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-hover border border-border rounded-full overflow-hidden">
                    <div className="h-full bg-accent transition-all duration-500" style={{ width: `${selectedOrderDetails.progress}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border flex items-center justify-between bg-surface">
              <span className="text-xs text-muted-foreground">VASTRAX Live Atelier Fulfillment</span>
              <button 
                onClick={() => setSelectedOrderDetails(null)} 
                className="px-5 py-2 rounded-full bg-accent hover:bg-accent/90 text-xs font-semibold text-white transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)]"
              >
                Close Details
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
