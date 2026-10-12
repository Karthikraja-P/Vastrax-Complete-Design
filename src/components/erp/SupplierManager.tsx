"use client";

import { useState } from "react";
import { fetchApi } from "@/lib/api";

type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  is_active: boolean;
};

type SupplierForm = Omit<Supplier, "id" | "is_active">;
const emptyForm: SupplierForm = { name: "", contact_name: "", email: "", phone: "", gstin: "", address: "" };
const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

export default function SupplierManager({
  suppliers,
  onSaved,
  onError,
}: {
  suppliers: Supplier[];
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof SupplierForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const reset = () => { setEditingId(null); setForm(emptyForm); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact_name: form.contact_name?.trim() || null,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        gstin: form.gstin?.trim().toUpperCase() || null,
        address: form.address?.trim() || null,
      };
      await fetchApi(editingId ? `/erp/suppliers/${editingId}` : "/erp/suppliers", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      reset();
      await onSaved();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save supplier.");
    } finally {
      setSaving(false);
    }
  };

  const edit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({ name: supplier.name, contact_name: supplier.contact_name || "", email: supplier.email || "", phone: supplier.phone || "", gstin: supplier.gstin || "", address: supplier.address || "" });
  };

  const toggleActive = async (supplier: Supplier) => {
    const action = supplier.is_active ? "deactivate" : "reactivate";
    if (supplier.is_active && !window.confirm(`Deactivate ${supplier.name}? Existing purchase orders and expense records will remain linked.`)) return;
    try {
      await fetchApi(`/erp/suppliers/${supplier.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !supplier.is_active }) });
      await onSaved();
    } catch (error) {
      onError(error instanceof Error ? error.message : `Could not ${action} supplier.`);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 space-y-4">
      <form onSubmit={save} className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground">{editingId ? "Edit supplier" : "Supplier directory"}</h2>
          {editingId && <button type="button" onClick={reset} className="text-xs text-muted-foreground underline">Cancel edit</button>}
        </div>
        <input required maxLength={255} className={field} placeholder="Supplier name" value={form.name} onChange={e => set("name", e.target.value)} />
        <input maxLength={255} className={field} placeholder="Contact person" value={form.contact_name || ""} onChange={e => set("contact_name", e.target.value)} />
        <input type="email" maxLength={255} className={field} placeholder="Email" value={form.email || ""} onChange={e => set("email", e.target.value)} />
        <input maxLength={40} className={field} placeholder="Phone" value={form.phone || ""} onChange={e => set("phone", e.target.value)} />
        <input maxLength={20} className={field} placeholder="GSTIN (optional)" value={form.gstin || ""} onChange={e => set("gstin", e.target.value)} />
        <textarea className={field} rows={2} placeholder="Address" value={form.address || ""} onChange={e => set("address", e.target.value)} />
        <button disabled={saving} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : editingId ? "Save supplier changes" : "Add supplier"}</button>
      </form>
      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">Suppliers ({suppliers.length})</h3>
        {suppliers.map(supplier => (
          <article key={supplier.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{supplier.name}</p>
                <p className="text-xs text-muted-foreground">{supplier.contact_name || "No contact"}{supplier.email ? ` · ${supplier.email}` : ""}{supplier.phone ? ` · ${supplier.phone}` : ""}</p>
                {supplier.gstin && <p className="mt-1 text-xs text-muted-foreground">GSTIN {supplier.gstin}</p>}
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] ${supplier.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{supplier.is_active ? "Active" : "Inactive"}</span>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => edit(supplier)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground">Edit</button>
                <button type="button" onClick={() => void toggleActive(supplier)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground">{supplier.is_active ? "Deactivate" : "Reactivate"}</button>
              </div>
            </div>
          </article>
        ))}
        {suppliers.length === 0 && <p className="text-xs text-muted-foreground">No suppliers yet.</p>}
      </div>
    </section>
  );
}
