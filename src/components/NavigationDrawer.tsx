import { Home, Ticket, Heart, Phone, Info, Video, Plus, Edit, Package, LogIn, LogOut, Plane, Building, Tent } from "lucide-react"; 
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  // Removed DropdownMenu components
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface NavigationDrawerProps {
  onClose: () => void;
}

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

  const navItems = [
    { icon: Home, label: "Home", path: "/", protected: false },
    { icon: Video, label: "Vlog", path: "/vlog", protected: false },
    { icon: Phone, label: "Contact", path: "/contact", protected: false },
    { icon: Info, label: "About", path: "/about", protected: false },
  ];

  const myContentItems = [
    { icon: Ticket, label: "My Bookings", path: "/bookings", protected: true },
    { icon: Heart, label: "Saved", path: "/saved", protected: true },
    { icon: Package, label: "My Content", path: "/mycontent", protected: true },
  ];

  const handleLogout = () => {
    signOut();
    onClose();
  };
  
  // Conditionally render the Auth button
  const AuthButton = user ? (
    <Button
      onClick={handleLogout}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all duration-200"
    >
      <LogOut className="h-5 w-5" />
      <span className="font-medium">Logout</span>
    </Button>
  ) : (
    <Link
      to="/auth"
      onClick={onClose}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200"
    >
      <LogIn className="h-5 w-5" />
      <span className="font-medium">Login / Register</span>
    </Link>
  );


  return (
    <div className="flex flex-col h-full bg-white text-gray-800">
      {/* Header section with logo, name, and paragraph */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
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
          
          {/* PARTNER LINKS */}
          <li className="mb-4 pt-2 border-t border-gray-200">
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
          
          {/* MAIN NAVIGATION ITEMS */}
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 group"
              >
                <item.icon className="h-5 w-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
                <span className="font-medium">
                  {item.label}
                </span>
              </Link>
            </li>
          ))}

          {/* MY CONTENT LINKS - Visible to all, protected */}
          <li className="mb-4 border-t border-gray-200 pt-2">
            <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">My Content</p>
            <ul className="space-y-1">
              {myContentItems.map((item) => (
                <li key={item.path}>
                  <button
                    onClick={() => handleProtectedNavigation(item.path)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 group"
                  >
                    <item.icon className="h-5 w-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
                    <span className="font-medium">
                      {item.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>

          {/* EDIT PROFILE LINK (User Only) */}
          {user && (
            <li>
              <Link
                to="/profile/edit"
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 group"
              >
                <Edit className="h-5 w-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
                <span className="font-medium">
                  Edit Profile
                </span>
              </Link>
            </li>
          )}
          
          {/* LOGIN/LOGOUT BUTTON */}
          <li className="pt-4 border-t border-gray-200">
            {AuthButton}
          </li>
        </ul>
      </nav>
      {/* The Footer section has been removed */}
    </div>
   ); 
   
};