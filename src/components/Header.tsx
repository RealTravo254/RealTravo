import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Menu, X, Ticket, Home, UserRound, Search, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { supabase } from "@/integrations/supabase/client";
import { NavigationDrawer } from "./NavigationDrawer";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";

const FOREST = "#1F4D3A";
const FOREST_DEEP = "#123322";

// Change this if your profile page lives on a different route.
const PROFILE_PATH = "/profile";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [firstName, setFirstName] = useState<string>("");

  const isIndexPage = location.pathname === "/";

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close the menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close the menu with Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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

  // Profile icon → profile page (guests get the login modal).
  const handleAccountClick = () => {
    setMenuOpen(false);
    if (user) {
      navigate(PROFILE_PATH);
    } else {
      openAuthModal("login");
    }
  };

  const goToExploreSearch = () => {
    navigate("/explore", { state: { openSearch: true } });
  };

  const NAV_ITEMS = [
    { to: "/", icon: <Home className="h-4 w-4" />, label: t("nav.home") },
    { to: "/bookings", icon: <Ticket className="h-4 w-4" />, label: t("nav.bookings") },
    { to: "/messages", icon: <MessageCircle className="h-4 w-4" />, label: t("nav.messages", "Messages") },
  ];

  return (
    <header
      className={`z-[100] items-center fixed top-0 left-0 right-0 flex py-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-colors duration-300 ${className || ""}`}
      style={{ fontFamily: FONT_BODY }}
    >
      {/* Dim backdrop while the menu is open — tap to close */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 -z-20 bg-black/35 backdrop-blur-[2px] cursor-default"
        />
      )}

      {/* Header background: always on desktop, on mobile only while the menu is open */}
      <div
        className={`absolute inset-0 -z-10 ${menuOpen ? "block" : "hidden md:block"}`}
        style={{ background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)` }}
      />

      <div className="container mx-auto px-4 flex items-center justify-between h-full">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={headerIconStyles}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="h-6 w-6 stroke-[2.5]" /> : <Menu className="h-6 w-6 stroke-[2.5]" />}
          </button>

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
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-1.5 text-[13px] font-medium text-white/80 hover:text-white transition-colors"
            >
              {item.icon}
              <span>{item.label}</span>
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
                aria-label="Search"
                tabIndex={hasScrolled ? 0 : -1}
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className="hidden md:flex [&_button]:text-white [&_button]:h-9 [&_button]:w-9 [&_[data-radix-popper-content-wrapper]]:!max-w-[320px]">
            <NotificationBell />
          </div>

          {/* Account: round icon with the first name underneath */}
          <button
            type="button"
            onClick={handleAccountClick}
            aria-label="Profile"
            className="flex flex-col items-center gap-0.5 px-1 py-0.5 text-white transition-transform active:scale-95"
          >
            <span className="h-8 w-8 rounded-full bg-white/15 border border-white/25 flex items-center justify-center hover:bg-white/25 transition-colors">
              <UserRound className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[10px] font-medium leading-none max-w-[64px] truncate text-white/90">
              {user ? firstName || t("nav.profile") : "Guest"}
            </span>
          </button>
        </div>
      </div>

      {/* Dropdown menu — opens downwards, right below the header */}
      <div className="absolute top-full left-0 right-0 z-10 pointer-events-none" aria-hidden={!menuOpen}>
        <div className="container mx-auto px-3 md:px-4">
          <div
            className="pointer-events-auto w-full md:max-w-[360px] mt-2 rounded-3xl overflow-hidden shadow-2xl bg-white origin-top"
            style={{
              opacity: menuOpen ? 1 : 0,
              transform: menuOpen ? "translateY(0) scale(1)" : "translateY(-10px) scale(0.98)",
              visibility: menuOpen ? "visible" : "hidden",
              transition: menuOpen
                ? "opacity .25s ease, transform .25s ease, visibility 0s"
                : "opacity .2s ease, transform .2s ease, visibility 0s linear .2s",
            }}
          >
            <NavigationDrawer onClose={() => setMenuOpen(false)} />
          </div>
        </div>
      </div>
    </header>
  );
};