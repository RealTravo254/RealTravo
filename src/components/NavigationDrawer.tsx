import { Home, Ticket, Heart, Phone, Info, Video, Plus, Edit, Package, LogIn, LogOut, Sun, Moon, User, Shield } from "lucide-react"; 
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
    <li className="pt-2 border-t border-gray-200 dark:border-gray-700">
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

export const NavigationDrawer = ({ onClose }: NavigationDrawerProps) => {
  const { user, signOut } = useAuth();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      // Fetch user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (roleData && roleData.length > 0) {
        const roles = roleData.map((r) => r.role);
        if (roles.includes("admin")) setUserRole("admin");
        else setUserRole("user");
      }

      // Fetch only user profile name (not email)
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
  
  const handleProtectedNavigation = (path: string) => {
    if (!user) {
      window.location.href = "/auth";
    } else {
      window.location.href = path;
    }
    onClose();
  };


  const bottomNavItems = [
    { icon: Video, label: "Vlog", path: "/vlog", protected: false },
    { icon: Phone, label: "Contact", path: "/contact", protected: false },
    { icon: Info, label: "About", path: "/about", protected: false },
  ];

  const topContentItems = [
    { icon: Home, label: "Home", path: "/", protected: false },
    { icon: Ticket, label: "My Bookings", path: "/bookings", protected: true },
    { icon: Heart, label: "Wishlist", path: "/saved", protected: true },
    { icon: Package, label: "Become a Host", path: "/become-host", protected: true },
  ];


  const handleLogout = () => {
    signOut();
    onClose();
  };
  
  // Reworked Auth Display to be a list item
  const AuthDisplay = user ? (
    <li className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
      <p className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Account</p>
      {userRole === "admin" && (
        <Link
          to="/admin"
          onClick={onClose}
          className="w-full flex items-center gap-3 px-4 py-2.5 mb-2 rounded-lg bg-black dark:bg-gray-800 text-white hover:bg-gray-800 dark:hover:bg-gray-700 transition-all duration-200 group"
        >
          <Shield className="h-5 w-5 text-white" />
          <span className="font-medium text-white">Admin Dashboard</span>
        </Link>
      )}
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
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200 group"
      >
        <LogOut className="h-5 w-5 text-red-600 dark:text-red-400" />
        <span className="font-medium text-red-600 dark:text-red-400">Logout</span>
      </button>
    </li>
  ) : (
    <li className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
      <Link
        to="/auth"
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-black dark:bg-gray-800 text-white hover:bg-gray-800 dark:hover:bg-gray-700 transition-all duration-200 group"
      >
        <LogIn className="h-5 w-5 text-white" />
        <span className="font-medium text-white">Login / Register</span>
      </Link>
    </li>
  );


  return (
    <div className="flex flex-col h-full">
      {/* Header section with logo, name, and paragraph - Always blue */}
      <div className="p-4 border-b bg-blue-900 text-white border-blue-800">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-8 rounded-lg bg-blue-700 flex items-center justify-center font-bold text-lg text-white">
            T
          </div>
          <div>
            <span className="font-bold text-base block text-white">
              TripTrac
            </span>
            <p className="text-xs text-blue-200">Explore the world</p>
          </div>
        </div>
      </div>
      
      {/* Navigation links section with white bg and dark mode support */}
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
              {topContentItems.map((item, index) => (
                <li key={item.path}>
                  {/* Home is a link, others are buttons for protected navigation */}
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
                  {/* ADD DARK MODE TOGGLE */}
                  {item.label === "Wishlist" && (
                    <>
                      {/* Dark/Light Mode Toggle */}
                      <MobileThemeToggle />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </li>

          {/* 2. VLOG, CONTACT, ABOUT (COMPANY SECTION) */}
          <li className="mb-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Company</p>
            <ul className="space-y-1">
              {bottomNavItems.map((item) => (
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
                </li>
              ))}
            </ul>
          </li>
          
          {/* LOGIN/LOGOUT ICON AND NAME (Moved to inside the UL) */}
          {AuthDisplay}
          
        </ul>
      </nav>
      {/* Removed the dedicated footer div for AuthButton */}
    </div>
   ); 
};