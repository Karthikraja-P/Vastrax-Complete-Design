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
const measurementKeys = Object.keys(WOMENS_SIZE_CHART.rows[0] || {}).filter((key) => key !== "size");

export function SizeChartEditor({ value, onChange, stockBySize, onStockChange }: SizeChartEditorProps) {
  const [customSize, setCustomSize] = useState("");

  const toggleSize = (size: string) => {
    const selected = value.rows.some((row) => row.size.toLowerCase() === size.toLowerCase());
    const customRows = value.rows.filter((row) =>
      !availableSizeOptions.some((option) => option.toLowerCase() === row.size.toLowerCase()) &&
      (!selected || row.size.toLowerCase() !== size.toLowerCase())
    );
    const selectedSizes = new Set(value.rows.map((row) => row.size.toLowerCase()));
    if (selected) selectedSizes.delete(size.toLowerCase());
    else selectedSizes.add(size.toLowerCase());

    const standardRows = availableSizeOptions
      .filter((option) => selectedSizes.has(option.toLowerCase()))
      .map((option) => WOMENS_SIZE_CHART.rows.find((row) => row.size === option)!)
      .map((row) => ({ ...row }));
    const nextRows = [...standardRows, ...customRows];

    onChange({
      unit: WOMENS_SIZE_CHART.unit,
      headers: [...WOMENS_SIZE_CHART.headers],
      rows: nextRows,
    });
    if (onStockChange) {
      onStockChange((current) => {
        const next = { ...current };
        if (selected) delete next[size];
        else next[size] = "0";
        return next;
      });
    }
  };

  const addCustomSize = () => {
    const size = customSize.trim();
    if (!size || value.rows.some((row) => row.size.toLowerCase() === size.toLowerCase())) return;
    onChange({
      unit: WOMENS_SIZE_CHART.unit,
      headers: [...WOMENS_SIZE_CHART.headers],
      rows: [...value.rows, { size, ...Object.fromEntries(measurementKeys.map((key) => [key, ""])) }],
    });
    if (onStockChange) onStockChange((current) => ({ ...current, [size]: "0" }));
    setCustomSize("");
  };

  const customSizes = value.rows
    .map((row) => row.size)
    .filter((size) => !availableSizeOptions.some((option) => option.toLowerCase() === size.toLowerCase()));
  const sizesToDisplay = [...availableSizeOptions, ...customSizes];

  return (
    <section className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Available sizes <span className="text-red-600">*</span></h3>
        <p className="mt-1 text-xs text-muted-foreground">Select the sizes customers can buy and enter the quantity beside each selected size. Enter 0 when unavailable.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-label="Available sizes and stock quantities">
        {sizesToDisplay.map((size) => {
          const selected = value.rows.some((row) => row.size.toLowerCase() === size.toLowerCase());
          return (
            <div key={size} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => toggleSize(size)}
                className={"min-w-16 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors " + (selected
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-surface text-foreground hover:border-accent/60")}
              >
                {size}
              </button>
              {selected && stockBySize && onStockChange ? (
                <label className="min-w-0 flex-1 text-xs font-medium text-foreground">
                  Stock quantity
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    aria-required="true"
                    aria-label={`Stock quantity for size ${size}`}
                    value={stockBySize[size] ?? "0"}
                    onChange={(event) => onStockChange((current) => ({ ...current, [size]: event.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
              ) : (
                <span className="text-xs text-muted-foreground">Select size to set stock</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
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
        {value.rows.length ? `Selected: ${value.rows.map((row) => row.size).join(", ")}` : "Select at least one size and enter its stock quantity."}
      </p>
    </section>
  );
}
