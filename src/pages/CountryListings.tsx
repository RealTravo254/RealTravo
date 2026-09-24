// src/pages/CountryListings.tsx
//
// Shows every approved trip + adventure place located in a single country
// (matched against the free-text `country` column on trips/adventure_places),
// reached by tapping a country tile on ExploreCountries.
//
// Fetches a generous batch per table up front, then reveals it progressively
// via a "Load more" button — the same lazy-reveal pattern GridSection and
// Explore.tsx use elsewhere in the app, so listings (and their images, via
// ListingCard's own IntersectionObserver) don't all paint at once.

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Globe, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/ListingCard";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { SEOHead } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useRatings } from "@/hooks/useRatings";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";

// ── Design tokens (same field-guide system as the rest of the app) ────────
const FOREST       = "#1F4D3A";
const FOREST_DEEP  = "#123322";
const CLAY         = "#C1552F";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";
const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY    = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

const useInjectFonts = () => {
  useEffect(() => {
    const id = "adventure-detail-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
};

const FETCH_LIMIT_PER_TABLE = 100; // generous batch fetched once, per table
const INITIAL_VISIBLE_COUNT = 10;
const LOAD_MORE_COUNT = 10;

interface CountryRow { id: string; name: string; image_url: string | null }

const CountryListings = () => {
  useInjectFonts();
  const { countryId } = useParams<{ countryId: string }>();
  const navigate = useNavigate();

  const [country, setCountry]   = useState<CountryRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [loadingMore, setLoadingMore]   = useState(false);

  const { savedItems, handleSave } = useSavedItems();

  // ── Fetch the country row, then its trips + adventure places ────────────
  useEffect(() => {
    if (!countryId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setNotFound(false);

      const { data: countryRow } = await supabase
        .from("countries")
        .select("id, name, image_url")
        .eq("id", countryId)
        .maybeSingle();

      if (cancelled) return;

      if (!countryRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCountry(countryRow);

      const [tripsRes, placesRes] = await Promise.all([
        supabase
          .from("trips")
          .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
          .eq("approval_status", "approved").eq("is_hidden", false)
          .eq("type", "trip")
          .ilike("country", countryRow.name)
          .order("created_at", { ascending: false })
          .limit(FETCH_LIMIT_PER_TABLE),
        supabase
          .from("adventure_places")
          .select("id,name,location,place,country,image_url,gallery_images,images,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours,category,days_opened")
          .eq("approval_status", "approved").eq("is_hidden", false)
          .neq("category", "accommodation")
          .ilike("country", countryRow.name)
          .order("created_at", { ascending: false })
          .limit(FETCH_LIMIT_PER_TABLE),
      ]);

      if (cancelled) return;

      const combined = [
        ...(tripsRes.data || []).map((t: any) => ({ ...t, type: "TRIP" })),
        ...(placesRes.data || []).map((p: any) => ({ ...p, type: "ADVENTURE PLACE" })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setListings(combined);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [countryId]);

  // Reset the reveal window whenever we land on a different country.
  useEffect(() => { setVisibleCount(INITIAL_VISIBLE_COUNT); setLoadingMore(false); }, [countryId]);

  const allItemIds    = useMemo(() => listings.map(l => l.id), [listings]);
  const guidedTripIds = useMemo(
    () => listings.filter(l => l.type === "TRIP" && (l.is_flexible_date || l.is_custom_date)).map(l => l.id),
    [listings],
  );
  const { bookingStats } = useRealtimeBookings(guidedTripIds);
  const { ratings }      = useRatings(allItemIds);

  // Rating-weighted ordering (same scoring used for "Browsers guide" on the
  // home page), so the strongest listings surface first within the country.
  const sortedListings = useMemo(() => {
    return [...listings].sort((a, b) => {
      const ra = ratings.get(a.id);
      const rb = ratings.get(b.id);
      const sa = ra ? ra.avgRating * Math.log1p(ra.reviewCount) : 0;
      const sb = rb ? rb.avgRating * Math.log1p(rb.reviewCount) : 0;
      return sb - sa;
    });
  }, [listings, ratings]);

  const visibleListings = useMemo(() => sortedListings.slice(0, visibleCount), [sortedListings, visibleCount]);
  const hasMore         = visibleCount < sortedListings.length;
  const nextBatchSize   = Math.min(LOAD_MORE_COUNT, Math.max(sortedListings.length - visibleCount, 0));

  const handleLoadMore = useCallback(() => {
    if (loadingMore) return;
    setLoadingMore(true);
    window.setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, sortedListings.length));
      setLoadingMore(false);
    }, 400);
  }, [loadingMore, sortedListings.length]);

  const skeletonGrid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {[...Array(8)].map((_, i) => <ListingSkeleton key={i} />)}
    </div>
  );

  const renderLoadMoreSkeletons = (count: number) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-3">
      {[...Array(count)].map((_, i) => <ListingSkeleton key={`more-skel-${i}`} />)}
    </div>
  );

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-sm mb-3" style={{ color: INK_SOFT }}>We couldn't find that country.</p>
            <Button onClick={() => navigate("/explore-countries")} variant="outline" className="rounded-full">
              Back to countries
            </Button>
          </div>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <SEOHead
        title={country ? `${country.name} - RealTravo` : "Country - RealTravo"}
        description={country ? `Trips and adventure places in ${country.name}` : "Browse listings by country"}
      />
      <Header />

      {/* ── Hero ── */}
      <div className="relative w-full h-40 sm:h-56 overflow-hidden">
        {country?.image_url ? (
          <img src={country.image_url} alt={country.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: FOREST_SOFT_BG }}>
            <Globe className="h-14 w-14" style={{ color: `${FOREST}55` }} />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(14,23,18,0.75), rgba(14,23,18,0.15) 60%, transparent)" }} />
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 hover:bg-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" style={{ color: INK }} />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white" style={{ fontFamily: FONT_DISPLAY }}>
            {country?.name || "Loading…"}
          </h1>
          {!loading && (
            <p className="mt-1 text-xs sm:text-sm font-medium text-white/85">
              {sortedListings.length} listing{sortedListings.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 pb-24 md:pb-10">
        {loading ? (
          skeletonGrid
        ) : sortedListings.length === 0 ? (
          <p className="py-16 text-center text-sm" style={{ color: INK_SOFT }}>
            No approved listings in {country?.name} yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {visibleListings.map((listing, index) => {
                const ratingData = ratings.get(listing.id);
                const isGuided   = listing.type === "TRIP" && (listing.is_flexible_date || listing.is_custom_date);
                const today      = new Date().toISOString().split("T")[0];
                const isOutdated = listing.date && !listing.is_flexible_date && listing.date < today;
                return (
                  <ListingCard
                    key={listing.id}
                    id={listing.id}
                    type={listing.type}
                    category={listing.category}
                    name={listing.name}
                    location={listing.location}
                    country={listing.country}
                    imageUrl={listing.image_url}
                    price={listing.price || listing.entry_fee || 0}
                    date={listing.date}
                    isCustomDate={listing.is_custom_date}
                    isFlexibleDate={Boolean(listing.is_flexible_date || listing.is_custom_date)}
                    isOutdated={isOutdated}
                    isSaved={savedItems.has(listing.id)}
                    onSave={handleSave}
                    availableTickets={listing.type === "TRIP" ? listing.available_tickets : undefined}
                    bookedTickets={isGuided ? bookingStats[listing.id] || 0 : undefined}
                    showBadge={true}
                    priority={index < 4}
                    hidePrice={listing.type === "ADVENTURE PLACE"}
                    activities={listing.activities}
                    avgRating={ratingData?.avgRating}
                    reviewCount={ratingData?.reviewCount}
                    description={listing.description}
                    galleryImages={listing.gallery_images}
                    images={listing.images}
                    openingHours={listing.opening_hours}
                    closingHours={listing.closing_hours}
                    workingDays={listing.days_opened}
                  />
                );
              })}
            </div>

            {loadingMore && renderLoadMoreSkeletons(nextBatchSize || LOAD_MORE_COUNT)}

            {hasMore && !loadingMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  className="rounded-full px-6 font-semibold text-sm hover:bg-transparent"
                  style={{ borderColor: HAIRLINE, color: CLAY }}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      <MobileBottomBar />
    </div>
  );
};

// Fallback tint used only when a country has no image — kept as a plain
// string constant so it isn't recomputed on every render.
const FOREST_SOFT_BG = "#EAF0EA";

export default CountryListings;