// src/lib/reviews.ts
import { supabase } from "@/integrations/supabase/client";

export const MAX_REVIEW_WORDS = 100;

export type ReviewItemType = "trip" | "adventure_place";

export interface Review {
  id: string;
  user_id: string;
  item_id: string;
  item_type: string;
  rating: number;
  comment: string | null;
  reviewer_name: string | null;
  created_at: string;
}

export interface ItemRating { avg: number; count: number }

// ── Words ───────────────────────────────────────────────────────────────────
export const countWords = (text: string) => {
  const t = (text || "").trim();
  return t ? t.split(/\s+/).length : 0;
};

export const truncateWords = (text: string, max = MAX_REVIEW_WORDS) => {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  return words.length <= max ? words.join(" ") : words.slice(0, max).join(" ") + "…";
};

// ── Eligibility helpers ─────────────────────────────────────────────────────
export const itemTypeFromBookingType = (t?: string): ReviewItemType | null => {
  const type = (t || "").toLowerCase();
  if (type === "trip" || type === "event") return "trip";
  if (["adventure_place", "adventure", "hotel", "campsite", "attraction"].includes(type)) return "adventure_place";
  return null;
};

export const getBookingItemId = (b: any): string | null =>
  b?.item_id || b?.booking_details?.item_id || b?.booking_details?.itemId || null;

// Rescheduled bookings keep the new date inside booking_details.date
export const getBookingVisitDate = (b: any): string | null => {
  const d = b?.booking_details || {};
  if (d.rescheduled_at && d.date) return d.date;
  return b?.visit_date || d.date || d.visit_date || null;
};

const visitArrived = (dateStr?: string | null) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now();
};

export const isBookingReviewable = (b: any): boolean => {
  if (!b || !getBookingItemId(b)) return false;
  if ((b.status || "").toLowerCase() === "cancelled") return false;
  return visitArrived(getBookingVisitDate(b));
};

export const checkReviewEligibility = async (userId: string, itemId: string): Promise<boolean> => {
  try {
    const { data, error } = await (supabase as any)
      .from("bookings")
      .select("id,status,visit_date,booking_details")
      .eq("user_id", userId)
      .eq("item_id", itemId);
    if (error) throw error;
    return (data || []).some((b: any) => isBookingReviewable({ ...b, item_id: itemId }));
  } catch {
    return false;
  }
};

// ── Batched rating lookup (one query for a whole grid of cards) ─────────────
const ratingCache = new Map<string, ItemRating>();
let pending = new Map<string, ((r: ItemRating) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

const flush = async () => {
  const batch = pending;
  pending = new Map();
  timer = null;
  const ids = [...batch.keys()];
  let rows: any[] = [];
  try {
    const { data } = await (supabase as any)
      .from("item_review_stats").select("item_id,avg_rating,review_count").in("item_id", ids);
    rows = data || [];
  } catch { /* fall through with empty */ }
  ids.forEach((id) => {
    const row = rows.find((r) => r.item_id === id);
    const value: ItemRating = row
      ? { avg: Number(row.avg_rating) || 0, count: Number(row.review_count) || 0 }
      : { avg: 0, count: 0 };
    ratingCache.set(id, value);
    batch.get(id)?.forEach((fn) => fn(value));
  });
};

export const fetchItemRating = (id: string): Promise<ItemRating> =>
  new Promise((resolve) => {
    const cached = ratingCache.get(id);
    if (cached) return resolve(cached);
    const list = pending.get(id) ?? [];
    list.push(resolve);
    pending.set(id, list);
    if (!timer) timer = setTimeout(flush, 40);
  });

export const invalidateItemRating = (id: string) => {
  ratingCache.delete(id);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rating-updated", { detail: id }));
};

// ── Reviews CRUD ────────────────────────────────────────────────────────────
export const fetchReviews = async (itemId: string, limit = 30): Promise<Review[]> => {
  const { data, error } = await (supabase as any)
    .from("item_reviews").select("*").eq("item_id", itemId)
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
};

export const fetchMyReview = async (userId: string, itemId: string): Promise<Review | null> => {
  const { data } = await (supabase as any)
    .from("item_reviews").select("*").eq("user_id", userId).eq("item_id", itemId).maybeSingle();
  return data || null;
};

export const submitReview = async (input: {
  userId: string; itemId: string; itemType: ReviewItemType;
  rating: number; comment: string; reviewerName: string;
}) => {
  const { error } = await (supabase as any).from("item_reviews").upsert(
    {
      user_id: input.userId,
      item_id: input.itemId,
      item_type: input.itemType,
      rating: input.rating,
      comment: truncateWords(input.comment).replace(/…$/, ""),
      reviewer_name: input.reviewerName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id" },
  );
  if (error) throw error;
  invalidateItemRating(input.itemId);
};