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

// How many cards to show initially, and how many more to reveal per "See All" tap
const INITIAL_VISIBLE_COUNT = 10;
const LOAD_MORE_COUNT = 10;

const Explore = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  // Replaces the old 4-item FILTER_TABS ("All" / "Adventures" / "Trips" /
  // "Guided Tours") with the full category set shared across the app
  // (Hotels, Accommodations, Parks, Campsites, Attraction, Tours, Trips).
  const [activeFilter, setActiveFilter] = useState("all");

  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Replaces old page-based pagination: tracks how many items are
  // currently revealed, growing by LOAD_MORE_COUNT each "See All" tap.
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [loadingMore, setLoadingMore] = useState(false);

  const { savedItems, handleSave } = useSavedItems();
  const { position } = useGeolocation();

  const allItemIds = useMemo(() => listings.map(l => l.id), [listings]);
  const tripEventIds = useMemo(() => listings.filter(l => l.type === "TRIP" || l.type === "EVENT").map(l => l.id), [listings]);
  const { bookingStats } = useRealtimeBookings(tripEventIds);
  const { ratings } = useRatings(allItemIds);
  const sortedListings = useMemo(() => sortByRating(listings, ratings, position, calculateDistance), [listings, ratings, position]);

  const filteredListings = useMemo(() => {
    const isGuidedTrip = (listing: any) => listing.type === "TRIP" && (listing.is_flexible_date || listing.is_custom_date);

    if (activeFilter === "all") return sortedListings;

    if (activeFilter === "trips") {
      return sortedListings.filter(l => l.type === "TRIP" && !isGuidedTrip(l));
    }
    if (activeFilter === "guided") {
      return sortedListings.filter(l => isGuidedTrip(l));
    }
    // hotels / accommodations / parks / campsite / attraction — filter
    // adventure_places by the host-selected `category` column.
    return sortedListings.filter(l => l.type === "ADVENTURE PLACE" && l.category === activeFilter);
  }, [sortedListings, activeFilter]);

  // Whenever the active filter or search query changes, reset back to
  // showing just the first batch (mirrors the old "reset to page 1" effect).
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    setLoadingMore(false);
  }, [activeFilter, searchQuery]);

  // If the underlying filtered list ever shrinks below what's currently
  // "visible" (e.g. a fresh search), clamp visibleCount accordingly.
  useEffect(() => {
    setVisibleCount(prev => Math.min(prev, Math.max(filteredListings.length, INITIAL_VISIBLE_COUNT)));
  }, [filteredListings.length]);

  const visibleListings = useMemo(() => filteredListings.slice(0, visibleCount), [filteredListings, visibleCount]);
  const hasMore = visibleCount < filteredListings.length;
  const nextBatchSize = Math.min(LOAD_MORE_COUNT, Math.max(filteredListings.length - visibleCount, 0));

  const handleSeeAll = useCallback(() => {
    if (loadingMore) return;
    setLoadingMore(true);
    // Simulates the next batch "loading" so the skeleton row is visible
    // briefly before the additional cards are revealed. If this list is
    // ever backed by real paginated fetches (e.g. supabase .range()) instead
    // of the single upfront fetch below, swap this timeout for that fetch.
    window.setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, filteredListings.length));
      setLoadingMore(false);
    }, 500);
  }, [loadingMore, filteredListings.length]);

  const fetchAllData = useCallback(async (query?: string) => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const qFilter = query ? `%${query}%` : null;

    const [events, trips, adventures] = await Promise.all([
      supabase.from("trips")
        .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,event_category,opening_hours,closing_hours")
        .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "event")
        .or(`date.gte.${today},is_flexible_date.eq.true`)
        .order('date', { ascending: true }).limit(50)
        .then(r => {
          let data = r.data || [];
          if (qFilter && query) {
            const q = query.toLowerCase();
            data = data.filter((i: any) => i.name?.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q) || i.country?.toLowerCase().includes(q) || i.place?.toLowerCase().includes(q) || i.event_category?.toLowerCase().includes(q));
          }
          return data.map((i: any) => ({ ...i, type: "EVENT" }));
        }),
      supabase.from("trips")
        .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
        .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip")
        .order('date', { ascending: true }).limit(50)
        .then(r => {
          let data = r.data || [];
          if (qFilter && query) {
            const q = query.toLowerCase();
            data = data.filter((i: any) => i.name?.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q) || i.country?.toLowerCase().includes(q) || i.place?.toLowerCase().includes(q));
          }
          return data.map((i: any) => ({ ...i, type: "TRIP" }));
        }),
      supabase.from("adventure_places")
        // `category` (hotel/park/campsite/attraction/accommodation) pulled
        // so the category tabs above can filter results client-side.
        .select("id,name,location,place,country,image_url,gallery_images,images,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours,category")
        .eq("approval_status", "approved").eq("is_hidden", false)
        .order('created_at', { ascending: false }).limit(50)
        .then(r => {
          let data = r.data || [];
          if (qFilter && query) {
            const q = query.toLowerCase();
            data = data.filter((i: any) => i.name?.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q) || i.country?.toLowerCase().includes(q) || i.place?.toLowerCase().includes(q));
          }
          return data.map((i: any) => ({ ...i, type: "ADVENTURE PLACE" }));
        }),
    ]);

    const combined = [...adventures, ...trips, ...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
      {[...Array(count)].map((_, i) => (
        <ListingSkeleton key={`more-skel-${i}`} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead title="Explore - RealTravo" description="Search and discover trips, adventures and events" />

      {/* 
        Sticky header — bg-primary is teal (hsl 180 100% 25% = #008080).
        pt-[env(safe-area-inset-top,0px)] extends the teal header colour
        into the status-bar safe zone on Capacitor iOS/Android so the
        status bar and header appear as one seamless teal block.

        The category tabs bar lives in this same `sticky top-0` wrapper,
        in its own bar directly below (visually outside) the teal header,
        so both stay fixed together as the page scrolls.
      */}
      <div
        className="sticky top-0 z-50 shadow-md"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
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

        {/* Category tabs — sideways scroll, filters in-place */}
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
                const ratingData = ratings.get(listing.id);
                const isTripsOrEvents = listing.type === "TRIP" || listing.type === "EVENT";
                const today = new Date().toISOString().split('T')[0];
                const isOutdated = listing.date && !listing.is_flexible_date && listing.date < today;
                return (
                  <ListingCard
                    key={listing.id} id={listing.id} type={listing.type}
                    category={listing.category}
                    name={listing.name} location={listing.location} country={listing.country}
                    imageUrl={listing.image_url} price={listing.price || listing.entry_fee || 0}
                    date={listing.date} isCustomDate={listing.is_custom_date}
                    isFlexibleDate={Boolean(listing.is_flexible_date || listing.is_custom_date)} isOutdated={isOutdated}
                    isSaved={savedItems.has(listing.id)}
                    onSave={handleSave}
                    availableTickets={isTripsOrEvents ? listing.available_tickets : undefined}
                    bookedTickets={isTripsOrEvents ? bookingStats[listing.id] || 0 : undefined}
                    showBadge={true} priority={index < 4}
                    hidePrice={listing.type === "ADVENTURE PLACE"}
                    activities={listing.activities}
                    avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount}
                    description={listing.description}
                    galleryImages={listing.gallery_images}
                    images={listing.images}
                    openingHours={listing.opening_hours}
                    closingHours={listing.closing_hours}
                  />
                );
              })}
            </div>

            {/* Skeleton row for the next batch while "See All" is loading */}
            {loadingMore && renderLoadMoreSkeletons(nextBatchSize || LOAD_MORE_COUNT)}

            {/* See All button — only shown while there's more to reveal */}
            {hasMore && !loadingMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={handleSeeAll}
                  className="rounded-full px-6 font-bold text-sm"
                >
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