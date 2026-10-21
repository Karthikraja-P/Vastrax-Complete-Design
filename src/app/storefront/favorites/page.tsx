import type { Metadata } from "next";
import FavoritesClient from "./FavoritesClient";

export const metadata: Metadata = {
  title: "Saved favorites",
  description: "Return to your saved VastraX pieces, review product details, and check current size availability.",
  alternates: { canonical: "/storefront/favorites" },
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return <FavoritesClient />;
}
