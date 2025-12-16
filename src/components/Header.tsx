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

interface HeaderProps {
  onSearchClick?: () => void;
  showSearchIcon?: boolean;
}

export const Header = ({ onSearchClick, showSearchIcon = true }: HeaderProps) => {
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);

  // ... (Role and User Name useEffects and getUserInitials function remain unchanged) ...
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

  // Function to get initials from the user's name
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

  return (
    // 1. Mobile Header: Make it absolutely positioned, no height, no background.
    // Desktop Header (md:): Revert to sticky, h-16, and background color.
    <header className="absolute top-0 left-0 right-0 z-50 text-black dark:text-white md:sticky md:h-16 md:border-b md:border-border md:bg-[#008080] md:text-white dark:md:bg-[#008080] dark:md:text-white">
      {/* 2. Mobile Container: Remove flex properties and padding. Use absolute children for positioning. 
           Desktop Container: Keep standard flex layout for md: */}
      <div className="container md:flex md:h-full md:items-center md:justify-between md:px-4">
        
        {/* Mobile Left Icons (Menu) */}
        <div className="absolute top-4 left-4 flex items-center gap-3 md:relative md:top-auto md:left-auto">
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              {/* Menu Icon: Positioned top-left on mobile */}
              <button className="inline-flex items-center justify-center h-10 w-10 rounded-md text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors md:text-white md:hover:bg-[#006666]" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 h-screen">
              <NavigationDrawer onClose={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          
          {/* Logo/Description: Always HIDDEN on small screens */}
          <Link to="/" className="hidden md:flex items-center gap-3">
            {/* ... Logo HTML ... */}
          </Link>
        </div>

        {/* Desktop Navigation (Centered): Always HIDDEN on small screens */}
        <nav className="hidden lg:flex items-center gap-6">
          {/* ... Desktop Nav Links ... */}
        </nav>

        {/* 3. Mobile Right Icons (Search, Notification) */}
        <div className="absolute top-4 right-4 flex items-center gap-2 md:relative md:top-auto md:right-auto md:flex">
          
          {/* Search Icon Button: Always visible, positioned top-right (relative to its wrapper) */}
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
              className="rounded-full h-10 w-10 flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 md:bg-white/10 md:hover:bg-white"
              aria-label="Search"
            >
              <Search className="h-5 w-5 text-black dark:text-white md:text-white dark:md:text-white md:group-hover:text-[#008080]" />
            </button>
          )}
          
          {/* Notification Bell with RGBA Background on Mobile */}
          <div className="flex items-center gap-2">
            {/* WRAPPER for Notification Bell - Apply RGBA background ONLY on non-md screens */}
            <div className="rounded-full h-10 w-10 flex items-center justify-center transition-colors md:bg-transparent"
                 style={{ 
                    // Apply rgba background color directly for mobile screens
                    backgroundColor: 'rgba(0, 0, 0, 0.1)', 
                    // Important: Resetting the inline style for desktop is complex. Tailwind classes will override it if they specify background.
                 }}
            >
                <NotificationBell 
                    mobileIconClasses="text-black dark:text-white"
                    desktopIconClasses="md:text-white md:hover:bg-[#006666]"
                />
            </div>
          </div>

          {/* Theme Toggle and Account: Hidden on mobile, shown on desktop */}
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
};