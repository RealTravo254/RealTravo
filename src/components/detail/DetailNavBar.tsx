import { useEffect } from "react";
import { ArrowLeft, Heart, Share2 } from "lucide-react";

const FOREST = "#1F4D3A";
const FOREST_DEEP = "#123322";
const CLAY = "#C1552F";

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Same id as Header.tsx, so the fonts are only injected once
const useInjectFonts = () => {
  useEffect(() => {
    const id = "adventure-detail-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,600&family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
};

interface DetailNavBarProps {
  scrolled: boolean;
  itemName: string;
  isSaved: boolean;
  onSave: () => void;
  onBack: () => void;
  onShare?: () => void;
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

// Icon button, same as the main header
const iconButton = `h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-white hover:bg-white/20 active:scale-90 transition-all duration-200 ${focusRing}`;

// Labelled pill, same as the main header's "Become a host" button
const pillButton = `h-9 px-3 shrink-0 rounded-xl inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-white/15 hover:bg-white/25 active:scale-95 transition-all duration-200 ${focusRing}`;

export const DetailNavBar = ({
  scrolled,
  itemName,
  isSaved,
  onSave,
  onBack,
  onShare,
}: DetailNavBarProps) => {
  useInjectFonts();

  const saveLabel = isSaved ? "Remove from saved" : "Save";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] transition-shadow duration-300 ${
        scrolled ? "shadow-[0_6px_20px_rgba(18,51,34,0.25)]" : ""
      }`}
      style={{
        fontFamily: FONT_BODY,
        paddingTop: "env(safe-area-inset-top, 0px)",
        background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)`,
      }}
    >
      {/* py-2.5 + h-9 = 56px, matching the spacer under the bar on the detail pages */}
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Back */}
        <button onClick={onBack} className={`${iconButton} md:hidden`} aria-label="Go back">
          <ArrowLeft className="h-6 w-6 stroke-[2.5]" />
        </button>
        <button onClick={onBack} className={`${pillButton} hidden md:inline-flex`} aria-label="Go back">
          <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
          <span>Back</span>
        </button>

        {/* Title */}
        <p
          className="flex-1 min-w-0 truncate text-center text-lg text-white"
          style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          {itemName}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onShare && (
            <>
              <button onClick={onShare} className={`${iconButton} md:hidden`} aria-label="Share">
                <Share2 className="h-5 w-5" />
              </button>
              <button onClick={onShare} className={`${pillButton} hidden md:inline-flex`} aria-label="Share">
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </button>
            </>
          )}

          {/* Mobile save: icon only */}
          <button
            onClick={onSave}
            aria-label={saveLabel}
            aria-pressed={isSaved}
            className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 md:hidden ${focusRing} ${
              isSaved ? "bg-white" : "text-white hover:bg-white/20"
            }`}
          >
            <Heart
              className="h-5 w-5"
              style={isSaved ? { color: CLAY, fill: CLAY } : undefined}
            />
          </button>

          {/* Desktop save: pill with label */}
          <button
            onClick={onSave}
            aria-label={saveLabel}
            aria-pressed={isSaved}
            className={`h-9 px-3 shrink-0 rounded-xl hidden md:inline-flex items-center gap-2 text-[13px] font-semibold transition-all duration-200 active:scale-95 ${focusRing} ${
              isSaved ? "bg-white" : "text-white bg-white/15 hover:bg-white/25"
            }`}
            style={isSaved ? { color: FOREST } : undefined}
          >
            <Heart
              className="h-4 w-4"
              style={isSaved ? { color: CLAY, fill: CLAY } : undefined}
            />
            <span>{isSaved ? "Saved" : "Save"}</span>
          </button>
        </div>
      </div>
    </header>
  );
};