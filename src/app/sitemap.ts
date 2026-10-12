import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

const PAGES = ["collections", "terms", "privacy", "refund-policy", "shipping-policy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE.url, lastModified: new Date(), changeFrequency: "daily" as const }, ...PAGES.map((p) => ({ url: `${SITE.url}/storefront/${p}`, lastModified: new Date(), changeFrequency: (p === "collections" ? "daily" : "yearly") as "daily" | "yearly" }))];
}
