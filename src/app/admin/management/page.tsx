"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Home, ChevronRight, Plus, Shield, UserCheck, UserX, Clock, Edit3, 
  Search, Calendar, Filter, RotateCcw, ChevronDown, Eye, Edit2, Trash2, 
  User, Settings, Crown, X as XIcon, UserCog, ShieldCheck, UserPlus, ShieldOff,
  Mail, Phone, AlertCircle, Loader2, Check
} from "lucide-react";
import Link from "next/link";
import { usersApi } from "@/lib/api";

export default function AdminManagementPage() {
  const [activeTab, setActiveTab] = useState<"admins" | "roles">("admins");
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // --- ADMINS STATE ---
  const [adminsData, setAdminsData] = useState<any[]>([]);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [selectedAdminDetails, setSelectedAdminDetails] = useState<any | null>(null);
  const [adminToDelete, setAdminToDelete] = useState<any | null>(null);
  const [adminToAssignRole, setAdminToAssignRole] = useState<any | null>(null);

  // Add Admin Form
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("Admin");

  // Admin Filters
  const [adminSearch, setAdminSearch] = useState("");
  const [adminEmailFilter, setAdminEmailFilter] = useState("");
  const [adminRoleFilter, setAdminRoleFilter] = useState("");
  const [adminCurrentPage, setAdminCurrentPage] = useState(1);
  const pageSize = 10;

  // --- ROLES STATE ---
  const [rolesData, setRolesData] = useState<any[]>([
    { id: "role-1", name: "Super Admin", guard: "web", desc: "Full root access to all store and platform settings", status: "Active", dateCreated: "Aug 15, 2026", icon: Crown },
    { id: "role-2", name: "Admin", guard: "web", desc: "Access to inventory, orders, products, and metrics", status: "Active", dateCreated: "Aug 16, 2026", icon: Shield },
    { id: "role-3", name: "Manager", guard: "web", desc: "Manage store orders and customer support requests", status: "Active", dateCreated: "Aug 17, 2026", icon: Settings },
    { id: "role-4", name: "Editor", guard: "web", desc: "Curate looks, update descriptions, and organize catalog", status: "Inactive", dateCreated: "Aug 17, 2026", icon: Edit2 },
    { id: "role-5", name: "Viewer", guard: "web", desc: "Read-only access to store telemetry and reporting", status: "Inactive", dateCreated: "Aug 18, 2026", icon: User },
  ]);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [selectedRoleDetails, setSelectedRoleDetails] = useState<any | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<any | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRoleGuard, setNewRoleGuard] = useState("web");

  // Role Filters
  const [roleSearch, setRoleSearch] = useState("");
  const [roleGuardFilter, setRoleGuardFilter] = useState("");
  const [roleCurrentPage, setRoleCurrentPage] = useState(1);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    async function loadAdmins() {
      setLoading(true);
      try {
        const data = await usersApi.listAll();
        if (data && Array.isArray(data)) {
          const mapped = data
            .filter((u: any) => u.role === 'admin' || u.role === 'Admin' || u.role === 'Super Admin' || u.role === 'super_admin' || u.role === 'manager')
            .map((admin: any) => ({
              id: String(admin.id),
              name: `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || admin.full_name || admin.name || "System Administrator",
              role: String(admin.role || "Admin").charAt(0).toUpperCase() + String(admin.role || "Admin").slice(1),
              email: admin.email || "—",
              phone: admin.phone_number || admin.phone || "+1 (800) 827-8729",
              date: admin.created_at ? new Date(admin.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent"
            }));
          setAdminsData(mapped.length > 0 ? mapped : [
            {
              id: "usr-admin-01",
              name: "System Administrator",
              role: "Admin",
              email: "admin@vastrax.luxury",
              phone: "+1 (800) 827-8729",
              date: "Aug 20, 2026"
            }
          ]);
        }
      } catch (err) {
        console.error("Failed to fetch admins:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAdmins();
  }, []);

  // --- ADMIN ACTIONS ---
  const handleResetAdminFilters = () => {
    setAdminSearch("");
    setAdminEmailFilter("");
    setAdminRoleFilter("");
    setAdminCurrentPage(1);
  };

  const handleCreateAdmin = () => {
    if (!newAdminName.trim() || !newAdminEmail.trim()) return;
    const newAdmin = {
      id: `adm-${Date.now()}`,
      name: newAdminName,
      email: newAdminEmail,
      role: newAdminRole,
      phone: "+1 (555) 123-4567",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    };
    setAdminsData(prev => [newAdmin, ...prev]);
    setNewAdminName("");
    setNewAdminEmail("");
    setIsAddAdminOpen(false);
    showToast(`Admin account "${newAdmin.name}" created with role ${newAdmin.role}.`);
  };

  const handleDeleteAdmin = () => {
    if (!adminToDelete) return;
    setAdminsData(prev => prev.filter(a => a.id !== adminToDelete.id));
    showToast(`Admin account "${adminToDelete.name}" removed.`);
    setAdminToDelete(null);
    setOpenActionId(null);
  };

  const handleSaveAssignedRole = (newRole: string) => {
    if (!adminToAssignRole) return;
    setAdminsData(prev => prev.map(a => a.id === adminToAssignRole.id ? { ...a, role: newRole } : a));
    showToast(`Role for "${adminToAssignRole.name}" updated to ${newRole}.`);
    setAdminToAssignRole(null);
  };

  // --- ROLE ACTIONS ---
  const handleResetRoleFilters = () => {
    setRoleSearch("");
    setRoleGuardFilter("");
    setRoleCurrentPage(1);
  };

  const handleCreateRole = () => {
    if (!newRoleName.trim()) return;
    const newRole = {
      id: `role-${Date.now()}`,
      name: newRoleName,
      guard: newRoleGuard,
      desc: newRoleDesc || "Custom security role permissions",
      status: "Active",
      dateCreated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      icon: Shield
    };
    setRolesData(prev => [newRole, ...prev]);
    setNewRoleName("");
    setNewRoleDesc("");
    setIsAddRoleOpen(false);
    showToast(`Role "${newRole.name}" created successfully.`);
  };

  const handleToggleRoleStatus = (roleId: string) => {
    setRolesData(prev => prev.map(r => {
      if (r.id === roleId) {
        const nextStatus = r.status === "Active" ? "Inactive" : "Active";
        showToast(`Role "${r.name}" status updated to ${nextStatus}.`);
        if (selectedRoleDetails && selectedRoleDetails.id === roleId) {
          setSelectedRoleDetails({ ...selectedRoleDetails, status: nextStatus });
        }
        return { ...r, status: nextStatus };
      }
      return r;
    }));
    setOpenActionId(null);
  };

  const handleDeleteRole = () => {
    if (!roleToDelete) return;
    setRolesData(prev => prev.filter(r => r.id !== roleToDelete.id));
    showToast(`Role "${roleToDelete.name}" deleted.`);
    setRoleToDelete(null);
    setOpenActionId(null);
  };

  // Filtered Lists
  const filteredAdmins = useMemo(() => {
    return adminsData.filter((a) => {
      const matchesSearch = !adminSearch.trim() || a.name.toLowerCase().includes(adminSearch.toLowerCase());
      const matchesEmail = !adminEmailFilter.trim() || a.email.toLowerCase().includes(adminEmailFilter.toLowerCase());
      const matchesRole = !adminRoleFilter || a.role.toLowerCase() === adminRoleFilter.toLowerCase();
      return matchesSearch && matchesEmail && matchesRole;
    });
  }, [adminsData, adminSearch, adminEmailFilter, adminRoleFilter]);

  const filteredRoles = useMemo(() => {
    return rolesData.filter((r) => {
      const matchesSearch = !roleSearch.trim() || r.name.toLowerCase().includes(roleSearch.toLowerCase());
      const matchesGuard = !roleGuardFilter || r.guard.toLowerCase() === roleGuardFilter.toLowerCase();
      return matchesSearch && matchesGuard;
    });
  }, [rolesData, roleSearch, roleGuardFilter]);

  // Paginations
  const adminTotalPages = Math.ceil(filteredAdmins.length / pageSize);
  const paginatedAdmins = useMemo(() => {
    const start = (adminCurrentPage - 1) * pageSize;
    return filteredAdmins.slice(start, start + pageSize);
  }, [filteredAdmins, adminCurrentPage, pageSize]);

  const roleTotalPages = Math.ceil(filteredRoles.length / pageSize);
  const paginatedRoles = useMemo(() => {
    const start = (roleCurrentPage - 1) * pageSize;
    return filteredRoles.slice(start, start + pageSize);
  }, [filteredRoles, roleCurrentPage, pageSize]);

  // Dynamic Metrics
  const adminsMetrics = [
    { label: "Total Admins", value: String(adminsData.length), icon: UserCog, color: "text-accent", glow: "shadow-[-4px_0_15px_rgba(224,122,63,0.3)]", border: "border-l-accent" },
    { label: "Super Admins", value: String(adminsData.filter(a => a.role === "Super Admin" || a.role === "Superadmin").length || 1), icon: Crown, color: "text-amber-400", glow: "shadow-[-4px_0_15px_rgba(251,191,36,0.2)]", border: "border-l-amber-400" },
    { label: "Admins", value: String(adminsData.filter(a => a.role === "Admin").length || adminsData.length), icon: ShieldCheck, color: "text-emerald-500", glow: "shadow-[-4px_0_15px_rgba(16,185,129,0.2)]", border: "border-l-emerald-500" },
    { label: "Active Roles", value: String(rolesData.filter(r => r.status === "Active").length), icon: Shield, color: "text-blue-500", glow: "shadow-[-4px_0_15px_rgba(59,130,246,0.2)]", border: "border-l-blue-500" },
  ];

  const rolesMetrics = [
    { label: "Total Roles", value: String(rolesData.length), icon: Shield, color: "text-accent", glow: "shadow-[-4px_0_15px_rgba(224,122,63,0.3)]", border: "border-l-accent" },
    { label: "Active Roles", value: String(rolesData.filter(r => r.status === "Active").length), icon: UserCheck, color: "text-emerald-500", glow: "shadow-[-4px_0_15px_rgba(16,185,129,0.2)]", border: "border-l-emerald-500" },
    { label: "Inactive Roles", value: String(rolesData.filter(r => r.status === "Inactive").length), icon: UserX, color: "text-yellow-500", glow: "shadow-[-4px_0_15px_rgba(234,179,8,0.2)]", border: "border-l-yellow-500" },
    { label: "System Guards", value: "web / api", icon: ShieldCheck, color: "text-blue-500", glow: "shadow-[-4px_0_15px_rgba(59,130,246,0.2)]", border: "border-l-blue-500" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-accent text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <Link href="/" className="cursor-pointer hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Admin Management</span>
      </div>

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">Configure administrator accounts, permissions, and security roles</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex p-1 bg-surface border border-border rounded-lg">
            <button
              onClick={() => { setActiveTab("admins"); setOpenActionId(null); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === "admins"
                  ? "bg-accent text-white shadow-[0_0_10px_rgba(224,122,63,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Admins ({adminsData.length})
            </button>
            <button
              onClick={() => { setActiveTab("roles"); setOpenActionId(null); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === "roles"
                  ? "bg-accent text-white shadow-[0_0_10px_rgba(224,122,63,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Roles ({rolesData.length})
            </button>
          </div>

          {activeTab === "admins" ? (
            <button 
              onClick={() => setIsAddAdminOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white font-semibold text-xs rounded-full transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Admin
            </button>
          ) : (
            <button 
              onClick={() => setIsAddRoleOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white font-semibold text-xs rounded-full transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] shrink-0"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
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

          {/* Admins Filters Section */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex flex-col lg:flex-row items-end gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Name</label>
                  <input 
                    type="text" 
                    value={adminSearch}
                    onChange={(e) => { setAdminSearch(e.target.value); setAdminCurrentPage(1); }}
                    placeholder="Search admin name..." 
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Email</label>
                  <input 
                    type="text" 
                    value={adminEmailFilter}
                    onChange={(e) => { setAdminEmailFilter(e.target.value); setAdminCurrentPage(1); }}
                    placeholder="Filter by email..." 
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Role</label>
                  <div className="relative">
                    <select 
                      value={adminRoleFilter}
                      onChange={(e) => { setAdminRoleFilter(e.target.value); setAdminCurrentPage(1); }}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer"
                    >
                      <option value="">All Roles</option>
                      <option value="super admin">Super Admin</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 mt-4 lg:mt-0 w-full lg:w-auto">
                <button 
                  onClick={handleResetAdminFilters}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm rounded-lg transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Admins Data Table */}
          <div className="bg-surface border border-border rounded-xl mt-6">
            <div className="overflow-x-auto min-h-[320px] pb-28 overflow-y-visible">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4">Name &amp; Role</th>
                    <th className="px-6 py-4">Email Address</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-accent" />
                          <span>Loading admin accounts...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center">
                          <UserCog className="w-8 h-8 text-muted-foreground/50 mb-2" />
                          <p className="text-sm font-semibold text-foreground">No administrator accounts found</p>
                          <p className="text-xs text-muted-foreground mt-1">Try clearing filters or add a new administrator.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedAdmins.map((admin, index) => (
                      <tr key={admin.id || index} className="hover:bg-surface-hover/50 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-surface-hover border border-border flex items-center justify-center text-xs font-bold text-accent">
                              {admin.name?.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{admin.name}</span>
                              <span className="text-[10px] font-semibold text-accent px-1.5 py-0.5 rounded-sm bg-accent/10 border border-accent/20 w-fit mt-0.5">{admin.role}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-foreground font-medium text-xs">
                          {admin.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground text-xs">
                          {admin.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-muted-foreground text-xs">
                          {admin.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right relative">
                          <div className="relative inline-block text-left">
                            <button 
                              onClick={() => setOpenActionId(openActionId === admin.id ? null : admin.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border hover:bg-surface-hover text-xs font-medium text-foreground transition-colors ml-auto"
                            >
                              Actions
                              <ChevronDown className="w-3 h-3 text-muted-foreground" />
                            </button>
                            
                            {openActionId === admin.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenActionId(null)} />
                                <div className="absolute right-0 top-full mt-1.5 w-44 bg-background border border-border rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                                  <button 
                                    onClick={() => {
                                      setSelectedAdminDetails(admin);
                                      setOpenActionId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface-hover hover:text-accent transition-colors text-left"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-muted-foreground" /> View Profile
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setAdminToAssignRole(admin);
                                      setOpenActionId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface-hover hover:text-accent transition-colors text-left"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Assign Role
                                  </button>
                                  <div className="h-px bg-border/40 my-1" />
                                  <button 
                                    onClick={() => {
                                      setAdminToDelete(admin);
                                      setOpenActionId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors text-left"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Remove Admin
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

          {/* Conditional Pagination */}
          {filteredAdmins.length > pageSize && (
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-bold text-foreground">{(adminCurrentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-foreground">{Math.min(adminCurrentPage * pageSize, filteredAdmins.length)}</span> of <span className="font-bold text-foreground">{filteredAdmins.length}</span> admins
              </p>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setAdminCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={adminCurrentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-surface-hover text-xs font-medium text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setAdminCurrentPage(prev => Math.min(prev + 1, adminTotalPages))}
                  disabled={adminCurrentPage === adminTotalPages}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-surface-hover text-xs font-medium text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // ================= ROLES VIEW =================
        <div className="animate-in fade-in duration-500 space-y-6">
          {/* Roles Metric Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Role Name</label>
                  <input 
                    type="text" 
                    value={roleSearch}
                    onChange={(e) => { setRoleSearch(e.target.value); setRoleCurrentPage(1); }}
                    placeholder="Search role name..." 
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Guard Name</label>
                  <div className="relative">
                    <select 
                      value={roleGuardFilter}
                      onChange={(e) => { setRoleGuardFilter(e.target.value); setRoleCurrentPage(1); }}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer"
                    >
                      <option value="">All Guards</option>
                      <option value="web">web (Next.js Application)</option>
                      <option value="api">api (FastAPI Engine)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 mt-4 lg:mt-0 w-full lg:w-auto">
                <button 
                  onClick={handleResetRoleFilters}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm rounded-lg transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Roles Data Table */}
          <div className="bg-surface border border-border rounded-xl mt-6">
            <div className="overflow-x-auto min-h-[320px] pb-28 overflow-y-visible">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4">Role Details</th>
                    <th className="px-6 py-4">Guard Type</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedRoles.map((role) => (
                    <tr key={role.id} className="hover:bg-surface-hover/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:text-accent transition-colors shadow-sm">
                            <role.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{role.name}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{role.desc}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {role.guard}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleRoleStatus(role.id)}
                          title="Click to toggle Active / Inactive status"
                          className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all hover:scale-105 inline-block min-w-[70px] ${
                            role.status === 'Active' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20' : 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20'
                          }`}
                        >
                          {role.status}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-muted-foreground text-xs">
                        {role.dateCreated}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right relative">
                        <div className="relative inline-block text-left">
                          <button 
                            onClick={() => setOpenActionId(openActionId === role.id ? null : role.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border hover:bg-surface-hover text-xs font-medium text-foreground transition-colors ml-auto"
                          >
                            Actions
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                          </button>
                          
                          {openActionId === role.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenActionId(null)} />
                              <div className="absolute right-0 top-full mt-1.5 w-44 bg-background border border-border rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                                <button 
                                  onClick={() => {
                                    setSelectedRoleDetails(role);
                                    setOpenActionId(null);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface-hover hover:text-accent transition-colors text-left"
                                >
                                  <Eye className="w-3.5 h-3.5 text-muted-foreground" /> View Permissions
                                </button>
                                <button 
                                  onClick={() => handleToggleRoleStatus(role.id)}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface-hover hover:text-accent transition-colors text-left"
                                >
                                  {role.status === "Active" ? (
                                    <>
                                      <UserX className="w-3.5 h-3.5 text-yellow-500" /> Set as Inactive
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Set as Active
                                    </>
                                  )}
                                </button>
                                <div className="h-px bg-border/40 my-1" />
                                <button 
                                  onClick={() => {
                                    setRoleToDelete(role);
                                    setOpenActionId(null);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors text-left"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete Role
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- SLIDEOVERS & MODALS --- */}
      
      {/* Add Admin Slide-over */}
      {isAddAdminOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setIsAddAdminOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Add New Administrator</h2>
              <button onClick={() => setIsAddAdminOpen(false)} className="p-2 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Full Name <span className="text-accent">*</span></label>
                <input 
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="e.g. Liam Vance"
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Email Address <span className="text-accent">*</span></label>
                <input 
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="liam.vance@atelier.com"
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Select Role <span className="text-accent">*</span></label>
                <div className="relative">
                  <select 
                    value={newAdminRole}
                    onChange={(e) => setNewAdminRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border flex items-center justify-end gap-3 bg-surface">
              <button onClick={() => setIsAddAdminOpen(false)} className="px-5 py-2 rounded-full border border-border hover:bg-surface-hover text-xs font-semibold text-foreground transition-colors">Cancel</button>
              <button 
                onClick={handleCreateAdmin}
                disabled={!newAdminName.trim() || !newAdminEmail.trim()}
                className="px-5 py-2 rounded-full bg-accent hover:bg-accent/90 text-xs font-semibold text-white transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] disabled:opacity-50"
              >
                Create Admin
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add Role Slide-over */}
      {isAddRoleOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setIsAddRoleOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Add New Security Role</h2>
              <button onClick={() => setIsAddRoleOpen(false)} className="p-2 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Role Name <span className="text-accent">*</span></label>
                <input 
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Lead Stylist"
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Guard</label>
                <div className="relative">
                  <select 
                    value={newRoleGuard}
                    onChange={(e) => setNewRoleGuard(e.target.value)}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="web">web (Next.js Application)</option>
                    <option value="api">api (FastAPI Engine)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <textarea 
                  rows={3}
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Permissions and security scope..."
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-border flex items-center justify-end gap-3 bg-surface">
              <button onClick={() => setIsAddRoleOpen(false)} className="px-5 py-2 rounded-full border border-border hover:bg-surface-hover text-xs font-semibold text-foreground transition-colors">Cancel</button>
              <button 
                onClick={handleCreateRole}
                disabled={!newRoleName.trim()}
                className="px-5 py-2 rounded-full bg-accent hover:bg-accent/90 text-xs font-semibold text-white transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] disabled:opacity-50"
              >
                Create Role
              </button>
            </div>
          </div>
        </>
      )}

      {/* View Admin Details Slide-over */}
      {selectedAdminDetails && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setSelectedAdminDetails(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Administrator Details</h2>
              <button onClick={() => setSelectedAdminDetails(null)} className="p-2 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <div className="w-14 h-14 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-lg font-bold text-accent uppercase">
                  {selectedAdminDetails.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{selectedAdminDetails.name}</h3>
                  <span className="px-2 py-0.5 rounded-sm bg-accent/10 border border-accent/20 text-accent font-semibold text-[10px] inline-block mt-1">
                    {selectedAdminDetails.role}
                  </span>
                </div>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 text-accent" />
                  <span className="text-foreground font-semibold">{selectedAdminDetails.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4 text-accent" />
                  <span className="text-foreground">{selectedAdminDetails.phone}</span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border flex items-center justify-end bg-surface">
              <button onClick={() => setSelectedAdminDetails(null)} className="px-5 py-2 rounded-full bg-accent hover:bg-accent/90 text-xs font-semibold text-white transition-colors">
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Assign Role Modal */}
      {adminToAssignRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAdminToAssignRole(null)} />
          <div className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-base font-bold text-foreground mb-1">Assign Security Role</h2>
            <p className="text-xs text-muted-foreground mb-4">Select the permissions tier for &ldquo;{adminToAssignRole.name}&rdquo;.</p>
            <div className="space-y-2">
              {["Super Admin", "Admin", "Manager"].map((roleOption) => (
                <button
                  key={roleOption}
                  onClick={() => handleSaveAssignedRole(roleOption)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all ${
                    adminToAssignRole.role === roleOption 
                      ? 'border-accent bg-accent/10 text-accent' 
                      : 'border-border bg-background hover:bg-surface-hover text-foreground'
                  }`}
                >
                  <span>{roleOption}</span>
                  {adminToAssignRole.role === roleOption && <Check className="w-4 h-4 text-accent" />}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setAdminToAssignRole(null)} className="px-4 py-2 rounded-full border border-border hover:bg-surface-hover text-xs font-semibold text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Admin Modal */}
      {adminToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAdminToDelete(null)} />
          <div className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 rounded-full border border-accent/40 bg-accent/10 flex items-center justify-center mb-4 text-accent mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-2">Remove Admin &ldquo;{adminToDelete.name}&rdquo;?</h2>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              This account will lose administrator access to the management console.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleDeleteAdmin}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition-colors"
              >
                Confirm Removal
              </button>
              <button
                onClick={() => setAdminToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role Modal */}
      {roleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setRoleToDelete(null)} />
          <div className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 rounded-full border border-red-500/30 bg-red-500/10 flex items-center justify-center mb-4 text-red-500 mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-2">Delete Role &ldquo;{roleToDelete.name}&rdquo;?</h2>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Users assigned to this role may lose their specific elevated permissions.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleDeleteRole}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition-colors"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setRoleToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Role Permissions Slide-over */}
      {selectedRoleDetails && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setSelectedRoleDetails(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Role &amp; Guard Architecture</h2>
              <button onClick={() => setSelectedRoleDetails(null)} className="p-2 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="pb-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground">{selectedRoleDetails.name}</h3>
                  <button
                    onClick={() => handleToggleRoleStatus(selectedRoleDetails.id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all hover:scale-105 ${
                      selectedRoleDetails.status === 'Active' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' : 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10'
                    }`}
                  >
                    {selectedRoleDetails.status} (Click to toggle)
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{selectedRoleDetails.desc}</p>
              </div>

              {/* Guard Enforcement Specification */}
              <div className="bg-background border border-border/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-accent" />
                    Security Guard Context
                  </span>
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-surface border border-border text-accent">
                    {selectedRoleDetails.guard}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedRoleDetails.guard === "web" 
                    ? "Enforced across Next.js UI routing, management pages, client cookies, and browser dashboard navigation."
                    : "Enforced across FastAPI HTTP endpoints via Bearer JWT header (Authorization: Bearer <token>) & REST operations."
                  }
                </p>
              </div>

              {/* Granted Capabilities */}
              <div className="space-y-2.5">
                <p className="text-xs font-bold text-foreground">Enforced Capabilities:</p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Catalog &amp; Garment Taxonomy (Read, Create, Edit, Soft-Delete)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Customer Orders &amp; Fulfillment Dispatch Pipeline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Admin Directory &amp; Security Roles Management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Telemetry, Revenue Metrics, and Export Pipelines</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border flex items-center justify-between bg-surface">
              <button 
                onClick={() => handleToggleRoleStatus(selectedRoleDetails.id)} 
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Toggle {selectedRoleDetails.status === "Active" ? "Inactive" : "Active"}
              </button>
              <button onClick={() => setSelectedRoleDetails(null)} className="px-5 py-2 rounded-full bg-accent hover:bg-accent/90 text-xs font-semibold text-white transition-colors">
                Close
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
