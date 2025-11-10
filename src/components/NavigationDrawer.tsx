import { Home, Ticket, Heart, Phone, Info, Video, Plus, Edit, Package, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface NavigationDrawerProps {
  onClose: () => void;
}

export const NavigationDrawer = ({ onClose }: NavigationDrawerProps) => {
  const { user } = useAuth();
  
  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Ticket, label: "My Bookings", path: "/bookings" },
    { icon: Video, label: "Vlog", path: "/vlog" },
    ...(user ? [{ icon: Heart, label: "Saved", path: "/saved" }] : []),
    ...(user ? [{ icon: Package, label: "My Content", path: "/my-content" }] : []),
    { icon: Phone, label: "Contact", path: "/contact" },
    { icon: Info, label: "About", path: "/about" },
  ];

  return (
    // Base drawer styling kept the same, relying on header/footer styles for color
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
          {user && (
            <li className="mb-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" className="w-full flex items-center justify-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link 
                      to="/create-trip-event" 
                      onClick={onClose} 
                      className="cursor-pointer"
                    >
                      Trip & Event
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link 
                      to="/create-hotel" 
                      onClick={onClose} 
                      className="cursor-pointer"
                    >
                      Hotel & Accommodation
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link 
                      to="/create-adventure" 
                      onClick={onClose} 
                      className="cursor-pointer"
                    >
                      Place to Adventure
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )}

          {user && (
            <li>
              <Link
                to="/profile/edit"
                onClick={onClose}
                // Link styling remains dark-theme-friendly (hover:bg-primary/10)
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-primary/10 transition-all duration-200 group"
              >
                <Edit className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="font-medium group-hover:text-primary transition-colors">
                  Edit Profile
                </span>
              </Link>
            </li>
          )}
          
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={onClose}
                // Link styling remains dark-theme-friendly (hover:bg-primary/10)
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-primary/10 transition-all duration-200 group"
              >
                <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="font-medium group-hover:text-primary transition-colors">
                  {item.label}
                </span>
              </Link>
            </li>
          ))}

          {!user && (
            <li className="mt-4">
              <Link
                to="/auth"
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