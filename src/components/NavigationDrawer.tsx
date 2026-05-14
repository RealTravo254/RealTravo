import { useState, useEffect } from "react";
import { 
  Ticket, Heart, Phone, Info, LogIn, LogOut, User, 
  FileText, Shield, ChevronRight, Briefcase, Languages, DollarSign
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";

interface NavigationDrawerProps { onClose: () => void; }

const LANGUAGES = [
  { code: "en", name: "English" }, { code: "fr", name: "Français" },
  { code: "es", name: "Español" }, { code: "pt", name: "Português" },
  { code: "de", name: "Deutsch" }, { code: "zh", name: "中文" },
  { code: "ar", name: "العربية" }, { code: "he", name: "עברית" },
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
      const { data: profile } = await supabase.from("profiles").select("name, profile_picture_url").eq("id", user.id).single();
      if (profile) { setUserName(profile.name || ""); setUserAvatar(profile.profile_picture_url || null); }
    };
    fetchUserData();
  }, [user]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang); i18n.changeLanguage(lang);
    document.documentElement.dir = (lang === "ar" || lang === "he") ? "rtl" : "ltr";
  };

  const NavItem = ({ icon: Icon, label, path, isProtected = false }: any) => (
    <button onClick={() => { window.location.href = isProtected && !user ? "/auth" : path; onClose(); }} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors border-b border-border/50">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary p-6">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden border border-white/10">
              {userAvatar ? <img src={userAvatar} alt={userName} className="h-full w-full object-cover" /> : <User className="text-white h-6 w-6" />}
            </div>
            <div>
              <p className="text-white font-bold">{userName || t("drawer.traveler")}</p>
              <p className="text-white/70 text-xs uppercase tracking-tight">Verified Member</p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Realtravo</h2>
            <p className="text-white/70 text-sm">Travel and Hosting</p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!user && (
          <div className="p-4 border-b">
            <Link to="/auth" onClick={onClose} className="block w-full py-3 bg-primary text-white text-center rounded-lg font-bold text-sm">
              Login / Register
            </Link>
          </div>
        )}

        <div className="p-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase p-2 tracking-widest">{t("drawer.mainMenu")}</p>
          <div className="rounded-lg border overflow-hidden">
            <NavItem icon={Heart} label={t("nav.wishlist")} path="/saved" isProtected />
            <NavItem icon={Ticket} label={t("nav.myBookings")} path="/bookings" isProtected />
            <NavItem icon={Briefcase} label="Become a Host" path="/become-host" isProtected />
          </div>
        </div>

        <div className="p-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase p-2 tracking-widest">Preferences</p>
          <div className="rounded-lg border overflow-hidden divide-y">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3"><Languages className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Language</span></div>
              <select value={language} onChange={(e) => handleLanguageChange(e.target.value)} className="text-sm font-bold bg-transparent focus:outline-none">
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3"><DollarSign className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Currency</span></div>
              <div className="flex border rounded-md overflow-hidden">
                {["KES", "USD"].map((c) => (
                  <button key={c} onClick={() => setCurrency(c)} className={`px-3 py-1 text-[10px] font-bold ${currency === c ? "bg-primary text-white" : "bg-white text-black"}`}>{c}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase p-2 tracking-widest">Support</p>
          <div className="rounded-lg border overflow-hidden">
            <NavItem icon={Phone} label="Contact Support" path="/contact" />
            <NavItem icon={Shield} label="Privacy Policy" path="/privacy-policy" />
          </div>
        </div>

        {user && (
          <div className="p-4">
            <button onClick={() => { signOut(); onClose(); }} className="w-full py-3 flex items-center justify-center gap-2 rounded-lg border border-destructive text-destructive font-bold text-sm">
              <LogOut className="h-4 w-4" /> Log Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};