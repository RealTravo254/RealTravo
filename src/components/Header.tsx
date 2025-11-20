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

interface HeaderProps {
  onSearchClick?: () => void;
  showSearchIcon?: boolean;
}

export const Header = ({ onSearchClick, showSearchIcon = true }: HeaderProps) => {
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);

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

  // Mobile account icon tap handler
  const [showMobileAccountDialog, setShowMobileAccountDialog] = useState(false);

  const handleMobileAccountTap = () => {
    if (!user) {
      // Redirect to login
      window.location.href = "/auth";
    } else {
      setShowMobileAccountDialog(!showMobileAccountDialog);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-blue-900 text-white h-16 dark:bg-blue-900 dark:text-white">
      <div className="container flex h-full items-center justify-between px-4">
        
        {/* Logo and Drawer Trigger (Left Side) */}
        <div className="flex items-center gap-3">
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <button className="inline-flex items-center justify-center h-10 w-10 rounded-md text-white hover:bg-blue-800 transition-colors">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 h-screen">
              <NavigationDrawer onClose={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <Link to="/" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center text-primary font-bold text-lg">
              T
            </div>
            <div>
              <span className="font-bold text-base md:text-lg text-header-foreground block">
                TripTrac
              </span>
              <p className="text-xs text-muted-foreground block">Explore the world</p>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation (Centered) */}
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

        {/* Account Controls (Right Side) */}
        <div className="flex items-center gap-2">
          
          {/* Search Icon Button */}
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
              className="rounded-full h-10 w-10 flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Search"
            >
              <Search className="h-5 w-5 text-white" />
            </button>
          )}
            
          {/* Mobile: Account Icon with Name (Right Side) */}
          <div className="md:hidden flex items-center gap-2 relative">
            <button 
              onClick={handleMobileAccountTap}
              className="flex items-center gap-2 text-white hover:text-white/80 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm">
                {user ? getUserInitials() : <User className="h-4 w-4" />}
              </div>
            </button>
            
            {/* Mobile account dropdown */}
            {showMobileAccountDialog && user && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-background border rounded-lg shadow-lg z-50">
                <Link 
                  to="/profile/edit" 
                  className="block px-4 py-3 hover:bg-accent text-foreground"
                  onClick={() => setShowMobileAccountDialog(false)}
                >
                  Profile
                </Link>
                <button 
                  onClick={() => {
                    setShowMobileAccountDialog(false);
                    signOut();
                  }}
                  className="block w-full text-left px-4 py-3 hover:bg-accent text-foreground border-t"
                >
                  Log out
                </button>
              </div>
            )}
          </div>

          {/* Desktop Auth Actions (Right Side) - MODIFIED SECTION */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              // Logged In: Dropdown Menu with Account Icon
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-white">
                    <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm">
                      {getUserInitials()}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background border-border">
                  <DropdownMenuItem asChild>
                    <Link to="/profile/edit" className="text-foreground hover:bg-accent cursor-pointer">Profile</Link>
                  </DropdownMenuItem>
                  {userRole === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin/dashboard" className="text-foreground hover:bg-accent cursor-pointer">Admin Dashboard</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={signOut} className="text-foreground hover:bg-accent cursor-pointer">
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              // Logged Out: Account Icon (replaces the Login / Sign Up Button)
              <button 
                onClick={() => navigate('/auth')}
                className="rounded-full h-10 w-10 flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Login or Sign Up"
              >
                <User className="h-5 w-5 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};