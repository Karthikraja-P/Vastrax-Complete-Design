"use client";

import { PRODUCT_BACKDROP_PRESETS } from "@/lib/product-backgrounds";

interface ProductBackdropPickerProps {
  value: string;
  onChange: (value: string) => void;
  defaultColor?: string;
  allowStoreDefault?: boolean;
  label?: string;
}

export default function ProductBackdropPicker({
  value,
  onChange,
  defaultColor = "#F5F2ED",
  allowStoreDefault = false,
  label = "Default product backdrop",
}: ProductBackdropPickerProps) {
  const selected = value || defaultColor;
  const isPreset = PRODUCT_BACKDROP_PRESETS.some((preset) => preset.color === selected.toUpperCase());

  return (
    <section className="space-y-3 rounded-xl border border-border bg-background/50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <p className="mt-1 text-xs text-muted-foreground">Replaces the plain background connected to the edges of each newly uploaded product photo with this color.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {allowStoreDefault && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-pressed={!value}
            className={"inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors " + (!value ? "border-accent text-accent" : "border-border text-foreground hover:border-accent/50")}
          >
            <span aria-hidden="true" className="h-5 w-5 rounded-full border border-black/15" style={{ backgroundColor: defaultColor }} />
            Use store default
          </button>
        )}
        {PRODUCT_BACKDROP_PRESETS.map((preset) => (
          <button
            key={preset.color}
            type="button"
            onClick={() => onChange(preset.color)}
            aria-label={"Use " + preset.name + " product backdrop"}
            aria-pressed={value.toUpperCase() === preset.color}
            title={preset.name}
            className={"h-10 w-10 rounded-full border-2 transition-transform hover:scale-105 " + (value.toUpperCase() === preset.color ? "border-accent ring-2 ring-accent/20" : "border-border")}
            style={{ backgroundColor: preset.color }}
          />
        ))}
        <label className={"relative inline-flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 " + (!isPreset && value ? "border-accent ring-2 ring-accent/20" : "border-border")} style={{ backgroundColor: selected }} title="Choose custom color">
          <span className="text-lg leading-none text-foreground" aria-hidden="true">+</span>
          <input
            type="color"
            value={selected}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            aria-label="Choose custom product backdrop color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span aria-hidden="true" className="absolute inset-0 -z-10" style={{ backgroundColor: selected }} />
        </label>
        <span className="ml-1 font-mono text-xs text-muted-foreground">{selected.toUpperCase()}</span>
      </div>
    </section>
  );
}
