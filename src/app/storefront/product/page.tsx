import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import ProductDetailsClient from "./ProductDetailsClient";

type ProductPageProps = { searchParams: Promise<{ id?: string; product_id?: string }> };

export async function generateMetadata({ searchParams }: ProductPageProps): Promise<Metadata> {
  const params = await searchParams;
  const id = params.id || params.product_id;
  if (!id) {
    return {
      title: "Product details",
      description: "View product details, available sizes, and shopping options from VastraX.",
      robots: { index: false, follow: true },
    };
  }

  try {
    const backend = (process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
    const response = await fetch(`${backend}/api/v1/products/${encodeURIComponent(id)}`, { next: { revalidate: 300 } });
    if (!response.ok) throw new Error("Product metadata unavailable");
    const product = await response.json() as { name?: string; title?: string; description?: string; image?: string; images?: Array<string | { s3_url?: string }> };
    const name = product.name || product.title || "Product details";
    const description = String(product.description || `See the ${name} coordinated look, available sizes, and current price from VastraX.`).slice(0, 160);
    const imageValue = product.image || (typeof product.images?.[0] === "string" ? product.images[0] : product.images?.[0]?.s3_url);
    const image = imageValue?.startsWith("http") ? imageValue : imageValue ? `${SITE.url}${imageValue.startsWith("/") ? "" : "/"}${imageValue}` : `${SITE.url}/opengraph-image`;
    return {
      title: name,
      description,
      alternates: { canonical: `${SITE.url}/storefront/product?id=${encodeURIComponent(id)}` },
      robots: { index: true, follow: true },
      openGraph: { title: name, description, url: `${SITE.url}/storefront/product?id=${encodeURIComponent(id)}`, images: [{ url: image, alt: name }] },
      twitter: { card: "summary_large_image", title: name, description, images: [image] },
    };
  } catch {
    return {
      title: "Product details",
      description: "View product details and available sizes from VastraX.",
      robots: { index: false, follow: true },
    };
  }
}

export default function ProductPage() {
  return <ProductDetailsClient />;
}
