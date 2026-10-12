"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

type StatementLine = { account_id: string | null; code: string; name: string; amount: string };
type ProfitAndLoss = {
  start_date: string; end_date: string; revenue: StatementLine[]; expenses: StatementLine[];
  revenue_total: string; expense_total: string; net_income: string;
};
type BalanceSheet = {
  as_of: string; assets: StatementLine[]; liabilities: StatementLine[]; equity: StatementLine[];
  assets_total: string; liabilities_total: string; equity_total: string;
  liabilities_and_equity_total: string; balanced: boolean;
};

const card = "rounded-2xl border border-border bg-surface p-5";
const field = "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
const money = (value: string) => `?${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FinancialStatements() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [asOf, setAsOf] = useState(today);
  const [profit, setProfit] = useState<ProfitAndLoss | null>(null);
  const [balance, setBalance] = useState<BalanceSheet | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pnl, bs] = await Promise.all([
        fetchApi<ProfitAndLoss>(`/erp/profit-and-loss?start_date=${startDate}&end_date=${endDate}`),
        fetchApi<BalanceSheet>(`/erp/balance-sheet?as_of=${asOf}`),
      ]);
      setProfit(pnl);
      setBalance(bs);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load financial statements.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, asOf]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return <section className={`${card} space-y-5`}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="font-semibold text-foreground">Financial statements</h2><p className="mt-1 text-xs text-muted-foreground">Calculated from posted ledger journals.</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">P&amp;L from<input aria-label="P&L start date" className={field} type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">through<input aria-label="P&L end date" className={field} type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">Balance sheet as of<input aria-label="Balance sheet date" className={field} type="date" value={asOf} onChange={event => setAsOf(event.target.value)} /></label>
        <button onClick={() => void load()} disabled={loading} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Loading?" : "Refresh reports"}</button>
      </div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
    {profit && balance && <div className="grid gap-5 xl:grid-cols-2">
      <article className="rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground">Profit &amp; Loss <span className="font-normal text-muted-foreground">? {profit.start_date} to {profit.end_date}</span></h3>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revenue</p>
        {profit.revenue.map(row => <p key={row.account_id} className="mt-2 flex justify-between gap-3 text-sm"><span>{row.code} ? {row.name}</span><span>{money(row.amount)}</span></p>)}
        <p className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-semibold"><span>Total revenue</span><span>{money(profit.revenue_total)}</span></p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expenses</p>
        {profit.expenses.map(row => <p key={row.account_id} className="mt-2 flex justify-between gap-3 text-sm"><span>{row.code} ? {row.name}</span><span>{money(row.amount)}</span></p>)}
        <p className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-semibold"><span>Total expenses</span><span>{money(profit.expense_total)}</span></p>
        <p className="mt-3 flex justify-between border-t-2 border-border pt-3 font-bold text-foreground"><span>Net income</span><span>{money(profit.net_income)}</span></p>
      </article>
      <article className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-foreground">Balance Sheet <span className="font-normal text-muted-foreground">? {balance.as_of}</span></h3><span className={`rounded-full px-2 py-1 text-xs ${balance.balanced ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-400"}`}>{balance.balanced ? "Balanced" : "Out of balance"}</span></div>
        {([["Assets", balance.assets], ["Liabilities", balance.liabilities], ["Equity", balance.equity]] as const).map(([title, rows]) => <div key={title} className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>{rows.map(row => <p key={row.account_id ?? row.code} className="mt-2 flex justify-between gap-3 text-sm"><span>{row.code} ? {row.name}</span><span>{money(row.amount)}</span></p>)}</div>)}
        <div className="mt-4 space-y-2 border-t-2 border-border pt-3 text-sm font-semibold"><p className="flex justify-between"><span>Total assets</span><span>{money(balance.assets_total)}</span></p><p className="flex justify-between"><span>Liabilities + equity</span><span>{money(balance.liabilities_and_equity_total)}</span></p></div>
      </article>
    </div>}
    <p className="text-xs text-muted-foreground">Statements only include transactions posted to the ledger. They do not calculate product GST or replace statutory filings.</p>
  </section>;
}
