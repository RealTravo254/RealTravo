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
  // Tracks in-flight saves to prevent double-tap race conditions
  const pendingRef = useRef<Set<string>>(new Set());

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

  // Merge localStorage → Supabase once on login, then clear local storage
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

  useEffect(() => {
    if (!user) {
      // Guest: load from localStorage
      setSavedItems(getLocalSavedItemIds());
      setLoading(false);
      hasMergedRef.current = false;
      return;
    }

    const fetchSavedItems = async () => {
      setLoading(true);

      // Merge local items into Supabase first (only once per session)
      if (!hasMergedRef.current) {
        await mergeLocalItemsToDatabase(user.id);
        hasMergedRef.current = true;
      }

      // Always fetch the authoritative list from Supabase after merge
      const { data, error } = await supabase
        .from("saved_items")
        .select("item_id")
        .eq("user_id", user.id);

      if (error) {
        console.error("fetchSavedItems error:", error);
      }

      // Set state from DB — this is the single source of truth for logged-in users
      setSavedItems(new Set((data ?? []).map((item) => item.item_id)));
      setLoading(false);
    };

    fetchSavedItems();

    // Realtime: keep in sync across tabs/devices
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

  const handleSave = useCallback(
    async (itemId: string, itemType: string) => {
      // Prevent double-tap firing two requests
      if (pendingRef.current.has(itemId)) return;
      pendingRef.current.add(itemId);

      const normalizedType = normalizeItemType(itemType);

      // Read current saved state DIRECTLY from the set (not closure)
      // We use a functional update pattern to get the latest value
      let wasAlreadySaved = false;
      setSavedItems((prev) => {
        wasAlreadySaved = prev.has(itemId);
        return prev; // no change yet — just reading
      });

      // Small delay to let the state read settle
      await new Promise((r) => setTimeout(r, 0));

      // Re-read properly
      wasAlreadySaved = savedItems.has(itemId);

      // ── Guest ──────────────────────────────────────────────────────────
      if (!user) {
        setSavedItems((prev) => {
          const next = new Set(prev);
          if (wasAlreadySaved) {
            next.delete(itemId);
          } else {
            next.add(itemId);
          }
          return next;
        });

        if (wasAlreadySaved) {
          removeItemLocally(itemId);
          toast({ title: "Removed", description: "Removed from saved items." });
        } else {
          saveItemLocally(itemId, normalizedType);
          toast({ title: "Saved!", description: "Sign in to sync across devices." });
        }

        pendingRef.current.delete(itemId);
        return;
      }

      // ── Logged-in user ─────────────────────────────────────────────────
      // Check Supabase directly — don't trust local state alone
      // This prevents the "already saved" false positive
      const { data: existing } = await supabase
        .from("saved_items")
        .select("id")
        .eq("item_id", itemId)
        .eq("user_id", user.id)
        .maybeSingle();

      const isTrulyInDB = !!existing;

      if (isTrulyInDB) {
        // ── UNSAVE ──────────────────────────────────────────────────────
        // Optimistic remove
        setSavedItems((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });

        const { error } = await supabase
          .from("saved_items")
          .delete()
          .eq("item_id", itemId)
          .eq("user_id", user.id);

        if (error) {
          // Revert
          setSavedItems((prev) => new Set([...prev, itemId]));
          toast({
            title: "Error",
            description: "Could not remove item. Please try again.",
            variant: "destructive",
          });
          console.error("handleSave delete error:", error);
        } else {
          toast({ title: "Removed", description: "Removed from your saved items." });
        }
      } else {
        // ── SAVE ────────────────────────────────────────────────────────
        // Optimistic add
        setSavedItems((prev) => new Set([...prev, itemId]));

        const { error } = await supabase.from("saved_items").insert([
          {
            user_id: user.id,
            item_id: itemId,
            item_type: normalizedType,
          },
        ]);

        if (error) {
          // Revert
          setSavedItems((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
          toast({
            title: "Error",
            description: "Could not save item. Please try again.",
            variant: "destructive",
          });
          console.error("handleSave insert error:", error);
        } else {
          toast({ title: "Saved!", description: "Added to your saved items." });
        }
      }

      pendingRef.current.delete(itemId);
    },
    [user, savedItems, normalizeItemType, toast]
  );

  return { savedItems, loading, handleSave };
};