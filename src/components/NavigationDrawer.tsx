import { Home, Ticket, Heart, Phone, Info, Video, Plus, Edit, Package, LogIn, LogOut, Plane, Building, Tent, Sun, Moon, User } from "lucide-react"; 
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  // Removed DropdownMenu components
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface NavigationDrawerProps {
  onClose: () => void;
}

// Placeholder for Theme Toggle component logic (You need to hook up theme state here)
const ThemeToggle = ({ onClose }: { onClose: () => void }) => {
  // Placeholder state for demonstration. Replace with actual theme state management (e.g., useContext)
  const isDarkMode = false; // Assume light mode by default

  const toggleTheme = () => {
    // Implement actual theme switching logic here
    console.log("Theme toggled!");
    // You might want to remove onClose() if you prefer the drawer to stay open
  };

  return (
    <li className="pt-2 border-t border-gray-200">
      <button
        onClick={toggleTheme}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 group"
      >
        {isDarkMode ? (
          <Sun className="h-5 w-5 text-yellow-500 group-hover:text-yellow-600 transition-colors" />
        ) : (
          <Moon className="h-5 w-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
        )}
        <span className="font-medium">
          {isDarkMode ? "Light Mode" : "Dark Mode"}
        </span>
      </button>
    </li>
  );
};

export const NavigationDrawer = ({ onClose }: NavigationDrawerProps) => {
  const { user, signOut } = useAuth();
  
  const handleProtectedNavigation = (path: string) => {
    if (!user) {
      window.location.href = "/auth";
    } else {
      window.location.href = path;
    }
    onClose();
  };

  const partnerItems = [
    { 
      icon: Plane,
      label: "Create Trip", 
      path: "/CreateTripEvent" 
    },
    { 
      icon: Building,
      label: "List Hotel", 
      path: "/CreateHotel" 
    },
    { 
      icon: Tent,
      label: "List Your Campsite", 
      path: "/CreateAdventure" 
    },
  ];

  const bottomNavItems = [
    { icon: Video, label: "Vlog", path: "/vlog", protected: false },
    { icon: Phone, label: "Contact", path: "/contact", protected: false },
    { icon: Info, label: "About", path: "/about", protected: false },
  ];

  const topContentItems = [
    { icon: Home, label: "Home", path: "/", protected: false },
    { icon: Ticket, label: "My Bookings", path: "/bookings", protected: true },
    { icon: Heart, label: "Wishlist", path: "/saved", protected: true }, // Wishlist
    { icon: Package, label: "My Content", path: "/mycontent", protected: true },
  ];


  const handleLogout = () => {
    signOut();
    onClose();
  };
  
  // Reworked Auth Display to be a list item
  const AuthDisplay = user ? (
    <li className="mt-4 pt-4 border-t border-gray-200">
      <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Account</p>
      {/* User Name/Icon Link (New) */}
      <Link
        to="/profile"
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 group"
      >
        <User className="h-5 w-5 text-blue-600 group-hover:text-blue-700 transition-colors" />
        <span className="font-medium truncate">
          {user.name || "My Profile"} {/* Assuming user object has a name */}
        </span>
      </Link>
      {/* Logout Button (New) */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-all duration-200 group"
      >
        <LogOut className="h-5 w-5 group-hover:text-red-700 transition-colors" />
        <span className="font-medium">Logout</span>
      </button>
    </li>
  ) : (
    // Login/Register Link (New)
    <li className="mt-4 pt-4 border-t border-gray-200">
      <Link
        to="/auth"
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-all duration-200 group"
      >
        <LogIn className="h-5 w-5 group-hover:text-blue-700 transition-colors" />
        <span className="font-medium">Login / Register</span>
      </Link>
    </li>
  );


  return (
    <div className="flex flex-col h-full bg-white text-gray-800">
      {/* Header section with logo, name, and paragraph */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-blue font-bold text-lg">
            T
          </div>
          <div>
            <span className="font-bold text-base text-gray-900 block">
              TripTrac
            </span>
            <p className="text-xs text-gray-500">Explore the world</p>
          </div>
        </div>
      </div>
      
      {/* Navigation links section (Scrollbar hidden) */}
      <nav 
        className="flex-1 p-4 pt-6 overflow-y-auto 
                   [&::-webkit-scrollbar]:hidden 
                   [-ms-overflow-style:none] 
                   [scrollbar-width:none]"
      >
        <ul className="space-y-2">
          
          {/* 1. HOME, MY BOOKINGS, WISHLIST (TOP SECTION) */}
          <li className="mb-4 pt-2">
            <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Navigation</p>
            <ul className="space-y-1">
              {topContentItems.map((item, index) => (
                <li key={item.path}>
                  {/* Home is a link, others are buttons for protected navigation */}
                  {item.label === "Home" ? (
                    <Link
                      to={item.path}
                      onClick={onClose}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 group"
                    >
                      <item.icon className="h-5 w-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
                      <span className="font-medium">
                        {item.label}
                      </span>
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleProtectedNavigation(item.path)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 group"
                    >
                      <item.icon className="h-5 w-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
                      <span className="font-medium">
                        {item.label}
                      </span>
                    </button>
                  )}
                  {/* ADD DARK MODE TOGGLE AND REMOVED CHANGE NAME BUTTON */}
                  {item.label === "Wishlist" && (
                    <>
                      {/* Dark/Light Mode Toggle (NEW) */}
                      <ThemeToggle onClose={onClose} />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </li>
          
          {/* 2. PARTNER LINKS (MIDDLE SECTION) */}
          <li className="mb-4 pt-4 border-t border-gray-200">
            <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Partner</p>
            <ul className="space-y-1">
              {partnerItems.map((item) => (
                <li key={item.path}>
                  <button
                    onClick={() => handleProtectedNavigation(item.path)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 group"
                  >
                    <item.icon className="h-5 w-5 text-blue-600 group-hover:text-blue-700 transition-colors" />
                    <span className="font-medium"> 
                      {item.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>

          {/* 3. VLOG, CONTACT, ABOUT (BOTTOM SECTION) */}
          <li className="mb-4 pt-4 border-t border-gray-200">
            <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Company</p>
            <ul className="space-y-1">
              {bottomNavItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 group"
                  >
                    <item.icon className="h-5 w-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
                    <span className="font-medium">
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