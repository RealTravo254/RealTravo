import { useEffect } from "react";
import { ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";

const FOREST = "#1F4D3A";
const FOREST_DEEP = "#123322";

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

interface PageHeaderProps {
  title: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  backgroundImage?: string;
  /** Small trail shown above the title in the minimal variant. Pass "" to hide it. */
  parentLabel?: string;
}

const pill =
  "h-9 px-3 rounded-xl inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-white/15 hover:bg-white/25 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

export const PageHeader = ({
  title,
  showBackButton = true,
  showHomeButton = true,
  backgroundImage,
  parentLabel = "Explore",
}: PageHeaderProps) => {
  useInjectFonts();
  const navigate = useNavigate();
  const goBack = useSafeBack();

  const backButton = showBackButton && (
    <button onClick={goBack} className={pill} aria-label="Go back">
      <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
      <span>Back</span>
    </button>
  );

  const homeButton = showHomeButton && (
    <button onClick={() => navigate("/")} className={pill} aria-label="Go to home">
      <Home className="h-4 w-4" />
      <span>Home</span>
    </button>
  );

  // WITH BACKGROUND IMAGE
  if (backgroundImage) {
    return (
      <div
        className="relative h-52 md:h-64 rounded-3xl overflow-hidden mb-8"
        style={{
          fontFamily: FONT_BODY,
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Forest wash: light in the middle so the photo shows, deep at the edges for legibility */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${FOREST_DEEP}B3 0%, ${FOREST_DEEP}26 45%, ${FOREST_DEEP}E6 100%)`,
          }}
        />

        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <div>{backButton}</div>
          <div>{homeButton}</div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
          <h1
            className="text-3xl md:text-5xl text-white leading-tight"
            style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, letterSpacing: "-0.01em" }}
          >
            {title}
          </h1>
        </div>
      </div>
    );
  }

  // MINIMAL
  return (
    <div
      className="relative flex items-center justify-between gap-4 mb-8 rounded-2xl px-4 py-4 md:px-6 md:py-5"
      style={{
        fontFamily: FONT_BODY,
        background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)`,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {showBackButton && (
          <button
            onClick={goBack}
            aria-label="Go back"
            className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-white hover:bg-white/20 active:scale-90 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
          </button>
        )}
        <div className="min-w-0">
          {parentLabel && (
            <p className="text-[13px] font-medium text-white/70 leading-none mb-1">{parentLabel}</p>
          )}
          <h1
            className="text-2xl md:text-3xl text-white truncate"
            style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, letterSpacing: "-0.01em" }}
          >
            {title}
          </h1>
        </div>
      </div>

      {homeButton}
    </div>
  );
};