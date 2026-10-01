import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

const PAGES = ["home", "collections", "terms", "privacy", "refund-policy", "shipping-policy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({ url: `${SITE.url}/storefront/${p}`, lastModified: new Date(), changeFrequency: p === "home" || p === "collections" ? "daily" : "yearly" }));
}
