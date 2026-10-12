"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

type TeamMember = { user_id: string; full_name: string | null; email: string; permissions: string[] };

const card = "rounded-2xl border border-border bg-surface p-5";
const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

export default function BusinessTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState("");
  const [crm, setCrm] = useState(true);
  const [erp, setErp] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try { setMembers(await fetchApi<TeamMember[]>("/users/admin/business-team")); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load team access."); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const grant = async (event: FormEvent) => {
    event.preventDefault();
    const permissions = [crm && "crm", erp && "erp"].filter(Boolean);
    if (!permissions.length) { setError("Choose CRM, ERP, or both."); return; }
    try {
      await fetchApi("/users/admin/business-team", {
        method: "PUT",
        body: JSON.stringify({ email: email.trim(), permissions }),
      });
      setEmail("");
      setNotice("Business access updated.");
      setError("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update business access."); }
  };

  const revoke = async (member: TeamMember) => {
    if (!window.confirm(`Remove CRM and ERP access for ${member.email}?`)) return;
    try {
      await fetchApi(`/users/admin/business-team/${member.user_id}`, { method: "DELETE" });
      setNotice("Business access removed.");
      setError("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove business access."); }
  };

  return <main className="min-h-screen bg-background p-5 md:p-8"><div className="mx-auto max-w-5xl space-y-6">
    <header><p className="text-xs font-semibold uppercase tracking-[.2em] text-accent">Vastrax Administration</p><h1 className="mt-2 text-3xl font-bold text-foreground">Business team access</h1><p className="mt-1 text-sm text-muted-foreground">Give existing, verified Vastrax accounts access to the shared CRM and ERP workspace. Admins always retain full access.</p></header>
    {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-500">{notice}</div>}
    <form onSubmit={grant} className={`${card} space-y-4`}><h2 className="font-semibold text-foreground">Grant or update access</h2><label className="block space-y-1 text-sm text-muted-foreground">Team member’s Vastrax account email<input required type="email" className={field} value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" /></label><fieldset className="flex flex-wrap gap-5 text-sm text-foreground"><legend className="mb-2 text-sm text-muted-foreground">Modules</legend><label className="flex items-center gap-2"><input type="checkbox" checked={crm} onChange={event => setCrm(event.target.checked)} />CRM</label><label className="flex items-center gap-2"><input type="checkbox" checked={erp} onChange={event => setErp(event.target.checked)} />ERP</label></fieldset><button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Save team access</button><p className="text-xs text-muted-foreground">Team members must first create and verify their own Vastrax account, then sign out and back in to refresh their access. Store and platform administration remains admin-only.</p></form>
    <section className={card}><h2 className="mb-4 font-semibold text-foreground">Current team access</h2><div className="space-y-3">{members.map(member => <article key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"><div><p className="font-medium text-foreground">{member.full_name || member.email}</p><p className="text-sm text-muted-foreground">{member.email}</p><div className="mt-2 flex gap-2">{member.permissions.map(permission => <span key={permission} className="rounded-full bg-accent/10 px-2.5 py-1 text-xs capitalize text-accent">{permission}</span>)}</div></div><button onClick={() => void revoke(member)} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground">Remove access</button></article>)}{members.length === 0 && <p className="text-sm text-muted-foreground">No team access has been granted yet.</p>}</div></section>
  </div></main>;
}
