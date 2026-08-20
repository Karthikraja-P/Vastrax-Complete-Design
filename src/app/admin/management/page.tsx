"use client";

import React, { useState } from "react";
import { 
  Home, ChevronRight, Plus, Shield, UserCheck, UserX, Clock, Edit3, 
  Search, Calendar, Filter, RotateCcw, ChevronDown, Eye, Edit2, Trash2, 
  User, Settings, Crown, X, UserCog, ShieldCheck, UserPlus, ShieldOff
} from "lucide-react";

// --- ROLES DATA ---
const rolesData = [
  { name: "Viewer", guard: "web", dateCreated: "08/17/2026", dateUpdated: "08/17/2026", icon: User },
  { name: "Editor", guard: "web", dateCreated: "08/17/2026", dateUpdated: "08/17/2026", icon: Edit2 },
  { name: "Manager", guard: "web", dateCreated: "08/17/2026", dateUpdated: "08/17/2026", icon: Settings },
  { name: "Admin", guard: "web", dateCreated: "08/17/2026", dateUpdated: "08/17/2026", icon: Shield },
  { name: "Super Admin", guard: "web", dateCreated: "08/17/2026", dateUpdated: "08/17/2026", icon: Crown },
];

const rolesMetrics = [
  { label: "Total Roles", value: "5", icon: Shield, color: "text-accent", glow: "shadow-[-4px_0_15px_rgba(224,122,63,0.3)]", border: "border-l-accent" },
  { label: "Active Roles", value: "2", icon: UserCheck, color: "text-emerald-500", glow: "shadow-[-4px_0_15px_rgba(16,185,129,0.2)]", border: "border-l-emerald-500" },
  { label: "Inactive Roles", value: "3", icon: UserX, color: "text-yellow-500", glow: "shadow-[-4px_0_15px_rgba(234,179,8,0.2)]", border: "border-l-yellow-500" },
  { label: "Recently Added", value: "5", icon: Clock, color: "text-blue-500", glow: "shadow-[-4px_0_15px_rgba(59,130,246,0.2)]", border: "border-l-blue-500" },
  { label: "Recently Updated", value: "0", icon: Edit3, color: "text-muted-foreground", glow: "shadow-[-4px_0_15px_rgba(161,161,170,0.1)]", border: "border-l-muted-foreground/30" },
];

// const adminsData = [ ... ] // Replaced by dynamic fetch

const adminsMetrics = [
  { label: "Total Admins", value: "73", icon: UserCog, color: "text-accent", glow: "shadow-[-4px_0_15px_rgba(224,122,63,0.3)]", border: "border-l-accent" },
  { label: "Admins with Roles", value: "73", icon: ShieldCheck, color: "text-emerald-500", glow: "shadow-[-4px_0_15px_rgba(16,185,129,0.2)]", border: "border-l-emerald-500" },
  { label: "Recently Added", value: "73", icon: UserPlus, color: "text-blue-500", glow: "shadow-[-4px_0_15px_rgba(59,130,246,0.2)]", border: "border-l-blue-500" },
  { label: "Recently Updated", value: "73", icon: Clock, color: "text-yellow-500", glow: "shadow-[-4px_0_15px_rgba(234,179,8,0.2)]", border: "border-l-yellow-500" },
  { label: "Admins without Roles", value: "0", icon: ShieldOff, color: "text-red-500", glow: "shadow-[-4px_0_15px_rgba(239,68,68,0.2)]", border: "border-l-red-500" },
];

