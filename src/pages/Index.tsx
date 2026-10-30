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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tent, Map as MapIcon, BedDouble,
  Navigation, Heart, Ticket, Star, Search as SearchIcon,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useRatings, sortByRating } from "@/hooks/useRatings";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { useResponsiveLimit } from "@/hooks/useResponsiveLimit";

const REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const DEFAULT_COUNTRY_ISO = "KE";

interface CountryLite {
  id: string;
  name: string;
  iso_code: string | null;
  image_url: string | null;
}
interface DivisionLite {
  id: string;
  name: string;
  image_url: string | null;
}
interface ExploreTile {
  id: string;
  name: string;
  image_url: string | null;
  path: string;
}

const COUNTRY_COLS = "id, name, iso_code, image_url";
const norm = (s: any) => (typeof s === "string" ? s.trim().toLowerCase() : "");

const INITIAL_VISIBLE_COUNT = 10;
const LOAD_MORE_COUNT = 10;

// Desktop grid: 4 columns x 3 rows (12 cards), then a "View All" button.
const DESKTOP_BREAKPOINT = 1024; // matches Tailwind's `lg`
const DESKTOP_COLUMNS = 4;
const DESKTOP_ROWS = 3;
const DESKTOP_VISIBLE_COUNT = DESKTOP_COLUMNS * DESKTOP_ROWS;

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= DESKTOP_BREAKPOINT
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
};

// Skeleton that mirrors ListingCard: image on top (2:1), details below.
const ListingCardSkeleton = () => (
  <div
    className="flex flex-col overflow-hidden bg-white rounded-2xl shadow-sm w-full h-full"
    style={{ border: "1px solid #DCE3DC" }}
  >
    {/* Image — same ratio as ListingCard */}
    <Skeleton className="w-full aspect-[2/1] rounded-none shrink-0" />

    {/* Details — same padding/gap as ListingCard */}
    <div className="flex flex-col gap-1.5 p-3 min-w-0 flex-1">
      {/* Title */}
      <Skeleton className="h-[18px] w-3/4 rounded-md" />
      {/* Location */}
      <div className="flex items-center gap-1">
        <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
      </div>
      {/* Rating row */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-3 w-20 rounded-md" />
        <Skeleton className="h-3 w-10 rounded-md" />
      </div>
      {/* Description line */}
      <Skeleton className="h-3 w-full rounded-md" />
      {/* Hours / chip */}
      <Skeleton className="h-3 w-28 rounded-md" />

      {/* Footer: price + "View details" */}
      <div
        className="mt-auto pt-2.5 flex items-center justify-between gap-2"
        style={{ borderTop: "1px solid #DCE3DC" }}
      >
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-3.5 w-20 rounded-md" />
      </div>
    </div>
  </div>
);

interface GridSectionProps {
  title: string;
  viewAllPath: string;
  accentColor: string;
  items: React.ReactNode[];
  loading: boolean;
}

const GridSection = memo(({ title, viewAllPath, accentColor, items, loading }: GridSectionProps) => {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setVisibleCount(prev => Math.min(prev, Math.max(items.length, INITIAL_VISIBLE_COUNT)));
  }, [items.length]);

  // Card width in the mobile / tablet horizontal row
  const cardWidthClasses = "w-[80vw] sm:w-[300px] shrink-0";

  const Skeletons = ({ count }: { count: number }) => (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className={`${cardWidthClasses} snap-start`}>
          <ListingCardSkeleton />
        </div>
      ))}
    </>
  );

  const header = (
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
  );

  // Nothing to show and nothing loading -> hide the whole row
  if (items.length === 0 && !loading) return null;

  // ── Loading state: skeletons that match the real cards ──
  if (items.length === 0) {
    return (
      <section className="mb-6 md:mb-10">
        {header}
        {isDesktop ? (
          <div className="grid grid-cols-4 gap-4 items-stretch">
            {[...Array(DESKTOP_COLUMNS)].map((_, i) => (
              <div key={i} className="h-full">
                <ListingCardSkeleton />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-stretch gap-2.5 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory -mx-4 px-4">
            <Skeletons count={3} />
          </div>
        )}
      </section>
    );
  }

  // ── Desktop: 4 per row, fixed grid, then "View All" ──────
  if (isDesktop) {
    const visibleItems = items.slice(0, DESKTOP_VISIBLE_COUNT);
    const hasMore = items.length > DESKTOP_VISIBLE_COUNT;
    return (
      <section className="mb-10">
        {header}
        <div className="grid grid-cols-4 gap-4 items-stretch">
          {visibleItems.map((item, i) => (
            <div key={i} className="h-full">{item}</div>
          ))}
        </div>
        {hasMore && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => navigate(viewAllPath)}
              className="px-6 py-2 rounded-full text-xs font-bold border border-border bg-card text-foreground shadow-sm hover:opacity-80 active:scale-95 transition-all"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              View All
            </button>
          </div>
        )}
      </section>
    );
  }

  // ── Mobile / tablet: one horizontal row per category, incremental "See More" ─────
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

  return (
    <section className="mb-6">
      {header}
      <div className="flex items-stretch gap-2.5 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory -mx-4 px-4">
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
    </section>
  );
});
GridSection.displayName = "GridSection";

