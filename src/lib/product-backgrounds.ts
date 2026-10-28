export const DEFAULT_PRODUCT_BACKDROP = "#F5F2ED";

export const PRODUCT_BACKDROP_PRESETS = [
  { name: "Ivory", color: "#F5F2ED" },
  { name: "Warm sand", color: "#EFE5D7" },
  { name: "Soft blush", color: "#F3E4E8" },
  { name: "Sage", color: "#E7ECE5" },
  { name: "Cloud", color: "#F2F4F5" },
  { name: "White", color: "#FFFFFF" },
] as const;

export function normalizeProductBackdrop(value: unknown, fallback = DEFAULT_PRODUCT_BACKDROP): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback;
}
