import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Menu, Heart, Ticket, Home, User, Search, Compass, Briefcase } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NavigationDrawer } from "./NavigationDrawer";
import { Link, useNavigate } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";
import { AccountSheet } from "./AccountSheet";

export interface HeaderProps {
  onSearchClick?: () => void;
  showSearchIcon?: boolean;
  className?: string;
  hideIcons?: boolean;
  __fromLayout?: boolean;
}

export const Header = ({ onSearchClick, showSearchIcon = true, className, __fromLayout }: HeaderProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      const { error } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
      if (error) console.error("Error fetching profile:", error.message);
    };
    fetchUserProfile();
  }, [user]);

  if (!__fromLayout) return null;

  const headerIconStyles =
    "h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 text-white hover:bg-white/20";

  return (
    <header
      className={`z-[100] items-center fixed top-0 left-0 right-0 flex py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:bg-[#008080] transition-colors duration-300 ${className || ""}`}
    >
      <div className="container mx-auto px-4 flex items-center justify-between h-full">

        {/* Left — hamburger + logo */}
        <div className="flex items-center gap-2">
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <button className={headerIconStyles} aria-label="Open Menu">
                <Menu className="h-6 w-6 stroke-[2.5]" />
              </button>
            </SheetTrigger>

            {/* 80 % of viewport width, capped at 320 px — matches Index.tsx */}
            <SheetContent side="left" className="w-[80vw] max-w-sm p-0 h-screen border-none">
              <NavigationDrawer onClose={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center gap-2 group ml-1">
            <span className="font-bold text-lg tracking-tight italic text-white hidden md:inline">
              RealTravo
            </span>
          </Link>
        </div>

        {/* Center nav — desktop only */}
        <nav className="hidden lg:flex items-center gap-6">
          {[
            { to: "/",        icon: <Home    className="h-4 w-4" />, label: t("nav.home")     },
            { to: "/explore", icon: <Compass className="h-4 w-4" />, label: "Explore"          },
            { to: "/bookings",icon: <Ticket  className="h-4 w-4" />, label: t("nav.bookings") },
            { to: "/saved",   icon: <Heart   className="h-4 w-4" />, label: t("nav.wishlist") },
          ].map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/80 hover:text-white transition-colors"
            >
              {item.icon}<span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Right — actions */}
        <div className="flex items-center gap-2">

          {/* Search — only after scroll */}
          {showSearchIcon && hasScrolled && (
            <button
              onClick={() => navigate("/explore")}
              className={`${headerIconStyles} animate-in fade-in zoom-in duration-300`}
              aria-label="Explore"
            >
              <Search className="h-5 w-5" />
            </button>
          )}

          {/* Become Host — desktop only, navigates directly */}
          <button
            onClick={() => navigate("/become-host")}
            className="hidden md:flex h-9 px-3 rounded-xl items-center gap-2 transition-all font-semibold text-xs text-white bg-white/20 hover:bg-white/30 active:scale-95"
          >
            <Briefcase className="h-4 w-4" /><span>Become Host</span>
          </button>

          {/* NotificationBell — desktop only */}
          <div className="hidden md:flex [&_button]:text-white [&_button]:h-9 [&_button]:w-9">
            <NotificationBell />
          </div>

          {/* Account — desktop only */}
          {user ? (
            <AccountSheet>
              <button className="hidden md:flex h-9 px-4 rounded-xl items-center gap-2 transition-all font-semibold text-xs text-[#008080] bg-white hover:brightness-95">
                <User className="h-4 w-4" /><span>{t("nav.profile")}</span>
              </button>
            </AccountSheet>
          ) : (
            <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
              <PopoverTrigger asChild>
                <button className="hidden md:flex h-9 px-4 rounded-xl items-center gap-2 transition-all font-semibold text-xs text-[#008080] bg-white hover:brightness-95">
                  <User className="h-4 w-4" /><span>{t("nav.login")}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4" align="end">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Welcome to RealTravo!</p>
                  <p className="text-xs text-muted-foreground">
                    Log in or create an account to save items, book trips, and more.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setAccountPopoverOpen(false); navigate("/auth"); }}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                      style={{ backgroundColor: "#008080" }}
                    >
                      Sign Up
                    </button>
                    <button
                      onClick={() => { setAccountPopoverOpen(false); navigate("/auth"); }}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-foreground transition-all active:scale-95 hover:bg-slate-50"
                    >
                      Log In
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </header>
  );
};