import { useState, useEffect } from "react";
import { Menu, Heart, Ticket, Video, Shield, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setUserRole(null);
        setProfilePicture(null);
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

      // Fetch profile picture and name
      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_picture_url, name")
        .eq("id", user.id)
        .single();

      if (profile) {
        if (profile.profile_picture_url) {
          setProfilePicture(profile.profile_picture_url);
        }
        if (profile.name) {
          // Extract first name (text before first space)
          const firstName = profile.name.split(" ")[0];
          setUserName(firstName);
        }
      }
    };

    checkRole();
  }, [user]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-blue-900 text-white">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-blue-800 lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <NavigationDrawer onClose={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-blue-900 font-bold text-lg">
              T
            </div>
            <span className="font-bold text-base md:text-lg text-white">
              TripTrac
            </span>
          </Link>
        </div>

        {/* 5. Updated navigation links for white text and blue-200 hover */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold hover:text-blue-200 transition-colors">
            <Home className="h-4 w-4" />
            Home
          </Link>
          <Link to="/bookings" className="flex items-center gap-2 font-bold hover:text-blue-200 transition-colors">
            <Ticket className="h-4 w-4" />
            My Bookings
          </Link>
          {user && (
            <Link to="/saved" className="flex items-center gap-2 font-bold hover:text-blue-200 transition-colors">
              <Heart className="h-4 w-4" />
              Saved
            </Link>
          )}
          <Link to="/vlog" className="flex items-center gap-2 font-bold hover:text-blue-200 transition-colors">
            <Video className="h-4 w-4" />
            Vlog
          </Link>
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* 6. Adjusted user name display color and hover */}
            <Button variant="ghost" className="flex items-center gap-2 h-auto px-2 text-white hover:bg-blue-800">
              <span className="hidden md:inline text-sm font-medium">
                {userName || user?.user_metadata?.name || user?.email || "Guest"}
              </span>
              <Avatar className="h-8 w-8">
                <AvatarImage src={profilePicture || user?.user_metadata?.profile_picture_url} />
                {/* Avatar Fallback now uses blue-900 text color */}
                <AvatarFallback className="bg-white text-blue-900 text-xs"> 
                  {userName?.[0]?.toUpperCase() || user?.user_metadata?.name?.charAt(0) || user?.email?.charAt(0) || "G"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
<DropdownMenuContent 
            align="end" 
            // MODIFIED: Changed width to 50vw and added rounded-none to remove the border radius
            className="w-[20vw] rounded-none bg-popover"
          >
            {user ? (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">Profile</Link>
                </DropdownMenuItem>
                {userRole === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
                  Sign Out
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem asChild>
                <Link to="/auth" className="w-full">
                  <Button variant="default" className="w-full">Login</Button>
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
