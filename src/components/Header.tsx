import { useState, useEffect } from "react";
import { Menu, Heart, Ticket, Shield, Home, FolderOpen, User } from "lucide-react";
import { Button } from "@/components/ui/button";
// Avatar components are removed as per request to remove profile photo
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavigationDrawer } from "./NavigationDrawer";
import { Link } from "react-router-dom";

export const Header = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  // profilePicture state removed as per request to remove profile photo
  // const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setUserRole(null);
        // setProfilePicture(null); // Removed
        setUserName("");
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (data && data.length > 0) {
        const roles = data.map(r => r.role);
        if (roles.includes("admin")) setUserRole("admin");
        else setUserRole("user");
      }

      // Fetch profile name (profile picture fetching removed)
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      if (profile && profile.name) {
        // Extract first name (text before first space)
        const firstName = profile.name.split(" ")[0];
        setUserName(firstName);
      }
    };

    checkRole();
  }, [user]);

  // Determine the correct link for the account icon
  const accountLink = user ? "/profile/edit" : "/auth";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-blue-950 text-white h-16">
      <div className="container flex h-full items-center justify-between px-4">
        
        {/* Logo and Drawer Trigger (Left Side) */}
        <div className="flex items-center gap-3">
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-blue-800">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 h-screen">
              <NavigationDrawer onClose={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <Link to="/" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-blue-900 font-bold text-lg">
              T
            </div>
            <div>
              <span className="font-bold text-base md:text-lg text-white block">
                TripTrac
              </span>
              <p className="text-xs text-blue-200 hidden lg:block">Explore the world</p>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation (Centered) */}
        {/* Removed ml-auto and justify-center to center the nav relative to the container space */}
        <nav className="hidden lg:flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold hover:text-blue-200 transition-colors">
            <Home className="h-4 w-4" />
            {/* Name is now visible */}
            <span>Home</span>
          </Link>
          <Link to="/my-listing" className="flex items-center gap-2 font-bold hover:text-blue-200 transition-colors">
            <FolderOpen className="h-4 w-4" />
            {/* Name is now visible */}
            <span>My Listing</span>
          </Link>
          <Link to="/bookings" className="flex items-center gap-2 font-bold hover:text-blue-200 transition-colors">
            <Ticket className="h-4 w-4" />
            {/* Name is now visible */}
            <span>My Bookings</span>
          </Link>
          <Link to="/saved" className="flex items-center gap-2 font-bold hover:text-blue-200 transition-colors">
            <Heart className="h-4 w-4" />
            {/* Name is now visible */}
            <span>Saved</span>
          </Link>
        </nav>

        {/* Account Controls (Right Side) */}
        <div className="flex items-center gap-2">
            
            {/* Mobile Account Icon (Visible on small screens) */}
            <Link to={accountLink} className="lg:hidden">
              <Button variant="ghost" size="icon" className="text-white hover:bg-blue-800">
                <User className="h-5 w-5" />
              </Button>
            </Link>

            {/* Desktop Dropdown (Visible on large screens) */}
            <div className="hidden lg:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {user ? (
                    // Replaced Avatar/Name button with a simple User icon button
                    <Button variant="ghost" className="flex items-center gap-2 text-white hover:bg-blue-800">
                      <User className="h-6 w-6" /> {/* Account Icon */}
                      <span className="text-sm font-bold">
                        {userName || user.email?.split("@")[0] || "Account"}
                      </span>
                    </Button>
                  ) : (
                    <Button variant="ghost" className="text-white hover:bg-blue-800">
                      Login
                    </Button>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {user ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/profile/edit" className="cursor-pointer">
                          Profile Edit
                        </Link>
                      </DropdownMenuItem>
                      {userRole === "admin" && (
                        <DropdownMenuItem asChild>
                          <Link to="/admin/dashboard" className="cursor-pointer">
                            <Shield className="mr-2 h-4 w-4" />
                            Admin Dashboard
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                        Sign Out
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem asChild>
                      <Link to="/auth" className="cursor-pointer">
                        Login / Sign Up
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
        </div>

      </div>
    </header>
  );
  
};