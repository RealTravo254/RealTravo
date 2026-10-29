import {
  Heart,
  Ticket,
  MessageCircle,
  UserRound,
  Briefcase,
  Languages,
  DollarSign,
  Phone,
  Shield,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useCurrency, Currency } from "@/contexts/CurrencyContext";

// Change this if your profile page lives on a different route.
const PROFILE_PATH = "/profile";

// ── Design tokens ─────────────────────────────────────────────────────────
const FOREST = "#1F4D3A";
const FOREST_DEEP = "#123322";
const CLAY = "#C1552F";
const CLAY_LIGHT = "#E0824F";
const INK = "#1C2B22";
const INK_SOFT = "#5B6B60";
const HAIRLINE = "#E3E9E3";
const CANVAS = "#F4F6F2";
const DANGER = "#9C3B2B";
const DANGER_SOFT = "#F7E9E5";

const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

interface NavigationDrawerProps {
  onClose: () => void;
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "de", name: "Deutsch" },
  { code: "zh", name: "中文" },
  { code: "ar", name: "العربية" },
  { code: "he", name: "עברית" },
];

export const NavigationDrawer = ({ onClose }: NavigationDrawerProps) => {
  const { user, signOut } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { t, i18n } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  const navigate = useNavigate();
  const [language, setLanguage] = useState(i18n.language || "en");

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    document.documentElement.dir = lang === "ar" || lang === "he" ? "rtl" : "ltr";
  };

  const go = (path: string, isProtected = false) => {
    onClose();
    if (isProtected && !user) {
      openAuthModal("login");
      return;
    }
    navigate(path);
  };

  const TILES = [
    { icon: UserRound, label: t("nav.profile", "Profile"), path: PROFILE_PATH, tint: "#E6F0EA" },
    { icon: MessageCircle, label: t("nav.messages", "Messages"), path: "/messages", tint: "#E8EEF8" },
    { icon: Ticket, label: t("nav.myBookings", "Bookings"), path: "/bookings", tint: "#F8EFE3" },
    { icon: Heart, label: t("nav.wishlist", "Wishlist"), path: "/saved", tint: "#F8E7E5" },
  ];

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <p
      className="px-1 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ color: INK_SOFT }}
    >
      {children}
    </p>
  );

  const Row = ({
    icon: Icon,
    label,
    path,
    isProtected = false,
  }: {
    icon: React.ElementType;
    label: string;
    path: string;
    isProtected?: boolean;
  }) => (
    <button
      onClick={() => go(path, isProtected)}
      className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F4F6F2] active:bg-[#EAEFEA] transition-colors"
      style={{ borderBottom: `1px solid ${HAIRLINE}` }}
    >
      <div className="flex items-center gap-3">
        <span
          className="h-8 w-8 rounded-full flex items-center justify-center"
          style={{ background: CANVAS }}
        >
          <Icon className="h-4 w-4" style={{ color: FOREST }} />
        </span>
        <span className="text-[13px] font-semibold" style={{ color: INK }}>
          {label}
        </span>
      </div>
      <ChevronRight className="h-4 w-4" style={{ color: INK_SOFT }} />
    </button>
  );

  return (
    <div
      className="flex flex-col max-h-[calc(100vh-6rem)]"
      style={{ background: "#ffffff", fontFamily: FONT_BODY }}
    >
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Quick tiles */}
        <div className="grid grid-cols-2 gap-2.5">
          {TILES.map(({ icon: Icon, label, path, tint }) => (
            <button
              key={path}
              onClick={() => go(path, true)}
              className="flex items-center gap-2.5 rounded-2xl p-3 text-left transition-all active:scale-[0.97] hover:shadow-md"
              style={{ border: `1px solid ${HAIRLINE}`, background: "#fff" }}
            >
              <span
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: tint }}
              >
                <Icon className="h-[18px] w-[18px]" style={{ color: FOREST }} />
              </span>
              <span className="text-[13px] font-semibold leading-tight" style={{ color: INK }}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Host */}
        <div>
          <SectionTitle>Hosting</SectionTitle>
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${HAIRLINE}` }}>
            <Row icon={Briefcase} label="Become a host" path="/become-host" isProtected />
          </div>
        </div>

        {/* Preferences */}
        <div>
          <SectionTitle>Preferences</SectionTitle>
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${HAIRLINE}` }}>
            <div
              className="flex items-center justify-between px-3 py-3"
              style={{ borderBottom: `1px solid ${HAIRLINE}` }}
            >
              <div className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: CANVAS }}>
                  <Languages className="h-4 w-4" style={{ color: FOREST }} />
                </span>
                <span className="text-[13px] font-semibold" style={{ color: INK }}>
                  Language
                </span>
              </div>
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="text-[13px] font-semibold bg-transparent focus:outline-none max-w-[100px] cursor-pointer"
                style={{ color: INK }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between px-3 py-3">
              <div className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: CANVAS }}>
                  <DollarSign className="h-4 w-4" style={{ color: FOREST }} />
                </span>
                <span className="text-[13px] font-semibold" style={{ color: INK }}>
                  Currency
                </span>
              </div>
              <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${HAIRLINE}` }}>
                {(["KES", "USD"] as Currency[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className="px-3 py-1.5 text-[11px] font-bold transition-colors"
                    style={
                      currency === c
                        ? { background: FOREST, color: "#fff" }
                        : { background: "#fff", color: INK_SOFT }
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Support */}
        <div>
          <SectionTitle>Support</SectionTitle>
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${HAIRLINE}` }}>
            <Row icon={Phone} label="Contact support" path="/contact" />
            <Row icon={Shield} label="Privacy policy" path="/privacy-policy" />
          </div>
        </div>
      </div>

      {/* Fixed bottom actions */}
      <div className="p-3" style={{ borderTop: `1px solid ${HAIRLINE}`, background: CANVAS }}>
        {user ? (
          <button
            onClick={() => {
              signOut();
              onClose();
            }}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-xl font-semibold text-[13px] transition-transform active:scale-95"
            style={{ border: `1px solid ${DANGER}30`, background: DANGER_SOFT, color: DANGER }}
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                onClose();
                openAuthModal("signup");
              }}
              className="flex-1 h-10 rounded-xl flex items-center justify-center text-[13px] font-semibold text-white transition-transform active:scale-95"
              style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)` }}
            >
              Sign up
            </button>
            <button
              onClick={() => {
                onClose();
                openAuthModal("login");
              }}
              className="flex-1 h-10 rounded-xl flex items-center justify-center text-[13px] font-semibold bg-white transition-transform active:scale-95"
              style={{ border: `1px solid ${HAIRLINE}`, color: INK }}
            >
              Log in
            </button>
          </div>
        )}
      </div>
    </div>
  );
};