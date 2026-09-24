import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Edit3, EyeOff, Eye, Compass, Loader2, ArrowLeft, RotateCcw,
  TrendingUp, Wallet, CalendarDays, ChevronDown, ChevronUp, Trash2, KeyRound, Lock,
} from "lucide-react";

// ── Design tokens ────────────────────────────────────────────────────────
const COLORS = {
  INK: "#23201B",
  PAPER: "#F6F1E4",
  CARD: "#FFFDF8",
  CLAY: "#B4573A",
  MOSS: "#4C5F45",
  GOLD: "#B98A34",
  RUST: "#8C3527",
  LINE: "#E5DCC6",
  MUTED: "#8D8471",
};

const SERIF = "'Fraunces', 'Iowan Old Style', Georgia, serif";

const ITEMS_PER_PAGE = 20;

// Seconds the person must wait between "Resend code" taps, so a stray
// double-click (or impatience) can't spam the email-OTP endpoint.
const RESEND_COOLDOWN_SECONDS = 30;

const getTableForType = (type: string) => {
  if (type === "trip" || type === "event") return "trips";
  if (type === "adventure" || type === "adventure_place") return "adventure_places";
  return null;
};

// ── Per-item analytics types ────────────────────────────────────────────────
type AnalyticsItemType = "trip" | "adventure";

interface DailyStat {
  date: string;
  count: number;
  amount: number;
}

interface ItemAnalyticsData {
  id: string;
  name: string;
  type: AnalyticsItemType;
  image_url?: string | null;
  totalBookings: number;
  grossEarnings: number;
  serviceFee: number;
  netEarnings: number;
  daily: DailyStat[];
}

const formatKsh = (n: number) => `KSh ${Math.round(n).toLocaleString()}`;

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  approved: { color: COLORS.MOSS, bg: `${COLORS.MOSS}1A`, label: "Approved" },
  pending: { color: COLORS.GOLD, bg: `${COLORS.GOLD}1F`, label: "Pending review" },
  rejected: { color: COLORS.RUST, bg: `${COLORS.RUST}1A`, label: "Rejected" },
};

// ── Delete-flow step type ────────────────────────────────────────────────
type DeleteStep = "password" | "code";

