import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trash2, Bookmark, MapPin, ChevronRight, Loader2, Check } from "lucide-react";
import { createDetailPath } from "@/lib/slugUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";

const ITEMS_PER_PAGE = 20;

const Saved = () => {
  const [savedListings, setSavedListings] = useState<any[]>([]);
  const { savedItems } = useSavedItems();
  const { user, loading: authLoading } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const { toast } = useToast();
  const hasFetched = useRef(false);
  const location = useLocation();
  const isEmbeddedInSheet = location.pathname !== "/saved";

  useEffect(() => {
    const initializeData = async () => {
      if (authLoading) return;
      const uid = await getUserId();
      if (!uid) {
        setIsLoading(false);
        return;
      }
      setUserId(uid);
      fetchSavedItems(uid, 0);
    };
    initializeData();
  }, [authLoading]);

  useEffect(() => {
    if (userId && hasFetched.current) {
      fetchSavedItems(userId, 0);
    }
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
      setHasMore(false);
      setIsLoading(false);
      setLoadingMore(false);
      return [];
    }

    const tripIds = savedData.filter(s => s.item_type === "trip" || s.item_type === "event").map(s => s.item_id);
    const hotelIds = savedData.filter(s => s.item_type === "hotel").map(s => s.item_id);
    const adventureIds = savedData.filter(s => s.item_type === "adventure_place" || s.item_type === "attraction").map(s => s.item_id);

    const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
      tripIds.length > 0 
        ? supabase.from("trips").select("id,name,location,country,image_url,is_hidden,type").in("id", tripIds)
        : Promise.resolve({ data: [] }),
      hotelIds.length > 0 
        ? supabase.from("hotels").select("id,name,location,country,image_url,is_hidden").in("id", hotelIds)
        : Promise.resolve({ data: [] }),
      adventureIds.length > 0 
        ? supabase.from("adventure_places").select("id,name,location,country,image_url,is_hidden").in("id", adventureIds)
        : Promise.resolve({ data: [] }),
    ]);

    const itemMap = new Map<string, any>();
    (tripsRes.data || []).forEach((item: any) => {
      if (item.is_hidden) return;
      // Use actual type from DB (trip or event)
      const savedType = item.type === "event" ? "event" : "trip";
      itemMap.set(item.id, { ...item, savedType });
    });
    (hotelsRes.data || []).forEach((item: any) => {
      if (item.is_hidden) return;
      itemMap.set(item.id, { ...item, savedType: "hotel" });
    });
    (adventuresRes.data || []).forEach((item: any) => {
      if (item.is_hidden) return;
      // Check original saved type for attraction vs adventure
      const originalSaved = savedData.find(s => s.item_id === item.id);
      const savedType = originalSaved?.item_type === "attraction" ? "attraction" : "adventure";
      itemMap.set(item.id, { ...item, savedType });
    });

    const items = savedData
      .map(saved => itemMap.get(saved.item_id))
      .filter(item => item && item.name);

    if (fetchOffset === 0) {
      setSavedListings(items);
      hasFetched.current = true;
    } else {
      setSavedListings(prev => [...prev, ...items]);
    }
    
    setOffset(fetchOffset + ITEMS_PER_PAGE);
    setHasMore(savedData.length >= ITEMS_PER_PAGE);
    setIsLoading(false);
    setLoadingMore(false);
    return items;
  };

  const toggleItemSelection = (itemId: string, e: React.MouseEvent) => {
    e.preventDefault(); // Stop Link from navigating
    e.stopPropagation();
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      return newSet;
    });
  };

  const handleRemoveSelected = async () => {
    if (!userId || selectedItems.size === 0) return;
    const { error } = await supabase.from("saved_items").delete().in("item_id", Array.from(selectedItems)).eq("user_id", userId);
    if (!error) {
      setSavedListings(prev => prev.filter(item => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
      setIsSelectionMode(false);
      toast({ title: "Updated", description: "Removed selected items." });
    }
  };

  return (
    <div className={isEmbeddedInSheet ? "min-h-full bg-background" : "min-h-screen bg-[#F4F7FA] pb-24 font-sans"}>
      {!isEmbeddedInSheet && <Header />}
      
      <div className={isEmbeddedInSheet
        ? "max-w-[1200px] mx-auto px-4 py-4"
        : "max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 py-12"
      }>
        {!isEmbeddedInSheet && (
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Saved Places</h1>
              <p className="text-slate-500 text-sm mb-6">Manage your curated travel list.</p>
              <div className="flex flex-col gap-2">
                <Button 
                  variant={isSelectionMode ? "default" : "outline"}
                  className={`rounded-2xl font-bold text-xs uppercase tracking-widest ${isSelectionMode ? 'bg-slate-900' : 'border-slate-100'}`}
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    setSelectedItems(new Set());
                  }}
                >
                  {isSelectionMode ? "Cancel" : "Select Items"}
                </Button>
                {isSelectionMode && selectedItems.size > 0 && (
                  <Button variant="destructive" className="rounded-2xl text-xs font-bold uppercase" onClick={handleRemoveSelected}>
                    Remove ({selectedItems.size})
                  </Button>
                )}
              </div>
            </div>
          </aside>
        )}

        <main className={isEmbeddedInSheet ? "space-y-3" : "lg:col-span-8 space-y-3"}>
          {isEmbeddedInSheet && (
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-card p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">Saved Items</p>
              <Button 
                variant={isSelectionMode ? "default" : "outline"}
                size="sm"
                className="rounded-xl text-[10px] font-bold uppercase"
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedItems(new Set());
                }}
              >
                {isSelectionMode ? "Cancel" : "Select"}
              </Button>
            </div>
          )}

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-[32px]" />
          ) : savedListings.length === 0 ? (
            <div className="bg-white rounded-[40px] p-20 text-center text-slate-400 border border-slate-100">
              No items in your collection.
            </div>
          ) : (
            savedListings.map((item) => {
              const isSelected = selectedItems.has(item.id);
              const cardClassName = `group relative bg-white p-4 rounded-[28px] border transition-all flex items-center gap-5 ${
                isSelected ? "border-[#007AFF] bg-blue-50/20" : "border-slate-100 hover:shadow-md"
              }`;

              const cardInner = (
                <>
                  {isSelectionMode && (
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                        isSelected ? "bg-[#007AFF] border-[#007AFF]" : "border-slate-200 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={4} />}
                    </div>
                  )}

                  <img src={item.image_url} className="h-20 w-20 rounded-2xl object-cover shrink-0" alt="" />

                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-[#007AFF] uppercase mb-1">{item.savedType.replace('_', ' ')}</p>
                    <h3 className="text-lg font-bold text-slate-800 truncate">{item.name}</h3>
                    <div className="flex items-center text-slate-400 text-xs mt-1">
                      <MapPin size={12} className="mr-1" />
                      <span className="truncate">{item.location}</span>
                    </div>
                  </div>

                  <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-[#007AFF] group-hover:text-white transition-all">
                    <ChevronRight size={18} />
                  </div>
                </>
              );

              return isSelectionMode ? (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => toggleItemSelection(item.id, e)}
                  className={cardClassName + " w-full text-left"}
                >
                  {cardInner}
                </button>
              ) : (
                <Link
                  key={item.id}
                  to={createDetailPath(item.savedType, item.id, item.name, item.location)}
                  className={cardClassName}
                >
                  {cardInner}
                </Link>
              );
            })
          )}

          {isSelectionMode && selectedItems.size > 0 && (
            <Button variant="destructive" className="w-full rounded-xl text-xs font-bold uppercase" onClick={handleRemoveSelected}>
              Remove ({selectedItems.size})
            </Button>
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