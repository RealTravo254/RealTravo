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
  Loader2,
  Compass,
  Building2,
  BadgeCheck,
  AlertCircle,
  PlusCircle,
  HelpCircle,
  Settings,
} from "lucide-react";

interface UserProfile {
  full_name?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
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

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchUserData();
  }, [user, navigate]);

  const fetchUserData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch Profile Info
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, phone_number")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }

      // 2. Check Host Verifications
      const { data: verData } = await supabase
        .from("host_verifications")
        .select("status, hosting_category")
        .eq("user_id", user.id)
        .maybeSingle();

      if (verData) {
        setHostingCategory(verData.hosting_category);
        setVerificationStatus(verData.status);
      }

      // 3. Check Company Verifications
      const { data: companyData } = await supabase
        .from("companies")
        .select("verification_status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (companyData) {
        setHasCompany(true);
        setCompanyStatus(companyData.verification_status);
      }

      // 4. Check Adventure Places Creator Status
      const { data: advPlaces } = await supabase
        .from("adventure_places")
        .select("id")
        .eq("created_by", user.id)
        .limit(1);

      if (advPlaces && advPlaces.length > 0) {
        setIsAdventureHost(true);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-screen bg-background"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Header />

      <main className="flex-1 px-4 pt-4 pb-12 max-w-lg mx-auto w-full space-y-5">
        {/* Profile Card Header */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 rounded-full overflow-hidden bg-muted shrink-0 border border-border">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || "User Avatar"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary">
                  <User className="h-6 w-6" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-foreground truncate">
                {profile?.full_name || user?.email?.split("@")[0] || "User Account"}
              </h1>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {isGuideApproved && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <BadgeCheck className="h-2.5 w-2.5" /> Certified Guide
                  </span>
                )}
                {isCompanyApproved && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <Building2 className="h-2.5 w-2.5" /> Tour Company
                  </span>
                )}
                {isAdventureHost && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <Compass className="h-2.5 w-2.5" /> Adventure Host
                  </span>
                )}
                {!isHost && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground">
                    Explorer
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Host Actions Banner */}
        {isHost ? (
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground">Host Dashboard</p>
              <p className="text-[10px] text-muted-foreground">Manage your existing listings and check daily revenue.</p>
            </div>
            <button
              onClick={() => navigate("/my-listings")}
              className="h-8 px-3 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shrink-0 active:scale-95"
            >
              My Listings
            </button>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground">Become a Host</p>
              <p className="text-[10px] text-muted-foreground">List trips, events, or local adventure spots.</p>
            </div>
            <button
              onClick={() => navigate("/become-host")}
              className="h-8 px-3 rounded-lg text-xs font-bold border border-border bg-background hover:bg-muted text-foreground transition-all shrink-0 active:scale-95 flex items-center gap-1.5"
            >
              <PlusCircle className="h-3.5 w-3.5 text-primary" />
              Get Started
            </button>
          </div>
        )}

        {/* Navigation Section 1: Bookings & Listings */}
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1">
            Activity &amp; Management
          </p>

          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60">
            <button
              onClick={() => navigate("/my-bookings")}
              className="w-full p-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">My Bookings</p>
                  <p className="text-[10px] text-muted-foreground">View upcoming trips and reservations</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>

            {isHost && (
              <button
                onClick={() => navigate("/my-listings")}
                className="w-full p-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <List className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Manage Listings</p>
                    <p className="text-[10px] text-muted-foreground">Edit details and check performance</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Section 2: Account & Safety */}
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1">
            Account &amp; Security
          </p>

          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60">
            <button
              onClick={() => navigate("/edit-profile")}
              className="w-full p-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-foreground shrink-0">
                  <Settings className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Edit Profile</p>
                  <p className="text-[10px] text-muted-foreground">Update personal details &amp; contact info</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>

            <button
              onClick={() => navigate("/verification-status")}
              className="w-full p-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-foreground shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Verification &amp; ID</p>
                  <p className="text-[10px] text-muted-foreground">Check host verification status</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </div>
        </div>

        {/* Navigation Section 3: Support & Legal */}
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1">
            Support
          </p>

          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60">
            <button
              onClick={() => navigate("/help")}
              className="w-full p-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-foreground shrink-0">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Help &amp; Support</p>
                  <p className="text-[10px] text-muted-foreground">Get help with bookings or hosting</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleSignOut}
          className="w-full h-11 rounded-xl border border-destructive/20 bg-destructive/10 hover:bg-destructive/15 text-destructive text-xs font-bold flex items-center justify-center gap-2 transition-colors active:scale-98"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
}