import { useCallback, useEffect, useState } from "react";
import { PenLine, Info, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { StarDisplay } from "./StarRating";
import { ReviewFormModal } from "./ReviewFormModal";
import { useItemRating } from "@/hooks/useItemRating";
import {
  Review, ReviewItemType, checkReviewEligibility, fetchReviews, truncateWords,
} from "@/lib/reviews";

const FOREST = "#1F4D3A";
const FOREST_SOFT = "#EAF0EA";
const CLAY = "#C1552F";
const CLAY_LIGHT = "#E0824F";
const GOLD = "#B98A2A";
const INK = "#1C2B22";
const INK_SOFT = "#5B6B60";
const HAIRLINE = "#DCE3DC";
const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

const PAGE = 3; // show a few reviews at a time, never all at once

interface Props { itemId: string; itemType: ReviewItemType; itemName: string; }

export const ReviewsSection = ({ itemId, itemType, itemName }: Props) => {
  const { user } = useAuth();
  const { avg, count } = useItemRating(itemId);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [visible, setVisible] = useState(PAGE);
  const [eligible, setEligible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => {
    fetchReviews(itemId).then(setReviews).catch(() => setReviews([]));
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) { setEligible(false); return; }
    checkReviewEligibility(user.id, itemId).then(setEligible);
  }, [user, itemId]);

  const shown = reviews.slice(0, visible);

  return (
    <section id="reviews" className="bg-white rounded-2xl p-5 scroll-mt-24" style={{ border: `1px solid ${HAIRLINE}`, fontFamily: FONT_BODY }}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg md:text-xl font-semibold leading-none" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Reviews</h2>
          <span className="block w-9 h-[3px] rounded-full mt-2" style={{ background: CLAY }} />
          {count > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-2xl font-semibold tabular-nums" style={{ fontFamily: FONT_DISPLAY, color: INK }}>{avg.toFixed(1)}</span>
              <div>
                <StarDisplay value={avg} size={14} />
                <p className="text-[11px] mt-0.5" style={{ color: INK_SOFT }}>{count} review{count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          )}
        </div>

        {eligible && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-white text-[12px] font-semibold rounded-xl px-4 py-2.5 hover:opacity-90 active:scale-95 transition-all"
            style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}
          >
            <PenLine className="h-3.5 w-3.5" /> Write a review
          </button>
        )}
      </div>

      {!eligible && (
        <div className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 mb-4" style={{ background: FOREST_SOFT }}>
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: FOREST }} />
          <p className="text-[11px] leading-snug" style={{ color: INK_SOFT }}>
            {user
              ? "Only guests with a booking whose visit date has passed can leave a review."
              : "Log in to leave a review after your visit."}
          </p>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8 gap-1.5">
          <Star className="h-6 w-6" style={{ color: `${GOLD}88` }} />
          <p className="text-[13px] font-semibold" style={{ color: INK }}>No reviews yet</p>
          <p className="text-[12px]" style={{ color: INK_SOFT }}>Be the first to share your experience after your visit.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {shown.map((r) => (
            <article key={r.id} className="rounded-2xl p-4 flex flex-col gap-2" style={{ border: `1px solid ${HAIRLINE}`, background: "#FBFCFA" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white flex-shrink-0" style={{ background: FOREST }}>
                  {(r.reviewer_name || "G").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold truncate" style={{ color: INK }}>{r.reviewer_name || "Guest"}</p>
                  <p className="text-[10px]" style={{ color: INK_SOFT }}>
                    {new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
              <StarDisplay value={r.rating} size={13} />
              {r.comment && (
                <p className="text-[13px] leading-relaxed whitespace-pre-line" style={{ color: INK }}>
                  {truncateWords(r.comment)}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {visible < reviews.length && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setVisible((v) => v + PAGE)}
            className="text-[12px] font-semibold rounded-full px-4 py-2 transition-colors"
            style={{ border: `1px solid ${FOREST}40`, color: FOREST }}
          >
            Show more reviews
          </button>
        </div>
      )}

      {modalOpen && (
        <ReviewFormModal
          itemId={itemId} itemType={itemType} itemName={itemName}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </section>
  );
};