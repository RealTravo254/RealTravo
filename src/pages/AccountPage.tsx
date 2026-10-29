import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import {
  User,
  List,
  ShieldCheck,
  Calendar,
  LogOut,
  ChevronRight,
  Compass,
  Building2,
  BadgeCheck,
  PlusCircle,
  HelpCircle,
  Settings,
  CreditCard,
  ShieldAlert,
  LayoutDashboard,
  Wallet,
  Briefcase,
} from "lucide-react";

interface UserProfile {
  full_name?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
}

interface NavItem {
  label: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  hidden?: boolean;
  accent?: boolean;
}

interface NavSection {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: NavItem[];
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-foreground leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Verification & Host Status States
  const [hostingCategory, setHostingCategory] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [hasCompany, setHasCompany] = useState(false);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  const [isAdventureHost, setIsAdventureHost] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const fetchUserData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Run all independent queries in parallel instead of sequentially.
      // This cuts load time from "sum of all 5 queries" to roughly
      // "the slowest single query" since none of them depend on each other.
      const [profileRes, verRes, companyRes, advRes, roleRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url, phone_number")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("host_verifications")
          .select("status, hosting_category")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("companies")
          .select("verification_status")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("adventure_places")
          .select("id")
          .eq("created_by", user.id)
          .limit(1),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
      }

      if (verRes.data) {
        setHostingCategory(verRes.data.hosting_category);
        setVerificationStatus(verRes.data.status);
      }

      if (companyRes.data) {
        setHasCompany(true);
        setCompanyStatus(companyRes.data.verification_status);
      }

      if (advRes.data && advRes.data.length > 0) {
        setIsAdventureHost(true);
      }

