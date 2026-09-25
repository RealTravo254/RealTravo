import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useLocation } from "react-router-dom";
import { Trash2, MapPin, ChevronRight, Loader2, LogIn, UserPlus, Heart } from "lucide-react";
import { createDetailPath } from "@/lib/slugUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { getLocalSavedItems, removeItemLocally } from "@/hooks/useLocalSavedItems";

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used across the rest of the app:
// deep forest for structure and brand marks, a warm clay for the primary
// action, a dusty rust for the remove/delete action.
const FOREST       = "#1F4D3A";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const CLAY_LIGHT   = "#E0824F";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";
const DANGER       = "#9C3B2B";
const DANGER_SOFT  = "#F7E9E5";

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

const ITEMS_PER_PAGE = 20;

// Skeleton row that mirrors the real item's layout exactly (remove button +
// thumbnail + text lines + chevron), so the list never "pops" in from blank.
const SavedItemSkeleton = () => (
  <div className="flex items-center gap-2">
    <div className="shrink-0 p-3 rounded-full" style={{ background: DANGER_SOFT, border: `1px solid ${DANGER}25`, width: 42, height: 42 }} />
    <div
      className="flex-1 flex items-center gap-4 bg-white p-3 sm:p-4 rounded-[22px] min-w-0"
      style={{ border: `1px solid ${HAIRLINE}` }}
    >
      <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-2.5 w-16 rounded-full" />
        <Skeleton className="h-4 w-3/5 rounded-md" />
        <Skeleton className="h-3 w-2/5 rounded-md" />
      </div>
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
    </div>
  </div>
);

// Thumbnail that shows a skeleton until the actual image has loaded, so a
// slow network never leaves a blank square in the row.
const ItemThumbnail = ({ src, alt }: { src?: string; alt: string }) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    // Reset when the underlying src changes (e.g. list re-fetches).
    setLoaded(false);
    setErrored(false);
  }, [src]);

  return (
    <div className="relative h-16 w-16 rounded-xl shrink-0 overflow-hidden">
      {(!loaded || !src) && !errored && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-xl" />
      )}
      {src && !errored && (
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className="h-16 w-16 rounded-xl object-cover"
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 150ms ease" }}
        />
      )}
      {errored && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl"
          style={{ background: CANVAS, color: INK_SOFT }}
        >
          <MapPin size={16} />
        </div>
      )}
    </div>
  );
};

