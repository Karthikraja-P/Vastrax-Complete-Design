"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ProductIdForwarderPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const id = params?.id;
    if (id) {
      router.replace(`/storefront/product?id=${id}`);
    } else {
      router.replace("/storefront/collections");
    }
  }, [params, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
}