      if (
        roleRes.data ||
        user.app_metadata?.role === "admin" ||
        user.user_metadata?.is_admin
      ) {
        setIsAdmin(true);
      }
    } catch (err) {
      console.error("Error fetching account details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isGuideApproved = verificationStatus === "approved" && hostingCategory === "guide";
  const isCompanyApproved = hasCompany && companyStatus === "approved";
  const isHost = isAdventureHost || isGuideApproved || isCompanyApproved;

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User Account";

  // NOTE: no early-return spinner here. The page shell renders immediately;
  // only the bits that depend on fetched data (name, badges, admin/host
  // banners, host-only nav item) show a skeleton or are omitted until
  // `loading` is false.

  const sections: NavSection[] = [
    {
      title: "Activity & management",
      subtitle: "Your trips and listings",
      icon: <Briefcase className="h-4 w-4" />,
      items: [
        {
          label: "My bookings",
          description: "View upcoming trips and reservations",
          icon: <Calendar className="h-4 w-4" />,
          to: "/host-bookings",
          accent: true,
        },
        {
          label: "Manage listings",
          description: "Edit details and check performance",
          icon: <List className="h-4 w-4" />,
          to: "/my-listing",
          accent: true,
          hidden: loading || !isHost,
        },
      ],
    },
    {
      title: "Payments & transactions",
      subtitle: "Money in and out",
      icon: <Wallet className="h-4 w-4" />,
      items: [
        {
          label: "Payments & payouts",
          description: "Manage payment methods and payouts",
          icon: <CreditCard className="h-4 w-4" />,
          to: "/payment",
        },
      ],
    },
    {
      title: "Account & security",
      subtitle: "Your details and verification",
      icon: <ShieldCheck className="h-4 w-4" />,
      items: [
        {
          label: "Edit profile",
          description: "Update personal details & contact info",
          icon: <Settings className="h-4 w-4" />,
          to: "/profile",
        },
        {
          label: "Verification & ID",
          description: "Check host verification status",
          icon: <ShieldCheck className="h-4 w-4" />,
          to: "/verification-status",
        },
      ],
    },
    {
      title: "Support",
      subtitle: "We're here to help",
      icon: <HelpCircle className="h-4 w-4" />,
      items: [
        {
          label: "Help & support",
          description: "Get help with bookings or hosting",
          icon: <HelpCircle className="h-4 w-4" />,
          to: "/terms-of-service",
        },
      ],
    },
  ];

  const cardCls =
    "rounded-2xl border border-border bg-card shadow-sm overflow-hidden";

  const logoutButton = (
    <button
      onClick={handleSignOut}
      className="w-full h-12 rounded-2xl border border-destructive/20 bg-destructive/10 hover:bg-destructive/15 text-destructive text-sm font-bold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
    >
      <LogOut className="h-4 w-4" />
      Log out
    </button>
  );

  const badgeCls =
    "inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold";

  return (
    <div
      className="flex flex-col min-h-screen w-full bg-gradient-to-b from-primary/5 via-background to-background"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Header />

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-10 2xl:px-16 pt-4 md:pt-6 pb-28 lg:pb-12">
        <div className="grid w-full gap-6 lg:gap-8 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
          {/* ── Left: profile panel (sticks while the sections scroll on desktop) ── */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-6 sm:p-8 shadow-xl">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-24 -left-12 h-52 w-52 rounded-full bg-black/10" />

              <div className="relative flex flex-row lg:flex-col items-center lg:items-start gap-5">
                <div className="relative h-20 w-20 lg:h-28 lg:w-28 rounded-3xl overflow-hidden bg-white/20 ring-4 ring-white/25 shrink-0">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || "User Avatar"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <User className="h-9 w-9 lg:h-12 lg:w-12" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 w-full space-y-2">
                  {loading && !profile ? (
                    <>
                      <div className="h-6 w-40 bg-white/25 rounded animate-pulse" />
                      <div className="h-4 w-48 bg-white/20 rounded animate-pulse" />
                    </>
                  ) : (
                    <>
                      <h1 className="text-2xl lg:text-3xl font-extrabold leading-tight break-words">
                        {displayName}
                      </h1>
                      <p className="text-sm opacity-85 truncate">{user?.email}</p>
                    </>
                  )}

                  {/* Status badges */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {loading ? (
                      <div className="h-6 w-24 bg-white/20 rounded-full animate-pulse" />
                    ) : (
                      <>
                        {isAdmin && (
                          <span className={badgeCls}>
                            <ShieldAlert className="h-3 w-3" /> Administrator
                          </span>
                        )}
                        {isGuideApproved && (
                          <span className={badgeCls}>
                            <BadgeCheck className="h-3 w-3" /> Certified guide
                          </span>
                        )}
                        {isCompanyApproved && (
                          <span className={badgeCls}>
                            <Building2 className="h-3 w-3" /> Tour company
                          </span>
                        )}
                        {isAdventureHost && (
                          <span className={badgeCls}>
                            <Compass className="h-3 w-3" /> Adventure host
                          </span>
                        )}
                        {!isHost && !isAdmin && <span className={badgeCls}>Explorer</span>}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate("/profile")}
                className="relative mt-6 w-full h-11 rounded-2xl bg-white/20 hover:bg-white/30 transition-colors text-sm font-bold flex items-center justify-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Edit profile
              </button>
            </div>

            <div className="hidden lg:block">{logoutButton}</div>
          </aside>

          {/* ── Right: banners + navigation sections filling the remaining width ── */}
          <div className="min-w-0 space-y-8">
            {/* Banners */}
            <div className="grid gap-4 md:grid-cols-2 items-stretch">
              {/* Admin access (only for admins, once loaded) */}
              {!loading && isAdmin && (
                <div className="p-4 sm:p-5 rounded-2xl border border-purple-500/30 bg-purple-500/5 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      Admin panel access
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Manage platform users, verify hosts, and oversee system transactions.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/admin")}
                    className="h-9 px-3.5 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition-all shrink-0 active:scale-95 flex items-center gap-1.5"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Admin panel
                  </button>
                </div>
              )}

              {/* Host actions */}
              {loading ? (
                <div className="rounded-2xl border border-border bg-card h-[76px] animate-pulse" />
              ) : isHost ? (
                <div className="p-4 sm:p-5 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-bold text-foreground">Host dashboard</p>
                    <p className="text-xs text-muted-foreground">
                      Manage your existing listings and check daily revenue.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/my-listing")}
                    className="h-9 px-3.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shrink-0 active:scale-95"
                  >
                    My listings
                  </button>
                </div>
              ) : (
                <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-bold text-foreground">Become a host</p>
                    <p className="text-xs text-muted-foreground">List trips, events, or local adventure spots.</p>
                  </div>
                  <button
                    onClick={() => navigate("/become-host")}
                    className="h-9 px-3.5 rounded-xl text-xs font-bold border border-border bg-background hover:bg-muted text-foreground transition-all shrink-0 active:scale-95 flex items-center gap-1.5"
                  >
                    <PlusCircle className="h-3.5 w-3.5 text-primary" />
                    Get started
                  </button>
                </div>
              )}
            </div>

            {/* Navigation sections */}
            <div className="grid gap-x-6 gap-y-8 md:grid-cols-2 items-start">
              {sections.map((section) => {
                const visible = section.items.filter((i) => !i.hidden);
                if (visible.length === 0) return null;
                return (
                  <section key={section.title} className="space-y-3">
                    <SectionHeader icon={section.icon} title={section.title} subtitle={section.subtitle} />
                    <div className={`${cardCls} divide-y divide-border/60`}>
                      {visible.map((item) => (
                        <button
                          key={item.to + item.label}
                          onClick={() => navigate(item.to)}
                          className="w-full p-4 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                                item.accent ? "bg-primary/10 text-primary" : "bg-muted text-foreground"
                              }`}
                            >
                              {item.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="lg:hidden">{logoutButton}</div>
          </div>
        </div>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
}