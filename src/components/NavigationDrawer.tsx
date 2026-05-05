import { useState, useEffect } from "react";
import { 
  Home, Ticket, Heart, Phone, Info, LogIn, LogOut, User, 
  FileText, Shield, ChevronRight, Trophy, Map, Mountain, Bed, Building2, Globe, Briefcase, Languages, DollarSign
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Capacitor } from '@capacitor/core';

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
  const { t, i18n } = useTranslation();
  const { currency, setCurrency, rate, loading: rateLoading } = useCurrency();
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [language, setLanguage] = useState(i18n.language || "en");
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, profile_picture_url")
        .eq("id", user.id)
        .single();
      if (profile) {
        setUserName(profile.name || "");
        setUserAvatar(profile.profile_picture_url || null);
      }
    };
    fetchUserData();
  }, [user]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    document.documentElement.dir = (lang === "ar" || lang === "he") ? "rtl" : "ltr";
  };

  const handleProtectedNavigation = (path: string) => {
    window.location.href = user ? path : "/auth";
    onClose();
  };

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const NavItem = ({ icon: Icon, label, path, isProtected = false }: any) => (
    <button
      onClick={() =>
        isProtected
          ? handleProtectedNavigation(path)
          : (window.location.href = path, onClose())
      }
      className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/60 transition-colors group"
    >
      <div className="flex items-center gap-2.5">
        <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-3 w-3 text-primary" />
        </div>
        <span className="text-xs font-medium text-foreground">{label}</span>
      </div>
      <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
    </button>
  );

  return (
    <div
      className="flex flex-col h-full bg-primary"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Brand Header — no close button here; SheetContent provides one */}
      <div className="px-4 pt-4 pb-4 relative flex-shrink-0">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary-foreground/40 mb-0.5">
          Realtravo
        </p>

        {/* User info */}
        {user ? (
          <div className="flex items-center gap-2.5 mt-2">
            <div className="relative flex-shrink-0">
              <div className="h-10 w-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center overflow-hidden border border-primary-foreground/20">
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={userName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xs font-black text-primary-foreground">{initials}</span>
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 border-[1.5px] border-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-primary-foreground truncate leading-tight">
                {userName || t("drawer.traveler")}
              </p>
              <span className="inline-block mt-0.5 px-1.5 py-px rounded-full text-[9px] font-black uppercase tracking-wider bg-primary-foreground/15 text-primary-foreground/55">
                Member
              </span>
            </div>
          </div>
        ) : (
          <h2 className="text-lg font-extrabold text-primary-foreground mt-0.5">Welcome</h2>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-background rounded-t-3xl">
        <div className="py-2.5 px-2.5 space-y-2.5">

          {/* Not logged in CTA */}
          {!user && (
            <div className="flex flex-col items-center py-6 px-4">
              <div className="relative mb-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow">
                  <LogIn className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-sm font-extrabold text-foreground mb-1 text-center">Join Realtravo</h3>
              <p className="text-xs text-muted-foreground text-center mb-5 max-w-[200px] leading-relaxed">
                Log in to manage bookings, save favourites, and become a host.
              </p>
              <Link
                to="/auth"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 active:scale-95 transition-all text-center"
              >
                Login / Register
              </Link>
            </div>
          )}

          {/* Main Menu */}
          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.22em] px-1 mb-1">
              {t("drawer.mainMenu")}
            </p>
            <div className="rounded-xl overflow-hidden border border-border bg-card divide-y divide-border/50">
              <NavItem icon={Heart}    label={t("nav.wishlist")}   path="/saved"        isProtected />
              <NavItem icon={Ticket}   label={t("nav.myBookings")} path="/bookings"     isProtected />
              <NavItem icon={Briefcase} label="Host"               path="/become-host"  isProtected />
            </div>
          </div>

          {/* Support & Legal */}
          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.22em] px-1 mb-1">
              {t("drawer.supportLegal")}
            </p>
            <div className="rounded-xl overflow-hidden border border-border bg-card divide-y divide-border/50">
              <NavItem icon={Phone}    label={t("drawer.contact")} path="/contact" />
              <NavItem icon={Info}     label={t("drawer.about")}   path="/about" />
              <NavItem icon={FileText} label={t("drawer.terms")}   path="/terms-of-service" />
              <NavItem icon={Shield}   label={t("drawer.privacy")} path="/privacy-policy" />
            </div>
          </div>

          {/* Preferences */}
          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.22em] px-1 mb-1">
              Preferences
            </p>
            <div className="rounded-xl overflow-hidden border border-border bg-card divide-y divide-border/50">
              {/* Language */}
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Languages className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {LANGUAGES.find((l) => l.code === language)?.name || "English"}
                  </span>
                </div>
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="text-[10px] font-medium text-muted-foreground bg-transparent focus:outline-none cursor-pointer"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>

              {/* Currency */}
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{currency}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrency("KES")}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      currency === "KES"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    KES
                  </button>
                  <button
                    onClick={() => setCurrency("USD")}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      currency === "USD"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    USD
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Log Out */}
          {user && (
            <button
              onClick={() => { signOut(); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors group"
            >
              <div className="h-6 w-6 rounded-md bg-destructive/10 group-hover:bg-destructive flex items-center justify-center flex-shrink-0 transition-colors">
                <LogOut className="h-3 w-3 text-destructive group-hover:text-destructive-foreground transition-colors" />
              </div>
              <span className="text-xs font-semibold text-destructive">Log Out</span>
            </button>
          )}

          <div className="h-1" />
        </div>
      </div>
    </div>
  );
};