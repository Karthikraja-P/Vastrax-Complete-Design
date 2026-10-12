"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

type Customer = { id: string; full_name: string | null; email: string; phone: string | null; order_count: number; lifetime_value: string; last_order_at: string | null };
type Lead = { id: string; full_name: string; email: string | null; phone: string | null; source: string | null; stage: string; converted_customer_id: string | null; created_at: string };
type Activity = { id: string; customer_id: string | null; lead_id: string | null; activity_type: string; subject: string; due_at: string | null; completed_at: string | null };
type CustomerDetail = { customer: Customer; orders: Array<{ id: string; status: string; payment_status: string; total_amount: string; placed_at: string; shipping_status: string | null; items: Array<{ product_name: string; size: string; quantity: number; unit_price: string }> }>; marketing_preferences: { email_marketing: boolean; sms_marketing: boolean; history: Array<{ channel: string; granted: boolean; source: string; recorded_at: string }> }; activities: Array<{ id: string; activity_type: string; subject: string; description: string | null; due_at: string | null; completed_at: string | null; created_at: string; created_by: string }> };

const card = "rounded-2xl border border-border bg-surface p-5";
const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

export default function CRMPage() {
  const [tab, setTab] = useState<"customers" | "leads" | "followups">("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
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
      const [summary, customerRows, leadRows, activityRows] = await Promise.all([
        fetchApi<typeof overview>("/crm/overview"),
        fetchApi<Customer[]>(`/crm/customers${query ? `?q=${encodeURIComponent(query)}` : ""}`),
        fetchApi<Lead[]>("/crm/leads"),
        fetchApi<Activity[]>("/crm/activities?upcoming=true"),
      ]);
      setOverview(summary); setCustomers(customerRows); setLeads(leadRows); setActivities(activityRows);
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
      await fetchApi("/crm/activities", { method: "POST", body: JSON.stringify({ [kind === "customer" ? "customer_id" : "lead_id"]: id, activity_type: "task", subject: activitySubject, due_at: activityDue ? new Date(activityDue).toISOString() : null }) });
      setActivitySubject(""); setActivityDue(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save follow-up."); }
  };

  const updateStage = async (lead: Lead, stage: string) => {
    try { await fetchApi(`/crm/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ stage }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update lead."); }
  };

  comer-title" className="mt-2 text-2xl font-bold text-foreground">{customerDetail.customer.full_name || "Customer"}</h2><p className="text-sm text-muted-foreground">{customerDetail.customer.email} · {customerDetail.customer.phone || "No phone"}</p></div><button onClick={() => setCustomerDetail(null)} className="rounded-lg border border-border px-3 py-2 text-sm text-foreground">Close</button></div><section className="mt-7"><h3 className="mb-3 font-semibold text-foreground">Order history</h3><div className="space-y-3">{customerDetail.orders.map(order => <article key={order.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-medium text-foreground">{order.id}</p><p className="text-xs capitalize text-muted-foreground">{order.status} · payment {order.payment_status}{order.shipping_status ? ` · shipping ${order.shipping_status}` : ""}</p></div><p className="font-semibold text-foreground">₹{Number(order.total_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p></div><p className="mt-1 text-xs text-muted-foreground">{new Date(order.placed_at).toLocaleString()}</p>{order.items.map((item, index) => <p key={`${order.id}-${index}`} className="mt-2 text-sm text-muted-foreground">{item.product_name} / {item.size} · {item.quantity} × ₹{Number(item.unit_price).toLocaleString("en-IN")}</p>)}</article>)}{customerDetail.orders.length === 0 && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No orders on this account yet.</p>}</div></section><section className="mt-7"><h3 className="mb-3 font-semibold text-foreground">Marketing consent</h3><div className="rounded-xl border border-border p-4 text-sm"><p>Email: <span className="font-medium text-foreground">{customerDetail.marketing_preferences.email_marketing ? "Opted in" : "Not opted in"}</span></p><p className="mt-1">SMS: <span className="font-medium text-foreground">{customerDetail.marketing_preferences.sms_marketing ? "Opted in" : "Not opted in"}</span></p><p className="mt-2 text-xs text-muted-foreground">{customerDetail.marketing_preferences.history.length} consent changes recorded. Preferences are customer-controlled.</p></div></section><section className="mt-7"><h3 className="mb-3 font-semibold text-foreground">Team notes and activity</h3><form onSubmit={addCustomerNote} className="mb-3 space-y-2"><textarea required maxLength={5000} rows={3} aria-label="Add a customer note" placeholder="Add a note for the team…" value={customerNote} onChange={event => setCustomerNote(event.target.value)} className={field} /><button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Add note</button></form><div className="space-y-2">{customerDetail.activities.map(activity => <article key={activity.id} className="rounded-xl border border-border p-4"><div className="flex justify-between gap-2"><p className="font-medium text-foreground">{activity.subject}</p><span className="text-xs capitalize text-muted-foreground">{activity.activity_type}</span></div>{activity.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{activity.description}</p>}<p className="mt-2 text-xs text-muted-foreground">{activity.created_by} · {new Date(activity.created_at).toLocaleString()}</p></article>)}{customerDetail.activities.length === 0 && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No notes or follow-ups yet.</p>}</div></section></section></div>}
    </div>
  </main>;
}