"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Mail, RefreshCw, Search, Send, Package } from "lucide-react";
import { fetchApi } from "@/lib/api";

type StockNotification = {
  id: string;
  product_id: string;
  product_name: string;
  size: string | null;
  email: string;
  current_stock: number;
  is_notified: boolean;
  created_at: string;
  notified_at: string | null;
};

type Folder = "waiting" | "notified";

export default function RestockWaitlistPage() {
  const [rows, setRows] = useState<StockNotification[]>([]);
  const [folder, setFolder] = useState<Folder>("waiting");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchApi<StockNotification[]>("/products/stock-notifications");
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the restock list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const waitingCount = rows.filter((row) => !row.is_notified).length;
  const notifiedCount = rows.filter((row) => row.is_notified).length;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const inFolder = folder === "notified" ? row.is_notified : !row.is_notified;
      const matches = !query || row.email.toLowerCase().includes(query) ||
        row.product_name.toLowerCase().includes(query) || (row.size || "").toLowerCase().includes(query);
      return inFolder && matches;
    });
  }, [folder, rows, search]);

  const sendEmail = async (row: StockNotification) => {
    if (!window.confirm(`Send the Vastrax restock email to ${row.email}?`)) return;
    setSendingId(row.id);
    setError("");
    setNotice("");
    try {
      await fetchApi(`/products/stock-notifications/${encodeURIComponent(row.id)}/send`, { method: "POST" });
      setNotice(`Restock email sent to ${row.email}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The restock email could not be sent.");
    } finally {
      setSendingId(null);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  };

  return (
    <main className="min-h-screen bg-background p-5 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-accent" />
            <h1 className="text-3xl font-bold text-foreground">Restock Waitlist</h1>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </header>

        {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
        {notice && <div role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-500">{notice}</div>}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <button onClick={() => setFolder("waiting")} className={`rounded-full px-4 py-2 text-sm font-medium ${folder === "waiting" ? "bg-accent text-white" : "border border-border text-foreground"}`}>
              To notify <span className="ml-1 opacity-75">{waitingCount}</span>
            </button>
            <button onClick={() => setFolder("notified")} className={`rounded-full px-4 py-2 text-sm font-medium ${folder === "notified" ? "bg-accent text-white" : "border border-border text-foreground"}`}>
              Notified <span className="ml-1 opacity-75">{notifiedCount}</span>
            </button>
          </div>
          <label className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 sm:max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input aria-label="Search restock requests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email, product, or size" className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          </label>
        </div>

        <section className="space-y-3">
          {loading && <p className="rounded-xl border border-border p-5 text-sm text-muted-foreground">Loading restock requests...</p>}
          {!loading && visibleRows.length === 0 && <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">{folder === "waiting" ? "No customers are waiting for a restock email." : "No customers have been notified yet."}</p>}
          {!loading && visibleRows.map((row) => (
            <article key={row.id} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{row.product_name}{row.size ? ` - ${row.size}` : ""}</p>
                <p className="mt-1 break-all text-sm text-muted-foreground">{row.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">Requested {formatDate(row.created_at)}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>{row.current_stock > 0 ? `${row.current_stock} in stock` : "Out of stock"}</span>
                {row.is_notified && <span className="text-xs text-muted-foreground">Sent {formatDate(row.notified_at)}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {!row.is_notified && (
                  <>
                    <Link href={`/products/edit?id=${encodeURIComponent(row.product_id)}`} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-hover">Update stock</Link>
                    <button onClick={() => void sendEmail(row)} disabled={row.current_stock <= 0 || sendingId === row.id} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                      {sendingId === row.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send email
                    </button>
                  </>
                )}
                {row.is_notified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500"><Mail className="h-3.5 w-3.5" /> Notified</span>}
              </div>
              {!row.is_notified && (
                <details className="sm:col-span-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Preview email</summary>
                  <div className="mt-2 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                    <p><strong>Subject:</strong> {row.product_name} is back in stock</p>
                    <p className="mt-1">You asked us to let you know when {row.product_name}{row.size ? ` in size ${row.size}` : ""} was back in stock. Stock is now available. Visit the product page to take another look.</p>
                  </div>
                </details>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
