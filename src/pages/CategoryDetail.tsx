import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Footer } from "@/components/Footer";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";
import { FilterBar } from "@/components/FilterBar";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { cn } from "@/lib/utils";

const CategoryDetail = () => {
  const { category } = useParams<{ category: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [bookingStats, setBookingStats] = useState<Map<string, number>>(new Map());
  const { toast } = useToast();
  const [isSticky, setIsSticky] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [isSearchVisible, setIsSearchVisible] = useState(true);
  const [showSearchIcon, setShowSearchIcon] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const categoryConfig: {
    [key: string]: {
      title: string;
      tables: string[];
      type: string;
    };
  } = {
    trips: {
      title: "Trips",
      tables: ["trips"],
      type: "TRIP"
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
      fetchData();
      if (uid) {
        fetchSavedItems(uid);
      }
    };
    initializeData();
  }, [category]);

  useEffect(() => {
    setFilteredItems(items);
  }, [items]);

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchData = async () => {
    if (!config) return;

    setLoading(true);
    const allData: any[] = [];
    
    for (const table of config.tables) {
      const { data } = await supabase
        .from(table as any)
        .select("*")
        .eq("approval_status", "approved")
        .eq("is_hidden", false);
      
      if (data && Array.isArray(data)) {
        allData.push(...data.map((item: any) => ({ ...item, table })));
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
        setBookingStats(stats);
      }
    }
    
    // Sort: past events/trips last
    const sortedData = allData.sort((a, b) => {
      const aDate = a.date ? new Date(a.date) : null;
      const bDate = b.date ? new Date(b.date) : null;
      const now = new Date();
      
      if (aDate && bDate) {
        const aIsPast = aDate < now;
        const bIsPast = bDate < now;
        
        if (aIsPast && !bIsPast) return 1;
        if (!aIsPast && bIsPast) return -1;
        
        return aDate.getTime() - bDate.getTime();
      }
      
      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;
      
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setItems(sortedData);
    setLoading(false);
  };

  const fetchSavedItems = async (uid: string) => {
    const { data } = await supabase
      .from("saved_items")
      .select("item_id")
      .eq("user_id", uid);
    
    if (data) {
      setSavedItems(new Set(data.map(item => item.item_id)));
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
      return;
    }

    const filtered = items.filter(item => 
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.country?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredItems(filtered);
  };

  const handleSave = async (itemId: string, itemType: string) => {
    if (!userId) {
      toast({
        title: "Login required",
        description: "Please login to save items",
        variant: "destructive"
      });
      return;
    }

    const isSaved = savedItems.has(itemId);
    
    if (isSaved) {
      await supabase
        .from("saved_items")
        .delete()
        .eq("item_id", itemId)
        .eq("user_id", userId);
      
      setSavedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      toast({ title: "Removed from saved" });
    } else {
      await supabase
        .from("saved_items")
        .insert([{
          user_id: userId,
          item_id: itemId,
          item_type: itemType,
          session_id: null
        }]);
      
      setSavedItems(prev => new Set([...prev, itemId]));
      toast({ title: "Added to saved!" });
    }
  };

  const handleApplyFilters = (filters: any) => {
    let filtered = [...items];

    if (filters.location) {
      filtered = filtered.filter(
        (item) =>
          item.location?.toLowerCase().includes(filters.location.toLowerCase()) ||
          item.place?.toLowerCase().includes(filters.location.toLowerCase()) ||
          item.country?.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    // Date filtering for trips/events
    if (filters.dateFrom && filters.dateTo) {
      filtered = filtered.filter((item) => {
        if (item.date) {
          const itemDate = new Date(item.date);
          return itemDate >= new Date(filters.dateFrom) && itemDate <= new Date(filters.dateTo);
        }
        return false; // Exclude items without dates
      });
    } else if (filters.dateFrom) {
      filtered = filtered.filter((item) => {
        if (item.date) {
          const itemDate = new Date(item.date);
          return itemDate >= new Date(filters.dateFrom);
        }
        return false;
      });
    } else if (filters.dateTo) {
      filtered = filtered.filter((item) => {
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

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header onSearchClick={handleSearchIconClick} showSearchIcon={showSearchIcon} />
      
      {/* Search Bar - Shows when visible with higher z-index */}
      <div 
        ref={searchRef}
        className={`bg-background border-b transition-all duration-300 z-50 relative ${
          isSearchVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full h-0 overflow-hidden'
        }`}
      >
        <div className="container px-4 py-4">
          <SearchBarWithSuggestions
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={handleSearch}
          />
        </div>
      </div>

      {/* Filter Bar - Sticky on mobile when scrolled */}
      <div 
        ref={filterRef}
        className={cn(
          "bg-background border-b transition-all duration-300",
          isSticky && "sticky top-16 z-40 shadow-md md:relative md:shadow-none"
        )}
      >
        <div className="container px-4 py-4">
          <FilterBar
            type={
              category === "hotels"
                ? "hotels"
                : category === "adventure"
                ? "adventure"
                : "trips-events"
            }
            onApplyFilters={handleApplyFilters}
          />
        </div>
      </div>

      <main className="container px-4 py-8 space-y-4">
        <h1 className="text-3xl font-bold">{config.title}</h1>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          {loading ? (
            <>
              {[...Array(12)].map((_, i) => (
                <ListingSkeleton key={i} />
              ))}
            </>
          ) : filteredItems.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground py-8">No items found</p>
          ) : (
            filteredItems.map((item) => {
              const isAttraction = item.table === "attractions";
              const isEvent = item.table === "trips" && item.type === "event";
              return (
              <ListingCard
                key={item.id}
                id={item.id}
                type={item.table === "trips" ? (item.type === "event" ? "EVENT" : "TRIP") : item.table === "hotels" ? "HOTEL" : isAttraction ? "ATTRACTION" : "ADVENTURE PLACE"}
                name={isAttraction ? (item.local_name || item.location_name) : item.name}
                imageUrl={isAttraction ? (item.photo_urls?.[0] || "") : item.image_url}
                location={isAttraction ? item.location_name : item.location}
                country={item.country}
                price={isAttraction ? (item.price_adult || 0) : (item.price || item.entry_fee || 0)}
                date={item.date}
                onSave={handleSave}
                isSaved={savedItems.has(item.id)}
                amenities={item.amenities}
                availableTickets={isEvent ? item.available_tickets : undefined}
                bookedTickets={isEvent ? (bookingStats.get(item.id) || 0) : undefined}
              />
            )})
          )}
        </div>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default CategoryDetail;