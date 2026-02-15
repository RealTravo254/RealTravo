import { useState, lazy, Suspense } from "react";
import { Home, Ticket, Heart, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { AccountSheet } from "@/components/AccountSheet";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TealLoader } from "@/components/ui/teal-loader";

const Bookings = lazy(() => import("@/pages/Bookings"));
const Saved = lazy(() => import("@/pages/Saved"));

const COLORS = {
  TEAL: "#008080",
  SOFT_GRAY: "#F8F9FA",
  CORAL: "#FF7F50"
};

export const MobileBottomBar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);

  const isProfileActive = false;

  const handleNavClick = (path: string, e: React.MouseEvent) => {
    if (path === "/bookings") {
      e.preventDefault();
      setBookingsOpen(true);
    } else if (path === "/saved") {
      e.preventDefault();
      setSavedOpen(true);
    }
  };

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Ticket, label: "Bookings", path: "/bookings" },
    { icon: Heart, label: "Saved", path: "/saved" },
  ];

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-xl border-t border-slate-100 pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
        <nav className="flex items-center justify-around h-20 px-6">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isSheet = item.path === "/bookings" || item.path === "/saved";
            
            if (isSheet) {
              return (
                <button
                  key={item.path}
                  onClick={(e) => handleNavClick(item.path, e)}
                  className="relative flex flex-col items-center justify-center group"
                >
                  <div 
                    className={cn(
                      "absolute -top-3 w-8 h-1 rounded-full transition-all duration-300",
                      isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"
                    )}
                    style={{ backgroundColor: COLORS.TEAL }}
                  />
                  <div className={cn("p-2 rounded-2xl transition-all duration-300 mb-1", "bg-transparent group-active:scale-90")}>
                    <item.icon className="h-5 w-5 transition-colors duration-300 text-slate-400" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] transition-colors duration-300 text-slate-400">
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative flex flex-col items-center justify-center group"
              >
                <div 
                  className={cn(
                    "absolute -top-3 w-8 h-1 rounded-full transition-all duration-300",
                    isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"
                  )}
                  style={{ backgroundColor: COLORS.TEAL }}
                />
                <div 
                  className={cn(
                    "p-2 rounded-2xl transition-all duration-300 mb-1",
                    isActive ? "bg-[#008080]/10" : "bg-transparent group-active:scale-90"
                  )}
                >
                  <item.icon 
                    className={cn("h-5 w-5 transition-colors duration-300", isActive ? "" : "text-slate-400")} 
                    style={isActive ? { color: COLORS.TEAL, fill: `${COLORS.TEAL}20` } : undefined}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span 
                  className={cn("text-[10px] font-black uppercase tracking-[0.1em] transition-colors duration-300", isActive ? "" : "text-slate-400")}
                  style={isActive ? { color: COLORS.TEAL } : undefined}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Profile Button */}
          {user ? (
            <AccountSheet>
              <button className="relative flex flex-col items-center justify-center group">
                <div className={cn("absolute -top-3 w-8 h-1 rounded-full transition-all duration-300", "opacity-0 scale-0")} style={{ backgroundColor: COLORS.TEAL }} />
                <div className={cn("p-2 rounded-2xl transition-all duration-300 mb-1", "bg-transparent group-active:scale-90")}>
                  <User className="h-5 w-5 transition-colors duration-300 text-slate-400" strokeWidth={2} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] transition-colors duration-300 text-slate-400">Profile</span>
              </button>
            </AccountSheet>
          ) : (
            <Link to="/auth" className="relative flex flex-col items-center justify-center group">
              <div className="p-2 rounded-2xl transition-all duration-300 mb-1 bg-transparent group-active:scale-90">
                <User className="h-5 w-5 transition-colors duration-300 text-slate-400" strokeWidth={2} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.1em] transition-colors duration-300 text-slate-400">Profile</span>
            </Link>
          )}
        </nav>
      </div>

      {/* Bookings Sheet */}
      <Sheet open={bookingsOpen} onOpenChange={setBookingsOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0 border-none overflow-y-auto">
          <Suspense fallback={<TealLoader />}>
            <Bookings />
          </Suspense>
        </SheetContent>
      </Sheet>

      {/* Saved Sheet */}
      <Sheet open={savedOpen} onOpenChange={setSavedOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0 border-none overflow-y-auto">
          <Suspense fallback={<TealLoader />}>
            <Saved />
          </Suspense>
        </SheetContent>
      </Sheet>
    </>
  );
};
