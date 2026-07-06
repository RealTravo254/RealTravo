import { ReactNode, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X, MapPin, Compass, Heart, Ticket, LogIn, UserPlus, Sparkles,
  User, LogOut, Briefcase, ChevronRight,
  CreditCard, Shield, CalendarCheck,
  LayoutDashboard,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════
   GUEST PANEL (COMPACT WITH BOTTOM ROW BUTTONS)
══════════════════════════════════════════════════════════════════ */
const GuestPanel = ({ onClose }: { onClose: () => void }) => {
  const navigate = useNavigate();
  const go = (path: string) => { onClose(); navigate(path); };

  const perks = [
    { icon: Heart,   text: "Save your favourite stays & experiences"  },
    { icon: Ticket,  text: "View and manage your bookings anytime"     },
    { icon: Compass, text: "Get personalised travel recommendations"   },
    { icon: MapPin,  text: "Become a host and earn from your property" },
  ];

  return (
    <div className="flex flex-col h-full bg-background justify-between">
      <div>
        {/* Mini Hero Banner */}
        <div
          className="relative px-4 pt-6 pb-4 flex-shrink-0 overflow-hidden"
          style={{ background: "linear-gradient(135deg,#008080 0%,#005f5f 100%)" }}
        >
          <div className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full border border-white/10" />

          {/* Single Integrated Close Button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 h-6 w-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/25 transition-colors"
          >
            <X className="h-3 w-3 text-white" />
          </button>

          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-4 w-4 text-white" />
            <span className="text-white font-extrabold text-base tracking-tight italic">Real Travo</span>
          </div>

          <h2 className="text-lg font-black text-white leading-tight mb-0.5">
            Travel smarter, host better.
          </h2>
          <p className="text-white/60 text-[11px] font-medium">
            Join thousands of travellers &amp; hosts.
          </p>
        </div>

        {/* Perks Content Area */}
        <div className="px-3 py-3 space-y-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
              What you unlock
            </p>
            <div className="space-y-1">
              {perks.map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/40 border border-border/30"
                >
                  <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-3 w-3 text-primary" />
                  </div>
                  <p className="text-[11px] font-medium text-foreground leading-tight">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Persistent Bottom Action Footer */}
      <div className="p-3 border-t bg-muted/20 space-y-2 mt-auto">
        <div className="flex gap-2">
          <button
            onClick={() => go("/auth?mode=signup")}
            className="flex-1 h-8 rounded-md flex items-center justify-center gap-1.5 font-black text-[11px] text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#008080 0%,#005f5f 100%)" }}
          >
            <UserPlus className="h-3 w-3" />
            Sign Up
          </button>

          <button
            onClick={() => go("/auth?mode=login")}
            className="flex-1 h-8 rounded-md flex items-center justify-center gap-1.5 font-bold text-[11px] text-foreground border border-border bg-background hover:bg-muted transition-all active:scale-95"
          >
            <LogIn className="h-3 w-3" />
            Log In
          </button>
        </div>

        <p className="text-center text-[9px] text-muted-foreground leading-none">
          By continuing you agree to our{" "}
          <button
            onClick={() => go("/privacy-policy")}
            className="underline underline-offset-2 font-semibold hover:text-primary transition-colors"
          >
            Privacy Policy
          </button>
          .
        </p>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   AUTHENTICATED PANEL
══════════════════════════════════════════════════════════════════ */
const AuthenticatedPanel = ({ onClose }: { onClose: () => void }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading]       = useState(true);
  const [userName, setUserName]     = useState("");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userRole, setUserRole]     = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      try {
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("name, profile_picture_url").eq("id", user.id).single(),
          supabase.from("user_roles").select("role").eq("user_id", user.id),
        ]);
        if (profileRes.data) {
          setUserName(profileRes.data.name || "User");
          setUserAvatar(profileRes.data.profile_picture_url || null);
        }
        if (rolesRes.data && rolesRes.data.length > 0) {
          const roleList = rolesRes.data.map((r) => r.role);
          setUserRole(roleList.includes("admin") ? "admin" : "user");
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const go = (path: string) => { onClose(); navigate(path); };
  const handleLogout = async () => { onClose(); await signOut(); };

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const menuItems = [
    {
      section: "Creator Tools",
      items: [
        { icon: Briefcase,       label: "Become a Host",    path: "/become-host",   show: true },
        { icon: LayoutDashboard, label: "My Listings",        path: "/my-listing",    show: true },
        { icon: CalendarCheck,   label: "My Host Bookings",  path: "/host-bookings", show: true },
      ],
    },
    {
      section: "Personal",
      items: [
        { icon: User,       label: "Profile & Security",   path: "/profile/edit", show: true },
        { icon: CreditCard, label: "Payments & Earnings",  path: "/payment",      show: true },
      ],
    },
    {
      section: "Admin Control",
      items: [
        { icon: Shield, label: "Admin Access", path: "/admin", show: userRole === "admin" },
      ],
    },
  ];

  const MenuRow = ({ item }: { item: { icon: any; label: string; path: string } }) => (
    <button
      onClick={() => go(item.path)}
      className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-muted/60 transition-colors group"
    >
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
          <item.icon className="h-2.5 w-2.5 text-primary" />
        </div>
        <span className="text-[11px] font-medium text-foreground">{item.label}</span>
      </div>
      <ChevronRight className="h-2.5 w-2.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-5 pb-3.5 relative flex-shrink-0">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
        >
          <X className="h-3 w-3 text-primary-foreground" />
        </button>

        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-primary-foreground/40 mb-2">
          My Account
        </p>

        {loading ? (
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg bg-primary-foreground/20" />
            <div className="space-y-1">
              <Skeleton className="h-2.5 w-20 bg-primary-foreground/20 rounded" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-shrink-0">
              <div className="h-8 w-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center overflow-hidden border border-primary-foreground/15">
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={userName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-[11px] font-black text-primary-foreground">{initials}</span>
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-400 border border-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-primary-foreground truncate leading-tight">
                {userName}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-background py-2 px-2 space-y-2">
        {menuItems
          .filter((s) => s.section !== "Admin Control")
          .map((section, idx) => {
            const visible = section.items.filter((i) => i.show);
            if (!visible.length) return null;
            return (
              <div key={idx}>
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.18em] px-1 mb-0.5">
                  {section.section}
                </p>
                <div className="rounded-lg overflow-hidden border border-border bg-card divide-y divide-border/40">
                  {visible.map((item) => (
                    <MenuRow key={item.path} item={item} />
                  ))}
                </div>
              </div>
            );
          })}

        {!loading && menuItems
          .filter((s) => s.section === "Admin Control")
          .map((section, idx) => {
            const visible = section.items.filter((i) => i.show);
            if (!visible.length) return null;
            return (
              <div key={`admin-${idx}`}>
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.18em] px-1 mb-0.5">
                  {section.section}
                </p>
                <div className="rounded-lg overflow-hidden border border-amber-200/40 bg-amber-50/20 dark:bg-amber-900/5 dark:border-amber-700/20 divide-y divide-amber-100/40 dark:divide-amber-800/20">
                  {visible.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => go(item.path)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-amber-50/60 dark:hover:bg-amber-900/10 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded bg-amber-400/15 flex items-center justify-center flex-shrink-0">
                          <item.icon className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-[11px] font-medium text-foreground">{item.label}</span>
                      </div>
                      <ChevronRight className="h-2.5 w-2.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-destructive/10 bg-destructive/5 hover:bg-destructive/10 transition-colors group"
        >
          <div className="h-5 w-5 rounded bg-destructive/10 group-hover:bg-destructive flex items-center justify-center flex-shrink-0 transition-colors">
            <LogOut className="h-2.5 w-2.5 text-destructive group-hover:text-destructive-foreground transition-colors" />
          </div>
          <span className="text-[11px] font-semibold text-destructive">Log Out</span>
        </button>
      </div>
    </div>
  );
};

export interface AccountSheetProps {
  children: ReactNode;
}

export const AccountSheet = ({ children }: AccountSheetProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>

      <SheetContent
        side="right"
        className="w-[80vw] max-w-[310px] p-0 border-none flex flex-col [&>button]:hidden"
      >
        {/* Wrapper div applied here to correctly type safe-area padding styles */}
        <div 
          className="flex flex-col h-full w-full"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {user ? (
            <AuthenticatedPanel onClose={() => setOpen(false)} />
          ) : (
            <GuestPanel onClose={() => setOpen(false)} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};