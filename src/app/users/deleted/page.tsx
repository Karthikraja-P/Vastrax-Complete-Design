"use client";

import React, { useState } from "react";
import { 
  Home, ChevronRight, Users, UserMinus, ShieldAlert, ShieldCheck, UserPlus, 
  ChevronDown, Filter, RotateCcw, RotateCcw as RestoreIcon, Trash2
} from "lucide-react";

const deletedUsersData = [
  { name: "Mia Wright", email: "mia.wright@example.com", phone: "+1555666888", status: "Verified", date: "08/08/2026" },
  { name: "Ethan King", email: "ethan.king@example.com", phone: "+1555222444", status: "Verified", date: "01/08/2026" },
  { name: "Isabella Allen", email: "isabella.allen@example.com", phone: "+1555000111", status: "Verified", date: "25/07/2026" },
  { name: "Joshua Walker", email: "joshua.walker@example.com", phone: "+1555888999", status: "Verified", date: "12/08/2026" },
  { name: "Ava Robinson", email: "ava.robinson@example.com", phone: "+1555666777", status: "Verified", date: "09/08/2026" },
  { name: "Andrew Clark", email: "andrew.clark@example.com", phone: "+1555444555", status: "Verified", date: "20/07/2026" },
  { name: "Emma Jackson", email: "emma.jackson@example.com", phone: "+1555222333", status: "Verified", date: "12/08/2026" },
  { name: "Matthew Thompson", email: "matthew.thompson@example.com", phone: "+1555999000", status: "Verified", date: "15/08/2026" },
  { name: "Olivia Martin", email: "olivia.martin@example.com", phone: "+1555777888", status: "Verified", date: "19/07/2026" },
  { name: "Daniel Harris", email: "daniel.harris@example.com", phone: "+1555555666", status: "Verified", date: "28/07/2026" },
];

const metrics = [
  { label: "Total Users", value: "17", icon: Users, color: "text-accent", glow: "shadow-[-4px_0_15px_rgba(224,122,63,0.3)]", border: "border-l-accent" },
  { label: "Deleted Users", value: "12", icon: UserMinus, color: "text-red-500", glow: "shadow-[-4px_0_15px_rgba(239,68,68,0.2)]", border: "border-l-red-500" },
  { label: "Unverified Users", value: "5", icon: ShieldAlert, color: "text-yellow-500", glow: "shadow-[-4px_0_15px_rgba(234,179,8,0.2)]", border: "border-l-yellow-500" },
  { label: "Verified Users", value: "12", icon: ShieldCheck, color: "text-emerald-500", glow: "shadow-[-4px_0_15px_rgba(16,185,129,0.2)]", border: "border-l-emerald-500" },
  { label: "New This Week", value: "7", icon: UserPlus, color: "text-blue-500", glow: "shadow-[-4px_0_15px_rgba(59,130,246,0.2)]", border: "border-l-blue-500" },
];

export default function DeletedUsersPage() {
  const [openActionId, setOpenActionId] = useState<number | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors">Dashboard</span>
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors">Users</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Deleted</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Deleted Users</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage deleted users and restore accounts</p>
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

      {/* Advanced Filter Section */}
      <div className="bg-surface border border-border rounded-xl p-5 mt-6 space-y-4">
        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Email</label>
            <input type="text" placeholder="Filter by email" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Phone</label>
            <input type="text" placeholder="Filter by phone" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Country</label>
            <div className="relative">
              <select defaultValue="" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-muted-foreground appearance-none cursor-pointer">
                <option value="" disabled>All countries</option>
                <option value="us">United States</option>
                <option value="uk">United Kingdom</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Username</label>
            <input type="text" placeholder="Filter by username" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">First Name</label>
            <input type="text" placeholder="Filter by first name" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Last Name</label>
            <input type="text" placeholder="Filter by last name" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Verification</label>
            <div className="relative">
              <select defaultValue="" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-muted-foreground appearance-none cursor-pointer">
                <option value="" disabled>Any status</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">From Date</label>
            <div className="relative">
              <input type="text" placeholder="YYYY-MM-DD" className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">To Date</label>
            <div className="relative">
              <input type="text" placeholder="YYYY-MM-DD" className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            </div>
          </div>
          <div className="flex items-end gap-3 lg:col-span-1 pt-1.5">
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-lg transition-colors shadow-[0_0_10px_rgba(224,122,63,0.3)]">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-2 bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm rounded-lg transition-colors whitespace-nowrap">
              <RotateCcw className="w-4 h-4" />
              Reset Filters
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
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deletedUsersData.map((user, index) => (
                <tr key={index} className="hover:bg-surface-hover transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-xs font-bold text-foreground">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-medium text-foreground opacity-50 line-through">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground opacity-50 line-through">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground opacity-50">
                    {user.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center opacity-70">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border inline-block min-w-[70px] ${
                      user.status === 'Verified' 
                        ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' 
                        : 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-foreground opacity-50">
                    {user.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap relative">
                    <button 
                      onClick={() => setOpenActionId(openActionId === index ? null : index)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background border border-border hover:bg-border/50 text-xs font-medium text-foreground transition-colors"
                    >
                      Actions
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </button>
                    
                    {/* Simplified Action Dropdown for Deleted Users */}
                    {openActionId === index && (
                      <div className="absolute top-full right-6 z-50 w-48 mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="py-1">
                          <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-surface-hover transition-colors">
                            <RestoreIcon className="w-4 h-4 text-emerald-500" /> Restore User
                          </button>
                          <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-4 h-4" /> Permanently Delete
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
          Showing <span className="font-bold text-foreground">1</span> to <span className="font-bold text-foreground">10</span> of <span className="font-bold text-foreground">12</span> results
        </p>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md border border-border bg-background hover:bg-surface-hover text-xs font-medium text-muted-foreground transition-colors opacity-50 cursor-not-allowed">Previous</button>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-md bg-accent text-white font-bold text-xs shadow-[0_0_8px_rgba(224,122,63,0.4)]">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-surface-hover font-medium text-xs text-foreground transition-colors">2</button>
          </div>
          <button className="px-3 py-1.5 rounded-md border border-border bg-background hover:bg-surface-hover text-xs font-medium text-foreground transition-colors">Next</button>
        </div>
      </div>

    </div>
  );
}
