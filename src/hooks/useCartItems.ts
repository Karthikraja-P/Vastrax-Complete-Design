import { useMemo, useSyncExternalStore } from "react";
import type { CartItem } from "@/lib/cart";

const CART_STORAGE_KEY = "vastrax_cart";

function getSnapshot(): string {
  return typeof window === "undefined" ? "[]" : localStorage.getItem(CART_STORAGE_KEY) || "[]";
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("cart-updated", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("cart-updated", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function parseCart(snapshot: string): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed.filter((item): item is CartItem =>
      typeof item === "object" && item !== null && "id" in item && "name" in item && "price" in item && "quantity" in item
    ) : [];
  } catch {
    return [];
  }
}

export function useCartItems(): CartItem[] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  return useMemo(() => parseCart(snapshot), [snapshot]);
}
