"use client";

import type { SizeChart } from "@/lib/sizeChart";

interface SizeChartEditorProps {
  value: SizeChart;
  onChange: (value: SizeChart) => void;
}

export function SizeChartEditor({ value, onChange }: SizeChartEditorProps) {
  const existingMeasurementKeys = value.rows[0]
    ? Object.keys(value.rows[0]).filter((key) => key !== "size")
    : [];
  const measurementKeys = value.headers.slice(1).map((header, index) =>
    existingMeasurementKeys[index] || ["chest", "waist", "hips", "length"][index] || header.toLowerCase().replace(/[^a-z0-9]+/g, "_")
  );

  const updateHeader = (index: number, header: string) => {
    const headers = [...value.headers];
    headers[index] = header;
    onChange({ ...value, headers });
  };

  const updateCell = (rowIndex: number, key: string, cell: string) => {
    const rows = value.rows.map((row, index) =>
      index === rowIndex ? { ...row, [key]: cell } : row
    );
    onChange({ ...value, rows });
  };

  return (
    <section className="space-y-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Product sizes and size chart <span className="text-red-600">*</span></h3>
          <p className="text-xs text-muted-foreground">At least one product size is required. Add each size and its measurements before saving.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Unit
          <select
            value={value.unit}
            onChange={(event) => onChange({ ...value, unit: event.target.value })}
            className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
          >
            <option value="in">Inches</option>
            <option value="cm">Centimeters</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-border">
              {value.headers.map((header, index) => (
                <th key={index} className="p-2 text-left">
                  <input
                    aria-label={index === 0 ? "Size column heading" : "Measurement column heading"}
                    value={header}
                    onChange={(event) => updateHeader(index, event.target.value)}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                  />
                </th>
              ))}
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {value.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/50">
                <td className="p-2">
                  <input
                    aria-label={"Required product size " + (rowIndex + 1)}
                    aria-required="true"
                    value={row.size}
                    onChange={(event) => updateCell(rowIndex, "size", event.target.value)}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                  />
                </td>
                {measurementKeys.map((key) => (
                  <td key={key} className="p-2">
                    <input
                      aria-label={value.headers[measurementKeys.indexOf(key) + 1] + " " + row.size}
                      value={row[key] || ""}
                      onChange={(event) => updateCell(rowIndex, key, event.target.value)}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                    />
                  </td>
                ))}
                <td className="p-2 text-right">
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, rows: value.rows.filter((_, index) => index !== rowIndex) })}
                    className="text-red-500 hover:underline"
                    aria-label={"Remove size " + row.size}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => onChange({
          ...value,
          rows: [...value.rows, { size: "", ...Object.fromEntries(measurementKeys.map((key) => [key, ""])) }],
        })}
        className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-hover"
      >
        Add size
      </button>
    </section>
  );
}
