const PRODUCT_CUTOUTS: Record<string, string> = {
  "vtx-8db7233b": "/storefront/product-cutouts/beige-coord-cutout.webp",
  "vtx-6b1eeb36": "/storefront/product-cutouts/pink-coord-cutout.webp",
  "vtx-f2b3a9a5": "/storefront/product-cutouts/skirt-and-top-cutout.webp",
};

export function storefrontProductImage(id: string | number, fallback?: string): string {
  return fallback || PRODUCT_CUTOUTS[String(id)] || "/product-placeholder.svg";
}

export function storefrontCollectionImage(id: string | number, fallback?: string): string {
  return PRODUCT_CUTOUTS[String(id)] || fallback || "/product-placeholder.svg";
}
