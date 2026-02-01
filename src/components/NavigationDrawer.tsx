import { useState, useEffect, useRef } from "react";
import { 
  Home, Ticket, Heart, Phone, Info, LogIn, LogOut, User, 
  FileText, Shield, ChevronRight, Trophy, Map, Mountain, Bed, Building2 
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface NavigationDrawerProps {
  onClose: () => void;
}

const Separator = () => (
  <hr className="my-1 border-slate-100 dark:border-gray-800/50" />
);

export const NavigationDrawer = ({ onClose }: NavigationDrawerProps) => {
  const { user, signOut } = useAuth();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      if (profile?.name) setUserName(profile.name);
    };
    fetchUserData();
  }, [user]);

  const handleProtectedNavigation = (path: string) => {
    window.location.href = user ? path : "/auth";
    onClose();
  };

  const NavItem = ({ icon: Icon, label, path, isProtected = false }: any) => (
    <li>
      <button
        onClick={() => isProtected ? handleProtectedNavigation(path) : (window.location.href = path, onClose())}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-gray-800 group-hover:bg-[#008080] transition-colors">
            <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300 group-hover:text-white" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white">
            {label}
          </span>
        </div>
        <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-[#008080] transition-transform group-hover:translate-x-1" />
      </button>
      <Separator />
    </li>
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      {/* Brand Header */}
      <div className="p-6 bg-white dark:bg-gray-950 border-b border-slate-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <img 
            src="/fulllogo.png" 
            alt="Realtravo Logo"
            className="h-10 w-10 rounded-full shadow-md object-contain bg-slate-50 p-1 border border-slate-100"
          />
          <div>
            <span 
              className="font-bold text-2xl tracking-tight leading-none block italic"
              style={{
                background: "linear-gradient(to right, #1a365d, #2b6cb0, #4fd1c5)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0px 2px 2px rgba(0,0,0,0.1))"
              }}
            >
              RealTravo
            </span>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">
              Click.Pack.Go!.
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto scrollbar-hide">
        {/* User Profile Card */}
        <div className="mb-6">
          {user ? (
            <div className="p-4 rounded-[24px] bg-slate-50 dark:bg-gray-900 border border-slate-100 dark:border-gray-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-[#008080] flex items-center justify-center text-white font-black">
                  {userName?.charAt(0) || "U"}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Welcome back</span>
                  <span className="text-sm font-black uppercase tracking-tight truncate dark:text-white text-slate-900">
                    {userName || "Explorer"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link 
                  to="/profile" onClick={onClose}
                  className="flex items-center justify-center gap-2 py-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-[9px] font-black uppercase tracking-widest hover:border-[#008080] transition-colors text-slate-600"
                >
                  <User className="h-3 w-3" /> Profile
                </Link>
                <button 
                  onClick={() => { signOut(); onClose(); }}
                  className="flex items-center justify-center gap-2 py-2 rounded-lg bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
                >
                  <LogOut className="h-3 w-3" /> Logout
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/auth" onClick={onClose}
              className="flex items-center justify-center w-full py-4 rounded-[20px] bg-[#008080] text-white shadow-lg shadow-[#008080]/20 active:scale-95 transition-all"
            >
              <LogIn className="h-4 w-4 mr-2" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em]">Login / Register</span>
            </Link>
          )}
        </div>

        <ul className="space-y-1">
          <p className="px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Main Menu</p>
          <NavItem icon={Home} label="Home" path="/" />
          <NavItem icon={Ticket} label="My Bookings" path="/bookings" isProtected />
          <NavItem icon={Heart} label="Wishlist" path="/saved" isProtected />
          
          <div className="h-4" />
          {/* NEW CATEGORIES SECTION */}
          <p className="px-4 text-[9px] font-black text-[#008080] uppercase tracking-[0.2em] mb-2">Explore Categories</p>
          <NavItem icon={Trophy} label="Events & Sports" path="/category/events" />
          <NavItem icon={Map} label="Trips & Tours" path="/category/trips" />
          <NavItem icon={Mountain} label="Campsite & Experience" path="/category/campsite" />
          <NavItem icon={Building2} label="Accommodation" path="/category/accommodation" />
          <NavItem icon={Bed} label="Hotels & Stays" path="/category/hotels" />

          <div className="h-4" />
          <p className="px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Support & Legal</p>
          <NavItem icon={Phone} label="Contact" path="/contact" />
          <NavItem icon={Info} label="About" path="/about" />
          <NavItem icon={FileText} label="Terms" path="/terms-of-service" />
          <NavItem icon={Shield} label="Privacy" path="/privacy-policy" />
        </ul>
      </nav>
      
      <div className="p-6 border-t border-slate-50 dark:border-gray-900 text-center">
        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.3em]">
          RealTravo v2.0
        </span>
      </div>
    </div>
  );
};