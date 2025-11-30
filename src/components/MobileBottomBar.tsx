import { Home, Ticket, Heart, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 **bg-white** border-t **border-gray-200** shadow-lg">
      <nav className="flex items-center justify-around h-16 px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-all duration-200",
                isActive
                  ? "**text-gray-500**" // Active text color: gray-500
                  : "**text-[#008080]** hover:text-gray-500" // Inactive text color: Teal (#008080)
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5",
                  isActive
                    ? "**font-bold text-gray-700 scale-110**" // Active icon: bolder/darker gray/scaled
                    : "**text-[#008080]**" // Inactive icon: Teal (#008080)
                )}
              />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};