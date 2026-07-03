import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { useSearchFocus } from "@/components/PageLayout";
import { ListingCard } from "@/components/ListingCard";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/sessionManager";
import { cn } from "@/lib/utils";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { useRatings, sortByRating } from "@/hooks/useRatings";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { KENYA_COUNTIES } from "@/lib/kenyaCounties"; 
import { CategoryTabsBar } from "@/components/CategoryTabsBar";

const ITEMS_PER_PAGE = 10;
const SKELETON_COUNT_MOBILE  = 8;
const SKELETON_COUNT_DESKTOP = 20;

const ADVENTURE_PLACE_FIELDS =
  "id,name,location,place,country,image_url,gallery_images,images,entry_fee,available_slots,activities,latitude,longitude,created_at,description,opening_hours,closing_hours,category";

// TRIP_FIELDS is unused while trip/guided category config is disabled below —
// kept in case it's needed again when trips are re-enabled.
const TRIP_FIELDS =
  "id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours";

const CategoryDetail = () => {
  const { category }    = useParams<{ category: string }>();
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();

  const [searchQuery, setSearchQuery]     = useState("");
  const [items, setItems]                 = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const { savedItems, handleSave }        = useSavedItems();
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [hasMore, setHasMore]             = useState(true);
  const [offset, setOffset]               = useState(0);
  const [userId, setUserId]               = useState<string | null>(null);
  const [selectedCounty, setSelectedCounty] = useState<string>(searchParams.get("county") || "All");

  // "guided" removed — county filter now only applies to campsite (trip
  // fetching is disabled, see categoryConfig below).
  const showCountyTabs = category === "campsite";

  const { position }  = useGeolocation();
  const [isSearchFocusedLocal, setIsSearchFocusedLocal] = useState(false);
  const { setSearchFocused } = useSearchFocus();
  const setIsSearchFocused = useCallback((v: boolean) => {
    setIsSearchFocusedLocal(v);
    setSearchFocused(v);
  }, [setSearchFocused]);

  // ── Category config ─────────────────────────────────────────────────────
  // Park and Attraction are commented out — uncomment when their pages are ready.
  // Guided tours and fixed trips are both commented out — trip/tour fetching
  // is disabled site-wide. With "guided" removed from this config, a request
  // to /category/guided resolves to `config === null` below, which renders
  // "Category not found" and never calls fetchData/supabase for the "trips"
  // table. Uncomment to re-enable.
  const categoryConfig: { [key: string]: any } = {
    // guided:      { title: "Guided Tours",          tables: ["trips"],            type: "TRIP",            tripType: "trip", flexibleOnly: true },

    hotels:         { title: "Hotels",                tables: ["adventure_places"], type: "ADVENTURE PLACE", placeCategory: "hotel"         },
    accommodations: { title: "Accommodations",        tables: ["adventure_places"], type: "ADVENTURE PLACE", placeCategory: "accommodation"  },
    // parks:       { title: "Parks",                 tables: ["adventure_places"], type: "ADVENTURE PLACE", placeCategory: "park"          }, // uncomment when ready
    campsite:       { title: "Campsite & Experience", tables: ["adventure_places"], type: "ADVENTURE PLACE", placeCategory: "campsite"       },
    // attraction:  { title: "Attractions",           tables: ["adventure_places"], type: "ADVENTURE PLACE", placeCategory: "attraction"    }, // uncomment when ready

    // Fixed-date trips disabled — uncomment to re-enable
    // trips:       { title: "Trips",                 tables: ["trips"],            type: "TRIP",            tripType: "trip", filterType: "trips" },

    // Legacy catch-all (backwards compat for old /category/adventure links)
    adventure:      { title: "Adventure Places",      tables: ["adventure_places"], type: "ADVENTURE PLACE" },
  };

  const config = category ? categoryConfig[category] : null;

  // Which CategoryTabsBar pill should be active for this category page
  const activeTabKey = category && categoryConfig[category] ? category : "all";

  useEffect(() => {
    const initializeData = async () => {
      const uid = await getUserId();
      setUserId(uid);
      loadInitialData();
    };
    initializeData();
  }, [category]);

  const loadInitialData = async () => {
    setLoading(true);
    setOffset(0);
    setHasMore(true);
    const data = await fetchData(0, ITEMS_PER_PAGE);
    setItems(data);
    setOffset(ITEMS_PER_PAGE);
    setHasMore(data.length >= ITEMS_PER_PAGE);
    setLoading(false);
  };

  // Loads the next batch from Supabase (server-side pagination via .range())
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const data = await fetchData(offset, ITEMS_PER_PAGE);
    if (data.length === 0) {
      setHasMore(false);
    } else {
      setItems(prev => [...prev, ...data]);
      setOffset(prev => prev + ITEMS_PER_PAGE);
      setHasMore(data.length >= ITEMS_PER_PAGE);
    }
    setLoadingMore(false);
  };

  // "guided" no longer exists in categoryConfig, so this is always [] now —
  // kept so useRealtimeBookings below still has a stable, valid argument.
  const tripIds = useMemo(() => {
    if (category !== "guided") return [];
    return items.map((item: any) => item.id);
  }, [items, category]);

  const { bookingStats } = useRealtimeBookings(tripIds);

  const fetchData = async (offset: number, limit: number) => {
    // config is null for "guided"/"trips" now (removed from categoryConfig
    // above), so this returns [] immediately for those routes — no
    // supabase.from("trips") query is ever made.
    if (!config) return [];
    const allData: any[] = [];
    const today = new Date().toISOString().split("T")[0];

    for (const table of config.tables) {
      let query = supabase
        .from(table as any)
        .select(table === "trips" ? TRIP_FIELDS : ADVENTURE_PLACE_FIELDS)
        .eq("approval_status", "approved")
        .eq("is_hidden", false);

      if (config.tripType)      query = query.eq("type", config.tripType);
      if (config.flexibleOnly)  query = query.or("is_flexible_date.eq.true,is_custom_date.eq.true");
      if (config.placeCategory) query = query.eq("category", config.placeCategory);

      const { data } = await query.range(offset, offset + limit - 1);

      if (data) {
        allData.push(...data.map((item: any) => ({
          ...item,
          table,
          itemType: table === "trips" ? "TRIP" : "ADVENTURE PLACE",
          isOutdated: table === "trips" && item.date && !item.is_custom_date && new Date(item.date) < new Date(today),
        })));
      }
    }
    return allData;
  };

  const itemIds     = useMemo(() => items.map(item => item.id), [items]);
  const { ratings } = useRatings(itemIds);

  const sortedItems = useMemo(() => {
    const sorted = sortByRating(items, ratings, position, calculateDistance);
    if (category === "guided") {
      const available:        any[] = [];
      const soldOutOrOutdated: any[] = [];
      sorted.forEach(item => {
        const isSoldOut = item.available_tickets != null && item.available_tickets <= 0;
        if (item.isOutdated || isSoldOut) soldOutOrOutdated.push(item);
        else available.push(item);
      });
      return [...available, ...soldOutOrOutdated];
    }
    return sorted;
  }, [items, position, ratings, category]);

  const applyFilters = useCallback((itemsToFilter: any[], query: string, county: string) => {
    let result = [...itemsToFilter];
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(item =>
        item.name?.toLowerCase().includes(q) ||
        item.location?.toLowerCase().includes(q) ||
        item.place?.toLowerCase().includes(q) ||
        item.country?.toLowerCase().includes(q),
      );
    }
    if (county && county !== "All") {
      result = result.filter(item => item.place === county);
    }
    return result;
  }, []);

  useEffect(() => {
    setFilteredItems(applyFilters(sortedItems, searchQuery, selectedCounty));
  }, [sortedItems, searchQuery, selectedCounty, applyFilters]);

  const isFiltering      = searchQuery.length > 0 || selectedCounty !== "All";
  const showSkeleton     = loading || (!loading && filteredItems.length === 0 && !isFiltering);
  const showSeeAllButton = !showSkeleton && hasMore && filteredItems.length > 0 && !isFiltering;

  if (!config) return <div className="p-10 text-center">Category not found</div>;

  return (
    <div className="bg-background">

      {/* ── Sticky top: teal search header + category tabs ── */}
      <div className="sticky top-0 z-50 shadow-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="bg-primary">
          <div className="container mx-auto px-4 py-3">
            <SearchBarWithSuggestions
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={() => setFilteredItems(applyFilters(sortedItems, searchQuery, selectedCounty))}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onBack={() => { setIsSearchFocused(false); setSearchQuery(""); navigate(-1); }}
              showBackButton={true}
            />
          </div>
        </div>

        {/* Category tabs — navigates to the tapped category page */}
        {!isSearchFocusedLocal && <CategoryTabsBar activeKey={activeTabKey} />}

        {/* County filter — only for campsite category pages now (guided disabled) */}
        {showCountyTabs && !isSearchFocusedLocal && (
          <div className="bg-background border-t border-border/60">
            <div className="container mx-auto px-4 py-2">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {["All", ...KENYA_COUNTIES.filter(c => items.some(item => item.place === c))].map(county => (
                  <button
                    key={county}
                    onClick={() => setSelectedCounty(county)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shrink-0 border",
                      selectedCounty === county
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card text-muted-foreground border-border hover:bg-muted",
                    )}
                  >
                    {county}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <main className={cn(
        "container px-4 py-6 transition-opacity duration-200",
        isSearchFocusedLocal && "pointer-events-none opacity-20",
      )}>
        {showSkeleton ? (
          <>
            <div className="md:hidden grid grid-cols-2 gap-2.5">
              {[...Array(SKELETON_COUNT_MOBILE)].map((_, i) => (
                <div key={i} className="w-full"><ListingSkeleton /></div>
              ))}
            </div>
            <div className="hidden md:grid grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(SKELETON_COUNT_DESKTOP)].map((_, i) => (
                <div key={i} className="w-full"><ListingSkeleton /></div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {filteredItems.map(item => {
                const ratingData  = ratings.get(item.id);
                const isGuided    = category === "guided";
                return (
                  <div key={item.id} className="w-full">
                    <ListingCard
                      id={item.id}
                      type={item.itemType || config.type}
                      category={item.category}
                      name={item.name}
                      imageUrl={item.image_url}
                      location={item.location}
                      country={item.country || ""}
                      price={item.price || item.entry_fee}
                      date={item.date}
                      isCustomDate={item.is_custom_date}
                      isFlexibleDate={Boolean(item.is_flexible_date || item.is_custom_date)}
                      isOutdated={item.isOutdated}
                      isSaved={savedItems.has(item.id)}
                      onSave={handleSave}
                      availableTickets={isGuided ? item.available_tickets : undefined}
                      bookedTickets={isGuided ? bookingStats[item.id] || 0 : undefined}
                      hidePrice={item.itemType === "ADVENTURE PLACE"}
                      activities={item.activities}
                      avgRating={ratingData?.avgRating}
                      reviewCount={ratingData?.reviewCount}
                      description={item.description}
                      galleryImages={item.gallery_images}
                      images={item.images}
                      openingHours={item.opening_hours}
                      closingHours={item.closing_hours}
                    />
                  </div>
                );
              })}
            </div>

            {/* Skeleton row while the next page loads */}
            {loadingMore && (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 mt-3 md:mt-4">
                {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
                  <div key={`more-skel-${i}`} className="w-full"><ListingSkeleton /></div>
                ))}
              </div>
            )}

            {filteredItems.length === 0 && isFiltering && (
              <div className="text-center py-20 text-muted-foreground italic">
                No items found matching your filters.
              </div>
            )}
          </>
        )}

        {showSeeAllButton && !loadingMore && (
          <div className="flex justify-center mt-10">
            <Button
              onClick={loadMore}
              className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-12 px-8 bg-primary"
            >
              See All
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default CategoryDetail;