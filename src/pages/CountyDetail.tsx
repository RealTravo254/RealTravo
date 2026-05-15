import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { useSearchFocus } from "@/components/PageLayout";
import { ListingCard } from "@/components/ListingCard";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { useRatings, sortByRating } from "@/hooks/useRatings";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const TABS = ["All", "Adventure Places", "Guided Trips", "Fixed Trips"] as const;
type Tab = typeof TABS[number];
const ITEMS_PER_PAGE = 12;
const SKELETON_COUNT_MOBILE = 8;
const SKELETON_COUNT_DESKTOP = 20;

const CountyDetail = () => {
  const { county } = useParams<{ county: string }>();
  const navigate = useNavigate();
  const decodedCounty = decodeURIComponent(county || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const { savedItems, handleSave } = useSavedItems();
  const { position } = useGeolocation();
  const [isSearchFocusedLocal, setIsSearchFocusedLocal] = useState(false);
  const { setSearchFocused } = useSearchFocus();

  const setIsSearchFocused = useCallback((v: boolean) => {
    setIsSearchFocusedLocal(v);
    setSearchFocused(v);
  }, [setSearchFocused]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [adventuresRes, guidedRes, fixedTripsRes] = await Promise.all([
          supabase.from("adventure_places")
            .select("id,name,location,place,country,image_url,gallery_images,images,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours")
            .eq("approval_status", "approved").eq("is_hidden", false).eq("place", decodedCounty),
          supabase.from("trips")
            .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
            .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip")
            .or("is_flexible_date.eq.true,is_custom_date.eq.true").eq("place", decodedCounty),
          supabase.from("trips")
            .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours")
            .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip")
            .eq("is_flexible_date", false).eq("is_custom_date", false).eq("place", decodedCounty),
        ]);

        const combined = [
          ...(adventuresRes.data || []).map((i: any) => ({ ...i, itemType: "ADVENTURE PLACE" })),
          ...(guidedRes.data   || []).map((i: any) => ({ ...i, itemType: "TRIP" })),
          ...(fixedTripsRes.data || []).map((i: any) => ({ ...i, itemType: "FIXED TRIP" })),
        ];
        setItems(combined);
      } catch (err) {
        console.error("CountyDetail fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (decodedCounty) fetchData();
  }, [decodedCounty]);

  const itemIds = useMemo(() => items.map(i => i.id), [items]);
  const { ratings } = useRatings(itemIds);
  const sorted = useMemo(() => sortByRating(items, ratings, position, calculateDistance), [items, ratings, position]);

  const filtered = useMemo(() => {
    let result = sorted;
    if (activeTab === "Adventure Places") result = result.filter(i => i.itemType === "ADVENTURE PLACE");
    else if (activeTab === "Guided Trips") result = result.filter(i => i.itemType === "TRIP");
    else if (activeTab === "Fixed Trips")  result = result.filter(i => i.itemType === "FIXED TRIP");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.name?.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sorted, activeTab, searchQuery]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [activeTab, searchQuery]);

  // Show skeleton when: actively loading OR no items yet and no active filter/search
  const isFiltering = searchQuery.length > 0 || activeTab !== "All";
  const showSkeleton = loading || (!loading && filtered.length === 0 && !isFiltering);

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) pages.push(i);
    }
    const uniquePages = [...new Set(pages)].sort((a, b) => a - b);
    return (
      <div className="flex items-center justify-center gap-1 mt-6">
        <Button variant="ghost" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 rounded-full">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {uniquePages.map((page, idx) => {
          const prevPage = uniquePages[idx - 1];
          const showEllipsis = prevPage && page - prevPage > 1;
          return (
            <span key={page} className="flex items-center gap-1">
              {showEllipsis && <span className="text-xs text-muted-foreground px-1">...</span>}
              <button
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "h-8 w-8 rounded-full text-xs font-bold transition-all",
                  currentPage === page ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                )}
              >
                {page}
              </button>
            </span>
          );
        })}
        <Button variant="ghost" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 w-8 rounded-full">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="bg-background">

      {/* ── Teal sticky search header ── */}
      <div className="sticky top-0 z-50 bg-primary shadow-md">
        <div className="container mx-auto px-4 py-3">
          <SearchBarWithSuggestions
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={() => {}}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onBack={() => { setIsSearchFocused(false); setSearchQuery(""); navigate(-1); }}
            showBackButton={true}
          />
        </div>

        {/* Tab filters */}
        {!isSearchFocusedLocal && (
          <div className="container mx-auto px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shrink-0",
                    activeTab === tab
                      ? "bg-primary-foreground text-primary shadow-sm"
                      : "bg-primary-foreground/20 text-primary-foreground/90 hover:bg-primary-foreground/30"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <main className={cn("container px-4 py-6 transition-opacity duration-200", isSearchFocusedLocal && "pointer-events-none opacity-20")}>
        <h1 className="text-lg font-extrabold mb-4">{decodedCounty} County</h1>

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
        ) : filtered.length === 0 && isFiltering ? (
          <div className="text-center py-20 text-muted-foreground italic">No items found.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {paginatedItems.map(item => {
                const rd = ratings.get(item.id);
                return (
                  <ListingCard
                    key={item.id}
                    id={item.id}
                    type={item.itemType}
                    name={item.name}
                    imageUrl={item.image_url}
                    location={item.location}
                    country={item.country || ""}
                    price={item.price || item.entry_fee}
                    date={item.date}
                    isCustomDate={item.is_custom_date}
                    isFlexibleDate={Boolean(item.is_flexible_date || item.is_custom_date)}
                    isSaved={savedItems.has(item.id)}
                    onSave={handleSave}
                    activities={item.activities}
                    avgRating={rd?.avgRating}
                    reviewCount={rd?.reviewCount}
                    description={item.description}
                    galleryImages={item.gallery_images}
                    images={item.images}
                    openingHours={item.opening_hours}
                    closingHours={item.closing_hours}
                  />
                );
              })}
            </div>
            {renderPagination()}
          </>
        )}
      </main>
    </div>
  );
};

export default CountyDetail;