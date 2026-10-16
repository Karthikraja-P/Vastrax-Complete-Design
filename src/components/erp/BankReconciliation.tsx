"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

type Account = { id: string; code: string; name: string; account_type: string; is_active: boolean };
type StatementRow = { id: string; account_id: string; account_code: string; account_name: string; statement_date: string; description: string; reference: string | null; amount: string; matched_journal_entry_id: string | null; matched_journal_description: string | null };
type ImportLine = { statement_date: string; description: string; reference: string | null; amount: string; source_fingerprint: string };
type Candidate = { journal_entry_id: string; posting_date: string; description: string; reference: string | null; amount: string; reference_match: boolean };
type MatchEvent = { action: string; journal_entry_id: string | null; journal_description: string | null; actor: string; created_at: string };

const card = "rounded-2xl border border-border bg-surface p-5";
const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted && ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ",") { row.push(cell.trim()); cell = ""; }
    else if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(value => value !== "")) rows.push(row);
  if (quoted) throw new Error("The CSV contains an unfinished quoted value.");
  return rows;
}

function toISODate(value: string): string {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const parts = v.split(/[/.\-]/);
  if (parts.length === 3 && parts[2].length === 4) return parts[2] + "-" + parts[1].padStart(2, "0") + "-" + parts[0].padStart(2, "0");
  throw new Error("Dates must use YYYY-MM-DD or DD/MM/YYYY format.");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function BankReconciliation() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines] = useState<StatementRow[]>([]);
  const [accountId, setAccountId] = useState("");
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);
  const [pending, setPending] = useState<ImportLine[]>([]);
  const [activeLine, setActiveLine] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [history, setHistory] = useState<MatchEvent[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [accountRows, statementRows] = await Promise.all([
        fetchApi<Account[]>("/erp/accounts"),
        fetchApi<StatementRow[]>("/erp/bank-reconciliation?" + [accountId ? "account_id=" + encodeURIComponent(accountId) : "", unmatchedOnly ? "unmatched_only=true" : ""].filter(Boolean).join("&")),
      ]);
      const bankRows = accountRows.filter(account => account.is_active && account.account_type === "asset");
      setAccounts(bankRows);
      setLines(statementRows);
      if (!accountId && bankRows.length) setAccountId(bankRows[0].id);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load bank reconciliation records."); }
  }, [accountId, unmatchedOnly]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const readCSV = async (file: File) => {
    setError(""); setMessage(""); setPending([]);
    try {
      if (!accountId) throw new Error("Select the cash or bank ledger account before previewing a statement.");
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error("The CSV must include a header and at least one transaction.");
      const headers = rows[0].map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const dateIndex = headers.findIndex(value => ["date", "transactiondate", "valuedate"].includes(value));
      const descriptionIndex = headers.findIndex(value => ["description", "narration", "particulars", "details"].includes(value));
      const referenceIndex = headers.findIndex(value => ["reference", "ref", "utr", "transactionid", "chequeno"].includes(value));
      const amountIndex = headers.findIndex(value => ["amount", "netamount", "signedamount"].includes(value));
      if (dateIndex < 0 || descriptionIndex < 0 || amountIndex < 0) {
        throw new Error("Required CSV columns: Date, Description, Amount. Reference is optional. Use signed amounts: deposits positive, withdrawals negative.");
      }
      const fileHash = await sha256(accountId + "::" + text);
      const parsed = await Promise.all(rows.slice(1).map(async (row, index) => {
        const rawAmount = (row[amountIndex] || "").trim();
        const negative = /^\(.*\)$/.test(rawAmount) || rawAmount.endsWith("-");
        const normalizedAmount = rawAmount.replace(/[(),₹\s]/g, "").replace(/-$/, "");
        const amount = Number(normalizedAmount) * (negative ? -1 : 1);
        if (!Number.isFinite(amount) || amount === 0) throw new Error("CSV row " + (index + 2) + " has an invalid amount.");
        const description = row[descriptionIndex] || "";
        if (!description.trim()) throw new Error("CSV row " + (index + 2) + " has no description.");
        return {
          statement_date: toISODate(row[dateIndex] || ""),
          description: description.slice(0, 255),
          reference: referenceIndex >= 0 ? (row[referenceIndex] || "").slice(0, 100) || null : null,
          amount: amount.toFixed(2),
          source_fingerprint: await sha256(fileHash + "::" + index),
        };
      }));
      setPending(parsed);
      setMessage("Preview ready: " + parsed.length + " statement rows. Review the account and import when ready.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read this statement CSV."); }
  };

  const importRows = async () => {
    if (!accountId || !pending.length) return;
    try {
      const result = await fetchApi<{ imported: number; skipped_duplicates: number }>("/erp/bank-reconciliation/import", {
        method: "POST", body: JSON.stringify({ account_id: accountId, lines: pending }),
      });
      setMessage("Imported " + result.imported + " rows; skipped " + result.skipped_duplicates + " duplicates.");
      setPending([]);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not import statement rows."); }
  };

  const findCandidates = async (lineId: string) => {
    try {
      const [matches, events] = await Promise.all([
        fetchApi<Candidate[]>("/erp/bank-reconciliation/" + lineId + "/candidates"),
        fetchApi<MatchEvent[]>("/erp/bank-reconciliation/" + lineId + "/history"),
      ]);
      setActiveLine(lineId); setCandidates(matches); setHistory(events); setSelectedCandidate("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not find ledger matches."); }
  };

  const matchLine = async (lineId: string) => {
    if (!selectedCandidate) return;
    try {
      await fetchApi("/erp/bank-reconciliation/" + lineId + "/match", {
        method: "POST", body: JSON.stringify({ journal_entry_id: selectedCandidate }),
      });
      setMessage("Statement row matched to the ledger entry.");
      await load();
      await findCandidates(lineId);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not match this row."); }
  };

  const unmatchLine = async (lineId: string) => {
    try {
      await fetchApi("/erp/bank-reconciliation/" + lineId + "/unmatch", { method: "POST" });
      setMessage("Match removed and recorded in the audit history.");
      await load();
      await findCandidates(lineId);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove the match."); }
  };

  const matchedCount = lines.filter(line => line.matched_journal_entry_id).length;

  return <section className={card + " space-y-4"}>
    <div><h2 className="text-lg font-semibold text-foreground">Bank reconciliation</h2><p className="mt-1 text-sm text-muted-foreground">Import signed bank statement rows, compare them with posted ledger entries, and track matched or unmatched items.</p></div>
    {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
    {message && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600">{message}</p>}
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <label className="space-y-1 text-sm text-muted-foreground">Cash or bank ledger account<select className={field} value={accountId} onChange={e => { setAccountId(e.target.value); setPending([]); }}><option value="">Choose account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
      <label className="space-y-1 text-sm text-muted-foreground">Statement CSV<input type="file" accept=".csv,text/csv" disabled={!accountId} className={field} onChange={e => { const file = e.target.files?.[0]; if (file) void readCSV(file); e.currentTarget.value = ""; }} /></label>
      <button type="button" disabled={!pending.length} onClick={() => void importRows()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Import preview ({pending.length})</button>
    </div>
    <p className="text-xs text-muted-foreground">CSV columns: Date, Description, Amount; Reference is optional. Deposits must be positive and withdrawals negative. Select a cash/bank account (not inventory or another asset). Import stores statement rows only and never posts or changes a journal.</p>
    {pending.length > 0 && <div className="rounded-xl border border-border p-3"><p className="mb-2 text-sm font-semibold text-foreground">Import preview · {pending.length} rows</p><p className="text-xs text-muted-foreground">{pending.slice(0, 5).map(row => row.statement_date + " · " + row.description + " · ₹" + row.amount).join("  |  ")}</p></div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-foreground">{matchedCount} of {lines.length} rows matched</p><label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={unmatchedOnly} onChange={e => setUnmatchedOnly(e.target.checked)} />Show unmatched only</label></div>
    <div className="space-y-3">{lines.map(line => <article key={line.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-foreground">{line.statement_date} · {line.description}</p><p className="text-xs text-muted-foreground">{line.account_code} · {line.account_name}{line.reference ? " · " + line.reference : ""}</p>{line.matched_journal_entry_id && <p className="mt-1 text-xs text-emerald-600">Matched: {line.matched_journal_entry_id} · {line.matched_journal_description}</p>}</div><div className="flex items-center gap-3"><p className={"font-semibold " + (Number(line.amount) < 0 ? "text-red-400" : "text-foreground")}>{Number(line.amount) < 0 ? "−" : "+"}₹{Math.abs(Number(line.amount)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>{line.matched_journal_entry_id ? <button onClick={() => void unmatchLine(line.id)} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground">Undo match</button> : <button onClick={() => void findCandidates(line.id)} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground">Find matches</button>}</div></div>
      {activeLine === line.id && <div className="mt-4 space-y-3 border-t border-border pt-3"><div className="flex justify-between"><p className="text-sm font-semibold text-foreground">Matching ledger entries</p><button onClick={() => setActiveLine(null)} className="text-xs text-muted-foreground">Close</button></div><select aria-label="Choose matching journal entry" className={field} value={selectedCandidate} onChange={e => setSelectedCandidate(e.target.value)}><option value="">Select an exact amount match</option>{candidates.map(candidate => <option key={candidate.journal_entry_id} value={candidate.journal_entry_id}>{candidate.posting_date} · {candidate.description} · {candidate.reference || "no ref"} · {candidate.reference_match ? "reference matches · " : ""}₹{candidate.amount}</option>)}</select><button disabled={!selectedCandidate} onClick={() => void matchLine(line.id)} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirm match</button>{candidates.length === 0 && <p className="text-sm text-muted-foreground">No exact account and amount match within seven days.</p>}{history.length > 0 && <div className="space-y-1 border-t border-border pt-3"><p className="text-xs font-semibold text-muted-foreground">Match audit</p>{history.map((event, index) => <p key={index} className="text-xs text-muted-foreground">{event.action} · {event.journal_entry_id || "—"} · {event.actor} · {new Date(event.created_at).toLocaleString()}</p>)}</div>}</div>}
    </article>)}</div>
    {lines.length === 0 && <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No statement rows imported for this account.</p>}
  </section>;
}
