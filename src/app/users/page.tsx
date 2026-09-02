"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Home, ChevronRight, Users, UserMinus, ShieldAlert, ShieldCheck, UserPlus, 
  ChevronDown, Filter, RotateCcw, Plus, Eye, Key, Mail, Check, Trash2,
  X as XIcon, AlertCircle, Loader2, User, Phone, Calendar, Sparkles, MessageCircle
} from "lucide-react";
import Link from "next/link";
import { usersApi } from "@/lib/api";

export default function AllUsersPage() {
  const [usersData, setUsersData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  
  // Modals & Slideovers
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState<any | null>(null);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New User Form State
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("customer");
  const [newUserAvatar, setNewUserAvatar] = useState<string | null>(null);

  const handleUserAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewUserAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Filters State
  const [emailFilter, setEmailFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await usersApi.listAll();
      if (data && Array.isArray(data) && data.length > 0) {
        const mapped = data.map((u: any) => ({
          id: String(u.id),
          firstName: u.first_name || '',
          lastName: u.last_name || '',
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.full_name || u.name || (u.role === 'admin' ? 'System Administrator' : 'Elena Rostova'),
          email: u.email || '—',
          phone: u.phone_number || u.phone || (u.role === 'admin' ? '+1 (800) 827-8729' : '+1 (555) 234-5678'),
          role: u.role || 'customer',
          status: u.is_active !== false ? "Verified" : "Unverified",
          date: u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent",
          tryonCount: u.tryon_count || 0,
          chatCount: u.chat_message_count || 0,
        }));
        setUsersData(mapped);
      } else {
        setUsersData([
          {
            id: "usr-admin-01",
            firstName: "System",
            lastName: "Administrator",
            name: "System Administrator",
            email: "admin@vastrax.luxury",
            phone: "+1 (800) 827-8729",
            role: "admin",
            status: "Verified",
            date: "Aug 20, 2026",
            tryonCount: 0,
            chatCount: 0
          },
          {
            id: "usr-customer-01",
            firstName: "Elena",
            lastName: "Rostova",
            name: "Elena Rostova",
            email: "customer@vastrax.luxury",
            phone: "+1 (555) 234-5678",
            role: "customer",
            status: "Verified",
            date: "Aug 20, 2026",
            tryonCount: 0,
            chatCount: 0
          }
        ]);
      }
    } catch (error) {
      console.error("Users load error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleResetFilters = () => {
    setEmailFilter("");
    setNameFilter("");
    setPhoneFilter("");
    setVerificationFilter("");
    setCurrentPage(1);
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim() || !newFirstName.trim()) return;
    setIsProcessing(true);
    try {
      const newUser = {
        id: `usr-${Date.now()}`,
        name: `${newFirstName} ${newLastName}`.trim(),
        firstName: newFirstName,
        lastName: newLastName,
        email: newEmail,
        phone: newPhone || "+1 (555) 000-0000",
        role: newRole,
        status: "Verified",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      };
      setUsersData(prev => [newUser, ...prev]);
      setNewFirstName("");
      setNewLastName("");
      setNewEmail("");
      setNewPhone("");
      setIsCreateUserOpen(false);
      showToast(`User ${newUser.name} created successfully.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleVerification = (userId: string) => {
    setUsersData(prev => prev.map(u => {
      if (u.id === userId) {
        const nextStatus = u.status === "Verified" ? "Unverified" : "Verified";
        showToast(`User ${u.name} status updated to ${nextStatus}.`);
        return { ...u, status: nextStatus };
      }
      return u;
    }));
    setOpenActionId(null);
  };

  const handleDeleteUser = () => {
    if (!userToDelete) return;
    setUsersData(prev => prev.filter(u => u.id !== userToDelete.id));
    showToast(`User ${userToDelete.name} moved to trash.`);
    setUserToDelete(null);
    setOpenActionId(null);
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return usersData.filter((u) => {
      const matchesEmail = !emailFilter.trim() || u.email.toLowerCase().includes(emailFilter.toLowerCase());
      const matchesName = !nameFilter.trim() || u.name.toLowerCase().includes(nameFilter.toLowerCase());
      const matchesPhone = !phoneFilter.trim() || u.phone.toLowerCase().includes(phoneFilter.toLowerCase());
      const matchesVerification = !verificationFilter || 
        (verificationFilter === "verified" ? u.status === "Verified" : u.status === "Unverified");

      return matchesEmail && matchesName && matchesPhone && matchesVerification;
    });
  }, [usersData, emailFilter, nameFilter, phoneFilter, verificationFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const metrics = [
    { label: "Total Users", value: String(usersData.length), icon: Users, color: "text-accent", glow: "shadow-[-4px_0_15px_rgba(224,122,63,0.3)]", border: "border-l-accent" },
    { label: "Verified Users", value: String(usersData.filter(u => u.status === "Verified").length), icon: ShieldCheck, color: "text-emerald-500", glow: "shadow-[-4px_0_15px_rgba(16,185,129,0.2)]", border: "border-l-emerald-500" },
    { label: "Unverified Users", value: String(usersData.filter(u => u.status !== "Verified").length), icon: ShieldAlert, color: "text-yellow-500", glow: "shadow-[-4px_0_15px_rgba(234,179,8,0.2)]", border: "border-l-yellow-500" },
    { label: "Atelier VIPs", value: String(usersData.filter(u => u.role === "admin" || u.role === "vip").length || 4), icon: UserPlus, color: "text-blue-500", glow: "shadow-[-4px_0_15px_rgba(59,130,246,0.2)]", border: "border-l-blue-500" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Toast Feedback */}
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
        <span className="text-foreground">All Users</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">All Users</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage registered patrons, boutique clients, and admin permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/users/deleted" 
            className="flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm rounded-full transition-colors"
          >
            <UserMinus className="w-4 h-4 text-muted-foreground" />
            Deleted Users
          </Link>
          <button 
            onClick={() => setIsCreateUserOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-full transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create User
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
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

      {/* Advanced Filter Section */}
      <div className="bg-surface border border-border rounded-xl p-5 mt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Name Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Name</label>
            <input 
              type="text" 
              value={nameFilter}
              onChange={(e) => { setNameFilter(e.target.value); setCurrentPage(1); }}
              placeholder="Filter by name..." 
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" 
            />
          </div>

          {/* Email Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Email</label>
            <input 
              type="text" 
              value={emailFilter}
              onChange={(e) => { setEmailFilter(e.target.value); setCurrentPage(1); }}
              placeholder="Filter by email..." 
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" 
            />
          </div>

          {/* Phone Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Phone</label>
            <input 
              type="text" 
              value={phoneFilter}
              onChange={(e) => { setPhoneFilter(e.target.value); setCurrentPage(1); }}
              placeholder="Filter by phone..." 
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" 
            />
          </div>

          {/* Verification Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Status</label>
            <div className="relative">
              <select 
                value={verificationFilter}
                onChange={(e) => { setVerificationFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground appearance-none cursor-pointer"
              >
                <option value="">Any Status</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Reset Action */}
          <div className="flex items-end gap-3 lg:col-span-1 pt-1.5">
            <button 
              onClick={handleResetFilters}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm rounded-lg transition-colors whitespace-nowrap"
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
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      <span>Loading user accounts from database...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="w-8 h-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm font-semibold text-foreground">No users found</p>
                      <p className="text-xs text-muted-foreground mt-1">Try adjusting search parameters or create a new client account.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user, index) => (
                  <tr key={user.id || index} className="hover:bg-surface-hover/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-hover border border-border flex items-center justify-center text-xs font-bold text-accent">
                          {(user.name || "U").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-foreground">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                      {user.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold border inline-block min-w-[70px] ${
                        user.status === 'Verified' 
                          ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' 
                          : 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-muted-foreground">
                      {user.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right relative">
                      <div className="relative inline-block text-left">
                        <button 
                          onClick={() => setOpenActionId(openActionId === user.id ? null : user.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border hover:bg-surface-hover text-xs font-medium text-foreground transition-colors ml-auto"
                        >
                          Actions
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        </button>
                        
                        {/* Action Dropdown */}
                        {openActionId === user.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setOpenActionId(null)} />
                            <div className="absolute right-0 top-full mt-1.5 w-48 bg-background border border-border rounded-xl shadow-2xl py-1 z-40 animate-in fade-in zoom-in-95 duration-150">
                              <button 
                                onClick={() => {
                                  setSelectedUserDetails(user);
                                  setOpenActionId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface-hover hover:text-accent transition-colors text-left"
                              >
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" /> View Profile
                              </button>
                              <button 
                                onClick={() => handleToggleVerification(user.id)}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface-hover hover:text-accent transition-colors text-left"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-500" /> 
                                {user.status === "Verified" ? "Set Unverified" : "Mark as Verified"}
                              </button>
                              <div className="h-px bg-border/40 my-1" />
                              <button 
                                onClick={() => {
                                  setUserToDelete(user);
                                  setOpenActionId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors text-left"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Move to Trash
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
      {filteredUsers.length > pageSize && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-bold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-foreground">{Math.min(currentPage * pageSize, filteredUsers.length)}</span> of <span className="font-bold text-foreground">{filteredUsers.length}</span> users
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

      {/* --- CREATE USER SLIDEOVER MODAL --- */}
      {isCreateUserOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => !isProcessing && setIsCreateUserOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Create New User Account</h2>
              <button onClick={() => setIsCreateUserOpen(false)} className="p-2 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">First Name <span className="text-accent">*</span></label>
                  <input 
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Sophia"
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Last Name</label>
                  <input 
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Sterling"
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Email Address <span className="text-accent">*</span></label>
                <input 
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="sophia.sterling@atelier.com"
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Phone Number</label>
                <input 
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+1 (555) 234-5678"
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Profile Avatar / Document</label>
                <div className="flex items-center gap-3">
                  {newUserAvatar && (
                    <div className="w-10 h-10 rounded-full border border-accent overflow-hidden bg-background shrink-0">
                      <img src={newUserAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*,.pdf" 
                    onChange={handleUserAvatarUpload}
                    className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-white hover:file:bg-accent/90 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Role / Access</label>
                <div className="relative">
                  <select 
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="customer">Client (Storefront Access)</option>
                    <option value="vip">VIP Patron (Stylist Priority)</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border flex items-center justify-end gap-3 bg-surface">
              <button 
                onClick={() => setIsCreateUserOpen(false)}
                className="px-5 py-2 rounded-full border border-border hover:bg-surface-hover text-xs font-semibold text-foreground transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateUser}
                disabled={isProcessing || !newEmail.trim() || !newFirstName.trim()}
                className="px-5 py-2 rounded-full bg-accent hover:bg-accent/90 text-xs font-semibold text-white transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] disabled:opacity-50"
              >
                {isProcessing ? "Creating..." : "Create Account"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* --- VIEW USER DETAILS SLIDEOVER --- */}
      {selectedUserDetails && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setSelectedUserDetails(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">User Profile</h2>
              <button onClick={() => setSelectedUserDetails(null)} className="p-2 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <div className="w-14 h-14 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-lg font-bold text-accent uppercase">
                  {selectedUserDetails.name.slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{selectedUserDetails.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block mt-1 ${
                    selectedUserDetails.status === 'Verified' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' : 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10'
                  }`}>
                    {selectedUserDetails.status}
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 text-accent" />
                  <span className="text-foreground font-semibold">{selectedUserDetails.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4 text-accent" />
                  <span className="text-foreground">{selectedUserDetails.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4 text-accent" />
                  <span>Joined on {selectedUserDetails.date}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide">Try-Ons</span>
                  </div>
                  <p className="mt-1 text-xl font-bold text-foreground">{selectedUserDetails.tryonCount ?? 0}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageCircle className="w-3.5 h-3.5 text-accent" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide">AI Chats</span>
                  </div>
                  <p className="mt-1 text-xl font-bold text-foreground">{selectedUserDetails.chatCount ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border flex items-center justify-end bg-surface">
              <button 
                onClick={() => setSelectedUserDetails(null)} 
                className="px-5 py-2 rounded-full bg-accent hover:bg-accent/90 text-xs font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* --- DELETE USER CONFIRMATION MODAL --- */}
      {userToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setUserToDelete(null)} />
          <div className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 rounded-full border border-accent/40 bg-accent/10 flex items-center justify-center mb-4 text-accent mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Move &ldquo;{userToDelete.name}&rdquo; to Trash?</h2>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              This client account will be deactivated and placed into the Deleted Users archive.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleDeleteUser}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition-colors"
              >
                Move to Trash
              </button>
              <button
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-xs transition-colors"
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
