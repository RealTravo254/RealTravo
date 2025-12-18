import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RatingData {
  avgRating: number;
  reviewCount: number;
}

export const useRatings = (itemIds: string[]) => {
  const [ratings, setRatings] = useState<Map<string, RatingData>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (itemIds.length === 0) return;

    const fetchRatings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("reviews")
          .select("item_id, rating")
          .in("item_id", itemIds);

        if (error) {
          console.error("Error fetching ratings:", error);
          return;
        }

        // Calculate average rating and count for each item
        const ratingsMap = new Map<string, RatingData>();
        const itemRatings = new Map<string, number[]>();

        data?.forEach((review) => {
          const existing = itemRatings.get(review.item_id) || [];
          existing.push(review.rating);
          itemRatings.set(review.item_id, existing);
        });

        itemRatings.forEach((ratingsList, itemId) => {
          const avg = ratingsList.reduce((a, b) => a + b, 0) / ratingsList.length;
          ratingsMap.set(itemId, {
            avgRating: Math.round(avg * 10) / 10, // Round to 1 decimal
            reviewCount: ratingsList.length,
          });
        });

        setRatings(ratingsMap);
      } catch (error) {
        console.error("Error fetching ratings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRatings();
  }, [itemIds.join(",")]);

  return { ratings, loading };
};

// Utility function to sort items by rating
export const sortByRating = <T extends { id: string }>(
  items: T[],
  ratings: Map<string, RatingData>,
  position?: { latitude: number; longitude: number } | null,
  calculateDistance?: (lat1: number, lon1: number, lat2: number, lon2: number) => number
): T[] => {
  return [...items].sort((a, b) => {
    const ratingA = ratings.get(a.id);
    const ratingB = ratings.get(b.id);

    // Items with location + high rating come first when position is available
    if (position && calculateDistance) {
      const itemA = a as any;
      const itemB = b as any;
      const aHasCoords = itemA.latitude && itemA.longitude;
      const bHasCoords = itemB.latitude && itemB.longitude;

      // Both have coordinates - sort by rating within similar distance range
      if (aHasCoords && bHasCoords) {
        const distA = calculateDistance(position.latitude, position.longitude, itemA.latitude, itemA.longitude);
        const distB = calculateDistance(position.latitude, position.longitude, itemB.latitude, itemB.longitude);
        
        // If within same 10km range, sort by rating
        const distRangeA = Math.floor(distA / 10);
        const distRangeB = Math.floor(distB / 10);
        
        if (distRangeA === distRangeB) {
          // Same distance range - sort by rating
          const avgA = ratingA?.avgRating || 0;
          const avgB = ratingB?.avgRating || 0;
          if (avgB !== avgA) return avgB - avgA;
          // Same rating - sort by review count
          return (ratingB?.reviewCount || 0) - (ratingA?.reviewCount || 0);
        }
        // Different distance range - closer first
        return distA - distB;
      }
      if (aHasCoords && !bHasCoords) return -1;
      if (!aHasCoords && bHasCoords) return 1;
    }

    // No position - sort by rating globally
    const avgA = ratingA?.avgRating || 0;
    const avgB = ratingB?.avgRating || 0;
    if (avgB !== avgA) return avgB - avgA;
    // Same rating - sort by review count
    return (ratingB?.reviewCount || 0) - (ratingA?.reviewCount || 0);
  });
};
