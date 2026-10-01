import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/storefront/", disallow: ["/admin", "/products", "/categories", "/orders", "/users", "/settings", "/api/", "/results/", "/user_uploads/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
