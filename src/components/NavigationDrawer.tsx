import { useState, useEffect } from "react";
import { 
  Home, Ticket, Heart, Phone, Info, LogIn, LogOut, User, 
  FileText, Shield, ChevronRight, Trophy, Map, Mountain, Bed, Building2, Globe, Briefcase, Languages, DollarSign, Settings2, HelpCircle
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
  const { currency, setCurrency } = useCurrency();
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [language, setLanguage] = useState(i18n.language || "en");

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
      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-primary/5 transition-all duration-200 group rounded-2xl mb-1.5"
    >
      <div className="flex items-center gap-3.5">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white">
          <Icon className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
        </div>
        <span className="text-[13px] font-semibold text-foreground/80 group-hover:text-foreground">
          {label}
        </span>
      </div>
      <div className="h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-primary/5">
        <ChevronRight className="h-3 w-3 text-primary" />
      </div>
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header Profile Section */}
      <div className="bg-primary px-6 pb-12 pt-8 relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
        
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50 mb-6">
            Realtravo
          </p>

          {user ? (
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-14 w-14 rounded-2xl bg-white/20 p-0.5 backdrop-blur-md border border-white/30">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={userName}
                      className="h-full w-full object-cover rounded-[14px]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-primary-foreground/10 rounded-[14px]">
                      <span className="text-sm font-black text-white">{initials}</span>
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-400 border-2 border-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-white truncate">
                  {userName || t("drawer.traveler")}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-white/20 text-white border border-white/10">
                    Pro Member
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-2">
              <h2 className="text-2xl font-black text-white tracking-tight">Explore the <br/>Unseen.</h2>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 -mt-6 bg-background rounded-t-[32px] shadow-2xl relative z-20 overflow-y-auto">
        <div className="p-6 space-y-8">
          
          {/* Guest CTA */}
          {!user && (
            <div className="p-5 rounded-[24px] bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Personalize your journey</h3>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    Log in to unlock exclusive travel deals and seamless booking management.
                  </p>
                </div>
              </div>
              <Link
                to="/auth"
                onClick={onClose}
                className="block w-full py-3 rounded-xl text-xs font-bold text-white bg-primary shadow-md shadow-primary/20 active:scale-[0.98] transition-all text-center"
              >
                Sign In or Register
              </Link>
            </div>
          )}

          {/* Navigation Sections */}
          <div className="space-y-6">
            <section>
              <h4 className="px-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">
                Main Discovery
              </h4>
              <div className="bg-card rounded-3xl p-1.5 border border-border/40">
                <NavItem icon={Heart} label={t("nav.wishlist")} path="/saved" isProtected />
                <NavItem icon={Ticket} label={t("nav.myBookings")} path="/bookings" isProtected />
                <NavItem icon={Briefcase} label="Host your space" path="/become-host" isProtected />
              </div>
            </section>

            <section>
              <h4 className="px-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">
                Settings & Tools
              </h4>
              <div className="bg-card rounded-3xl p-1.5 border border-border/40">
                {/* Language Picker */}
                <div className="flex items-center justify-between px-4 py-3.5 mb-1.5">
                  <div className="flex items-center gap-3.5">
                    <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center">
                      <Languages className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-[13px] font-semibold text-foreground/80">Language</span>
                  </div>
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="text-[11px] font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg focus:outline-none appearance-none cursor-pointer"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.name}</option>
                    ))}
                  </select>
                </div>

                {/* Currency Picker */}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3.5">
                    <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-[13px] font-semibold text-foreground/80">Currency</span>
                  </div>
                  <div className="flex bg-muted/50 p-1 rounded-xl">
                    {["KES", "USD"].map((curr) => (
                      <button
                        key={curr}
                        onClick={() => setCurrency(curr)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          currency === curr ? "bg-white shadow-sm text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {curr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h4 className="px-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">
                Support
              </h4>
              <div className="bg-card rounded-3xl p-1.5 border border-border/40">
                <NavItem icon={HelpCircle} label="Help Center" path="/contact" />
                <NavItem icon={Shield} label="Privacy Policy" path="/privacy-policy" />
              </div>
            </section>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 pb-8 px-2">
            {user ? (
              <button
                onClick={() => { signOut(); onClose(); }}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-destructive/5 hover:bg-destructive/10 text-destructive transition-colors border border-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Log Out</span>
              </button>
            ) : (
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Version 2.0.1 • Realtravo Inc.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};