import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Calendar, Edit3, EyeOff, LayoutDashboard, ReceiptText, Star, Loader2, ArrowLeft, RotateCcw,
  BarChart3, TrendingUp, DollarSign, ChevronDown, ChevronUp,
} from "lucide-react";

const COLORS = {
  TEAL: "#008080", 
  CORAL: "#FF7F50",
  KHAKI_DARK: "#857F3E",
  SOFT_GRAY: "#F8F9FA",
  RED: "#FF0000"
};

const ITEMS_PER_PAGE = 20;

// A booking only counts as a real, completed sale when BOTH are true:
//   status === "confirmed"  AND  payment_status === "completed"
// Everything else (cancelled, expired, failed, pending) is noise from
// abandoned/declined/timed-out payment attempts and should never show
// up in the host's Sales Feed.
const isRealBooking = (b: any) => b.status === "confirmed" && b.payment_status === "completed";

// Maps a content item's `type` to its underlying Supabase table.
// Keep this in sync with AdminReviewDetail's table mapping.
const getTableForType = (type: string) => {
  if (type === "trip" || type === "event") return "trips";
  if (type === "adventure" || type === "adventure_place") return "adventure_places";
  return null;
};

// ── Per-item analytics types ────────────────────────────────────────────────
type AnalyticsItemType = "trip" | "adventure";

interface DailyStat {
  date: string; // YYYY-MM-DD, or "unknown"
  count: number;
  amount: number; // net (after service fee)
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
  daily: DailyStat[]; // sorted newest first
}

const formatKsh = (n: number) => `KSh ${Math.round(n).toLocaleString()}`;

