import { useState, useEffect, useRef, useMemo, useCallback, memo, lazy, Suspense } from "react";
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
import { Calendar, Tent, Compass, MapPin, ChevronLeft, ChevronRight, Loader2, Navigation, Home, Heart, Ticket, Trophy, Star, Search as SearchIcon } from "lucide-react";
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
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { CategoryCard } from "@/components/CategoryCard";

// ─── Memoized horizontal scroll section ─────────────────────────────────────
interface ScrollSectionProps {
  title: string;
  viewAllPath: string;
  accentColor: string;
  children: React.ReactNode;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  hasItems: boolean;
  loading: boolean;
}

const ScrollSection = memo(({ title, viewAllPath, accentColor, children, scrollRef, onScroll, hasItems, loading }: ScrollSectionProps) => {
  const scroll = useCallback((dir: 'left' | 'right') => {
    scrollRef.current?.scrollTo({
      left: scrollRef.current.scrollLeft + (dir === 'left' ? -320 : 320),
      behavior: 'smooth',
    });
  }, [scrollRef]);

  return (
    <section className="mb-4 md:mb-8">
      {/* Header: full-width flush on mobile, contained on md+ */}
      <div
        className="flex items-center justify-between mb-3 md:mb-4 rounded-none md:rounded-lg px-3 py-2 -mx-4 md:mx-0"
        style={{ backgroundColor: `${accentColor}10` }}
      >
        <h2 className="text-base sm:text-xl md:text-2xl font-extrabold tracking-tight" style={{ color: accentColor }}>
          {title}
        </h2>
        <Link
          to={viewAllPath}
          className="text-xs md:text-sm font-semibold transition-colors shrink-0"
          style={{ color: accentColor }}
        >
          View All →
        </Link>
      </div>
      <div className="relative group">
        {hasItems && (
          <>
            <Button
              variant="ghost" size="icon" aria-label="Scroll left"
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-background/90 shadow-md border border-border text-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost" size="icon" aria-label="Scroll right"
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-background/90 shadow-md border border-border text-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
        >
          {loading || !hasItems ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[44vw] sm:w-[220px] md:w-[240px] snap-start">
                <ListingSkeleton />
              </div>
            ))
          ) : children}
        </div>
      </div>
    </section>
  );
});
ScrollSection.displayName = "ScrollSection";

// ─── Category cards with images (no Hotels) + Guide ──────────────────────────
const CATEGORIES = [
  { icon: Tent, title: "Adventures", path: "/category/campsite", bgImage: "/images/category-adventures.jpg" },
  { icon: Calendar, title: "Trips", path: "/category/trips", bgImage: "/images/category-trips.jpg" },
  { icon: Compass, title: "Events", path: "/category/events", bgImage: "/images/category-events.jpg" },
  { icon: MapPin, title: "Guided Tours", path: "/category/guided", bgImage: "/images/category-trips.jpg" },
];

// ─── Quick navigation cards (above footer) ───────────────────────────────────
const QUICK_NAV = [
  { icon: Calendar, title: "Trips", path: "/category/trips", color: "hsl(25, 90%, 50%)" },
  { icon: Trophy, title: "Events & Sports", path: "/category/events", color: "hsl(340, 75%, 50%)" },
  { icon: Tent, title: "Adventure Places", path: "/category/campsite", color: "hsl(142, 70%, 35%)" },
  { icon: Ticket, title: "Bookings", path: "/bookings", color: "hsl(200, 70%, 45%)" },
  { icon: Heart, title: "Saved", path: "/saved", color: "hsl(350, 80%, 55%)" },
];

