import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

const PUBLIC_PAGES = [
  ["/storefront/home", "daily"],
  ["/storefront/collections", "daily"],
  ["/storefront/terms", "yearly"],
  ["/storefront/privacy", "yearly"],
  ["/storefront/refund-policy", "yearly"],
  ["/storefront/shipping-policy", "yearly"],
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = PUBLIC_PAGES.map(([path, frequency]) => ({
    url: `${SITE.url}${path}`,
    lastModified: new Date(),
    changeFrequency: frequency,
  }));

  try {
    const backend = (process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
    const response = await fetch(`${backend}/api/v1/products`, { next: { revalidate: 1800 } });
    if (response.ok) {
      const payload = await response.json();
      const products = Array.isArray(payload) ? payload : payload?.items || [];
      for (const product of products) {
        if (!product?.id || String(product.gender || "").toLowerCase() !== "women") continue;
        pages.push({
          url: `${SITE.url}/storefront/product?id=${encodeURIComponent(String(product.id))}`,
          lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
          changeFrequency: "weekly",
        });
      }
    }
  } catch {
    // The stable public pages remain available if the catalog API is temporarily offline.
  }

  return pages;
}
