import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ListingItem, ListingItemType } from "@/components/ListingGrid";

/**
 * Loads every listing the signed-in host owns, in the shape the share /
 * manual-booking / analytics dropdowns need.
 *
 * ⚠ Adjust SOURCES (table names) and OWNER_COLUMNS to match your database.
 * Anything that fails to load is skipped, so a wrong name just means an
 * empty dropdown entry – it never crashes the page.
 */
const SOURCES: Array<{ table: string; type: ListingItemType }> = [
  { table: "trips", type: "trip" }, // rows with type === "event" become events
  { table: "hotels", type: "hotel" },
  { table: "adventure_places", type: "adventure_place" },
];

// first column that works is used
const OWNER_COLUMNS = ["created_by", "host_id", "user_id"];

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const asList = (raw: unknown): Array<{ name: string; price: number }> => {
  let list: any = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((x: any) => ({ name: String(x?.name ?? x?.title ?? "").trim(), price: num(x?.price) }))
    .filter((x) => x.name);
};

const toItem = (row: any, type: ListingItemType): ListingItem => ({
  id: String(row.id),
  type: type === "trip" && row.type === "event" ? "event" : type,
  name: row.name ?? row.title ?? "Untitled listing",
  totalCapacity: num(row.available_tickets ?? row.total_capacity ?? row.capacity ?? row.max_capacity),
  facilities: asList(row.facilities),
  activities: asList(row.activities),
  tripDate: row.date ?? row.trip_date ?? null,
  isFlexibleDate: Boolean(row.is_flexible_date ?? row.flexible_date),
});

export const useHostListings = (enabled = true) => {
  const [items, setItems] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) {
        setItems([]);
        return;
      }

      const results = await Promise.all(
        SOURCES.map(async ({ table, type }) => {
          for (const col of OWNER_COLUMNS) {
            const { data, error } = await (supabase as any).from(table).select("*").eq(col, uid);
            if (!error) return (data || []).map((row: any) => toItem(row, type));
          }
          return [] as ListingItem[];
        })
      );
      setItems(results.flat());
    } catch (err) {
      console.error("useHostListings:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, refetch: load };
};