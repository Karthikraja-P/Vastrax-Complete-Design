"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

type InventoryCostingStatus = {
  configured: boolean;
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
const csvCell = (value: string | number) => {
  const text = String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
};

export function InventoryCostingStatus() {
  const [status, setStatus] = useState<InventoryCostingStatus | null>(null);
  const [variants, setVariants] = useState<CostingVariant[]>([]);
  const [variantsMore, setVariantsMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [summary, page] = await Promise.all([
        fetchApi<InventoryCostingStatus>("/erp/inventory-costing/status"),
        fetchApi<CostingVariantPage>("/erp/inventory-costing/variants?limit=100"),
      ]);
      setStatus(summary);
      setVariants(page.items);
      setVariantsMore(page.has_more);
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
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
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

  return <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
    <div>
      <h2 className="font-semibold text-foreground">Inventory costing and COGS</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cost of goods sold can only be posted after the costing method, opening stock values, and ledger accounts are set up.</p>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
    {status && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Costing method</p><p className="mt-1 font-medium capitalize text-foreground">{status.cost_method?.replaceAll("_", " ") || "Not configured"}</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Stock units with cost</p><p className="mt-1 font-medium text-foreground">{status.valued_units} of {status.on_hand_units}</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Unvalued size variants</p><p className="mt-1 font-medium text-foreground">{status.unvalued_variants} of {status.positive_stock_variants}</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Costed units above stock</p><p className="mt-1 font-medium text-foreground">{status.overvalued_units}</p></div>
      </div>
      {!status.configured || status.unvalued_units > 0 || status.overvalued_units > 0
        ? <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">COGS posting is not ready. Choose FIFO or moving weighted average, reconcile any unvalued or overvalued stock, enter verified opening unit costs, and map inventory, COGS, and opening equity accounts. Sales and inventory data have not been changed.</p>
        : status.unposted_cost_consumptions > 0
          ? <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">{status.unposted_cost_consumptions} inventory cost allocations still need ledger posting.</p>
          : <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">Inventory costing is configured and all current stock quantities have cost layers.</p>}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-foreground">In-stock sizes and recorded costs</h3><button type="button" disabled={loadingMore} onClick={() => void downloadOpeningCostTemplate()} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground disabled:opacity-50">{loadingMore ? "Preparing…" : "Download opening-cost worksheet"}</button></div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="p-3">Product</th><th className="p-3">Size</th><th className="p-3">SKU</th><th className="p-3">On hand</th><th className="p-3">With receipt cost</th><th className="p-3">Unvalued</th></tr></thead>
            <tbody>{variants.map(row => <tr key={row.variant_id} className="border-t border-border"><td className="p-3 font-medium text-foreground">{row.product_name}</td><td className="p-3">{row.size}</td><td className="p-3">{row.sku || "—"}</td><td className="p-3">{row.on_hand_units}</td><td className="p-3">{row.recorded_cost_units}</td><td className="p-3">{row.unvalued_units}{row.overvalued_units > 0 ? ` · ${row.overvalued_units} above stock` : ""}</td></tr>)}{variants.length === 0 && <tr><td colSpan={6} className="p-4 text-sm text-muted-foreground">No variants currently have stock.</td></tr>}</tbody>
          </table>
        </div>
        {variantsMore && <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="mt-3 rounded-lg border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50">{loadingMore ? "Loading…" : "Load more sizes"}</button>}
      </div>
    </>}
  </section>;
}
