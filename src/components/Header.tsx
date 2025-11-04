import { useState, useEffect } from "react";
import { Menu, Heart, Ticket, Video, Shield, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
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

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setUserRole(null);
        return;
      }

      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (data && data.length > 0) {
        const roles = data.map(r => r.role);
        if (roles.includes("admin")) setUserRole("admin");
        else if (roles.includes("business")) setUserRole("business");
        else setUserRole("user");
      }
    };

    checkRole();
  }, [user]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-muted">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <NavigationDrawer onClose={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-bold text-lg">
              T
            </div>
            <span className="font-bold text-base md:text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              TripTrac
            </span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem asChild>
                <Link to="/create/trip-event" className="cursor-pointer">Trip & Event</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/create/hotel" className="cursor-pointer">Hotel & Accommodation</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/create/adventure" className="cursor-pointer">Place to Adventure</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/bookings" className="flex items-center gap-2 font-bold hover:text-primary transition-colors">
            <Ticket className="h-4 w-4" />
            My Bookings
          </Link>
          <Link to="/vlog" className="flex items-center gap-2 font-bold hover:text-primary transition-colors">
            <Video className="h-4 w-4" />
            Vlog
          </Link>
          <Link to="/saved" className="flex items-center gap-2 font-bold hover:text-primary transition-colors">
            <Heart className="h-4 w-4" />
            Saved
          </Link>
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-auto px-2">
              <span className="hidden md:inline text-sm font-medium">
                {user?.user_metadata?.name || user?.email || "Guest"}
              </span>
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.profile_picture_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user?.user_metadata?.name?.charAt(0) || user?.email?.charAt(0) || "G"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover">
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
