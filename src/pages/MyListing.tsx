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
import { MapPin, Calendar, Edit3, EyeOff, LayoutDashboard, ReceiptText, Star, Loader2, ArrowLeft } from "lucide-react";

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

  // Host type state
  const [hostingCategory, setHostingCategory] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [hasCompany, setHasCompany] = useState(false);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  // Adventure host — detected via adventure_places table, not hosting_category
  const [isAdventureHost, setIsAdventureHost] = useState(false);

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
        {items.map((item) => (
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
        ))}
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

        <Tabs defaultValue="listings" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-14 p-1.5 bg-slate-200/50 rounded-2xl mb-8">
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
        </Tabs>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default MyListing;