// ─── Main component ──────────────────────────────────────────────────────────
const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState<any[]>([]);
  const { savedItems, handleSave } = useSavedItems();
  const [loading, setLoading] = useState(true);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { position, loading: locationLoading, requestLocation, forceRequestLocation } = useGeolocation();
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const { cardLimit, isLargeScreen } = useResponsiveLimit();

  const [isSearchVisible, setIsSearchVisible] = useState(true);
  const [showSearchIcon, setShowSearchIcon] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [isIndexDrawerOpen, setIsIndexDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [scrollableRows, setScrollableRows] = useState<{
    trips: any[]; hotels: any[]; attractions: any[];
    campsites: any[]; events: any[]; accommodations: any[]; guidedTrips: any[];
  }>({ trips: [], hotels: [], attractions: [], campsites: [], events: [], accommodations: [], guidedTrips: [] });
  const [nearbyPlacesHotels, setNearbyPlacesHotels] = useState<any[]>([]);
  const [loadingScrollable, setLoadingScrollable] = useState(true);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [isSearchFocused, setIsSearchFocusedLocal] = useState(false);
  const { setSearchFocused } = useSearchFocus();
  const [countyCounts, setCountyCounts] = useState<Record<string, { adventures: number; guidedTrips: number }>>({});

  const setIsSearchFocused = useCallback((v: boolean) => {
    setIsSearchFocusedLocal(v);
    setSearchFocused(v);
  }, [setSearchFocused]);

  // Collect all item IDs for ratings
  const allItemIds = useMemo(() => {
    const ids = new Set<string>();
    listings.forEach(item => ids.add(item.id));
    nearbyPlacesHotels.forEach(item => ids.add(item.id));
    scrollableRows.trips.forEach(item => ids.add(item.id));
    scrollableRows.campsites.forEach(item => ids.add(item.id));
    scrollableRows.events.forEach(item => ids.add(item.id));
    return Array.from(ids);
  }, [listings, nearbyPlacesHotels, scrollableRows]);

  const tripEventIds = useMemo(() => {
    const ids = [...scrollableRows.trips, ...scrollableRows.events].map(item => item.id);
    listings.forEach(item => {
      if (item.type === "TRIP" || item.type === "EVENT") ids.push(item.id);
    });
    return [...new Set(ids)];
  }, [scrollableRows.trips, scrollableRows.events, listings]);

  const { bookingStats } = useRealtimeBookings(tripEventIds);
  const { ratings } = useRatings(allItemIds);

  const sortedListings = useMemo(() => sortByRating(listings, ratings, position, calculateDistance), [listings, ratings, position]);
  const sortedNearbyPlaces = useMemo(() => sortByRating(nearbyPlacesHotels, ratings, position, calculateDistance), [nearbyPlacesHotels, ratings, position]);
  const sortedEvents = useMemo(() => sortByRating(scrollableRows.events, ratings, position, calculateDistance), [scrollableRows.events, ratings, position]);
  const sortedCampsites = useMemo(() => sortByRating(scrollableRows.campsites, ratings, position, calculateDistance), [scrollableRows.campsites, ratings, position]);
  const sortedTrips = useMemo(() => sortByRating(scrollableRows.trips, ratings, position, calculateDistance), [scrollableRows.trips, ratings, position]);

  // Scroll refs
  const featuredCampsitesRef = useRef<HTMLDivElement>(null);
  const featuredEventsRef = useRef<HTMLDivElement>(null);
  const featuredTripsRef = useRef<HTMLDivElement>(null);
  const guidedTripsRef = useRef<HTMLDivElement>(null);
  const adventurePlacesRef = useRef<HTMLDivElement>(null);
  const countiesRef = useRef<HTMLDivElement>(null);

  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});

  const [listingViewMode, setListingViewMode] = useState<'top_destinations' | 'my_location'>('top_destinations');

  const handleScroll = useCallback((sectionName: string) => (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollPositions(prev => ({ ...prev, [sectionName]: target.scrollLeft }));
  }, []);

  // ─── Data fetching ─────────────────────────────────────────────────────────
  const fetchScrollableRows = useCallback(async (limit: number) => {
    setLoadingScrollable(true);
    const fetchLimit = Math.max(limit * 3, 30);
    try {
      const [tripsData, campsitesData, eventsData, guidedData] = await Promise.all([
        supabase.from("trips").select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
          .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip").eq("is_flexible_date", false).eq("is_custom_date", false).order("date", { ascending: true }).limit(fetchLimit),
        supabase.from("adventure_places").select("id,name,location,place,country,image_url,gallery_images,images,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours")
          .eq("approval_status", "approved").eq("is_hidden", false).limit(fetchLimit),
        supabase.from("trips").select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
          .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "event").order("date", { ascending: true }).limit(fetchLimit),
        supabase.from("trips").select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
          .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip").or("is_flexible_date.eq.true,is_custom_date.eq.true").order("created_at", { ascending: false }).limit(fetchLimit),
      ]);
      setScrollableRows({
        trips: tripsData.data || [], hotels: [],
        attractions: [], campsites: campsitesData.data || [],
        events: eventsData.data || [], accommodations: [],
        guidedTrips: guidedData.data || [],
      });
    } catch (error) {
      console.error("Error fetching scrollable rows:", error);
    } finally {
      setLoadingScrollable(false);
    }
  }, []);

  const fetchNearbyPlacesAndHotels = useCallback(async () => {
    setLoadingNearby(true);
    if (!position) return;
    const [placesData] = await Promise.all([
      supabase.from("adventure_places").select("id,name,location,place,country,image_url,entry_fee,activities,latitude,longitude,created_at,description")
        .eq("approval_status", "approved").eq("is_hidden", false).limit(12),
    ]);
    const combined = [
      ...(placesData.data || []).map(item => ({ ...item, type: "ADVENTURE PLACE", table: "adventure_places" })),
    ];
    const withDistance = combined.map(item => {
      const dist = (item as any).latitude && (item as any).longitude && position
        ? calculateDistance(position.latitude, position.longitude, (item as any).latitude, (item as any).longitude) : undefined;
      return { ...item, distance: dist };
    }).sort((a, b) => {
      if (a.distance !== undefined && b.distance !== undefined) return a.distance - b.distance;
      if (a.distance !== undefined) return -1;
      if (b.distance !== undefined) return 1;
      return 0;
    });
    const nearby = withDistance.slice(0, 12);
    setNearbyPlacesHotels(nearby);
    if (nearby.length > 0) setLoadingNearby(false);
  }, [position]);

  const fetchAllData = useCallback(async (query?: string, offset: number = 0, limit: number = 15) => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const fetchEvents = async () => {
      let dbQuery = supabase.from("trips").select("id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description")
        .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "event").or(`date.gte.${today},is_flexible_date.eq.true`);
      if (query) { const p = `%${query}%`; dbQuery = dbQuery.or(`name.ilike.${p},location.ilike.${p},country.ilike.${p}`); }
      dbQuery = dbQuery.order('date', { ascending: true }).range(offset, offset + limit - 1);
      const { data } = await dbQuery;
      return (data || []).map((item: any) => ({ ...item, type: "EVENT" }));
    };
    const fetchTable = async (table: "adventure_places", type: string) => {
      let dbQuery = supabase.from(table).select("id,name,location,place,country,image_url,entry_fee,activities,latitude,longitude,created_at,description")
        .eq("approval_status", "approved").eq("is_hidden", false);
      if (query) { const p = `%${query}%`; dbQuery = dbQuery.or(`name.ilike.${p},location.ilike.${p},country.ilike.${p}`); }
      dbQuery = dbQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      const { data } = await dbQuery;
      return (data || []).map((item: any) => ({ ...item, type }));
    };
    const fetchTrips = async () => {
      let dbQuery = supabase.from("trips").select("id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description")
        .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip");
      if (query) { const p = `%${query}%`; dbQuery = dbQuery.or(`name.ilike.${p},location.ilike.${p},country.ilike.${p}`); }
      dbQuery = dbQuery.order('date', { ascending: true }).range(offset, offset + limit - 1);
      const { data } = await dbQuery;
      return (data || []).map((item: any) => ({ ...item, type: "TRIP" }));
    };

    const [events, trips, adventures] = await Promise.all([fetchEvents(), fetchTrips(), fetchTable("adventure_places", "ADVENTURE PLACE")]);
    let combined = [...adventures, ...trips, ...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (offset === 0) { setListings(combined); setHasMoreSearchResults(true); }
    else { setListings(prev => [...prev, ...combined]); }
    if (combined.length < limit) setHasMoreSearchResults(false);
    setLoading(false);
    return combined;
  }, [position]);

  const loadMoreSearchResults = useCallback(async () => {
    if (loading || !searchQuery || !hasMoreSearchResults) return;
    const prevLength = listings.length;
    await fetchAllData(searchQuery, listings.length, 20);
    if (listings.length === prevLength) setHasMoreSearchResults(false);
  }, [loading, searchQuery, listings.length, hasMoreSearchResults, fetchAllData]);

  // ─── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleInteraction = () => { requestLocation(); window.removeEventListener('scroll', handleInteraction); window.removeEventListener('click', handleInteraction); };
    window.addEventListener('scroll', handleInteraction, { once: true });
    window.addEventListener('click', handleInteraction, { once: true });
    return () => { window.removeEventListener('scroll', handleInteraction); window.removeEventListener('click', handleInteraction); };
  }, [requestLocation]);

  useEffect(() => {
    if (!searchQuery || !hasMoreSearchResults) return;
    const handleScrollEvent = () => {
      if (loading || !hasMoreSearchResults) return;
      if (document.documentElement.scrollTop + document.documentElement.clientHeight >= document.documentElement.scrollHeight - 500) loadMoreSearchResults();
    };
    window.addEventListener('scroll', handleScrollEvent);
    return () => window.removeEventListener('scroll', handleScrollEvent);
  }, [loading, searchQuery, hasMoreSearchResults, loadMoreSearchResults]);

  useEffect(() => {
    const cachedData = getCachedHomePageData();
    if (cachedData) {
      setListings(cachedData.listings || []);
      const c = cachedData.scrollableRows as any || {};
      const cachedRows = { trips: c.trips || [], hotels: c.hotels || [], attractions: c.attractions || [], campsites: c.campsites || [], events: c.events || [], accommodations: c.accommodations || [], guidedTrips: c.guidedTrips || [] };
      setScrollableRows(cachedRows);
      setNearbyPlacesHotels(cachedData.nearbyPlacesHotels || []);
      setLoading(false); setLoadingScrollable(false); setLoadingNearby(false);
      const cacheAge = Date.now() - (cachedData.cachedAt || 0);
      const hasScrollableData = cachedRows.trips.length > 0 || cachedRows.campsites.length > 0 || cachedRows.events.length > 0;
      if (cacheAge < 5 * 60 * 1000 && hasScrollableData) {
        getUserId().then(setUserId);
        return;
      }
    }
    fetchAllData();
    fetchScrollableRows(cardLimit);
    getUserId().then(setUserId);
  }, [cardLimit, fetchScrollableRows, fetchAllData]);

  // Fetch county counts for adventure places and guided trips
  useEffect(() => {
    const fetchCountyCounts = async () => {
      const [adventuresRes, guidedRes] = await Promise.all([
        supabase.from("adventure_places").select("place").eq("approval_status", "approved").eq("is_hidden", false),
        supabase.from("trips").select("place").eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip").or("is_flexible_date.eq.true,is_custom_date.eq.true"),
      ]);
      const counts: Record<string, { adventures: number; guidedTrips: number }> = {};
      FEATURED_COUNTIES.forEach(c => { counts[c] = { adventures: 0, guidedTrips: 0 }; });
      (adventuresRes.data || []).forEach((item: any) => {
        if (counts[item.place]) counts[item.place].adventures++;
      });
      (guidedRes.data || []).forEach((item: any) => {
        if (counts[item.place]) counts[item.place].guidedTrips++;
      });
      setCountyCounts(counts);
    };
    fetchCountyCounts();
  }, []);

  useEffect(() => {
    const hasScrollableData = scrollableRows.trips.length > 0 || scrollableRows.campsites.length > 0 || scrollableRows.events.length > 0;
    if (!loading && !loadingScrollable && listings.length > 0 && hasScrollableData) {
      setCachedHomePageData({ scrollableRows, listings, nearbyPlacesHotels });
    }
  }, [loading, loadingScrollable, listings, scrollableRows, nearbyPlacesHotels]);

  useEffect(() => { if (position) fetchNearbyPlacesAndHotels(); }, [position, fetchNearbyPlacesAndHotels]);

  useEffect(() => {
    const ctrl = () => {
      if (window.scrollY > 0) {
        setIsSearchVisible(false);
        setShowSearchIcon(true);
        setScrolledPastHero(true);
      } else {
        setIsSearchVisible(true);
        setShowSearchIcon(false);
        setScrolledPastHero(false);
      }
    };
    window.addEventListener("scroll", ctrl, { passive: true });
    return () => window.removeEventListener("scroll", ctrl);
  }, []);

  const handleSearchIconClick = () => { navigate('/explore'); };

  const handleMyLocationTap = useCallback(() => {
    if (!position && !locationLoading) forceRequestLocation();
    setListingViewMode('my_location');
  }, [position, locationLoading, forceRequestLocation]);

  const getDisplayItems = useCallback((items: any[], sortedByRating: any[], isTripsOrEvents = false) => {
    let result = listingViewMode === 'my_location' && position
      ? [...items].sort((a, b) => {
          const distA = a.latitude && a.longitude ? calculateDistance(position.latitude, position.longitude, a.latitude, a.longitude) : Infinity;
          const distB = b.latitude && b.longitude ? calculateDistance(position.latitude, position.longitude, b.latitude, b.longitude) : Infinity;
          return distA - distB;
        })
      : sortedByRating;

    if (isTripsOrEvents) {
      const today = new Date().toISOString().split('T')[0];
      const filtered: any[] = [];
      result.forEach(item => {
        if (item.date && !item.is_flexible_date && item.date < today) return;
        // Exclude flexible/guided trips from trips section
        if (item.is_flexible_date) return;
        const bookedCount = bookingStats[item.id] || 0;
        if (!item.is_flexible_date && item.available_tickets != null && (item.available_tickets <= 0 || bookedCount >= item.available_tickets)) return;
        filtered.push(item);
      });
      return filtered;
    }
    return result;
  }, [listingViewMode, position, bookingStats]);

  const displayCampsites = useMemo(() => getDisplayItems(scrollableRows.campsites, sortedCampsites), [scrollableRows.campsites, sortedCampsites, getDisplayItems]);
  const displayTrips = useMemo(() => getDisplayItems(scrollableRows.trips, sortedTrips, true), [scrollableRows.trips, sortedTrips, getDisplayItems]);
  const displayEvents = useMemo(() => getDisplayItems(scrollableRows.events, sortedEvents, true), [scrollableRows.events, sortedEvents, getDisplayItems]);
  const sortedGuidedTrips = useMemo(() => sortByRating(scrollableRows.guidedTrips, ratings, position, calculateDistance), [scrollableRows.guidedTrips, ratings, position]);
  const displayGuidedTrips = useMemo(() => {
    const items = sortedGuidedTrips;
    // No date filtering for guided (flexible) trips
    return items;
  }, [sortedGuidedTrips]);

  const renderCard = useCallback((item: any, type: string, index: number, opts: { hidePrice?: boolean; isTrip?: boolean; categoryColor?: string } = {}) => {
    const itemDistance = position && item.latitude && item.longitude ? calculateDistance(position.latitude, position.longitude, item.latitude, item.longitude) : undefined;
    const ratingData = ratings.get(item.id);
    const today = new Date().toISOString().split('T')[0];
    const isOutdated = item.date && !item.is_flexible_date && item.date < today;
    return (
      <div key={item.id} className="flex-shrink-0 w-[44vw] sm:w-[220px] md:w-[240px] snap-start">
        <ListingCard
          id={item.id} type={type as any} name={item.name}
          imageUrl={item.image_url} location={item.location} country={item.country}
          price={item.price || item.entry_fee || 0} date={item.date || ""}
          isCustomDate={item.is_custom_date} isFlexibleDate={item.is_flexible_date}
          isOutdated={isOutdated}
          isSaved={savedItems.has(item.id)}
          onSave={handleSave}
          hideSave={false}
          hidePrice={opts.hidePrice ?? false}
          showBadge={true} priority={index === 0}
          activities={item.activities} distance={itemDistance}
          avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount}
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
      </div>
    );
  }, [position, ratings, savedItems, handleSave, bookingStats]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Realtravo - Book Trips & Adventures"
        description="Discover and book exciting trips, events, and adventure experiences. Your gateway to unforgettable travel."
        canonical="https://realtravo.com/"
        ogImage="https://realtravo.com/fulllogo.png"
        jsonLd={{
          "@context": "https://schema.org", "@type": "WebSite", "name": "Realtravo", "url": "https://realtravo.com",
          "potentialAction": { "@type": "SearchAction", "target": "https://realtravo.com/?q={search_term_string}", "query-input": "required name=search_term_string" }
        }}
      />

      {/* Fixed top bar */}
      {!isSearchFocused && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] md:hidden flex items-center justify-between px-4 pointer-events-none"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)', paddingBottom: '10px' }}
        >
          <div
            className="pointer-events-auto rounded-xl"
            style={{
              backgroundColor: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
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
              <SheetContent side="left" className="w-full sm:w-72 p-0 h-screen border-none">
                <NavigationDrawer onClose={() => setIsIndexDrawerOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {showSearchIcon && (
              <button
                onClick={handleSearchIconClick}
                className="h-9 w-9 rounded-xl flex items-center justify-center text-white transition-all active:scale-95"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                }}
                aria-label="Search"
              >
                <SearchIcon className="h-5 w-5" />
              </button>
            )}
            <div
              className="rounded-xl [&_button]:h-9 [&_button]:w-9 [&_button]:text-white"
              style={{
                backgroundColor: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
              }}
            >
              <NotificationBell />
            </div>
          </div>
        </div>
      )}

      {/* Hero — full width on ALL screens (no container wrapper on mobile) */}
      {!isSearchFocused && (
        <div ref={searchRef} className="w-full">
          {/* On md+: keep the container constraint. On mobile: go edge-to-edge */}
          <div className="md:container md:mx-auto md:px-6">
            <div className="relative w-full flex flex-col px-4 md:px-8 pt-8 md:pt-10 pb-5 md:pb-6 overflow-hidden">
              {/* Hero background image — eager + high priority so browser fetches it immediately */}
              <img
                src="/images/hero-background.webp"
                alt=""
                aria-hidden="true"
                fetchPriority="high"
                loading="eager"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
              />

              {/* Overlays */}
              <div className="absolute inset-0 bg-black/25" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30" />

              {/* Tagline + title + search */}
              <div className="relative z-10 flex flex-col items-center w-full max-w-3xl mx-auto mb-4 md:mb-5">
                <p className="text-white/70 text-xs md:text-sm font-semibold uppercase tracking-widest text-center mb-2">
                  {t('hero.tagline')}
                </p>
                <h1 className="text-white text-3xl md:text-4xl lg:text-5xl font-extrabold text-center mb-4 leading-tight tracking-tight">
                  {t('hero.title')}
                </h1>
                <div onClick={() => navigate('/explore')} className="cursor-pointer w-full">
                  <SearchBarWithSuggestions
                    value="" onChange={() => {}}
                    onSubmit={() => navigate('/explore')}
                    onSuggestionSearch={() => navigate('/explore')}
                    onFocus={() => navigate('/explore')}
                    onBlur={() => {}}
                    onBack={() => {}}
                    showBackButton={false}
                  />
                </div>
              </div>

              {/* Category cards — all link to /explore for unified discovery */}
              <div className="relative z-10 w-full flex items-center justify-between mt-2 mb-1">
                <span className="text-white/80 text-[10px] md:text-xs font-bold uppercase tracking-widest">Browse Guides</span>
                <button
                  onClick={() => navigate('/explore')}
                  className="text-white text-[10px] md:text-xs font-bold underline-offset-2 hover:underline"
                >
                  View All →
                </button>
              </div>
              <div className="relative z-10 w-full grid grid-cols-4 gap-2 md:gap-3">
                {CATEGORIES.map((cat) => (
                  <div
                    key={cat.title}
                    onClick={() => navigate('/explore')}
                    className="cursor-pointer rounded-lg relative w-full flex flex-col items-center justify-center gap-1 px-2 py-2 md:py-4 overflow-hidden"
                    style={{ height: 'clamp(60px, 8vw, 144px)' }}
                  >
                    {/* Category background image — eager since all 4 are above the fold */}
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
        <div className={`w-full ${isSearchFocused ? 'hidden' : ''}`}>

          <div className="container mx-auto px-4 md:px-6 py-3 md:py-5 space-y-2 md:space-y-4">
            {/* Counties — sorted by most listings */}
            <section className="mb-4 md:mb-8">
              <div ref={countiesRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory">
                {[...FEATURED_COUNTIES].sort((a, b) => {
                  const totalA = (countyCounts[a]?.adventures || 0) + (countyCounts[a]?.guidedTrips || 0);
                  const totalB = (countyCounts[b]?.adventures || 0) + (countyCounts[b]?.guidedTrips || 0);
                  return totalB - totalA;
                }).map((county, idx) => {
                  const isVisible = idx < 4;
                  const counts = countyCounts[county] || { adventures: 0, guidedTrips: 0 };
                  const total = counts.adventures + counts.guidedTrips;
                  const countsLoaded = Object.keys(countyCounts).length > 0;
                  const displayCount = !countsLoaded ? null : total > 999 ? "999+" : String(total);
                  return (
                    <div
                      key={county}
                      onClick={() => navigate(`/county/${encodeURIComponent(county)}`)}
                      className="flex-shrink-0 w-[28vw] sm:w-[120px] md:w-[140px] snap-start cursor-pointer group"
                    >
                      <div className="relative overflow-hidden aspect-square bg-muted rounded-none">
                        <img
                          src={COUNTY_IMAGES[county] || `/images/counties/${county.toLowerCase().replace(/['\s]/g, '-')}.jpg`}
                          alt={county}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading={isVisible ? "eager" : "lazy"}
                          decoding="async"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <h3 className="text-white font-extrabold text-[10px] sm:text-xs leading-tight">{county}</h3>
                          <p className="text-white/70 text-[8px] font-bold mt-0.5 flex items-center gap-1">
                            {displayCount === null ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <>{displayCount} listings</>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Trips */}
            <ScrollSection
              title={t('sections.tripsAndTours')} viewAllPath="/category/trips"
              accentColor="hsl(25, 90%, 50%)" scrollRef={featuredTripsRef}
              onScroll={handleScroll('featuredTrips')}
              hasItems={displayTrips.length > 0} loading={loadingScrollable}
            >
              {displayTrips.map((trip, i) => renderCard(trip, trip.type === "event" ? "EVENT" : "TRIP", i, { isTrip: true, categoryColor: "hsl(25, 90%, 50%)" }))}
            </ScrollSection>

            {/* Events */}
            <ScrollSection
              title={t('sections.sportsAndEvents')} viewAllPath="/category/events"
              accentColor="hsl(340, 75%, 50%)" scrollRef={featuredEventsRef}
              onScroll={handleScroll('featuredEvents')}
              hasItems={displayEvents.length > 0} loading={loadingScrollable}
            >
              {displayEvents.map((event, i) => renderCard(event, "EVENT", i, { isTrip: true, categoryColor: "hsl(340, 75%, 50%)" }))}
            </ScrollSection>

            {/* Guided Tours & Activities */}
            <ScrollSection
              title="Guided Tours & Activities" viewAllPath="/category/guided"
              accentColor="hsl(260, 70%, 55%)" scrollRef={guidedTripsRef}
              onScroll={handleScroll('guidedTrips')}
              hasItems={displayGuidedTrips.length > 0} loading={loadingScrollable}
            >
              {displayGuidedTrips.map((trip, i) => renderCard(trip, "TRIP", i, { isTrip: true, categoryColor: "hsl(260, 70%, 55%)" }))}
            </ScrollSection>

            {/* Adventure Places */}
            <ScrollSection
              title="Adventure Places" viewAllPath="/category/campsite"
              accentColor="hsl(142, 70%, 35%)" scrollRef={adventurePlacesRef}
              onScroll={handleScroll('adventurePlaces')}
              hasItems={displayCampsites.length > 0} loading={loadingScrollable}
            >
              {displayCampsites.map((place, i) => renderCard(place, "ADVENTURE PLACE", i, { hidePrice: true, categoryColor: "hsl(142, 70%, 35%)" }))}
            </ScrollSection>

            {position && sortedNearbyPlaces.length > 0 && (
              <section className="mb-4 md:mb-8">
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <MapPin className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
                  <h2 className="text-base sm:text-xl md:text-2xl font-extrabold tracking-tight text-blue-500">
                    {t('sections.nearestToYou')}
                  </h2>
                </div>
                <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory">
                  {loadingNearby ? (
                    [...Array(4)].map((_, i) => (
                      <div key={i} className="flex-shrink-0 w-[44vw] sm:w-[220px] md:w-[240px] snap-start">
                        <ListingSkeleton />
                      </div>
                    ))
                  ) : sortedNearbyPlaces.slice(0, 8).map((item, index) => {
                    const a = item as any;
                    const dist = a.latitude && a.longitude && position ? calculateDistance(position.latitude, position.longitude, a.latitude, a.longitude) : undefined;
                    const rd = ratings.get(item.id);
                    return (
                      <div key={item.id} className="flex-shrink-0 w-[44vw] sm:w-[220px] md:w-[240px] snap-start">
                        <ListingCard
                          id={item.id} type={a.type || 'ADVENTURE PLACE'}
                          name={item.name} imageUrl={a.image_url} location={a.location} country={a.country}
                          price={a.entry_fee || 0} date=""
                          isSaved={savedItems.has(item.id)} onSave={handleSave} hideSave={false} hidePrice={true} showBadge={true}
                          priority={index === 0} activities={a.activities} distance={dist}
                          avgRating={rd?.avgRating} reviewCount={rd?.reviewCount} place={a.place}
                          description={a.description}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Quick Navigation Cards */}
            <section className="mb-4 md:mb-8">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">
                Quick Access
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {QUICK_NAV.map((nav) => (
                  <button
                    key={nav.title}
                    onClick={() => navigate(nav.path)}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl bg-card border border-border hover:shadow-md transition-all active:scale-95"
                  >
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${nav.color}15` }}
                    >
                      <nav.icon className="h-4.5 w-4.5" style={{ color: nav.color, width: 18, height: 18 }} />
                    </div>
                    <span className="text-[10px] font-bold text-foreground leading-tight text-center">{nav.title}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Become a Host CTA */}
            <section className="mb-4 md:mb-8">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-6 md:p-8">
                <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/10 pointer-events-none" />
                <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 text-yellow-300 fill-yellow-300" />
                      <span className="text-primary-foreground/80 text-xs font-semibold uppercase tracking-widest">
                        Partner with us
                      </span>
                    </div>
                    <h3 className="text-primary-foreground text-xl md:text-2xl font-extrabold leading-tight mb-1">
                      Become a Host
                    </h3>
                    <p className="text-primary-foreground/75 text-sm md:text-base leading-relaxed max-w-md">
                      List your adventure spot or tour and reach thousands of travellers. It's free to get started.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <button
                      onClick={() => navigate('/become-host')}
                      className="px-6 py-3 rounded-xl bg-white text-primary font-bold text-sm shadow-lg hover:bg-white/90 active:scale-95 transition-all whitespace-nowrap"
                    >
                      Get Started →
                    </button>
                    <button
                      onClick={() => navigate('/become-host#learn-more')}
                      className="px-6 py-3 rounded-xl bg-white/15 text-primary-foreground font-semibold text-sm border border-white/25 hover:bg-white/25 active:scale-95 transition-all whitespace-nowrap"
                    >
                      Learn More
                    </button>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>

        {/* Location Permission Dialog */}
        <AlertDialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Navigation className="h-8 w-8 text-primary" />
                </div>
              </div>
              <AlertDialogTitle className="text-center">{t('location.turnOn')}</AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                {t('location.description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <AlertDialogAction onClick={() => { setShowLocationDialog(false); forceRequestLocation(); }} className="w-full bg-primary hover:bg-primary/90">
                {t('location.tryAgain')}
              </AlertDialogAction>
              <AlertDialogAction onClick={() => { setShowLocationDialog(false); setListingViewMode('top_destinations'); }} className="w-full bg-muted text-muted-foreground hover:bg-muted/80">
                {t('location.continueWithout')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default Index;