export const WOMENS_SIZE_CHART: SizeChart = {
  unit: "in",
  headers: ["Size", "Bust (in)", "Waist (in)", "Hip (in)"],
  rows: [
    { size: "XS", bust: "30", waist: "24", hip: "34" },
    { size: "S", bust: "32", waist: "26", hip: "36" },
    { size: "M", bust: "34", waist: "28", hip: "38" },
    { size: "L", bust: "36", waist: "30", hip: "40" },
    { size: "XL", bust: "38", waist: "32", hip: "42" },
    { size: "XXL", bust: "40", waist: "34", hip: "44" },
    { size: "3XL", bust: "42", waist: "36", hip: "46" },
    { size: "4XL", bust: "44", waist: "38", hip: "48" },
  ],
};

export interface SizeChartRow {
  size: string;
  [measurement: string]: string;
}

export interface SizeChart {
  unit: string;
  headers: string[];
  rows: SizeChartRow[];
}

export function isSizeChart(value: unknown): value is SizeChart {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<SizeChart>;
  return typeof candidate.unit === "string"
    && Array.isArray(candidate.headers)
    && candidate.headers.every((header) => typeof header === "string")
    && Array.isArray(candidate.rows)
    && candidate.rows.every((row) => typeof row === "object" && row !== null && typeof row.size === "string");
}
