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
    <li className="list-none">
      <button
        onClick={toggleTheme}
        // REDUCED: py-2.5 -> py-2, Icons h-5 w-5 -> h-4 w-4
        className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4 text-black dark:text-white group-hover:text-yellow-600 transition-colors" />
        ) : (
          <Moon className="h-4 w-4 text-black dark:text-white group-hover:text-blue-600 transition-colors" />
        )}
        {/* REDUCED FONT SIZE: text-sm */}
        <span className="text-sm font-medium text-black dark:text-white">
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </span>
      </button>
    </li>
  );
};

// Component to render a thin separator line
const Separator = () => (
  // REDUCED MARGIN AND THICKNESS: my-2 -> my-1.5, dark:border-gray-700/50 -> dark:border-gray-700/30
  <hr className="my-1.5 border-gray-200/50 dark:border-gray-700/30" />
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
      // Use window.location.href to force a full reload and redirect outside of React Router context
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
    // ADJUSTED: pt-4 -> pt-2 to reduce space, border-t remains for grouping
    <li className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-800">
      <Link
        to="/profile"
        onClick={onClose}
        // REDUCED: py-2.5 -> py-2, mb-2 removed to rely on Separator
        className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
      >
        {/* REDUCED ICON SIZE: h-5 w-5 -> h-4 w-4 */}
        <User className="h-4 w-4 text-black dark:text-white" />
        {/* REDUCED FONT SIZE: text-sm */}
        <span className="text-sm font-medium truncate text-black dark:text-white">
          {userName || "My Profile"}
        </span>
      </Link>
      <Separator /> 
      <button
        onClick={handleLogout}
        // REDUCED: py-2.5 -> py-2
        className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200 group"
      >
        {/* REDUCED ICON SIZE: h-5 w-5 -> h-4 w-4 */}
        <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
        {/* REDUCED FONT SIZE: text-sm */}
        <span className="text-sm font-medium text-red-600 dark:text-red-400">Logout</span>
      </button>
      <Separator /> 
    </li>
  ) : (
    // ADJUSTED: pt-4 -> pt-2 to reduce space, border-t remains for grouping
    <li className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-800">
      <Link
        to="/auth"
        onClick={onClose}
        // REDUCED: py-2.5 -> py-2
        className="w-full flex items-center gap-3 px-4 py-2 rounded-lg bg-teal-600 dark:bg-teal-800 text-white hover:bg-teal-700 dark:hover:bg-teal-700 transition-all duration-200 group"
      >
        {/* REDUCED ICON SIZE: h-5 w-5 -> h-4 w-4 */}
        <LogIn className="h-4 w-4 text-white" />
        {/* REDUCED FONT SIZE: text-sm */}
        <span className="text-sm font-medium text-white">Login / Register</span>
      </Link>
      <Separator /> 
    </li>
  );


  return (
    <div className="flex flex-col h-full">
      {/* Header section with logo, name, and paragraph - Teal */}
      <div className="p-4 border-b bg-[#008080] text-white border-[#006666]">
        <div className="flex items-center gap-3 mb-2">
          {/* LOGO SIZE REMAINS 8x8 */}
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
        {/* REDUCED SPACING: space-y-2 -> space-y-0.5 to rely on Separator */}
        <ul className="space-y-0.5">

          {/* 1. HOME, MY BOOKINGS, WISHLIST (TOP SECTION) */}
          {/* ADJUSTED: mb-4 removed, pt-2 removed */}
          <li>
            <ul className="space-y-0.5">
              {topContentItems.map((item, index) => {
                return (
                  <li key={item.path}>
                    {item.label === "Home" ? (
                      <Link
                        to={item.path}
                        onClick={onClose}
                        // REDUCED: py-2.5 -> py-2
                        className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                      >
                        {/* REDUCED ICON SIZE: h-5 w-5 -> h-4 w-4 */}
                        <item.icon className="h-4 w-4 text-black dark:text-white" />
                        {/* REDUCED FONT SIZE: text-sm */}
                        <span className="text-sm font-medium text-black dark:text-white">
                          {item.label}
                        </span>
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleProtectedNavigation(item.path)}
                        // REDUCED: py-2.5 -> py-2
                        className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                      >
                        {/* REDUCED ICON SIZE: h-5 w-5 -> h-4 w-4 */}
                        <item.icon className="h-4 w-4 text-black dark:text-white" />
                        {/* REDUCED FONT SIZE: text-sm */}
                        <span className="text-sm font-medium text-black dark:text-white">
                          {item.label}
                        </span>
                      </button>
                    )}
                    
                    {/* ADD SEPARATOR AFTER EACH ITEM (Home, My Bookings, Wishlist) */}
                    <Separator />

                    {/* DARK MODE TOGGLE IS PLACED AFTER WISHLIST/SAVED */}
                    {item.label === "Wishlist" && (
                        <>
                          {/* MobileThemeToggle now uses the smaller py-2/h-4w-4 size inside */}
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
          {/* ADJUSTED: mb-4 removed, pt-4 -> pt-2 for slightly less break space */}
          <li className="pt-2"> 
            <ul className="space-y-0.5">
              {bottomNavItems.map((item, index) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    // REDUCED: py-2.5 -> py-2
                    className="flex items-center gap-3 px-4 py-2 rounded-lg text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                  >
                    {/* REDUCED ICON SIZE: h-5 w-5 -> h-4 w-4 */}
                    <item.icon className="h-4 w-4 text-black dark:text-white" />
                    {/* REDUCED FONT SIZE: text-sm */}
                    <span className="text-sm font-medium text-black dark:text-white">
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
          {/* ADJUSTED: mb-4 removed, pt-4 -> pt-2 for slightly less break space */}
          <li className="pt-2">
            <ul className="space-y-0.5">
              {legalItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    // REDUCED: py-2.5 -> py-2
                    className="flex items-center gap-3 px-4 py-2 rounded-lg text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                  >
                    {/* REDUCED ICON SIZE: h-5 w-5 -> h-4 w-4 */}
                    <item.icon className="h-4 w-4 text-black dark:text-white" />
                    {/* REDUCED FONT SIZE: text-sm */}
                    <span className="text-sm font-medium text-black dark:text-white">
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
          {AuthDisplay}

        </ul>
      </nav>

      {/* Removed Install App Bottom Banner */}
    </div>
  );
};