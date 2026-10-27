import { useEffect, useState } from "react";
import { fetchItemRating, ItemRating } from "@/lib/reviews";

export const useItemRating = (itemId?: string | null, enabled = true): ItemRating => {
  const [rating, setRating] = useState<ItemRating>({ avg: 0, count: 0 });

  useEffect(() => {
    if (!itemId || !enabled) return;
    let alive = true;
    const load = () => fetchItemRating(itemId).then((r) => alive && setRating(r));
    load();
    const onUpdate = (e: Event) => {
      if ((e as CustomEvent).detail === itemId) load();
    };
    window.addEventListener("rating-updated", onUpdate);
    return () => { alive = false; window.removeEventListener("rating-updated", onUpdate); };
  }, [itemId, enabled]);

  return rating;
};