"use client";

import React, { useState, useMemo } from "react";
import { 
  Home, ChevronRight, Users, UserMinus, ShieldAlert, ShieldCheck, UserPlus, 
  ChevronDown, Filter, RotateCcw, RotateCw, Trash2, ArrowLeft, AlertCircle, Loader2
} from "lucide-react";
import Link from "next/link";

export default function DeletedUsersPage() {
  const [deletedUsers, setDeletedUsers] = useState<any[]>([
    { id: "del-usr-1", name: "Mia Wright", email: "mia.wright@example.com", phone: "+1 (555) 666-8888", status: "Verified", deletedAt: "2 days ago" },
    { id: "del-usr-2", name: "Ethan King", email: "ethan.king@example.com", phone: "+1 (555) 222-4444", status: "Verified", deletedAt: "5 days ago" },
    { id: "del-usr-3", name: "Isabella Allen", email: "isabella.allen@example.com", phone: "+1 (555) 000-1111", status: "Unverified", deletedAt: "1 week ago" }
  ]);

  const [nameFilter, setNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [userToRestore, setUserToRestore] = useState<any | null>(null);
  const [userToPurge, setUserToPurge] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleResetFilters = () => {
    setNameFilter("");
    setEmailFilter("");
    setCurrentPage(1);
  };

  const handleRestoreUser = (user: any) => {
    setIsProcessing(true);
    setTimeout(() => {
      setDeletedUsers(prev => prev.filter(u => u.id !== user.id));
      setUserToRestore(null);
      setIsProcessing(false);
      showToast(`User account "${user.name}" has been restored to active users.`);
    }, 400);
  };

  const handlePurgeUser = (user: any) => {
    setIsProcessing(true);
    setTimeout(() => {
      setDeletedUsers(prev => prev.filter(u => u.id !== user.id));
      setUserToPurge(null);
      setIsProcessing(false);
      showToast(`User account "${user.name}" was permanently purged.`);
    }, 400);
  };

  // Filtered List
  const filteredUsers = useMemo(() => {
    return deletedUsers.filter((u) => {
      const matchesName = !nameFilter.trim() || u.name.toLowerCase().includes(nameFilter.toLowerCase());
      const matchesEmail = !emailFilter.trim() || u.email.toLowerCase().includes(emailFilter.toLowerCase());
      return matchesName && matchesEmail;
    });
  }, [deletedUsers, nameFilter, emailFilter]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

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
        <Link href="/users" className="cursor-pointer hover:text-foreground transition-colors">Users</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Deleted Users</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link 
              href="/users" 
              className="p-1.5 rounded-full bg-surface-hover hover:bg-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Deleted Users</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">Review soft-deleted client accounts, restore access, or purge records</p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-surface border border-border rounded-xl p-5 mt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Name</label>
            <input 
              type="text" 
              value={nameFilter}
              onChange={(e) => { setNameFilter(e.target.value); setCurrentPage(1); }}
              placeholder="Search by name..." 
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Email</label>
            <input 
              type="text" 
              value={emailFilter}
              onChange={(e) => { setEmailFilter(e.target.value); setCurrentPage(1); }}
              placeholder="Search by email..." 
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-foreground placeholder:text-muted-foreground/60" 
            />
          </div>

          <div className="flex items-end gap-3 pt-1.5">
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
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Timeline</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-surface-hover border border-border flex items-center justify-center mb-3 text-muted-foreground">
                        <UserMinus className="w-5 h-5 opacity-60" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Trash is empty</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">No deleted user accounts in the archive.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-hover/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-hover border border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {user.name.slice(0, 2).toUpperCase()}
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
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-muted-foreground">
                      Deleted {user.deletedAt}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Restore Button */}
                        <button
                          onClick={() => setUserToRestore(user)}
                          title="Restore User Account"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-500 text-xs font-bold transition-colors"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          Restore
                        </button>
                        
                        {/* Purge Button */}
                        <button
                          onClick={() => setUserToPurge(user)}
                          title="Purge Permanently"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 text-xs font-semibold transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Purge
                        </button>
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

      {/* Restore User Modal */}
      {userToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isProcessing && setUserToRestore(null)} />
          <div className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-500 mx-auto">
              <RotateCw className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Restore &ldquo;{userToRestore.name}&rdquo;?</h2>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              This will re-activate this user account and restore their storefront access.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleRestoreUser(userToRestore)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Restore
              </button>
              <button
                onClick={() => setUserToRestore(null)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge User Modal */}
      {userToPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isProcessing && setUserToPurge(null)} />
          <div className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 rounded-full border border-red-500/30 bg-red-500/10 flex items-center justify-center mb-4 text-red-500 mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Permanently Purge &ldquo;{userToPurge.name}&rdquo;?</h2>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              This will permanently delete this client account record. This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handlePurgeUser(userToPurge)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Purge Permanently
              </button>
              <button
                onClick={() => setUserToPurge(null)}
                disabled={isProcessing}
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
