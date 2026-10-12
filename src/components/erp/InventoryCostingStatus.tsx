"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

type InventoryCostingStatus = {
  configured: boolean;
  cogs_active: boolean;
  cost_method: string | null;
  positive_stock_variants: number;
  valued_variants: number;
  unvalued_variants: number;
  overvalued_variants: number;
  on_hand_units: number;
  valued_units: number;
  unvalued_units: number;
  overvalued_units: number;
  unposted_cost_consumptions: number;
};
type CostingVariant = {
  variant_id: string;
  product_name: string;
  sku: string | null;
  size: string;
  on_hand_units: number;
  recorded_cost_units: number;
  unvalued_units: number;
  overvalued_units: number;
};
type CostingVariantPage = { items: CostingVariant[]; total: number; has_more: boolean };
type LedgerAccount = { id: string; code: string; name: string; account_type: string };
type CostingSettingsResponse = {
  settings: { cost_method: string; inventory_account_id: string; cogs_account_id: string; opening_equity_account_id: string } | null;
  accounts: LedgerAccount[];
};
type CostingForm = { cost_method: "fifo" | "moving_average"; inventory_account_id: string; cogs_account_id: string; opening_equity_account_id: string };
const csvCell = (value: string | number) => {
  const text = String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
  return '"' + safeText.replaceAll('"', '""') + '"';
};

