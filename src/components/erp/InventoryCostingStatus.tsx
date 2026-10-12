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

export function InventoryCostingStatus() {
  const [status, setStatus] = useState<InventoryCostingStatus | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setStatus(await fetchApi<InventoryCostingStatus>("/erp/inventory-costing/status"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load inventory valuation status.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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
    </>}
  </section>;
}
