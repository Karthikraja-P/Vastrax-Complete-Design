import type { Metadata } from "next";
import StorefrontHome from "./StorefrontHome";

export const metadata: Metadata = {
  title: "Coordinated Two-Piece Sets for Women",
  description: "Browse VastraX coordinated two-piece sets, view product details, and shop available sizes in one place.",
  alternates: { canonical: "/storefront/home" },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return <StorefrontHome />;
}
