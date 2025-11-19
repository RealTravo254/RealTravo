import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Footer } from "@/components/Footer";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";
import { FilterBar } from "@/components/FilterBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";

const CategoryDetail = () => {
  const { category } = useParams<{ category: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const [isSticky, setIsSticky] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
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
      title: "Trips & Events",
      tables: ["trips", "events"],
      type: "TRIP"
    },
    events: {
      title: "Events",
      tables: ["events"],
      type: "EVENT"
    },
    hotels: {
      title: "Hotels & Accommodation",
      tables: ["hotels"],
      type: "HOTEL"
    },
    adventure: {
      title: "Adventure Places",
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
      if (currentScrollY > 100) {
        setIsSticky(true);
        setIsSearchVisible(false);
        setShowSearchIcon(true);
      } else {
        setIsSticky(false);
        setIsSearchVisible(true);
        setShowSearchIcon(false);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const handleSearchIconClick = () => {
    setIsSearchVisible(true);
    setShowSearchIcon(false);
    if (searchRef.current) {
      searchRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const fetchData = async () => {
    if (!config) return;

    setLoading(true);
    const allData: any[] = [];
    
    for (const table of config.tables) {
      const { data } = await supabase
        .from(table as any)
        .select("*")
        .limit(20);
      
      if (data && Array.isArray(data)) {
        allData.push(...data.map((item: any) => ({ ...item, table })));
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
      }
      
      return 0;
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

  const handleSearch = async () => {
    if (!config || !searchQuery.trim()) {
      fetchData();
      return;
    }

    // Sanitize search query to prevent SQL injection
    const sanitizedQuery = searchQuery.toLowerCase().replace(/[%_]/g, '\\$&');
    const query = `%${sanitizedQuery}%`;
    const allData: any[] = [];
    
    for (const table of config.tables) {
      const { data } = await supabase
        .from(table as any)
        .select("*")
        .or(`name.ilike.${query},location.ilike.${query},country.ilike.${query},place.ilike.${query}`);
      
      if (data && Array.isArray(data)) {
        allData.push(...data.map((item: any) => ({ ...item, table })));
      }
    }
    
    setItems(allData);
  };

  const handleSave = async (itemId: string, itemType: string) => {
    if (!userId) {
      toast({
        title: "Login required",
        description: "Please log in to save items",
        variant: "destructive",
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
      
      {/* Search & Filter Bar */}
      <div 
        ref={filterRef}
        className={`sticky top-16 z-40 bg-background border-b transition-all duration-300 ${
          isSticky ? "shadow-md" : ""
        }`}
      >
        <div className="container px-4 py-4 space-y-4">
          <div
            ref={searchRef}
            className={`transition-all duration-300 ${isSearchVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none h-0'}`}
          >
            <SearchBarWithSuggestions
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={handleSearch}
            />
          </div>
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
          {loading || filteredItems.length === 0 ? (
            <>
              {[...Array(12)].map((_, i) => (
                <div key={i} className="border rounded-lg overflow-hidden">
                  <div className="aspect-[4/3] bg-muted animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                    <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                    <div className="h-6 bg-muted animate-pulse rounded w-1/3 mt-2" />
                  </div>
                </div>
              ))}
            </>
          ) : (
            filteredItems.map((item) => (
              <ListingCard
                key={item.id}
                id={item.id}
                type={item.table === "trips" ? "TRIP" : item.table === "events" ? "EVENT" : item.table === "hotels" ? "HOTEL" : "ADVENTURE PLACE"}
                name={item.name}
                imageUrl={item.image_url}
                location={item.location}
                country={item.country}
                price={item.price}
                date={item.date}
                onSave={handleSave}
                isSaved={savedItems.has(item.id)}
                amenities={item.amenities}
              />
            ))
          )}
        </div>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default CategoryDetail;