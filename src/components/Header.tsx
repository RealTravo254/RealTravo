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
  // --- End of functional code (omitted for brevity) ---

  // Conditional classes for the main header element
  const mobileHeaderClasses = isIndexPage 
    // Index page (Mobile): fixed, hidden background 
    ? "fixed top-0 left-0 right-0" 
    // Non-index pages (Mobile/Desktop): sticky, full background
    : "sticky top-0 left-0 right-0 border-b border-border bg-[#008080] dark:bg-[#008080] text-white dark:text-white";

  // <--- NEW CODE: Apply solid background on index page for desktop only
  const desktopIndexBg = isIndexPage 
    ? 'md:bg-[#008080] md:border-b md:border-border' 
    : ''; 
  // END NEW CODE --->

  const nonIndexIconColor = 'text-white'; 

  return (
    // 1. Apply conditional classes to the header
    <header className={`z-[100] text-black dark:text-white 
                       md:sticky md:h-16 md:text-white dark:md:text-white 
                       ${mobileHeaderClasses} 
                       ${desktopIndexBg}`}>{/* <--- desktopIndexBg ADDED here */}
      
      {/* 2. Main container: Remove horizontal padding on mobile for non-index pages to allow the icons to push to the edge */}
      {/* Use px-0 on mobile, px-4 on tablet/desktop */}
      <div className={`container md:flex md:h-full md:items-center md:justify-between md:px-4 
                      ${isIndexPage ? 'px-0' : 'px-0'} flex items-center justify-between h-16`}>
        
        {/* 3. Left Icons (Menu & Logo) - Conditional Positioning and Margin */}
        <div className={`flex items-center gap-3 
                        ${isIndexPage ? 'absolute top-4 left-4' : 'relative ml-4'} 
                        md:relative md:top-auto md:left-auto md:ml-0`}> {/* Added ml-4 for non-index mobile */}
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              {/* Menu Icon: Conditionally apply RGBA Background on index page */}
              <button 
                className={`inline-flex items-center justify-center h-10 w-10 rounded-full transition-colors md:text-white md:hover:bg-[#006666] ${isIndexPage ? 'text-white hover:bg-white/20' : 'text-white hover:bg-white/20'}`}
                aria-label="Open navigation menu"
                style={isIndexPage ? { backgroundColor: MOBILE_ICON_BG } : {}}
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 h-screen">
              <NavigationDrawer onClose={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          
          {/* Logo/Description: Show on all non-index pages (mobile and desktop), hide only on index mobile page */}
          <Link to="/" className={`${isIndexPage ? 'hidden' : 'flex'} items-center gap-3 md:flex`}>
              <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-[#008080] font-bold text-lg">
                T
              </div>
              <div>
                <span className="font-bold text-base md:text-lg text-white block">
                  TripTrac
                </span>
                <p className="text-xs text-white/90">Your journey starts now.</p>
              </div>
          </Link>
        </div>

        {/* Desktop Navigation (Centered) - Hidden on screens smaller than large (lg) */}
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

        {/* 4. Right Icons (Search, Notification, Theme, Account) - Conditional Positioning and Margin */}
        <div className={`flex items-center gap-2 
                        ${isIndexPage ? 'absolute top-4 right-4' : 'relative mr-4'}
                        md:relative md:top-auto md:right-auto md:flex md:mr-0`}> {/* Added mr-4 for non-index mobile */}
          
          {/* Search Icon Button: Conditionally apply RGBA Background on index page */}
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
              className={`rounded-full h-10 w-10 flex items-center justify-center transition-colors md:bg-white/10 md:hover:bg-white hover:bg-white/20`}
              aria-label="Search"
              style={isIndexPage ? { backgroundColor: MOBILE_ICON_BG } : {}}
            >
              <Search className={`h-5 w-5 md:text-white md:group-hover:text-[#008080] ${nonIndexIconColor}`} />
            </button>
          )}
          
          {/* Notification Bell (Always shown on mobile now) */}
          <div className="flex items-center gap-2">
            <div 
                className="rounded-full h-10 w-10 flex items-center justify-center transition-colors md:bg-transparent hover:bg-white/20"
                style={isIndexPage ? { backgroundColor: MOBILE_ICON_BG } : {}}
            >
              <NotificationBell 
                  mobileIconClasses="text-white"
                  desktopIconClasses="md:text-white md:hover:bg-[#006666]"
              />
            </div>
          </div>

          {/* Theme Toggle & Desktop Account: Hidden on mobile (all pages) */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            
            <button 
              onClick={() => user ? navigate('/account') : navigate('/auth')}
              className="rounded-full h-10 w-10 flex items-center justify-center transition-colors 
                          bg-white/10 hover:bg-white group" 
              aria-label="Account"
            >
              <User className="h-5 w-5 text-white group-hover:text-[#008080]" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};2