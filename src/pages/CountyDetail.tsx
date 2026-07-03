import { useState, useEffect, useMemo, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import { CategoryTabsBar } from "@/components/CategoryTabsBar";

const INITIAL_VISIBLE_COUNT = 10;
const LOAD_MORE_COUNT = 10;
const SKELETON_COUNT_MOBILE  = 8;
const SKELETON_COUNT_DESKTOP = 20;

const ADVENTURE_PLACE_FIELDS =
  "id,name,location,place,country,image_url,gallery_images,images,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours,category";

// TRIP_FIELDS is unused while trip/guided fetching is disabled below — kept
// in case it's needed again when trips are re-enabled.
const TRIP_FIELDS =
  "id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours";

const CountyDetail = () => {
  const { county } = useParams<{ county: string }>();
  const navigate   = useNavigate();
  const decodedCounty = decodeURIComponent(county || "");

  const [searchQuery, setSearchQuery]   = useState("");
  const [items, setItems]               = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [loadingMore, setLoadingMore]   = useState(false);

  const { savedItems, handleSave }  = useSavedItems();
  const { position }                = useGeolocation();
  const [isSearchFocusedLocal, setIsSearchFocusedLocal] = useState(false);
  const { setSearchFocused } = useSearchFocus();

  const setIsSearchFocused = useCallback((v: boolean) => {
    setIsSearchFocusedLocal(v);
    setSearchFocused(v);
  }, [setSearchFocused]);

  // ── Data fetch ──────────────────────────────────────────────────────────
  // Trip / guided-tour fetching is disabled site-wide — only adventure places
  // (hotels, accommodations, campsites, etc.) are fetched here now.
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [adventuresRes] = await Promise.all([
          // Adventure places (hotels, accommodations, campsites, etc.)
          supabase.from("adventure_places")
            .select(ADVENTURE_PLACE_FIELDS)
            .eq("approval_status", "approved").eq("is_hidden", false)
            .eq("place", decodedCounty),

          // ── Guided / flexible-date tours (disabled — uncomment to re-enable) ──
          // supabase.from("trips")
          //   .select(TRIP_FIELDS)
          //   .eq("approval_status", "approved").eq("is_hidden", false)
          //   .eq("type", "trip")
          //   .or("is_flexible_date.eq.true,is_custom_date.eq.true")
          //   .eq("place", decodedCounty),

          // ── Fixed-date trips (disabled — uncomment to re-enable) ──────────
          // supabase.from("trips")
          //   .select(TRIP_FIELDS)
          //   .eq("approval_status", "approved").eq("is_hidden", false)
          //   .eq("type", "trip")
          //   .eq("is_flexible_date", false).eq("is_custom_date", false)
          //   .eq("place", decodedCounty),
        ]);

        const combined = [
          ...(adventuresRes.data || []).map((i: any) => ({ ...i, itemType: "ADVENTURE PLACE" })),
          // ...(guidedRes.data     || []).map((i: any) => ({ ...i, itemType: "TRIP", __guided: true })), // guided trips disabled
          // ...(fixedTripsRes.data || []).map((i: any) => ({ ...i, itemType: "FIXED TRIP" })), // fixed trips disabled
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

  // ── Ratings & sorting ───────────────────────────────────────────────────
  const itemIds = useMemo(() => items.map(i => i.id), [items]);
  const { ratings } = useRatings(itemIds);
  const sorted = useMemo(
    () => sortByRating(items, ratings, position, calculateDistance),
    [items, ratings, position],
  );

  // ── Client-side filtering ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = sorted;

    if (activeCategory !== "all") {
      // "guided" tab is hidden in CategoryTabsBar and trips are never fetched
      // above, so this branch is effectively dead code — kept only so a
      // stray /county/:county?category=guided link doesn't crash.
      if (activeCategory === "guided") {
        result = result.filter(i => i.itemType === "TRIP" && i.__guided);
      }
      // Fixed trips tab disabled — uncomment if re-enabling the fetch above
      // else if (activeCategory === "trips") {
      //   result = result.filter(i => i.itemType === "FIXED TRIP");
      // }
      else {
        // hotels / accommodations / campsite — filter by category column
        // Parks and Attraction are commented out in CategoryTabsBar,
        // but if a user somehow hits those keys the filter still works.
        result = result.filter(
          i => i.itemType === "ADVENTURE PLACE" && i.category === activeCategory,
        );
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        i => i.name?.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [sorted, activeCategory, searchQuery]);

  // Reset visible count whenever the filter or search changes
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    setLoadingMore(false);
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    setVisibleCount(prev => Math.min(prev, Math.max(filtered.length, INITIAL_VISIBLE_COUNT)));
  }, [filtered.length]);

  const visibleItems  = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore       = visibleCount < filtered.length;
  const nextBatchSize = Math.min(LOAD_MORE_COUNT, Math.max(filtered.length - visibleCount, 0));

  const handleSeeAll = useCallback(() => {
    if (loadingMore) return;
    setLoadingMore(true);
    window.setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, filtered.length));
      setLoadingMore(false);
    }, 500);
  }, [loadingMore, filtered.length]);

  const isFiltering = searchQuery.length > 0 || activeCategory !== "all";
  const showSkeleton = loading || (!loading && filtered.length === 0 && !isFiltering);

  const renderLoadMoreSkeletons = (count: number) => (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 mt-3 md:mt-4">
      {[...Array(count)].map((_, i) => (
        <div key={`more-skel-${i}`} className="w-full"><ListingSkeleton /></div>
      ))}
    </div>
  );

  return (
    <div className="bg-background">

      {/* ── Sticky top: teal search header + category tabs ── */}
      <div className="sticky top-0 z-50 shadow-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="bg-primary">
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
        </div>

        {!isSearchFocusedLocal && (
          <CategoryTabsBar activeKey={activeCategory} onSelect={setActiveCategory} />
        )}
      </div>

      <main className={cn(
        "container px-4 py-6 transition-opacity duration-200",
        isSearchFocusedLocal && "pointer-events-none opacity-20",
      )}>
        <h1 className="text-lg font-extrabold mb-4">{decodedCounty} County</h1>

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
        ) : filtered.length === 0 && isFiltering ? (
          <div className="text-center py-20 text-muted-foreground italic">No items found.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {visibleItems.map(item => {
                const rd = ratings.get(item.id);
                const isGuided = item.__guided;
                return (
                  <ListingCard
                    key={item.id}
                    id={item.id}
                    type={item.itemType === "FIXED TRIP" ? "TRIP" : item.itemType}
                    category={item.category}
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
                    hidePrice={item.itemType === "ADVENTURE PLACE"}
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

            {loadingMore && renderLoadMoreSkeletons(nextBatchSize || LOAD_MORE_COUNT)}

            {hasMore && !loadingMore && (
              <div className="flex justify-center mt-6">
                <Button variant="outline" onClick={handleSeeAll} className="rounded-full px-6 font-bold text-sm">
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

export default CountyDetail;