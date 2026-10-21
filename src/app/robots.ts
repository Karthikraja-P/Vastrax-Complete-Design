import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: ["/storefront/home", "/storefront/collections", "/storefront/product"],
      disallow: [
        "/admin", "/products", "/categories", "/orders", "/users", "/settings", "/api/",
        "/results/", "/user_uploads/", "/storefront/account", "/storefront/checkout",
        "/storefront/favorites", "/storefront/unsubscribe",
      ],
    }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
