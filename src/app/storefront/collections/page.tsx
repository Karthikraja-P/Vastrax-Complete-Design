import type { Metadata } from "next";
import CollectionsClient from "./CollectionsClient";

export const metadata: Metadata = {
  title: "Shop Women's Coordinated Sets",
  description: "Browse VastraX women's coordinated sets. Filter by category, color, and price, then check size availability before adding to your bag.",
  alternates: { canonical: "/storefront/collections" },
  robots: { index: true, follow: true },
};

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ category?: string; sort?: string; search?: string }> }) {
  const params = await searchParams;
  return <CollectionsClient initialCategory={params.category} initialSort={params.sort} initialSearch={params.search} />;
}
