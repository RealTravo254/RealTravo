import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { useSearchFocus } from "@/components/PageLayout";
import { ListingCard } from "@/components/ListingCard";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/sessionManager";
import { cn } from "@/lib/utils";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { useRatings, sortByRating } from "@/hooks/useRatings";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { KENYA_COUNTIES } from "@/lib/kenyaCounties";

const ITEMS_PER_PAGE = 20;
const SKELETON_COUNT_MOBILE = 8;
const SKELETON_COUNT_DESKTOP = 20;

const CategoryDetail = () => {
  const { category } = useParams<{ category: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const { savedItems, handleSave } = useSavedItems();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedCounty, setSelectedCounty] = useState<string>(searchParams.get("county") || "All");

  const showCountyTabs = category === "campsite" || category === "guided";

  const { position } = useGeolocation();
  const [isSearchFocusedLocal, setIsSearchFocusedLocal] = useState(false);
  const { setSearchFocused } = useSearchFocus();

  const isSearchFocused = isSearchFocusedLocal;
  const setIsSearchFocused = useCallback((v: boolean) => {
    setIsSearchFocusedLocal(v);
    setSearchFocused(v);
  }, [setSearchFocused]);

  const categoryConfig: { [key: string]: any } = {
    trips:     { title: "Trips",                 tables: ["trips"],            type: "TRIP",           tripType: "trip", filterType: "trips" },
    adventure: { title: "Attractions",           tables: ["adventure_places"], type: "ADVENTURE PLACE",                  filterType: "adventure" },
    campsite:  { title: "Campsite & Experience", tables: ["adventure_places"], type: "ADVENTURE PLACE",                  filterType: "adventure" },
    guided:    { title: "Guided Tours",          tables: ["trips"],            type: "TRIP",           tripType: "trip", filterType: "trips", flexibleOnly: true },
  };

  const config = category ? categoryConfig[category] : null;

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

  const tripIds = useMemo(() => {
    if (category !== "trips" && category !== "guided") return [];
    return items.map((item: any) => item.id);
  }, [items, category]);

  const { bookingStats } = useRealtimeBookings(tripIds);

  const fetchData = async (offset: number, limit: number) => {
    if (!config) return [];
    const allData: any[] = [];
    const today = new Date().toISOString().split("T")[0];

    for (const table of config.tables) {
      let query = supabase
        .from(table as any)
        .select(
          table === "trips"
            ? "id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours"
            : "id,name,location,place,country,image_url,gallery_images,images,entry_fee,available_slots,activities,latitude,longitude,created_at,description,opening_hours,closing_hours"
        )
        .eq("approval_status", "approved")
        .eq("is_hidden", false);

      if (config.tripType) query = query.eq("type", config.tripType);
      if (config.flexibleOnly && table === "trips") query = query.or("is_flexible_date.eq.true,is_custom_date.eq.true");

      const { data } = await query.range(offset, offset + limit - 1);

      if (data) {
        allData.push(...data.map((item: any) => {
          let itemType = config.type;
          if (table === "trips") itemType = "TRIP";
          else if (table === "adventure_places") itemType = "ADVENTURE PLACE";
          return {
            ...item,
            table,
            itemType,
            isOutdated: (
              table === "trips" &&
              item.date &&
              !item.is_custom_date &&
              new Date(item.date) < new Date(today)
            ),
          };
        }));
      }
    }
    return allData;
  };

  const itemIds = useMemo(() => items.map(item => item.id), [items]);
  const { ratings } = useRatings(itemIds);

  const sortedItems = useMemo(() => {
    const sorted = sortByRating(items, ratings, position, calculateDistance);
    if (category === "trips" || category === "guided") {
      const available: any[] = [];
      const soldOutOrOutdated: any[] = [];
      sorted.forEach(item => {
        const isSoldOut =
          item.available_tickets !== null &&
          item.available_tickets !== undefined &&
          item.available_tickets <= 0;
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
        item.country?.toLowerCase().includes(q)
      );
    }
    if (county && county !== "All") {
      result = result.filter(item => item.place === county);
    }
    return result;
  }, []);

  useEffect(() => {
    const filtered = applyFilters(sortedItems, searchQuery, selectedCounty);
    setFilteredItems(filtered);
  }, [sortedItems, searchQuery, selectedCounty, applyFilters]);

  // Show skeleton when: actively loading OR no items yet and no active filter/search
  const isFiltering = searchQuery.length > 0 || selectedCounty !== "All";
  const showSkeleton = loading || (!loading && filteredItems.length === 0 && !isFiltering);

  if (!config) return <div className="p-10 text-center">Category not found</div>;

  return (
    <div className="bg-background">

      {/* ── Teal sticky search header ── */}
      <div className="sticky top-0 z-50 bg-primary shadow-md">
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

        {/* County filter tabs */}
        {showCountyTabs && !isSearchFocused && (
          <div className="container mx-auto px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {["All", ...KENYA_COUNTIES.filter(c => items.some(item => item.place === c))].map((county) => (
                <button
                  key={county}
                  onClick={() => setSelectedCounty(county)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shrink-0",
                    selectedCounty === county
                      ? "bg-primary-foreground text-primary shadow-sm"
                      : "bg-primary-foreground/20 text-primary-foreground/90 hover:bg-primary-foreground/30"
                  )}
                >
                  {county}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <main className={cn("container px-4 py-6 transition-opacity duration-200", isSearchFocused && "pointer-events-none opacity-20")}>

        {showSkeleton ? (
          <>
            {/* Mobile skeletons */}
            <div className="md:hidden grid grid-cols-2 gap-2.5">
              {[...Array(SKELETON_COUNT_MOBILE)].map((_, i) => (
                <div key={i} className="w-full">
                  <ListingSkeleton />
                </div>
              ))}
            </div>
            {/* Desktop skeletons */}
            <div className="hidden md:grid grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(SKELETON_COUNT_DESKTOP)].map((_, i) => (
                <div key={i} className="w-full">
                  <ListingSkeleton />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {filteredItems.map(item => {
                const ratingData = ratings.get(item.id);
                const isTripsOrGuided = category === "trips" || category === "guided";
                return (
                  <div key={item.id} className="w-full">
                    <ListingCard
                      id={item.id}
                      type={item.itemType || config.type}
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
                      availableTickets={isTripsOrGuided ? item.available_tickets : undefined}
                      bookedTickets={isTripsOrGuided ? bookingStats[item.id] || 0 : undefined}
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

            {/* Only show empty state when user is actively filtering/searching */}
            {filteredItems.length === 0 && isFiltering && (
              <div className="text-center py-20 text-muted-foreground italic">
                No items found matching your filters.
              </div>
            )}
          </>
        )}

        {!showSkeleton && hasMore && filteredItems.length > 0 && (
          <div className="flex justify-center mt-10">
            <Button
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-12 px-8 bg-primary"
            >
              {loadingMore ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default CategoryDetail;