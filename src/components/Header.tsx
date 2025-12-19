import { useState, useEffect } from "react";
import { Menu, Heart, Ticket, Home, User, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavigationDrawer } from "./NavigationDrawer";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  SOFT_GRAY: "#F8F9FA",
  DARK_BG: "rgba(0, 0, 0, 0.5)"
};

export interface HeaderProps {
  onSearchClick?: () => void;
  showSearchIcon?: boolean;
  className?: string;
  hideIcons?: boolean;
}

export const Header = ({ onSearchClick, showSearchIcon = true, className, hideIcons = false }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isIndexPage = location.pathname === '/';
  const { user } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('profiles').select('name').eq('id', session.user.id).single();
      }
    };
    fetchUserProfile();
  }, [user]);

  const mobileHeaderClasses = isIndexPage 
    ? "fixed top-0 left-0 right-0 bg-transparent flex" 
    : "hidden md:flex sticky top-0 left-0 right-0 border-b border-white/10 shadow-lg";

  const headerIconStyles = `
    h-11 w-11 rounded-2xl flex items-center justify-center transition-all duration-200 
    active:scale-90 shadow-md md:shadow-none text-white
    bg-black/50 hover:bg-black/60 
    md:bg-white/15 md:hover:bg-white/25
  `;

  return (
    <header 
      className={`z-[100] transition-all duration-300 md:h-20 items-center ${mobileHeaderClasses} ${className || ''}`}
      style={{ 
        backgroundColor: isIndexPage 
          ? (window.innerWidth >= 768 ? COLORS.TEAL : 'transparent') 
          : COLORS.TEAL 
      }}
    >
      <div className="container mx-auto px-4 flex items-center justify-between h-full">
        
        {/* Left Section: Menu */}
        <div className={`flex items-center gap-4 ${isIndexPage && 'mt-4 md:mt-0'}`}>
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <button className={headerIconStyles} aria-label="Open Menu">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 h-screen border-none">
              <NavigationDrawer onClose={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <Link to="/" className={`flex items-center gap-3 group ${isIndexPage ? 'hidden md:flex' : 'flex'}`}>
            <div 
              className="h-10 w-10 rounded-xl flex items-center justify-center font-black text-xl shadow-lg transition-transform group-hover:rotate-12"
              style={{ backgroundColor: 'white', color: COLORS.TEAL }}
            >
              T
            </div>
            <div className="hidden sm:block">
              <span className="font-black text-lg uppercase tracking-tighter text-white block leading-none">
                TripTrac
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">
                Explore Kenya
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8">
          {[
            { to: "/", icon: <Home className="h-4 w-4" />, label: "Home" },
            { to: "/bookings", icon: <Ticket className="h-4 w-4" />, label: "Bookings" },
            { to: "/saved", icon: <Heart className="h-4 w-4" />, label: "Wishlist" }
          ].map((item) => (
            <Link 
              key={item.label}
              to={item.to} 
              className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/90 hover:text-white transition-colors"
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Right Section: Actions */}
        <div className={`flex items-center gap-3 ${isIndexPage && 'mt-4 md:mt-0'}`}>
          {showSearchIcon && (
            <button 
              onClick={() => onSearchClick ? onSearchClick() : navigate('/')}
              className={headerIconStyles}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
          )}
          
          {/* Notification Bell Integration */}
          <div className={headerIconStyles}>
            <NotificationBell />
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button 
              onClick={() => user ? navigate('/account') : navigate('/auth')}
              className="h-10 px-4 rounded-xl flex items-center gap-2 font-bold text-sm shadow-lg transition-all hover:opacity-90 active:scale-95 text-white"
              style={{ 
                background: `linear-gradient(135deg, ${COLORS.CORAL} 0%, #FF6B35 100%)`
              }}
            >
              <User className="h-4 w-4" />
              <span>{user ? "Profile" : "Login"}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};