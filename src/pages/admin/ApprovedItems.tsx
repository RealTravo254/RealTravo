import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useLocation, useNavigate } from "react-router-dom";
import { Trash2, MapPin, ChevronRight, Loader2, LogIn, Heart } from "lucide-react";
import { createDetailPath } from "@/lib/slugUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";
import { getLocalSavedItems, removeItemLocally } from "@/hooks/useLocalSavedItems";

const ITEMS_PER_PAGE = 20;

const Saved = () => {
  const [savedListings, setSavedListings] = useState<any[]>([]);
  const { savedItems } = useSavedItems();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
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
      tripIds.length > 0
        ? supabase
            .from("trips")
            .select("id,name,location,image_url,is_hidden,type,approval_status")
            .in("id", tripIds)
        : { data: [] },
      hotelIds.length > 0
        ? supabase
            .from("hotels")
            .select("id,name,location,image_url,is_hidden,approval_status")
            .in("id", hotelIds)
        : { data: [] },
      adventureIds.length > 0
        ? supabase
            .from("adventure_places")
            .select("id,name,location,image_url,is_hidden,approval_status")
            .in("id", adventureIds)
        : { data: [] },
    ]);

    const itemMap = new Map();
    [...(tripsRes.data || []), ...(hotelsRes.data || []), ...(adventuresRes.data || [])].forEach(item => {
      // Exclude hidden items and items that are not approved (e.g. rejected or pending)
      if (item.is_hidden) return;
      if (item.approval_status && item.approval_status !== "approved") return;
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
      tripIds.length > 0
        ? supabase
            .from("trips")
            .select("id,name,location,image_url,is_hidden,type,approval_status")
            .in("id", tripIds)
        : { data: [] },
      hotelIds.length > 0
        ? supabase
            .from("hotels")
            .select("id,name,location,image_url,is_hidden,approval_status")
            .in("id", hotelIds)
        : { data: [] },
      adventureIds.length > 0
        ? supabase
            .from("adventure_places")
            .select("id,name,location,image_url,is_hidden,approval_status")
            .in("id", adventureIds)
        : { data: [] },
    ]);

    const itemMap = new Map();
    [...(tripsRes.data || []), ...(hotelsRes.data || []), ...(adventuresRes.data || [])].forEach(item => {
      // Exclude hidden items and items that are not approved (e.g. rejected or pending)
      if (item.is_hidden) return;
      if (item.approval_status && item.approval_status !== "approved") return;
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
      <div className="min-h-screen bg-[#F4F7FA] pb-24 font-sans">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Saved Places</h1>
            <p className="text-muted-foreground text-sm">Your curated collection of adventures and stays.</p>
          </header>
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100">
            <div className="p-5 rounded-2xl bg-primary/10 mb-6">
              <Heart className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Sign in to see your saved items</h2>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">Log in or create an account to save your favourite adventures, stays and events.</p>
            <Button
              onClick={() => navigate('/auth')}
              className="rounded-xl text-sm font-bold gap-2 px-8 py-3"
            >
              <LogIn className="h-4 w-4" />
              Log In / Sign Up
            </Button>
          </div>
        </div>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className={isEmbeddedInSheet ? "min-h-full bg-background" : "min-h-screen bg-[#F4F7FA] pb-24 font-sans"}>
      {!isEmbeddedInSheet && <Header />}

      <div className={isEmbeddedInSheet ? "px-4 py-4" : "container mx-auto px-4 py-12"}>
        {!isEmbeddedInSheet && (
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Saved Places</h1>
            <p className="text-muted-foreground text-sm">Your curated collection of adventures and stays.</p>
          </header>
        )}

        {/* Login banner for non-logged users (embedded sheet) */}
        {!user && !authLoading && (
          <div className="mb-6 bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 shrink-0">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Sign in to sync your saved items</p>
              <p className="text-xs text-muted-foreground mt-0.5">Your locally saved items will be synced to your account when you log in.</p>
            </div>
            <Button
              onClick={() => navigate('/auth')}
              size="sm"
              className="shrink-0 rounded-xl text-xs font-bold gap-1.5"
            >
              <LogIn className="h-3.5 w-3.5" />
              Log In
            </Button>
          </div>
        )}

        <main className={isEmbeddedInSheet ? "space-y-3" : "space-y-3"}>
          {isEmbeddedInSheet && (
            <div className="mb-2 px-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Your Saved Items
              </p>
            </div>
          )}

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-[32px]" />
          ) : savedListings.length === 0 ? (
            <div className="bg-white rounded-[40px] p-20 text-center text-slate-400 border border-slate-100">
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
                      className="shrink-0 p-3 rounded-full bg-red-50 text-red-500 active:bg-red-100 active:scale-90 transition-all border border-red-100 select-none"
                      aria-label="Remove item"
                      style={{
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
                      className="flex-1 flex items-center gap-4 bg-white p-3 sm:p-4 rounded-[24px] border border-slate-100 hover:shadow-md transition-all active:scale-[0.98] min-w-0 group no-underline"
                      style={{
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                        textDecoration: 'none',
                      }}
                      draggable={false}
                    >
                      <img
                        src={item.image_url}
                        className="h-16 w-16 rounded-xl object-cover shrink-0"
                        alt=""
                        draggable={false}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold text-[#007AFF] uppercase mb-0.5">
                          {item.savedType?.replace('_', ' ')}
                        </p>
                        <h3 className="text-sm sm:text-base font-bold text-slate-800 truncate">
                          {item.name}
                        </h3>
                        <div className="flex items-center text-slate-400 text-xs mt-0.5">
                          <MapPin size={10} className="mr-1 shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </div>
                      </div>

                      <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-[#007AFF] group-hover:text-white transition-all shrink-0">
                        <ChevronRight size={16} />
                      </div>
                    </a>
                  </div>
                );
              })}
            </div>
          )}
          {user && hasMore && savedListings.length > 0 && (
            <div className="flex justify-center mt-6">
              <Button
                onClick={loadMore}
                disabled={loadingMore}
                variant="outline"
                className="rounded-2xl font-bold text-xs h-10 px-6"
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
        </main>
      </div>

      {!isEmbeddedInSheet && (
        <>
          <Footer />
          <MobileBottomBar />
        </>
      )}
    </div>
  );
};

export default Saved;