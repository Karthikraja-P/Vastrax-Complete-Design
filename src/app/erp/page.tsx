"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";
import SupplierManager from "@/components/erp/SupplierManager";

type Inventory = { variant_id: string; product_id: string; product_name: string; size: string; sku: string; stock_qty: number };
type Page<T> = { items: T[]; total: number; has_more: boolean };
type InventoryMovement = { id: string; quantity_delta: number; stock_before: number; stock_after: number; reason: string; notes: string | null; created_at: string; reference_id: string | null };
type Supplier = { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; gstin: string | null; address: string | null; is_active: boolean };
type PurchaseOrder = { id: string; supplier_name: string; status: string; items: Array<{ id: string; product_name: string; size: string; quantity_ordered: number; quantity_received: number; unit_cost: string }> };
type PurchasePayable = { purchase_order_id: string; supplier_name: string; status: string; received_total: string; paid_total: string; outstanding_total: string; accounts: Array<{ payable_account_id: string; payable_account_code: string; payable_account_name: string; received_total: string; paid_total: string; outstanding_total: string }>; payments: Array<{ amount: string; payment_date: string; reference: string; journal_entry_id: string }> };
type SupplierExpensePayable = { expense_id: string; supplier_name: string; description: string; category: string; expense_date: string; reference: string | null; received_total: string; paid_total: string; outstanding_total: string; accounts: PurchasePayable["accounts"]; payments: PurchasePayable["payments"] };
type Expense = { id: string; category: string; description: string; amount: string; tax_amount: string; expense_date: string; reference: string | null };
type LedgerAccount = { id: string; code: string; name: string; account_type: string; is_active: boolean };
const card = "rounded-2xl border border-border bg-surface p-5";
const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

