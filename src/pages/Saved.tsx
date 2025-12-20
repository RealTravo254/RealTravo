import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { ListingCard } from "@/components/ListingCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trash2, CheckCircle, LogIn, Bookmark, ArrowRight } from "lucide-react";
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

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const Saved = () => {
  const [savedListings, setSavedListings] = useState<any[]>([]);
  const { savedItems, handleSave } = useSavedItems();
  const { user, loading: authLoading } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const initializeData = async () => {
      if (authLoading) return;
      const uid = await getUserId();
      if (!uid) {
        setIsLoading(false);
        return;
      }
      setUserId(uid);
      fetchSavedItems(uid);
    };
    initializeData();
  }, [authLoading]);

  useEffect(() => {
    if (userId) fetchSavedItems(userId, 0, 15);
  }, [savedItems, userId]);

  const fetchSavedItems = async (uid: string, offset: number = 0, limit: number = 15) => {
    setIsLoading(true);
    const { data: savedData } = await supabase
      .from("saved_items")
      .select("item_id, item_type")
      .eq("user_id", uid)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (!savedData || savedData.length === 0) {
      setIsLoading(false);
      return [];
    }

    // Group items by type for batch fetching
    const tripIds = savedData.filter(s => s.item_type === "trip" || s.item_type === "event").map(s => s.item_id);
    const hotelIds = savedData.filter(s => s.item_type === "hotel").map(s => s.item_id);
    const adventureIds = savedData.filter(s => s.item_type === "adventure_place").map(s => s.item_id);

    // Fetch all items in parallel with optimized field selection
    const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
      tripIds.length > 0 
        ? supabase.from("trips").select("id,name,location,country,image_url,date,price,available_tickets,type").in("id", tripIds)
        : Promise.resolve({ data: [] }),
      hotelIds.length > 0 
        ? supabase.from("hotels").select("id,name,location,country,image_url").in("id", hotelIds)
        : Promise.resolve({ data: [] }),
      adventureIds.length > 0 
        ? supabase.from("adventure_places").select("id,name,location,country,image_url,entry_fee").in("id", adventureIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Create lookup maps
    const itemMap = new Map<string, any>();
    (tripsRes.data || []).forEach((item: any) => {
      const savedType = savedData.find(s => s.item_id === item.id)?.item_type || "trip";
      itemMap.set(item.id, { ...item, savedType });
    });
    (hotelsRes.data || []).forEach((item: any) => itemMap.set(item.id, { ...item, savedType: "hotel" }));
    (adventuresRes.data || []).forEach((item: any) => itemMap.set(item.id, { ...item, savedType: "adventure_place" }));

    // Preserve order from savedData
    const items = savedData
      .map(saved => itemMap.get(saved.item_id))
      .filter(Boolean);

    if (offset === 0) setSavedListings(items);
    else setSavedListings(prev => [...prev, ...items]);
    
    setIsLoading(false);
    return items;
  };

  const toggleItemSelection = (itemId: string) => {
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
      toast({ title: `Removed ${selectedItems.size} item(s)` });
    }
  };

  const handleClearAll = async () => {
    if (!userId) return;
    const { error } = await supabase.from("saved_items").delete().eq("user_id", userId);
    if (!error) {
      setSavedListings([]);
      setShowClearAllDialog(false);
      toast({ title: "Wishlist cleared" });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      
      <main className="container px-4 py-10 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
               <div className="p-2 rounded-xl bg-[#008080]/10">
                 <Bookmark className="h-5 w-5 text-[#008080]" />
               </div>
               <span className="text-[10px] font-black text-[#FF7F50] uppercase tracking-[0.2em]">Personal Collection</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none text-slate-900">
              Your <span style={{ color: COLORS.TEAL }}>Wishlist</span>
            </h1>
          </div>

          {savedListings.length > 0 && (
            <div className="flex gap-3">
              {!isSelectionMode ? (
                <>
                  <Button
                    variant="outline"
                    className="rounded-2xl border-slate-200 font-black uppercase text-[10px] tracking-widest h-11 px-6 hover:bg-white transition-all"
                    onClick={() => setIsSelectionMode(true)}
                  >
                    Select
                  </Button>
                  <Button
                    className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-11 px-6 shadow-lg transition-all active:scale-95"
                    style={{ background: COLORS.RED, color: 'white' }}
                    onClick={() => setShowClearAllDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="rounded-2xl border-slate-200 font-black uppercase text-[10px] tracking-widest h-11 px-6"
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedItems(new Set());
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-11 px-6 shadow-xl transition-all active:scale-95"
                    style={{ 
                      background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
                      color: 'white'
                    }}
                    onClick={handleRemoveSelected}
                    disabled={selectedItems.size === 0}
                  >
                    Remove ({selectedItems.size})
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        
        {isLoading || authLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-64 w-full rounded-[28px]" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : !user ? (
          <div className="bg-white rounded-[40px] p-12 text-center shadow-sm border border-slate-100 flex flex-col items-center max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
                <LogIn className="h-10 w-10 text-slate-300" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Login Required</h2>
            <p className="text-slate-500 text-sm mb-8 font-medium">Save your favorite spots and experiences to access them anytime.</p>
            <Link to="/auth">
              <Button 
                className="py-7 px-10 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95"
                style={{ background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)` }}
              >
                Sign In to View Wishlist
              </Button>
            </Link>
          </div>
        ) : savedListings.length === 0 ? (
          <div className="bg-white rounded-[40px] p-12 text-center shadow-sm border border-slate-100 flex flex-col items-center max-w-2xl mx-auto">
             <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
                <Bookmark className="h-10 w-10 text-slate-300" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Empty Wishlist</h2>
            <p className="text-slate-500 text-sm mb-8 font-medium">You haven't saved any experiences yet. Start exploring!</p>
            <Link to="/">
              <Button 
                variant="outline"
                className="py-7 px-10 rounded-2xl border-2 border-slate-100 font-black uppercase tracking-[0.2em] hover:bg-slate-50"
              >
                Discover Experiences <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {savedListings.map((item) => (
              <div
                key={item.id}
                className={`relative transition-all duration-300 ${isSelectionMode ? 'cursor-pointer' : ''}`}
                onClick={() => isSelectionMode && toggleItemSelection(item.id)}
              >
                {isSelectionMode && (
                  <div
                    className={`absolute top-4 left-4 z-50 h-8 w-8 rounded-xl border-2 flex items-center justify-center backdrop-blur-md transition-all ${
                      selectedItems.has(item.id)
                        ? "bg-[#008080] border-[#008080]"
                        : "bg-black/20 border-white"
                    }`}
                  >
                    {selectedItems.has(item.id) && (
                      <CheckCircle className="h-5 w-5 text-white" />
                    )}
                  </div>
                )}
                
                {/* Visual overlay when selecting */}
                {isSelectionMode && selectedItems.has(item.id) && (
                    <div className="absolute inset-0 bg-[#008080]/10 z-40 rounded-[32px] pointer-events-none border-2 border-[#008080]" />
                )}

                <ListingCard
                  id={item.id}
                  type={item.savedType.replace("_", " ").toUpperCase() as any}
                  name={item.name || item.local_name || item.location_name}
                  imageUrl={item.image_url || item.photo_urls?.[0] || ""}
                  location={item.location || item.location_name}
                  country={item.country}
                  onSave={() => handleSave(item.id, item.savedType)}
                  isSaved={true}
                  showBadge={true}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent className="rounded-[32px] border-none p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Clear Wishlist?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium">
              This will remove all {savedListings.length} items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-slate-100">Cancel</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleClearAll} 
                className="rounded-xl font-black uppercase text-[10px] tracking-widest bg-red-500 hover:bg-red-600"
            >
              Confirm Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default Saved;