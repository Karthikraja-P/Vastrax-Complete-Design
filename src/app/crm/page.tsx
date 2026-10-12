"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";
import SupportQueue from "@/components/crm/SupportQueue";

type Customer = { id: string; full_name: string | null; email: string; phone: string | null; order_count: number; lifetime_value: string; last_order_at: string | null };
type Lead = { id: string; full_name: string; email: string | null; phone: string | null; source: string | null; stage: string; converted_customer_id: string | null; created_at: string };
type Activity = { id: string; customer_id: string | null; lead_id: string | null; assigned_to: string | null; activity_type: string; subject: string; due_at: string | null; completed_at: string | null };
type CRMTeamMember = { id: string; full_name: string | null; email: string };
type Campaign = { id: string; name: string; channel: string; segment: string; subject: string; body: string; status: string; audience_count: number; sent_count: number; failed_count: number; skipped_count: number; created_at: string };
type CustomerDetail = { customer: Customer; support_tickets: Array<{ id: string; order_id: string | null; subject: string; description: string; status: string; priority: string; assigned_to: string | null; assigned_to_name: string | null; created_at: string; updated_at: string }>; orders: Array<{ id: string; status: string; payment_status: string; total_amount: string; placed_at: string; shipping_status: string | null; items: Array<{ product_name: string; size: string; quantity: number; unit_price: string }> }>; marketing_preferences: { email_marketing: boolean; sms_marketing: boolean; history: Array<{ channel: string; granted: boolean; source: string; recorded_at: string }> }; activities: Array<{ id: string; activity_type: string; subject: string; description: string | null; due_at: string | null; completed_at: string | null; created_at: string; created_by: string; assigned_to: string | null; assigned_to_name: string | null }> };

const card = "rounded-2xl border border-border bg-surface p-5";
const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

