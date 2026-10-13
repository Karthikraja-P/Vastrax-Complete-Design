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
