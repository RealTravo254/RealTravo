import { useState } from "react";
import { Star } from "lucide-react";
import { useItemRating } from "@/hooks/useItemRating";

const GOLD = "#B98A2A";
const INK = "#1C2B22";
const INK_SOFT = "#5B6B60";
const HAIRLINE = "#DCE3DC";

export const StarDisplay = ({ value, size = 14 }: { value: number; size?: number }) => (
  <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        style={{
          width: size, height: size, color: value >= i - 0.5 ? GOLD : HAIRLINE,
          fill: value >= i - 0.5 ? GOLD : "transparent",
        }}
      />
    ))}
  </div>
);

export const StarInput = ({ value, onChange, size = 32 }: { value: number; onChange: (v: number) => void; size?: number }) => {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i} type="button" aria-label={`${i} star${i > 1 ? "s" : ""}`}
          onClick={() => onChange(i)} onMouseEnter={() => setHover(i)}
          className="transition-transform active:scale-90 hover:scale-110"
        >
          <Star style={{ width: size, height: size, color: shown >= i ? GOLD : HAIRLINE, fill: shown >= i ? GOLD : "transparent" }} />
        </button>
      ))}
    </div>
  );
};

// Compact "★ 4.6 (23 reviews)" link used under page titles. Renders nothing if no reviews.
export const RatingBadge = ({ itemId }: { itemId: string }) => {
  const { avg, count } = useItemRating(itemId);
  if (!count) return null;
  return (
    <a
      href="#reviews"
      onClick={(e) => { e.preventDefault(); document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
      className="inline-flex items-center gap-1.5 mt-2"
      style={{ color: INK }}
    >
      <Star style={{ width: 15, height: 15, color: GOLD, fill: GOLD }} />
      <span className="text-[14px] font-semibold tabular-nums">{avg.toFixed(1)}</span>
      <span className="text-[13px] underline underline-offset-2" style={{ color: INK_SOFT }}>
        {count} review{count !== 1 ? "s" : ""}
      </span>
    </a>
  );
};