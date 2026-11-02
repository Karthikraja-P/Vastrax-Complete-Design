"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
type ReturnableOrder = { id: string; items: Array<{ order_item_id: string; product_name: string; size: string; quantity: number }> };
type ReturnLine = { id: string; product_name: string; size: string; quantity_requested: number; quantity_received: number; quantity_restocked: number; unit_price: string };
type ReturnPayment = { id: string; amount: string; status: string; refundable_amount: string; refunds: Array<{ id: string; amount: string; status: string; created_at: string }> };
type ReturnCase = { id: string; order_id: string; status: string; reason: string; request_source: string; notes: string | null; reverse_shipment_id: string | null; reverse_awb: string | null; reverse_courier: string | null; reverse_status: string | null; reverse_pickup_date: string | null; items: ReturnLine[]; payments: ReturnPayment[] };
const card = "rounded-2xl border border-border bg-surface p-5";
const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
export default function ReturnsPage() {
  const [orders, setOrders] = useState<ReturnableOrder[]>([]); const [cases, setCases] = useState<ReturnCase[]>([]);
  const [orderId, setOrderId] = useState(""); const [itemId, setItemId] = useState(""); const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("size"); const [notes, setNotes] = useState(""); const [error, setError] = useState("");
  const [refundPaymentIds, setRefundPaymentIds] = useState<Record<string, string>>({});
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
  const [pickupDates, setPickupDates] = useState<Record<string, string>>({});
  const [trackingByReturn, setTrackingByReturn] = useState<Record<string, { loading: boolean; data?: { status?: string; awb?: string; courier?: string; scans?: Array<{ activity?: string; date?: string; location?: string }> }; error?: string }>>({});
  const selectedOrder = orders.find(row => row.id === orderId); const selectedItem = selectedOrder?.items.find(row => row.order_item_id === itemId);
  const needsReversePickupRetry = (item: ReturnCase) => !item.reverse_shipment_id || !item.reverse_awb || /failed|error/i.test(item.reverse_status || "");
  const load = useCallback(async () => { try { const [o, r] = await Promise.all([fetchApi<ReturnableOrder[]>("/erp/returnable-orders"), fetchApi<ReturnCase[]>("/erp/returns")]); setOrders(o); setCases(r); setError(""); if (!orderId && o[0]) setOrderId(o[0].id); } catch (e) { setError(e instanceof Error ? e.message : "Could not load returns. Sign in as an administrator."); } }, [orderId]);
  useEffect(() => { const t = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(t); }, [load]);
  const createCase = async (event: React.FormEvent) => { event.preventDefault(); if (!orderId || !itemId) return; try { await fetchApi("/erp/returns", { method: "POST", body: JSON.stringify({ order_id: orderId, reason, notes: notes || null, items: [{ order_item_id: itemId, quantity: Number(quantity) }] }) }); setNotes(""); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not log return."); } };
  const review = async (item: ReturnCase, decision: "approve" | "reject") => {
    if (decision === "approve" && !window.confirm("Approve this return and request a Shiprocket reverse pickup?")) return;
    const pickup_date = pickupDates[item.id] || new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    try {
      await fetchApi(`/erp/returns/${item.id}/review`, { method: "POST", body: JSON.stringify({ decision, ...(decision === "approve" ? { pickup_date } : {}) }) });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Return decision saved, but reverse pickup could not be booked. Review the request and retry."); await load(); }
  };
  const retryPickup = async (item: ReturnCase) => {
    const pickup_date = pickupDates[item.id] || item.reverse_pickup_date || new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    try {
      await fetchApi(`/erp/returns/${item.id}/book-pickup?pickup_date=${encodeURIComponent(pickup_date)}`, { method: "POST" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Shiprocket reverse pickup could not be booked."); await load(); }
  };
  const trackReturn = async (item: ReturnCase) => {
    setTrackingByReturn(current => ({ ...current, [item.id]: { loading: true } }));
    try {
      const response = await fetchApi<Record<string, unknown>>(`/erp/returns/${item.id}/tracking`);
      const tracking = (response.tracking || {}) as Record<string, unknown>;
      const trackingData = (tracking.tracking_data || {}) as Record<string, unknown>;
      const tracks = Array.isArray(trackingData.shipment_track) ? trackingData.shipment_track as Array<Record<string, unknown>> : [];
      const first = tracks[0] || {};
      const rawScans = trackingData.shipment_track_activities || first.shipment_track_activities || first.scans;
      setTrackingByReturn(current => ({ ...current, [item.id]: { loading: false, data: {
        status: String(first.current_status || response.reverse_status || "Tracking update unavailable"),
        awb: String(first.awb_code || response.reverse_awb || ""),
        courier: String(first.courier_name || response.reverse_courier || ""),
        scans: Array.isArray(rawScans) ? rawScans as Array<{ activity?: string; date?: string; location?: string }> : [],
      } } }));
    } catch (e) {
      setTrackingByReturn(current => ({ ...current, [item.id]: { loading: false, error: e instanceof Error ? e.message : "Could not load return tracking." } }));
    }
  };
  const issueRefund = async (item: ReturnCase) => {
    const txnId = refundPaymentIds[item.id]; const amount = Number(refundAmounts[item.id]);
    if (!txnId || !Number.isFinite(amount) || amount <= 0) { setError("Choose a captured payment and enter a valid refund amount."); return; }
    try {
      await fetchApi(`/erp/returns/${item.id}/refund`, { method: "POST", body: JSON.stringify({ txn_id: txnId, amount }) });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit refund."); }
  };
  const receive = async (item: ReturnCase) => { const line = item.items.find(row => row.quantity_received < row.quantity_requested); if (!line) return; const left = line.quantity_requested - line.quantity_received; const raw = window.prompt(`Units received for ${line.product_name} · ${line.size} (max ${left})`, String(left)); if (raw === null) return; const qty = Number(raw); if (!Number.isInteger(qty) || qty < 1 || qty > left) { setError(`Enter a whole number from 1 to ${left}.`); return; } const restockRaw = window.prompt(`Sellable units to return to stock (0 to ${qty})`, String(qty)); if (restockRaw === null) return; const restock = Number(restockRaw); if (!Number.isInteger(restock) || restock < 0 || restock > qty) { setError(`Enter a whole number from 0 to ${qty}.`); return; } try { await fetchApi(`/erp/returns/${item.id}/receive`, { method: "POST", body: JSON.stringify({ items: [{ line_id: line.id, quantity_received: qty, quantity_restocked: restock }] }) }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not record returned units."); } };
  return <main className="min-h-screen bg-background p-5 md:p-8"><div className="mx-auto max-w-6xl space-y-6"><header><Link href="/erp" className="text-sm text-accent">← Operations & finance</Link><h1 className="mt-2 text-3xl font-bold text-foreground">Returns</h1><p className="mt-1 text-sm text-muted-foreground">Log customer return requests after support contact, review each case, book reverse pickup with Shiprocket, track parcels, and reconcile received stock.</p></header>
  {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
  <form onSubmit={createCase} className={`${card} grid gap-3 md:grid-cols-5`}><select required className={field} value={orderId} onChange={e => { setOrderId(e.target.value); setItemId(""); }}><option value="">Delivered order</option>{orders.map(o => <option key={o.id} value={o.id}>{o.id}</option>)}</select><select required className={field} value={itemId} onChange={e => setItemId(e.target.value)}><option value="">Product item</option>{selectedOrder?.items.map(i => <option key={i.order_item_id} value={i.order_item_id}>{i.product_name} · {i.size} · qty {i.quantity}</option>)}</select><input required aria-label="Return quantity" className={field} type="number" min="1" max={selectedItem?.quantity ?? 1} value={quantity} onChange={e => setQuantity(e.target.value)} /><select className={field} value={reason} onChange={e => setReason(e.target.value)}>{["size", "damaged", "wrong_item", "quality", "other"].map(x => <option key={x} value={x}>{x.replace("_", " ")}</option>)}</select><button disabled={!orderId || !itemId} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Log return</button><input className={`${field} md:col-span-5`} placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} /><p className="text-xs text-muted-foreground md:col-span-5">Only delivered orders are eligible. This records return receipt and stock disposition; any customer refund must be issued through the existing payment/refund process.</p></form>
  <section className={`${card} space-y-3`}>
    <h2 className="text-lg font-semibold text-foreground">Return cases</h2>
    {cases.map((item) => (
      <article key={item.id} className="rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-foreground">{item.id} · Order {item.order_id}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {item.reason.replace("_", " ")} · {item.status} · {item.request_source === "customer" ? "Customer request" : "Admin logged"}
            </p>
            {item.notes && <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>}
            {item.reverse_status && (
              <p className="mt-1 text-xs text-muted-foreground">
                Shiprocket reverse pickup: {item.reverse_status}
                {item.reverse_awb ? ` · AWB ${item.reverse_awb}` : ""}
                {item.reverse_courier ? ` · ${item.reverse_courier}` : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(item.status === "requested" || (item.status === "approved" && needsReversePickupRetry(item))) && (
                <input
                  aria-label="Reverse pickup date"
                  type="date"
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)}
                  value={pickupDates[item.id] ?? item.reverse_pickup_date ?? new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)}
                  onChange={(event) => setPickupDates((current) => ({ ...current, [item.id]: event.target.value }))}
                  className="rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground"
                />
              )}
            {item.status === "requested" && (
              <>
                <button onClick={() => void review(item, "approve")} className="rounded-lg bg-accent px-3 py-2 text-xs text-white">
                  Approve & book pickup
                </button>
                <button onClick={() => void review(item, "reject")} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground">
                  Reject
                </button>
              </>
            )}
            {item.status === "approved" && needsReversePickupRetry(item) && (
              <button onClick={() => void retryPickup(item)} className="rounded-lg bg-accent px-3 py-2 text-xs text-white">
                Retry Shiprocket pickup
              </button>
            )}
            {item.reverse_shipment_id && (
              <button onClick={() => void trackReturn(item)} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground">
                Track reverse parcel
              </button>
            )}
            {["approved", "partially_received"].includes(item.status) &&
              (!item.reverse_shipment_id || ["return delivered", "received"].includes((item.reverse_status || "").toLowerCase())) && (
                <button onClick={() => void receive(item)} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground">
                  Receive item
                </button>
              )}
          </div>
        </div>
        {trackingByReturn[item.id] && (
          <div className="mt-3 rounded-lg bg-background p-3 text-xs text-muted-foreground">
            {trackingByReturn[item.id].loading ? "Loading Shiprocket tracking…" : trackingByReturn[item.id].error ? (
              <span role="alert" className="text-red-500">{trackingByReturn[item.id].error}</span>
            ) : (
              <>
                <p className="font-medium text-foreground">{trackingByReturn[item.id].data?.status}{trackingByReturn[item.id].data?.awb ? ` · AWB ${trackingByReturn[item.id].data?.awb}` : ""}{trackingByReturn[item.id].data?.courier ? ` · ${trackingByReturn[item.id].data?.courier}` : ""}</p>
                {(trackingByReturn[item.id].data?.scans || []).slice(0, 5).map((scan, index) => (
                  <p key={index} className="mt-1">{scan.date ? `${scan.date} · ` : ""}{scan.activity || "Courier update"}{scan.location ? ` · ${scan.location}` : ""}</p>
                ))}
              </>
            )}
          </div>
        )}
        {item.items.map((line) => (
          <p key={line.id} className="mt-3 text-sm text-muted-foreground">
            {line.product_name} / {line.size} · {line.quantity_received} of {line.quantity_requested} received · {line.quantity_restocked} returned to stock · ₹{line.unit_price} each
          </p>
        ))}
        {item.payments.some((payment) => payment.refunds.length > 0) && (
          <div className="mt-4 space-y-1 border-t border-border pt-3">
            <p className="text-xs font-semibold text-foreground">Refund history</p>
            {item.payments.flatMap((payment) => payment.refunds.map((refund) => (
              <p key={refund.id} className="text-xs text-muted-foreground">
                ₹{refund.amount} · {refund.status} · {refund.created_at ? new Date(refund.created_at).toLocaleString() : ""}
              </p>
            )))}
          </div>
        )}
        {item.status === "received" && item.payments.some((payment) => Number(payment.refundable_amount) > 0 && ["success", "partially_refunded"].includes(payment.status)) && (
          <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-[1fr_180px_auto]">
            <select aria-label="Captured payment to refund" className={field} value={refundPaymentIds[item.id] || ""} onChange={(event) => setRefundPaymentIds((current) => ({ ...current, [item.id]: event.target.value }))}>
              <option value="">Choose captured payment</option>
              {item.payments.filter((payment) => Number(payment.refundable_amount) > 0 && ["success", "partially_refunded"].includes(payment.status)).map((payment) => (
                <option key={payment.id} value={payment.id}>{payment.id} · refundable ₹{payment.refundable_amount}</option>
              ))}
            </select>
            <input aria-label="Refund amount" className={field} type="number" min="0.01" step="0.01" value={refundAmounts[item.id] || ""} onChange={(event) => setRefundAmounts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Amount ₹" />
            <button onClick={() => void issueRefund(item)} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground">Issue refund</button>
            <p className="text-xs text-muted-foreground md:col-span-3">Refunds are capped at the remaining captured payment, linked to this received return, and stay pending until the gateway confirms completion.</p>
          </div>
        )}
      </article>
    ))}
    {cases.length === 0 && <p className="text-sm text-muted-foreground">No return cases recorded.</p>}
  </section>
  </div></main>;
}