const MyListing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);
  const [myContent, setMyContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreListings, setLoadingMoreListings] = useState(false);
  const [loadingMoreBookings, setLoadingMoreBookings] = useState(false);
  const [listingsOffset, setListingsOffset] = useState(0);
  const [bookingsOffset, setBookingsOffset] = useState(0);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [hasMoreBookings, setHasMoreBookings] = useState(true);

  // Tracks which item IDs are currently mid-resubmit, so we can disable
  // the button and show a spinner per-card without blocking the whole page.
  const [resubmittingIds, setResubmittingIds] = useState<Set<string>>(new Set());

  // Host type state
  const [hostingCategory, setHostingCategory] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [hasCompany, setHasCompany] = useState(false);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  // Adventure host — detected via adventure_places table, not hosting_category
  const [isAdventureHost, setIsAdventureHost] = useState(false);

  // ── Per-item analytics state (Earnings & Daily Bookings tab) ─────────────
  const [analyticsData, setAnalyticsData] = useState<ItemAnalyticsData[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsFetched, setAnalyticsFetched] = useState(false);
  const [expandedAnalytics, setExpandedAnalytics] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchHostStatus();
  }, [user, navigate]);

  const fetchHostStatus = async () => {
    setLoading(true);
    try {
      // ── Check adventure_places FIRST — hosting_category is NULL for adventure hosts ──
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

      // ── Guard: only redirect to become-host if truly no hosting at all ──
      const isGuideApproved   = vStatus === "approved";
      const isCompanyApproved = cStatus === "approved";

      if (!hasAdventurePlace && !isGuideApproved && !isCompanyApproved) {
        navigate("/become-host");
        return;
      }

      await fetchData(0, 0, hCategory, vStatus, hCompany, cStatus, hasAdventurePlace);
    } catch (error) {
      console.error("Error fetching host status:", error);
      setLoading(false);
    }
  };

  const fetchData = async (
    listingsFetchOffset: number,
    bookingsFetchOffset: number,
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

    if (listingsFetchOffset === 0 && bookingsFetchOffset === 0) {
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
        ? supabase.from("trips").select("id,name,location,country,image_url,price,approval_status,is_hidden,type").eq("created_by", user!.id).range(range[0], range[1])
        : Promise.resolve({ data: [] }),
      shouldFetchAdventures
        ? supabase.from("adventure_places").select("id,name,location,country,image_url,entry_fee,approval_status,is_hidden,created_by").eq("created_by", user!.id).range(range[0], range[1])
        : Promise.resolve({ data: [] }),
      shouldFetchAdventures && userEmail
        ? supabase.from("adventure_places").select("id,name,location,country,image_url,entry_fee,approval_status,is_hidden,created_by").contains("allowed_admin_emails", [userEmail]).range(range[0], range[1])
        : Promise.resolve({ data: [] }),
    ]);

    let filteredTrips = tripsRes.data || [];
    // Only keep actual trips (exclude events)
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

    const allIds = listingsFetchOffset === 0
      ? allContent.map(c => c.id)
      : [...myContent, ...allContent].map(c => c.id);

    if (allIds.length > 0) {
      // NOTE: we filter to confirmed + completed at the query level (not just
      // client-side) so cancelled/expired/failed/pending rows never even get
      // pulled down for the host's dashboard. This also means pagination
      // (range) counts only real bookings, so "Load More" behaves correctly
      // instead of being thrown off by hidden junk rows.
      const { data } = await supabase
        .from("creator_booking_summary")
        .select("id,item_id,booking_type,status,payment_status,total_amount,created_at")
        .in("item_id", allIds)
        .eq("status", "confirmed")
        .eq("payment_status", "completed")
        .order("created_at", { ascending: false })
        .range(bookingsFetchOffset, bookingsFetchOffset + ITEMS_PER_PAGE - 1);

      // Extra client-side safety net in case the view or query shape ever
      // changes — never let a non-real booking slip into state.
      const realBookings = (data || []).filter(isRealBooking);

      if (bookingsFetchOffset === 0) {
        setBookings(realBookings);
      } else {
        setBookings(prev => [...prev, ...realBookings]);
      }
      setBookingsOffset(bookingsFetchOffset + ITEMS_PER_PAGE);
      setHasMoreBookings(realBookings.length >= ITEMS_PER_PAGE);
    }

    setLoading(false);
    setLoadingMoreListings(false);
    setLoadingMoreBookings(false);
  };

  const loadMoreListings = () => {
    if (hasMoreListings && !loadingMoreListings) {
      setLoadingMoreListings(true);
      fetchData(listingsOffset, 0);
    }
  };

  const loadMoreBookings = () => {
    if (hasMoreBookings && !loadingMoreBookings) {
      setLoadingMoreBookings(true);
      fetchData(0, bookingsOffset);
    }
  };

  // ── Resubmit a rejected listing: flips approval_status back to "pending" ──
  const handleResubmit = async (item: any) => {
    if (resubmittingIds.has(item.id)) return;

    const tableName = getTableForType(item.type);
    if (!tableName) {
      toast({ title: "Resubmit Failed", description: "Unknown listing type.", variant: "destructive" });
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

      // Reflect the change locally so the card updates instantly without a refetch.
      setMyContent(prev =>
        prev.map(c => (c.id === item.id ? { ...c, approval_status: "pending" } : c))
      );

      toast({
        title: "Resubmitted for Review",
        description: "Your listing has been sent back to admin for approval.",
      });
    } catch (error: any) {
      toast({
        title: "Resubmit Failed",
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

  // ── Per-item earnings & daily bookings analytics ──────────────────────────
  // Fetched lazily the first time the "Analytics" tab is opened, covering ALL
  // of the host's trips + adventure places (not just the currently paginated
  // page), so every item gets its own complete breakdown.
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
          .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

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
  const getBookingCount  = (category: string) => bookings.filter(b => b.booking_type === category).length;

  const isGuideApproved   = verificationStatus === "approved" && hostingCategory === "guide";
  const isCompanyApproved = hasCompany && companyStatus === "approved";
  const isLegacyVerified  = verificationStatus === "approved" && !hostingCategory;

  const showTrips      = isGuideApproved || isCompanyApproved || isLegacyVerified;
  const showAdventures = isAdventureHost || isLegacyVerified;

  const renderListings = (category: string) => {
    const items = myContent.filter(item => item.type === category);

    if (items.length === 0) {
      return (
        <div className="p-8 text-center bg-white rounded-[28px] border border-dashed border-slate-200 text-slate-400 font-bold uppercase text-xs tracking-widest">
          No {category}s found
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {items.map((item) => {
          const isRejected = item.approval_status === "rejected";
          const isResubmitting = resubmittingIds.has(item.id);

          return (
            <Card key={item.id} className="p-4 bg-white rounded-[28px] shadow-sm border border-slate-100 hover:shadow-md transition-all overflow-hidden">
              <div className="flex flex-col md:flex-row gap-5">
                <div className="relative w-full md:w-40 h-32 shrink-0">
                  <img
                    src={item.image_url || item.photo_urls?.[0] || "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80"}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                  {!item.isCreator && (
                    <Badge className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-[8px] font-black uppercase">Staff</Badge>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-lg uppercase tracking-tight text-slate-800 leading-tight">
                        {item.name || item.local_name || item.location_name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                        <MapPin className="h-3 w-3" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {item.location || item.location_name}, {item.country}
                        </span>
                      </div>
                    </div>
                    <Badge
                      className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border-none"
                      style={{
                        backgroundColor:
                          item.approval_status === "approved" ? `${COLORS.TEAL}20`
                          : item.approval_status === "pending" ? "#F0E68C"
                          : "#FFEBEB",
                        color:
                          item.approval_status === "approved" ? COLORS.TEAL
                          : item.approval_status === "pending" ? COLORS.KHAKI_DARK
                          : COLORS.RED,
                      }}
                    >
                      {item.approval_status}
                    </Badge>
                  </div>

                  {isRejected && item.isCreator && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl">
                      <span className="text-red-500 text-xs">⚠</span>
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide flex-1">
                        Rejected — edit and resubmit to send it back for review.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Rate</span>
                      <span className="text-sm font-black text-[#FF0000]">
                        KSh {item.price || item.price_adult || item.entry_fee || 0}
                      </span>
                    </div>

                    <div className="flex gap-2 flex-wrap items-center">
                      {item.is_hidden && (
                        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                          <EyeOff className="h-3 w-3 text-yellow-600" />
                          <span className="text-[8px] font-black text-yellow-700 uppercase">Hidden</span>
                        </div>
                      )}

                      {isRejected && item.isCreator && (
                        <Button
                          onClick={() => handleResubmit(item)}
                          disabled={isResubmitting}
                          size="sm"
                          className="h-9 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest text-white transition-transform active:scale-95 shadow-lg shadow-orange-900/10 border-none disabled:opacity-60"
                          style={{ backgroundColor: COLORS.CORAL }}
                        >
                          {isResubmitting ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              Resubmitting...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-3 w-3 mr-2" />
                              Resubmit
                            </>
                          )}
                        </Button>
                      )}

                      <Button
                        onClick={() => navigate(`/edit-listing/${item.type}/${item.id}`)}
                        size="sm"
                        className="h-9 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest text-white transition-transform active:scale-95 shadow-lg shadow-teal-900/10 border-none"
                        style={{ backgroundColor: COLORS.TEAL }}
                      >
                        <Edit3 className="h-3 w-3 mr-2" />
                        Edit
                      </Button>
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

  const renderBookings = (category: string) => {
    // bookings state already contains only confirmed+completed rows (filtered
    // both at the query level and again client-side), so no extra status
    // filtering is needed here — just split by booking_type for display.
    const items = bookings.filter(b => b.booking_type === category);

    if (items.length === 0) {
      return (
        <div className="p-8 text-center bg-white rounded-[28px] border border-dashed border-slate-200 text-slate-400 font-bold uppercase text-xs tracking-widest">
          No bookings yet
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {items.map((booking) => (
          <Card
            key={booking.id}
            className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-[#FF7F50]/30 transition-colors"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-black text-xs uppercase tracking-tighter text-slate-800">
                  Booking #{booking.id.slice(0, 8)}
                </p>
                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-slate-200">
                  {booking.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-slate-400">
                  <Calendar className="h-3 w-3" />
                  <span className="text-[10px] font-bold">
                    {new Date(booking.created_at).toLocaleDateString()}
                  </span>
                </div>
                <span className="text-[10px] font-black text-[#FF0000] uppercase tracking-widest">
                  KSh {booking.total_amount}
                </span>
              </div>
            </div>
            <span
              className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                booking.payment_status === "paid"
                  ? "bg-green-50 text-green-600"
                  : "bg-orange-50 text-orange-600"
              }`}
            >
              {booking.payment_status}
            </span>
          </Card>
        ))}
      </div>
    );
  };

  // ── Renders the per-item "Earnings & Daily Bookings" analytics tab ────────
  const renderAnalytics = () => {
    if (analyticsLoading) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: COLORS.TEAL }} />
        </div>
      );
    }

    if (analyticsData.length === 0) {
      return (
        <div className="p-8 text-center bg-white rounded-[28px] border border-dashed border-slate-200 text-slate-400 font-bold uppercase text-xs tracking-widest">
          No listings to analyze yet
        </div>
      );
    }

    const maxDailyCount = Math.max(1, ...analyticsData.flatMap(i => i.daily.map(d => d.count)));

    return (
      <div className="grid gap-3">
        {analyticsData.map((item) => {
          const isOpen = expandedAnalytics.has(item.id);
          const color = item.type === "adventure" ? COLORS.CORAL : COLORS.TEAL;

          return (
            <Card key={item.id} className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleExpandAnalytics(item.id)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.image_url || "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80"}
                    alt={item.name}
                    className="h-12 w-12 rounded-2xl object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-sm uppercase tracking-tight text-slate-800 truncate">
                        {item.name}
                      </p>
                      <Badge
                        className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border-none"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {item.type === "adventure" ? "Adventure" : "Trip"}
                      </Badge>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {item.totalBookings} bookings · {formatKsh(item.netEarnings)} net
                    </p>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-slate-50 pt-3">
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="flex items-center gap-1.5 mb-1 text-slate-500">
                        <DollarSign className="h-3.5 w-3.5" />
                        <span className="text-[8px] font-bold uppercase tracking-widest">Gross</span>
                      </div>
                      <p className="text-sm font-black text-slate-800">{formatKsh(item.grossEarnings)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="text-[8px] font-bold uppercase tracking-widest">Net</span>
                      </div>
                      <p className="text-sm font-black" style={{ color }}>{formatKsh(item.netEarnings)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="flex items-center gap-1.5 mb-1 text-slate-500">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="text-[8px] font-bold uppercase tracking-widest">Bookings</span>
                      </div>
                      <p className="text-sm font-black text-slate-800">{item.totalBookings}</p>
                    </div>
                  </div>

                  {item.daily.length === 0 ? (
                    <p className="text-[10px] text-slate-400 font-bold uppercase text-center py-4">
                      No bookings yet
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <BarChart3 className="h-3 w-3 text-slate-400" />
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          Daily Bookings
                        </p>
                      </div>
                      {item.daily.map((d) => (
                        <div key={d.date} className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-slate-400 w-16 shrink-0">
                            {d.date === "unknown"
                              ? "Unknown"
                              : new Date(d.date).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                          </span>
                          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(d.count / maxDailyCount) * 100}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-black text-slate-800 w-6 text-right shrink-0">
                            {d.count}
                          </span>
                          <span className="text-[9px] font-black text-slate-800 w-16 text-right shrink-0">
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
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="relative">
          <div
            className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2"
            style={{ borderColor: COLORS.TEAL }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-[#FF7F50] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <header className="mb-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/become-host")}
            className="mb-3 rounded-lg text-[9px] font-bold uppercase tracking-widest px-3 h-7"
          >
            <ArrowLeft className="mr-1 h-3 w-3" /> Host Dashboard
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-white shadow-sm">
              <LayoutDashboard className="h-5 w-5" style={{ color: COLORS.TEAL }} />
            </div>
            <p className="text-[10px] font-black text-[#FF7F50] uppercase tracking-[0.3em]">Management</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none text-slate-900">
            My <span style={{ color: COLORS.TEAL }}>Listings</span>
          </h1>
          <div className="flex flex-wrap gap-2 mt-3">
            {isAdventureHost && (
              <Badge
                className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest"
                style={{ backgroundColor: `${COLORS.TEAL}15`, color: COLORS.TEAL }}
              >
                ⛺ Adventure Host
              </Badge>
            )}
            {isGuideApproved && (
              <Badge
                className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest"
                style={{ backgroundColor: `${COLORS.TEAL}15`, color: COLORS.TEAL }}
              >
                🗺️ Tour Guide
              </Badge>
            )}
            {isCompanyApproved && (
              <Badge
                className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest"
                style={{ backgroundColor: `${COLORS.CORAL}15`, color: COLORS.CORAL }}
              >
                🏢 Company Host
              </Badge>
            )}
          </div>
        </header>

        <Tabs defaultValue="listings" className="w-full" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 h-14 p-1.5 bg-slate-200/50 rounded-2xl mb-8">
            <TabsTrigger
              value="listings"
              className="rounded-xl font-black uppercase text-[11px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-[#008080] data-[state=active]:shadow-sm transition-all"
            >
              <Star className="h-3.5 w-3.5 mr-2" />
              Live Content
            </TabsTrigger>
            <TabsTrigger
              value="bookings"
              className="rounded-xl font-black uppercase text-[11px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-[#FF7F50] data-[state=active]:shadow-sm transition-all"
            >
              <ReceiptText className="h-3.5 w-3.5 mr-2" />
              Sales Feed
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="rounded-xl font-black uppercase text-[11px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-[#857F3E] data-[state=active]:shadow-sm transition-all"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* ── Listings tab ── */}
          <TabsContent value="listings" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {showTrips && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>
                    {isGuideApproved ? "Guided Tours" : "Fixed Trips"}
                  </h2>
                  <div className="bg-white px-4 py-1 rounded-full shadow-sm border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {getCategoryCount("trip")} Total
                  </div>
                </div>
                {renderListings("trip")}
              </section>
            )}

            {showAdventures && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Adventure Places</h2>
                  <div className="bg-white px-4 py-1 rounded-full shadow-sm border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {getCategoryCount("adventure")} Total
                  </div>
                </div>
                {renderListings("adventure")}
              </section>
            )}

            {hasMoreListings && (
              <div className="flex justify-center mt-10">
                <Button
                  onClick={loadMoreListings}
                  disabled={loadingMoreListings}
                  className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-12 px-8"
                  style={{ background: COLORS.TEAL }}
                >
                  {loadingMoreListings
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
                    : "Load More Listings"
                  }
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ── Bookings tab ── */}
          <TabsContent value="bookings" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {showTrips && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.CORAL }}>
                    {isGuideApproved ? "Tour Bookings" : "Trip Bookings"}
                  </h2>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {getBookingCount("trip")} Received
                  </span>
                </div>
                {renderBookings("trip")}
              </section>
            )}

            {showAdventures && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.CORAL }}>Adventure Bookings</h2>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {getBookingCount("adventure_place")} Received
                  </span>
                </div>
                {renderBookings("adventure_place")}
              </section>
            )}

            {hasMoreBookings && (
              <div className="flex justify-center mt-10">
                <Button
                  onClick={loadMoreBookings}
                  disabled={loadingMoreBookings}
                  className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-12 px-8"
                  style={{ background: COLORS.CORAL }}
                >
                  {loadingMoreBookings
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
                    : "Load More Bookings"
                  }
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ── Analytics tab: per-item earnings + daily bookings ── */}
          <TabsContent value="analytics" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mb-2">
              <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.KHAKI_DARK }}>
                Item Analytics
              </h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Earnings &amp; daily bookings, per listing — tap a card to expand
              </p>
            </div>
            {renderAnalytics()}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default MyListing;