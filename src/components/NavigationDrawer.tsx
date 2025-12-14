import { Home, Ticket, Heart, Phone, Info, Video, LogIn, LogOut, Sun, Moon, User, FileText, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
// Removed unused Button import
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NavigationDrawerProps {
  onClose: () => void;
}

const MobileThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    // Removed border-t and pt-2 here, will manage separation outside
    <li className="list-none">
      <button
        onClick={toggleTheme}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
      >
        {theme === "dark" ? (
          <Sun className="h-5 w-5 text-black dark:text-white group-hover:text-yellow-600 transition-colors" />
        ) : (
          <Moon className="h-5 w-5 text-black dark:text-white group-hover:text-blue-600 transition-colors" />
        )}
        <span className="font-medium text-black dark:text-white">
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </span>
      </button>
    </li>
  );
};

// Component to render a thin separator line
const Separator = () => (
  <hr className="my-2 border-gray-200 dark:border-gray-700/50" />
);


export const NavigationDrawer = ({ onClose }: NavigationDrawerProps) => {
  const { user, signOut } = useAuth();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      if (profile && profile.name) {
        setUserName(profile.name);
      }
    };

    fetchUserData();
  }, [user]);

  const handleProtectedNavigation = async (path: string) => {
    if (!user) {
      window.location.href = "/auth";
      onClose();
      return;
    }

    window.location.href = path;
    onClose();
  };


  const bottomNavItems = [
    { icon: Video, label: "Vlog", path: "/vlog", protected: false },
    { icon: Phone, label: "Contact", path: "/contact", protected: false },
    { icon: Info, label: "About", path: "/about", protected: false },
  ];

  const legalItems = [
    { icon: FileText, label: "Terms of Service", path: "/terms-of-service" },
    { icon: Shield, label: "Privacy Policy", path: "/privacy-policy" },
  ];

  const topContentItems = [
    { icon: Home, label: "Home", path: "/", protected: false },
    { icon: Ticket, label: "My Bookings", path: "/bookings", protected: true },
    { icon: Heart, label: "Wishlist", path: "/saved", protected: true },
  ];


  const handleLogout = () => {
    signOut();
    onClose();
  };

  const AuthDisplay = user ? (
    <li className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
      <p className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Account</p>
      <Link
        to="/profile"
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group mb-2"
      >
        <User className="h-5 w-5 text-black dark:text-white" />
        <span className="font-medium truncate text-black dark:text-white">
          {userName || "My Profile"}
        </span>
      </Link>
      <Separator /> {/* ADDED Separator after Profile, before Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200 group"
      >
        <LogOut className="h-5 w-5 text-red-600 dark:text-red-400" />
        <span className="font-medium text-red-600 dark:text-red-400">Logout</span>
      </button>
      <Separator /> {/* ADDED Separator after Logout */}
    </li>
  ) : (
    <li className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
      <Link
        to="/auth"
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-teal-600 dark:bg-teal-800 text-white hover:bg-teal-700 dark:hover:bg-teal-700 transition-all duration-200 group" 
      >
        <LogIn className="h-5 w-5 text-white" />
        <span className="font-medium text-white">Login / Register</span>
      </Link>
      <Separator /> {/* ADDED Separator after Login/Register */}
    </li>
  );


  return (
    <div className="flex flex-col h-full">
      {/* Header section with logo, name, and paragraph - Teal */}
      <div className="p-4 border-b bg-[#008080] text-white border-[#006666]">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-8 rounded-lg bg-[#006666] flex items-center justify-center font-bold text-lg text-white">
            T
          </div>
          <div>
            <span className="font-bold text-base block text-white">
              TripTrac
            </span>
            <p className="text-xs text-[#80c0c0]">Your journey starts now.</p>
          </div>
        </div>
      </div>

      {/* Navigation links section */}
      <nav
        className="flex-1 p-4 pt-6 overflow-y-auto bg-white dark:bg-gray-950
                  [&::-webkit-scrollbar]:hidden
                  [-ms-overflow-style:none]
                  [scrollbar-width:none]"
      >
        <ul className="space-y-2">

          {/* 1. HOME, MY BOOKINGS, WISHLIST (TOP SECTION) */}
          <li className="mb-4 pt-2">
            <p className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Navigation</p>
            <ul className="space-y-1">
              {topContentItems.map((item, index) => {
                return (
                  <li key={item.path}>
                    {item.label === "Home" ? (
                      <Link
                        to={item.path}
                        onClick={onClose}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                      >
                        <item.icon className="h-5 w-5 text-black dark:text-white" />
                        <span className="font-medium text-black dark:text-white">
                          {item.label}
                        </span>
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleProtectedNavigation(item.path)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                      >
                        <item.icon className="h-5 w-5 text-black dark:text-white" />
                        <span className="font-medium text-black dark:text-white">
                          {item.label}
                        </span>
                      </button>
                    )}
                    
                    {/* ADD SEPARATOR AFTER EACH ITEM (Home, My Bookings, Wishlist) */}
                    <Separator />

                    {/* DARK MODE TOGGLE IS PLACED AFTER WISHLIST/SAVED */}
                    {item.label === "Wishlist" && (
                        <>
                          <MobileThemeToggle />
                          <Separator /> {/* ADD SEPARATOR AFTER DARK MODE TOGGLE */}
                        </>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>

          {/* 2. VLOG, CONTACT, ABOUT (COMPANY SECTION) */}
          {/* Removed the top border here as separation is now handled by the last separator above */}
          <li className="mb-4 pt-4">
            <p className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Company</p>
            <ul className="space-y-1">
              {bottomNavItems.map((item, index) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                  >
                    <item.icon className="h-5 w-5 text-black dark:text-white" />
                    <span className="font-medium text-black dark:text-white">
                      {item.label}
                    </span>
                  </Link>
                  {/* ADD SEPARATOR AFTER EACH ITEM (Vlog, Contact, About) */}
                  <Separator />
                </li>
              ))}
            </ul>
          </li>

          {/* 3. LEGAL SECTION */}
          {/* Removed the top border here as separation is now handled by the last separator above */}
          <li className="mb-4 pt-4">
            <p className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Legal</p>
            <ul className="space-y-1">
              {legalItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                  >
                    <item.icon className="h-5 w-5 text-black dark:text-white" />
                    <span className="font-medium text-black dark:text-white">
                      {item.label}
                    </span>
                  </Link>
                  {/* ADD SEPARATOR AFTER EACH ITEM (Terms, Privacy) */}
                  <Separator />
                </li>
              ))}
            </ul>
          </li>

          {/* LOGIN/LOGOUT ICON AND NAME */}
          {/* The AuthDisplay already has a top border, I'll keep it there for visual grouping. */}
          {AuthDisplay}

        </ul>
      </nav>

      {/* Removed Install App Bottom Banner */}
    </div>
  );
};