import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavigationDrawer } from "@/components/NavigationDrawer";
import { NotificationBell } from "@/components/NotificationBell";
import { useTranslation } from "react-i18next";
import { SEOHead } from "@/components/SEOHead";
import { useNavigate, Link } from "react-router-dom";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { useSearchFocus } from "@/components/PageLayout";
import { ListingCard } from "@/components/ListingCard";
import {
  Calendar, Tent, Compass, MapPin,
  Loader2, Navigation, Heart, Ticket, Trophy, Star, Search as SearchIcon,
} from "lucide-react";
import { FEATURED_COUNTIES, COUNTY_IMAGES } from "@/lib/kenyaCounties";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast"; 
import { getUserId } from "@/lib/sessionManager";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { useSavedItems } from "@/hooks/useSavedItems";
import { getCachedHomePageData, setCachedHomePageData } from "@/hooks/useHomePageCache";
import { useRatings, sortByRating } from "@/hooks/useRatings";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { useResponsiveLimit } from "@/hooks/useResponsiveLimit";

// ── GridSection ───────────────────────────────────────────────────────────────
// Shows an initial batch of cards; tapping "See More" appends the next
// batch below (with a skeleton row while it "loads"), instead of numbered
// pagination.
const INITIAL_VISIBLE_COUNT = 10;
const LOAD_MORE_COUNT = 10;

interface GridSectionProps {
  title: string;
  viewAllPath: string;
  accentColor: string;
  items: React.ReactNode[];
  loading: boolean;
}

const GridSection = memo(({ title, viewAllPath, accentColor, items, loading }: GridSectionProps) => {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [loadingMore, setLoadingMore]   = useState(false);

  // If the underlying items list shrinks (e.g. a fresh data fetch), clamp
  // visibleCount so we never try to render past the end of the array.
  useEffect(() => {
    setVisibleCount(prev => Math.min(prev, Math.max(items.length, INITIAL_VISIBLE_COUNT)));
  }, [items.length]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;
  const nextBatchSize = Math.min(LOAD_MORE_COUNT, Math.max(items.length - visibleCount, 0));

  const handleSeeMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    // Simulated delay so the skeleton row is visible briefly before the
    // next batch is revealed (items here are already fully loaded in
    // memory). If this section is ever backed by real incremental server
    // fetching instead, swap this timeout for the real fetch-then-append.
    window.setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, items.length));
      setLoadingMore(false);
    }, 500);
  };

  const showSkeletons = loading || items.length === 0;

  const Skeletons = ({ count }: { count: number }) => (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="w-full h-full">
          <ListingSkeleton />
        </div>
      ))}
    </>
  );

  return (
    <section className="mb-6 md:mb-10">
      <div
        className="flex items-center justify-between mb-3 md:mb-5 rounded-none md:rounded-xl px-3 py-2.5 -mx-4 md:mx-0"
        style={{ backgroundColor: `${accentColor}12` }}
      >
        <h2
          className="text-base sm:text-xl md:text-2xl font-extrabold tracking-tight"
          style={{ color: accentColor }}
        >
          {title}
        </h2>
        <Link
          to="/explore"
          className="text-xs md:text-sm font-semibold hover:opacity-70 transition-opacity shrink-0"
          style={{ color: accentColor }}
        >
          View All →
        </Link>
      </div>

      {showSkeletons ? (
        <>
          <div className="md:hidden grid grid-cols-2 gap-2.5">
            <Skeletons count={INITIAL_VISIBLE_COUNT} />
          </div>
          <div className="hidden md:grid grid-cols-4 lg:grid-cols-5 gap-4">
            <Skeletons count={INITIAL_VISIBLE_COUNT} />
          </div>
        </>
      ) : (
        <>
          <div className="md:hidden grid grid-cols-2 gap-2.5">{visibleItems}</div>
          <div className="hidden md:grid grid-cols-4 lg:grid-cols-5 gap-4">{visibleItems}</div>

          {/* Skeleton row for the next batch while "See More" is loading */}
          {loadingMore && (
            <>
              <div className="md:hidden grid grid-cols-2 gap-2.5 mt-2.5">
                <Skeletons count={nextBatchSize || LOAD_MORE_COUNT} />
              </div>
              <div className="hidden md:grid grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
                <Skeletons count={nextBatchSize || LOAD_MORE_COUNT} />
              </div>
            </>
          )}

          {hasMore && !loadingMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleSeeMore}
                className="px-6 py-2 rounded-full text-xs font-bold border border-border bg-card text-foreground shadow-sm hover:opacity-80 active:scale-95 transition-all"
                style={{ color: accentColor, borderColor: `${accentColor}40` }}
              >
                See More
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
});
GridSection.displayName = "GridSection";

// ── Category cards ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { icon: Tent,     title: "Experiences & stays",   path: "/category/campsite", bgImage: "/images/category-adventures.jpg" },
  { icon: Calendar, title: "Trips",        path: "/category/trips",    bgImage: "/images/category-trips.jpg"      },
  { icon: MapPin,   title: "Guided Tours", path: "/category/guided",   bgImage: "/images/guided.png"        },
];

