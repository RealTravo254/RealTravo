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
  Calendar, Tent, MapPin, Building2, Home, Map,
  Navigation, Heart, Ticket, Star, Search as SearchIcon,
} from "lucide-react";
import { FEATURED_COUNTIES, COUNTY_IMAGES } from "@/lib/kenyaCounties";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useRatings, sortByRating } from "@/hooks/useRatings";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { useResponsiveLimit } from "@/hooks/useResponsiveLimit";

// ── GridSection ───────────────────────────────────────────────────────────────
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

  useEffect(() => {
    setVisibleCount(prev => Math.min(prev, Math.max(items.length, INITIAL_VISIBLE_COUNT)));
  }, [items.length]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;
  const nextBatchSize = Math.min(LOAD_MORE_COUNT, Math.max(items.length - visibleCount, 0));

  const handleSeeMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    window.setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, items.length));
      setLoadingMore(false);
    }, 500);
  };

  // Show the skeleton mockup any time there are no items — whether we're
  // still loading, or loading finished and simply came back empty — so the
  // section never collapses to a blank gap.
  const showSkeletons = items.length === 0;
  const cardWidthClasses = "w-[75vw] sm:w-[230px] md:w-[240px] lg:w-[260px] shrink-0";

  const Skeletons = ({ count }: { count: number }) => (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className={cardWidthClasses}>
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
          to={viewAllPath}
          className="text-xs md:text-sm font-semibold hover:opacity-70 transition-opacity shrink-0"
          style={{ color: accentColor }}
        >
          View All →
        </Link>
      </div>

      {showSkeletons ? (
        <div className="flex gap-2.5 md:gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
          <Skeletons count={INITIAL_VISIBLE_COUNT} />
        </div>
      ) : (
        <>
          <div className="flex gap-2.5 md:gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
            {visibleItems.map((item, i) => (
              <div key={i} className={`${cardWidthClasses} snap-start`}>
                {item}
              </div>
            ))}
            {loadingMore && <Skeletons count={nextBatchSize || LOAD_MORE_COUNT} />}
          </div>

          {hasMore && !loadingMore && (
            <div className="flex justify-center mt-4">
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
// Attraction and Park removed — add them back here when their pages are ready.
// AirBnbs hidden per request — uncomment to bring it back.
// Hotels + Campsites merged into a single "Hotels & Campsites" card per request.
// If you later add a dedicated combined route, update the `path` below —
// it currently points at the existing hotels category page.
const CATEGORIES = [
  { icon: Building2, title: "Hotels & Campsites", path: "/category/hotels",        bgImage: "/images/category-hotels.jpg" },
  { icon: Map,        title: "Tours & Trips",       path: "/category/guided",        bgImage: "/images/category-trips.jpg" },
  // { icon: Home,       title: "AirBnbs", path: "/category/accommodations", bgImage: "/images/category-accommodations.png" },
];

// ── Quick-nav shortcuts ───────────────────────────────────────────────────────
// Attraction and Park removed — add them back here when their pages are ready.
// AirBnb hidden per request — uncomment to bring it back.
const QUICK_NAV = [
  { icon: Building2, title: "hotels  ",         path: "/category/hotels",        color: "hsl(205, 85%, 45%)" },
  { icon: Tent,       title: "Campsites",      path: "/category/campsite",       color: "hsl(278, 90%, 50%)" },
  { icon: Map,        title: "Tours & Trips",  path: "/category/guided",          color: "hsl(235, 90%, 50%)" },
  { icon: Ticket,     title: "Bookings",       path: "/bookings",                color: "hsl(200, 70%, 45%)" },
  { icon: Heart,      title: "Saved",          path: "/saved",                   color: "hsl(350, 80%, 55%)" },
  // { icon: Home,       title: "AirBnb", path: "/category/accomodations", color: "hsl(160, 70%, 40%)" },
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
    trips: any[]; campsites: any[]; events: any[]; guidedTrips: any[];
  }>({ trips: [], campsites: [], events: [], guidedTrips: [] });

  const [nearbyPlacesHotels, setNearbyPlacesHotels] = useState<any[]>([]);
  const [loadingScrollable, setLoadingScrollable]   = useState(true);
  const [loadingNearby, setLoadingNearby]           = useState(false);
  const [isSearchFocused, setIsSearchFocusedLocal]  = useState(false);
  const { setSearchFocused } = useSearchFocus();

  const setIsSearchFocused = useCallback((v: boolean) => {
    setIsSearchFocusedLocal(v);
    setSearchFocused(v);
  }, [setSearchFocused]);

  const allItemIds = useMemo(() => {
    const ids = new Set<string>();
    nearbyPlacesHotels.forEach(i => ids.add(i.id));
    // scrollableRows.trips.forEach(i => ids.add(i.id)); // fixed trips disabled
    scrollableRows.campsites.forEach(i => ids.add(i.id));
    // scrollableRows.events.forEach(i => ids.add(i.id)); // events disabled
    scrollableRows.guidedTrips.forEach(i => ids.add(i.id));
    return Array.from(ids);
  }, [nearbyPlacesHotels, scrollableRows]);

  const tripEventIds = useMemo(() => {
    // const ids = [...scrollableRows.trips, ...scrollableRows.events].map(i => i.id);
    // Fixed trips and events remain disabled — only guided trips are tracked for bookings.
    const ids = [...scrollableRows.guidedTrips].map(i => i.id);
    return [...new Set(ids)];
  }, [scrollableRows.guidedTrips]);

  const { bookingStats } = useRealtimeBookings(tripEventIds);
  const { ratings }      = useRatings(allItemIds);

  // "Nearest to You" — adventure places sorted by distance, guided trips by rating appended after
  const sortedNearbyPlaces = useMemo(() => {
    const places = sortByRating(nearbyPlacesHotels, ratings, position, calculateDistance)
      .map((item: any) => ({ ...item, __cardType: "ADVENTURE PLACE" as const }));

    const seen = new Set(places.map((p: any) => p.id));
    const others = [
      // ...scrollableRows.trips.map(item => ({ ...item, __cardType: "TRIP" as const })),   // fixed trips disabled
      ...scrollableRows.guidedTrips.map(item => ({ ...item, __cardType: "TRIP" as const })),
      // ...scrollableRows.events.map(item => ({ ...item, __cardType: "EVENT" as const })),  // events disabled
    ]
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

    return [...places, ...others];
  }, [nearbyPlacesHotels, ratings, position, scrollableRows.guidedTrips]);

  // "Browsers guide" — campsites + guided trips, ranked by rating
  const displayBrowseGuides = useMemo(() => {
    const seen = new Set<string>();
    const combined = [
      ...scrollableRows.campsites.map(item => ({ ...item, __cardType: "ADVENTURE PLACE" as const })),
      // ...scrollableRows.trips.map(item => ({ ...item, __cardType: "TRIP" as const })),   // fixed trips disabled
      ...scrollableRows.guidedTrips.map(item => ({ ...item, __cardType: "TRIP" as const })),
      // ...scrollableRows.events.map(item => ({ ...item, __cardType: "EVENT" as const })), // events disabled
    ];
    return combined
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
  }, [scrollableRows.campsites, scrollableRows.guidedTrips, ratings]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchScrollableRows = useCallback(async (limit: number, opts: { background?: boolean } = {}) => {
    // `background` refreshes silently update data without flipping the
    // loading flag, so the skeleton/spinner never reappears once content
    // is already on screen — only the very first load shows it.
    if (!opts.background) setLoadingScrollable(true);
    const fetchLimit = Math.max(limit * 3, 60);
    try {
      const [
        // tripsData,   // fixed trips fetch disabled — uncomment to re-enable
        campsitesData,
        // eventsData,  // events fetch disabled — uncomment to re-enable
        guidedData,
      ] = await Promise.all([
        // ── Fixed-date trips (disabled — uncomment to re-enable) ──────────
        // supabase
        //   .from("trips")
        //   .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
        //   .eq("approval_status", "approved").eq("is_hidden", false)
        //   .eq("type", "trip").eq("is_flexible_date", false).eq("is_custom_date", false)
        //   .order("date", { ascending: true }).limit(fetchLimit),

        // ── Adventure places / campsites ──────────────────────────────────
        // category and days_opened added so ListingCard can render the
        // category badge correctly and the working-days / Open now-Closed
        // badge for hotel/campsite categories.
        supabase
          .from("adventure_places")
          .select("id,name,location,place,country,image_url,gallery_images,images,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours,category,days_opened")
          .eq("approval_status", "approved").eq("is_hidden", false).limit(fetchLimit),

        // ── Events (disabled — uncomment to re-enable) ────────────────────
        // supabase
        //   .from("trips")
        //   .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
        //   .eq("approval_status", "approved").eq("is_hidden", false)
        //   .eq("type", "event").order("date", { ascending: true }).limit(fetchLimit),

        // ── Guided tours (flexible / custom-date trips) — re-enabled ──────
        supabase
          .from("trips")
          .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
          .eq("approval_status", "approved").eq("is_hidden", false)
          .eq("type", "trip").or("is_flexible_date.eq.true,is_custom_date.eq.true")
          .order("created_at", { ascending: false }).limit(fetchLimit),
      ]);

      setScrollableRows({
        trips:       [],                    // fixed trips disabled
        campsites:   campsitesData.data || [],
        events:      [],                    // events disabled
        guidedTrips: guidedData.data || [],
      });
    } catch (err) {
      console.error("Error fetching rows:", err);
    } finally {
      if (!opts.background) setLoadingScrollable(false);
    }
  }, []);

  const fetchNearbyPlacesAndHotels = useCallback(async (opts: { background?: boolean } = {}) => {
    if (!position) return;
    if (!opts.background) setLoadingNearby(true);
    try {
      // category, days_opened, opening_hours, and closing_hours added so
      // ListingCard can render the category badge, working-days line, and
      // Open now/Closed badge for hotel/campsite categories in this row too.
      const { data } = await supabase
        .from("adventure_places")
        .select("id,name,location,place,country,image_url,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours,category,days_opened")
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
    } catch (err) {
      console.error("Error fetching nearby places:", err);
    } finally {
      if (!opts.background) setLoadingNearby(false);
    }
  }, [position]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { requestLocation(); }, [requestLocation]);

  // Caching removed — the home page now always fetches fresh data on load
  // instead of reusing a previously stored snapshot.
  useEffect(() => {
    fetchScrollableRows(cardLimit);
    getUserId().then(setUserId);
  }, [cardLimit, fetchScrollableRows]);

  useEffect(() => {
    if (position) fetchNearbyPlacesAndHotels();
  }, [position, fetchNearbyPlacesAndHotels]);

  // Silent background refresh — re-fetches data periodically without
  // flipping any loading state, so the front end never shows a skeleton
  // or visibly reloads. Existing content stays on screen and is swapped
  // in place once the new data arrives.
  const BACKGROUND_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchScrollableRows(cardLimit, { background: true });
      if (position) fetchNearbyPlacesAndHotels({ background: true });
    }, BACKGROUND_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [cardLimit, fetchScrollableRows, position, fetchNearbyPlacesAndHotels]);

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
        category={item.category}
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
        workingDays={item.days_opened}
      />
    );
  }, [position, ratings, savedItems, handleSave, bookingStats]);

  // ── Pre-build node arrays ──────────────────────────────────────────────────
  const browseGuideNodes = useMemo(() =>
    displayBrowseGuides.map((item: any, i) => {
      const isGuided = item.__cardType === "TRIP";
      return renderCard(item, item.__cardType, i, {
        hidePrice: !isGuided,
        isTrip: isGuided,
      });
    }),
    [displayBrowseGuides, renderCard],
  );

  const nearbyNodes = useMemo(() =>
    sortedNearbyPlaces.map((item: any, i) => {
      const a = item as any;
      const rd = ratings.get(item.id);
      const isGuided = a.__cardType === "TRIP";
      const today = new Date().toISOString().split("T")[0];
      return (
        <ListingCard
          key={item.id}
          id={item.id}
          type={a.__cardType || "ADVENTURE PLACE"}
          category={a.category}
          name={item.name}
          imageUrl={a.image_url}
          location={a.location}
          country={a.country}
          price={isGuided ? (a.price || 0) : (a.entry_fee || 0)}
          date={isGuided ? (a.date || "") : ""}
          isCustomDate={a.is_custom_date}
          isFlexibleDate={a.is_flexible_date}
          isOutdated={isGuided && a.date && !a.is_flexible_date && a.date < today}
          isSaved={savedItems.has(item.id)}
          onSave={handleSave}
          hideSave={false}
          hidePrice={!isGuided}
          showBadge={true}
          priority={i === 0}
          activities={a.activities}
          distance={a.distance}
          avgRating={rd?.avgRating}
          reviewCount={rd?.reviewCount}
          place={a.place}
          availableTickets={isGuided ? a.available_tickets : undefined}
          bookedTickets={isGuided ? bookingStats[item.id] || 0 : undefined}
          description={a.description}
          openingHours={a.opening_hours}
          closingHours={a.closing_hours}
          workingDays={a.days_opened}
        />
      );
    }),
    [sortedNearbyPlaces, ratings, savedItems, handleSave, bookingStats],
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
              <SheetContent side="left" className="w-[80vw] max-w-sm p-0 h-screen border-none">
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
            <div className="relative w-full flex flex-col px-4 md:px-8 pt-8 md:pt-10 pb-8 md:pb-10 overflow-hidden">
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

              <div className="relative z-10 flex flex-col items-center w-full max-w-3xl mx-auto">
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
            </div>
          </div>
        </div>
      )}

      <main className="w-full">
        <div className={`w-full ${isSearchFocused ? "hidden" : ""}`}>
          {/* ── All content constrained to container width (never bleeds to screen edge on desktop) ── */}
          <div className="container mx-auto px-4 md:px-6 py-3 md:py-5 space-y-2 md:space-y-6">

            {/* Categories ── now 2 cards (Hotels & Campsites merged, Tours & Trips),
                full screen width on mobile via the -mx-4/px-4 bleed technique used by
                the horizontal scroll sections below, constrained back to the
                container on md+ screens. Cards use an aspect-ratio on mobile/tablet
                (so they scale nicely with column width) but switch to a FIXED height
                at the lg breakpoint and up, so they no longer stretch tall on big
                screens. */}
            <section className="mb-4 md:mb-8">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">
                Browse by category
              </h2>
              <div className="-mx-4 px-4 md:mx-0 md:px-0">
                <div className="grid grid-cols-2 gap-2 md:gap-4">
                  {CATEGORIES.map(cat => (
                    <Link
                      key={cat.title}
                      to={cat.path}
                      className="relative flex flex-col items-center justify-center gap-1.5 rounded-xl overflow-hidden cursor-pointer aspect-[8/3] lg:aspect-auto lg:h-40 xl:h-48"
                    >
                      <img
                        src={cat.bgImage}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
                      />
                      <div className="absolute inset-0 bg-black/50 hover:bg-black/60 transition-colors" />
                      <cat.icon className="relative z-10 h-3.5 w-3.5 md:h-5 md:w-5 text-white shrink-0 drop-shadow" />
                      <span className="relative z-10 text-white text-[10px] md:text-sm font-extrabold leading-tight text-center drop-shadow px-1">
                        {cat.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

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

            {/* Browsers guide */}
            <GridSection
              title="Browsers guide"
              viewAllPath="/explore"
              accentColor="hsl(25, 90%, 50%)"
              items={browseGuideNodes}
              loading={loadingScrollable}
            />

            {/* Nearest to You */}
            {(position || nearbyPlacesHotels.length > 0) && (
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
              <div className="grid grid-cols-6 gap-1.5">
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