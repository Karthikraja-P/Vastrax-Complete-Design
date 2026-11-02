import type { Metadata } from "next";
import StorefrontFooter from "@/components/layout/StorefrontFooter";

// Public storefront routes are indexable by default. Private account routes
// set noindex in their own segment layouts or page metadata.
export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <StorefrontFooter />
    </>
  );
}