export function InventoryCostingStatus() {
  const [status, setStatus] = useState<InventoryCostingStatus | null>(null);
  const [variants, setVariants] = useState<CostingVariant[]>([]);
  const [variantsMore, setVariantsMore] = useState(false);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [form, setForm] = useState<CostingForm>({ cost_method: "fifo", inventory_account_id: "", cogs_account_id: "", opening_equity_account_id: "" });
  const [openingCosts, setOpeningCosts] = useState<Record<string, string>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingOpening, setSavingOpening] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [summary, page, costing] = await Promise.all([
        fetchApi<InventoryCostingStatus>("/erp/inventory-costing/status"),
        fetchApi<CostingVariantPage>("/erp/inventory-costing/variants?limit=100"),
        fetchApi<CostingSettingsResponse>("/erp/inventory-costing/settings"),
      ]);
      setStatus(summary);
      setVariants(page.items);
      setVariantsMore(page.has_more);
      setAccounts(costing.accounts);
      if (costing.settings) {
        setForm({
          cost_method: costing.settings.cost_method === "moving_average" ? "moving_average" : "fifo",
          inventory_account_id: costing.settings.inventory_account_id,
          cogs_account_id: costing.settings.cogs_account_id,
          opening_equity_account_id: costing.settings.opening_equity_account_id,
        });
      } else {
        setForm(current => ({
          ...current,
          inventory_account_id: current.inventory_account_id || costing.accounts.find(row => row.account_type === "asset")?.id || "",
          cogs_account_id: current.cogs_account_id || costing.accounts.find(row => row.account_type === "expense")?.id || "",
          opening_equity_account_id: current.opening_equity_account_id || costing.accounts.find(row => row.account_type === "equity")?.id || "",
        }));
      }
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load inventory valuation status.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchApi<CostingVariantPage>(`/erp/inventory-costing/variants?limit=100&offset=${variants.length}`);
      setVariants(current => [...current, ...page.items]);
      setVariantsMore(page.has_more);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load more inventory variants.");
    } finally {
      setLoadingMore(false);
    }
  };

  const downloadOpeningCostTemplate = async () => {
    setLoadingMore(true);
    try {
      const rows: CostingVariant[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const page = await fetchApi<CostingVariantPage>(`/erp/inventory-costing/variants?limit=200&offset=${offset}`);
        if (page.items.length === 0 && page.has_more) throw new Error("Inventory list pagination did not advance. Please retry.");
        rows.push(...page.items);
        offset += page.items.length;
        hasMore = page.has_more;
      }
      const header = ["Variant ID", "Product", "Size", "SKU", "On hand units", "Units with receipt cost", "Unvalued units", "Verified opening unit cost (INR)", "Notes"];
      const body = rows.map(row => [row.variant_id, row.product_name, row.size, row.sku || "", row.on_hand_units, row.recorded_cost_units, row.unvalued_units, "", ""]);
      const csv = [header, ...body].map(line => line.map(csvCell).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "vastrax-opening-stock-costs.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the opening-stock cost worksheet.");
    } finally {
      setLoadingMore(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    setError("");
    setMessage("");
    try {
      await fetchApi("/erp/inventory-costing/settings", { method: "PUT", body: JSON.stringify(form) });
      setMessage("Costing method and account mappings saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save costing settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const saveOpeningCosts = async () => {
    const items = variants.filter(row => row.unvalued_units > 0 && openingCosts[row.variant_id]?.trim())
      .map(row => ({ variant_id: row.variant_id, unit_cost: openingCosts[row.variant_id].trim() }));
    if (items.length === 0) {
      setError("Enter a verified unit cost for at least one size with unvalued stock.");
      return;
    }
    if (!window.confirm(`This will value uncosted stock for ${items.length} size variants and create an opening inventory ledger entry. Confirm the supplied values first.`)) return;
    setSavingOpening(true);
    setError("");
    setMessage("");
    try {
      const randomKey = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await fetchApi<{ variants_valued: number; total_value?: string }>("/erp/inventory-costing/opening-balances", {
        method: "POST",
        body: JSON.stringify({ idempotency_key: `opening-${randomKey}`, items }),
      });
      setOpeningCosts({});
      setMessage(`Opening values saved for ${result.variants_valued} size variants.${result.total_value ? ` Total value: INR ${result.total_value}.` : ""}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save opening costs.");
    } finally {
      setSavingOpening(false);
    }
  };

  const accountSelect = (label: string, accountType: string, field: keyof Omit<CostingForm, "cost_method">) =>
    <label className="grid gap-1 text-sm text-foreground">{label}
      <select value={form[field]} onChange={event => setForm(current => ({ ...current, [field]: event.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2" required>
        <option value="">Choose account</option>
        {accounts.filter(row => row.account_type === accountType).map(row => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}
      </select>
    </label>;

  return <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
    <div>
      <h2 className="font-semibold text-foreground">Inventory costing and COGS</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cost of goods sold can only be posted after the costing method, opening stock values, and ledger accounts are set up. Ask your accountant to approve the valuation method and accounts.</p>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
    {status && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Costing method</p><p className="mt-1 font-medium capitalize text-foreground">{status.cost_method?.replaceAll("_", " ") || "Not configured"}</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Stock units with cost</p><p className="mt-1 font-medium text-foreground">{status.valued_units} of {status.on_hand_units}</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Unvalued size variants</p><p className="mt-1 font-medium text-foreground">{status.unvalued_variants} of {status.positive_stock_variants}</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Costed units above stock</p><p className="mt-1 font-medium text-foreground">{status.overvalued_units}</p></div>
      </div>
      {!status.configured || !status.cogs_active || status.unvalued_units > 0 || status.overvalued_units > 0
        ? <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">COGS posting is not active. Set the approved method and account mappings, value all opening stock, and reconcile quantities. Orders placed before activation are not back-posted.</p>
        : status.unposted_cost_consumptions > 0
          ? <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">{status.unposted_cost_consumptions} inventory cost allocations still need ledger posting.</p>
          : <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">Inventory costing is configured and all current stock quantities have cost layers.</p>}
      <div className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground">Costing method and ledger accounts</h3>
        <p className="text-sm text-muted-foreground">FIFO assigns the earliest remaining purchase cost to each sale. Moving weighted average uses the average cost of remaining stock. Changing these settings is blocked after COGS has been posted.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm text-foreground">Valuation method
            <select value={form.cost_method} onChange={event => setForm(current => ({ ...current, cost_method: event.target.value as CostingForm["cost_method"] }))} className="rounded-lg border border-border bg-background px-3 py-2">
              <option value="fifo">FIFO</option><option value="moving_average">Moving weighted average</option>
            </select>
          </label>
          {accountSelect("Inventory asset account", "asset", "inventory_account_id")}
          {accountSelect("Cost of goods sold expense account", "expense", "cogs_account_id")}
          {accountSelect("Opening equity account", "equity", "opening_equity_account_id")}
        </div>
        <button type="button" disabled={savingSettings || !form.inventory_account_id || !form.cogs_account_id || !form.opening_equity_account_id} onClick={() => void saveSettings()} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">{savingSettings ? "Saving..." : "Save costing settings"}</button>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-foreground">In-stock sizes and recorded costs</h3><button type="button" disabled={loadingMore} onClick={() => void downloadOpeningCostTemplate()} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground disabled:opacity-50">{loadingMore ? "Preparing..." : "Download opening-cost worksheet"}</button></div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="p-3">Product</th><th className="p-3">Size</th><th className="p-3">SKU</th><th className="p-3">On hand</th><th className="p-3">With receipt cost</th><th className="p-3">Unvalued</th><th className="p-3">Opening unit cost (INR)</th></tr></thead>
            <tbody>{variants.map(row => <tr key={row.variant_id} className="border-t border-border"><td className="p-3 font-medium text-foreground">{row.product_name}</td><td className="p-3">{row.size}</td><td className="p-3">{row.sku || "-"}</td><td className="p-3">{row.on_hand_units}</td><td className="p-3">{row.recorded_cost_units}</td><td className="p-3">{row.unvalued_units}{row.overvalued_units > 0 ? ` (${row.overvalued_units} above stock)` : ""}</td><td className="p-3"><input type="number" min="0.01" step="0.01" inputMode="decimal" disabled={!row.unvalued_units} value={openingCosts[row.variant_id] || ""} onChange={event => setOpeningCosts(current => ({ ...current, [row.variant_id]: event.target.value }))} aria-label={`Opening unit cost for ${row.product_name} size ${row.size}`} className="w-36 rounded-lg border border-border bg-background px-2 py-1 disabled:opacity-40" placeholder={row.unvalued_units ? "Verified cost" : "Valued"} /></td></tr>)}{variants.length === 0 && <tr><td colSpan={7} className="p-4 text-sm text-muted-foreground">No variants currently have stock.</td></tr>}</tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" disabled={savingOpening || !status.configured || !variants.some(row => row.unvalued_units > 0 && openingCosts[row.variant_id]?.trim())} onClick={() => void saveOpeningCosts()} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">{savingOpening ? "Saving..." : "Save opening stock costs"}</button>
          <span className="text-xs text-muted-foreground">Saving creates the opening inventory and equity journal. Use verified supplier/accounting records; never estimate costs.</span>
        </div>
        {variantsMore && <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="mt-3 rounded-lg border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50">{loadingMore ? "Loading..." : "Load more sizes"}</button>}
      </div>
    </>}
  </section>;
}
