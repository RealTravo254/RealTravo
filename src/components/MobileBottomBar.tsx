import { Home, Ticket, Heart, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// Define the requested Teal color
const TEAL_ACTIVE_COLOR = "#008080"; 

export const MobileBottomBar = () => {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Ticket, label: "Bookings", path: "/bookings" },
    { icon: Heart, label: "Wishlist", path: "/saved" },
    { icon: User, label: "Account", path: user ? "/account" : "/auth" },
  ];

  return (
    // Background is white and border is light gray
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <nav className="flex items-center justify-around h-16 px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          // Determine the color based on the state
          const activeColorStyle = { 
            color: TEAL_ACTIVE_COLOR 
          };

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] py-2 px-4 rounded-lg transition-all duration-200",
                // Inactive icon and text color is Dark Gray (text-gray-700)
                // On hover, it transitions to the Active Teal color for feedback
                isActive 
                  ? "" // Active state uses inline style below
                  : "text-gray-700 hover:text-teal-600" // Use a similar Tailwind teal for a natural hover effect
              )}
              // The inline style for active state is applied only if active
              style={isActive ? activeColorStyle : undefined}
            >
              <item.icon 
                className={cn(
                  "h-5 w-5", 
                  isActive ? "scale-110" : ""
                )} 
                // Apply the Teal color explicitly to the icon if active
                style={isActive ? activeColorStyle : undefined}
              />
              <span 
                className="text-xs font-medium" 
                // Apply the Teal color explicitly to the text if active
                style={isActive ? activeColorStyle : undefined}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};