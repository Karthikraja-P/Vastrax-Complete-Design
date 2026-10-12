"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";
import SupplierManager from "@/components/erp/SupplierManager";

type Inventory = { variant_id: string; product_id: string; product_name: string; size: string; sku: string; stock_qty: number };
type Supplier = { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; gstin: string | null; address: string | null; is_active: boolean };
type PurchaseOrder = { id: string; supplier_name: string; status: string; items: Array<{ id: string; product_name: string; size: string; quantity_ordered: number; quantity_received: number; unit_cost: string }> };
type Expense = { id: string; category: string; description: string; amount: string; tax_amount: string; expense_date: string; reference: string | null };
type LedgerAccount = { id: string; code: string; name: string; account_type: string; is_active: boolean };
const card = "rounded-2xl border border-border bg-surface p-5";
const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

export default function ERPPage() {
  const [tab, setTab] = useState<"inventory" | "purchasing" | "expenses">("inventory");
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [inputTaxAccountId, setInputTaxAccountId] = useState("");
  const [inventoryAccountId, setInventoryAccountId] = useState("");
  const [payableAccountId, setPayableAccountId] = useState("");
  const [summary, setSummary] = useState<Record<string, number | string>>({});
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [poSupplier, setPoSupplier] = useState("");
  const [poVariant, setPoVariant] = useState("");
  const [poQuantity, setPoQuantity] = useState("1");
  const [poCost, setPoCost] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Operations");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseTax, setExpenseTax] = useState("0");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const inventoryUrl = `/erp/inventory${search || lowOnly ? `?${[search ? `q=${encodeURIComponent(search)}` : "", lowOnly ? "low_stock_only=true" : ""].filter(Boolean).join("&")}` : ""}`;
      const [items, supplierRows, poRows, expenseRows, metrics, accountRows] = await Promise.all([
        fetchApi<Inventory[]>(inventoryUrl), fetchApi<Supplier[]>("/erp/suppliers"),
        fetchApi<PurchaseOrder[]>("/erp/purchase-orders"), fetchApi<Expense[]>("/erp/expenses"), fetchApi<Record<string, number | string>>("/erp/overview"), fetchApi<LedgerAccount[]>("/erp/accounts"),
      ]);
      setInventory(items); setSuppliers(supplierRows); setOrders(poRows); setExpenses(expenseRows); setSummary(metrics); setLedgerAccounts(accountRows); setError("");
      if (!expenseAccountId && accountRows.find(a => a.is_active && a.account_type === "expense")) setExpenseAccountId(accountRows.find(a => a.is_active && a.account_type === "expense")!.id);
      if (!creditAccountId && accountRows.find(a => a.is_active && ["asset", "liability"].includes(a.account_type))) setCreditAccountId(accountRows.find(a => a.is_active && ["asset", "liability"].includes(a.account_type))!.id);
      if (!inputTaxAccountId && accountRows.find(a => a.is_active && a.account_type === "asset")) setInputTaxAccountId(accountRows.find(a => a.is_active && a.account_type === "asset")!.id);
      if (!inventoryAccountId && accountRows.find(a => a.is_active && a.account_type === "asset")) setInventoryAccountId(accountRows.find(a => a.is_active && a.account_type === "asset")!.id);
      if (!payableAccountId && accountRows.find(a => a.is_active && a.account_type === "liability")) setPayableAccountId(accountRows.find(a => a.is_active && a.account_type === "liability")!.id);
      if (!poVariant && items[0]) setPoVariant(items[0].variant_id);
      if (!poSupplier && supplierRows.find(s => s.is_active)) setPoSupplier(supplierRows.find(s => s.is_active)!.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load operations data. Check your admin sign-in."); }
  }, [search, lowOnly, poSupplier, poVariant, expenseAccountId, creditAccountId, inputTaxAccountId, inventoryAccountId, payableAccountId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const createPO = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!poSupplier || !poVariant || !poCost) return;
    try { await fetchApi("/erp/purchase-orders", { method: "POST", body: JSON.stringify({ supplier_id: poSupplier, items: [{ variant_id: poVariant, quantity: Number(poQuantity), unit_cost: poCost }] }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not create purchase order."); }
  };
  const receiveRemaining = async (po: PurchaseOrder) => {
    const open = po.items.filter(line => line.quantity_received < line.quantity_ordered);
    if (!open.length) return;
    if (!inventoryAccountId || !payableAccountId) { setError("Select an inventory asset and supplier payable liability account before receiving stock."); return; }
    try { await fetchApi(`/erp/purchase-orders/${po.id}/receive`, { method: "POST", body: JSON.stringify({ inventory_account_id: inventoryAccountId, payable_account_id: payableAccountId, items: open.map(line => ({ line_id: line.id, quantity: line.quantity_ordered - line.quantity_received })) }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not receive stock."); }
  };
  const cancelPO = async (po: PurchaseOrder) => {
    if (!window.confirm(`Cancel the unreceived remainder of ${po.id}? Received stock and its accounting entry will stay recorded.`)) return;
    try { await fetchApi(`/erp/purchase-orders/${po.id}/cancel`, { method: "POST" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not cancel purchase order."); }
  };
  const adjust = async (item: Inventory) => {
    const raw = window.prompt(`Stock adjustment for ${item.product_name} · ${item.size}. Enter a positive or negative quantity.`, "0");
    if (!raw || !/^-?\d+$/.test(raw) || Number(raw) === 0) return;
    const notes = window.prompt("Reason or note for the inventory audit log:", "Count correction") || undefined;
    try { await fetchApi(`/erp/inventory/${item.variant_id}/adjust`, { method: "POST", body: JSON.stringify({ quantity_delta: Number(raw), reason: "count_correction", notes }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not adjust stock."); }
  };
  const addExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!expenseAccountId || !creditAccountId || (Number(expenseTax) > 0 && !inputTaxAccountId)) { setError("Add/select an expense account, a cash/payable account, and an input tax asset account when tax is recorded."); return; }
    try { await fetchApi("/erp/expenses", { method: "POST", body: JSON.stringify({ category: expenseCategory, description: expenseDescription, amount: expenseAmount, tax_amount: expenseTax, expense_date: new Date().toISOString().slice(0, 10), expense_account_id: expenseAccountId, credit_account_id: creditAccountId, input_tax_account_id: Number(expenseTax) > 0 ? inputTaxAccountId : null }) }); setExpenseDescription(""); setExpenseAmount(""); setExpenseTax("0"); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save expense."); }
  };

  return <main className="min-h-screen bg-background p-5 md:p-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-accent">Vastrax Business</p><h1 className="mt-2 text-3xl font-bold text-foreground">Operations & finance</h1><p className="mt-1 text-sm text-muted-foreground">Inventory, supplier purchasing, and operating expense records connected to the live catalog.</p></div><div className="flex gap-2"><a href="/erp/returns" className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">Manage returns</a><a href="/erp/accounting" className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">General ledger</a></div></header>
    {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[["Units in stock", summary.stock_units], ["Low stock sizes", summary.low_stock_variants], ["Out of stock sizes", summary.out_of_stock_variants], ["Open purchase orders", summary.open_purchase_orders], ["Month expenses", `₹${Number(summary.monthly_expenses || 0).toLocaleString("en-IN")}`], ["Order value", `₹${Number(summary.order_value_booked || 0).toLocaleString("en-IN")}`]].map(([label, value]) => <div className={card} key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold text-foreground">{value ?? 0}</p></div>)}</section>
    <div className="flex flex-wrap gap-2">{(["inventory", "purchasing", "expenses"] as const).map(name => <button key={name} onClick={() => setTab(name)} className={`rounded-full px-4 py-2 text-sm capitalize ${tab === name ? "bg-accent text-white" : "bg-surface text-foreground"}`}>{name}</button>)}</div>
    {tab === "inventory" && <section className={card}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-foreground">Inventory by product size</h2><div className="flex gap-2"><input className={`${field} max-w-xs`} placeholder="Search product, size, SKU" value={search} onChange={e => setSearch(e.target.value)} /><label className="flex items-center gap-2 whitespace-nowrap text-sm text-foreground"><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} />Low stock</label></div></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-muted-foreground"><tr><th className="p-3">Product</th><th className="p-3">Size</th><th className="p-3">SKU</th><th className="p-3">Available</th><th className="p-3">Audit</th></tr></thead><tbody>{inventory.map(item => <tr key={item.variant_id} className="border-t border-border"><td className="p-3 font-medium text-foreground">{item.product_name}</td><td className="p-3">{item.size}</td><td className="p-3">{item.sku}</td><td className={`p-3 font-semibold ${item.stock_qty <= 5 ? "text-amber-500" : "text-foreground"}`}>{item.stock_qty}</td><td className="p-3"><button onClick={() => void adjust(item)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground">Adjust stock</button></td></tr>)}</tbody></table>{inventory.length === 0 && <p className="p-5 text-sm text-muted-foreground">No inventory records found.</p>}</div></section>}
    {tab === "purchasing" && <div className="grid gap-5 xl:grid-cols-[340px_1fr]"><div className="space-y-5"><SupplierManager suppliers={suppliers} onSaved={load} onError={setError} /><form onSubmit={createPO} className={`${card} space-y-3`}><h2 className="font-semibold text-foreground">Create purchase order</h2><select required className={field} value={poSupplier} onChange={e => setPoSupplier(e.target.value)}><option value="">Supplier</option>{suppliers.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select required className={field} value={poVariant} onChange={e => setPoVariant(e.target.value)}><option value="">Product and size</option>{inventory.map(i => <option key={i.variant_id} value={i.variant_id}>{i.product_name} · {i.size}</option>)}</select><input required type="number" min="1" className={field} aria-label="Quantity ordered" value={poQuantity} onChange={e => setPoQuantity(e.target.value)} /><input required type="number" min="0" step="0.01" placeholder="Unit cost ₹" className={field} value={poCost} onChange={e => setPoCost(e.target.value)} /><button disabled={!suppliers.some(s => s.is_active)} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Create order</button>{!suppliers.some(s => s.is_active) && <p className="text-xs text-muted-foreground">Add or reactivate a supplier before creating a purchase order.</p>}</form></div><section className={`${card} space-y-3`}><h2 className="font-semibold text-foreground">Purchase orders</h2><div className="grid gap-2 md:grid-cols-2"><select className={field} aria-label="Inventory asset account" value={inventoryAccountId} onChange={e => setInventoryAccountId(e.target.value)}><option value="">Inventory asset account</option>{ledgerAccounts.filter(a => a.is_active && a.account_type === "asset").map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select><select className={field} aria-label="Supplier payable account" value={payableAccountId} onChange={e => setPayableAccountId(e.target.value)}><option value="">Supplier payable liability account</option>{ledgerAccounts.filter(a => a.is_active && a.account_type === "liability").map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></div><p className="text-xs text-muted-foreground">Receiving stock posts its received cost to inventory and supplier payable in the general ledger.</p>{orders.map(po => <article key={po.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold text-foreground">{po.id} · {po.supplier_name}</p><p className="text-xs capitalize text-muted-foreground">{po.status}</p></div><div className="flex gap-2"><button disabled={po.status === "received" || po.status === "cancelled"} onClick={() => void receiveRemaining(po)} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40">Receive remaining stock</button>{["ordered", "partially_received"].includes(po.status) && <button onClick={() => void cancelPO(po)} className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-400">Cancel remainder</button>}</div></div>{po.items.map(line => <p key={line.id} className="mt-3 text-sm text-muted-foreground">{line.product_name} / {line.size} · {line.quantity_received} of {line.quantity_ordered} received · ₹{line.unit_cost} each</p>)}</article>)}{orders.length === 0 && <p className="text-sm text-muted-foreground">No purchase orders yet.</p>}</section></div>}
    {tab === "expenses" && <div className="grid gap-5 lg:grid-cols-[340px_1fr]"><form onSubmit={addExpense} className={`${card} space-y-3`}><h2 className="font-semibold text-foreground">Record operating expense</h2><select className={field} value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>{["Operations", "Shipping", "Marketing", "Utilities", "Packaging", "Other"].map(c => <option key={c}>{c}</option>)}</select><input required className={field} placeholder="Description" value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} /><input required type="number" min="0.01" step="0.01" placeholder="Amount ₹" className={field} value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} /><input type="number" min="0" step="0.01" aria-label="Tax amount" placeholder="Tax amount ₹" className={field} value={expenseTax} onChange={e => setExpenseTax(e.target.value)} /><select required className={field} value={expenseAccountId} onChange={e => setExpenseAccountId(e.target.value)}><option value="">Debit expense account</option>{ledgerAccounts.filter(a => a.is_active && a.account_type === "expense").map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select><select required className={field} value={creditAccountId} onChange={e => setCreditAccountId(e.target.value)}><option value="">Credit cash / payable account</option>{ledgerAccounts.filter(a => a.is_active && ["asset", "liability"].includes(a.account_type)).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>{Number(expenseTax) > 0 && <select required className={field} value={inputTaxAccountId} onChange={e => setInputTaxAccountId(e.target.value)}><option value="">Input tax asset account</option>{ledgerAccounts.filter(a => a.is_active && a.account_type === "asset").map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>}<button disabled={!ledgerAccounts.some(a => a.is_active && a.account_type === "expense") || !ledgerAccounts.some(a => a.is_active && ["asset", "liability"].includes(a.account_type))} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save and post expense</button><p className="text-xs text-muted-foreground">Saves the expense and posts a balanced journal in one transaction. Tax treatment must follow your accountant’s instructions.</p></form><section className={`${card} overflow-x-auto`}><h2 className="mb-4 font-semibold text-foreground">Expense register</h2><table className="w-full min-w-[540px] text-left text-sm"><thead className="text-muted-foreground"><tr><th className="p-3">Date</th><th className="p-3">Category</th><th className="p-3">Description</th><th className="p-3">Amount + tax</th></tr></thead><tbody>{expenses.map(e => <tr key={e.id} className="border-t border-border"><td className="p-3">{e.expense_date}</td><td className="p-3">{e.category}</td><td className="p-3">{e.description}</td><td className="p-3">₹{(Number(e.amount) + Number(e.tax_amount)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>)}</tbody></table>{expenses.length === 0 && <p className="p-4 text-sm text-muted-foreground">No expenses recorded.</p>}</section></div>}
  </div></main>;
}
