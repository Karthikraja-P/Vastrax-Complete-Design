import { useState, useEffect } from "react";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("vastrax_favorites");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Extract IDs if they are objects (legacy format)
          const ids = parsed.map((item: any) => 
            typeof item === 'object' && item !== null ? item.id : item
          );
          setFavorites(ids);
        }
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  const toggleFavorite = (id: string | number) => {
    const strId = String(id);
    setFavorites((prev) => {
      const isFav = prev.some(fid => String(fid) === strId);
      const updated = isFav ? prev.filter((fid) => String(fid) !== strId) : [...prev, strId];
      
      // Preserve any objects in localStorage by only updating the IDs
      const saved = localStorage.getItem("vastrax_favorites");
      let currentStorage = [];
      if (saved) {
        try { currentStorage = JSON.parse(saved); } catch (e) {}
      }
      
      if (!Array.isArray(currentStorage)) currentStorage = [];
      
      if (isFav) {
        currentStorage = currentStorage.filter(item => 
          typeof item === 'object' && item !== null ? String(item.id) !== strId : String(item) !== strId
        );
      } else {
        currentStorage.push(strId);
      }
      
      localStorage.setItem("vastrax_favorites", JSON.stringify(currentStorage));
      return updated;
    });
  };

  const isFavorite = (id: string | number) => {
    const strId = String(id);
    return favorites.some(fid => String(fid) === strId);
  };

  return { favorites, toggleFavorite, isFavorite };
}
