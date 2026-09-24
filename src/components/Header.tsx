import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Menu, Heart, Ticket, Home, User, Search, Compass, Briefcase, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavigationDrawer } from "./NavigationDrawer";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";

const FOREST      = "#1F4D3A";
const FOREST_DEEP = "#123322";

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

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

export interface HeaderProps {
  onSearchClick?: () => void;
  showSearchIcon?: boolean;
  className?: string;
  hideIcons?: boolean;
  __fromLayout?: boolean;
}

export const Header = ({ onSearchClick, showSearchIcon = true, className, __fromLayout }: HeaderProps) => {
  useInjectFonts();

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { t } = useTranslation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [firstName, setFirstName] = useState<string>("");

  const isIndexPage = location.pathname === "/";

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

  const handleAccountClick = () => {
    if (user) {
      navigate("/account");
    } else {
      openAuthModal("login");
    }
  };

  // Logged-in users go straight to the host dashboard; guests get the auth
  // modal (sign up / log in) right here instead of being sent through the
  // /become-host route just to get redirected to /auth.
  const handleBecomeHostClick = () => {
    if (user) {
      navigate("/become-host");
    } else {
      openAuthModal("signup");
    }
  };

  // Sends the flag Explore.tsx watches for, so it opens the search bar and
  // its suggestions as soon as the page loads.
  const goToExploreSearch = () => {
    navigate("/explore", { state: { openSearch: true } });
  };

  return (
    <header
      className={`z-[100] items-center fixed top-0 left-0 right-0 flex py-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-colors duration-300 ${className || ""}`}
      style={{ fontFamily: FONT_BODY }}
    >
      <div
        className="absolute inset-0 -z-10 hidden md:block"
        style={{ background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)` }}
      />
      <div className="container mx-auto px-4 flex items-center justify-between h-full">

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
            <span
              className="text-lg text-white hidden md:inline"
              style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", fontWeight: 600, letterSpacing: "-0.01em" }}
            >
              Real Travo
            </span>
          </Link>
        </div>

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
              className="flex items-center gap-1.5 text-[13px] font-medium text-white/80 hover:text-white transition-colors"
            >
              {item.icon}<span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">

          {showSearchIcon && isIndexPage && (
            <div className="w-9 h-9 shrink-0 flex items-center justify-center overflow-hidden">
              <button
                onClick={goToExploreSearch}
                className={`${headerIconStyles} transition-all duration-300 ${
                  hasScrolled ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
                }`}
                aria-label="Explore"
                tabIndex={hasScrolled ? 0 : -1}
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          )}

          <button
            onClick={handleBecomeHostClick}
            className="hidden md:flex h-9 px-3 rounded-xl items-center gap-2 transition-all font-semibold text-[13px] text-white bg-white/15 hover:bg-white/25 active:scale-95"
          >
            <Briefcase className="h-4 w-4" /><span>Become a host</span>
          </button>

          <div className="hidden md:flex [&_button]:text-white [&_button]:h-9 [&_button]:w-9 [&_[data-radix-popper-content-wrapper]]:!max-w-[320px]">
            <NotificationBell />
          </div>

          <div
            onClick={handleAccountClick}
            className="hidden md:flex items-center gap-1.5 cursor-pointer text-white/90 hover:text-white transition-colors py-1 px-2"
          >
            <User className="h-4 w-4" />
            <span className="text-[13px] font-medium max-w-[100px] truncate">
              {user ? (firstName || t("nav.profile")) : "Guest"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          </div>
        </div>
      </div>
    </header> 
  );
};