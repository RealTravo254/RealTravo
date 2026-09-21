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

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used across the rest of the app:
// deep forest for the search header, a warm clay for the "See all" action.
const FOREST      = "#1F4D3A";
const FOREST_DEEP = "#123322";
const CLAY        = "#C1552F";
const INK         = "#1C2B22";
const INK_SOFT    = "#5B6B60";
const HAIRLINE    = "#DCE3DC";
const CANVAS      = "#F4F6F2";

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Injects the two typefaces once, without needing to touch the app's index.html.
const useInjectFonts = () => {
  useEffect(() => {
    const id = "adventure-detail-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
};

const INITIAL_VISIBLE_COUNT = 10;
const LOAD_MORE_COUNT = 10;
const SKELETON_COUNT_MOBILE  = 8;
const SKELETON_COUNT_DESKTOP = 20;

// days_opened added so ListingCard can render the working-days line and the
// Open now/Closed badge for the campsite category.
const ADVENTURE_PLACE_FIELDS =
  "id,name,location,place,country,image_url,gallery_images,images,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours,category,days_opened";

const TRIP_FIELDS =
  "id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description,opening_hours,closing_hours";

const CountyDetail = () => {
  useInjectFonts();

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
  // Only campsites (adventure_places filtered to category="campsite"),
  // guided tours, and fixed-date trips are fetched for this county. Hotels
  // and Airbnb/accommodation are excluded entirely.
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [adventuresRes, guidedRes, fixedTripsRes] = await Promise.all([
          // Campsites only — hotels are excluded by this explicit category filter.
          supabase.from("adventure_places")
            .select(ADVENTURE_PLACE_FIELDS)
            .eq("approval_status", "approved").eq("is_hidden", false)
            .eq("category", "campsite")
            .eq("place", decodedCounty),

          // ── Guided / flexible-date tours ──────────────────────────────────
          supabase.from("trips")
            .select(TRIP_FIELDS)
            .eq("approval_status", "approved").eq("is_hidden", false)
            .eq("type", "trip")
            .or("is_flexible_date.eq.true,is_custom_date.eq.true")
            .eq("place", decodedCounty),

          // ── Fixed-date trips ───────────────────────────────────────────────
          supabase.from("trips")
            .select(TRIP_FIELDS)
            .eq("approval_status", "approved").eq("is_hidden", false)
            .eq("type", "trip")
            .eq("is_flexible_date", false).eq("is_custom_date", false)
            .eq("place", decodedCounty),
        ]);

        const combined = [
          ...(adventuresRes.data || []).map((i: any) => ({ ...i, itemType: "ADVENTURE PLACE" })),
          ...(guidedRes.data     || []).map((i: any) => ({ ...i, itemType: "TRIP", __guided: true })),
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
      if (activeCategory === "guided") {
        result = result.filter(i => i.itemType === "TRIP" && i.__guided);
      } else if (activeCategory === "trips") {
        result = result.filter(i => i.itemType === "FIXED TRIP");
      } else {
        // campsite — filter by category column. (Parks/Attraction stay
        // commented out in CategoryTabsBar; if a tab for them is ever added
        // this still works since it's a generic category match. Hotels can
        // no longer appear here at all since they're never fetched above.)
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

  // Show the skeleton mockup any time there are no items — whether we're
  // still loading, filtering down to nothing, or loading finished empty —
  // so the page never falls back to a "no items" message.
  const showSkeleton = filtered.length === 0;

  const renderLoadMoreSkeletons = (count: number) => (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 mt-3 md:mt-4">
      {[...Array(count)].map((_, i) => (
        <div key={`more-skel-${i}`} className="w-full"><ListingSkeleton /></div>
      ))}
    </div>
  );

  return (
    <div style={{ background: CANVAS, fontFamily: FONT_BODY }}>

      {/* ── Sticky top: forest search header + category tabs ── */}
      <div className="sticky top-0 z-50 shadow-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div style={{ background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)` }}>
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
        <h1 className="text-xl font-semibold mb-4" style={{ fontFamily: FONT_DISPLAY, color: INK }}>{decodedCounty} County</h1>

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
                    workingDays={item.days_opened}
                    availableTickets={item.available_tickets}
                  />
                );
              })}
            </div>

            {loadingMore && renderLoadMoreSkeletons(nextBatchSize || LOAD_MORE_COUNT)}

            {hasMore && !loadingMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={handleSeeAll}
                  className="rounded-full px-6 font-semibold text-sm hover:bg-transparent"
                  style={{ borderColor: HAIRLINE, color: CLAY }}
                >
                  See all
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