export default function ERPPage() {
  const [tab, setTab] = useState<"inventory" | "purchasing" | "payables" | "expenses">("inventory");
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [movementVariant, setMovementVariant] = useState<string | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0); const [ordersMore, setOrdersMore] = useState(false); const [ordersBusy, setOrdersBusy] = useState(false);
  const [payables, setPayables] = useState<PurchasePayable[]>([]);
  const [payablesTotal, setPayablesTotal] = useState(0); const [payablesMore, setPayablesMore] = useState(false); const [payablesBusy, setPayablesBusy] = useState(false);
  const [expensePayables, setExpensePayables] = useState<SupplierExpensePayable[]>([]);
  const [expensePayablesTotal, setExpensePayablesTotal] = useState(0); const [expensePayablesMore, setExpensePayablesMore] = useState(false); const [expensePayablesBusy, setExpensePayablesBusy] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesTotal, setExpensesTotal] = useState(0); const [expensesMore, setExpensesMore] = useState(false); const [expensesBusy, setExpensesBusy] = useState(false);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [inputTaxAccountId, setInputTaxAccountId] = useState("");
  const [inventoryAccountId, setInventoryAccountId] = useState("");
  const [payableAccountId, setPayableAccountId] = useState("");
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<Record<string, number | string>>({});
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [poSupplier, setPoSupplier] = useState(""); const [creatingPO, setCreatingPO] = useState(false);
  const [poItems, setPoItems] = useState<Array<{ variant_id: string; quantity: string; unit_cost: string }>>([
    { variant_id: "", quantity: "1", unit_cost: "" },
  ]);
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Operations");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseTax, setExpenseTax] = useState("0");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const inventoryUrl = `/erp/inventory${search || lowOnly ? `?${[search ? `q=${encodeURIComponent(search)}` : "", lowOnly ? "low_stock_only=true" : ""].filter(Boolean).join("&")}` : ""}`;
      const [items, supplierRows, poPage, payablePage, expensePayablePage, expensePage, metrics, accountRows] = await Promise.all([
        fetchApi<Inventory[]>(inventoryUrl), fetchApi<Supplier[]>("/erp/suppliers"),
        fetchApi<Page<PurchaseOrder>>("/erp/purchase-orders?limit=100"), fetchApi<Page<PurchasePayable>>("/erp/payables?limit=100"), fetchApi<Page<SupplierExpensePayable>>("/erp/payables/expenses?limit=100"), fetchApi<Page<Expense>>("/erp/expenses?limit=100"), fetchApi<Record<string, number | string>>("/erp/overview"), fetchApi<LedgerAccount[]>("/erp/accounts"),
      ]);
      setInventory(items); setSuppliers(supplierRows); setOrders(poPage.items); setOrdersTotal(poPage.total); setOrdersMore(poPage.has_more);
      setPayables(payablePage.items); setPayablesTotal(payablePage.total); setPayablesMore(payablePage.has_more);
      setExpensePayables(expensePayablePage.items); setExpensePayablesTotal(expensePayablePage.total); setExpensePayablesMore(expensePayablePage.has_more);
      setExpenses(expensePage.items); setExpensesTotal(expensePage.total); setExpensesMore(expensePage.has_more); setSummary(metrics); setLedgerAccounts(accountRows); setError("");
      if (!expenseAccountId && accountRows.find(a => a.is_active && a.account_type === "expense")) setExpenseAccountId(accountRows.find(a => a.is_active && a.account_type === "expense")!.id);
      if (!creditAccountId && accountRows.find(a => a.is_active && ["asset", "liability"].includes(a.account_type))) setCreditAccountId(accountRows.find(a => a.is_active && ["asset", "liability"].includes(a.account_type))!.id);
      if (!inputTaxAccountId && accountRows.find(a => a.is_active && a.account_type === "asset")) setInputTaxAccountId(accountRows.find(a => a.is_active && a.account_type === "asset")!.id);
      if (!inventoryAccountId && accountRows.find(a => a.is_active && a.account_type === "asset")) setInventoryAccountId(accountRows.find(a => a.is_active && a.account_type === "asset")!.id);
      if (!payableAccountId && accountRows.find(a => a.is_active && a.account_type === "liability")) setPayableAccountId(accountRows.find(a => a.is_active && a.account_type === "liability")!.id);
      if (!poSupplier && supplierRows.find(s => s.is_active)) setPoSupplier(supplierRows.find(s => s.is_active)!.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load operations data. Check your admin sign-in."); }
  }, [search, lowOnly, poSupplier, expenseAccountId, creditAccountId, inputTaxAccountId, inventoryAccountId, payableAccountId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const loadMoreOrders = async () => {
    setOrdersBusy(true);
    try { const page = await fetchApi<Page<PurchaseOrder>>(`/erp/purchase-orders?limit=100&offset=${orders.length}`); setOrders(current => [...current, ...page.items]); setOrdersTotal(page.total); setOrdersMore(page.has_more); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load more purchase orders."); }
    finally { setOrdersBusy(false); }
  };
  const loadMorePayables = async () => {
    setPayablesBusy(true);
    try { const page = await fetchApi<Page<PurchasePayable>>(`/erp/payables?limit=100&offset=${payables.length}`); setPayables(current => [...current, ...page.items]); setPayablesTotal(page.total); setPayablesMore(page.has_more); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load more payables."); }
    finally { setPayablesBusy(false); }
  };
  const loadMoreExpensePayables = async () => {
    setExpensePayablesBusy(true);
    try { const page = await fetchApi<Page<SupplierExpensePayable>>(`/erp/payables/expenses?limit=100&offset=${expensePayables.length}`); setExpensePayables(current => [...current, ...page.items]); setExpensePayablesTotal(page.total); setExpensePayablesMore(page.has_more); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load more supplier expense payables."); }
    finally { setExpensePayablesBusy(false); }
  };
  const loadMoreExpenses = async () => {
    setExpensesBusy(true);
    try { const page = await fetchApi<Page<Expense>>(`/erp/expenses?limit=100&offset=${expenses.length}`); setExpenses(current => [...current, ...page.items]); setExpensesTotal(page.total); setExpensesMore(page.has_more); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load more expenses."); }
    finally { setExpensesBusy(false); }
  };

  const createPO = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!poSupplier || !poItems.length || poItems.some(item => !item.variant_id || !item.quantity || Number(item.quantity) < 1 || !item.unit_cost || Number(item.unit_cost) < 0)) return;
    setCreatingPO(true);
    try {
      const request = {
        supplier_id: poSupplier,
        items: poItems.map(item => ({ variant_id: item.variant_id, quantity: Number(item.quantity), unit_cost: item.unit_cost })),
      };
      const storageKey = `vastrax:purchase-order:${JSON.stringify(request)}`;
      let idempotencyKey = sessionStorage.getItem(storageKey);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        sessionStorage.setItem(storageKey, idempotencyKey);
      }
      await fetchApi("/erp/purchase-orders", { method: "POST", body: JSON.stringify({ ...request, idempotency_key: idempotencyKey }) });
      sessionStorage.removeItem(storageKey);
      setPoItems([{ variant_id: "", quantity: "1", unit_cost: "" }]);
      await load();
    }
    catch (e) { setError(e instanceof Error ? e.message : "Could not create purchase order."); }
    finally { setCreatingPO(false); }
  };
  const receiveSelected = async (po: PurchaseOrder) => {
    const receipt = po.items.map(line => ({ line_id: line.id, quantity: Number(receiptQuantities[line.id] || 0) })).filter(line => line.quantity > 0);
    if (!receipt.length) { setError("Enter a receipt quantity for at least one purchase order item."); return; }
    const exceedsOpen = receipt.some(item => {
      const line = po.items.find(row => row.id === item.line_id)!;
      return item.quantity > line.quantity_ordered - line.quantity_received;
    });
    if (exceedsOpen) { setError("A receipt quantity cannot exceed the remaining quantity on its purchase order line."); return; }
    if (!inventoryAccountId || !payableAccountId) { setError("Select an inventory asset and supplier payable liability account before receiving stock."); return; }
    const receiptRequest = { inventory_account_id: inventoryAccountId, payable_account_id: payableAccountId, items: receipt };
    const storageKey = `vastrax:receipt:${po.id}:${JSON.stringify(receiptRequest)}`;
    let idempotencyKey = sessionStorage.getItem(storageKey);
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      sessionStorage.setItem(storageKey, idempotencyKey);
    }
    try {
      await fetchApi(`/erp/purchase-orders/${po.id}/receive`, { method: "POST", body: JSON.stringify({ ...receiptRequest, idempotency_key: idempotencyKey }) });
      sessionStorage.removeItem(storageKey);
      setReceiptQuantities(current => {
        const next = { ...current };
        for (const item of receipt) delete next[item.line_id];
        return next;
      });
      await load();
    }
    catch (e) { setError(e instanceof Error ? e.message : "Could not receive stock."); }
  };
  const recordSupplierPayment = async (event: React.FormEvent<HTMLFormElement>, poId: string, payableAccountId: string) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await fetchApi(`/erp/payables/${poId}/payments`, { method: "POST", body: JSON.stringify({
        amount: values.get("amount"),
        payment_date: values.get("payment_date"),
        reference: values.get("reference"),
        payable_account_id: payableAccountId,
        payment_account_id: values.get("payment_account_id"),
      }) });
      form.reset();
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not record supplier payment."); }
  };

  const recordSupplierExpensePayment = async (event: React.FormEvent<HTMLFormElement>, expenseId: string, payableAccountId: string) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await fetchApi(`/erp/payables/expenses/${expenseId}/payments`, { method: "POST", body: JSON.stringify({
        amount: values.get("amount"),
        payment_date: values.get("payment_date"),
        reference: values.get("reference"),
        payable_account_id: payableAccountId,
        payment_account_id: values.get("payment_account_id"),
      }) });
      form.reset();
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not record supplier expense payment."); }
  };

  const cancelPO = async (po: PurchaseOrder) => {
    if (!window.confirm(`Cancel the unreceived remainder of ${po.id}? Received stock and its accounting entry will stay recorded.`)) return;
    try { await fetchApi(`/erp/purchase-orders/${po.id}/cancel`, { method: "POST" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not cancel purchase order."); }
  };
  const adjust = async (item: Inventory) => {
    const raw = window.prompt("Enter a positive or negative whole quantity to adjust " + item.product_name + " · " + item.size + ".", "0");
    if (!raw || !/^-?\d+$/.test(raw) || Number(raw) === 0) return;
    const reasonChoices = ["count_correction", "damaged", "returned", "other"];
    const choice = window.prompt("Select a reason: 1 Count correction, 2 Damaged, 3 Returned, 4 Other", "1");
    if (!choice || !/^[1-4]$/.test(choice)) return;
    const notes = window.prompt("Add a note for the stock audit history (optional):", "") || undefined;
    try {
      await fetchApi("/erp/inventory/" + item.variant_id + "/adjust", { method: "POST", body: JSON.stringify({ quantity_delta: Number(raw), reason: reasonChoices[Number(choice) - 1], notes }) });
      await load();
      const rows = await fetchApi<InventoryMovement[]>("/erp/inventory/movements?variant_id=" + encodeURIComponent(item.variant_id));
      setMovementVariant(item.variant_id); setMovements(rows);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not adjust stock."); }
  };
  const viewMovements = async (item: Inventory) => {
    if (movementVariant === item.variant_id) { setMovementVariant(null); return; }
    try {
      const rows = await fetchApi<InventoryMovement[]>("/erp/inventory/movements?variant_id=" + encodeURIComponent(item.variant_id));
      setMovementVariant(item.variant_id); setMovements(rows);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load stock history."); }
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
    <div className="flex flex-wrap gap-2">{(["inventory", "purchasing", "payables", "expenses"] as const).map(name => <button key={name} onClick={() => setTab(name)} className={`rounded-full px-4 py-2 text-sm capitalize ${tab === name ? "bg-accent text-white" : "bg-surface text-foreground"}`}>{name === "payables" ? "Supplier payables" : name}</button>)}</div>
    {tab === "purchasing" && ordersMore && <div className={card}><p className="mb-2 text-xs text-muted-foreground">Showing {orders.length} of {ordersTotal} purchase orders</p><button disabled={ordersBusy} onClick={() => void loadMoreOrders()} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">{ordersBusy ? "Loading..." : "Load more purchase orders"}</button></div>}
    {tab === "payables" && payablesMore && <div className={card}><p className="mb-2 text-xs text-muted-foreground">Showing {payables.length} of {payablesTotal} purchase order balances</p><button disabled={payablesBusy} onClick={() => void loadMorePayables()} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">{payablesBusy ? "Loading..." : "Load more purchase order balances"}</button></div>}
    {tab === "payables" && expensePayablesMore && <div className={card}><p className="mb-2 text-xs text-muted-foreground">Showing {expensePayables.length} of {expensePayablesTotal} supplier expense balances</p><button disabled={expensePayablesBusy} onClick={() => void loadMoreExpensePayables()} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">{expensePayablesBusy ? "Loading..." : "Load more expense balances"}</button></div>}
    {tab === "expenses" && expensesMore && <div className={card}><p className="mb-2 text-xs text-muted-foreground">Showing {expenses.length} of {expensesTotal} expenses</p><button disabled={expensesBusy} onClick={() => void loadMoreExpenses()} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">{expensesBusy ? "Loading..." : "Load more expenses"}</button></div>}
    {tab === "inventory" && <section className={card}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-foreground">Inventory by product size</h2><div className="flex gap-2"><input className={`${field} max-w-xs`} placeholder="Search product, size, SKU" value={search} onChange={e => setSearch(e.target.value)} /><label className="flex items-center gap-2 whitespace-nowrap text-sm text-foreground"><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} />Low stock</label></div></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-muted-foreground"><tr><th className="p-3">Product</th><th className="p-3">Size</th><th className="p-3">SKU</th><th className="p-3">Available</th><th className="p-3">Audit</th></tr></thead><tbody>{inventory.map(item => <tr key={item.variant_id} className="border-t border-border"><td className="p-3 font-medium text-foreground">{item.product_name}</td><td className="p-3">{item.size}</td><td className="p-3">{item.sku}</td><td className={`p-3 font-semibold ${item.stock_qty <= 5 ? "text-amber-500" : "text-foreground"}`}>{item.stock_qty}</td><td className="p-3"><div className="flex gap-2"><button onClick={() => void adjust(item)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground">Adjust stock</button><button onClick={() => void viewMovements(item)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground">Stock history</button></div></td></tr>)}</tbody></table>{inventory.length === 0 && <p className="p-5 text-sm text-muted-foreground">No inventory records found.</p>}</div>{movementVariant && <section className="mt-5 rounded-xl border border-border p-4" aria-live="polite"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-foreground">Recent stock movements</h3><button onClick={() => setMovementVariant(null)} className="text-xs text-muted-foreground">Close</button></div>{movements.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-muted-foreground"><tr><th className="p-2">Date</th><th className="p-2">Change</th><th className="p-2">Balance</th><th className="p-2">Reason</th><th className="p-2">Notes</th></tr></thead><tbody>{movements.map(movement => <tr key={movement.id} className="border-t border-border"><td className="p-2">{new Date(movement.created_at).toLocaleString()}</td><td className="p-2">{movement.quantity_delta > 0 ? "+" : ""}{movement.quantity_delta}</td><td className="p-2">{movement.stock_before} → {movement.stock_after}</td><td className="p-2">{movement.reason.replaceAll("_", " ")}</td><td className="p-2">{movement.notes || movement.reference_id || "—"}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">No stock movement history recorded for this size.</p>}</section>}</section>}
    {tab === "purchasing" && <div className="grid gap-5 xl:grid-cols-[340px_1fr]"><div className="space-y-5"><SupplierManager suppliers={suppliers} onSaved={load} onError={setError} /><form onSubmit={createPO} className={`${card} space-y-3`}><h2 className="font-semibold text-foreground">Create purchase order</h2><select required className={field} value={poSupplier} onChange={e => setPoSupplier(e.target.value)}><option value="">Supplier</option>{suppliers.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><div className="space-y-3">{poItems.map((item, index) => <div key={index} className="space-y-2 rounded-xl border border-border p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-muted-foreground">Item {index + 1}</p>{poItems.length > 1 && <button type="button" onClick={() => setPoItems(current => current.filter((_, i) => i !== index))} className="text-xs text-red-400">Remove</button>}</div><select required className={field} value={item.variant_id} aria-label={"Product and size for item " + (index + 1)} onChange={e => setPoItems(current => current.map((row, i) => i === index ? { ...row, variant_id: e.target.value } : row))}><option value="">Product and size</option>{inventory.map(i => <option key={i.variant_id} value={i.variant_id}>{i.product_name} · {i.size}</option>)}</select><div className="grid grid-cols-2 gap-2"><input required type="number" min="1" step="1" className={field} aria-label={"Quantity for item " + (index + 1)} value={item.quantity} onChange={e => setPoItems(current => current.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} /><input required type="number" min="0" step="0.01" placeholder="Unit cost ₹" aria-label={"Unit cost for item " + (index + 1)} className={field} value={item.unit_cost} onChange={e => setPoItems(current => current.map((row, i) => i === index ? { ...row, unit_cost: e.target.value } : row))} /></div></div>)}</div><button type="button" onClick={() => setPoItems(current => [...current, { variant_id: "", quantity: "1", unit_cost: "" }])} className="w-full rounded-lg border border-border px-4 py-2 text-sm text-foreground">Add another item</button><button disabled={creatingPO || !suppliers.some(s => s.is_active) || inventory.length === 0} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{creatingPO ? "Creating…" : "Create order"}</button>{!suppliers.some(s => s.is_active) && <p className="text-xs text-muted-foreground">Add or reactivate a supplier before creating a purchase order.</p>}{inventory.length === 0 && <p className="text-xs text-muted-foreground">Add a product size variant before creating a purchase order.</p>}</form></div><section className={`${card} space-y-3`}><h2 className="font-semibold text-foreground">Purchase orders</h2><div className="grid gap-2 md:grid-cols-2"><select className={field} aria-label="Inventory asset account" value={inventoryAccountId} onChange={e => setInventoryAccountId(e.target.value)}><option value="">Inventory asset account</option>{ledgerAccounts.filter(a => a.is_active && a.account_type === "asset").map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select><select className={field} aria-label="Supplier payable account" value={payableAccountId} onChange={e => setPayableAccountId(e.target.value)}><option value="">Supplier payable liability account</option>{ledgerAccounts.filter(a => a.is_active && a.account_type === "liability").map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></div><p className="text-xs text-muted-foreground">Receiving stock posts its received cost to inventory and supplier payable in the general ledger.</p>{orders.map(po => <article key={po.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold text-foreground">{po.id} · {po.supplier_name}</p><p className="text-xs capitalize text-muted-foreground">{po.status}</p></div><div className="flex gap-2"><button disabled={po.status === "received" || po.status === "cancelled"} onClick={() => void receiveSelected(po)} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40">Post selected receipt</button>{["ordered", "partially_received"].includes(po.status) && <button onClick={() => void cancelPO(po)} className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-400">Cancel remainder</button>}</div></div>{po.items.map(line => <div key={line.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-muted-foreground">{line.product_name} / {line.size} · {line.quantity_received} of {line.quantity_ordered} received · ₹{line.unit_cost} each</p>{!["received", "cancelled"].includes(po.status) && line.quantity_received < line.quantity_ordered && <input type="number" min="0" max={line.quantity_ordered - line.quantity_received} step="1" aria-label={"Receipt quantity for " + line.product_name + " size " + line.size} placeholder={"Receive up to " + (line.quantity_ordered - line.quantity_received)} className={field + " max-w-40"} value={receiptQuantities[line.id] ?? ""} onChange={e => setReceiptQuantities(current => ({ ...current, [line.id]: e.target.value }))} />}</div>)}</article>)}{orders.length === 0 && <p className="text-sm text-muted-foreground">No purchase orders yet.</p>}</section></div>}
    {tab === "payables" && <section className={card}><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-foreground">Supplier payables</h2><p className="mt-1 text-sm text-muted-foreground">Received purchase orders, matched to the liability accounts used on their receipt entries.</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Outstanding on loaded purchase orders</p><p className="text-xl font-semibold text-foreground">₹{payables.reduce((total, po) => total + Number(po.outstanding_total), 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p></div></div>{payables.map(po => <article key={po.purchase_order_id} className="mb-4 rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold text-foreground">{po.purchase_order_id} · {po.supplier_name}</h3><p className="text-xs capitalize text-muted-foreground">PO status: {po.status}</p></div><p className="text-sm text-foreground">Received ₹{Number(po.received_total).toLocaleString("en-IN", { maximumFractionDigits: 2 })} · Paid ₹{Number(po.paid_total).toLocaleString("en-IN", { maximumFractionDigits: 2 })} · Due ₹{Number(po.outstanding_total).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p></div><div className="mt-4 space-y-4">{po.accounts.map(account => <div key={account.payable_account_id} className="rounded-lg bg-background p-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="text-foreground">{account.payable_account_code} · {account.payable_account_name}</span><span className="text-muted-foreground">Due ₹{Number(account.outstanding_total).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>{Number(account.outstanding_total) > 0 && <form onSubmit={event => void recordSupplierPayment(event, po.purchase_order_id, account.payable_account_id)} className="mt-3 grid gap-2 md:grid-cols-4"><input required name="amount" type="number" min="0.01" max={account.outstanding_total} step="0.01" aria-label="Payment amount" placeholder="Payment amount ₹" className={field} /><input required name="payment_date" type="date" aria-label="Payment date" defaultValue={new Date().toISOString().slice(0, 10)} className={field} /><input required name="reference" maxLength={100} aria-label="Bank or payment reference" placeholder="Bank/payment reference" className={field} /><select required name="payment_account_id" aria-label="Cash or bank account" className={field} defaultValue=""><option value="">Paid from cash/bank account</option>{ledgerAccounts.filter(a => a.is_active && a.account_type === "asset").map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select><button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white md:col-span-4">Record supplier payment</button></form>}</div>)}</div>{po.payments.length > 0 && <div className="mt-4 border-t border-border pt-3"><p className="mb-2 text-xs font-semibold text-muted-foreground">Payment history</p>{po.payments.map(payment => <p key={payment.journal_entry_id} className="text-xs text-muted-foreground">{payment.payment_date} · {payment.reference} · ₹{payment.amount} · journal {payment.journal_entry_id}</p>)}</div>}</article>)}{payables.length === 0 && <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No received purchase orders have payable balances yet.</p>}<p className="mt-4 text-xs text-muted-foreground">Recording a payment posts debit to the selected payable account and credit to the selected cash or bank account. Each payment requires a unique bank/payment reference. GST and invoice treatment are not inferred here.</p></section>}
    {tab === "payables" && <section className={card}><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-foreground">Supplier expense payables</h2><p className="mt-1 text-sm text-muted-foreground">Supplier-linked expenses posted to a liability account, with payment history.</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Outstanding supplier expenses</p><p className="text-xl font-semibold text-foreground">₹{expensePayables.reduce((total, expense) => total + Number(expense.outstanding_total), 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p></div></div>{expensePayables.map(expense => <article key={expense.expense_id} className="mb-4 rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold text-foreground">{expense.supplier_name} · {expense.description}</h3><p className="text-xs text-muted-foreground">{expense.category} · {expense.expense_date}{expense.reference ? " · " + expense.reference : ""}</p></div><p className="text-sm text-foreground">Posted ₹{Number(expense.received_total).toLocaleString("en-IN", { maximumFractionDigits: 2 })} · Paid ₹{Number(expense.paid_total).toLocaleString("en-IN", { maximumFractionDigits: 2 })} · Due ₹{Number(expense.outstanding_total).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p></div><div className="mt-4 space-y-4">{expense.accounts.map(account => <div key={account.payable_account_id} className="rounded-lg bg-background p-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="text-foreground">{account.payable_account_code} · {account.payable_account_name}</span><span className="text-muted-foreground">Due ₹{Number(account.outstanding_total).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>{Number(account.outstanding_total) > 0 && <form onSubmit={event => void recordSupplierExpensePayment(event, expense.expense_id, account.payable_account_id)} className="mt-3 grid gap-2 md:grid-cols-4"><input required name="amount" type="number" min="0.01" max={account.outstanding_total} step="0.01" aria-label="Supplier expense payment amount" placeholder="Payment amount ₹" className={field} /><input required name="payment_date" type="date" aria-label="Supplier expense payment date" defaultValue={new Date().toISOString().slice(0, 10)} className={field} /><input required name="reference" maxLength={100} aria-label="Supplier expense bank reference" placeholder="Bank/payment reference" className={field} /><select required name="payment_account_id" aria-label="Supplier expense cash or bank account" className={field} defaultValue=""><option value="">Paid from cash/bank account</option>{ledgerAccounts.filter(a => a.is_active && a.account_type === "asset").map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select><button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white md:col-span-4">Record supplier expense payment</button></form>}</div>)}</div>{expense.payments.length > 0 && <div className="mt-4 border-t border-border pt-3"><p className="mb-2 text-xs font-semibold text-muted-foreground">Payment history</p>{expense.payments.map(payment => <p key={payment.journal_entry_id} className="text-xs text-muted-foreground">{payment.payment_date} · {payment.reference} · ₹{payment.amount} · journal {payment.journal_entry_id}</p>)}</div>}</article>)}{expensePayables.length === 0 && <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No unpaid supplier-linked expenses posted to liability accounts.</p>}<p className="mt-4 text-xs text-muted-foreground">Payments debit the liability account used for the expense and credit the selected cash or bank account. Tax amounts follow the account selection made when the expense was recorded; this screen does not determine GST eligibility.</p></section>}
    {tab === "expenses" && <div className="grid gap-5 lg:grid-cols-[340px_1fr]"><form onSubmit={addExpense} className={`${card} space-y-3`}><h2 className="font-semibold text-foreground">Record operating expense</h2><select className={field} value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>{["Operations", "Shipping", "Marketing", "Utilities", "Packaging", "Other"].map(c => <option key={c}>{c}</option>)}</select><input required className={field} placeholder="Description" value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} /><input required type="number" min="0.01" step="0.01" placeholder="Amount ₹" className={field} value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} /><input type="number" min="0" step="0.01" aria-label="Tax amount" placeholder="Tax amount ₹" className={field} value={expenseTax} onChange={e => setExpenseTax(e.target.value)} /><select required className={field} value={expenseAccountId} onChange={e => setExpenseAccountId(e.target.value)}><option value="">Debit expense account</option>{ledgerAccounts.filter(a => a.is_active && a.account_type === "expense").map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select><select required className={field} value={creditAccountId} onChange={e => setCreditAccountId(e.target.value)}><option value="">Credit cash / payable account</option>{ledgerAccounts.filter(a => a.is_active && ["asset", "liability"].includes(a.account_type)).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>{Number(expenseTax) > 0 && <select required className={field} value={inputTaxAccountId} onChange={e => setInputTaxAccountId(e.target.value)}><option value="">Input tax asset account</option>{ledgerAccounts.filter(a => a.is_active && a.account_type === "asset").map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>}<button disabled={!ledgerAccounts.some(a => a.is_active && a.account_type === "expense") || !ledgerAccounts.some(a => a.is_active && ["asset", "liability"].includes(a.account_type))} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save and post expense</button><p className="text-xs text-muted-foreground">Saves the expense and posts a balanced journal in one transaction. Tax treatment must follow your accountant’s instructions.</p></form><section className={`${card} overflow-x-auto`}><h2 className="mb-4 font-semibold text-foreground">Expense register</h2><table className="w-full min-w-[540px] text-left text-sm"><thead className="text-muted-foreground"><tr><th className="p-3">Date</th><th className="p-3">Category</th><th className="p-3">Description</th><th className="p-3">Amount + tax</th></tr></thead><tbody>{expenses.map(e => <tr key={e.id} className="border-t border-border"><td className="p-3">{e.expense_date}</td><td className="p-3">{e.category}</td><td className="p-3">{e.description}</td><td className="p-3">₹{(Number(e.amount) + Number(e.tax_amount)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>)}</tbody></table>{expenses.length === 0 && <p className="p-4 text-sm text-muted-foreground">No expenses recorded.</p>}</section></div>}
  </div></main>;
}
