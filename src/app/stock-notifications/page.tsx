"use client";

import { useEffect, useState } from "react";
import { Bell, Boxes, ChevronLeft, ChevronRight, RefreshCw, Search, Send } from "lucide-react";
import Link from "next/link";
import { fetchApi } from "@/lib/api";

type Bucket = "all" | "waiting" | "notified";
type Row = {
  id: string;
  product_id: string;
  product_name: string;
  email: string;
  size?: string | null;
  is_notified: boolean;
  is_in_stock: boolean;
  created_at: string;
  notified_at?: string | null;
};
type WaitlistPage = {
  items: Row[];
  counts: Record<Bucket, number>;
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

const PAGE_SIZE = 25;
const formatTimestamp = (value: string) => new Intl.DateTimeFormat(undefined, {
  day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit",
}).format(new Date(value));
const BUCKETS: { id: Bucket; label: string }[] = [
  { id: "all", label: "All requests" },
  { id: "waiting", label: "Waiting" },
  { id: "notified", label: "Notified" },
];

export default function StockNotificationsPage() {
  const [data, setData] = useState<WaitlistPage>({
    items: [], counts: { all: 0, waiting: 0, notified: 0 }, total: 0,
    page: 1, limit: PAGE_SIZE, total_pages: 1,
  });
  const [bucket, setBucket] = useState<Bucket>("waiting");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ bucket, page: String(page), limit: String(PAGE_SIZE) });
        if (search) params.set("search", search);
        const result = await fetchApi<WaitlistPage>(`/products/stock-notifications?${params.toString()}`);
        if (!cancelled) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load waitlist requests.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bucket, page, search, refreshKey]);

  const sendEmail = async (row: Row) => {
    setBusyId(row.id);
    setError("");
    setNotice("");
    try {
      const result = await fetchApi<{ email: string; is_notified: boolean; notified_at: string }>(
        `/products/stock-notifications/${row.id}/send`,
        { method: "POST" },
      );
      setNotice(`Restock email sent to ${result.email}.`);
      setRefreshKey((current) => current + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the restock email.");
    } finally {
      setBusyId(null);
    }
  };

  const firstItem = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, data.total);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Restock waitlist</h1>
        <button onClick={() => setRefreshKey((current) => current + 1)} disabled={loading} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />Refresh
        </button>
      </header>

      {error && <p role="alert" className="rounded-lg bg-red-500/10 p-4 text-red-600">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-500/10 p-4 text-emerald-700">{notice}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Waitlist folders" className="flex flex-wrap gap-2">
          {BUCKETS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setBucket(item.id); setPage(1); }}
              aria-pressed={bucket === item.id}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${bucket === item.id ? "bg-accent text-white" : "border border-border text-foreground hover:bg-surface-hover"}`}
            >
              {item.label} <span className="ml-1 opacity-80">{data.counts[item.id]}</span>
            </button>
          ))}
        </nav>
        <label className="relative block">
          <span className="sr-only">Search by customer email or product</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search email or product"
            className="w-72 rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </label>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="hidden md:block">
          <table className="w-full table-fixed text-left text-xs lg:text-sm">
            <colgroup>
              <col className="w-[15%]" /><col className="w-[6%]" /><col className="w-[8%]" />
              <col className="w-[17%]" /><col className="w-[13%]" /><col className="w-[13%]" />
              <col className="w-[10%]" /><col className="w-[18%]" />
            </colgroup>
            <thead className="border-b border-border text-muted-foreground">
              <tr>{["Product", "Size", "Stock", "Customer email", "Requested", "Notified", "Status", "Actions"].map((label) => <th key={label} className="px-2 py-3 text-left font-medium lg:px-3">{label}</th>)}</tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="truncate px-2 py-3 font-medium lg:px-3" title={row.product_name}>{row.product_name}</td>
                  <td className="truncate px-2 py-3" title={row.size || "Any size"}>{row.size || "Any"}</td>
                  <td className={`truncate px-2 py-3 ${row.is_in_stock ? "text-emerald-700" : "text-muted-foreground"}`}>{row.is_in_stock ? "Available" : "Out"}</td>
                  <td className="truncate px-2 py-3" title={row.email}>{row.email}</td>
                  <td className="px-2 py-3 text-muted-foreground" title={new Date(row.created_at).toLocaleString()}>{formatTimestamp(row.created_at)}</td>
                  <td className="px-2 py-3 text-muted-foreground" title={row.notified_at ? new Date(row.notified_at).toLocaleString() : "Not sent"}>{row.notified_at ? formatTimestamp(row.notified_at) : "—"}</td>
                  <td className="px-2 py-3">
                    <span className={`inline-block rounded-full px-2 py-1 text-[11px] ${row.is_notified ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                      {row.is_notified ? "Sent" : "Waiting"}
                    </span>
                  </td>
                  <td className="px-2 py-3 lg:px-3">
                    <div className="flex flex-col gap-1.5">
                      <Link href={`/products/edit?id=${encodeURIComponent(row.product_id)}&tab=pricing`} className="inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium hover:bg-surface-hover" title={`Update ${row.size || "product"} stock`}>
                        <Boxes size={13} />Update stock
                      </Link>
                      <button onClick={() => void sendEmail(row)} disabled={!row.is_in_stock || busyId !== null} className="inline-flex items-center justify-center gap-1 rounded-lg bg-accent px-2 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" title={row.is_in_stock ? `Send restock email to ${row.email}` : "Add stock for this size before sending"}>
                        {busyId === row.id ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                        {row.is_notified ? "Send again" : "Send email"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-border md:hidden">
          {data.items.map((row) => (
            <article key={row.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-foreground">{row.product_name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Size: {row.size || "Any size"}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${row.is_notified ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                  {row.is_notified ? "Email sent" : "Waiting"}
                </span>
              </div>
              <p className="break-all text-sm text-muted-foreground">{row.email}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p>Stock: <span className={row.is_in_stock ? "text-emerald-700" : "text-muted-foreground"}>{row.is_in_stock ? "Available" : "Out"}</span></p>
                <p>Requested: {formatTimestamp(row.created_at)}</p>
                <p className="col-span-2">Notified: {row.notified_at ? formatTimestamp(row.notified_at) : "—"}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link href={`/products/edit?id=${encodeURIComponent(row.product_id)}&tab=pricing`} className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-surface-hover">
                  <Boxes size={14} />Update stock
                </Link>
                <button onClick={() => void sendEmail(row)} disabled={!row.is_in_stock || busyId !== null} className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" title={row.is_in_stock ? `Send restock email to ${row.email}` : "Add stock for this size before sending"}>
                  {busyId === row.id ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  {row.is_notified ? "Send again" : "Send email"}
                </button>
              </div>
            </article>
          ))}
        </div>

        {!loading && data.items.length === 0 && <div className="p-10 text-center text-muted-foreground"><Bell className="mx-auto mb-3" />No requests in this folder.</div>}
        {loading && <p className="p-8 text-center text-muted-foreground">Loading waitlist…</p>}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Showing {firstItem}–{lastItem} of {data.total}</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 disabled:opacity-40"><ChevronLeft size={16} />Previous</button>
          <span>Page {page} of {data.total_pages}</span>
          <button onClick={() => setPage((current) => Math.min(data.total_pages, current + 1))} disabled={page >= data.total_pages || loading} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 disabled:opacity-40">Next<ChevronRight size={16} /></button>
        </div>
      </footer>
      <p className="text-xs text-muted-foreground">Stock changes do not send emails automatically. Once the requested size is available, use Send email to notify that customer.</p>
    </main>
  );
}
