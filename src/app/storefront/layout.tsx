import StorefrontFooter from "@/components/layout/StorefrontFooter";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <StorefrontFooter />
    </>
  );
}
