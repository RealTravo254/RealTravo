import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Menu, Heart, Ticket, Home, User, Search, Compass, Briefcase, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavigationDrawer } from "./NavigationDrawer";
import { Link, useNavigate } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";

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
  const [hasScrolled, setHasScrolled] = useState(false);
  const [firstName, setFirstName] = useState<string>("");

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        setFirstName("");
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error.message);
        return;
      }

      if (data) {
        const fname = data.first_name || (data.name ? data.name.split(" ")[0] : "");
        setFirstName(fname);
      }
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
            <SheetContent
              side="left"
              className="w-[80vw] max-w-[320px] p-0 h-screen border-none"
            >
              <NavigationDrawer onClose={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center gap-2 group ml-1">
            <span className="font-bold text-lg tracking-tight italic text-white hidden md:inline">
              Real Travo
            </span>
          </Link>
        </div>

        {/* Center nav — desktop only */}
        <nav className="hidden lg:flex items-center gap-6">
          {[
            { to: "/",         icon: <Home     className="h-4 w-4" />, label: t("nav.home")     },
            { to: "/explore",  icon: <Compass className="h-4 w-4" />, label: "Explore"          },
            { to: "/bookings", icon: <Ticket  className="h-4 w-4" />, label: t("nav.bookings") },
            { to: "/saved",    icon: <Heart   className="h-4 w-4" />, label: t("nav.saved")    },
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

          {/* Become Host — desktop only */}
          <button
            onClick={() => navigate("/become-host")}
            className="hidden md:flex h-9 px-3 rounded-xl items-center gap-2 transition-all font-semibold text-xs text-white bg-white/20 hover:bg-white/30 active:scale-95"
          >
            <Briefcase className="h-4 w-4" /><span>Become Host</span>
          </button>

          {/* NotificationBell — desktop only */}
          <div className="hidden md:flex [&_button]:text-white [&_button]:h-9 [&_button]:w-9 [&_[data-radix-popper-content-wrapper]]:!max-w-[320px]">
            <NotificationBell />
          </div>

          {/* Account Link with Icon, Text & Dropdown Arrow */}
          <div
            onClick={() => navigate(user ? "/account" : "/auth")}
            className="hidden md:flex items-center gap-1.5 cursor-pointer text-white/90 hover:text-white transition-colors py-1 px-2"
          >
            <User className="h-4 w-4" />
            <span className="text-xs font-semibold max-w-[100px] truncate">
              {user ? (firstName || t("nav.profile")) : "Guest"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          </div>
        </div>
      </div>
    </header>
  );
};