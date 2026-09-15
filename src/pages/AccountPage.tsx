import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Edit3,
  EyeOff,
  Compass,
  Loader2,
  ArrowLeft,
  RotateCcw,
  TrendingUp,
  Wallet,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  BarChart3,
  List,
} from "lucide-react";

const ITEMS_PER_PAGE = 20;

const getTableForType = (type: string) => {
  if (type === "trip" || type === "event") return "trips";
  if (type === "adventure" || type === "adventure_place") return "adventure_places";
  return null;
};

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

const STATUS_STYLES: Record<string, { colorClass: string; bgClass: string; label: string }> = {
  approved: { colorClass: "text-emerald-600 dark:text-emerald-400", bgClass: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40", label: "Approved" },
  pending: { colorClass: "text-amber-600 dark:text-amber-400", bgClass: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40", label: "Pending review" },
  rejected: { colorClass: "text-rose-600 dark:text-rose-400", bgClass: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40", label: "Rejected" },
};

export default function MyListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [myContent, setMyContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreListings, setLoadingMoreListings] = useState(false);
  const [listingsOffset, setListingsOffset] = useState(0);
  const [hasMoreListings, setHasMoreListings] = useState(true);

  const [resubmittingIds, setResubmittingIds] = useState<Set<string>>(new Set());

  const [hostingCategory, setHostingCategory] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [hasCompany, setHasCompany] = useState(false);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  const [isAdventureHost, setIsAdventureHost] = useState(false);

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

  const isGuideApproved   = verificationStatus === "approved" && hostingCategory === "guide";
  const isCompanyApproved = hasCompany && companyStatus === "approved";

  const renderListings = (category?: string) => {
    const items = category 
      ? myContent.filter(item => item.type === category)
      : myContent;

    if (items.length === 0) {
      return (
        <div className="p-8 text-center rounded-lg border border-dashed border-border/60 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground">
            Nothing here yet — add your first {category || "listing"} to get started.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
        {items.map((item) => {
          const isRejected = item.approval_status === "rejected";
          const isResubmitting = resubmittingIds.has(item.id);
          const status = STATUS_STYLES[item.approval_status] || STATUS_STYLES.pending;

          return (
            <div
              key={item.id}
              className="p-3 rounded-lg border border-border bg-card shadow-sm hover:border-border/80 transition-colors space-y-3"
            >
              <div className="flex gap-3 items-start">
                <div className="relative h-16 w-16 shrink-0 rounded-md overflow-hidden bg-muted">
                  <img
                    src={item.image_url || item.photo_urls?.[0] || "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80"}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                  {!item.isCreator && (
                    <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded text-[8px] font-black bg-black/70 text-white uppercase tracking-wider">
                      Staff
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-foreground truncate">
                      {item.name || item.local_name || item.location_name}
                    </h3>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold border ${status.bgClass} ${status.colorClass}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0 text-primary" />
                    <span className="text-[10px] font-medium truncate">
                      {item.location || item.location_name}, {item.country}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-black text-primary">
                      KSh {item.price || item.price_adult || item.entry_fee || 0}
                    </span>
                    {item.is_hidden && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-semibold">
                        <EyeOff className="h-2.5 w-2.5" /> Hidden
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {isRejected && item.isCreator && (
                <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
                  <p className="text-[10px] font-medium text-destructive">
                    This listing was rejected. Edit it and resubmit to send it back for review.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                {isRejected && item.isCreator && (
                  <button
                    onClick={() => handleResubmit(item)}
                    disabled={isResubmitting}
                    className="h-7 px-2.5 rounded-md flex items-center gap-1 text-[10px] font-bold text-white bg-primary hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isResubmitting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <RotateCcw className="h-3 w-3" />
                        Resubmit
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => navigate(`/edit-listing/${item.type}/${item.id}`)}
                  className="h-7 px-2.5 rounded-md flex items-center gap-1 text-[10px] font-bold text-foreground border border-border bg-background hover:bg-muted transition-all active:scale-95"
                >
                  <Edit3 className="h-3 w-3" />
                  Edit
                </button>
              </div>
            </div>
          );
        })}

        {hasMoreListings && (
          <div className="flex justify-center pt-2">
            <button
              onClick={loadMoreListings}
              disabled={loadingMoreListings}
              className="h-8 px-4 rounded-md flex items-center gap-1.5 text-[11px] font-bold text-foreground border border-border bg-background hover:bg-muted transition-all active:scale-95 disabled:opacity-50"
            >
              {loadingMoreListings ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : (
                "Load More Listings"
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderAnalytics = () => {
    if (analyticsLoading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      );
    }

    if (analyticsData.length === 0) {
      return (
        <div className="p-8 text-center rounded-lg border border-dashed border-border/60 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground">No listings to analyze yet.</p>
        </div>
      );
    }

    const maxDailyCount = Math.max(1, ...analyticsData.flatMap(i => i.daily.map(d => d.count)));

    return (
      <div className="space-y-2.5">
        {analyticsData.map((item) => {
          const isOpen = expandedAnalytics.has(item.id);

          return (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-card overflow-hidden transition-colors"
            >
              <button
                onClick={() => toggleExpandAnalytics(item.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={item.image_url || "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80"}
                    alt={item.name}
                    className="h-10 w-10 rounded-md object-cover shrink-0 bg-muted"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                      <span className="shrink-0 rounded px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider bg-primary/10 text-primary">
                        {item.type}
                      </span>
                    </div>
                    <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                      {item.totalBookings} bookings · <span className="font-bold text-foreground">{formatKsh(item.netEarnings)}</span> net
                    </p>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {isOpen && (
                <div className="p-3 border-t border-border/40 bg-muted/20 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md p-2 bg-background border border-border/50">
                      <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                        <Wallet className="h-3 w-3" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Gross</span>
                      </div>
                      <p className="text-xs font-bold text-foreground">{formatKsh(item.grossEarnings)}</p>
                    </div>
                    <div className="rounded-md p-2 bg-background border border-border/50">
                      <div className="flex items-center gap-1 text-primary mb-0.5">
                        <TrendingUp className="h-3 w-3" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Net</span>
                      </div>
                      <p className="text-xs font-bold text-primary">{formatKsh(item.netEarnings)}</p>
                    </div>
                    <div className="rounded-md p-2 bg-background border border-border/50">
                      <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                        <CalendarDays className="h-3 w-3" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Bookings</span>
                      </div>
                      <p className="text-xs font-bold text-foreground">{item.totalBookings}</p>
                    </div>
                  </div>

                  {item.daily.length === 0 ? (
                    <p className="text-[10px] text-center py-2 text-muted-foreground">No bookings recorded yet</p>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        Daily Bookings Breakdown
                      </p>
                      {item.daily.map((d) => (
                        <div key={d.date} className="flex items-center gap-2 text-[10px]">
                          <span className="w-14 shrink-0 font-medium text-muted-foreground">
                            {d.date === "unknown"
                              ? "Unknown"
                              : new Date(d.date).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                          </span>
                          <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${(d.count / maxDailyCount) * 100}%` }}
                            />
                          </div>
                          <span className="font-bold text-foreground w-4 text-right shrink-0">{d.count}</span>
                          <span className="font-bold text-foreground w-16 text-right shrink-0">{formatKsh(d.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

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

      <main className="flex-1 px-4 pt-3 pb-8 max-w-lg mx-auto w-full space-y-4">
        {/* Top Back & Header */}
        <div>
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>

          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-black text-foreground leading-tight">
                My Listings
              </h1>
              <p className="text-[11px] font-medium text-muted-foreground">
                Manage your live offerings &amp; track earnings.
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Compass className="h-4 w-4 text-primary" />
            </div>
          </div>

          {/* Host Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {isAdventureHost && (
              <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/40 text-[9px] font-bold text-foreground">
                Adventure Host
              </span>
            )}
            {isGuideApproved && (
              <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/40 text-[9px] font-bold text-foreground">
                Tour Guide
              </span>
            )}
            {isCompanyApproved && (
              <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/40 text-[9px] font-bold text-foreground">
                Company Host
              </span>
            )}
          </div>
        </div>

        {/* Tabs section styled like AccountPage menu items */}
        <Tabs defaultValue="listings" className="w-full" onValueChange={handleTabChange}>
          <TabsList className="w-full grid grid-cols-2 h-9 p-1 bg-muted/50 rounded-lg border border-border/40 mb-3">
            <TabsTrigger
              value="listings"
              className="rounded-md text-[11px] font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <List className="h-3.5 w-3.5 mr-1.5 inline" />
              Listings ({myContent.length})
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="rounded-md text-[11px] font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5 inline" />
              Earnings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-0">
            {renderListings()}
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            {renderAnalytics()}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
}