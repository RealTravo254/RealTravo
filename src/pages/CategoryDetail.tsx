import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { useSearchFocus } from "@/components/PageLayout";
import { ListingCard } from "@/components/ListingCard";
import { TealLoader } from "@/components/ui/teal-loader";
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

const CategoryDetail = () => {
  const { category } = useParams<{ category: string }>();
  const [searchParams] = useSearchParams();
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

  // County tabs only for campsite and guided (events removed)
  const showCountyTabs = category === "campsite" || category === "guided";

  const { position } = useGeolocation();
  const [showSearchIcon, setShowSearchIcon] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [isSearchFocusedLocal, setIsSearchFocusedLocal] = useState(false);
  const { setSearchFocused } = useSearchFocus();

  const isSearchFocused = isSearchFocusedLocal;
  const setIsSearchFocused = useCallback((v: boolean) => {
    setIsSearchFocusedLocal(v);
    setSearchFocused(v);
  }, [setSearchFocused]);

  const categoryConfig: { [key: string]: any } = {
    trips:     { title: "Trips",                  tables: ["trips"],            type: "TRIP",           tripType: "trip",  filterType: "trips-events" },
    adventure: { title: "Attractions",            tables: ["adventure_places"], type: "ATTRACTION",                        filterType: "adventure" },
    campsite:  { title: "Campsite & Experience",  tables: ["adventure_places"], type: "ADVENTURE PLACE",                   filterType: "adventure" },
    guided:    { title: "Guided Tours",           tables: ["trips"],            type: "TRIP",           tripType: "trip",  filterType: "trips-events", flexibleOnly: true },
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
      if (window.innerWidth >= 768) setShowSearchIcon(window.scrollY > 100);
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

  // Only trips and guided need booking stats
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

      if (config.tripType) {
        query = query.eq("type", config.tripType);
      }

      if (config.flexibleOnly && table === "trips") {
        query = query.or("is_flexible_date.eq.true,is_custom_date.eq.true");
      }

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

  if (!config) return <div className="p-10 text-center">Category not found</div>;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-10">
      <Header
        className="hidden md:flex"
        showSearchIcon={showSearchIcon}
        onSearchClick={() =>
          searchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      />

      <div ref={searchRef} className={cn("bg-card border-b z-50 sticky top-0 md:relative", isSearchFocused && "z-[600]")}>
        <div className="container px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="md:hidden shrink-0 p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <SearchBarWithSuggestions
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={() => setFilteredItems(applyFilters(sortedItems, searchQuery, selectedCounty))}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onBack={() => { setIsSearchFocused(false); setSearchQuery(""); }}
              showBackButton={isSearchFocused}
            />
          </div>
        </div>
      </div>

      {/* County filter tabs */}
      {showCountyTabs && (
        <div className={cn("sticky top-[52px] md:static bg-card border-b", isSearchFocused ? "z-0" : "z-40")}>
          <div className="container px-4 py-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {["All", ...KENYA_COUNTIES.filter(c => items.some(item => item.place === c))].map((county) => (
                <button
                  key={county}
                  onClick={() => setSelectedCounty(county)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all shrink-0",
                    selectedCounty === county
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {county}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className={cn("container px-4 py-6 transition-opacity duration-200", isSearchFocused && "pointer-events-none opacity-20")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {loading ? (
            <div className="col-span-full"><TealLoader text="Loading listings..." /></div>
          ) : (
            filteredItems.map(item => {
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