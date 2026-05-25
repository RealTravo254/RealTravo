import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getLocalSavedItemIds,
  saveItemLocally,
  removeItemLocally,
  getLocalSavedItems,
  clearLocalSavedItems,
} from "@/hooks/useLocalSavedItems";

export const useSavedItems = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const hasMergedRef = useRef(false);

  // ── Normalise item type strings coming from ListingCard / detail pages ──
  const normalizeItemType = useCallback((type: string): string => {
    const map: Record<string, string> = {
      trip: "trip",
      event: "event",
      sport: "event",
      hotel: "hotel",
      accommodation: "hotel",
      adventure: "adventure_place",
      adventure_place: "adventure_place",
      "adventure place": "adventure_place",
      attraction: "attraction",
    };
    return map[type.toLowerCase().replace(/\s+/g, "_")] ?? type.toLowerCase();
  }, []);

  // ── Merge localStorage items into Supabase once on login ────────────────
  const mergeLocalItemsToDatabase = useCallback(async (userId: string) => {
    const localItems = getLocalSavedItems();
    if (localItems.length === 0) return;

    for (const item of localItems) {
      const { data: existing } = await supabase
        .from("saved_items")
        .select("id")
        .eq("item_id", item.item_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("saved_items").insert([
          {
            user_id: userId,
            item_id: item.item_id,
            item_type: item.item_type,
          },
        ]);
      }
    }

    clearLocalSavedItems();
  }, []);

  // ── Load saved items on auth change ─────────────────────────────────────
  useEffect(() => {
    if (!user) {
      // Guest — load from localStorage so hearts show as filled
      setSavedItems(getLocalSavedItemIds());
      setLoading(false);
      hasMergedRef.current = false;
      return;
    }

    const fetchSavedItems = async () => {
      // Merge local items first (only once per session)
      if (!hasMergedRef.current) {
        await mergeLocalItemsToDatabase(user.id);
        hasMergedRef.current = true;
      }

      const { data, error } = await supabase
        .from("saved_items")
        .select("item_id")
        .eq("user_id", user.id);

      if (data) {
        setSavedItems(new Set(data.map((item) => item.item_id)));
      }
      setLoading(false);
    };

    fetchSavedItems();

    // Realtime subscription so other tabs/devices stay in sync
    const channel = supabase
      .channel(`saved-items-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "saved_items",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newItem = payload.new as { item_id: string };
          setSavedItems((prev) => new Set([...prev, newItem.item_id]));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "saved_items",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const deleted = payload.old as { item_id: string };
          setSavedItems((prev) => {
            const next = new Set(prev);
            next.delete(deleted.item_id);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // ── Toggle save / unsave ─────────────────────────────────────────────────
  const handleSave = useCallback(
    async (itemId: string, itemType: string) => {
      const normalizedType = normalizeItemType(itemType);
      const isCurrentlySaved = savedItems.has(itemId);

      // ── Guest (not logged in) ──────────────────────────────────────────
      if (!user) {
        // Optimistic UI update immediately
        setSavedItems((prev) => {
          const next = new Set(prev);
          if (isCurrentlySaved) {
            next.delete(itemId);
          } else {
            next.add(itemId);
          }
          return next;
        });

        if (isCurrentlySaved) {
          removeItemLocally(itemId);
          toast({ title: "Removed", description: "Removed from your saved items." });
        } else {
          saveItemLocally(itemId, normalizedType);
          toast({ title: "Saved!", description: "Item saved locally. Sign in to sync." });
        }
        return;
      }

      // ── Logged-in user ─────────────────────────────────────────────────
      // Optimistic UI update immediately so heart responds instantly
      setSavedItems((prev) => {
        const next = new Set(prev);
        if (isCurrentlySaved) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      });

      if (isCurrentlySaved) {
        // Remove from Supabase
        const { error } = await supabase
          .from("saved_items")
          .delete()
          .eq("item_id", itemId)
          .eq("user_id", user.id);

        if (error) {
          // Revert optimistic update on failure
          setSavedItems((prev) => new Set([...prev, itemId]));
          toast({ title: "Error", description: "Could not remove item. Please try again.", variant: "destructive" });
          console.error("handleSave delete error:", error);
        } else {
          toast({ title: "Removed", description: "Removed from your saved items." });
        }
      } else {
        // Check it doesn't already exist (guard against double-tap)
        const { data: existing } = await supabase
          .from("saved_items")
          .select("id")
          .eq("item_id", itemId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase.from("saved_items").insert([
            {
              user_id: user.id,
              item_id: itemId,
              item_type: normalizedType,
            },
          ]);

          if (error) {
            // Revert optimistic update on failure
            setSavedItems((prev) => {
              const next = new Set(prev);
              next.delete(itemId);
              return next;
            });
            toast({ title: "Error", description: "Could not save item. Please try again.", variant: "destructive" });
            console.error("handleSave insert error:", error);
          } else {
            toast({ title: "Saved!", description: "Added to your saved items." });
          }
        }
        // If existing already, the optimistic update is correct — no action needed
      }
    },
    [user, savedItems, normalizeItemType, toast]
  );

  return { savedItems, loading, handleSave };
};