import { ReactNode, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X, MapPin, Compass, Heart, Ticket, LogIn, UserPlus, Sparkles,
  User, LogOut, Briefcase, ChevronRight,
  CreditCard, Shield, UserCog, CalendarCheck,
  Settings, LayoutDashboard, Users,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════
   GUEST PANEL
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
    <div className="flex flex-col h-full bg-background">
      {/* Hero banner */}
      <div
        className="relative px-5 pt-10 pb-8 flex-shrink-0 overflow-hidden"
        style={{ background: "linear-gradient(135deg,#008080 0%,#005f5f 100%)" }}
      >
        <div className="pointer-events-none absolute -top-6 -right-6 h-28 w-28 rounded-full border-[3px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full border-[2px] border-white/10" />

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-7 w-7 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-white" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="h-[18px] w-[18px] text-white" />
          </div>
          <span className="text-white font-extrabold text-lg tracking-tight italic">RealTravo</span>
        </div>

        <h2 className="text-2xl font-black text-white leading-tight mb-1.5">
          Travel smarter,<br />host better.
        </h2>
        <p className="text-white/60 text-xs font-medium">
          Join thousands of travellers &amp; hosts.
        </p>
      </div>

      {/* Perks + CTAs */}
      <div className="px-4 py-5 flex-1 overflow-y-auto">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground mb-3">
          What you unlock
        </p>

        <div className="space-y-2 mb-6">
          {perks.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/40"
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-xs font-semibold text-foreground leading-snug">{text}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2.5">
          <button
            onClick={() => go("/auth?mode=signup")}
            className="w-full h-12 rounded-xl flex items-center justify-center gap-2.5 font-black text-sm text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#008080 0%,#005f5f 100%)" }}
          >
            <UserPlus className="h-4 w-4" />
            Create a free account
          </button>

          <button
            onClick={() => go("/auth?mode=login")}
            className="w-full h-12 rounded-xl flex items-center justify-center gap-2.5 font-bold text-sm text-foreground border border-border hover:bg-muted transition-all active:scale-95"
          >
            <LogIn className="h-4 w-4" />
            Log in to my account
          </button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4 leading-relaxed">
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
   AUTHENTICATED PANEL — full original with all tool sections
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
        { icon: Briefcase,      label: "Become a Host",     path: "/become-host",   show: true },
        { icon: LayoutDashboard,label: "My Listings",       path: "/my-listing",    show: true },
        { icon: CalendarCheck,  label: "My Host Bookings",  path: "/host-bookings", show: true },
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
        { icon: Shield,       label: "Admin Dashboard",      path: "/admin",                        show: userRole === "admin" },
        { icon: UserCog,      label: "Host Verification",    path: "/admin/verification",            show: userRole === "admin" },
        { icon: CreditCard,   label: "Payment Verification", path: "/admin/payment-verification",   show: userRole === "admin" },
        { icon: Users,        label: "Accounts Overview",    path: "/admin/accounts",               show: userRole === "admin" },
        { icon: Settings,     label: "Referral Settings",    path: "/admin/referral-settings",      show: userRole === "admin" },
        { icon: CalendarCheck,label: "All Bookings",         path: "/admin/all-bookings",           show: userRole === "admin" },
      ],
    },
  ];

  /* Generic menu row */
  const MenuRow = ({ item }: { item: { icon: any; label: string; path: string } }) => (
    <button
      onClick={() => go(item.path)}
      className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/60 transition-colors group"
    >
      <div className="flex items-center gap-2.5">
        <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <item.icon className="h-3 w-3 text-primary" />
        </div>
        <span className="text-xs font-medium text-foreground">{item.label}</span>
      </div>
      <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Header ── */}
      <div className="bg-primary px-4 pt-4 pb-4 relative flex-shrink-0">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3.5 right-3.5 h-6 w-6 rounded-full bg-primary-foreground/15 flex items-center justify-center hover:bg-primary-foreground/25 transition-colors"
        >
          <X className="h-3 w-3 text-primary-foreground" />
        </button>

        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary-foreground/40 mb-2.5">
          My Account
        </p>

        {loading ? (
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-10 w-10 rounded-xl bg-primary-foreground/20" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24 bg-primary-foreground/20 rounded" />
              <Skeleton className="h-2 w-14 bg-primary-foreground/20 rounded" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="h-10 w-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center overflow-hidden border border-primary-foreground/20">
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={userName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xs font-black text-primary-foreground">{initials}</span>
                )}
              </div>
              {/* Online dot */}
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 border-[1.5px] border-primary" />
            </div>

            {/* Name + role badge */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-primary-foreground truncate leading-tight">
                {userName}
              </p>
              <span
                className={`inline-block mt-0.5 px-1.5 py-px rounded-full text-[9px] font-black uppercase tracking-wider ${
                  userRole === "admin"
                    ? "bg-yellow-400/25 text-yellow-200"
                    : "bg-primary-foreground/15 text-primary-foreground/55"
                }`}
              >
                {userRole === "admin" ? "Admin" : "Member"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Scrollable menu ── */}
      <div className="flex-1 overflow-y-auto bg-background py-2.5 px-2.5 space-y-2.5">

        {/* Creator Tools + Personal */}
        {menuItems
          .filter((s) => s.section !== "Admin Control")
          .map((section, idx) => {
            const visible = section.items.filter((i) => i.show);
            if (!visible.length) return null;
            return (
              <div key={idx}>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.22em] px-1 mb-1">
                  {section.section}
                </p>
                <div className="rounded-xl overflow-hidden border border-border bg-card divide-y divide-border/50">
                  {visible.map((item) => (
                    <MenuRow key={item.path} item={item} />
                  ))}
                </div>
              </div>
            );
          })}

        {/* Admin Control — amber tinted, only shown to admins */}
        {loading ? (
          <Skeleton className="h-10 w-full rounded-xl" />
        ) : (
          menuItems
            .filter((s) => s.section === "Admin Control")
            .map((section, idx) => {
              const visible = section.items.filter((i) => i.show);
              if (!visible.length) return null;
              return (
                <div key={`admin-${idx}`}>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.22em] px-1 mb-1">
                    {section.section}
                  </p>
                  <div className="rounded-xl overflow-hidden border border-amber-200/60 bg-amber-50/30 dark:bg-amber-900/10 dark:border-amber-700/30 divide-y divide-amber-100/60 dark:divide-amber-800/30">
                    {visible.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => go(item.path)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-6 w-6 rounded-md bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                            <item.icon className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                          </div>
                          <span className="text-xs font-medium text-foreground">{item.label}</span>
                        </div>
                        <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
        )}

        {/* Log Out */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors group"
        >
          <div className="h-6 w-6 rounded-md bg-destructive/10 group-hover:bg-destructive flex items-center justify-center flex-shrink-0 transition-colors">
            <LogOut className="h-3 w-3 text-destructive group-hover:text-destructive-foreground transition-colors" />
          </div>
          <span className="text-xs font-semibold text-destructive">Log Out</span>
        </button>

        <div className="h-1" />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   ACCOUNT SHEET — main export
   • w-[85vw] max-w-[360px] — constrained on desktop, no full stretch
   • GuestPanel for logged-out users (styled sheet, no popover)
   • AuthenticatedPanel with all original tool sections for logged-in users
══════════════════════════════════════════════════════════════════ */
interface AccountSheetProps {
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
        className="w-[85vw] max-w-[360px] p-0 border-none flex flex-col [&>button]:hidden"
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
      </SheetContent>
    </Sheet>
  );
};