const CATEGORIES = [
  { icon: Tent,      title: "Outdoor & Campsites",  path: "/category/campsite", bgImage: "/images/category-campsite.jpg" },
  { icon: MapIcon,   title: "Experiences & Tours",  path: "/category/guided",   bgImage: "/images/category-trips.jpg" },
  { icon: BedDouble, title: "Hotels & Stays",       path: "/category/hotel",    bgImage: "/images/category-hotels.jpg" },
];

const CAMPSITE_COLOR = "hsl(278, 90%, 50%)";
const TRIPS_COLOR    = "hsl(235, 90%, 50%)";
const HOTEL_COLOR    = "hsl(160, 70%, 40%)";

const QUICK_NAV = [
  { icon: Tent,      title: "Outdoors & Campsites", path: "/category/campsite", color: CAMPSITE_COLOR },
  { icon: MapIcon,   title: "Experiences & Tours",  path: "/category/guided",   color: TRIPS_COLOR },
  { icon: BedDouble, title: "Hotels",               path: "/category/hotel",    color: HOTEL_COLOR },
  { icon: Ticket,    title: "Bookings",             path: "/bookings",          color: "hsl(200, 70%, 45%)" },
  { icon: Heart,     title: "Saved",                path: "/saved",             color: "hsl(350, 80%, 55%)" },
];

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
  const searchRef    = useRef<HTMLDivElement>(null);
  const divisionsRef = useRef<HTMLDivElement>(null);

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
    campsites: any[]; hotels: any[]; guidedTrips: any[]; fixedTrips: any[];
  }>({ campsites: [], hotels: [], guidedTrips: [], fixedTrips: [] });

  const [nearbyPlaces, setNearbyPlaces]             = useState<any[]>([]);
  const [loadingScrollable, setLoadingScrollable]   = useState(true);
  const [loadingNearby, setLoadingNearby]           = useState(false);
  const [isSearchFocused, setIsSearchFocusedLocal]  = useState(false);
  const { setSearchFocused } = useSearchFocus();

  const setIsSearchFocused = useCallback((v: boolean) => {
    setIsSearchFocusedLocal(v);
    setSearchFocused(v);
  }, [setSearchFocused]);

  // "Explore" section state: divisions of a country (only those with listings),
  // or — if no division has listings — countries that have listings.
  const [activeCountry, setActiveCountry]       = useState<CountryLite | null>(null);
  const [exploreTiles, setExploreTiles]         = useState<ExploreTile[]>([]);
  const [exploreMode, setExploreMode]           = useState<"divisions" | "countries">("divisions");
  const [loadingDivisions, setLoadingDivisions] = useState(true);

  const resolveCountryIso = useCallback(async (): Promise<string> => {
    if (!position) return DEFAULT_COUNTRY_ISO;
    try {
      const res = await fetch(
        `${REVERSE_GEOCODE_URL}?latitude=${position.latitude}&longitude=${position.longitude}&localityLanguage=en`
      );
      const data = await res.json();
      return data?.countryCode || DEFAULT_COUNTRY_ISO;
    } catch (err) {
      console.error("Reverse geocode failed, defaulting country:", err);
      return DEFAULT_COUNTRY_ISO;
    }
  }, [position]);

  // All listings we have loaded (used to know which countries/divisions have listings)
  const allListings = useMemo(() => [
    ...scrollableRows.campsites,
    ...scrollableRows.hotels,
    ...scrollableRows.guidedTrips,
    ...scrollableRows.fixedTrips,
  ], [scrollableRows]);

  // Countries that have listings, most listed first
  const listedCountryNames = useMemo(() => {
    const tally = new Map<string, number>();
    allListings.forEach((item: any) => {
      const raw = (item.country || "").trim();
      if (!raw) return;
      tally.set(raw, (tally.get(raw) || 0) + 1);
    });
    return Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [allListings]);

  useEffect(() => {
    let cancelled = false;

    const loadExplore = async () => {
      // Wait until listings are loaded so we can tell what has listings
      if (loadingScrollable) return;
      if (exploreTiles.length === 0) setLoadingDivisions(true);

      // A division "has listings" when a listing in that country mentions it
      // in its place/location. (Swap for a division_id match if you have one.)
      const divisionHasListing = (div: DivisionLite, country: CountryLite) => {
        const dn = norm(div.name);
        if (!dn) return false;
        const cn = norm(country.name);
        return allListings.some((l: any) => {
          if (norm(l.country) !== cn) return false;
          return norm(l.place).includes(dn) || norm(l.location).includes(dn);
        });
      };

      // ---- Build ordered list of candidate countries ----
      const candidates: CountryLite[] = [];
      const pushCandidate = (c: CountryLite | null | undefined) => {
        if (c && !candidates.some(x => x.id === c.id)) candidates.push(c);
      };

      if (userId) {
        const { data: profile } = await supabase
          .from("profiles").select("country_id").eq("id", userId).maybeSingle();
        if (profile?.country_id) {
          const { data: pc } = await supabase
            .from("countries").select(COUNTRY_COLS).eq("id", profile.country_id).maybeSingle();
          pushCandidate(pc as CountryLite | null);
        }
      }

      if (position) {
        const iso = await resolveCountryIso();
        const { data: matched } = await supabase
          .from("countries").select(COUNTRY_COLS).eq("iso_code", iso).maybeSingle();
        pushCandidate(matched as CountryLite | null);
      }

      // Every country that has listings (most listed first)
      const { data: allCountries } = await supabase
        .from("countries").select(COUNTRY_COLS).limit(300);
      const countryList = (allCountries || []) as CountryLite[];
      const listedCountries = listedCountryNames
        .map(n => countryList.find(c => norm(c.name) === norm(n)))
        .filter(Boolean) as CountryLite[];

      listedCountries.forEach(pushCandidate);
      pushCandidate(countryList.find(c => c.iso_code === DEFAULT_COUNTRY_ISO));

      // ---- Pick the first country that has divisions WITH listings ----
      let chosenCountry: CountryLite | null = null;
      let chosenDivisions: DivisionLite[] = [];

      for (const candidate of candidates) {
        const { data: divs } = await supabase
          .from("country_divisions")
          .select("id, name, image_url")
          .eq("country_id", candidate.id)
          .order("name", { ascending: true });
        const withListings = ((divs || []) as DivisionLite[])
          .filter(d => divisionHasListing(d, candidate));
        if (withListings.length > 0) {
          chosenCountry = candidate;
          chosenDivisions = withListings.slice(0, 16);
          break;
        }
        if (cancelled) return;
      }

      if (cancelled) return;

      if (chosenCountry) {
        setActiveCountry(chosenCountry);
        setExploreMode("divisions");
        setExploreTiles(chosenDivisions.map(d => ({
          id: d.id,
          name: d.name,
          image_url: d.image_url,
          path: `/explore?division=${d.id}`,
        })));
      } else {
        // No country has divisions with listings -> show countries that have listings
        setActiveCountry(null);
        setExploreMode("countries");
        setExploreTiles(listedCountries.slice(0, 16).map(c => ({
          id: c.id,
          name: c.name,
          image_url: c.image_url,
          path: `/explore?country=${c.id}`,
        })));
      }
      setLoadingDivisions(false);
    };

    loadExplore();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveCountryIso, userId, position, loadingScrollable, allListings, listedCountryNames]);

  const allItemIds = useMemo(() => {
    const ids = new Set<string>();
    nearbyPlaces.forEach(i => ids.add(i.id));
    scrollableRows.campsites.forEach(i => ids.add(i.id));
    scrollableRows.hotels.forEach(i => ids.add(i.id));
    scrollableRows.guidedTrips.forEach(i => ids.add(i.id));
    scrollableRows.fixedTrips.forEach(i => ids.add(i.id));
    return Array.from(ids);
  }, [nearbyPlaces, scrollableRows]);

  const tripEventIds = useMemo(() => {
    const ids = [
      ...scrollableRows.guidedTrips,
      ...scrollableRows.fixedTrips,
    ].map(i => i.id);
    return [...new Set(ids)];
  }, [scrollableRows.guidedTrips, scrollableRows.fixedTrips]);

  const { bookingStats } = useRealtimeBookings(tripEventIds);
  const { ratings }      = useRatings(allItemIds);

  const ratingScore = useCallback((id: string) => {
    const r = ratings.get(id);
    return r ? r.avgRating * Math.log1p(r.reviewCount) : 0;
  }, [ratings]);

  const sortedNearbyPlaces = useMemo(() => {
    const places = sortByRating(nearbyPlaces, ratings, position, calculateDistance)
      .map((item: any) => ({ ...item, __cardType: "ADVENTURE PLACE" as const }));

    const seen = new Set(places.map((p: any) => p.id));
    const others = [
      ...scrollableRows.guidedTrips.map(item => ({ ...item, __cardType: "TRIP" as const })),
      ...scrollableRows.fixedTrips.map(item => ({ ...item, __cardType: "TRIP" as const })),
    ]
      .filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => ratingScore(b.id) - ratingScore(a.id));

    return [...places, ...others];
  }, [nearbyPlaces, ratings, position, scrollableRows.guidedTrips, scrollableRows.fixedTrips, ratingScore]);

  // One list per category (each gets its own row on every screen size)
  const campsiteItems = useMemo(() =>
    [...scrollableRows.campsites]
      .sort((a, b) => ratingScore(b.id) - ratingScore(a.id))
      .map(item => ({ ...item, __cardType: "ADVENTURE PLACE" as const })),
    [scrollableRows.campsites, ratingScore]);

  const hotelItems = useMemo(() =>
    [...scrollableRows.hotels]
      .sort((a, b) => ratingScore(b.id) - ratingScore(a.id))
      .map(item => ({ ...item, __cardType: "ADVENTURE PLACE" as const })),
    [scrollableRows.hotels, ratingScore]);

  const tripItems = useMemo(() => {
    const seen = new Set<string>();
    return [...scrollableRows.guidedTrips, ...scrollableRows.fixedTrips]
      .filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => ratingScore(b.id) - ratingScore(a.id))
      .map(item => ({ ...item, __cardType: "TRIP" as const }));
  }, [scrollableRows.guidedTrips, scrollableRows.fixedTrips, ratingScore]);

  const fetchScrollableRows = useCallback(async (limit: number, opts: { background?: boolean } = {}) => {
    if (!opts.background) setLoadingScrollable(true);
    const fetchLimit = Math.max(limit * 3, 60);
    const placeCols = "id,name,location,place,country,image_url,gallery_images,images,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours,category,days_opened";
    const tripCols  = "id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours";

    try {
      const [
        campsitesData,
        hotelsData,
        guidedData,
        fixedTripsData,
      ] = await Promise.all([
        supabase
          .from("adventure_places")
          .select(placeCols)
          .eq("approval_status", "approved").eq("is_hidden", false)
          .eq("category", "campsite")
          .limit(fetchLimit),

        supabase
          .from("adventure_places")
          .select(placeCols)
          .eq("approval_status", "approved").eq("is_hidden", false)
          .eq("category", "hotel")
          .limit(fetchLimit),

        supabase
          .from("trips")
          .select(tripCols)
          .eq("approval_status", "approved").eq("is_hidden", false)
          .eq("type", "trip").or("is_flexible_date.eq.true,is_custom_date.eq.true")
          .order("created_at", { ascending: false }).limit(fetchLimit),

        supabase
          .from("trips")
          .select(tripCols)
          .eq("approval_status", "approved").eq("is_hidden", false)
          .eq("type", "trip").eq("is_flexible_date", false).eq("is_custom_date", false)
          .order("date", { ascending: true }).limit(fetchLimit),
      ]);

      setScrollableRows({
        campsites:   campsitesData.data || [],
        hotels:      hotelsData.data || [],
        guidedTrips: guidedData.data || [],
        fixedTrips:  fixedTripsData.data || [],
      });
    } catch (err) {
      console.error("Error fetching rows:", err);
    } finally {
      if (!opts.background) setLoadingScrollable(false);
    }
  }, []);

  const fetchNearbyPlaces = useCallback(async (opts: { background?: boolean } = {}) => {
    if (!position) return;
    if (!opts.background) setLoadingNearby(true);
    try {
      const { data } = await supabase
        .from("adventure_places")
        .select("id,name,location,place,country,image_url,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours,category,days_opened")
        .eq("approval_status", "approved").eq("is_hidden", false)
        .in("category", ["campsite", "hotel"])
        .limit(80);
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
      setNearbyPlaces(withDist);
    } catch (err) {
      console.error("Error fetching nearby places:", err);
    } finally {
      if (!opts.background) setLoadingNearby(false);
    }
  }, [position]);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  useEffect(() => {
    fetchScrollableRows(cardLimit);
    getUserId().then(setUserId);
  }, [cardLimit, fetchScrollableRows]);

  useEffect(() => {
    if (position) fetchNearbyPlaces();
  }, [position, fetchNearbyPlaces]);

  const BACKGROUND_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchScrollableRows(cardLimit, { background: true });
      if (position) fetchNearbyPlaces({ background: true });
    }, BACKGROUND_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [cardLimit, fetchScrollableRows, position, fetchNearbyPlaces]);

  useEffect(() => {
    const ctrl = () => setShowSearchIcon(window.scrollY > 0);
    window.addEventListener("scroll", ctrl, { passive: true });
    return () => window.removeEventListener("scroll", ctrl);
  }, []);

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
        // Index page: hide the category badge at the top-left of the card
        showBadge={false}
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

  const campsiteNodes = useMemo(() =>
    campsiteItems.map((item: any, i) =>
      renderCard(item, "ADVENTURE PLACE", i, { hidePrice: true, categoryColor: CAMPSITE_COLOR })),
    [campsiteItems, renderCard]);

  const hotelNodes = useMemo(() =>
    hotelItems.map((item: any, i) =>
      renderCard(item, "ADVENTURE PLACE", i, { hidePrice: true, categoryColor: HOTEL_COLOR })),
    [hotelItems, renderCard]);

  const tripNodes = useMemo(() =>
    tripItems.map((item: any, i) =>
      renderCard(item, "TRIP", i, { isTrip: true, categoryColor: TRIPS_COLOR })),
    [tripItems, renderCard]);

  const nearbyNodes = useMemo(() =>
    sortedNearbyPlaces.map((item: any, i) => {
      const isTrip = item.__cardType === "TRIP";
      return renderCard(item, item.__cardType || "ADVENTURE PLACE", i, {
        hidePrice: !isTrip,
        isTrip,
      });
    }),
    [sortedNearbyPlaces, renderCard],
  );

  const exploreTitle =
    exploreMode === "divisions" && activeCountry
      ? `Explore ${activeCountry.name}`
      : "Explore destinations";

  const showExploreSection = loadingDivisions || exploreTiles.length > 0;

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
                <div
                  onClick={() => navigate("/explore", { state: { openSearch: true } })}
                  className="cursor-pointer w-full"
                >
                  <SearchBarWithSuggestions
                    value=""
                    onChange={() => {}}
                    onSubmit={() => navigate("/explore", { state: { openSearch: true } })}
                    onSuggestionSearch={() => navigate("/explore", { state: { openSearch: true } })}
                    onFocus={() => navigate("/explore", { state: { openSearch: true } })}
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
          <div className="container mx-auto px-4 md:px-6 py-3 md:py-5 space-y-2 md:space-y-6">

            {/* Category cards */}
            <section className="mb-4 md:mb-8">
              <div className="-mx-4 px-4 md:mx-0 md:px-0">
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                  {CATEGORIES.map(cat => (
                    <Link
                      key={cat.title}
                      to={cat.path}
                      className="relative flex flex-col items-center justify-center gap-2 rounded-xl overflow-hidden cursor-pointer aspect-[4/3] sm:aspect-[8/3] lg:aspect-auto lg:h-28 xl:h-32"
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
                      <cat.icon className="relative z-10 h-5 w-5 md:h-7 md:w-7 text-white shrink-0 drop-shadow" />
                      <span className="relative z-10 text-white text-xs md:text-base font-extrabold leading-tight text-center drop-shadow px-1">
                        {cat.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            {/* Explore: divisions with listings, or countries with listings */}
            {showExploreSection && (
              <section className="mb-4 md:mb-6">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                    {exploreTitle}
                  </h2>
                </div>
                <div
                  ref={divisionsRef}
                  className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
                >
                  {exploreTiles.length === 0
                    ? [...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="flex-shrink-0 w-[32vw] sm:w-[140px] md:w-[160px] aspect-square rounded-none bg-muted animate-pulse"
                        />
                      ))
                    : exploreTiles.map((tile, idx) => (
                        <div
                          key={tile.id}
                          onClick={() => navigate(tile.path)}
                          className="flex-shrink-0 w-[32vw] sm:w-[140px] md:w-[160px] snap-start cursor-pointer group"
                        >
                          <div className="relative overflow-hidden aspect-square bg-muted rounded-none">
                            {tile.image_url ? (
                              <img
                                src={tile.image_url}
                                alt={tile.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                loading={idx < 4 ? "eager" : "lazy"}
                                decoding="async"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted-foreground/10">
                                <MapIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-2.5">
                              <h3 className="text-white font-extrabold text-sm sm:text-base leading-tight">{tile.name}</h3>
                            </div>
                          </div>
                        </div>
                      ))}
                </div>
              </section>
            )}

            {/* One row per category — same on small and big screens */}
            <GridSection
              title="Outdoor & Campsites"
              viewAllPath="/category/campsite"
              accentColor={CAMPSITE_COLOR}
              items={campsiteNodes}
              loading={loadingScrollable}
            />

            <GridSection
              title="Hotels & Stays"
              viewAllPath="/category/hotel"
              accentColor={HOTEL_COLOR}
              items={hotelNodes}
              loading={loadingScrollable}
            />

            <GridSection
              title="Experiences & Tours"
              viewAllPath="/category/guided"
              accentColor={TRIPS_COLOR}
              items={tripNodes}
              loading={loadingScrollable}
            />

            {(position || nearbyPlaces.length > 0) && (
              <GridSection
                title={t("sections.nearestToYou")}
                viewAllPath="/explore"
                accentColor="hsl(200, 70%, 45%)"
                items={nearbyNodes}
                loading={loadingNearby}
              />
            )}

            <section className="mb-4 md:mb-8">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Quick Access</h2>
              <div className="grid grid-cols-5 gap-1.5">
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