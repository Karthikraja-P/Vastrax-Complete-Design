import { Bell, Sparkles, ChevronDown, Download, Home, ChevronRight, TrendingUp } from "lucide-react";
import { NotchedCard } from "@/components/admin/NotchedCard";

export default function Dashboard() {
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
          <p className="text-muted-foreground mt-1">Monitor key metrics and manage your platform</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium hover:text-foreground text-muted-foreground transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            This Month
            <ChevronDown className="w-4 h-4 ml-1 opacity-50" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-transparent border border-border hover:bg-surface-hover rounded-full text-sm font-medium transition-colors">
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
            subtitle="This month" 
            title="Total Revenue"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[320px]"
          >
            <div className="flex items-start justify-between h-full relative">
              <div className="flex flex-col h-full w-1/2 justify-center pb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-medium text-muted-foreground/70">$</span>
                  <span className="text-6xl font-bold tracking-tight">84.3K</span>
                </div>
                
                <div className="flex gap-6 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Orders</p>
                    <p className="text-sm font-bold">1,284</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Avg order</p>
                    <p className="text-sm font-bold">$66</p>
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-1.5 text-xs font-medium text-accent">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>18.2% vs last month</span>
                </div>
              </div>

              {/* Glowing Abstract Graphic */}
              <div className="absolute right-0 top-0 bottom-12 w-1/2 flex items-center justify-center pointer-events-none">
                <div className="animate-spin-slow">
                  <img 
                    src="https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=400&auto=format&fit=crop" 
                    className="w-48 h-48 object-cover mix-blend-screen opacity-90 drop-shadow-[0_0_15px_rgba(224,122,63,0.5)]"
                    style={{ filter: "hue-rotate(200deg) saturate(3) brightness(1.5)" }}
                    alt="Abstract 3D Structure"
                  />
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
            subtitle="Total customers" 
            title="Customer Growth"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[320px]"
          >
            <div className="flex flex-col h-full justify-center pb-12 relative">
              <span className="text-4xl font-bold tracking-tight">12.8K</span>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-accent">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>9.3% vs last month</span>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden pointer-events-none">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full stroke-accent drop-shadow-[0_0_8px_rgba(224,122,63,0.8)] fill-none">
                  <path d="M0 35 Q 20 32, 40 30 T 70 20 T 100 10" strokeWidth="1.5" pathLength="100" className="animate-draw-line" />
                </svg>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Weekly Visitors */}
        <div className="lg:col-span-1">
          <NotchedCard 
            subtitle="Last 7 days" 
            title="Weekly Visitors"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[320px]"
          >
            <div className="flex flex-col h-full justify-center pb-16 relative">
              <span className="text-4xl font-bold tracking-tight">48.2K</span>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-accent">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>12.4%</span>
              </div>
              
              {/* Bar Chart */}
              <div className="absolute bottom-6 left-0 right-0 h-16 flex items-end justify-between gap-2 px-2">
                {[40, 60, 45, 80, 50, 100, 70].map((h, i) => (
                  <div key={i} className="w-full flex flex-col items-center gap-2">
                    <div 
                      className={`w-full rounded-t-sm ${i === 5 ? 'bg-accent shadow-[0_0_8px_rgba(224,122,63,0.6)]' : 'bg-surface-hover border border-border'}`}
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground uppercase">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Bottom Row */}
        
        {/* Total Sales */}
        <div className="lg:col-span-2">
          <NotchedCard 
            subtitle="This week" 
            title="Total Sales"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[200px]"
          >
            <div className="flex flex-col h-full justify-center relative">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-medium text-muted-foreground/70">$</span>
                <span className="text-4xl font-bold tracking-tight">23.0K</span>
              </div>
              
              {/* Range Slider / Progress Bar */}
              <div className="mt-8 relative w-3/4">
                <div className="h-1.5 w-full bg-surface-hover border border-border rounded-full overflow-hidden">
                  <div className="h-full w-[60%] bg-accent drop-shadow-[0_0_8px_rgba(224,122,63,0.8)]" />
                </div>
                <div className="absolute left-[60%] top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-background border-2 border-accent rounded-full shadow-[0_0_10px_rgba(224,122,63,0.5)] flex items-center justify-center cursor-pointer">
                  <div className="w-1 h-1 bg-accent rounded-full" />
                </div>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Monthly Goal */}
        <div className="lg:col-span-1">
          <NotchedCard 
            subtitle="Revenue target" 
            title="Monthly Goal"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[200px]"
          >
            <div className="flex items-center h-full gap-6">
              <div className="relative w-24 h-24 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90 drop-shadow-[0_0_5px_rgba(224,122,63,0.5)]">
                  <path
                    className="stroke-surface-hover fill-none"
                    strokeWidth="3"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="stroke-accent fill-none"
                    strokeWidth="3"
                    strokeDasharray="72, 100"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold">72%</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold">$36K</span>
                <span className="text-xs text-muted-foreground mt-1">of $50K</span>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Conversion Rate */}
        <div className="lg:col-span-1">
          <NotchedCard 
            subtitle="Visitors to buyers" 
            title="Conversion Rate"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[200px]"
          >
            <div className="flex items-center justify-center h-full">
              <div className="relative w-28 h-28 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <path
                    className="stroke-surface-hover fill-none"
                    strokeWidth="3"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="stroke-white fill-none drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                    strokeWidth="3"
                    strokeDasharray="25, 100"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold mt-2">4.9%</span>
                  <div className="flex items-center gap-1 text-[10px] text-accent mt-0.5">
                    <TrendingUp className="w-3 h-3" />
                    <span>0.6%</span>
                  </div>
                </div>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* ROW 3 */}

        {/* Recent Orders */}
        <div className="lg:col-span-1">
          <NotchedCard 
            subtitle="Latest transactions" 
            title="Recent Orders"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[340px]"
          >
            <div className="flex flex-col h-full mt-2">
              <div className="flex-1 space-y-5">
                {[
                  { name: "Sara Malik", id: "#3021 • Paid", price: "$249" },
                  { name: "James Doyle", id: "#3020 • Pending", price: "$89" },
                  { name: "Aiko Tanaka", id: "#3019 • Paid", price: "$512" },
                  { name: "Marco Rossi", id: "#3018 • Refunded", price: "$134" }
                ].map((order, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent drop-shadow-[0_0_3px_rgba(224,122,63,0.8)]" />
                      <div>
                        <p className="text-sm font-semibold">{order.name}</p>
                        <p className="text-[10px] text-muted-foreground">{order.id}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold">{order.price}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4 mt-auto">
                <button className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors flex items-center gap-1 mx-auto">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Active Campaign */}
        <div className="lg:col-span-1">
          <NotchedCard 
            subtitle="Currently running" 
            title="Active Campaign"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[340px]"
          >
            <div className="flex flex-col h-full relative mt-4">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight">24</span>
                <div className="flex items-center gap-1 text-[10px] font-medium text-accent mb-2">
                  <TrendingUp className="w-3 h-3" />
                  <span>12%</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Total active Campaign</p>

              {/* Pill Charts */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-end gap-3 h-32">
                <div className="relative w-10 h-full bg-surface-hover rounded-full overflow-hidden flex items-end border border-border">
                  <div className="w-full bg-border h-[40%] flex flex-col items-center justify-start pt-2">
                    <span className="text-[10px] font-bold text-foreground">40%</span>
                  </div>
                </div>
                <div className="relative w-10 h-24 bg-surface-hover rounded-full overflow-hidden flex items-end border border-border">
                  <div className="w-full h-[74%] flex flex-col items-center justify-start pt-2" style={{
                    backgroundImage: 'repeating-linear-gradient(-45deg, var(--color-accent) 0, var(--color-accent) 1px, transparent 1px, transparent 4px)'
                  }}>
                    <span className="text-[10px] font-bold text-foreground bg-surface/80 rounded px-1 mt-1">74%</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-border/50">
                <p className="text-xs font-semibold">Channel mix</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Email and social lead this month's active campaigns.</p>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Sales by Region */}
        <div className="lg:col-span-2">
          <NotchedCard 
            subtitle="Top territories" 
            title="Sales by Region"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="h-[340px]"
          >
            <div className="relative w-full h-full flex items-center justify-center mt-2">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg" 
                alt="World Map" 
                className="w-full h-[220px] object-contain opacity-20 invert grayscale"
              />
              {/* Glowing Dots */}
              <div className="absolute top-[35%] left-[20%] w-2 h-2 bg-accent rounded-full shadow-[0_0_10px_rgba(224,122,63,1)]" />
              <div className="absolute top-[60%] left-[30%] w-1.5 h-1.5 bg-accent/80 rounded-full shadow-[0_0_8px_rgba(224,122,63,0.8)]" />
              <div className="absolute top-[30%] left-[50%] w-2.5 h-2.5 bg-accent rounded-full shadow-[0_0_12px_rgba(224,122,63,1)]" />
              <div className="absolute top-[45%] left-[75%] w-2 h-2 bg-accent rounded-full shadow-[0_0_10px_rgba(224,122,63,1)]" />
              <div className="absolute top-[70%] left-[85%] w-1 h-1 bg-accent/60 rounded-full shadow-[0_0_6px_rgba(224,122,63,0.6)]" />
            </div>
          </NotchedCard>
        </div>

        {/* ROW 4 */}

        {/* All Orders Table */}
        <div className="lg:col-span-4">
          <NotchedCard 
            subtitle="Full order log" 
            title="All Orders"
            actionIcon1={<Bell className="w-3.5 h-3.5" />}
            actionIcon2={<Sparkles className="w-3.5 h-3.5" />}
            className="min-h-[400px]"
          >
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
                  {[
                    { id: "#ORD-2026-1030", name: "James Garcia", email: "james.garcia@example.com", total: "$811.65", status: "Confirmed", statusType: "accent", date: "Aug 17, 2026", initial: "JG" },
                    { id: "#ORD-2026-1031", name: "John Doe", email: "john.doe@example.com", total: "$639.45", status: "Shipped", statusType: "accent", date: "Aug 16, 2026", initial: "JD" },
                    { id: "#ORD-2026-1032", name: "Jane Smith", email: "jane.smith@example.com", total: "$128.24", status: "Processing", statusType: "accent", date: "Aug 15, 2026", initial: "JS" },
                    { id: "#ORD-2026-1033", name: "Emma Wilson", email: "emma.w@example.com", total: "$450.00", status: "Delivered", statusType: "emerald", date: "Aug 14, 2026", initial: "EW" },
                    { id: "#ORD-2026-1034", name: "Michael Brown", email: "m.brown@example.com", total: "$920.50", status: "Confirmed", statusType: "accent", date: "Aug 13, 2026", initial: "MB" },
                  ].map((order, i) => (
                    <tr key={i} className="hover:bg-surface-hover/50 transition-colors group">
                      <td className="py-4 px-4 font-semibold text-xs">{order.id}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-surface-hover border border-border flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold">{order.initial}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{order.name}</span>
                            <span className="text-[10px] text-muted-foreground">{order.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-bold">{order.total}</td>
                      <td className="py-4 px-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border ${order.statusType === 'accent' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${order.statusType === 'accent' ? 'bg-accent' : 'bg-emerald-500'}`} />
                          {order.status}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right text-xs text-muted-foreground">{order.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pt-4 mt-auto border-t border-border/30">
              <button className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors flex items-center gap-1 mx-auto">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </NotchedCard>
        </div>

      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-border/50 pt-6 flex items-center justify-between text-[11px] text-muted-foreground">
        <p>© 2026 • v1.0.0</p>
        <p>by <span className="font-bold text-foreground">VASTRAX</span></p>
      </footer>
    </div>
  );
}
