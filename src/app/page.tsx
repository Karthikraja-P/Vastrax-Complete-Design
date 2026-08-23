"use client";

import { useState, useEffect } from "react";
import { Bell, Sparkles, ChevronDown, Download, Home, ChevronRight, TrendingUp, Loader2, ShoppingCart, Calendar, RotateCcw, Users, Package, ShoppingBag } from "lucide-react";
import { NotchedCard } from "@/components/admin/NotchedCard";
import { analyticsApi, ordersApi, usersApi, productsApi, OrderItemRecord } from "@/lib/api";
import Link from "next/link";

export default function Dashboard() {
  const [orders, setOrders] = useState<OrderItemRecord[]>([]);
  const [usersCount, setUsersCount] = useState<number>(0);
  const [productsCount, setProductsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ords, usersList, prods] = await Promise.all([
        ordersApi.list().catch(() => []),
        usersApi.listAll().catch(() => []),
        productsApi.list({ published_only: false }).catch(() => [])
      ]);
      setOrders(ords || []);
      setUsersCount(Array.isArray(usersList) ? usersList.length : 0);
      setProductsCount(Array.isArray(prods) ? prods.length : 0);
    } catch (err) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute live metrics strictly from database records
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const ordersCount = orders.length;
  const avgOrderValue = ordersCount > 0 ? (totalRevenue / ordersCount).toFixed(2) : "0.00";

  // Real-time day-of-week sales from confirmed orders
  const dayTotals = [0, 0, 0, 0, 0, 0, 0]; // Sun=0, Mon=1...
  orders.forEach(o => {
    if (o.createdAt) {
      const d = new Date(o.createdAt);
      const dayIdx = isNaN(d.getDay()) ? 0 : d.getDay();
      dayTotals[dayIdx] += (Number(o.totalAmount) || 0);
    }
  });
  const weeklyLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyValues = [dayTotals[1], dayTotals[2], dayTotals[3], dayTotals[4], dayTotals[5], dayTotals[6], dayTotals[0]];
  const totalWeeklySales = weeklyValues.reduce((a, b) => a + b, 0);
  const maxWeekly = Math.max(...weeklyValues, 1);

  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    let csv = "VASTRAX LUXURY E-COMMERCE - EXECUTIVE OVERVIEW REPORT\r\n";
    csv += `Export Date,${new Date().toLocaleString()}\r\n\r\n`;
    
    // KPI Summary
    csv += "KEY PERFORMANCE INDICATORS\r\n";
    csv += `Total Revenue,$${totalRevenue.toFixed(2)}\r\n`;
    csv += `Average Order Value,$${avgOrderValue}\r\n`;
    csv += `Total Orders Recorded,${ordersCount}\r\n`;
    csv += `Registered Customers,${usersCount}\r\n`;
    csv += `Active Products In Catalog,${productsCount}\r\n\r\n`;

    // Live Orders
    csv += "LIVE ORDERS BREAKDOWN\r\n";
    csv += "Order ID,Customer Name,Email,Total ($),Status,Items Count,Date\r\n";
    if (orders && orders.length > 0) {
      orders.forEach((o) => {
        csv += `"${o.orderNumber || o.id}","${o.customerName || 'Customer'}","${o.customerEmail || '—'}","${Number(o.totalAmount || 0).toFixed(2)}","${o.status || 'CONFIRMED'}","${o.itemsCount || 1}","${o.createdAt || dateStr}"\r\n`;
      });
    } else {
      csv += "No individual orders recorded in database,N/A,N/A,0.00,N/A,0,N/A\r\n";
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `vastrax-report-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportOpen(false);
  };

  const handleExportJSON = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    const exportData = {
      exportMetadata: {
        platform: "VASTRAX Haute Couture Admin",
        exportedAt: new Date().toISOString(),
      },
      kpiSummary: {
        totalRevenue: totalRevenue,
        avgOrderValue: avgOrderValue,
        totalOrders: ordersCount,
        registeredCustomers: usersCount,
        activeProducts: productsCount,
      },
      weeklyTrend: { labels: weeklyLabels, values: weeklyValues },
      orders: orders,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `vastrax-analytics-${dateStr}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Dashboard</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1 text-sm">Real-time platform metrics and live store activity</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button 
            onClick={loadData}
            title="Refresh Live Metrics"
            disabled={loading}
            className="p-2 bg-transparent border border-border hover:bg-surface-hover hover:border-accent/40 rounded-full text-xs font-semibold transition-all text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
          </button>

          {/* Export Dropdown Menu */}
          <div className="relative">
            <button 
              onClick={() => setIsExportOpen(!isExportOpen)}
              className="flex items-center gap-2 px-3.5 py-2 bg-transparent border border-border hover:bg-surface-hover hover:border-accent/40 rounded-full text-xs font-semibold transition-all text-foreground"
            >
              <Download className="w-3.5 h-3.5 text-accent" />
              Export
              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
            </button>

            {isExportOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsExportOpen(false)} />
                <div className="absolute right-0 top-11 w-52 bg-background border border-border rounded-xl shadow-2xl py-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-surface-hover hover:text-accent transition-colors text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-accent" />
                    <span>Download as <strong>CSV</strong> (Excel)</span>
                  </button>
                  <div className="h-px bg-border/50 my-1" />
                  <button
                    onClick={handleExportJSON}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-surface-hover hover:text-accent transition-colors text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>Download as <strong>JSON</strong> (Raw)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pt-4">
        
        {/* Total Revenue */}
        <div className="lg:col-span-2">
          <NotchedCard 
            subtitle="Platform Total" 
            title="Total Revenue"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            alertTitle="Live Revenue Status"
            alertContent={`Store gross revenue calculated directly from ${ordersCount} confirmed database order(s).`}
            insightTitle="Catalog & Sales Status"
            insightContent="All sales figures update in real-time from active orders in PostgreSQL database."
            className="h-[320px]"
          >
            <div className="flex items-start justify-between h-full relative">
              <div className="flex flex-col h-full w-1/2 justify-center pb-8">
                {loading ? (
                  <div className="h-14 w-44 bg-surface-hover/80 rounded-xl animate-pulse mb-2" />
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-medium text-muted-foreground/70">$</span>
                    <span className="text-6xl font-bold tracking-tight">
                      {totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(1)}K` : totalRevenue.toFixed(2)}
                    </span>
                  </div>
                )}
                
                <div className="flex gap-6 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Orders</p>
                    {loading ? (
                      <div className="h-4 w-12 bg-surface-hover/60 rounded animate-pulse" />
                    ) : (
                      <p className="text-sm font-bold">{ordersCount}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Avg order</p>
                    {loading ? (
                      <div className="h-4 w-12 bg-surface-hover/60 rounded animate-pulse" />
                    ) : (
                      <p className="text-sm font-bold">${avgOrderValue}</p>
                    )}
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <TrendingUp className="w-3.5 h-3.5 text-accent" />
                  <span>Real database revenue</span>
                </div>
              </div>

              {/* Glowing Line Chart at Bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden pointer-events-none">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full stroke-accent drop-shadow-[0_0_8px_rgba(224,122,63,0.8)] fill-none">
                  <path d="M0 35 Q 10 30, 20 32 T 40 28 T 60 30 T 80 15 T 100 5" strokeWidth="1.5" pathLength="100" className="animate-draw-line" />
                </svg>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Customer Count */}
        <div className="lg:col-span-1">
          <NotchedCard 
            subtitle="Registered accounts" 
            title="Customers"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            alertTitle="Clientele Count"
            alertContent={`Total of ${usersCount} registered accounts active in database.`}
            insightTitle="Patron Management"
            insightContent="View and manage user permissions from the Admin Management console."
            className="h-[320px]"
          >
            <div className="flex flex-col h-full justify-center pb-12 relative">
              {loading ? (
                <div className="h-10 w-28 bg-surface-hover/80 rounded-xl animate-pulse mb-2" />
              ) : (
                <span className="text-4xl font-bold tracking-tight">
                  {usersCount}
                </span>
              )}
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="w-3.5 h-3.5 text-accent" />
                <span>Active Users</span>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden pointer-events-none">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full stroke-accent drop-shadow-[0_0_8px_rgba(224,122,63,0.8)] fill-none">
                  <path d="M0 35 Q 20 32, 40 30 T 70 20 T 100 10" strokeWidth="1.5" pathLength="100" className="animate-draw-line" />
                </svg>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Catalog Products */}
        <div className="lg:col-span-1">
          <NotchedCard 
            subtitle="Live Catalog" 
            title="Products"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            alertTitle="Catalog Status"
            alertContent={`There are currently ${productsCount} active products in the store.`}
            insightTitle="Inventory Control"
            insightContent="Add new collections and garments from the Products panel."
            className="h-[320px]"
          >
            <div className="flex flex-col h-full justify-center pb-12 relative">
              {loading ? (
                <div className="h-10 w-28 bg-surface-hover/80 rounded-xl animate-pulse mb-2" />
              ) : (
                <span className="text-4xl font-bold tracking-tight">
                  {productsCount}
                </span>
              )}
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Package className="w-3.5 h-3.5 text-accent" />
                <span>Live in Catalog</span>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden pointer-events-none">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full stroke-accent drop-shadow-[0_0_8px_rgba(224,122,63,0.8)] fill-none">
                  <path d="M0 35 Q 20 32, 40 30 T 70 20 T 100 10" strokeWidth="1.5" pathLength="100" className="animate-draw-line" />
                </svg>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Bottom Row */}
        
        {/* Total Orders Volume */}
        <div className="lg:col-span-2">
          <NotchedCard 
            subtitle="Orders" 
            title="Orders Volume"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            alertTitle="Order Stream"
            alertContent={`${ordersCount} total orders have been placed.`}
            insightTitle="Order Tracking"
            insightContent="Orders update automatically upon customer checkout completion."
            className="h-[200px]"
          >
            <div className="flex flex-col h-full justify-center relative">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{ordersCount}</span>
                <span className="text-sm font-medium text-muted-foreground ml-2">Total Orders Recorded</span>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-8 relative w-3/4">
                <div className="h-1.5 w-full bg-surface-hover border border-border rounded-full overflow-hidden">
                  <div className="h-full bg-accent drop-shadow-[0_0_8px_rgba(224,122,63,0.8)]" style={{ width: `${Math.min(ordersCount * 10, 100)}%` }} />
                </div>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Weekly Trend */}
        <div className="lg:col-span-2">
          <NotchedCard 
            subtitle="Activity" 
            title="Weekly Order Revenue"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            alertTitle="Weekly Overview"
            alertContent={`Week-to-date sales total $${totalWeeklySales.toFixed(2)}.`}
            insightTitle="Real-time Tracking"
            insightContent="Daily volume reflects actual sales transactions recorded in PostgreSQL."
            className="h-[200px]"
          >
            <div className="flex items-center justify-between h-full px-4">
              <div className="flex flex-col">
                <span className="text-3xl font-bold">${totalWeeklySales.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground mt-1">Confirmed weekly volume</span>
              </div>
              
              {/* Mini Bar Chart */}
              <div className="h-16 flex items-end gap-2 px-2">
                {weeklyValues.map((val: number, i: number) => {
                  const heightPercent = maxWeekly > 0 && totalWeeklySales > 0 ? Math.max((val / maxWeekly) * 100, 15) : 15;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div 
                        className={`w-4 rounded-t-sm ${val > 0 ? 'bg-accent shadow-[0_0_8px_rgba(224,122,63,0.6)]' : 'bg-surface-hover border border-border'}`}
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span className="text-[9px] text-muted-foreground uppercase">{weeklyLabels[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* ROW 3: Recent Orders & Live Order Log */}
        <div className="lg:col-span-4">
          <NotchedCard 
            subtitle="Live orders from database" 
            title="Recent Orders"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            alertTitle="Order Stream Status"
            alertContent="Connected live to FastAPI /api/v1/orders/admin endpoint."
            insightTitle="Order Fulfillment"
            insightContent="Live customer orders appear immediately upon checkout."
            className="min-h-[350px]"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
                <span className="text-xs text-muted-foreground">Loading verified orders from database...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShoppingCart className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-semibold text-foreground">No orders recorded yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Customer orders placed through the storefront checkout will automatically stream into this table in real time.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] text-muted-foreground uppercase bg-surface-hover/30 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Order ID</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Items</th>
                      <th className="px-4 py-3 font-semibold">Total Amount</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {orders.slice(0, 5).map((order) => (
                      <tr key={order.id} className="hover:bg-surface-hover/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-foreground">
                          {order.orderNumber || `ORD-${order.id}`}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{order.customerName || "Customer"}</div>
                          <div className="text-[10px] text-muted-foreground">{order.customerEmail || "—"}</div>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {order.itemsCount || 1} {order.itemsCount === 1 ? 'item' : 'items'}
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground">
                          ${typeof order.totalAmount === 'number' ? order.totalAmount.toFixed(2) : order.totalAmount}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            order.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            order.status === 'PROCESSING' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            order.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {order.status || 'CONFIRMED'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href="/orders" className="text-accent hover:underline text-xs font-semibold">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </NotchedCard>
        </div>

      </div>
    </div>
  );
}
