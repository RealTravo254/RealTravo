import { Home, Ticket, Heart, User, Compass, BedDouble } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used across the rest of the app:
// deep forest for structure, a warm clay for the highlighted center action.
const FOREST      = "#1F4D3A";
const FOREST_DEEP = "#123322";
const CLAY        = "#C1552F";

const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Injects the shared typeface once, without needing to touch the app's index.html.
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

export const MobileBottomBar = () => {
  useInjectFonts();

  const location = useLocation();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { t } = useTranslation();

  const navItems = [
    { icon: Home,      label: t("nav.home"),     path: "/"                  },
    { icon: BedDouble, label: "Hotels",          path: "/category/campsite" },
    { icon: Compass,   label: "Explore",          path: "/explore", isCenter: true },
    { icon: Ticket,    label: t("nav.bookings"), path: "/bookings"          },
    { icon: Heart,     label: t("nav.saved"),    path: "/saved"             },
  ];

  return (
    <div
      className={cn("md:hidden fixed bottom-0 left-0 right-0 z-[110]")}
      style={{
        background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)`,
        boxShadow: "0 -4px 20px rgba(14,23,18,0.18)",
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
        fontFamily: FONT_BODY,
      }}
    >
      <nav className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative flex flex-col items-center justify-center group"
            >
              <div
                className="p-1.5 rounded-xl transition-all duration-200 mb-0.5"
                style={
                  item.isCenter
                    ? { background: CLAY, transform: "scale(1.1)" }
                    : isActive
                    ? { background: "rgba(255,255,255,0.16)" }
                    : undefined
                }
              >
                <item.icon
                  className="h-4 w-4 transition-colors duration-200 text-white"
                  strokeWidth={isActive || item.isCenter ? 2.5 : 2}
                />
              </div>
              <span className={cn(
                "text-[9px] font-medium text-white/75",
                (isActive || item.isCenter) && "text-white font-semibold"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Profile — logged-in users navigate to /account; guests get the
            auth modal instead of being routed to a full /auth page. */}
        {user ? (
          <Link
            to="/account"
            className="relative flex flex-col items-center justify-center group"
          >
            <div
              className="p-1.5 rounded-xl transition-all duration-200 mb-0.5"
              style={location.pathname === "/account" ? { background: "rgba(255,255,255,0.16)" } : undefined}
            >
              <User
                className="h-4 w-4 text-white"
                strokeWidth={location.pathname === "/account" ? 2.5 : 2}
              />
            </div>
            <span className={cn(
              "text-[9px] font-medium text-white/75",
              location.pathname === "/account" && "text-white font-semibold"
            )}>
              {t("nav.profile")}
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => openAuthModal("login")}
            className="relative flex flex-col items-center justify-center group"
          >
            <div className="p-1.5 rounded-xl transition-all duration-200 mb-0.5">
              <User className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            <span className="text-[9px] font-medium text-white/75">
              {t("nav.login")}
            </span>
          </button>
        )}
      </nav>
    </div>
  );
};