"use client";

import type { SizeChart } from "@/lib/sizeChart";

interface SizeChartEditorProps {
  value: SizeChart;
  onChange: (value: SizeChart) => void;
}

export function SizeChartEditor({ value, onChange }: SizeChartEditorProps) {
  return (
    <section className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Product sizes <span className="text-red-600">*</span></h3>
        <p className="text-xs text-muted-foreground">Add each size available for this product. Measurements are shown in the attached size guide.</p>
      </div>
      <div className="space-y-2">
        {value.rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-3">
            <label className="sr-only" htmlFor={"product-size-" + rowIndex}>Product size {rowIndex + 1}</label>
            <input
              id={"product-size-" + rowIndex}
              aria-required="true"
              required
              value={row.size}
              onChange={(event) => {
                const rows = value.rows.map((item, index) => index === rowIndex ? { size: event.target.value } : { size: item.size });
                onChange({ unit: value.unit || "in", headers: ["Size"], rows });
              }}
              placeholder="e.g. S, M, L"
              className="w-full max-w-xs rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <button
              type="button"
              onClick={() => onChange({ unit: value.unit || "in", headers: ["Size"], rows: value.rows.filter((_, index) => index !== rowIndex).map((item) => ({ size: item.size })) })}
              className="text-sm text-red-500 hover:underline"
              aria-label={"Remove size " + row.size}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange({ unit: value.unit || "in", headers: ["Size"], rows: [...value.rows.map((row) => ({ size: row.size })), { size: "" }] })}
        className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-hover"
      >
        Add size
      </button>
    </section>
  );
}
