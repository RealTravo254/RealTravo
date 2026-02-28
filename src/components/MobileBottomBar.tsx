import { useState, lazy, Suspense } from "react";
import { Home, Ticket, Heart, User, ChevronLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { AccountSheet } from "@/components/AccountSheet";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TealLoader } from "@/components/ui/teal-loader";

const Bookings = lazy(() => import("@/pages/Bookings"));
const Saved = lazy(() => import("@/pages/Saved"));

const COLORS = {
  TEAL: "#008080",
  SOFT_GRAY: "#F8F9FA",
  CORAL: "#FF7F50",
};

export const MobileBottomBar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);

  const isAnySheetOpen = bookingsOpen || savedOpen;

  const handleNavClick = (path: string, e: React.MouseEvent) => {
    if (path === "/bookings") {
      e.preventDefault();
      setBookingsOpen(true);
      setSavedOpen(false);
    } else if (path === "/saved") {
      e.preventDefault();
      setSavedOpen(true);
      setBookingsOpen(false);
    }
  };

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Ticket, label: "Bookings", path: "/bookings" },
    { icon: Heart, label: "Saved", path: "/saved" },
  ];

  return (
    <>
      {/* ── Bottom Nav Bar ── */}
      <div className={cn("md:hidden fixed bottom-0 left-0 right-0 z-[110] bg-white/80 backdrop-blur-xl border-t border-slate-100 pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.04)]", isAnySheetOpen && "hidden")}>
        <nav className="flex items-center justify-around h-20 px-6">
          {navItems.map((item) => {
            const isSheetPath =
              item.path === "/bookings" || item.path === "/saved";

            const isActive =
              (location.pathname === item.path && !bookingsOpen && !savedOpen) ||
              (item.path === "/bookings" && bookingsOpen) ||
              (item.path === "/saved" && savedOpen);

            const NavContent = (
              <>
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
                    className={cn(
                      "h-5 w-5 transition-colors duration-300",
                      isActive ? "" : "text-slate-400"
                    )}
                    style={isActive ? { color: COLORS.TEAL, fill: `${COLORS.TEAL}20` } : undefined}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-black uppercase tracking-[0.1em] transition-colors duration-300",
                    isActive ? "" : "text-slate-400"
                  )}
                  style={isActive ? { color: COLORS.TEAL } : undefined}
                >
                  {item.label}
                </span>
              </>
            );

            if (isSheetPath) {
              return (
                <button
                  key={item.path}
                  onClick={(e) => handleNavClick(item.path, e)}
                  className="relative flex flex-col items-center justify-center group"
                >
                  {NavContent}
                </button>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  setBookingsOpen(false);
                  setSavedOpen(false);
                }}
                className="relative flex flex-col items-center justify-center group"
              >
                {NavContent}
              </Link>
            );
          })}

          {/* Profile Button */}
          {user ? (
            <AccountSheet>
              <button className="relative flex flex-col items-center justify-center group">
                <div
                  className={cn(
                    "absolute -top-3 w-8 h-1 rounded-full transition-all duration-300",
                    "opacity-0 scale-0"
                  )}
                  style={{ backgroundColor: COLORS.TEAL }}
                />
                <div className="p-2 rounded-2xl transition-all duration-300 mb-1 bg-transparent group-active:scale-90">
                  <User className="h-5 w-5 transition-colors duration-300 text-slate-400" strokeWidth={2} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] transition-colors duration-300 text-slate-400">
                  Profile
                </span>
              </button>
            </AccountSheet>
          ) : (
            <Link to="/auth" className="relative flex flex-col items-center justify-center group">
              <div className="p-2 rounded-2xl transition-all duration-300 mb-1 bg-transparent group-active:scale-90">
                <User className="h-5 w-5 transition-colors duration-300 text-slate-400" strokeWidth={2} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.1em] transition-colors duration-300 text-slate-400">
                Profile
              </span>
            </Link>
          )}
        </nav>
      </div>

      {/* ── Bookings Full-Page Sheet ── */}
      <Sheet open={bookingsOpen} onOpenChange={(open) => {
        setBookingsOpen(open);
        if (open) setSavedOpen(false);
      }}>
        <SheetContent
          side="bottom"
          className="h-[100dvh] rounded-none p-0 border-none flex flex-col z-[260] [&>button]:hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
            <button
              onClick={() => setBookingsOpen(false)}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Close bookings"
            >
              <ChevronLeft size={22} />
            </button>
            <h2 className="text-lg font-semibold">My Bookings</h2>
          </div>

          {/* Scrollable content — pb-24 clears the bottom nav */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain touch-pan-y pb-24 bg-white"
            onPointerDownCapture={(e) => e.stopPropagation()}
            onClickCapture={(e) => e.stopPropagation()}
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-20">
                  <TealLoader />
                </div>
              }
            >
              <Bookings />
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Saved Full-Page Sheet ── */}
      <Sheet open={savedOpen} onOpenChange={(open) => {
        setSavedOpen(open);
        if (open) setBookingsOpen(false);
      }}>
        <SheetContent
          side="bottom"
          className="h-[100dvh] rounded-none p-0 border-none flex flex-col z-[260] [&>button]:hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
            <button
              onClick={() => setSavedOpen(false)}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Close saved"
            >
              <ChevronLeft size={22} />
            </button>
            <h2 className="text-lg font-semibold">Saved Items</h2>
          </div>

          {/* Scrollable content — pb-24 clears the bottom nav */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain touch-pan-y pb-24 bg-white"
            onPointerDownCapture={(e) => e.stopPropagation()}
            onClickCapture={(e) => e.stopPropagation()}
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-20">
                  <TealLoader />
                </div>
              }
            >
              <Saved />
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};