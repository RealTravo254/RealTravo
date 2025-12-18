import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";
import { FilterBar } from "@/components/FilterBar";
import { ListingSkeleton, ListingGridSkeleton } from "@/components/ui/listing-skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { cn } from "@/lib/utils";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { useRatings, sortByRating, RatingData } from "@/hooks/useRatings";
const CategoryDetail = () => {
  const {
    category
  } = useParams<{
    category: string;
  }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const {
    savedItems,
    handleSave
  } = useSavedItems();
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [bookingStats, setBookingStats] = useState<Map<string, number>>(new Map());
  const {
    toast
  } = useToast();
  const { position, requestLocation } = useGeolocation();
  
  // Request location on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      requestLocation();
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('scroll', handleInteraction, { once: true });
    window.addEventListener('click', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [requestLocation]);
  const [isSticky, setIsSticky] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [isSearchVisible, setIsSearchVisible] = useState(true);
  const [showSearchIcon, setShowSearchIcon] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const categoryConfig: {
    [key: string]: {
      title: string;
      tables: string[];
      type: string;
      eventType?: string;
    };
  } = {
    trips: {
      title: "Trips",
      tables: ["trips"],
      type: "TRIP"
    },
    events: {
      title: "Events",
      tables: ["trips"],
      type: "EVENT",
      eventType: "event"
    },
    hotels: {
      title: "Hotels",
      tables: ["hotels"],
      type: "HOTEL"
    },
    adventure: {
      title: "Attractions",
      tables: ["attractions"],
      type: "ATTRACTION"
    },
    campsite: {
      title: "Campsite & Experience",
      tables: ["adventure_places"],
      type: "ADVENTURE PLACE"
    }
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

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (loading || !hasMore) return;
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;
      if (scrollTop + clientHeight >= scrollHeight - 500) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore, items.length]);
  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const moreData = await fetchData(items.length, 20);
    if (moreData.length > 0) {
      setItems(prev => [...prev, ...moreData]);
    } else {
      setHasMore(false); // No more data to load
    }
    setLoading(false);
  };
  // Collect item IDs for ratings
  const itemIds = useMemo(() => items.map(item => item.id), [items]);
  const { ratings } = useRatings(itemIds);

  useEffect(() => {
    setFilteredItems(getSortedItems(items, ratings));
  }, [items, position, ratings]);
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const searchBarHeight = searchRef.current?.offsetHeight || 0;
      if (currentScrollY > searchBarHeight + 100) {
        setIsSearchVisible(false);
        setShowSearchIcon(true);
        setIsSticky(true);
      } else {
        setIsSearchVisible(true);
        setShowSearchIcon(false);
        setIsSticky(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const handleSearchIconClick = () => {
    setIsSearchVisible(true);
    setShowSearchIcon(false);
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  const fetchData = async (offset: number = 0, limit: number = 20) => {
    if (!config) return [];
    const allData: any[] = [];
    const today = new Date().toISOString().split('T')[0];
    
    for (const table of config.tables) {
      let query = supabase.from(table as any).select("*").eq("approval_status", "approved").eq("is_hidden", false);

      // Filter by event type if specified - ONLY show upcoming/flexible dates
      if (config.eventType) {
        query = query.eq("type", config.eventType);
        // Only show events that haven't passed OR have flexible dates
        query = query.or(`date.gte.${today},is_flexible_date.eq.true`);
      } else if (category === "trips") {
        // For trips category, only show trips (not events) - ONLY upcoming/flexible
        query = query.eq("type", "trip");
        query = query.or(`date.gte.${today},is_flexible_date.eq.true`);
      }
      
      // Order by date for trips/events to show upcoming first
      if (table === 'trips') {
        query = query.order('date', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      
      query = query.range(offset, offset + limit - 1);
      const { data } = await query;
      
      if (data && Array.isArray(data)) {
        allData.push(...data.map((item: any) => ({
          ...item,
          table
        })));
      }
    }

    // Fetch booking statistics for events/trips
    const tripIds = allData.filter(item => item.table === 'trips').map(item => item.id);
    if (tripIds.length > 0) {
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('item_id, slots_booked')
        .in('item_id', tripIds)
        .in('status', ['confirmed', 'pending']);
        
      if (bookingsData) {
        const stats = new Map<string, number>();
        bookingsData.forEach(booking => {
          const current = stats.get(booking.item_id) || 0;
          stats.set(booking.item_id, current + (booking.slots_booked || 0));
        });
        setBookingStats(prevStats => new Map([...prevStats, ...stats]));
      }
    }

    return allData;
  };

  // Sort items: by rating with location prioritization
  const getSortedItems = (itemsToSort: any[], ratingsMap: Map<string, RatingData>) => {
    return sortByRating(itemsToSort, ratingsMap, position, calculateDistance);
  };
  const loadInitialData = async () => {
    setLoading(true);
    setHasMore(true); // Reset when loading initial data
    const data = await fetchData(0, 15);
    setItems(data);
    if (data.length < 15) {
      setHasMore(false); // Less data than requested means no more
    }
    setLoading(false);
  };
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
      return;
    }
    const filtered = items.filter(item => item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || item.location?.toLowerCase().includes(searchQuery.toLowerCase()) || item.country?.toLowerCase().includes(searchQuery.toLowerCase()));
    setFilteredItems(filtered);
  };
  const handleApplyFilters = (filters: any) => {
    let filtered = [...items];
    if (filters.location) {
      filtered = filtered.filter(item => item.location?.toLowerCase().includes(filters.location.toLowerCase()) || item.place?.toLowerCase().includes(filters.location.toLowerCase()) || item.country?.toLowerCase().includes(filters.location.toLowerCase()));
    }

    // Date filtering for trips/events
    if (filters.dateFrom && filters.dateTo) {
      filtered = filtered.filter(item => {
        if (item.date) {
          const itemDate = new Date(item.date);
          return itemDate >= new Date(filters.dateFrom) && itemDate <= new Date(filters.dateTo);
        }
        return false; // Exclude items without dates
      });
    } else if (filters.dateFrom) {
      filtered = filtered.filter(item => {
        if (item.date) {
          const itemDate = new Date(item.date);
          return itemDate >= new Date(filters.dateFrom);
        }
        return false;
      });
    } else if (filters.dateTo) {
      filtered = filtered.filter(item => {
        if (item.date) {
          const itemDate = new Date(item.date);
          return itemDate <= new Date(filters.dateTo);
        }
        return false;
      });
    }
    setFilteredItems(filtered);
  };
  if (!config) {
    return <div>Category not found</div>;
  }
  return <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header onSearchClick={handleSearchIconClick} showSearchIcon={showSearchIcon} />
      
      {/* Search Bar - Shows when visible, suggestions appear over everything */}
      <div ref={searchRef} className={cn("bg-background border-b transition-all duration-300", isSearchVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full h-0 overflow-hidden', isSearchFocused && "relative z-[500]")}>
        <div className="container px-4 py-4">
          <SearchBarWithSuggestions value={searchQuery} onChange={setSearchQuery} onSubmit={handleSearch} onFocus={() => setIsSearchFocused(true)} onBlur={() => setIsSearchFocused(false)} onBack={() => {
          setIsSearchFocused(false);
          setSearchQuery("");
        }} showBackButton={isSearchFocused} />
        </div>
      </div>

      {/* Filter Bar - Sticky on mobile when scrolled, hidden when search suggestions are open */}
      <div ref={filterRef} className={cn("bg-background border-b transition-all duration-300 relative z-10", isSticky && "sticky top-16 z-30 shadow-md md:relative md:shadow-none", isSearchFocused && "opacity-0 pointer-events-none")}>
        <div className="container px-4 py-4">
          <FilterBar type={category === "hotels" ? "hotels" : category === "adventure" ? "adventure" : category === "campsite" ? "adventure" : "trips-events"} onApplyFilters={handleApplyFilters} />
        </div>
      </div>

      <main className={cn("container px-4 py-8 space-y-4 relative z-0", isSearchFocused && "pointer-events-none opacity-50")}>
        

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6">
          {loading || filteredItems.length === 0 ? (
            <ListingGridSkeleton count={12} className="col-span-full" />
          ) : filteredItems.map(item => {
          const isAttraction = item.table === "attractions";
          const isEvent = item.table === "trips" && (item.type === "event" || category === "events");
          const isTripOrEvent = item.table === "trips";
          const itemDistance = position && !isTripOrEvent && item.latitude && item.longitude
            ? calculateDistance(position.latitude, position.longitude, item.latitude, item.longitude)
            : undefined;
          const ratingData = ratings.get(item.id);
          return <ListingCard key={item.id} id={item.id} type={item.table === "trips" ? isEvent ? "EVENT" : "TRIP" : item.table === "hotels" ? "HOTEL" : isAttraction ? "ATTRACTION" : "ADVENTURE PLACE"} name={isAttraction ? item.local_name || item.location_name : item.name} imageUrl={isAttraction ? item.photo_urls?.[0] || "" : item.image_url} location={isAttraction ? item.location_name : item.location} country={item.country} price={isAttraction ? item.price_adult || 0 : item.price || item.entry_fee || 0} date={item.date} isCustomDate={item.is_custom_date} onSave={handleSave} isSaved={savedItems.has(item.id)} amenities={item.amenities} activities={item.activities} showBadge={false} hideEmptySpace={true} distance={itemDistance} avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount} />;
        })}
        </div>
      </main>

      <MobileBottomBar />
    </div>;
};
export default CategoryDetail;