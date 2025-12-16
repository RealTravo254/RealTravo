import { useState, useEffect } from "react";
import { Menu, Heart, Ticket, Shield, Home, FolderOpen, User, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavigationDrawer } from "./NavigationDrawer";
// Import useLocation
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle"; 
import { NotificationBell } from "./NotificationBell"; 

// Setting the deeper RGBA background color as a constant for clarity
const MOBILE_ICON_BG = 'rgba(0, 0, 0, 0.5)'; // Deeper semi-transparent black

interface HeaderProps {
  onSearchClick?: () => void;
  showSearchIcon?: boolean;
}

export const Header = ({ onSearchClick, showSearchIcon = true }: HeaderProps) => {
  const navigate = useNavigate();
  // Determine the current route
  const location = useLocation();
  const isIndexPage = location.pathname === '/';

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);

  // --- Start of functional code (omitted for brevity) ---
  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setUserRole(null);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (data && data.length > 0) {
        const roles = data.map(r => r.role);
        if (roles.includes("admin")) setUserRole("admin");
        else setUserRole("user");
      }
    };

    checkRole();
  }, [user]);

  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.name) {
          setUserName(profile.name);
        }
      }
    };

    fetchUserProfile();
  }, [user]);

  const getUserInitials = () => {
    if (userName) {
      const names = userName.trim().split(' ');
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return userName.substring(0, 2).toUpperCase();
    }
    return "U";
  };
  // --- End of functional code ---

  // Conditional classes for the main header element
  const mobileHeaderClasses = isIndexPage 
    // Classes for the index page (fixed, hidden background)
    ? "fixed top-0 left-0 right-0" 
    // Classes for all other pages (sticky, full background)
    : "sticky top-0 left-0 right-0 border-b border-border bg-[#008080] dark:bg-[#008080] text-white dark:text-white";

  // Conditional icon styling for non-index pages
  const nonIndexIconStyle = isIndexPage ? {} : { backgroundColor: 'transparent' };
  const nonIndexIconColor = isIndexPage ? 'text-white' : 'text-white'; 

  // **NEW CONSTANT FOR DESKTOP ICON STYLING**
  // This will apply the same background/hover/text classes to Menu, Notification, and Account icons on desktop
  const DESKTOP_ICON_CLASSES = "md:bg-white/10 md:hover:bg-white md:group";
  const DESKTOP_ICON_INNER_CLASSES = "md:text-white md:group-hover:text-[#008080]";


  return (
    // 1. Apply conditional classes to the header
    <header className={`z-[100] text-black dark:text-white md:sticky md:h-16 md:text-white dark:md:text-white ${mobileHeaderClasses}`}>
      
      {/* 2. Main container: Use flexbox to align items for non-index pages on mobile */}
      <div className={`container md:flex md:h-full md:items-center md:justify-between md:px-4 
                      ${!isIndexPage ? 'flex items-center justify-between h-16' : ''}`}>
        
        {/* 3. Mobile Left Icons (Menu) - Conditional Fixed/Relative Position */}
        <div className={`flex items-center gap-3 
                        ${isIndexPage ? 'absolute top-4 left-4' : 'relative'} 
                        md:relative md:top-auto md:left-auto`}>
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              {/* Menu Icon: **APPLY NEW DESKTOP STYLES** */}
              <button 
                // Original mobile/non-index styles retained:
                className={`inline-flex items-center justify-center h-10 w-10 rounded-full transition-colors ${isIndexPage ? 'text-white hover:bg-white/20' : 'text-white bg-white/10 hover:bg-white/20'} 
                            
                            // **NEW DESKTOP STYLES** (Overwrite existing md:text-white md:hover:bg-[#006666])
                            ${DESKTOP_ICON_CLASSES} md:hover:text-[#008080]`}
                aria-label="Open navigation menu"
                // Apply mobile background style only on the index page
                style={isIndexPage ? { backgroundColor: MOBILE_ICON_BG } : nonIndexIconStyle}
              >
                <Menu className={`h-5 w-5 ${DESKTOP_ICON_INNER_CLASSES}`} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 h-screen">
              <NavigationDrawer onClose={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          
          {/*             MODIFICATION START: Logo/Description for all non-index pages (and desktop)
            The logic is now: 
            - Show on desktop (`md:flex`)
            - OR show on mobile when it's NOT the index page (`!isIndexPage`)
            The initial class is `flex` and we hide it only for the index page on mobile (`${isIndexPage ? 'hidden' : 'flex'}`)
          */}
          <Link 
            to="/" 
            className={`${isIndexPage ? 'hidden' : 'flex'} items-center gap-3 md:flex`}
          >
              <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-[#0066cc] font-bold text-lg">
                T
              </div>
              <div>
                <span className="font-bold text-base md:text-lg text-white block">
                  TripTrac
                </span>
                <p className="text-xs text-white/90 block">Your journey starts now.</p>
              </div>
          </Link>
          {/* MODIFICATION END */}
        </div>

        {/* Desktop Navigation (Centered) - Unchanged */}
        <nav className="hidden lg:flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold hover:text-muted-foreground transition-colors">
            <Home className="h-4 w-4" />
            <span>Home</span>
          </Link>
          <Link to="/bookings" className="flex items-center gap-2 font-bold hover:text-muted-foreground transition-colors">
            <Ticket className="h-4 w-4" />
            <span>My Bookings</span>
          </Link>
          <Link to="/saved" className="flex items-center gap-2 font-bold hover:text-muted-foreground transition-colors">
            <Heart className="h-4 w-4" />
            <span>Wishlist</span>
          </Link>
          <button 
            onClick={() => user ? navigate('/become-host') : navigate('/auth')} 
            className="flex items-center gap-2 font-bold hover:text-muted-foreground transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
            <span>Become a Host</span>
          </button>
        </nav>

        {/* 4. Mobile Right Icons (Search, Notification) - Conditional Fixed/Relative Position */}
        <div className={`flex items-center gap-2 md:relative md:top-auto md:right-auto md:flex 
                        ${isIndexPage ? 'absolute top-4 right-4' : 'relative'}`}>
          
          {/* Search Icon Button: Only the background logic is slightly modified */}
          {showSearchIcon && (
            <button 
              onClick={() => {
                if (onSearchClick) {
                  onSearchClick();
                } else {
                  navigate('/');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              // Removed md:bg-white/10 md:hover:bg-white to simplify, as it's not a primary "Account" action.
              // Kept the mobile/desktop classes that provide a similar visual:
              className={`rounded-full h-10 w-10 flex items-center justify-center transition-colors md:hover:bg-white/20 hover:bg-white/20`}
              aria-label="Search"
              style={isIndexPage ? { backgroundColor: MOBILE_ICON_BG } : nonIndexIconStyle}
            >
              {/* Added group to allow for hover color change, matching the other primary icons */}
              <Search className={`h-5 w-5 ${nonIndexIconColor} md:text-white md:group-hover:text-[#008080]`} />
            </button>
          )}
          
          {/* Notification Bell with **APPLY NEW DESKTOP STYLES** */}
          <div className="flex items-center gap-2">
            <div 
                // **APPLY NEW DESKTOP STYLES** (Overwrite existing md:bg-transparent)
                className={`rounded-full h-10 w-10 flex items-center justify-center transition-colors ${DESKTOP_ICON_CLASSES}`}
                style={isIndexPage ? { backgroundColor: MOBILE_ICON_BG } : nonIndexIconStyle}
            >
              <NotificationBell 
                  mobileIconClasses="text-white"
                  // **APPLY NEW DESKTOP ICON STYLES** (Overwrite existing md:text-white md:hover:bg-[#006666])
                  desktopIconClasses={DESKTOP_ICON_INNER_CLASSES}
              />
            </div>
          </div>

          {/* Theme Toggle and Account: Hidden on mobile, shown on desktop - Unchanged, but used as the source of the style */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            
            {/* Account Button (The source of the new DESKTOP_ICON_CLASSES and DESKTOP_ICON_INNER_CLASSES) */}
            <button 
              onClick={() => user ? navigate('/account') : navigate('/auth')}
              className={`rounded-full h-10 w-10 flex items-center justify-center transition-colors 
                          ${DESKTOP_ICON_CLASSES}`} 
              aria-label="Account"
            >
              <User className={`h-5 w-5 ${DESKTOP_ICON_INNER_CLASSES}`} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};