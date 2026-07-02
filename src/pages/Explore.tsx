import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useSavedItems } from "@/hooks/useSavedItems";
import { cn } from "@/lib/utils";
import { useRatings, sortByRating } from "@/hooks/useRatings";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { CategoryTabsBar, CATEGORY_TABS } from "@/components/CategoryTabsBar";

const INITIAL_VISIBLE_COUNT = 10;
const LOAD_MORE_COUNT = 10;

const Explore = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery]   = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [listings, setListings]         = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [loadingMore, setLoadingMore]   = useState(false);

  const { savedItems, handleSave } = useSavedItems();
  const { position }               = useGeolocation();

  const allItemIds    = useMemo(() => listings.map(l => l.id), [listings]);
  // Guided tours track bookings; fixed trips and events are disabled so we
  // only gather booking stats for guided (flexible/custom-date) trips.
  const guidedTripIds = useMemo(
    () => listings.filter(l => l.type === "TRIP" && (l.is_flexible_date || l.is_custom_date)).map(l => l.id),
    [listings],
  );
  const { bookingStats } = useRealtimeBookings(guidedTripIds);
  const { ratings }      = useRatings(allItemIds);

  const sortedListings = useMemo(
    () => sortByRating(listings, ratings, position, calculateDistance),
    [listings, ratings, position],
  );

  // ── Client-side filter ──────────────────────────────────────────────────
  const filteredListings = useMemo(() => {
    let result = sortedListings;

    if (activeFilter !== "all") {
      if (activeFilter === "guided") {
        // Tours & Trips tab → guided / flexible-date trips only
        result = result.filter(l => l.type === "TRIP" && (l.is_flexible_date || l.is_custom_date));
      }
      // Fixed trips tab disabled — uncomment if re-enabling the fetch below
      // else if (activeFilter === "trips") {
      //   result = result.filter(l => l.type === "TRIP" && !l.is_flexible_date && !l.is_custom_date);
      // }
      else {
        // hotels / accommodations / campsite — filter adventure_places by category
        // Parks and Attraction keys are commented out in CategoryTabsBar but
        // this filter still handles them correctly if they're re-added.
        result = result.filter(l => l.type === "ADVENTURE PLACE" && l.category === activeFilter);
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        l => l.name?.toLowerCase().includes(q) ||
             l.location?.toLowerCase().includes(q) ||
             l.country?.toLowerCase().includes(q) ||
             l.place?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [sortedListings, activeFilter, searchQuery]);

  // Reset to first page whenever the filter or search changes
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    setLoadingMore(false);
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    setVisibleCount(prev => Math.min(prev, Math.max(filteredListings.length, INITIAL_VISIBLE_COUNT)));
  }, [filteredListings.length]);

  const visibleListings = useMemo(() => filteredListings.slice(0, visibleCount), [filteredListings, visibleCount]);
  const hasMore         = visibleCount < filteredListings.length;
  const nextBatchSize   = Math.min(LOAD_MORE_COUNT, Math.max(filteredListings.length - visibleCount, 0));

  const handleSeeAll = useCallback(() => {
    if (loadingMore) return;
    setLoadingMore(true);
    window.setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, filteredListings.length));
      setLoadingMore(false);
    }, 500);
  }, [loadingMore, filteredListings.length]);

  // ── Data fetch ──────────────────────────────────────────────────────────
  const fetchAllData = useCallback(async (query?: string) => {
    setLoading(true);

    const [
      guidedTrips,
      adventures,
      // events,     // events fetch disabled — uncomment to re-enable
      // fixedTrips, // fixed trips fetch disabled — uncomment to re-enable
    ] = await Promise.all([
      // ── Guided / flexible-date tours ────────────────────────────────────
      supabase.from("trips")
        .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
        .eq("approval_status", "approved").eq("is_hidden", false)
        .eq("type", "trip").or("is_flexible_date.eq.true,is_custom_date.eq.true")
        .order("created_at", { ascending: false }).limit(50)
        .then(r => {
          let data = r.data || [];
          if (query) {
            const q = query.toLowerCase();
            data = data.filter((i: any) =>
              i.name?.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q) ||
              i.country?.toLowerCase().includes(q) || i.place?.toLowerCase().includes(q),
            );
          }
          return data.map((i: any) => ({ ...i, type: "TRIP" }));
        }),

      // ── Adventure places (hotels, accommodations, campsites, etc.) ───────
      supabase.from("adventure_places")
        .select("id,name,location,place,country,image_url,gallery_images,images,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours,category")
        .eq("approval_status", "approved").eq("is_hidden", false)
        .order("created_at", { ascending: false }).limit(50)
        .then(r => {
          let data = r.data || [];
          if (query) {
            const q = query.toLowerCase();
            data = data.filter((i: any) =>
              i.name?.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q) ||
              i.country?.toLowerCase().includes(q) || i.place?.toLowerCase().includes(q),
            );
          }
          return data.map((i: any) => ({ ...i, type: "ADVENTURE PLACE" }));
        }),

      // ── Events (disabled — uncomment to re-enable) ─────────────────────
      // supabase.from("trips")
      //   .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,event_category,opening_hours,closing_hours")
      //   .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "event")
      //   .or(`date.gte.${new Date().toISOString().split('T')[0]},is_flexible_date.eq.true`)
      //   .order("date", { ascending: true }).limit(50)
      //   .then(r => (r.data || []).map((i: any) => ({ ...i, type: "EVENT" }))),

      // ── Fixed-date trips (disabled — uncomment to re-enable) ──────────
      // supabase.from("trips")
      //   .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
      //   .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip")
      //   .eq("is_flexible_date", false).eq("is_custom_date", false)
      //   .order("date", { ascending: true }).limit(50)
      //   .then(r => (r.data || []).map((i: any) => ({ ...i, type: "TRIP" }))),
    ]);

    const combined = [...adventures, ...guidedTrips]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setListings(combined);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const handleSearch = () => {
    if (searchQuery.trim()) fetchAllData(searchQuery);
    else fetchAllData();
  };

  const activeTabLabel = CATEGORY_TABS.find(t => t.key === activeFilter)?.label;

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead title="Explore - RealTravo" description="Search and discover trips, adventures and events" />

      {/* ── Sticky top: teal search header + category tabs ── */}
      <div className="sticky top-0 z-50 shadow-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="bg-primary">
          <div className="container mx-auto px-4 py-3">
            <SearchBarWithSuggestions
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={handleSearch}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onBack={() => { setIsSearchFocused(false); setSearchQuery(""); navigate(-1); }}
              showBackButton={true}
              showEventCategories={false}
            />
          </div>
        </div>

        {!isSearchFocused && (
          <CategoryTabsBar activeKey={activeFilter} onSelect={setActiveFilter} />
        )}
      </div>

      {/* Results */}
      <main className="flex-1 container mx-auto px-4 py-4 pb-24 md:pb-8">
        <p className="text-xs text-muted-foreground mb-3 font-medium">
          {searchQuery ? `Results for "${searchQuery}"` : "Discover"}
          {activeFilter !== "all" && activeTabLabel && ` in ${activeTabLabel}`}
        </p>

        {loading ? (
          skeletonGrid
        ) : visibleListings.length === 0 ? (
          skeletonGrid
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {visibleListings.map((listing, index) => {
                const ratingData  = ratings.get(listing.id);
                const isGuided    = listing.type === "TRIP" && (listing.is_flexible_date || listing.is_custom_date);
                const today       = new Date().toISOString().split("T")[0];
                const isOutdated  = listing.date && !listing.is_flexible_date && listing.date < today;
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
                    availableTickets={isGuided ? listing.available_tickets : undefined}
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
                  />
                );
              })}
            </div>

            {loadingMore && renderLoadMoreSkeletons(nextBatchSize || LOAD_MORE_COUNT)}

            {hasMore && !loadingMore && (
              <div className="flex justify-center mt-6">
                <Button variant="outline" onClick={handleSeeAll} className="rounded-full px-6 font-bold text-sm">
                  See All
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Explore;