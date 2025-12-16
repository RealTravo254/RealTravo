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
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle"; 
import { NotificationBell } from "./NotificationBell"; 

// Define the darker RGBA background style for mobile icons
const mobileIconBgStyle = { 
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker, less transparent black
};

interface HeaderProps {
  onSearchClick?: () => void;
  showSearchIcon?: boolean;
}

export const Header = ({ onSearchClick, showSearchIcon = true }: HeaderProps) => {
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);

  // --- Start of unchanged functional code ---
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
  // --- End of unchanged functional code ---

  return (
    // Mobile Header: Fixed positioning (z-[100] ensures visibility)
    // Desktop Header (md:): Restores sticky, height, and background color.
    <header className="fixed top-0 left-0 right-0 z-[100] text-black dark:text-white md:sticky md:h-16 md:border-b md:border-border md:bg-[#008080] md:text-white dark:md:bg-[#008080] dark:md:text-white">
      <div className="container md:flex md:h-full md:items-center md:justify-between md:px-4">
        
        {/* Mobile Left Icons (Menu) - Fixed Positioned */}
        <div className="absolute top-4 left-4 flex items-center gap-3 md:relative md:top-auto md:left-auto">
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              {/* Menu Icon Wrapper: APPLIED DESIRED BIG SCREEN STYLES */}
              <button 
                className="inline-flex items-center justify-center h-10 w-10 rounded-full transition-colors hover:bg-gray-700 
                md:bg-white/10 md:text-white md:hover:bg-white md:group" // Added md:bg-white/10 and md:hover:bg-white
                aria-label="Open navigation menu"
                style={mobileIconBgStyle} // Apply darker RGBA background on mobile
              >
                {/* Menu Icon: APPLIED DESIRED BIG SCREEN STYLES */}
                <Menu className="h-5 w-5 text-white md:text-white md:group-hover:text-[#008080]" /> // Added md:text-white and md:group-hover:text-[#008080]
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 h-screen">
              <NavigationDrawer onClose={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          
          {/* Logo/Description: Always HIDDEN on small screens */}
          <Link to="/" className="hidden md:flex items-center gap-3">
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
        </div>

        {/* Desktop Navigation (Centered): Visible from lg: breakpoint up */}
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

        {/* Mobile Right Icons (Search, Notification) - Fixed Positioned */}
        <div className="absolute top-4 right-4 flex items-center gap-2 md:relative md:top-auto md:right-auto md:flex">
          
          {/* Search Icon Button: Search icon is explicitly white on mobile, and the desktop styles already look correct and distinct, so leaving it */}
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
              className="rounded-full h-10 w-10 flex items-center justify-center transition-colors hover:bg-gray-700 md:bg-white/10 md:hover:bg-white"
              aria-label="Search"
              style={mobileIconBgStyle} // Apply darker RGBA background
            >
              {/* Search Icon: The desktop styles are md:text-white dark:md:text-white md:group-hover:text-[#008080], matching the other icons' text color. */}
              <Search className="h-5 w-5 text-white md:text-white dark:md:text-white md:group-hover:text-[#008080]" />
            </button>
          )}
          
          {/* Notification Bell with Dark RGBA Background on Mobile */}
          <div className="flex items-center gap-2 group"> {/* Added group to the div wrapper for hover effect on desktop */}
            {/* Notification Wrapper: APPLIED DESIRED BIG SCREEN STYLES */}
            <div className="rounded-full h-10 w-10 flex items-center justify-center transition-colors 
                md:bg-white/10 md:hover:bg-white" // Added md:bg-white/10 and md:hover:bg-white
                 style={mobileIconBgStyle} // Apply darker RGBA background on mobile
            >
              <NotificationBell 
                // Notification Icon: Explicitly white on mobile (default)
                mobileIconClasses="text-white"
                // APPLIED DESIRED BIG SCREEN STYLES
                desktopIconClasses="md:text-white md:group-hover:text-[#008080]" // Changed md:hover:bg-[#006666] to match the account icon's hover text
              />
            </div>
          </div>

          {/* Theme Toggle and Account: Hidden on mobile, shown on desktop */}
          <div className="hidden md:flex items-center gap-2">
            {/* Theme Toggle Wrapper: Ensure ThemeToggle component has the required background and icon colors */}
            <div className="rounded-full h-10 w-10 flex items-center justify-center transition-colors 
                bg-white/10 hover:bg-white group">
              <ThemeToggle iconClasses="text-white group-hover:text-[#008080]" /> {/* Added prop to ThemeToggle (assuming it accepts it) */}
            </div>
            
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
};