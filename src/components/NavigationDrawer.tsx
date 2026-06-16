import { useState, useEffect } from "react";
import {
  Ticket, Heart, Phone, LogOut, User,
  Shield, ChevronRight, Briefcase, Languages, DollarSign, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useCurrency, Currency } from "@/contexts/CurrencyContext";

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
  const { user, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  const navigate = useNavigate();
  const [userName, setUserName]     = useState("");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [language, setLanguage]     = useState(i18n.language || "en");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name, profile_picture_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserName(data.name || "");
          setUserAvatar(data.profile_picture_url || null);
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
      className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted transition-colors border-b border-border/40 last:border-b-0"
    >
      <div className="flex items-center gap-2.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Compact Header / Profile Banner ── */}
      <div
        className="relative px-4 pt-6 pb-4 flex-shrink-0 overflow-hidden"
        style={{ background: "linear-gradient(135deg,#008080 0%,#005f5f 100%)" }}
      >
        {/* Decorative rings simplified */}
        <div className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full border border-white/10" />

        {/* Single Close button */}
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="absolute top-3 right-3 h-6 w-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/25 transition-colors"
        >
          <X className="h-3 w-3 text-white" />
        </button>

        {user ? (
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden border border-white/15 flex-shrink-0">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="h-full w-full object-cover" />
              ) : (
                <User className="text-white h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-white font-extrabold text-xs leading-tight">{userName || t("drawer.traveler")}</p>
            </div>
          </div>
        ) : (
          <div className="pt-0.5">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mb-0.5">
              Welcome to
            </p>
            <h2 className="text-xl font-black text-white tracking-tight italic">Real Travo</h2>
            <p className="text-white/60 text-[11px] mt-0.5">Travel and Hosting</p>
          </div>
        )}
      </div>

      {/* ── Tight Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto bg-background space-y-2.5 p-2">

        {/* Login CTA for guests */}
        {!user && (
          <div className="px-1 pt-1">
            <div className="flex gap-1.5">
              <button
                onClick={() => go("/auth?mode=signup")}
                className="flex-1 py-2 rounded-lg text-xs font-black text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg,#008080 0%,#005f5f 100%)" }}
              >
                Sign Up
              </button>
              <button
                onClick={() => go("/auth?mode=login")}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-border text-foreground hover:bg-muted transition-all active:scale-95"
              >
                Log In
              </button>
            </div>
          </div>
        )}

        {/* Main menu */}
        <div>
          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.18em] px-1 mb-0.5">
            {t("drawer.mainMenu")}
          </p>
          <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
            <NavItem icon={Heart}     label={t("nav.wishlist")}   path="/saved"       isProtected />
            <NavItem icon={Ticket}    label={t("nav.myBookings")} path="/bookings"    isProtected />
            <NavItem icon={Briefcase} label="Become a Host"       path="/become-host" isProtected />
          </div>
        </div>

        {/* Preferences */}
        <div>
          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.18em] px-1 mb-0.5">
            Preferences
          </p>
          <div className="rounded-lg border border-border/60 overflow-hidden bg-card divide-y divide-border/40">
            {/* Language */}
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2.5">
                <Languages className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">Language</span>
              </div>
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="text-xs font-bold bg-transparent focus:outline-none text-foreground max-w-[90px]"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Currency */}
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2.5">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">Currency</span>
              </div>
              <div className="flex border border-border rounded-md overflow-hidden">
                {(["KES", "USD"] as Currency[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`px-2 py-0.5 text-[9px] font-black transition-colors ${
                      currency === c
                        ? "bg-primary text-white"
                        : "bg-background text-foreground hover:bg-muted"
                    }`}
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
          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.18em] px-1 mb-0.5">
            Support
          </p>
          <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
            <NavItem icon={Phone}  label="Contact Support" path="/contact"        />
            <NavItem icon={Shield} label="Privacy Policy"  path="/privacy-policy" />
          </div>
        </div>

        {/* Sign out */}
        {user && (
          <div className="pt-1">
            <button
              onClick={() => { signOut(); onClose(); }}
              className="w-full py-2 flex items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive font-bold text-xs hover:bg-destructive/10 transition-colors active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" /> Log Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};