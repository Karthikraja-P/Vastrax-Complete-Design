"use client";

import { useState } from "react";
import type { SizeChart } from "@/lib/sizeChart";
import { WOMENS_SIZE_CHART } from "@/lib/sizeChart";

interface SizeChartEditorProps {
  value: SizeChart;
  onChange: (value: SizeChart) => void;
  stockBySize?: Record<string, string>;
  onStockChange?: (update: (current: Record<string, string>) => Record<string, string>) => void;
}

const availableSizeOptions = WOMENS_SIZE_CHART.rows.map((row) => row.size);

export function SizeChartEditor({ value, onChange, stockBySize, onStockChange }: SizeChartEditorProps) {
  const [customSize, setCustomSize] = useState("");
  const measurementKeys = Object.keys(WOMENS_SIZE_CHART.rows[0] || {}).filter((key) => key !== "size");

  const toggleSize = (size: string) => {
    const selectedSizes = new Set(value.rows.map((row) => row.size.toLowerCase()));
    if (selectedSizes.has(size.toLowerCase())) selectedSizes.delete(size.toLowerCase());
    else selectedSizes.add(size.toLowerCase());

    const customRows = value.rows
      .filter((row) => !availableSizeOptions.some((option) => option.toLowerCase() === row.size.toLowerCase()))
      .map((row) => ({
        size: row.size,
        ...Object.fromEntries(measurementKeys.map((key) => [key, row[key] || ""])),
      }));
    const standardRows = availableSizeOptions
      .filter((option) => selectedSizes.has(option.toLowerCase()))
      .map((option) => WOMENS_SIZE_CHART.rows.find((row) => row.size === option)!)
      .map((row) => ({ ...row }));

    onChange({
      unit: WOMENS_SIZE_CHART.unit,
      headers: [...WOMENS_SIZE_CHART.headers],
      rows: [...standardRows, ...customRows],
    });
  };

  const addCustomSize = () => {
    const size = customSize.trim();
    if (!size || value.rows.some((row) => row.size.toLowerCase() === size.toLowerCase())) return;
    toggleSize(size);
    setCustomSize("");
  };

  return (
    <section className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Available sizes <span className="text-red-600">*</span></h3>
        <p className="mt-1 text-xs text-muted-foreground">Choose the sizes customers can buy. The women’s size guide measurements are filled in automatically.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Available product sizes">
        {availableSizeOptions.map((size) => {
          const selected = value.rows.some((row) => row.size.toLowerCase() === size.toLowerCase());
          return (
            <button
              key={size}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleSize(size)}
              className={"min-w-14 rounded-lg border px-4 py-2 text-sm font-medium transition-colors " + (selected
                ? "border-accent bg-accent text-white"
                : "border-border bg-background text-foreground hover:border-accent/60")}
            >
              {size}
            </button>
          );
        })}
      </div>

      {stockBySize && onStockChange && value.rows.length > 0 && (
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground">Stock count by size <span className="text-red-600">*</span></h4>
          <p className="mt-1 mb-3 text-xs text-muted-foreground">Set the quantity for each selected size. Enter 0 when it is out of stock.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {value.rows.map((row) => (
              <label key={row.size} className="text-xs font-medium text-foreground">
                Size {row.size}
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  aria-required="true"
                  value={stockBySize[row.size] ?? "0"}
                  onChange={(event) => onStockChange((current) => ({ ...current, [row.size]: event.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-foreground">
          Add another size
          <input
            value={customSize}
            onChange={(event) => setCustomSize(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomSize();
              }
            }}
            placeholder="e.g. Petite S"
            className="mt-1.5 block w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={addCustomSize}
          disabled={!customSize.trim() || value.rows.some((row) => row.size.toLowerCase() === customSize.trim().toLowerCase())}
          className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add size
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {value.rows.length ? value.rows.map((row) => row.size).join(", ") : "Select at least one available size."}
      </p>
    </section>
  );
}
