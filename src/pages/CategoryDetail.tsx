import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";
import { FilterBar, FilterValues } from "@/components/FilterBar";
import { ListingGridSkeleton } from "@/components/ui/listing-skeleton";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/sessionManager";
import { cn } from "@/lib/utils";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { useRatings, sortByRating } from "@/hooks/useRatings";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";

const ITEMS_PER_PAGE = 20;

const CategoryDetail = () => {
  const { category } = useParams<{ category: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [activeFilters, setActiveFilters] = useState<FilterValues>({});
  const { savedItems, handleSave } = useSavedItems();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  
  const { position } = useGeolocation();
  const [showSearchIcon, setShowSearchIcon] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const categoryConfig: { [key: string]: any } = {
    trips: { title: "Trips", tables: ["trips"], type: "TRIP", tripType: "trip", filterType: "trips-events" },
    events: { title: "Events", tables: ["trips"], type: "EVENT", tripType: "event", filterType: "trips-events" },
    hotels: { title: "Hotels", tables: ["hotels"], type: "HOTEL", filterType: "hotels" },
    adventure: { title: "Attractions", tables: ["adventure_places"], type: "ATTRACTION", filterType: "adventure" },
    campsite: { title: "Campsite & Experience", tables: ["adventure_places"], type: "ADVENTURE PLACE", filterType: "adventure" },
    accommodation: { title: "Accommodation", tables: ["hotels"], type: "HOTEL", filterType: "accommodation", establishmentType: "accommodation_only" }
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

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (window.innerWidth >= 768) {
        setShowSearchIcon(currentScrollY > 100);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const tripEventIds = useMemo(() => {
    if (category !== 'trips' && category !== 'events') return [];
    return items.map((item: any) => item.id);
  }, [items, category]);

  const { bookingStats } = useRealtimeBookings(tripEventIds);

  const fetchData = async (offset: number, limit: number) => {
    if (!config) return [];
    const allData: any[] = [];
    const today = new Date().toISOString().split('T')[0];
    
    for (const table of config.tables) {
      let query = supabase
        .from(table as any)
        .select(
          table === "trips"
            ? "id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child"
            : table === "hotels"
              ? "id,name,location,place,country,image_url,activities,latitude,longitude,created_at,establishment_type"
              : table === "adventure_places"
                ? "id,name,location,place,country,image_url,entry_fee,available_slots,activities,latitude,longitude,created_at"
                : "*"
        )
        .eq("approval_status", "approved")
        .eq("is_hidden", false);
      
      if (config.tripType) {
        query = query.eq("type", config.tripType);
      }
      
      // Filter by establishment type for accommodation category
      if (config.establishmentType && table === "hotels") {
        query = query.eq("establishment_type", config.establishmentType);
      }
      
      const { data } = await query.range(offset, offset + limit - 1);
      
      if (data) {
        allData.push(...data.map((item: any) => {
          let itemType = config.type;
          if (table === 'trips') itemType = item.type === 'event' ? 'EVENT' : 'TRIP';
          else if (table === 'hotels') itemType = 'HOTEL';
          else if (table === 'adventure_places') itemType = 'ADVENTURE PLACE';
          
          return { 
            ...item, 
            table,
            itemType,
            isOutdated: (table === 'trips' && item.date && !item.is_custom_date && new Date(item.date) < new Date(today))
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
    if (category === 'trips' || category === 'events') {
      const available: any[] = [];
      const soldOutOrOutdated: any[] = [];
      sorted.forEach(item => {
        const isSoldOut = item.available_tickets !== null && item.available_tickets !== undefined && item.available_tickets <= 0;
        if (item.isOutdated || isSoldOut) soldOutOrOutdated.push(item);
        else available.push(item);
      });
      return [...available, ...soldOutOrOutdated];
    }
    return sorted;
  }, [items, position, ratings, category]);

  const applyFilters = useCallback((itemsToFilter: any[], query: string, filters: FilterValues) => {
    let result = [...itemsToFilter];
    if (query) {
      result = result.filter(item => 
        item.name?.toLowerCase().includes(query.toLowerCase()) || 
        item.location?.toLowerCase().includes(query.toLowerCase())
      );
    }
    if (filters.location) {
      const loc = filters.location.toLowerCase();
      result = result.filter(item => 
        item.location?.toLowerCase().includes(loc) ||
        item.place?.toLowerCase().includes(loc) ||
        item.country?.toLowerCase().includes(loc)
      );
    }
    // Filter by date range if provided
    if (filters.dateFrom || filters.dateTo) {
      result = result.filter(item => {
        // For trips/events with specific dates
        if (item.date) {
          const itemDate = new Date(item.date);
          if (filters.dateFrom && itemDate < filters.dateFrom) return false;
          if (filters.dateTo && itemDate > filters.dateTo) return false;
        }
        // For flexible date items or items without dates, include them
        if (item.is_flexible_date) return true;
        // For hotels/adventure places, they're generally always available
        if (!item.date) return true;
        return true;
      });
    }
    return result;
  }, []);

  useEffect(() => {
    const filtered = applyFilters(sortedItems, searchQuery, activeFilters);
    setFilteredItems(filtered);
  }, [sortedItems, searchQuery, activeFilters, applyFilters]);

  if (!config) return <div className="p-10 text-center">Category not found</div>;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-10">

      <div ref={searchRef} className={cn("bg-white dark:bg-background border-b z-50 sticky top-0", isSearchFocused && "z-[600]")}>
        <div className="container px-4 py-3">
          <SearchBarWithSuggestions 
            value={searchQuery} 
            onChange={setSearchQuery} 
            onSubmit={() => setFilteredItems(applyFilters(sortedItems, searchQuery, activeFilters))} 
            onFocus={() => setIsSearchFocused(true)} 
            onBlur={() => setIsSearchFocused(false)} 
            onBack={() => { setIsSearchFocused(false); setSearchQuery(""); }} 
            showBackButton={isSearchFocused} 
          />
        </div>
      </div>

      {!isSearchFocused && (
        <div className="bg-background/95 backdrop-blur-sm border-b relative z-40">
          <div className="container px-4 py-2">
            <FilterBar 
              type={config?.filterType || "trips-events"} 
              onApplyFilters={setActiveFilters}
            />
          </div>
        </div>
      )}

      <main className={cn("container px-4 py-6 transition-opacity duration-200", isSearchFocused && "pointer-events-none opacity-20")}>
        {/* FIXED GRID: 
          Changed grid-cols-2 to grid-cols-1 on small mobile.
          On 'sm' (640px+) it goes to 2 columns.
          This prevents cards with min-width: 320px from overlapping.
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {loading ? (
            <ListingGridSkeleton count={8} />
          ) : (
            filteredItems.map(item => {
              const ratingData = ratings.get(item.id);
              const isTripsOrEvents = category === 'trips' || category === 'events';
              
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
                    isFlexibleDate={item.is_flexible_date}
                    isOutdated={item.isOutdated}
                    onSave={handleSave} 
                    isSaved={savedItems.has(item.id)}
                    availableTickets={isTripsOrEvents ? item.available_tickets : undefined}
                    bookedTickets={isTripsOrEvents ? bookingStats[item.id] || 0 : undefined}
                    activities={item.activities}
                    avgRating={ratingData?.avgRating}
                    reviewCount={ratingData?.reviewCount}
                  />
                </div>
              );
            })
          )}
        </div>

        {!loading && hasMore && filteredItems.length > 0 && (
          <div className="flex justify-center mt-10">
            <Button
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-12 px-8 bg-primary"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="text-center py-20 text-muted-foreground italic">
            No items found matching your filters.
          </div>
        )}
      </main>
    </div>
  );
};

export default CategoryDetail;