const Saved = () => {
  useInjectFonts();

  const [savedListings, setSavedListings] = useState<any[]>([]);
  const { savedItems } = useSavedItems();
  const { user, loading: authLoading } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const hasFetched = useRef(false);
  const location = useLocation();
  const isEmbeddedInSheet = location.pathname !== "/saved";

  const deletingRef = useRef<string | null>(null);

  // Fetch local saved items details for non-logged users
  const fetchLocalSavedDetails = async () => {
    setIsLoading(true);
    const localItems = getLocalSavedItems();
    if (localItems.length === 0) {
      setSavedListings([]);
      setIsLoading(false);
      return;
    }

    const tripIds = localItems.filter(s => s.item_type === "trip" || s.item_type === "event").map(s => s.item_id);
    const hotelIds = localItems.filter(s => s.item_type === "hotel").map(s => s.item_id);
    const adventureIds = localItems.filter(s => s.item_type === "adventure_place" || s.item_type === "attraction").map(s => s.item_id);

    const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
      tripIds.length > 0 ? supabase.from("trips").select("id,name,location,image_url,is_hidden,type").in("id", tripIds) : { data: [] },
      hotelIds.length > 0 ? supabase.from("hotels").select("id,name,location,image_url,is_hidden").in("id", hotelIds) : { data: [] },
      adventureIds.length > 0 ? supabase.from("adventure_places").select("id,name,location,image_url,is_hidden").in("id", adventureIds) : { data: [] },
    ]);

    const itemMap = new Map();
    [...(tripsRes.data || []), ...(hotelsRes.data || []), ...(adventuresRes.data || [])].forEach(item => {
      if (item.is_hidden) return;
      const original = localItems.find(s => s.item_id === item.id);
      itemMap.set(item.id, { ...item, savedType: original?.item_type });
    });

    const newItems = localItems.map(s => itemMap.get(s.item_id)).filter(Boolean);
    setSavedListings(newItems);
    setIsLoading(false);
  };

  useEffect(() => {
    const initializeData = async () => {
      if (authLoading) return;

      if (!user) {
        // Not logged in - show local saved items
        fetchLocalSavedDetails();
        return;
      }

      const uid = await getUserId();
      if (!uid) { setIsLoading(false); return; }
      setUserId(uid);
      fetchSavedItems(uid, 0);
    };
    initializeData();
    // Re-runs the moment `user` flips from null -> a real user (i.e. right
    // after they log in or sign up from this page's modal), which is what
    // takes them from the "please sign in" view straight into their real
    // saved items without ever having navigated away from /saved.
  }, [authLoading, user]);

  useEffect(() => {
    if (user && userId && hasFetched.current) fetchSavedItems(userId, 0);
    if (!user) fetchLocalSavedDetails();
  }, [savedItems]);

  const fetchSavedItems = async (uid: string, fetchOffset: number) => {
    if (fetchOffset === 0) setIsLoading(true);
    else setLoadingMore(true);

    const { data: savedData } = await supabase
      .from("saved_items")
      .select("item_id, item_type")
      .eq("user_id", uid)
      .range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1)
      .order('created_at', { ascending: false });

    if (!savedData || savedData.length === 0) {
      if (fetchOffset === 0) setSavedListings([]);
      setHasMore(false);
      setIsLoading(false);
      setLoadingMore(false);
      return;
    }

    setHasMore(savedData.length >= ITEMS_PER_PAGE);

    const tripIds = savedData.filter(s => s.item_type === "trip" || s.item_type === "event").map(s => s.item_id);
    const hotelIds = savedData.filter(s => s.item_type === "hotel").map(s => s.item_id);
    const adventureIds = savedData.filter(s => s.item_type === "adventure_place" || s.item_type === "attraction").map(s => s.item_id);

    const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
      tripIds.length > 0 ? supabase.from("trips").select("id,name,location,image_url,is_hidden,type").in("id", tripIds) : { data: [] },
      hotelIds.length > 0 ? supabase.from("hotels").select("id,name,location,image_url,is_hidden").in("id", hotelIds) : { data: [] },
      adventureIds.length > 0 ? supabase.from("adventure_places").select("id,name,location,image_url,is_hidden").in("id", adventureIds) : { data: [] },
    ]);

    const itemMap = new Map();
    [...(tripsRes.data || []), ...(hotelsRes.data || []), ...(adventuresRes.data || [])].forEach(item => {
      if (item.is_hidden) return;
      const original = savedData.find(s => s.item_id === item.id);
      itemMap.set(item.id, { ...item, savedType: original?.item_type });
    });

    const newItems = savedData.map(s => itemMap.get(s.item_id)).filter(Boolean);
    if (fetchOffset === 0) {
      setSavedListings(newItems);
    } else {
      setSavedListings(prev => [...prev, ...newItems]);
    }
    setOffset(fetchOffset + ITEMS_PER_PAGE);
    hasFetched.current = true;
    setIsLoading(false);
    setLoadingMore(false);
  };

  const loadMore = () => {
    if (!userId || loadingMore || !hasMore) return;
    fetchSavedItems(userId, offset);
  };

  const handleRemoveSingle = async (itemId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      // Remove locally
      removeItemLocally(itemId);
      setSavedListings(prev => prev.filter(item => item.id !== itemId));
      toast({ title: "Removed", description: "Item removed from your collection." });
      return;
    }

    if (!userId || deletingRef.current === itemId) return;

    deletingRef.current = itemId;
    setDeletingId(itemId);

    const { error } = await supabase
      .from("saved_items")
      .delete()
      .eq("item_id", itemId)
      .eq("user_id", userId);

    if (!error) {
      setSavedListings(prev => prev.filter(item => item.id !== itemId));
      toast({ title: "Removed", description: "Item removed from your collection." });
    }
    deletingRef.current = null;
    setDeletingId(null);
  };

  // If not logged in and not embedded, show full-page login prompt
  if (!user && !authLoading && !isEmbeddedInSheet) {
    return (
      <div className="min-h-screen pb-24" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
        <Header />
        <div className="container mx-auto px-4 py-12">
          <header className="mb-8">
            <h1 className="text-[28px] font-semibold tracking-tight mb-2" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Saved places</h1>
            <p className="text-[13px]" style={{ color: INK_SOFT }}>Your curated collection of adventures and stays.</p>
          </header>
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[32px]" style={{ border: `1px solid ${HAIRLINE}` }}>
            <div className="p-5 rounded-2xl mb-6" style={{ background: FOREST_SOFT }}>
              <Heart className="h-10 w-10" style={{ color: FOREST }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Sign in to see your saved items</h2>
            <p className="text-sm mb-6 text-center max-w-sm" style={{ color: INK_SOFT }}>Log in or create an account to save your favourite adventures, stays and events.</p>
            {/* Opens the same auth modal used across the app (e.g. the
                bottom nav bar) instead of navigating to a separate /auth
                page — the person never leaves Saved, so once they're
                signed in this view just swaps straight to their real list. */}
            <div className="flex items-center gap-2.5">
              <Button
                onClick={() => openAuthModal("login")}
                variant="outline"
                className="rounded-xl text-sm font-semibold gap-2 px-6 py-3"
                style={{ borderColor: HAIRLINE, color: INK }}
              >
                <LogIn className="h-4 w-4" />
                Log in
              </Button>
              <Button
                onClick={() => openAuthModal("signup")}
                className="rounded-xl text-sm font-semibold gap-2 px-6 py-3 text-white border-none hover:opacity-95"
                style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}
              >
                <UserPlus className="h-4 w-4" />
                Sign up
              </Button>
            </div>
          </div>
        </div>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div
      className={isEmbeddedInSheet ? "min-h-full" : "min-h-screen pb-24"}
      style={{ background: isEmbeddedInSheet ? undefined : CANVAS, fontFamily: FONT_BODY }}
    >
      {!isEmbeddedInSheet && <Header />}

      <div className={isEmbeddedInSheet ? "px-4 py-4" : "container mx-auto px-4 py-12"}>
        {!isEmbeddedInSheet && (
          <header className="mb-8">
            <h1 className="text-[28px] font-semibold tracking-tight mb-2" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Saved places</h1>
            <p className="text-[13px]" style={{ color: INK_SOFT }}>Your curated collection of adventures and stays.</p>
          </header>
        )}

        {/* Login banner for non-logged users (embedded sheet) */}
        {!user && !authLoading && (
          <div className="mb-6 rounded-2xl p-4 flex items-center gap-4" style={{ background: FOREST_SOFT, border: `1px solid ${FOREST}25` }}>
            <div className="p-3 rounded-xl shrink-0" style={{ background: "#ffffffaa" }}>
              <Heart className="h-5 w-5" style={{ color: FOREST }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: INK }}>Sign in to sync your saved items</p>
              <p className="text-[11px] mt-0.5" style={{ color: INK_SOFT }}>Your locally saved items will be synced to your account when you log in.</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                onClick={() => openAuthModal("login")}
                size="sm"
                variant="outline"
                className="rounded-xl text-xs font-semibold"
                style={{ borderColor: `${FOREST}30`, color: FOREST }}
              >
                Log in
              </Button>
              <Button
                onClick={() => openAuthModal("signup")}
                size="sm"
                className="rounded-xl text-xs font-semibold gap-1.5 text-white border-none hover:opacity-95"
                style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign up
              </Button>
            </div>
          </div>
        )}

        <main className="space-y-3">
          {isEmbeddedInSheet && (
            <div className="mb-2 px-1">
              <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>
                Your saved items
              </p>
            </div>
          )}

          {isLoading ? (
            // Show a handful of realistic item-shaped skeletons instead of one
            // big generic block, so the layout the person will actually see
            // is already implied while data is in flight.
            <div className="grid gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <SavedItemSkeleton key={`initial-skeleton-${i}`} />
              ))}
            </div>
          ) : savedListings.length === 0 ? (
            <div className="bg-white rounded-[28px] p-20 text-center" style={{ color: INK_SOFT, border: `1px solid ${HAIRLINE}` }}>
              No items saved yet.
            </div>
          ) : (
            <div className="grid gap-3">
              {savedListings.map((item) => {
                const href = createDetailPath(item.savedType, item.id, item.name, item.location);

                return (
                  <div key={item.id} className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleRemoveSingle(item.id, e)}
                      disabled={deletingId === item.id}
                      className="shrink-0 p-3 rounded-full active:scale-90 transition-all select-none"
                      aria-label="Remove item"
                      style={{
                        background: DANGER_SOFT,
                        color: DANGER,
                        border: `1px solid ${DANGER}25`,
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                        zIndex: 10,
                        position: 'relative',
                  }}
                    >
                      {deletingId === item.id
                        ? <Loader2 size={16} className="animate-spin" />
                        : <Trash2 size={16} />
                      }
                    </button>

                    <a
                      href={href}
                      onClick={(e) => {
                        if (deletingRef.current === item.id) {
                          e.preventDefault();
                        }
                      }}
                      className="flex-1 flex items-center gap-4 bg-white p-3 sm:p-4 rounded-[22px] hover:shadow-md transition-all active:scale-[0.98] min-w-0 group no-underline"
                      style={{
                        border: `1px solid ${HAIRLINE}`,
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                        textDecoration: 'none',
                      }}
                      draggable={false}
                    >
                      <ItemThumbnail src={item.image_url} alt="" />

                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold mb-0.5 capitalize" style={{ color: FOREST }}>
                          {item.savedType?.replace('_', ' ')}
                        </p>
                        <h3 className="text-sm sm:text-base font-semibold truncate" style={{ color: INK }}>
                          {item.name}
                        </h3>
                        <div className="flex items-center text-xs mt-0.5" style={{ color: INK_SOFT }}>
                          <MapPin size={10} className="mr-1 shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </div>
                      </div>

                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center transition-all shrink-0"
                        style={{ background: CANVAS, color: INK_SOFT }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = FOREST; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = CANVAS; e.currentTarget.style.color = INK_SOFT; }}
                      >
                        <ChevronRight size={16} />
                      </div>
                    </a>
                  </div>
                );
              })}

              {/* Skeleton rows for the next page while it loads, appended
                  below the real items so "Load more" never flashes blank. */}
              {loadingMore && (
                <>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SavedItemSkeleton key={`more-skeleton-${i}`} />
                  ))}
                </>
              )}
            </div>
          )}
          {user && hasMore && savedListings.length > 0 && (
            <div className="flex justify-center mt-6">
              <Button
                onClick={loadMore}
                disabled={loadingMore}
                variant="outline"
                className="rounded-2xl font-semibold text-xs h-10 px-6"
                style={{ borderColor: HAIRLINE, color: INK }}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button> 
            </div>
          )}
        </main>
      </div>

      {!isEmbeddedInSheet && <MobileBottomBar />}
    </div>
  );
};

export default Saved;