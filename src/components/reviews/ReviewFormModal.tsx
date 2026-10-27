import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { StarInput } from "./StarRating";
import { MAX_REVIEW_WORDS, ReviewItemType, countWords, fetchMyReview, submitReview } from "@/lib/reviews";

const FOREST = "#1F4D3A";
const CLAY = "#C1552F";
const CLAY_LIGHT = "#E0824F";
const INK = "#1C2B22";
const INK_SOFT = "#5B6B60";
const HAIRLINE = "#DCE3DC";
const CANVAS = "#F4F6F2";
const DANGER = "#9C3B2B";
const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

interface Props {
  itemId: string;
  itemType: ReviewItemType;
  itemName: string;
  onClose: () => void;
  onSaved?: () => void;
}

export const ReviewFormModal = ({ itemId, itemType, itemName, onClose, onSaved }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const words = countWords(comment);
  const overLimit = words > MAX_REVIEW_WORDS;

  // Load the user's existing review so they can edit it
  useEffect(() => {
    if (!user) return;
    fetchMyReview(user.id, itemId).then((r) => {
      if (r) { setRating(r.rating); setComment(r.comment || ""); setEditing(true); }
    });
  }, [user, itemId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleSubmit = async () => {
    if (!user || rating < 1 || overLimit) return;
    setSaving(true);
    try {
      const meta: any = user.user_metadata || {};
      await submitReview({
        userId: user.id, itemId, itemType, rating, comment,
        reviewerName: meta.full_name || meta.name || user.email?.split("@")[0] || "Guest",
      });
      toast({ title: editing ? "Review updated" : "Thanks for your review!" });
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast({
        title: "Couldn't save review",
        description: e?.message?.includes("row-level security")
          ? "Only guests with a completed, non-cancelled visit can review."
          : e?.message,
        variant: "destructive",
      });
    } finally { setSaving(false); }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center px-4 backdrop-blur-sm"
      style={{ background: "rgba(14,23,18,0.6)", zIndex: 2147483000 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" style={{ boxShadow: "0 24px 60px rgba(14,23,18,0.25)", fontFamily: FONT_BODY }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <div className="min-w-0">
            <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>{editing ? "Edit your review" : "Write a review"}</p>
            <p className="text-sm font-semibold truncate" style={{ color: INK, fontFamily: FONT_DISPLAY }}>{itemName}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: CANVAS }}>
            <X className="h-3.5 w-3.5" style={{ color: INK_SOFT }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-[11px] font-medium mb-2" style={{ color: INK_SOFT }}>Your rating</p>
            <div className="flex items-center gap-3">
              <StarInput value={rating} onChange={setRating} />
              {rating > 0 && <span className="text-[12px] font-semibold" style={{ color: FOREST }}>{LABELS[rating]}</span>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium" style={{ color: INK_SOFT }}>Your review (optional)</label>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: overLimit ? DANGER : INK_SOFT }}>
                {words} / {MAX_REVIEW_WORDS} words
              </span>
            </div>
            <textarea
              value={comment} onChange={(e) => setComment(e.target.value)} rows={5}
              placeholder="What did you enjoy? What should other guests know?"
              className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none resize-none"
              style={{ border: `1px solid ${overLimit ? DANGER : HAIRLINE}`, color: INK }}
            />
            {overLimit && <p className="text-[11px] mt-1" style={{ color: DANGER }}>Please keep your review to {MAX_REVIEW_WORDS} words or fewer.</p>}
          </div>

          <Button
            onClick={handleSubmit} disabled={saving || rating < 1 || overLimit}
            className="w-full py-5 rounded-xl text-sm font-semibold text-white border-none disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}
          >
            {saving ? "Saving…" : editing ? "Update review" : "Submit review"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};