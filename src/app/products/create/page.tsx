"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyCreateProductRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/products/add");
  }, [router]);

  return (
    <main className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground" aria-live="polite">
      Opening product setup…
    </main>
  );
}