export default function AdminManagementPage() {
  const [activeTab, setActiveTab] = useState<"admins" | "roles">("admins");
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [adminsData, setAdminsData] = useState<any[]>([]);

  React.useEffect(() => {
    async function fetchAdmins() {
      try {
        const res = await fetch("http://localhost:8000/api/v1/users/admin/admins", {
          // Note: In real setup, send NextAuth session token
        });
        if (res.ok) {
          const data = await res.json();
          const mapped = data.map((admin: any) => ({
            id: admin.id,
            name: admin.full_name,
            role: "Admin",
            email: admin.email,
            phone: "—",
            date: new Date(admin.created_at).toLocaleDateString()
          }));
          setAdminsData(mapped);
        }
      } catch(err) {
        console.error("Failed to fetch admins:", err);
      }
    }
    fetchAdmins();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors">Dashboard</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Admin Management</span>
      </div>

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage admin users and their access</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Tab Switcher */}
          <div className="flex p-1 bg-surface border border-border rounded-lg">
            <button
              onClick={() => {
                setActiveTab("admins");
                setOpenActionId(null);
              }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === "admins"
                  ? "bg-accent text-white shadow-[0_0_10px_rgba(224,122,63,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Admins
            </button>
            <button
              onClick={() => {
                setActiveTab("roles");
                setOpenActionId(null);
              }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === "roles"
                  ? "bg-accent text-white shadow-[0_0_10px_rgba(224,122,63,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Roles
            </button>
          </div>

          {activeTab === "admins" ? (
            <button 
              onClick={() => setIsAddAdminOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-full transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Admin
            </button>
          ) : (
            <button 
              onClick={() => setIsAddRoleOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-full transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Role
            </button>
          )}
        </div>
      </div>

      {/* Conditional Rendering based on Tab */}
      {activeTab === "admins" ? (
        // ================= ADMINS VIEW =================
        <div className="animate-in fade-in duration-500 space-y-6">
          {/* Admins Metric Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
            {adminsMetrics.map((metric, i) => (
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

          {/* Admins Filters Section */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex flex-col lg:flex-row items-end gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 w-full">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Search</label>
                  <input type="text" placeholder="Search admins..." className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Email</label>
                  <input type="text" placeholder="Filter by email" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Phone</label>
                  <input type="text" placeholder="Filter by phone" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Name</label>
                  <input type="text" placeholder="Search by first/last name" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 mt-4 lg:mt-0 w-full lg:w-auto">
                <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-lg transition-colors shadow-[0_0_10px_rgba(224,122,63,0.3)]">
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
                <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm rounded-lg transition-colors whitespace-nowrap">
                  <RotateCcw className="w-4 h-4" />
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Admins Data Table */}
          <div className="bg-surface border border-border rounded-xl overflow-visible pb-32">
            <div className="overflow-visible">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {adminsData.map((admin, index) => (
                    <tr key={index} className="hover:bg-surface-hover transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-xs font-bold text-foreground">
                            {admin.name?.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{admin.name}</span>
                            <span className="text-[10px] font-semibold text-accent px-1.5 py-0.5 rounded-sm bg-accent/10 border border-accent/20 w-fit mt-0.5">{admin.role}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-foreground font-medium">
                        {admin.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                        {admin.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                        {admin.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap relative">
                        <button 
                          onClick={() => setOpenActionId(openActionId === admin.id ? null : admin.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-background border border-border hover:bg-border/50 text-xs font-medium text-foreground transition-colors"
                        >
                          Actions
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        </button>
                        
                        {openActionId === admin.id && (
                          <div className="absolute top-full left-6 z-50 w-36 mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="py-1">
                              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors">
                                <Eye className="w-4 h-4 text-muted-foreground" /> View
                              </button>
                              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors">
                                <Edit2 className="w-4 h-4 text-muted-foreground" /> Edit
                              </button>
                              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors">
                                <ShieldCheck className="w-4 h-4 text-muted-foreground" /> Assign Roles
                              </button>
                              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
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
        </div>
      ) : (
        // ================= ROLES VIEW =================
        <div className="animate-in fade-in duration-500 space-y-6">
          {/* Roles Metric Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
            {rolesMetrics.map((metric, i) => (
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

          {/* Roles Filters Section */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex flex-col lg:flex-row items-end gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 w-full">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Name</label>
                  <input type="text" placeholder="Search role name" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Guard Name</label>
                  <input type="text" placeholder="Search guard name" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Created From</label>
                  <div className="relative">
                    <input type="text" placeholder="Select start date" className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60 cursor-pointer" />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Created To</label>
                  <div className="relative">
                    <input type="text" placeholder="Select end date" className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60 cursor-pointer" />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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

          {/* Roles Data Table */}
          <div className="bg-surface border border-border rounded-xl overflow-visible pb-32">
            <div className="overflow-visible">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4">Updated Date</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rolesData.map((role, index) => (
                    <tr key={index} className="hover:bg-surface-hover transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors shadow-sm">
                            <role.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{role.name}</p>
                            <p className="text-[11px] text-muted-foreground">{role.guard}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                        {role.dateCreated}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                        {role.dateUpdated}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap relative">
                        <button 
                          onClick={() => setOpenActionId(openActionId === String(index) ? null : String(index))}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-background border border-border hover:bg-border/50 text-xs font-medium text-foreground transition-colors"
                        >
                          Actions
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        </button>
                        
                        {openActionId === String(index) && (
                          <div className="absolute top-full left-6 z-50 w-36 mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="py-1">
                              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors">
                                <Eye className="w-4 h-4 text-muted-foreground" /> View
                              </button>
                              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors">
                                <Edit2 className="w-4 h-4 text-muted-foreground" /> Edit
                              </button>
                              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
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
        </div>
      )}

      {/* --- SLIDEOVERS --- */}
      
      {/* Add Admin Slide-over */}
      {isAddAdminOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setIsAddAdminOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#1a1a1a] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white">Add New Admin</h2>
              <button onClick={() => setIsAddAdminOpen(false)} className="p-2 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white flex gap-1">Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter full name" className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white flex gap-1">Email Address <span className="text-red-500">*</span></label>
                <input type="email" placeholder="Enter email address" className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white flex gap-1">Select Role <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select defaultValue="" className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent transition-all appearance-none cursor-pointer">
                    <option value="" disabled>Select a role</option>
                    <option value="superadmin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-white/5 flex items-center justify-end gap-3 bg-[#1a1a1a]">
              <button onClick={() => setIsAddAdminOpen(false)} className="px-5 py-2 rounded-full border border-white/10 hover:bg-white/5 text-sm font-medium text-white transition-colors">Cancel</button>
              <button className="px-5 py-2 rounded-full bg-accent hover:bg-accent/90 text-sm font-medium text-white transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)]">Create Admin</button>
            </div>
          </div>
        </>
      )}

      {/* Add Role Slide-over */}
      {isAddRoleOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setIsAddRoleOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#1a1a1a] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white">Add New Role</h2>
              <button onClick={() => setIsAddRoleOpen(false)} className="p-2 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white flex gap-1">Role Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter role name" className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent transition-all" />
              </div>
            </div>
            <div className="p-6 border-t border-white/5 flex items-center justify-end gap-3 bg-[#1a1a1a]">
              <button onClick={() => setIsAddRoleOpen(false)} className="px-5 py-2 rounded-full border border-white/10 hover:bg-white/5 text-sm font-medium text-white transition-colors">Cancel</button>
              <button className="px-5 py-2 rounded-full bg-accent hover:bg-accent/90 text-sm font-medium text-white transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)]">Create Role</button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
