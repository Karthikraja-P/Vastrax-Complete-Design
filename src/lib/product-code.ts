export interface ProductCodeParts {
  category: string;
  style: string;
  colour: string;
  size: string;
}

const CONNECTOR_WORDS = new Set(["AND", "THE", "WITH", "OF"]);
const COMMON_COLOUR_CODES: Record<string, string> = {
  BEIGE: "BEI",
  BLACK: "BLK",
  BLUE: "BLU",
  BROWN: "BRN",
  GREEN: "GRN",
  GREY: "GRY",
  GRAY: "GRY",
  IVORY: "IVY",
  NAVY: "NVY",
  PINK: "PNK",
  PURPLE: "PUR",
  RED: "RED",
  WHITE: "WHT",
  YELLOW: "YLW",
};

function codeWords(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " AND ")
    .toUpperCase()
    .match(/[A-Z0-9]+/g) || [];
}

function compactSegment(value: string, maxWords: number, singleWordLength: number): string {
  const words = codeWords(value).filter((word) => !CONNECTOR_WORDS.has(word));
  if (!words.length) return "";
  if (words.length === 1) return words[0].slice(0, singleWordLength);
  return words.slice(0, maxWords).map((word) => word[0]).join("");
}

function colourCode(value: string): string {
  const words = codeWords(value).filter((word) => !CONNECTOR_WORDS.has(word));
  if (!words.length) return "";
  if (words.length === 1) return COMMON_COLOUR_CODES[words[0]] || words[0].slice(0, 3);
  return words.slice(0, 3).map((word) => word[0]).join("");
}

/** Builds a short SKU as VTX-category-style-colour-size. */
export function generateProductCode({ category, style, colour, size }: ProductCodeParts): string {
  const categoryCode = compactSegment(category, 2, 2);
  const styleCode = compactSegment(style, 4, 4);
  const compactColourCode = colourCode(colour);
  const sizeCode = codeWords(size).join("");
  if (!categoryCode || !styleCode || !compactColourCode || !sizeCode) return "";
  return `VTX-${categoryCode}-${styleCode}-${compactColourCode}-${sizeCode}`;
}
