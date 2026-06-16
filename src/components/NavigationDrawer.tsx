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
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors border-b border-border/50 last:border-b-0"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Header / profile banner ── */}
      <div
        className="relative px-5 pt-10 pb-6 flex-shrink-0 overflow-hidden"
        style={{ background: "linear-gradient(135deg,#008080 0%,#005f5f 100%)" }}
      >
        {/* Decorative rings */}
        <div className="pointer-events-none absolute -top-6 -right-6 h-28 w-28 rounded-full border-[3px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full border-[2px] border-white/10" />

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="absolute top-4 right-4 h-7 w-7 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-white" />
        </button>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden border border-white/20 flex-shrink-0">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="h-full w-full object-cover" />
              ) : (
                <User className="text-white h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-white font-black text-sm">{userName || t("drawer.traveler")}</p>
            </div>
          </div>
        ) : (
          <div className="pt-1">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-1">
              Welcome to
            </p>
            <h2 className="text-2xl font-black text-white tracking-tight italic">Real Travo</h2>
            <p className="text-white/60 text-xs mt-0.5">Travel and Hosting</p>
          </div>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto bg-background">

        {/* Login CTA for guests */}
        {!user && (
          <div className="px-3 pt-3 pb-1">
            <div className="flex gap-2">
              <button
                onClick={() => go("/auth?mode=signup")}
                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg,#008080 0%,#005f5f 100%)" }}
              >
                Sign Up
              </button>
              <button
                onClick={() => go("/auth?mode=login")}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-border text-foreground hover:bg-muted transition-all active:scale-95"
              >
                Log In
              </button>
            </div>
          </div>
        )}

        {/* Main menu */}
        <div className="p-2 pt-3">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] px-2 mb-1.5">
            {t("drawer.mainMenu")}
          </p>
          <div className="rounded-xl border overflow-hidden bg-card">
            <NavItem icon={Heart}     label={t("nav.wishlist")}   path="/saved"       isProtected />
            <NavItem icon={Ticket}    label={t("nav.myBookings")} path="/bookings"    isProtected />
            <NavItem icon={Briefcase} label="Become a Host"       path="/become-host" isProtected />
          </div>
        </div>

        {/* Preferences */}
        <div className="p-2">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] px-2 mb-1.5">
            Preferences
          </p>
          <div className="rounded-xl border overflow-hidden bg-card divide-y divide-border/50">
            {/* Language */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Languages className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Language</span>
              </div>
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="text-xs font-bold bg-transparent focus:outline-none text-foreground max-w-[100px]"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Currency */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Currency</span>
              </div>
              <div className="flex border border-border rounded-lg overflow-hidden">
                {(["KES", "USD"] as Currency[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`px-3 py-1 text-[10px] font-black transition-colors ${
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
        <div className="p-2">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] px-2 mb-1.5">
            Support
          </p>
          <div className="rounded-xl border overflow-hidden bg-card">
            <NavItem icon={Phone}  label="Contact Support" path="/contact"        />
            <NavItem icon={Shield} label="Privacy Policy"  path="/privacy-policy" />
          </div>
        </div>

        {/* Sign out */}
        {user && (
          <div className="p-3 pb-6">
            <button
              onClick={() => { signOut(); onClose(); }}
              className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border border-destructive text-destructive font-bold text-sm hover:bg-destructive/5 transition-colors active:scale-95"
            >
              <LogOut className="h-4 w-4" /> Log Out
            </button>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
};