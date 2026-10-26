export interface ProductCodeParts {
  category: string;
  style: string;
  colour: string;
  size: string;
}

function codeSegment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " AND ")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}

/** Generates one size-specific code in Category → Style → Colour → Size order. */
export function generateProductCode({ category, style, colour, size }: ProductCodeParts): string {
  const parts = [category, style, colour, size].map(codeSegment);
  if (parts.some((part) => !part)) return "";
  return `VTX-${parts.join("-")}`;
}
