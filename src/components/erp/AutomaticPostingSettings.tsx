"use client";
import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

type Account = { id: string; code: string; name: string; account_type: string };
type Config = {
  payment_clearing_account_id: string;
  customer_advances_account_id: string;
  sales_revenue_account_id: string;
  sales_returns_account_id: string;
};
type Payload = { settings: Config | null; accounts: Account[]; status: { configured: boolean; unposted_receipts: number; unposted_sales: number; unposted_refunds: number } };
const roles: Array<{ key: keyof Config; type: string; label: string }> = [
  { key: "payment_clearing_account_id", type: "asset", label: "Payment clearing account" },
  { key: "customer_advances_account_id", type: "liability", label: "Customer advances account" },
  { key: "sales_revenue_account_id", type: "revenue", label: "Sales revenue account" },
  { key: "sales_returns_account_id", type: "expense", label: "Sales returns and refunds account" },
];

export function AutomaticPostingSettings() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [form, setForm] = useState<Config>({
    payment_clearing_account_id: "", customer_advances_account_id: "",
    sales_revenue_account_id: "", sales_returns_account_id: "",
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const data = await fetchApi<Payload>("/erp/posting-settings");
    setPayload(data);
    if (data.settings) setForm(data.settings);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load().catch(e => setMessage(e instanceof Error ? e.message : "Could not load posting setup.")); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await fetchApi("/erp/posting-settings", { method: "PUT", body: JSON.stringify(form) }); await load(); setMessage("Account mappings saved."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not save account mappings."); }
    finally { setBusy(false); }
  };
  const reconcile = async () => {
    setBusy(true); setMessage("");
    try {
      const result = await fetchApi<{ posted: { receipts: number; sales: number; refunds: number } }>("/erp/postings/reconcile", { method: "POST" });
      await load();
      setMessage("Reconciliation complete: " + result.posted.receipts + " receipts, " + result.posted.sales + " delivered sales, and " + result.posted.refunds + " refunds posted.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not reconcile postings."); }
    finally { setBusy(false); }
  };
  const status = payload?.status;
  return <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
    <div><h2 className="font-semibold text-foreground">Automatic ecommerce postings</h2><p className="mt-1 text-sm text-muted-foreground">Payments create a clearing entry and customer advance. Delivery recognizes the remaining amount as sales. Processed refunds reduce the advance or post to returns after delivery.</p></div>
    {message && <p role="status" className="rounded-lg border border-border p-3 text-sm text-foreground">{message}</p>}
    <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
      {roles.map(role => <label key={role.key} className="space-y-1 text-sm text-muted-foreground">{role.label}
        <select required value={form[role.key]} onChange={e => setForm(current => ({ ...current, [role.key]: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground">
          <option value="">Choose {role.type} account</option>
          {(payload?.accounts ?? []).filter(account => account.account_type === role.type).map(account => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
        </select>
      </label>)}
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button disabled={busy || !payload?.accounts.length} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Working..." : "Save account mappings"}</button>
        <button type="button" onClick={() => void reconcile()} disabled={busy || !status?.configured} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground disabled:opacity-50">Reconcile missed postings</button>
        {status?.configured && <span className="text-xs text-muted-foreground">Waiting: {status.unposted_receipts} receipts, {status.unposted_sales} delivered sales, {status.unposted_refunds} refunds</span>}
      </div>
    </form>
    <p className="text-xs text-muted-foreground">Sales are recorded at the gross checkout amount. GST is not split or reported here; review mappings and tax treatment with your accountant before relying on statutory financial statements. Reconciliation is safe to repeat.</p>
  </section>;
}