// ── Quick-nav shortcuts ───────────────────────────────────────────────────────
// FIX: removed the stray backtick-n that was corrupting this array
const QUICK_NAV = [
  { icon: Calendar, title: "Trips",    path: "/category/trips", color: "hsl(25, 90%, 50%)"  },
  { icon: Ticket,   title: "Bookings", path: "/bookings",       color: "hsl(200, 70%, 45%)" },
  { icon: Heart,    title: "Saved",    path: "/saved",          color: "hsl(350, 80%, 55%)" },
];

// ── Main page ─────────────────────────────────────────────────────────────────
const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { savedItems, handleSave } = useSavedItems();
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { position, loading: locationLoading, requestLocation, forceRequestLocation } = useGeolocation();
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const { cardLimit } = useResponsiveLimit();

  const [showSearchIcon, setShowSearchIcon]       = useState(false);
  const [isIndexDrawerOpen, setIsIndexDrawerOpen] = useState(false);
  const [headerHeight, setHeaderHeight]           = useState(0);
  const searchRef   = useRef<HTMLDivElement>(null);
  const countiesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const measure = () => {
      if (window.innerWidth >= 768) {
        const header = document.querySelector("header");
        if (header) setHeaderHeight(header.getBoundingClientRect().height);
      } else {
        setHeaderHeight(0);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const [scrollableRows, setScrollableRows] = useState<{
    trips: any[]; hotels: any[]; attractions: any[];
    campsites: any[]; events: any[]; accommodations: any[]; guidedTrips: any[];
  }>({ trips: [], hotels: [], attractions: [], campsites: [], events: [], accommodations: [], guidedTrips: [] });

  const [nearbyPlacesHotels, setNearbyPlacesHotels] = useState<any[]>([]);
  const [loadingScrollable, setLoadingScrollable]   = useState(true);
  const [loadingNearby, setLoadingNearby]           = useState(true);
  const [isSearchFocused, setIsSearchFocusedLocal]  = useState(false);
  const { setSearchFocused } = useSearchFocus();

  const setIsSearchFocused = useCallback((v: boolean) => {
    setIsSearchFocusedLocal(v);
    setSearchFocused(v);
  }, [setSearchFocused]);

  const allItemIds = useMemo(() => {
    const ids = new Set<string>();
    nearbyPlacesHotels.forEach(i => ids.add(i.id));
    scrollableRows.trips.forEach(i => ids.add(i.id));
    scrollableRows.campsites.forEach(i => ids.add(i.id));
    scrollableRows.events.forEach(i => ids.add(i.id));
    scrollableRows.guidedTrips.forEach(i => ids.add(i.id));
    return Array.from(ids);
  }, [nearbyPlacesHotels, scrollableRows]);

  const tripEventIds = useMemo(() => {
    const ids = [...scrollableRows.trips, ...scrollableRows.events, ...scrollableRows.guidedTrips].map(i => i.id);
    return [...new Set(ids)];
  }, [scrollableRows.trips, scrollableRows.events, scrollableRows.guidedTrips]);

  const { bookingStats } = useRealtimeBookings(tripEventIds);
  const { ratings }      = useRatings(allItemIds);

  const sortedNearbyPlaces = useMemo(
    () => sortByRating(nearbyPlacesHotels, ratings, position, calculateDistance),
    [nearbyPlacesHotels, ratings, position],
  );

  const displayBrowseGuides = useMemo(() => {
    const seen = new Set<string>();
    return scrollableRows.campsites
      .filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => {
        const ra = ratings.get(a.id);
        const rb = ratings.get(b.id);
        const sa = ra ? ra.avgRating * Math.log1p(ra.reviewCount) : 0;
        const sb = rb ? rb.avgRating * Math.log1p(rb.reviewCount) : 0;
        return sb - sa;
      });
  }, [scrollableRows.campsites, ratings]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchScrollableRows = useCallback(async (limit: number) => {
    setLoadingScrollable(true);
    const fetchLimit = Math.max(limit * 3, 60);
    try {
      const [tripsData, campsitesData, eventsData, guidedData] = await Promise.all([
        supabase
          .from("trips")
          .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
          .eq("approval_status", "approved").eq("is_hidden", false)
          .eq("type", "trip").eq("is_flexible_date", false).eq("is_custom_date", false)
          .order("date", { ascending: true }).limit(fetchLimit),
        supabase
          .from("adventure_places")
          .select("id,name,location,place,country,image_url,gallery_images,images,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours")
          .eq("approval_status", "approved").eq("is_hidden", false).limit(fetchLimit),
        supabase
          .from("trips")
          .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
          .eq("approval_status", "approved").eq("is_hidden", false)
          .eq("type", "event").order("date", { ascending: true }).limit(fetchLimit),
        supabase
          .from("trips")
          .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
          .eq("approval_status", "approved").eq("is_hidden", false)
          .eq("type", "trip").or("is_flexible_date.eq.true,is_custom_date.eq.true")
          .order("created_at", { ascending: false }).limit(fetchLimit),
      ]);
      setScrollableRows({
        trips:          tripsData.data     || [],
        hotels:         [],
        attractions:    [],
        campsites:      campsitesData.data || [],
        events:         eventsData.data    || [],
        accommodations: [],
        guidedTrips:    guidedData.data    || [],
      });
    } catch (err) {
      console.error("Error fetching rows:", err);
    } finally {
      setLoadingScrollable(false);
    }
  }, []);

  const fetchNearbyPlacesAndHotels = useCallback(async () => {
    setLoadingNearby(true);
    if (!position) return;
    const { data } = await supabase
      .from("adventure_places")
      .select("id,name,location,place,country,image_url,entry_fee,activities,latitude,longitude,created_at,description")
      .eq("approval_status", "approved").eq("is_hidden", false).limit(50);
    const withDist = (data || [])
      .map(item => ({
        ...item,
        type: "ADVENTURE PLACE",
        distance: (item as any).latitude && (item as any).longitude && position
          ? calculateDistance(position.latitude, position.longitude, (item as any).latitude, (item as any).longitude)
          : undefined,
      }))
      .sort((a, b) => {
        if (a.distance !== undefined && b.distance !== undefined) return a.distance - b.distance;
        return a.distance !== undefined ? -1 : 1;
      });
    setNearbyPlacesHotels(withDist);
    if (withDist.length > 0) setLoadingNearby(false);
  }, [position]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const on = () => { requestLocation(); window.removeEventListener("scroll", on); window.removeEventListener("click", on); };
    window.addEventListener("scroll", on, { once: true });
    window.addEventListener("click",  on, { once: true });
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("click", on); };
  }, [requestLocation]);

  useEffect(() => {
    const cached = getCachedHomePageData();
    if (cached) {
      const c = (cached.scrollableRows as any) || {};
      const rows = {
        trips: c.trips || [], hotels: c.hotels || [], attractions: c.attractions || [],
        campsites: c.campsites || [], events: c.events || [], accommodations: c.accommodations || [],
        guidedTrips: c.guidedTrips || [],
      };
      setScrollableRows(rows);
      setNearbyPlacesHotels(cached.nearbyPlacesHotels || []);
      setLoadingScrollable(false); setLoadingNearby(false);
      const age = Date.now() - (cached.cachedAt || 0);
      const hasData = rows.trips.length > 0 || rows.campsites.length > 0 || rows.events.length > 0;
      if (age < 5 * 60 * 1000 && hasData) { getUserId().then(setUserId); return; }
    }
    fetchScrollableRows(cardLimit);
    getUserId().then(setUserId);
  }, [cardLimit, fetchScrollableRows]);

  useEffect(() => {
    const hasData = scrollableRows.trips.length > 0 || scrollableRows.campsites.length > 0 || scrollableRows.events.length > 0;
    if (!loadingScrollable && hasData)
      setCachedHomePageData({ scrollableRows, listings: [], nearbyPlacesHotels });
  }, [loadingScrollable, scrollableRows, nearbyPlacesHotels]);

  useEffect(() => { if (position) fetchNearbyPlacesAndHotels(); }, [position, fetchNearbyPlacesAndHotels]);

  useEffect(() => {
    const ctrl = () => setShowSearchIcon(window.scrollY > 0);
    window.addEventListener("scroll", ctrl, { passive: true });
    return () => window.removeEventListener("scroll", ctrl);
  }, []);

  // ── Card renderer ──────────────────────────────────────────────────────────
  const renderCard = useCallback((
    item: any, type: string, index: number,
    opts: { hidePrice?: boolean; isTrip?: boolean; categoryColor?: string } = {},
  ) => {
    const dist = position && item.latitude && item.longitude
      ? calculateDistance(position.latitude, position.longitude, item.latitude, item.longitude)
      : undefined;
    const rd = ratings.get(item.id);
    const today = new Date().toISOString().split("T")[0];
    return (
      <ListingCard
        key={item.id}
        id={item.id}
        type={type as any}
        name={item.name}
        imageUrl={item.image_url}
        location={item.location}
        country={item.country}
        price={item.price || item.entry_fee || 0}
        date={item.date || ""}
        isCustomDate={item.is_custom_date}
        isFlexibleDate={item.is_flexible_date}
        isOutdated={item.date && !item.is_flexible_date && item.date < today}
        isSaved={savedItems.has(item.id)}
        onSave={handleSave}
        hideSave={false}
        hidePrice={opts.hidePrice ?? false}
        showBadge={true}
        priority={index === 0}
        activities={item.activities}
        distance={dist}
        avgRating={rd?.avgRating}
        reviewCount={rd?.reviewCount}
        place={item.place}
        availableTickets={opts.isTrip ? item.available_tickets : undefined}
        bookedTickets={opts.isTrip ? bookingStats[item.id] || 0 : undefined}
        description={item.description}
        categoryColor={opts.categoryColor}
        galleryImages={item.gallery_images}
        images={item.images}
        openingHours={item.opening_hours}
        closingHours={item.closing_hours}
      />
    );
  }, [position, ratings, savedItems, handleSave, bookingStats]);

  // ── Pre-build node arrays ──────────────────────────────────────────────────
  const browseGuideNodes = useMemo(() =>
    displayBrowseGuides.map((item, i) =>
      renderCard(item, "ADVENTURE PLACE", i, { hidePrice: true }),
    ),
    [displayBrowseGuides, renderCard],
  );

  const nearbyNodes = useMemo(() =>
    sortedNearbyPlaces.map((item, i) => {
      const a = item as any;
      const rd = ratings.get(item.id);
      return (
        <ListingCard
          key={item.id}
          id={item.id}
          type={a.type || "ADVENTURE PLACE"}
          name={item.name}
          imageUrl={a.image_url}
          location={a.location}
          country={a.country}
          price={a.entry_fee || 0}
          date=""
          isSaved={savedItems.has(item.id)}
          onSave={handleSave}
          hideSave={false}
          hidePrice={true}
          showBadge={true}
          priority={i === 0}
          activities={a.activities}
          distance={a.distance}
          avgRating={rd?.avgRating}
          reviewCount={rd?.reviewCount}
          place={a.place}
          description={a.description}
        />
      );
    }),
    [sortedNearbyPlaces, ratings, savedItems, handleSave],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Realtravo - Accomodation trips, experiences & Adventures"
        description="Discover and book exciting trips,facilities, stay and adventure experiences. Your gateway to unforgettable travel."
        canonical="https://realtravo.com/"
        ogImage="https://realtravo.com/fulllogo.png"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Realtravo",
          "url": "https://realtravo.com",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://realtravo.com/?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }}
      />

      {/* Mobile top bar */}
      {!isSearchFocused && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] md:hidden flex items-center justify-between px-4 pointer-events-none"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)", paddingBottom: "10px" }}
        >
          <div
            className="pointer-events-auto rounded-xl"
            style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
          >
            <Sheet open={isIndexDrawerOpen} onOpenChange={setIsIndexDrawerOpen}>
              <SheetTrigger asChild>
                <button
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-white transition-all active:scale-95"
                  aria-label="Open Menu"
                >
                  <Menu className="h-5 w-5 stroke-[2.5]" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[80vw] max-w-sm p-0 h-screen border-none"
              >
                <NavigationDrawer onClose={() => setIsIndexDrawerOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {showSearchIcon && (
              <button
                onClick={() => navigate("/explore")}
                className="h-9 w-9 rounded-xl flex items-center justify-center text-white transition-all active:scale-95"
                style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
                aria-label="Search"
              >
                <SearchIcon className="h-5 w-5" />
              </button>
            )}
            <div
              className="rounded-xl [&_button]:h-9 [&_button]:w-9 [&_button]:text-white"
              style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
            >
              <NotificationBell />
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      {!isSearchFocused && (
        <div
          ref={searchRef}
          className="w-full"
          style={headerHeight > 0 ? { marginTop: `${headerHeight}px` } : undefined}
        >
          <div className="md:container md:mx-auto md:px-6">
            <div className="relative w-full flex flex-col px-4 md:px-8 pt-8 md:pt-10 pb-5 md:pb-6 overflow-hidden">
              <img
                src="/images/hero-background.webp"
                alt=""
                aria-hidden="true"
                fetchPriority="high"
                loading="eager"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
              />
              <div className="absolute inset-0 bg-black/25" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30" />

              <div className="relative z-10 flex flex-col items-center w-full max-w-3xl mx-auto mb-4 md:mb-5">
                <p className="text-white/70 text-xs md:text-sm font-semibold uppercase tracking-widest text-center mb-2">
                  {t("hero.tagline")}
                </p>
                <h1 className="text-white text-3xl md:text-4xl lg:text-5xl font-extrabold text-center mb-4 leading-tight tracking-tight">
                  {t("hero.title")}
                </h1>
                <div onClick={() => navigate("/explore")} className="cursor-pointer w-full">
                  <SearchBarWithSuggestions
                    value=""
                    onChange={() => {}}
                    onSubmit={() => navigate("/explore")}
                    onSuggestionSearch={() => navigate("/explore")}
                    onFocus={() => navigate("/explore")}
                    onBlur={() => {}}
                    onBack={() => {}}
                    showBackButton={false}
                  />
                </div>
              </div>

              {/* Hero category cards */}
              <div className="relative z-10 w-full grid grid-cols-3 gap-2 md:gap-3 mt-2">
                {CATEGORIES.map(cat => (
                  <div
                    key={cat.title}
                    onClick={() => navigate(cat.path)}
                    className="cursor-pointer rounded-lg relative w-full flex flex-col items-center justify-center gap-1 px-2 py-2 md:py-4 overflow-hidden"
                    style={{ height: "clamp(60px, 8vw, 144px)" }}
                  >
                    <img
                      src={cat.bgImage}
                      alt=""
                      aria-hidden="true"
                      fetchPriority="high"
                      loading="eager"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none rounded-lg"
                    />
                    <div className="absolute inset-0 rounded-lg bg-black/60" />
                    <cat.icon className="relative z-10 h-3 w-3 md:h-6 md:w-6 text-white shrink-0" />
                    <span className="relative z-10 text-white text-[10px] md:text-sm font-bold leading-none whitespace-nowrap">
                      {cat.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="w-full">
        <div className={`w-full ${isSearchFocused ? "hidden" : ""}`}>
          <div className="container mx-auto px-4 md:px-6 py-3 md:py-5 space-y-2 md:space-y-6">

            {/* Counties — horizontal scroll */}
            <section className="mb-4 md:mb-6">
              <div
                ref={countiesRef}
                className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
              >
                {FEATURED_COUNTIES.map((county, idx) => (
                  <div
                    key={county}
                    onClick={() => navigate(`/county/${encodeURIComponent(county)}`)}
                    className="flex-shrink-0 w-[28vw] sm:w-[120px] md:w-[140px] snap-start cursor-pointer group"
                  >
                    <div className="relative overflow-hidden aspect-square bg-muted rounded-none">
                      <img
                        src={COUNTY_IMAGES[county] || `/images/counties/${county.toLowerCase().replace(/['\s]/g, "-")}.jpg`}
                        alt={county}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading={idx < 4 ? "eager" : "lazy"}
                        decoding="async"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <h3 className="text-white font-extrabold text-[10px] sm:text-xs leading-tight">{county}</h3>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Browse Guides */}
            <GridSection
              title="Browse Guides"
              viewAllPath="/explore"
              accentColor="hsl(25, 90%, 50%)"
              items={browseGuideNodes}
              loading={loadingScrollable}
            />

            {/* Nearest to You */}
            {position && (sortedNearbyPlaces.length > 0 || loadingNearby) && (
              <GridSection
                title={t("sections.nearestToYou")}
                viewAllPath="/explore"
                accentColor="hsl(200, 70%, 45%)"
                items={nearbyNodes}
                loading={loadingNearby}
              />
            )}

            {/* Quick Navigation */}
            <section className="mb-4 md:mb-8">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Quick Access</h2>
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                {QUICK_NAV.map(nav => (
                  <button
                    key={nav.title}
                    onClick={() => navigate(nav.path)}
                    className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-card border border-border hover:shadow-md transition-all active:scale-95"
                  >
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${nav.color}15` }}
                    >
                      <nav.icon style={{ color: nav.color, width: 14, height: 14 }} />
                    </div>
                    <span className="text-[9px] font-bold text-foreground leading-tight text-center">{nav.title}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Become a Host CTA */}
            <section className="mb-4 md:mb-8">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-3 md:p-4">
                <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/10 pointer-events-none" />
                <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="h-4 w-4 text-yellow-300 fill-yellow-300" />
                      <span className="text-primary-foreground/80 text-xs font-semibold uppercase tracking-widest">
                        Partner with us
                      </span>
                    </div>
                    <h3 className="text-primary-foreground text-xl md:text-2xl font-extrabold leading-tight mb-1">
                      Become a Host
                    </h3>
                    <p className="text-primary-foreground/75 text-sm md:text-base leading-relaxed max-w-md">
                      List your property or experience and reach thousands of travellers. It's free to get started.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <button
                      onClick={() => navigate("/become-host")}
                      className="px-6 py-2 rounded-xl bg-white text-primary font-bold text-sm shadow-lg hover:bg-white/90 active:scale-95 transition-all whitespace-nowrap"
                    >
                      Get Started →
                    </button>
                    <button
                      onClick={() => navigate("/become-host#learn-more")}
                      className="px-6 py-2 rounded-xl bg-white/15 text-primary-foreground font-semibold text-sm border border-white/25 hover:bg-white/25 active:scale-95 transition-all whitespace-nowrap"
                    >
                      Learn More
                    </button>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>

        {/* Location permission dialog */}
        <AlertDialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Navigation className="h-8 w-8 text-primary" />
                </div>
              </div>
              <AlertDialogTitle className="text-center">{t("location.turnOn")}</AlertDialogTitle>
              <AlertDialogDescription className="text-center">{t("location.description")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <AlertDialogAction
                onClick={() => { setShowLocationDialog(false); forceRequestLocation(); }}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {t("location.tryAgain")}
              </AlertDialogAction>
              <AlertDialogAction
                onClick={() => setShowLocationDialog(false)}
                className="w-full bg-muted text-muted-foreground hover:bg-muted/80"
              >
                {t("location.continueWithout")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default Index;