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
    : "hidden md:flex sticky top-0 left-0 right-0 border-b border-slate-100 shadow-sm";

  // Updated to ensure overflow is visible so badges aren't cut off
  const headerIconStyles = `
    h-11 w-11 rounded-2xl flex items-center justify-center transition-all duration-200 
    active:scale-90 shadow-sm border border-slate-200 relative overflow-visible
    ${isIndexPage ? 'text-slate-800 bg-white/90 hover:bg-white' : 'text-slate-700 bg-slate-50 hover:bg-slate-100'}
  `;

  return (
    <header 
      className={`z-[100] transition-all duration-300 md:h-20 items-center ${mobileHeaderClasses} ${className || ''}`}
      style={{ 
        backgroundColor: isIndexPage 
          ? (window.innerWidth >= 768 ? 'white' : 'transparent') 
          : 'white' 
      }}
    >
      <div className="container mx-auto px-4 flex items-center justify-between h-full">
        
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
            <img 
              src="/fulllogo.png" 
              alt="Realtravo Logo"
              className="h-10 w-10 rounded-full shadow-md object-contain bg-slate-50 p-1 border border-slate-100"
            />
            <div className="hidden sm:block">
              <span 
                className="font-bold text-2xl tracking-tight block italic leading-none"
                style={{
                  background: "linear-gradient(to right, #1a365d, #2b6cb0, #4fd1c5)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Realtravo
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">
                Click.Pack.Go!.
              </span>
            </div>
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-8">
          {[
            { to: "/", icon: <Home className="h-4 w-4" />, label: "Home" },
            { to: "/bookings", icon: <Ticket className="h-4 w-4" />, label: "Bookings" },
            { to: "/saved", icon: <Heart className="h-4 w-4" />, label: "Wishlist" }
          ].map((item) => (
            <Link 
              key={item.label}
              to={item.to} 
              className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors"
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

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
          
          <NotificationBell />

          <div className="hidden md:flex items-center gap-3">
            <button 
              onClick={() => user ? navigate('/account') : navigate('/auth')}
              className="h-11 px-6 rounded-2xl flex items-center gap-3 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg border-none text-white hover:brightness-110 active:scale-95"
              style={{ 
                background: `linear-gradient(135deg, ${COLORS.CORAL} 0%, #008080 100%)`
              }}
            >
              <User className="h-4 w-4" />
              {user ? "Profile" : "Login"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};