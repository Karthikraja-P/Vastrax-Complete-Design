import { useMemo, useSyncExternalStore } from "react";

const FAVORITES_KEY = "vastrax_favorites";
const FAVORITES_UPDATED_EVENT = "vastrax-favorites-updated";

function getSnapshot(): string {
  return typeof window === "undefined" ? "" : localStorage.getItem(FAVORITES_KEY) || "";
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(FAVORITES_UPDATED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(FAVORITES_UPDATED_EVENT, onStoreChange);
  };
}

function itemId(item: unknown): string {
  if (typeof item === "object" && item !== null && "id" in item) {
    const id = item.id;
    return id === undefined || id === null ? "" : String(id);
  }
  return String(item ?? "");
}

function parseFavorites(snapshot: string): string[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed.map(itemId).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export interface FavoriteProduct {
  id: string | number;
  name: string;
  price?: number | string;
  image?: string;
}

export function useFavoriteProducts(): FavoriteProduct[] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  return useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(snapshot || "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is FavoriteProduct =>
        typeof item === "object" && item !== null && "id" in item && "name" in item
      ) : [];
    } catch {
      return [];
    }
  }, [snapshot]);
}

export function useFavorites() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const favorites = useMemo(() => parseFavorites(snapshot), [snapshot]);

  const toggleFavorite = (id: string | number, favoriteProduct?: { id: string | number; name: string; price?: number | string; image?: string }) => {
    const targetId = String(id);
    let current: unknown[] = [];
    try {
      const parsed: unknown = JSON.parse(getSnapshot() || "[]");
      if (Array.isArray(parsed)) current = parsed;
    } catch {
      current = [];
    }

    const isFav = current.some((item) => itemId(item) === targetId);
    const updated = isFav
      ? current.filter((item) => itemId(item) !== targetId)
      : [...current, favoriteProduct || targetId];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT));
  };

  const isFavorite = (id: string | number) => favorites.includes(String(id));
  return { favorites, toggleFavorite, isFavorite };
}