const MyListing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [myContent, setMyContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreListings, setLoadingMoreListings] = useState(false);
  const [listingsOffset, setListingsOffset] = useState(0);
  const [hasMoreListings, setHasMoreListings] = useState(true);

  const [resubmittingIds, setResubmittingIds] = useState<Set<string>>(new Set());
  const [hidingIds, setHidingIds] = useState<Set<string>>(new Set());

  // ── Delete confirmation flow state ───────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>("password");
  const [passwordInput, setPasswordInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // ── Resend-code state (email OTP step of the delete flow) ────────────────
  const [resendingCode, setResendingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Host type state
  const [hostingCategory, setHostingCategory] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [hasCompany, setHasCompany] = useState(false);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  const [isAdventureHost, setIsAdventureHost] = useState(false);

  // ── Per-item analytics state ─────────────
  const [analyticsData, setAnalyticsData] = useState<ItemAnalyticsData[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsFetched, setAnalyticsFetched] = useState(false);
  const [expandedAnalytics, setExpandedAnalytics] = useState<Set<string>>(new Set());

  // ── Fetch-once guard ──────────────────────────────────────────────────────
  // Supabase's client silently refreshes the auth session whenever the tab
  // regains focus (switching back from another tab/app, or the OS waking the
  // browser). That fires onAuthStateChange, which hands AuthContext a *new*
  // `user` object with the same id — so an effect keyed on `[user, navigate]`
  // (the object reference) re-runs and re-fetches everything, which reads as
  // an unwanted "auto refresh" every time the person leaves and comes back.
  // Keying on `user?.id` instead, plus this ref, means the page loads its
  // data once per actual login and never refetches just because the tab was
  // backgrounded and refocused.
  const fetchedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (fetchedUserIdRef.current === user.id) return;
    fetchedUserIdRef.current = user.id;
    fetchHostStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Tick the resend cooldown down once a second while it's active.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const fetchHostStatus = async () => {
    setLoading(true);
    try {
      const { data: advPlaces } = await supabase
        .from("adventure_places")
        .select("id, approval_status")
        .eq("created_by", user!.id)
        .limit(1);

      const hasAdventurePlace = advPlaces && advPlaces.length > 0;

      const [verRes, companyRes] = await Promise.all([
        supabase.from("host_verifications").select("status, hosting_category").eq("user_id", user!.id).maybeSingle(),
        supabase.from("companies").select("verification_status").eq("user_id", user!.id).maybeSingle(),
      ]);

      const hCategory = verRes.data?.hosting_category || null;
      const vStatus   = verRes.data?.status || null;
      const hCompany  = !!companyRes.data;
      const cStatus   = companyRes.data?.verification_status || null;

      setHostingCategory(hCategory);
      setVerificationStatus(vStatus);
      setHasCompany(hCompany);
      setCompanyStatus(cStatus);
      setIsAdventureHost(hasAdventurePlace);

      const isGuideApproved   = vStatus === "approved";
      const isCompanyApproved = cStatus === "approved";

      if (!hasAdventurePlace && !isGuideApproved && !isCompanyApproved) {
        navigate("/become-host");
        return;
      }

      await fetchData(0, hCategory, vStatus, hCompany, cStatus, hasAdventurePlace);
    } catch (error) {
      console.error("Error fetching host status:", error);
      setLoading(false);
    }
  };

  // NOTE: only fetches rows that the creator has NOT soft-deleted
  // (deleted_by_creator = false), so once a host "deletes" a listing it
  // disappears from this page for good — but the row itself stays in the
  // database so admins retain a full record of it.
  const fetchData = async (
    listingsFetchOffset: number,
    category?: string | null,
    vStatus?: string | null,
    isCompany?: boolean,
    cStatus?: string | null,
    adventureHost?: boolean
  ) => {
    const hCategory  = category      ?? hostingCategory;
    const hVStatus   = vStatus       ?? verificationStatus;
    const hCompany   = isCompany     ?? hasCompany;
    const hCStatus   = cStatus       ?? companyStatus;
    const hAdventure = adventureHost ?? isAdventureHost;

    if (listingsFetchOffset === 0) {
      setLoading(true);
    }

    const userEmail = user?.email;
    const range = [listingsFetchOffset, listingsFetchOffset + ITEMS_PER_PAGE - 1] as const;

    const isGuideApproved   = hVStatus === "approved" && hCategory === "guide";
    const isCompanyApproved = hCompany && hCStatus === "approved";
    const isLegacyVerified  = hVStatus === "approved" && !hCategory;

    const shouldFetchTrips      = isGuideApproved || isCompanyApproved || isLegacyVerified;
    const shouldFetchAdventures = hAdventure || isLegacyVerified;

    const [tripsRes, adventuresRes, adventuresAdminRes] = await Promise.all([
      shouldFetchTrips
        ? supabase
            .from("trips")
            .select("id,name,location,country,image_url,price,approval_status,is_hidden,hidden_by,deleted_by_creator,type")
            .eq("created_by", user!.id)
            .eq("deleted_by_creator", false)
            .range(range[0], range[1])
        : Promise.resolve({ data: [] }),
      shouldFetchAdventures
        ? supabase
            .from("adventure_places")
            .select("id,name,location,country,image_url,entry_fee,approval_status,is_hidden,hidden_by,deleted_by_creator,created_by")
            .eq("created_by", user!.id)
            .eq("deleted_by_creator", false)
            .range(range[0], range[1])
        : Promise.resolve({ data: [] }),
      shouldFetchAdventures && userEmail
        ? supabase
            .from("adventure_places")
            .select("id,name,location,country,image_url,entry_fee,approval_status,is_hidden,hidden_by,deleted_by_creator,created_by")
            .contains("allowed_admin_emails", [userEmail])
            .eq("deleted_by_creator", false)
            .range(range[0], range[1])
        : Promise.resolve({ data: [] }),
    ]);

    let filteredTrips = tripsRes.data || [];
    filteredTrips = filteredTrips.filter((t: any) => t.type !== "event");

    const allContent = [
      ...(filteredTrips.map((t: any) => ({ ...t, type: "trip", isCreator: true }))),
      ...(adventuresRes.data?.map((a: any) => ({ ...a, type: "adventure", isCreator: true })) || []),
      ...(adventuresAdminRes.data?.filter((a: any) => a.created_by !== user!.id).map((a: any) => ({ ...a, type: "adventure", isCreator: false })) || []),
    ];

    if (listingsFetchOffset === 0) {
      setMyContent(allContent);
    } else {
      setMyContent(prev => [...prev, ...allContent]);
    }

    setListingsOffset(listingsFetchOffset + ITEMS_PER_PAGE);
    setHasMoreListings(allContent.length >= ITEMS_PER_PAGE);

    setLoading(false);
    setLoadingMoreListings(false);
  };

  const loadMoreListings = () => {
    if (hasMoreListings && !loadingMoreListings) {
      setLoadingMoreListings(true);
      fetchData(listingsOffset);
    }
  };

  // ── Resubmit a rejected listing: flips approval_status back to "pending" ──
  const handleResubmit = async (item: any) => {
    if (resubmittingIds.has(item.id)) return;

    const tableName = getTableForType(item.type);
    if (!tableName) {
      toast({ title: "Resubmit failed", description: "Unknown listing type.", variant: "destructive" });
      return;
    }

    setResubmittingIds(prev => new Set(prev).add(item.id));

    try {
      const { error } = await supabase
        .from(tableName as "trips" | "adventure_places")
        .update({
          approval_status: "pending",
          approved_by: null,
          approved_at: null,
        })
        .eq("id", item.id);

      if (error) throw error;

      setMyContent(prev =>
        prev.map(c => (c.id === item.id ? { ...c, approval_status: "pending" } : c))
      );

      toast({
        title: "Resubmitted for review",
        description: "Your listing has been sent back to admin for approval.",
      });
    } catch (error: any) {
      toast({
        title: "Resubmit failed",
        description: error?.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResubmittingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // ── Hide / unhide a listing from other users (creator only) ─────────────
  // Blocked entirely if an admin was the one who hid it (hidden_by === "admin") —
  // only an admin can undo that. When the creator hides it themselves, we
  // tag hidden_by = "creator" so they retain the ability to unhide it later.
  const handleToggleHide = async (item: any) => {
    if (hidingIds.has(item.id)) return;

    if (item.is_hidden && item.hidden_by === "admin") {
      toast({
        title: "Hidden by admin",
        description: "This listing was hidden by an admin and can only be made visible again by them.",
        variant: "destructive",
      });
      return;
    }

    const tableName = getTableForType(item.type);
    if (!tableName) {
      toast({ title: "Failed", description: "Unknown listing type.", variant: "destructive" });
      return;
    }

    setHidingIds(prev => new Set(prev).add(item.id));
    const nextHidden = !item.is_hidden;

    try {
      const { error } = await supabase
        .from(tableName as "trips" | "adventure_places")
        .update({ is_hidden: nextHidden, hidden_by: nextHidden ? "creator" : null })
        .eq("id", item.id);

      if (error) throw error;

      setMyContent(prev =>
        prev.map(c =>
          c.id === item.id
            ? { ...c, is_hidden: nextHidden, hidden_by: nextHidden ? "creator" : null }
            : c
        )
      );

      toast({
        title: nextHidden ? "Listing hidden" : "Listing is now visible",
        description: nextHidden
          ? "Other users can no longer see this listing."
          : "This listing is visible to other users again.",
      });
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error?.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setHidingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // ── Delete flow: step 1 open dialog ──────────────────────────────────────
  const openDeleteDialog = (item: any) => {
    setDeleteTarget(item);
    setDeleteStep("password");
    setPasswordInput("");
    setCodeInput("");
    setDeleteSubmitting(false);
    setResendingCode(false);
    setResendCooldown(0);
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteStep("password");
    setPasswordInput("");
    setCodeInput("");
    setDeleteSubmitting(false);
    setResendingCode(false);
    setResendCooldown(0);
  };

  // ── Delete flow: step 2 — verify password, then email a one-time code ───
  const handleConfirmPassword = async () => {
    if (!user?.email) return;
    if (!passwordInput) {
      toast({ title: "Password required", description: "Please enter your password to continue.", variant: "destructive" });
      return;
    }

    setDeleteSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordInput,
      });

      if (signInError) {
        toast({ title: "Incorrect password", description: "Please re-enter your password.", variant: "destructive" });
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: { shouldCreateUser: false },
      });

      if (otpError) {
        toast({ title: "Couldn't send code", description: otpError.message, variant: "destructive" });
        return;
      }

      toast({ title: "Code sent", description: `We emailed a confirmation code to ${user.email}.` });
      setDeleteStep("code");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error: any) {
      toast({ title: "Something went wrong", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ── Resend the one-time code without re-entering the password ───────────
  // The password was already verified to get to this step, so resending
  // just asks Supabase to email a fresh code — gated by a short cooldown so
  // the button can't be hammered.
  const handleResendCode = async () => {
    if (!user?.email || resendingCode || resendCooldown > 0) return;

    setResendingCode(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: { shouldCreateUser: false },
      });

      if (error) {
        toast({ title: "Couldn't resend code", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Code resent", description: `We emailed a new code to ${user.email}.` });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error: any) {
      toast({ title: "Something went wrong", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setResendingCode(false);
    }
  };

  // ── Delete flow: step 3 — verify code, then SOFT-delete the row ─────────
  // We never hard-delete from the client. Instead the row is marked
  // is_hidden = true, hidden_by = "creator", deleted_by_creator = true.
  // This means:
  //   - it disappears from this host's own listings (fetchData filters it out)
  //   - it's hidden from the public site (is_hidden = true)
  //   - admins can still see it in AdminApproved, tagged "Deleted by creator",
  //     and are blocked from unhiding/showing it — only a real DB delete
  //     from the admin side removes it for good.
  const handleVerifyAndDelete = async () => {
    if (!user?.email || !deleteTarget) return;
    if (!codeInput) {
      toast({ title: "Code required", description: "Please enter the code we emailed you.", variant: "destructive" });
      return;
    }

    setDeleteSubmitting(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: user.email,
        token: codeInput.trim(),
        type: "magiclink",
      });

      if (verifyError) {
        toast({ title: "Invalid code", description: "That code is incorrect or has expired.", variant: "destructive" });
        return;
      }

      const tableName = getTableForType(deleteTarget.type);
      if (!tableName) throw new Error("Unknown listing type.");

      const { error: deleteError } = await supabase
        .from(tableName as "trips" | "adventure_places")
        .update({
          is_hidden: true,
          hidden_by: "creator",
          deleted_by_creator: true,
        })
        .eq("id", deleteTarget.id);

      if (deleteError) throw deleteError;

      setMyContent(prev => prev.filter(c => c.id !== deleteTarget.id));

      toast({
        title: "Listing removed",
        description: `"${deleteTarget.name}" has been removed from your listings.`,
      });
      closeDeleteDialog();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ── Per-item earnings & daily bookings analytics ──────────────────────────
  const fetchAnalytics = async () => {
    if (!user) return;
    setAnalyticsLoading(true);
    try {
      const [tripsRes, adventuresRes] = await Promise.all([
        supabase
          .from("trips")
          .select("id,name,image_url,type,service_fee_percentage")
          .eq("created_by", user.id),
        supabase
          .from("adventure_places")
          .select("id,name,image_url,service_fee_percentage")
          .eq("created_by", user.id),
      ]);

      type Meta = {
        name: string;
        type: AnalyticsItemType;
        image_url?: string | null;
        feeRate: number | null;
      };
      const itemMeta = new Map<string, Meta>();

      (tripsRes.data || [])
        .filter((t: any) => t.type !== "event")
        .forEach((t: any) => {
          itemMeta.set(t.id, {
            name: t.name,
            type: "trip",
            image_url: t.image_url,
            feeRate: t.service_fee_percentage != null ? Number(t.service_fee_percentage) : null,
          });
        });

      (adventuresRes.data || []).forEach((a: any) => {
        itemMeta.set(a.id, {
          name: a.name,
          type: "adventure",
          image_url: a.image_url,
          feeRate: a.service_fee_percentage != null ? Number(a.service_fee_percentage) : null,
        });
      });

      const itemIds = [...itemMeta.keys()];
      if (itemIds.length === 0) {
        setAnalyticsData([]);
        setAnalyticsFetched(true);
        return;
      }

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("id,item_id,booking_type,status,payment_status,total_amount,visit_date,booking_details,created_at")
        .in("item_id", itemIds)
        .eq("payment_status", "completed");

      const realBookings = (bookingsData || []).filter((b: any) => b.status === "confirmed");

      const byItem = new Map<string, any[]>();
      realBookings.forEach((b: any) => {
        if (!byItem.has(b.item_id)) byItem.set(b.item_id, []);
        byItem.get(b.item_id)!.push(b);
      });

      const result: ItemAnalyticsData[] = [];

      for (const [itemId, meta] of itemMeta.entries()) {
        const itemBookings = byItem.get(itemId) || [];
        const feeRate = meta.feeRate ?? 0;

        let gross = 0;
        let fee = 0;
        const dailyMap = new Map<string, { count: number; amount: number }>();

        for (const b of itemBookings) {
          const amount = Number(b.total_amount);
          gross += amount;
          const bFee = (amount * feeRate) / 100;
          fee += bFee;

          const rawDate = b.visit_date || b.booking_details?.date || b.created_at;
          const dateKey = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : "unknown";

          const entry = dailyMap.get(dateKey) || { count: 0, amount: 0 };
          entry.count += 1;
          entry.amount += amount - bFee;
          dailyMap.set(dateKey, entry);
        }

        const daily: DailyStat[] = [...dailyMap.entries()]
          .map(([date, v]) => ({ date, count: v.count, amount: v.amount }))
          .sort((a, b) => (a.date < b.date ? 1 : -1));

        result.push({
          id: itemId,
          name: meta.name,
          type: meta.type,
          image_url: meta.image_url,
          totalBookings: itemBookings.length,
          grossEarnings: gross,
          serviceFee: fee,
          netEarnings: gross - fee,
          daily,
        });
      }

      result.sort((a, b) => b.netEarnings - a.netEarnings);
      setAnalyticsData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyticsLoading(false);
      setAnalyticsFetched(true);
    }
  };

  const toggleExpandAnalytics = (id: string) => {
    setExpandedAnalytics(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTabChange = (value: string) => {
    if (value === "analytics" && !analyticsFetched && !analyticsLoading) {
      fetchAnalytics();
    }
  };

  const getCategoryCount = (category: string) => myContent.filter(item => item.type === category).length;

  const isGuideApproved   = verificationStatus === "approved" && hostingCategory === "guide";
  const isCompanyApproved = hasCompany && companyStatus === "approved";
  const isLegacyVerified  = verificationStatus === "approved" && !hostingCategory;

  const showTrips      = isGuideApproved || isCompanyApproved || isLegacyVerified;
  const showAdventures = isAdventureHost || isLegacyVerified;

  const renderListings = (category: string) => {
    const items = myContent.filter(item => item.type === category);

    if (items.length === 0) {
      return (
        <div
          className="p-10 text-center rounded-2xl border border-dashed"
          style={{ borderColor: COLORS.LINE, color: COLORS.MUTED }}
        >
          <p className="text-sm">Nothing here yet — add your first {category} to get started.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {items.map((item) => {
          const isRejected = item.approval_status === "rejected";
          const isResubmitting = resubmittingIds.has(item.id);
          const isHiding = hidingIds.has(item.id);
          const status = STATUS_STYLES[item.approval_status] || STATUS_STYLES.pending;
          const isAdminHidden = item.is_hidden && item.hidden_by === "admin";

          return (
            <Card
              key={item.id}
              className="p-4 rounded-2xl border shadow-none hover:shadow-sm transition-shadow overflow-hidden"
              style={{ backgroundColor: COLORS.CARD, borderColor: COLORS.LINE }}
            >
              <div className="flex flex-col md:flex-row gap-5">
                <div className="relative w-full md:w-40 h-32 shrink-0">
                  <img
                    src={item.image_url || item.photo_urls?.[0] || "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80"}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                  {!item.isCreator && (
                    <span
                      className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-medium text-white"
                      style={{ backgroundColor: `${COLORS.INK}CC` }}
                    >
                      Staff access
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h3
                        className="text-lg leading-tight"
                        style={{ fontFamily: SERIF, color: COLORS.INK, fontWeight: 600 }}
                      >
                        {item.name || item.local_name || item.location_name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1" style={{ color: COLORS.MUTED }}>
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="text-xs">
                          {item.location || item.location_name}, {item.country}
                        </span>
                      </div>
                    </div>
                    <span
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                      style={{ backgroundColor: status.bg, color: status.color }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                      {status.label}
                    </span>
                  </div>

                  {isRejected && item.isCreator && (
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                      style={{ backgroundColor: `${COLORS.RUST}0D`, borderColor: `${COLORS.RUST}33` }}
                    >
                      <p className="text-xs flex-1" style={{ color: COLORS.RUST }}>
                        This listing was rejected. Edit it and resubmit to send it back for review.
                      </p>
                    </div>
                  )}

                  {isAdminHidden && (
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                      style={{ backgroundColor: `${COLORS.GOLD}0D`, borderColor: `${COLORS.GOLD}33` }}
                    >
                      <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: COLORS.GOLD }} />
                      <p className="text-xs flex-1" style={{ color: COLORS.GOLD }}>
                        An admin hid this listing. Only an admin can make it visible again.
                      </p>
                    </div>
                  )}

                  <div
                    className="flex items-center justify-between pt-3 border-t"
                    style={{ borderColor: COLORS.LINE }}
                  >
                    <div className="flex flex-col">
                      <span className="text-[11px]" style={{ color: COLORS.MUTED }}>Base rate</span>
                      <span className="text-sm font-semibold" style={{ color: COLORS.CLAY }}>
                        KSh {item.price || item.price_adult || item.entry_fee || 0}
                      </span>
                    </div>

                    <div className="flex gap-2 flex-wrap items-center">
                      {item.is_hidden && (
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                          style={{ backgroundColor: `${COLORS.GOLD}1F` }}
                        >
                          <EyeOff className="h-3.5 w-3.5" style={{ color: COLORS.GOLD }} />
                          <span className="text-[11px] font-medium" style={{ color: COLORS.GOLD }}>
                            {item.hidden_by === "admin" ? "Hidden by admin" : "Hidden"}
                          </span>
                        </div>
                      )}

                      {isRejected && item.isCreator && (
                        <Button
                          onClick={() => handleResubmit(item)}
                          disabled={isResubmitting}
                          size="sm"
                          className="h-9 px-4 rounded-lg text-xs font-medium text-white border-none disabled:opacity-60"
                          style={{ backgroundColor: COLORS.CLAY }}
                        >
                          {isResubmitting ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                              Resubmitting…
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-3.5 w-3.5 mr-2" />
                              Resubmit
                            </>
                          )}
                        </Button>
                      )}

                      {item.isCreator && (
                        isAdminHidden ? (
                          <div
                            className="h-9 px-4 rounded-lg text-xs font-medium border flex items-center gap-2"
                            style={{ borderColor: COLORS.LINE, color: COLORS.MUTED, backgroundColor: "transparent" }}
                            title="Only an admin can make this visible again."
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Hidden by admin
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleToggleHide(item)}
                            disabled={isHiding}
                            size="sm"
                            variant="outline"
                            className="h-9 px-4 rounded-lg text-xs font-medium border disabled:opacity-60"
                            style={{ borderColor: COLORS.GOLD, color: COLORS.GOLD, backgroundColor: "transparent" }}
                          >
                            {isHiding ? (
                              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                            ) : item.is_hidden ? (
                              <Eye className="h-3.5 w-3.5 mr-2" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5 mr-2" />
                            )}
                            {item.is_hidden ? "Unhide" : "Hide"}
                          </Button>
                        )
                      )}

                      <Button
                        onClick={() => navigate(`/edit-listing/${item.type}/${item.id}`)}
                        size="sm"
                        variant="outline"
                        className="h-9 px-4 rounded-lg text-xs font-medium border"
                        style={{ borderColor: COLORS.INK, color: COLORS.INK, backgroundColor: "transparent" }}
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-2" />
                        Edit
                      </Button>

                      {item.isCreator && (
                        <Button
                          onClick={() => openDeleteDialog(item)}
                          size="sm"
                          variant="outline"
                          className="h-9 px-4 rounded-lg text-xs font-medium border"
                          style={{ borderColor: COLORS.RUST, color: COLORS.RUST, backgroundColor: "transparent" }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  // ── Renders the per-item "Earnings & Daily Bookings" analytics tab ────────
  const renderAnalytics = () => {
    if (analyticsLoading) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: COLORS.CLAY }} />
        </div>
      );
    }

    if (analyticsData.length === 0) {
      return (
        <div
          className="p-10 text-center rounded-2xl border border-dashed"
          style={{ borderColor: COLORS.LINE, color: COLORS.MUTED }}
        >
          <p className="text-sm">No listings to analyze yet.</p>
        </div>
      );
    }

    const maxDailyCount = Math.max(1, ...analyticsData.flatMap(i => i.daily.map(d => d.count)));

    return (
      <div className="grid gap-3">
        {analyticsData.map((item) => {
          const isOpen = expandedAnalytics.has(item.id);
          const color = item.type === "adventure" ? COLORS.CLAY : COLORS.MOSS;

          return (
            <Card
              key={item.id}
              className="rounded-2xl border shadow-none overflow-hidden"
              style={{ backgroundColor: COLORS.CARD, borderColor: COLORS.LINE }}
            >
              <button
                onClick={() => toggleExpandAnalytics(item.id)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.image_url || "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80"}
                    alt={item.name}
                    className="h-12 w-12 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className="text-sm truncate"
                        style={{ fontFamily: SERIF, color: COLORS.INK, fontWeight: 600 }}
                      >
                        {item.name}
                      </p>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${color}1F`, color }}
                      >
                        {item.type === "adventure" ? "Adventure" : "Trip"}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: COLORS.MUTED }}>
                      {item.totalBookings} bookings · {formatKsh(item.netEarnings)} net
                    </p>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0" style={{ color: COLORS.MUTED }} />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" style={{ color: COLORS.MUTED }} />
                )}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t pt-3" style={{ borderColor: COLORS.LINE }}>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded-xl p-2.5 border" style={{ backgroundColor: COLORS.PAPER, borderColor: COLORS.LINE }}>
                      <div className="flex items-center gap-1.5 mb-1" style={{ color: COLORS.MUTED }}>
                        <Wallet className="h-3.5 w-3.5" />
                        <span className="text-[10px]">Gross</span>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: COLORS.INK }}>{formatKsh(item.grossEarnings)}</p>
                    </div>
                    <div className="rounded-xl p-2.5 border" style={{ backgroundColor: COLORS.PAPER, borderColor: COLORS.LINE }}>
                      <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="text-[10px]">Net</span>
                      </div>
                      <p className="text-sm font-semibold" style={{ color }}>{formatKsh(item.netEarnings)}</p>
                    </div>
                    <div className="rounded-xl p-2.5 border" style={{ backgroundColor: COLORS.PAPER, borderColor: COLORS.LINE }}>
                      <div className="flex items-center gap-1.5 mb-1" style={{ color: COLORS.MUTED }}>
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span className="text-[10px]">Bookings</span>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: COLORS.INK }}>{item.totalBookings}</p>
                    </div>
                  </div>

                  {item.daily.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: COLORS.MUTED }}>
                      No bookings yet
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[11px] mb-2" style={{ color: COLORS.MUTED }}>
                        Daily bookings
                      </p>
                      {item.daily.map((d) => (
                        <div key={d.date} className="flex items-center gap-2">
                          <span className="text-[11px] w-16 shrink-0" style={{ color: COLORS.MUTED }}>
                            {d.date === "unknown"
                              ? "Unknown"
                              : new Date(d.date).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                          </span>
                          <div className="flex-1 h-3.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.PAPER }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(d.count / maxDailyCount) * 100}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-medium w-6 text-right shrink-0" style={{ color: COLORS.INK }}>
                            {d.count}
                          </span>
                          <span className="text-[11px] font-medium w-16 text-right shrink-0" style={{ color: COLORS.INK }}>
                            {formatKsh(d.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.PAPER }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: COLORS.CLAY }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: COLORS.PAPER }}>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl">
        <header className="mb-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/become-host")}
            className="mb-4 -ml-3 rounded-lg text-xs px-3 h-7"
            style={{ color: COLORS.MUTED }}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Host dashboard
          </Button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-4xl md:text-5xl leading-none"
                style={{ fontFamily: SERIF, color: COLORS.INK, fontWeight: 600 }}
              >
                Your listings
              </h1>
              <p className="text-sm mt-2" style={{ color: COLORS.MUTED }}>
                Manage what's live and see how each one is earning.
              </p>
            </div>
            <div className="p-2.5 rounded-full" style={{ backgroundColor: COLORS.CARD, border: `1px solid ${COLORS.LINE}` }}>
              <Compass className="h-5 w-5" style={{ color: COLORS.CLAY }} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            {isAdventureHost && (
              <span
                className="rounded-full px-3 py-1.5 text-xs font-medium border"
                style={{ borderColor: COLORS.LINE, color: COLORS.MOSS, backgroundColor: `${COLORS.MOSS}0D` }}
              >
                Adventure host
              </span>
            )}
            {isGuideApproved && (
              <span
                className="rounded-full px-3 py-1.5 text-xs font-medium border"
                style={{ borderColor: COLORS.LINE, color: COLORS.MOSS, backgroundColor: `${COLORS.MOSS}0D` }}
              >
                Tour guide
              </span>
            )}
            {isCompanyApproved && (
              <span
                className="rounded-full px-3 py-1.5 text-xs font-medium border"
                style={{ borderColor: COLORS.LINE, color: COLORS.CLAY, backgroundColor: `${COLORS.CLAY}0D` }}
              >
                Company host
              </span>
            )}
          </div>
        </header>

        <Tabs defaultValue="listings" className="w-full" onValueChange={handleTabChange}>
          <TabsList
            className="w-full justify-start gap-6 h-auto p-0 bg-transparent border-b rounded-none mb-8"
            style={{ borderColor: COLORS.LINE }}
          >
            <TabsTrigger
              value="listings"
              className="rounded-none border-b-2 border-transparent px-1 pb-3 text-sm font-medium data-[state=active]:shadow-none bg-transparent"
              style={{ color: COLORS.MUTED }}
            >
              Listings
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="rounded-none border-b-2 border-transparent px-1 pb-3 text-sm font-medium data-[state=active]:shadow-none bg-transparent"
              style={{ color: COLORS.MUTED }}
            >
              Earnings
            </TabsTrigger>
          </TabsList>

          {/* ── Listings tab ── */}
          <TabsContent value="listings" className="space-y-12 animate-in fade-in duration-300">
            {showTrips && (
              <section>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg" style={{ fontFamily: SERIF, color: COLORS.INK, fontWeight: 600 }}>
                    {isGuideApproved ? "Guided tours" : "Fixed trips"}
                  </h2>
                  <span className="text-xs" style={{ color: COLORS.MUTED }}>
                    {getCategoryCount("trip")} total
                  </span>
                </div>
                {renderListings("trip")}
              </section>
            )}

            {showAdventures && (
              <section>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg" style={{ fontFamily: SERIF, color: COLORS.INK, fontWeight: 600 }}>
                    Adventure places
                  </h2>
                  <span className="text-xs" style={{ color: COLORS.MUTED }}>
                    {getCategoryCount("adventure")} total
                  </span>
                </div>
                {renderListings("adventure")}
              </section>
            )}

            {hasMoreListings && (
              <div className="flex justify-center mt-10">
                <Button
                  onClick={loadMoreListings}
                  disabled={loadingMoreListings}
                  className="rounded-full text-xs font-medium h-11 px-8 text-white border-none"
                  style={{ backgroundColor: COLORS.INK }}
                >
                  {loadingMoreListings
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…</>
                    : "Load more listings"
                  }
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ── Analytics tab: per-item earnings + daily bookings ── */}
          <TabsContent value="analytics" className="space-y-6 animate-in fade-in duration-300">
            <div className="mb-2">
              <h2 className="text-lg" style={{ fontFamily: SERIF, color: COLORS.INK, fontWeight: 600 }}>
                Earnings by listing
              </h2>
              <p className="text-xs mt-1" style={{ color: COLORS.MUTED }}>
                Tap a listing to see its daily bookings and net earnings.
              </p>
            </div>
            {renderAnalytics()}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
      <MobileBottomBar />

      {/* ── Delete confirmation dialog: password step, then emailed-code step ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) closeDeleteDialog(); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl" style={{ backgroundColor: COLORS.CARD }}>
          {deleteStep === "password" ? (
            <>
              <DialogHeader>
                <div className="flex justify-center mb-2">
                  <div className="p-3 rounded-full" style={{ backgroundColor: `${COLORS.RUST}1A` }}>
                    <Lock className="h-6 w-6" style={{ color: COLORS.RUST }} />
                  </div>
                </div>
                <DialogTitle className="text-center" style={{ fontFamily: SERIF, color: COLORS.INK }}>
                  Confirm your password
                </DialogTitle>
                <DialogDescription className="text-center">
                  Deleting "{deleteTarget?.name}" will remove it from your listings. Enter your account password to continue.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5 mt-2">
                <Label className="text-xs" style={{ color: COLORS.MUTED }}>Password</Label>
                <Input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter your password"
                  onKeyDown={(e) => { if (e.key === "Enter") handleConfirmPassword(); }}
                  autoFocus
                />
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-col mt-4">
                <Button
                  onClick={handleConfirmPassword}
                  disabled={deleteSubmitting}
                  className="w-full text-white border-none"
                  style={{ backgroundColor: COLORS.RUST }}
                >
                  {deleteSubmitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</>
                  ) : (
                    "Continue"
                  )}
                </Button>
                <Button
                  onClick={closeDeleteDialog}
                  disabled={deleteSubmitting}
                  variant="outline"
                  className="w-full"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex justify-center mb-2">
                  <div className="p-3 rounded-full" style={{ backgroundColor: `${COLORS.RUST}1A` }}>
                    <KeyRound className="h-6 w-6" style={{ color: COLORS.RUST }} />
                  </div>
                </div>
                <DialogTitle className="text-center" style={{ fontFamily: SERIF, color: COLORS.INK }}>
                  Enter confirmation code
                </DialogTitle>
                <DialogDescription className="text-center">
                  We emailed a code to {user?.email}. Enter it below to remove "{deleteTarget?.name}" from your listings.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5 mt-2">
                <Label className="text-xs" style={{ color: COLORS.MUTED }}>Confirmation code</Label>
                <Input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="Enter the code"
                  inputMode="numeric"
                  onKeyDown={(e) => { if (e.key === "Enter") handleVerifyAndDelete(); }}
                  autoFocus
                />
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendingCode || resendCooldown > 0}
                    className="text-xs font-medium underline decoration-dotted underline-offset-2 disabled:no-underline disabled:opacity-50"
                    style={{ color: COLORS.MUTED }}
                  >
                    {resendingCode
                      ? "Sending…"
                      : resendCooldown > 0
                        ? `Resend code (${resendCooldown}s)`
                        : "Didn't get it? Resend code"}
                  </button>
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-col mt-4">
                <Button
                  onClick={handleVerifyAndDelete}
                  disabled={deleteSubmitting}
                  className="w-full text-white border-none"
                  style={{ backgroundColor: COLORS.RUST }}
                >
                  {deleteSubmitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Removing…</>
                  ) : (
                    <><Trash2 className="h-4 w-4 mr-2" />Confirm & Delete</>
                  )}
                </Button>
                <Button
                  onClick={() => setDeleteStep("password")}
                  disabled={deleteSubmitting}
                  variant="outline"
                  className="w-full"
                >
                  Back
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyListing;