import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";
import { FilterBar, FilterValues } from "@/components/FilterBar";
import { ListingGridSkeleton } from "@/components/ui/listing-skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/sessionManager";
import { cn } from "@/lib/utils";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { useRatings, sortByRating } from "@/hooks/useRatings";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";

const CategoryDetail = () => {
  const { category } = useParams<{ category: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [activeFilters, setActiveFilters] = useState<FilterValues>({});
  const { savedItems, handleSave } = useSavedItems();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  const { position } = useGeolocation();
  const [showSearchIcon, setShowSearchIcon] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const categoryConfig: { [key: string]: any } = {
    trips: { title: "Trips", tables: ["trips"], type: "TRIP", tripType: "trip" },
    events: { title: "Events", tables: ["trips"], type: "EVENT", tripType: "event" },
    hotels: { title: "Hotels", tables: ["hotels"], type: "HOTEL" },
    adventure: { title: "Attractions", tables: ["attractions"], type: "ATTRACTION" },
    campsite: { title: "Campsite & Experience", tables: ["adventure_places"], type: "ADVENTURE PLACE" }
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

  // Handle Header Search Icon visibility only
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // If user scrolls down on desktop, show the icon in the main header
      if (window.innerWidth >= 768) {
        setShowSearchIcon(currentScrollY > 100);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    const data = await fetchData(0, 50);
    setItems(data);
    setLoading(false);
  };

  // Get item IDs for real-time booking subscriptions
  const tripEventIds = useMemo(() => {
    if (category !== 'trips' && category !== 'events') return [];
    return items.map((item: any) => item.id);
  }, [items, category]);

  // Real-time booking stats subscription
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
              ? "id,name,location,place,country,image_url,activities,latitude,longitude,created_at"
              : table === "adventure_places"
                ? "id,name,location,place,country,image_url,entry_fee,available_slots,activities,latitude,longitude,created_at"
                : "*"
        )
        .eq("approval_status", "approved")
        .eq("is_hidden", false);
      
      // Filter by trip type (trip or event)
      if (config.tripType) {
        query = query.eq("type", config.tripType);
      }
      
      const { data } = await query.range(offset, offset + limit - 1);
      
      if (data) {
        allData.push(...data.map((item: any) => {
          // Determine correct type based on table
          let itemType = config.type;
          if (table === 'trips') {
            itemType = item.type === 'event' ? 'EVENT' : 'TRIP';
          } else if (table === 'hotels') {
            itemType = 'HOTEL';
          } else if (table === 'adventure_places') {
            itemType = 'ADVENTURE PLACE';
          }
          
          return { 
            ...item, 
            table,
            itemType,
            // Mark as outdated if it's a trip/event with a past date
            isOutdated: (table === 'trips' && item.date && !item.is_custom_date && new Date(item.date) < new Date(today))
          };
        }));
      }
    }
    return allData;
  };

  const itemIds = useMemo(() => items.map(item => item.id), [items]);
  const { ratings } = useRatings(itemIds);

  // Sort items: show outdated items last, then by rating
  const sortedItems = useMemo(() => {
    const sorted = sortByRating(items, ratings, position, calculateDistance);
    
    // For trips/events, move outdated items to the end
    if (category === 'trips' || category === 'events') {
      const activeItems = sorted.filter(item => !item.isOutdated);
      const outdatedItems = sorted.filter(item => item.isOutdated);
      return [...activeItems, ...outdatedItems];
    }
    
    return sorted;
  }, [items, position, ratings, category]);

  // Apply all filters: search query + filter bar filters
  const applyFilters = useCallback((itemsToFilter: any[], query: string, filters: FilterValues) => {
    let result = [...itemsToFilter];

    // Apply search query filter
    if (query) {
      result = result.filter(item => 
        item.name?.toLowerCase().includes(query.toLowerCase()) || 
        item.location?.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Apply location filter
    if (filters.location) {
      const locationLower = filters.location.toLowerCase();
      result = result.filter(item => 
        item.location?.toLowerCase().includes(locationLower) ||
        item.place?.toLowerCase().includes(locationLower) ||
        item.country?.toLowerCase().includes(locationLower)
      );
    }

    // Apply date filters for trips/events
    if (filters.dateFrom || filters.dateTo) {
      result = result.filter(item => {
        if (!item.date) return true; // Include items without dates
        const itemDate = new Date(item.date);
        
        if (filters.dateFrom && itemDate < filters.dateFrom) return false;
        if (filters.dateTo && itemDate > filters.dateTo) return false;
        
        return true;
      });
    }

    // Apply date filters for hotels (check-in/check-out)
    // For hotels, we just filter by the range - this is a simple implementation
    // In a real app, you'd check room availability in the database
    if (filters.checkIn || filters.checkOut) {
      // For now, hotels pass through as they don't have specific dates
      // The filter bar UI shows check-in/check-out for context
    }

    return result;
  }, []);

  useEffect(() => {
    const filtered = applyFilters(sortedItems, searchQuery, activeFilters);
    setFilteredItems(filtered);
  }, [sortedItems, searchQuery, activeFilters, applyFilters]);

  const handleSearch = () => {
    const filtered = applyFilters(sortedItems, searchQuery, activeFilters);
    setFilteredItems(filtered);
  };

  const handleApplyFilters = useCallback((filters: FilterValues) => {
    setActiveFilters(filters);
  }, []);

  if (!config) return <div className="p-10 text-center">Category not found</div>;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-10">
      {/* HEADER: Standard navigation header */}
      <div className="hidden md:block">
        <Header onSearchClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} showSearchIcon={showSearchIcon} />
      </div>

      {/* SEARCH BAR: STICKY AT TOP FOR BOTH MOBILE AND DESKTOP */}
      <div 
        ref={searchRef} 
        className={cn(
          "bg-white dark:bg-background border-b z-50 transition-all duration-300",
          "sticky top-0", // This keeps it at the very top on scroll
          isSearchFocused && "z-[600]"
        )}
      >
        <div className="container px-4 py-3">
          <SearchBarWithSuggestions 
            value={searchQuery} 
            onChange={setSearchQuery} 
            onSubmit={handleSearch} 
            onFocus={() => setIsSearchFocused(true)} 
            onBlur={() => setIsSearchFocused(false)} 
            onBack={() => {
              setIsSearchFocused(false);
              setSearchQuery("");
            }} 
            showBackButton={isSearchFocused} 
          />
        </div>
      </div>

      {/* FILTER BAR: Collapsible filter with overlay location */}
      <div className={cn(
        "bg-background/95 backdrop-blur-sm border-b relative z-40",
        isSearchFocused && "opacity-0 pointer-events-none"
      )}>
        <div className="container px-4 py-2">
          <FilterBar 
            type={category === "hotels" ? "hotels" : category === "campsite" ? "adventure" : "trips-events"} 
            onApplyFilters={handleApplyFilters}
            collapsible={true}
          />
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className={cn(
        "container px-4 py-6 space-y-4 transition-opacity duration-200", 
        isSearchFocused && "pointer-events-none opacity-20"
      )}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
          {loading ? (
            <ListingGridSkeleton count={10} />
          ) : (
            filteredItems.map(item => {
              const ratingData = ratings.get(item.id);
              const isTripsOrEvents = category === 'trips' || category === 'events';
              
              return (
                <ListingCard 
                  key={item.id} 
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
              );
            })
          )}
        </div>

        {!loading && filteredItems.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            No items found matching your search.
          </div>
        )}
      </main>

      <MobileBottomBar />
    </div>
  );
};

export default CategoryDetail;