export default function CRMPage() {
  const [tab, setTab] = useState<"customers" | "leads" | "followups" | "campaigns" | "support">("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [teamMembers, setTeamMembers] = useState<CRMTeamMember[]>([]);
  const [activityAssignee, setActivityAssignee] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [campaignSegment, setCampaignSegment] = useState("all_consented");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignBody, setCampaignBody] = useState("");
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [audienceEstimate, setAudienceEstimate] = useState<number | null>(null);
  const [overview, setOverview] = useState({ customers: 0, open_leads: 0, due_tasks: 0, logged_activities: 0 });
  const [query, setQuery] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [activityTarget, setActivityTarget] = useState("");
  const [activitySubject, setActivitySubject] = useState("");
  const [activityDue, setActivityDue] = useState("");
  const [error, setError] = useState("");
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [customerNote, setCustomerNote] = useState("");

  const load = useCallback(async () => {
    try {
      const [summary, customerRows, leadRows, activityRows, campaignRows, teamRows] = await Promise.all([
        fetchApi<typeof overview>("/crm/overview"),
        fetchApi<Customer[]>(`/crm/customers${query ? `?q=${encodeURIComponent(query)}` : ""}`),
        fetchApi<Lead[]>("/crm/leads"),
        fetchApi<Activity[]>("/crm/activities?upcoming=true"),
        fetchApi<Campaign[]>("/crm/campaigns"),
        fetchApi<CRMTeamMember[]>("/crm/team-members"),
      ]);
      setOverview(summary); setCustomers(customerRows); setLeads(leadRows); setActivities(activityRows); setCampaigns(campaignRows); setTeamMembers(teamRows);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load CRM data. Check your admin sign-in."); }
  }, [query]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const addLead = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await fetchApi("/crm/leads", { method: "POST", body: JSON.stringify({ full_name: leadName, email: leadEmail || null, phone: leadPhone || null, source: "Vastrax admin" }) });
      setLeadName(""); setLeadEmail(""); setLeadPhone(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save lead."); }
  };

  const addTask = async (event: React.FormEvent) => {
    event.preventDefault();
    const [kind, id] = activityTarget.split(":");
    if (!id) return;
    try {
      await fetchApi("/crm/activities", { method: "POST", body: JSON.stringify({ [kind === "customer" ? "customer_id" : "lead_id"]: id, activity_type: "task", subject: activitySubject, due_at: activityDue ? new Date(activityDue).toISOString() : null, assigned_to: activityAssignee || null }) });
      setActivitySubject(""); setActivityDue(""); setActivityAssignee(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save follow-up."); }
  };

  const updateStage = async (lead: Lead, stage: string) => {
    try { await fetchApi(`/crm/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ stage }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update lead."); }
  };

  const convertLead = async (lead: Lead) => {
    if (!window.confirm("Link " + lead.full_name + " to an existing Vastrax customer account with the same email or phone?")) return;
    try { await fetchApi("/crm/leads/" + lead.id + "/convert", { method: "POST" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not link this lead to a customer."); }
  };

  const estimateCampaignAudience = async () => {
    try {
      const result = await fetchApi<{ eligible_count: number; limit_exceeded: boolean }>("/crm/campaigns/audience?segment=" + encodeURIComponent(campaignSegment));
      setAudienceEstimate(result.eligible_count);
      if (result.limit_exceeded) setError("This segment exceeds the 1,000-recipient campaign limit.");
      else setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not estimate the campaign audience."); }
  };

  const createCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = { name: campaignName, segment: campaignSegment, subject: campaignSubject, body: campaignBody };
      if (editingCampaignId) {
        await fetchApi("/crm/campaigns/" + editingCampaignId, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await fetchApi("/crm/campaigns", { method: "POST", body: JSON.stringify(payload) });
      }
      setCampaignName(""); setCampaignSubject(""); setCampaignBody(""); setAudienceEstimate(null); setEditingCampaignId(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the campaign draft."); }
  };

  const editCampaign = (campaign: Campaign) => {
    setCampaignName(campaign.name); setCampaignSegment(campaign.segment);
    setCampaignSubject(campaign.subject); setCampaignBody(campaign.body);
    setEditingCampaignId(campaign.id); setAudienceEstimate(null); setError("");
  };

  const cancelCampaignEdit = () => {
    setCampaignName(""); setCampaignSegment("all_consented");
    setCampaignSubject(""); setCampaignBody(""); setEditingCampaignId(null); setAudienceEstimate(null);
  };

  const deleteCampaign = async (campaign: Campaign) => {
    if (!window.confirm('Delete the draft "' + campaign.name + '"?')) return;
    try {
      await fetchApi("/crm/campaigns/" + campaign.id, { method: "DELETE" });
      if (editingCampaignId === campaign.id) cancelCampaignEdit();
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete the campaign draft."); }
  };

  const sendCampaign = async (campaign: Campaign) => {
    if (!window.confirm('Send "' + campaign.name + '" to customers who have currently opted in to email marketing?')) return;
    try {
      await fetchApi("/crm/campaigns/" + campaign.id + "/send", { method: "POST" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Campaign could not be sent."); }
  };

  const completeTask = async (id: string) => {
    try { await fetchApi(`/crm/activities/${id}/complete`, { method: "POST" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not complete task."); }
  };

  const viewCustomer = async (customer: Customer) => {
    try { setCustomerDetail(await fetchApi<CustomerDetail>(`/crm/customers/${customer.id}`)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load customer history."); }
  };

  const addCustomerNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customerDetail || !customerNote.trim()) return;
    try {
      await fetchApi("/crm/activities", { method: "POST", body: JSON.stringify({
        customer_id: customerDetail.customer.id, activity_type: "note",
        subject: "Customer note", description: customerNote.trim(),
      }) });
      setCustomerNote("");
      setCustomerDetail(await fetchApi<CustomerDetail>(`/crm/customers/${customerDetail.customer.id}`));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save customer note."); }
  };

  return <main className="min-h-screen bg-background p-5 md:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header><p className="text-xs font-semibold uppercase tracking-[.2em] text-accent">Vastrax Business</p><h1 className="mt-2 text-3xl font-bold text-foreground">Customer relationships</h1><p className="mt-1 text-sm text-muted-foreground">Customer purchase history, prospects, and team follow-ups in one place.</p></header>
      {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Customers", overview.customers], ["Open leads", overview.open_leads], ["Tasks due", overview.due_tasks], ["Logged activities", overview.logged_activities]].map(([label, value]) => <div className={card} key={String(label)}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold text-foreground">{value}</p></div>)}</section>
      <div className="flex flex-wrap gap-2">{(["customers", "leads", "followups", "campaigns", "support"] as const).map((name) => <button key={name} onClick={() => setTab(name)} className={`rounded-full px-4 py-2 text-sm capitalize ${tab === name ? "bg-accent text-white" : "bg-surface text-foreground"}`}>{name === "followups" ? "Follow-ups" : name === "support" ? "Support" : name}</button>)}</div>
      {tab === "customers" && <section className={card}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-foreground">Customers</h2><input className={`${field} max-w-sm`} placeholder="Search name, email, or phone" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="text-muted-foreground"><tr><th className="p-3">Customer</th><th className="p-3">Phone</th><th className="p-3">Orders</th><th className="p-3">Lifetime order value</th><th className="p-3">Last order</th><th className="p-3">History</th></tr></thead><tbody>{customers.map(c => <tr className="border-t border-border" key={c.id}><td className="p-3"><div className="font-medium text-foreground">{c.full_name || "Customer"}</div><div className="text-xs text-muted-foreground">{c.email}</div></td><td className="p-3">{c.phone || "—"}</td><td className="p-3">{c.order_count}</td><td className="p-3">₹{Number(c.lifetime_value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td><td className="p-3">{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : "—"}</td><td className="p-3"><button onClick={() => void viewCustomer(c)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground">View profile</button></td></tr>)}</tbody></table>{customers.length === 0 && <p className="p-5 text-sm text-muted-foreground">No customers match this search.</p>}</div></section>}
      {tab === "support" && <SupportQueue teamMembers={teamMembers} />}
      {tab === "leads" && <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><form onSubmit={addLead} className={`${card} space-y-3`}><h2 className="font-semibold text-foreground">Add prospect</h2><input required className={field} placeholder="Name" value={leadName} onChange={e => setLeadName(e.target.value)} /><input type="email" className={field} placeholder="Email" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} /><input className={field} placeholder="Phone" value={leadPhone} onChange={e => setLeadPhone(e.target.value)} /><button className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Save lead</button></form><section className={`${card} overflow-x-auto`}><h2 className="mb-4 font-semibold text-foreground">Lead pipeline</h2><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-muted-foreground"><tr><th className="p-3">Prospect</th><th className="p-3">Source</th><th className="p-3">Stage</th><th className="p-3">Added</th><th className="p-3">Customer link</th></tr></thead><tbody>{leads.map(lead => <tr className="border-t border-border" key={lead.id}><td className="p-3"><div className="font-medium text-foreground">{lead.full_name}</div><div className="text-xs text-muted-foreground">{lead.email || lead.phone || "No contact details"}</div></td><td className="p-3">{lead.source || "—"}</td><td className="p-3"><select aria-label={`Stage for ${lead.full_name}`} className={field} value={lead.stage} disabled={Boolean(lead.converted_customer_id)} onChange={e => void updateStage(lead, e.target.value)}>{["new", "contacted", "qualified", "lost", ...(lead.stage === "converted" ? ["converted"] : [])].map(s => <option key={s}>{s}</option>)}</select></td><td className="p-3">{new Date(lead.created_at).toLocaleDateString()}</td><td className="p-3">{lead.converted_customer_id ? <span className="text-xs text-emerald-600">Linked to shared customer record</span> : lead.stage === "qualified" ? <button onClick={() => void convertLead(lead)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground">Link existing customer</button> : <span className="text-xs text-muted-foreground">Qualify lead first</span>}</td></tr>)}</tbody></table></section></div>}
      {tab === "campaigns" && <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <form onSubmit={createCampaign} className={card + " space-y-3"}>
          <h2 className="font-semibold text-foreground">{editingCampaignId ? "Edit email campaign draft" : "Create email campaign draft"}</h2>
          <p className="text-xs text-muted-foreground">Only customers with active email marketing consent are eligible. Sending requires the email service to be configured.</p>
          <input required maxLength={160} className={field} placeholder="Campaign name" value={campaignName} onChange={event => setCampaignName(event.target.value)} />
          <select className={field} value={campaignSegment} onChange={event => { setCampaignSegment(event.target.value); setAudienceEstimate(null); }}>
            <option value="all_consented">All opted-in customers</option>
            <option value="repeat_customers">Repeat customers</option>
            <option value="recent_90_days">Ordered in the last 90 days</option>
            <option value="inactive_90_days">No order in the last 90 days</option>
          </select>
          <button type="button" onClick={() => void estimateCampaignAudience()} className="rounded-lg border border-border px-3 py-2 text-sm text-foreground">Estimate eligible audience</button>
          {audienceEstimate !== null && <p className="text-sm text-foreground">Eligible now: <strong>{audienceEstimate}{audienceEstimate > 1000 ? "+" : ""}</strong></p>}
          <input required maxLength={200} className={field} placeholder="Email subject" value={campaignSubject} onChange={event => setCampaignSubject(event.target.value)} />
          <textarea required maxLength={10000} rows={8} className={field} placeholder="Email message" value={campaignBody} onChange={event => setCampaignBody(event.target.value)} />
          <div className="flex gap-2"><button className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">{editingCampaignId ? "Update draft" : "Save draft"}</button>{editingCampaignId && <button type="button" onClick={cancelCampaignEdit} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">Cancel</button>}</div>
        </form>
        <section className={card + " space-y-3"}>
          <h2 className="font-semibold text-foreground">Campaign history</h2>
          {campaigns.map(campaign => <article key={campaign.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-medium text-foreground">{campaign.name}</h3><p className="mt-1 text-xs text-muted-foreground">{campaign.subject} · {campaign.segment.replaceAll("_", " ")}</p></div>
              <span className="rounded-full border border-border px-2.5 py-1 text-xs capitalize text-foreground">{campaign.status}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Eligible at last send: {campaign.audience_count} · sent: {campaign.sent_count} · failed: {campaign.failed_count} · skipped: {campaign.skipped_count}</p>
            {campaign.status === "draft" && <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => editCampaign(campaign)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground">Edit draft</button><button onClick={() => void deleteCampaign(campaign)} className="rounded-lg border border-border px-3 py-2 text-xs text-red-400">Delete draft</button><button onClick={() => void sendCampaign(campaign)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground">Send to current opted-in audience</button></div>}
          </article>)}
          {campaigns.length === 0 && <p className="text-sm text-muted-foreground">No campaign drafts yet.</p>}
        </section>
      </div>}
      {tab === "followups" && <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><form onSubmit={addTask} className={`${card} space-y-3`}><h2 className="font-semibold text-foreground">Schedule follow-up</h2><select required className={field} value={activityTarget} onChange={e => setActivityTarget(e.target.value)}><option value="">Choose customer or lead</option><optgroup label="Customers">{customers.map(c => <option key={c.id} value={`customer:${c.id}`}>{c.full_name || c.email}</option>)}</optgroup><optgroup label="Leads">{leads.map(l => <option key={l.id} value={`lead:${l.id}`}>{l.full_name}</option>)}</optgroup></select><input required className={field} placeholder="Follow-up task" value={activitySubject} onChange={e => setActivitySubject(e.target.value)} /><input type="datetime-local" className={field} value={activityDue} onChange={e => setActivityDue(e.target.value)} /><select className={field} aria-label="Assign follow-up to team member" value={activityAssignee} onChange={e => setActivityAssignee(e.target.value)}><option value="">Unassigned</option>{teamMembers.map(member => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}</select><button className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Schedule task</button></form><section className={`${card} space-y-3`}><h2 className="font-semibold text-foreground">Open follow-ups</h2>{activities.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"><div><p className="font-medium text-foreground">{a.subject}</p><p className="text-xs text-muted-foreground">{a.due_at ? new Date(a.due_at).toLocaleString() : "No due date"} · {a.customer_id ? "Customer" : "Lead"} · {a.assigned_to ? "Assigned to " + (teamMembers.find(member => member.id === a.assigned_to)?.full_name || teamMembers.find(member => member.id === a.assigned_to)?.email || "team member") : "Unassigned"}</p></div><button onClick={() => void completeTask(a.id)} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground">Mark complete</button></div>)}{activities.length === 0 && <p className="text-sm text-muted-foreground">No open follow-ups.</p>}</section></div>}
    {customerDetail && <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCustomerDetail(null); }}><section role="dialog" aria-modal="true" aria-labelledby="crm-customer-title" className="h-full w-full max-w-2xl overflow-y-auto bg-background p-5 shadow-2xl md:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-accent">Shared Vastrax customer</p><h2 id="crm-customer-title" className="mt-2 text-2xl font-bold text-foreground">{customerDetail.customer.full_name || "Customer"}</h2><p className="text-sm text-muted-foreground">{customerDetail.customer.email} · {customerDetail.customer.phone || "No phone"}</p></div><button onClick={() => setCustomerDetail(null)} className="rounded-lg border border-border px-3 py-2 text-sm text-foreground">Close</button></div><section className="mt-7"><h3 className="mb-3 font-semibold text-foreground">Order history</h3><div className="space-y-3">{customerDetail.orders.map(order => <article key={order.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-medium text-foreground">{order.id}</p><p className="text-xs capitalize text-muted-foreground">{order.status} · payment {order.payment_status}{order.shipping_status ? ` · shipping ${order.shipping_status}` : ""}</p></div><p className="font-semibold text-foreground">₹{Number(order.total_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p></div><p className="mt-1 text-xs text-muted-foreground">{new Date(order.placed_at).toLocaleString()}</p>{order.items.map((item, index) => <p key={`${order.id}-${index}`} className="mt-2 text-sm text-muted-foreground">{item.product_name} / {item.size} · {item.quantity} × ₹{Number(item.unit_price).toLocaleString("en-IN")}</p>)}</article>)}{customerDetail.orders.length === 0 && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No orders on this account yet.</p>}</div></section><section className="mt-7"><h3 className="mb-3 font-semibold text-foreground">Support tickets</h3><div className="space-y-3">{customerDetail.support_tickets.map(ticket => <article key={ticket.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-foreground">{ticket.subject}</p><span className="text-xs text-muted-foreground">{ticket.status} · {ticket.priority}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.description}</p><p className="mt-2 text-xs text-muted-foreground">{ticket.id}{ticket.order_id ? " · Order " + ticket.order_id : ""}{ticket.assigned_to_name ? " · Assigned to " + ticket.assigned_to_name : ""} · {new Date(ticket.created_at).toLocaleString()}</p></article>)}{customerDetail.support_tickets.length === 0 && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No support tickets on this customer record.</p>}</div></section><section className="mt-7"><h3 className="mb-3 font-semibold text-foreground">Marketing consent</h3><div className="rounded-xl border border-border p-4 text-sm"><p>Email: <span className="font-medium text-foreground">{customerDetail.marketing_preferences.email_marketing ? "Opted in" : "Not opted in"}</span></p><p className="mt-1">SMS: <span className="font-medium text-foreground">{customerDetail.marketing_preferences.sms_marketing ? "Opted in" : "Not opted in"}</span></p><p className="mt-2 text-xs text-muted-foreground">{customerDetail.marketing_preferences.history.length} consent changes recorded. Preferences are customer-controlled.</p></div></section><section className="mt-7"><h3 className="mb-3 font-semibold text-foreground">Team notes and activity</h3><form onSubmit={addCustomerNote} className="mb-3 space-y-2"><textarea required maxLength={5000} rows={3} aria-label="Add a customer note" placeholder="Add a note for the team…" value={customerNote} onChange={event => setCustomerNote(event.target.value)} className={field} /><button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Add note</button></form><div className="space-y-2">{customerDetail.activities.map(activity => <article key={activity.id} className="rounded-xl border border-border p-4"><div className="flex justify-between gap-2"><p className="font-medium text-foreground">{activity.subject}</p><span className="text-xs capitalize text-muted-foreground">{activity.activity_type}</span></div>{activity.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{activity.description}</p>}<p className="mt-2 text-xs text-muted-foreground">{activity.created_by} · {activity.assigned_to_name ? "Assigned to " + activity.assigned_to_name + " · " : ""}{new Date(activity.created_at).toLocaleString()}</p></article>)}{customerDetail.activities.length === 0 && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No notes or follow-ups yet.</p>}</div></section></section></div>}
    </div>
  </main>;
}