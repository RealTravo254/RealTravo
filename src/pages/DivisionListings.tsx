// src/pages/DivisionListings.tsx
//
// Shows every approved adventure place inside a single division (county /
// region), matched via adventure_places.division_id. Divisions only apply to
// adventure_places — trips are free-text location only and have no
// division_id column — so this page (unlike CountryListings) never queries
// `trips`.
//
// Same lazy-reveal "Load more" pagination pattern as CountryListings.tsx.

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin } from "lucide-react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/ListingCard";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { SEOHead } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useRatings } from "@/hooks/useRatings";

// ── Design tokens ───────────────────────────────────────────────────────
const FOREST       = "#1F4D3A";
const CLAY         = "#C1552F";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";
const FOREST_SOFT_BG = "#EAF0EA";
const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY    = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

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

const FETCH_LIMIT = 100;
const INITIAL_VISIBLE_COUNT = 10;
const LOAD_MORE_COUNT = 10;

interface DivisionRow { id: string; name: string; image_url: string | null; country_id: string }
interface CountryRow { id: string; name: string }

const DivisionListings = () => {
  useInjectFonts();
  const { divisionId } = useParams<{ divisionId: string }>();
  const navigate = useNavigate();

  const [division, setDivision] = useState<DivisionRow | null>(null);
  const [parentCountry, setParentCountry] = useState<CountryRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [loadingMore, setLoadingMore]   = useState(false);

  const { savedItems, handleSave } = useSavedItems();

  useEffect(() => {
    if (!divisionId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setNotFound(false);

      const { data: divisionRow } = await supabase
        .from("country_divisions")
        .select("id, name, image_url, country_id")
        .eq("id", divisionId)
        .maybeSingle();

      if (cancelled) return;

      if (!divisionRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setDivision(divisionRow);

      const [countryRes, placesRes] = await Promise.all([
        supabase.from("countries").select("id, name").eq("id", divisionRow.country_id).maybeSingle(),
        supabase
          .from("adventure_places")
          .select("id,name,location,place,country,image_url,gallery_images,images,entry_fee,activities,latitude,longitude,created_at,description,opening_hours,closing_hours,category,days_opened")
          .eq("approval_status", "approved").eq("is_hidden", false)
          .neq("category", "accommodation")
          .eq("division_id", divisionRow.id)
          .order("created_at", { ascending: false })
          .limit(FETCH_LIMIT),
      ]);

      if (cancelled) return;

      setParentCountry(countryRes.data || null);
      setListings((placesRes.data || []).map((p: any) => ({ ...p, type: "ADVENTURE PLACE" })));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [divisionId]);

  useEffect(() => { setVisibleCount(INITIAL_VISIBLE_COUNT); setLoadingMore(false); }, [divisionId]);

  const allItemIds = useMemo(() => listings.map(l => l.id), [listings]);
  const { ratings } = useRatings(allItemIds);

  const sortedListings = useMemo(() => {
    return [...listings].sort((a, b) => {
      const ra = ratings.get(a.id);
      const rb = ratings.get(b.id);
      const sa = ra ? ra.avgRating * Math.log1p(ra.reviewCount) : 0;
      const sb = rb ? rb.avgRating * Math.log1p(rb.reviewCount) : 0;
      return sb - sa;
    });
  }, [listings, ratings]);

  const visibleListings = useMemo(() => sortedListings.slice(0, visibleCount), [sortedListings, visibleCount]);
  const hasMore         = visibleCount < sortedListings.length;
  const nextBatchSize   = Math.min(LOAD_MORE_COUNT, Math.max(sortedListings.length - visibleCount, 0));

  const handleLoadMore = useCallback(() => {
    if (loadingMore) return;
    setLoadingMore(true);
    window.setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, sortedListings.length));
      setLoadingMore(false);
    }, 400);
  }, [loadingMore, sortedListings.length]);

  const skeletonGrid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {[...Array(8)].map((_, i) => <ListingSkeleton key={i} />)}
    </div>
  );

  const renderLoadMoreSkeletons = (count: number) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-3">
      {[...Array(count)].map((_, i) => <ListingSkeleton key={`more-skel-${i}`} />)}
    </div>
  );

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-sm mb-3" style={{ color: INK_SOFT }}>We couldn't find that division.</p>
            <Button onClick={() => navigate("/explore-countries")} variant="outline" className="rounded-full">
              Back to countries
            </Button>
          </div>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <SEOHead
        title={division ? `${division.name} - RealTravo` : "Division - RealTravo"}
        description={division ? `Adventure places in ${division.name}` : "Browse listings by division"}
      />
      <Header />

      {/* ── Hero ── */}
      <div className="relative w-full h-40 sm:h-56 overflow-hidden">
        {division?.image_url ? (
          <img src={division.image_url} alt={division.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: FOREST_SOFT_BG }}>
            <MapPin className="h-14 w-14" style={{ color: `${FOREST}55` }} />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(14,23,18,0.75), rgba(14,23,18,0.15) 60%, transparent)" }} />
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 hover:bg-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" style={{ color: INK }} />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white" style={{ fontFamily: FONT_DISPLAY }}>
            {division?.name || "Loading…"}
          </h1>
          {!loading && (
            <p className="mt-1 text-xs sm:text-sm font-medium text-white/85">
              {parentCountry ? `${parentCountry.name} · ` : ""}
              {sortedListings.length} listing{sortedListings.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 pb-24 md:pb-10">
        {loading ? (
          skeletonGrid
        ) : sortedListings.length === 0 ? (
          <p className="py-16 text-center text-sm" style={{ color: INK_SOFT }}>
            No approved listings in {division?.name} yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {visibleListings.map((listing, index) => {
                const ratingData = ratings.get(listing.id);
                return (
                  <ListingCard
                    key={listing.id}
                    id={listing.id}
                    type="ADVENTURE PLACE"
                    category={listing.category}
                    name={listing.name}
                    location={listing.location}
                    country={listing.country}
                    imageUrl={listing.image_url}
                    price={listing.entry_fee || 0}
                    isSaved={savedItems.has(listing.id)}
                    onSave={handleSave}
                    showBadge={true}
                    priority={index < 4}
                    hidePrice={true}
                    activities={listing.activities}
                    avgRating={ratingData?.avgRating}
                    reviewCount={ratingData?.reviewCount}
                    description={listing.description}
                    galleryImages={listing.gallery_images}
                    images={listing.images}
                    openingHours={listing.opening_hours}
                    closingHours={listing.closing_hours}
                    workingDays={listing.days_opened}
                  />
                );
              })}
            </div>

            {loadingMore && renderLoadMoreSkeletons(nextBatchSize || LOAD_MORE_COUNT)}

            {hasMore && !loadingMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  className="rounded-full px-6 font-semibold text-sm hover:bg-transparent"
                  style={{ borderColor: HAIRLINE, color: CLAY }}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default DivisionListings;