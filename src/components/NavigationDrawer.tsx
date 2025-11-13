import { Home, Ticket, Heart, Phone, Info, Video, Plus, Edit, Package, LogIn, LogOut, Plane, Building, Tent } from "lucide-react"; // Added Plane, Building, Tent
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

  // Define the new 'Partner' items with specific icons
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

  return (
    // PRIMARY CHANGE: Entire body background is dark navyblue (bg-blue-950)
    <div className="flex flex-col h-full bg-blue-950">
      {/* Header section - kept blue-900 for a slight color difference, but white text is maintained */}
      <div className="p-6 border-b border-blue-800 bg-blue-900"> 

        <div className="flex items-center gap-3">

          {/* Logo background remains white, text is blue-900 (Navy) */}
          <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center text-blue-900 font-bold text-xl">
            T
          </div>

          <div>
            {/* Site name remains white */}
            <h2 className="font-bold text-lg text-white">
              TripTrac
            </h2>
            {/* Tagline text remains lighter blue for contrast */}
            <p className="text-xs text-blue-200">Explore the world</p>

          </div>

        </div>

      </div>

      {/* Navigation links section */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {/* PARTNER LINKS - Visible to all users */}
          <li className="mb-4 pt-2 border-t border-blue-800">
            <ul className="space-y-1">
              {partnerItems.map((item) => (
                <li key={item.path}>
                  <button
                    onClick={() => handleProtectedNavigation(item.path)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-white/10 transition-all duration-200 group"
                  >
                    <item.icon className="h-5 w-5 text-white group-hover:text-white transition-colors" />
                    <span className="font-medium text-white group-hover:text-white transition-colors"> 
                      {item.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>

          {/* MY CONTENT LINKS - Visible to all, protected */}
          <li className="mb-4 border-t border-blue-800 pt-2">
            <p className="px-4 py-2 text-xs font-semibold text-blue-200 uppercase">My Content</p>
            <ul className="space-y-1">
              {myContentItems.map((item) => (
                <li key={item.path}>
                  <button
                    onClick={() => handleProtectedNavigation(item.path)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-white/10 transition-all duration-200 group"
                  >
                    <item.icon className="h-5 w-5 text-white group-hover:text-white transition-colors" />
                    <span className="font-medium text-white group-hover:text-white transition-colors">
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
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-all duration-200 group"
              >
                <Edit className="h-5 w-5 text-white group-hover:text-white transition-colors" />
                <span className="font-medium text-white group-hover:text-white transition-colors">
                  Edit Profile
                </span>
              </Link>
            </li>
          )}
          
          {/* MAIN NAVIGATION ITEMS */}
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-all duration-200 group"
              >
                <item.icon className="h-5 w-5 text-white group-hover:text-white transition-colors" />
                <span className="font-medium text-white group-hover:text-white transition-colors">
                  {item.label}
                </span>
              </Link>
            </li>
          ))}

          {/* AUTHENTICATION BUTTONS */}
          {user ? (
            // LOGOUT BUTTON (User Only)
            <li className="mt-4">
              <Button
                onClick={handleLogout}
                // Kept red for logout, ensuring text is white (text-white)
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all duration-200"
              >
                {/* Icon is white (inherited from button text-white) */}
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Logout</span>
              </Button>
            </li>
          ) : (
            // LOGIN BUTTON (Guest Only)
            <li className="mt-4">
            </li>
          )}
        </ul>
      </nav>
      {/* Removed the extra background/border classes at the bottom as bg-blue-950 covers the full height */}
    </div>
   ); 
};