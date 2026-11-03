import type { ProductImage } from "@/lib/api";

/** Return only photos currently attached to a product in its Admin gallery. */
export function getAdminProductImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];

  return images
    .map((image) => {
      if (typeof image === "string") return image.trim();
      if (!image || typeof image !== "object") return "";
      const productImage = image as ProductImage;
      return String(productImage.s3_url || productImage.url || "").trim();
    })
    .filter(Boolean);
}

/** Product photos have no storefront-side overrides or generated substitutions. */
export function storefrontProductImage(_productId: string | number, adminImage?: string): string {
  return adminImage || "/product-placeholder.svg";
}

/** Keep the gallery source exactly as selected in the current Admin product gallery. */
export function storefrontProductGalleryImage(image: string): string {
  return image || "/product-placeholder.svg";
}
