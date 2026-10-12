"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

type Member = { id: string; full_name: string | null; email: string };
type Ticket = { id: string; customer_id: string | null; customer_name: string | null; customer_email: string | null; order_id: string | null; subject: string; description: string; status: string; priority: string; assigned_to: string | null; assigned_to_name: string | null; created_at: string; updated_at: string };
const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

export default function SupportQueue({ teamMembers }: { teamMembers: Member[] }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const url = "/crm/support-tickets" + (statusFilter ? "?status=" + encodeURIComponent(statusFilter) : "");
      setTickets(await fetchApi<Ticket[]>(url));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load the support queue."); }
  }, [statusFilter]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const update = async (ticket: Ticket, changes: { status?: string; priority?: string; assigned_to?: string | null }) => {
    setBusy(ticket.id); setError("");
    try {
      await fetchApi("/crm/support-tickets/" + ticket.id, { method: "PATCH", body: JSON.stringify(changes) });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update support ticket."); }
    finally { setBusy(null); }
  };

  return <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-foreground">Customer support queue</h2><p className="mt-1 text-sm text-muted-foreground">Support requests from the existing Vastrax chat and concierge flows, linked to customer records.</p></div><label className="text-sm text-muted-foreground">Filter status<select className={field} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">All statuses</option>{["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map(status => <option key={status}>{status}</option>)}</select></label></div>
    {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
    <div className="space-y-3">{tickets.map(ticket => <article key={ticket.id} className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold text-foreground">{ticket.subject}</p><p className="text-xs text-muted-foreground">{ticket.customer_name || "Guest"}{ticket.customer_email ? " · " + ticket.customer_email : ""}{ticket.order_id ? " · Order " + ticket.order_id : ""} · {new Date(ticket.created_at).toLocaleString()}</p></div><span className="text-xs text-muted-foreground">{ticket.id}</span></div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.description}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">Status<select disabled={busy === ticket.id} className={field} value={ticket.status} onChange={e => void update(ticket, { status: e.target.value })}>{["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map(status => <option key={status}>{status}</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Priority<select disabled={busy === ticket.id} className={field} value={ticket.priority} onChange={e => void update(ticket, { priority: e.target.value })}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map(priority => <option key={priority}>{priority}</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Assigned teammate<select disabled={busy === ticket.id} className={field} value={ticket.assigned_to || ""} onChange={e => void update(ticket, { assigned_to: e.target.value || null })}><option value="">Unassigned</option>{teamMembers.map(member => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}</select></label>
      </div>
    </article>)}</div>
    {tickets.length === 0 && !error && <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No support tickets match this filter.</p>}
  </section>;
}
