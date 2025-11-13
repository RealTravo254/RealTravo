import { Home, Ticket, Heart, Phone, Info, Video, Plus, Edit, Package, LogIn, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  // DropdownMenu, // REMOVED
  // DropdownMenuContent, // REMOVED
  // DropdownMenuItem, // REMOVED
  // DropdownMenuTrigger, // REMOVED
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface NavigationDrawerProps {
  onClose: () => void;
}

export const NavigationDrawer = ({ onClose }: NavigationDrawerProps) => {
  const { user, logout } = useAuth(); // Assuming useAuth provides a logout function
  
  // Note: The paths here (/CreateHotel, /CreateAdventure, /createTripEvent) 
  // correspond directly to the page components you listed (CreateHotel.tsx, etc.) 
  // and should be handled by your main application router.
  
  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Ticket, label: "My Bookings", path: "/bookings" },
    { icon: Video, label: "Vlog", path: "/vlog" },
    ...(user ? [{ icon: Heart, label: "Saved", path: "/saved" }] : []),
    // 'My Content' links to 'MyContent.tsx' page
    ...(user ? [{ icon: Package, label: "My Content", path: "/mycontent" }] : []), 
    { icon: Phone, label: "Contact", path: "/contact" },
    { icon: Info, label: "About", path: "/about" },
  ];

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
      {/* Changed background to bg-blue-900 (Deep Navy) */}
      <div className="p-6 border-b bg-blue-900"> 

        <div className="flex items-center gap-3">

          {/* Changed logo background to white, text to blue-900 (Navy) */}
          <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center text-blue-900 font-bold text-xl">
            T
          </div>

          <div>
            {/* Site name remains white */}
            <h2 className="font-bold text-lg text-white">
              TripTrac
            </h2>
            {/* Changed tagline text to text-blue-200 (Lighter blue for contrast) */}
            <p className="text-xs text-blue-200">Explore the world</p>

          </div>

        </div>

      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          
          {/* VERTICAL PARTNER CREATION LINKS (User Only) */}
          {user && (
            <li className="mb-4 pt-2 pb-2 border-b border-t border-muted">
              <h4 className="font-semibold text-sm text-primary/80 mb-2 px-4">
                Become a Partner
              </h4>
              <div className="space-y-1">
                {/* Organise a Trip or Event */}
                <Link 
                  to="/CreateTripEvent" // Links to CreateTripEvent.tsx
                  onClick={onClose} 
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-primary/10 transition-all duration-200 group"
                >
                  <Package className="h-5 w-5 text-green-600 group-hover:text-primary transition-colors" />
                  <span className="font-bold group-hover:text-primary transition-colors">
                    Organise a Trip or Event
                  </span>
                </Link>

                {/* List Your Hotel or Accommodation */}
                <Link 
                  to="/CreateHotel" // Links to CreateHotel.tsx
                  onClick={onClose} 
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-primary/10 transition-all duration-200 group"
                >
                  <Home className="h-5 w-5 text-blue-600 group-hover:text-primary transition-colors" />
                  <span className="font-bold group-hover:text-primary transition-colors">
                    List Your Hotel or Accommodation
                  </span>
                </Link>
                
                {/* List Your Campsite or Space */}
                <Link 
                  to="/CreateAdventure" // Links to CreateAdventure.tsx
                  onClick={onClose} 
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-primary/10 transition-all duration-200 group"
                >
                  <Heart className="h-5 w-5 text-red-600 group-hover:text-primary transition-colors" />
                  <span className="font-bold group-hover:text-primary transition-colors">
                    List Your Campsite or Experience
                  </span>
                </Link>
              </div>
            </li>
          )}
          
          {/* EDIT PROFILE LINK (User Only) */}
          {user && (
            <li>
              <Link
                to="/profile/edit" // Links to ProfileEdit.tsx
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-primary/10 transition-all duration-200 group"
              >
                <Edit className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="font-medium group-hover:text-primary transition-colors">
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
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-primary/10 transition-all duration-200 group"
              >
                <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="font-medium group-hover:text-primary transition-colors">
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
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 text-primary-foreground hover:bg-red-700 transition-all duration-200"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Logout</span>
              </Button>
            </li>
          ) : (
            // LOGIN BUTTON (Guest Only)
            <li className="mt-4">
              <Link
                to="/auth" // Links to Auth.tsx
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
              >
                <LogIn className="h-5 w-5" />
                <span className="font-medium">Login</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>
      {/* Changed background to bg-blue-900 and border to border-blue-600 */}
      <div className="p-6 border-t border-blue-600 bg-blue-900"> 
        {/* Changed text color to text-blue-200 */}
        <p className="text-xs text-blue-200 text-center"> 
          © 2025 TripTrac. All rights reserved.
        </p>
      </div>
    </div>
   );

};