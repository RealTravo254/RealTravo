import { useState, useEffect } from "react";
import {
  Ticket, Heart, Phone, LogOut, User,
  Shield, ChevronRight, Briefcase, Languages, DollarSign,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useCurrency, Currency } from "@/contexts/CurrencyContext";

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used across the rest of the app:
// deep forest for structure and brand marks, a warm clay for the primary
// sign-up action.
const FOREST       = "#1F4D3A";
const FOREST_DEEP  = "#123322";
const CLAY         = "#C1552F";
const CLAY_LIGHT   = "#E0824F";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";
const DANGER       = "#9C3B2B";
const DANGER_SOFT  = "#F7E9E5";

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Injects the two typefaces once, without needing to touch the app's index.html.
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

interface NavigationDrawerProps { onClose: () => void; }

const LANGUAGES = [
  { code: "en", name: "English"    },
  { code: "fr", name: "Français"   },
  { code: "es", name: "Español"    },
  { code: "pt", name: "Português"  },
  { code: "de", name: "Deutsch"    },
  { code: "zh", name: "中文"        },
  { code: "ar", name: "العربية"    },
  { code: "he", name: "עברית"      },
];

export const NavigationDrawer = ({ onClose }: NavigationDrawerProps) => {
  useInjectFonts();

  const { user, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState(i18n.language || "en");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("first_name, name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const fname = data.first_name || data.name || "";
          setUserName(fname);
        }
      });
  }, [user]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    document.documentElement.dir = lang === "ar" || lang === "he" ? "rtl" : "ltr";
  };

  const go = (path: string, isProtected = false) => {
    onClose();
    navigate(isProtected && !user ? "/auth" : path);
  };

  const NavItem = ({
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
      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#F4F6F2] transition-colors last:border-b-0"
      style={{ borderBottom: `1px solid ${HAIRLINE}` }}
    >
      <div className="flex items-center gap-2.5">
        <Icon className="h-3.5 w-3.5" style={{ color: FOREST }} />
        <span className="text-[13px] font-medium" style={{ color: INK }}>{label}</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5" style={{ color: INK_SOFT }} />
    </button>
  );

  return (
    <div
      className="flex flex-col h-full justify-between"
      style={{
        background: "#ffffff",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        fontFamily: FONT_BODY,
      }}
    >

      {/* Scrollable Upper Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Banner */}
        <div
          className="relative px-4 pt-6 pb-4 flex-shrink-0 overflow-hidden mb-2"
          style={{ background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)` }}
        >
          <div className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full border border-white/10" />

          {user ? (
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center border border-white/15 flex-shrink-0">
                <User className="text-white h-5 w-5" />
              </div>
              <div>
                <p className="text-white font-semibold text-[13px] leading-tight">{userName || t("drawer.traveler")}</p>
              </div>
            </div>
          ) : (
            <div className="pt-0.5">
              <p className="text-[10px] font-medium text-white/50 mb-0.5">
                Welcome to
              </p>
              <h2 className="text-xl text-white tracking-tight" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", fontWeight: 600 }}>Real Travo</h2>
              <p className="text-white/60 text-[12px] mt-0.5">Travel and hosting</p>
            </div>
          )}
        </div>

        {/* Navigation items content wrapper */}
        <div className="space-y-2.5 p-2 pt-0">
          {/* Main menu */}
          <div>
            <p className="text-[10px] font-medium px-1 mb-1" style={{ color: INK_SOFT }}>
              {t("drawer.mainMenu")}
            </p>
            <div className="rounded-lg overflow-hidden bg-white" style={{ border: `1px solid ${HAIRLINE}` }}>
              <NavItem icon={Heart}     label={t("nav.wishlist")}   path="/saved"       isProtected />
              <NavItem icon={Ticket}    label={t("nav.myBookings")} path="/bookings"    isProtected />
              <NavItem icon={Briefcase} label="Become a host"       path="/become-host" isProtected />
            </div>
          </div>

          {/* Preferences */}
          <div>
            <p className="text-[10px] font-medium px-1 mb-1" style={{ color: INK_SOFT }}>
              Preferences
            </p>
            <div className="rounded-lg overflow-hidden bg-white" style={{ border: `1px solid ${HAIRLINE}` }}>
              {/* Language */}
              <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                <div className="flex items-center gap-2.5">
                  <Languages className="h-3.5 w-3.5" style={{ color: FOREST }} />
                  <span className="text-[13px] font-medium" style={{ color: INK }}>Language</span>
                </div>
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="text-[13px] font-semibold bg-transparent focus:outline-none max-w-[90px]"
                  style={{ color: INK }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>

              {/* Currency */}
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <DollarSign className="h-3.5 w-3.5" style={{ color: FOREST }} />
                  <span className="text-[13px] font-medium" style={{ color: INK }}>Currency</span>
                </div>
                <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${HAIRLINE}` }}>
                  {(["KES", "USD"] as Currency[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className="px-2.5 py-1 text-[10px] font-semibold transition-colors"
                      style={currency === c ? { background: FOREST, color: "#fff" } : { background: "#fff", color: INK_SOFT }}
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
            <p className="text-[10px] font-medium px-1 mb-1" style={{ color: INK_SOFT }}>
              Support
            </p>
            <div className="rounded-lg overflow-hidden bg-white" style={{ border: `1px solid ${HAIRLINE}` }}>
              <NavItem icon={Phone}  label="Contact support" path="/contact"        />
              <NavItem icon={Shield} label="Privacy policy"  path="/privacy-policy" />
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Actions Layer */}
      <div className="p-3 mt-auto" style={{ borderTop: `1px solid ${HAIRLINE}`, background: CANVAS }}>
        {user ? (
          <button
            onClick={() => { signOut(); onClose(); }}
            className="w-full py-2.5 flex items-center justify-center gap-2 rounded-lg font-semibold text-[13px] transition-colors active:scale-95"
            style={{ border: `1px solid ${DANGER}30`, background: DANGER_SOFT, color: DANGER }}
          >
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => go("/auth?mode=signup")}
              className="flex-1 h-9 rounded-md flex items-center justify-center gap-1 text-[12px] font-semibold text-white transition-all active:scale-95"
              style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)` }}
            >
              Sign up
            </button>
            <button
              onClick={() => go("/auth?mode=login")}
              className="flex-1 h-9 rounded-md flex items-center justify-center gap-1 text-[12px] font-semibold bg-white transition-all active:scale-95"
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