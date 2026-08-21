"use client";

import { useState, useEffect } from "react";
import { Bell, Sparkles, ChevronDown, Download, Home, ChevronRight, TrendingUp, Loader2, ShoppingCart } from "lucide-react";
import { NotchedCard } from "@/components/admin/NotchedCard";
import { analyticsApi, ordersApi, OrderItemRecord } from "@/lib/api";
import Link from "next/link";

export default function Dashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [regional, setRegional] = useState<any>(null);
  const [orders, setOrders] = useState<OrderItemRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [ov, reg, ords] = await Promise.all([
          analyticsApi.getOverview(),
          analyticsApi.getRegionalSales(),
          ordersApi.list()
        ]);
        setOverview(ov);
        setRegional(reg);
        setOrders(ords || []);
      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalOrdersCount = orders.length || overview?.revenue?.ordersCount || 0;
  const calculatedTotalRevenue = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0) || overview?.revenue?.total || 0;
  const calculatedAvgOrder = totalOrdersCount > 0 ? Number((calculatedTotalRevenue / totalOrdersCount).toFixed(2)) : 0;

  const rev = {
    total: calculatedTotalRevenue,
    growthPercent: overview?.revenue?.growthPercent || 0,
    avgOrderValue: calculatedAvgOrder,
    ordersCount: totalOrdersCount
  };

  const cust = overview?.customers || { total: 0, growthPercent: 0 };
  const weekly = overview?.salesWeekly || { labels: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], values: [0, 0, 0, 0, 0, 0, 0] };
  const conv = overview?.conversionRate || { rate: 0, change: 0 };
  const camp = overview?.activeCampaigns || { count: 0, reach: "0", roi: "0%" };

  const maxWeekly = Math.max(...weekly.values, 1);

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
          <button className="flex items-center gap-2 px-4 py-2 bg-transparent border border-border hover:bg-surface-hover rounded-full text-sm font-medium transition-colors text-foreground">
            <Download className="w-4 h-4" />
            Export
          </button>
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
            className="h-[320px]"
          >
            <div className="flex items-start justify-between h-full relative">
              <div className="flex flex-col h-full w-1/2 justify-center pb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-medium text-muted-foreground/70">$</span>
                  <span className="text-6xl font-bold tracking-tight">
                    {rev.total >= 1000 ? `${(rev.total / 1000).toFixed(1)}K` : rev.total.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex gap-6 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Orders</p>
                    <p className="text-sm font-bold">{rev.ordersCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Avg order</p>
                    <p className="text-sm font-bold">${rev.avgOrderValue}</p>
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-1.5 text-xs font-medium text-accent">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{rev.growthPercent}% vs last period</span>
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

        {/* Customer Growth */}
        <div className="lg:col-span-1">
          <NotchedCard 
            subtitle="Total registered" 
            title="Customers"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[320px]"
          >
            <div className="flex flex-col h-full justify-center pb-12 relative">
              <span className="text-4xl font-bold tracking-tight">
                {cust.total >= 1000 ? `${(cust.total / 1000).toFixed(1)}K` : cust.total}
              </span>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-accent">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{cust.growthPercent}% growth</span>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden pointer-events-none">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full stroke-accent drop-shadow-[0_0_8px_rgba(224,122,63,0.8)] fill-none">
                  <path d="M0 35 Q 20 32, 40 30 T 70 20 T 100 10" strokeWidth="1.5" pathLength="100" className="animate-draw-line" />
                </svg>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Weekly Visitors / Activity */}
        <div className="lg:col-span-1">
          <NotchedCard 
            subtitle="Activity trend" 
            title="Weekly Sales"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[320px]"
          >
            <div className="flex flex-col h-full justify-center pb-16 relative">
              <span className="text-4xl font-bold tracking-tight">
                ${weekly.values.reduce((a: number, b: number) => a + b, 0).toLocaleString()}
              </span>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-accent">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Active</span>
              </div>
              
              {/* Bar Chart */}
              <div className="absolute bottom-6 left-0 right-0 h-16 flex items-end justify-between gap-2 px-2">
                {weekly.values.map((val: number, i: number) => {
                  const heightPercent = maxWeekly > 0 ? Math.max((val / maxWeekly) * 100, 10) : 10;
                  return (
                    <div key={i} className="w-full flex flex-col items-center gap-2">
                      <div 
                        className={`w-full rounded-t-sm ${i === 5 ? 'bg-accent shadow-[0_0_8px_rgba(224,122,63,0.6)]' : 'bg-surface-hover border border-border'}`}
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span className="text-[9px] text-muted-foreground uppercase">{weekly.labels[i] || ['M','T','W','T','F','S','S'][i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Bottom Row */}
        
        {/* Total Sales Progress */}
        <div className="lg:col-span-2">
          <NotchedCard 
            subtitle="Volume" 
            title="Orders Volume"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[200px]"
          >
            <div className="flex flex-col h-full justify-center relative">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{totalOrdersCount}</span>
                <span className="text-sm font-medium text-muted-foreground ml-2">Total Orders Recorded</span>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-8 relative w-3/4">
                <div className="h-1.5 w-full bg-surface-hover border border-border rounded-full overflow-hidden">
                  <div className="h-full bg-accent drop-shadow-[0_0_8px_rgba(224,122,63,0.8)]" style={{ width: `${Math.min(totalOrdersCount * 5, 100)}%` }} />
                </div>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Conversion Rate */}
        <div className="lg:col-span-2">
          <NotchedCard 
            subtitle="Efficiency" 
            title="Store Conversion Rate"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[200px]"
          >
            <div className="flex items-center justify-between h-full px-4">
              <div className="flex flex-col">
                <span className="text-3xl font-bold">{conv.rate > 0 ? `${conv.rate}%` : "100%"}</span>
                <span className="text-xs text-muted-foreground mt-1">Direct storefront conversion</span>
              </div>
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <path
                    className="stroke-surface-hover fill-none"
                    strokeWidth="3"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="stroke-accent fill-none drop-shadow-[0_0_8px_rgba(224,122,63,0.6)]"
                    strokeWidth="3"
                    strokeDasharray="85, 100"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
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
            className="min-h-[350px]"
          >
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
                <span>Loading real-time orders...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-surface-hover border border-border flex items-center justify-center mb-3 text-muted-foreground">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No orders in database</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">When customers place orders on the storefront, live transaction details will appear here automatically.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto mt-4">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="pb-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4">Order #</th>
                      <th className="pb-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4">Customer</th>
                      <th className="pb-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4">Total</th>
                      <th className="pb-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4">Status</th>
                      <th className="pb-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {orders.slice(0, 8).map((order, i) => (
                      <tr key={i} className="hover:bg-surface-hover/50 transition-colors group">
                        <td className="py-4 px-4 font-semibold text-xs text-foreground">{order.orderNumber || `#ORD-${order.id}`}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-hover border border-border flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-accent">
                                {(order.customerName || "C").slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-foreground">{order.customerName || "Customer"}</span>
                              <span className="text-[10px] text-muted-foreground">{order.customerEmail || "—"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-bold text-foreground">${Number(order.totalAmount || 0).toFixed(2)}</td>
                        <td className="py-4 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border bg-accent/10 text-accent border-accent/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                            {order.status || "CONFIRMED"}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right text-xs text-muted-foreground">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="pt-4 mt-auto border-t border-border/30">
              <Link href="/orders" className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors flex items-center gap-1 mx-auto w-fit">
                View all orders <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </NotchedCard>
        </div>

      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-border/50 pt-6 flex items-center justify-between text-[11px] text-muted-foreground">
        <p>© 2026 • Live Production</p>
        <p>by <span className="font-bold text-foreground">VASTRAX</span></p>
      </footer>
    </div>
  );
}
