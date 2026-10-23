import { MessageCircle } from "lucide-react";

const CLAY = "#C1552F";
const CLAY_LIGHT = "#E0824F";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

interface FloatingInquiryButtonProps {
  onClick: () => void;
  label?: string;
}

/**
 * Floating chat button, fixed at the bottom-right of the screen.
 * - Mobile: sits above the sticky bottom booking bar (so it never covers it).
 * - Desktop: sits 24px from the bottom-right corner.
 * Sits below the gallery / map modals (z-200+) but above page content.
 */
export const FloatingInquiryButton = ({
  onClick,
  label = "Inquire now",
}: FloatingInquiryButtonProps) => (
  <>
    <style>{`
      .floating-inquiry-btn {
        position: fixed;
        right: 16px;
        bottom: calc(92px + env(safe-area-inset-bottom, 0px));
        z-index: 99;
      }
      @media (min-width: 768px) {
        .floating-inquiry-btn {
          right: 24px;
          bottom: 24px;
        }
      }
      @keyframes floating-inquiry-pulse {
        0%   { box-shadow: 0 8px 24px rgba(193,85,47,0.35), 0 0 0 0 rgba(193,85,47,0.35); }
        70%  { box-shadow: 0 8px 24px rgba(193,85,47,0.35), 0 0 0 12px rgba(193,85,47,0); }
        100% { box-shadow: 0 8px 24px rgba(193,85,47,0.35), 0 0 0 0 rgba(193,85,47,0); }
      }
      .floating-inquiry-btn button {
        animation: floating-inquiry-pulse 2.4s ease-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .floating-inquiry-btn button { animation: none; }
      }
    `}</style>
    <div className="floating-inquiry-btn">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flex items-center gap-2 rounded-full text-white text-[13px] font-semibold px-4 py-3 transition-transform active:scale-95 hover:scale-105"
        style={{
          background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)`,
          fontFamily: FONT_BODY,
          border: "none",
          cursor: "pointer",
        }}
      >
        <MessageCircle className="h-5 w-5" />
        {label}
      </button>
    </div>
  </>
);

export default FloatingInquiryButton;