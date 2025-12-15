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
import { Trash2, CheckCircle, LogIn } from "lucide-react";
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
      // Wait for auth to finish loading
      if (authLoading) return;
      
      const uid = await getUserId();
      if (!uid) {
        // User not logged in - show empty state with login prompt
        setIsLoading(false);
        return;
      }
      setUserId(uid);
      fetchSavedItems(uid);
    };
    initializeData();
  }, [authLoading]);

  // Refetch when savedItems changes (realtime updates)
  useEffect(() => {
    if (userId) {
      fetchSavedItems(userId, 0, 15);
    }
  }, [savedItems, userId]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isLoading) return;
      
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;
      
      if (scrollTop + clientHeight >= scrollHeight - 500 && userId) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, savedListings.length, userId]);

  const loadMore = async () => {
    if (isLoading || !userId) return;
    
    const moreData = await fetchSavedItems(userId, savedListings.length, 20);
    if (moreData.length === 0) {
      // No more items to load
    }
  };

  const fetchSavedItems = async (uid: string, offset: number = 0, limit: number = 15) => {
    setIsLoading(true);
    const { data: savedData } = await supabase
      .from("saved_items")
      .select("*")
      .eq("user_id", uid)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (!savedData) {
      setIsLoading(false);
      return [];
    }

    const items: any[] = [];
    
    for (const saved of savedData) {
      let tableName: string;
      
      // Map item types to correct table names
      if (saved.item_type === "adventure_place") {
        tableName = "adventure_places";
      } else if (saved.item_type === "event" || saved.item_type === "trip") {
        // Both events and trips are stored in the trips table
        tableName = "trips";
      } else if (saved.item_type === "hotel") {
        tableName = "hotels";
      } else if (saved.item_type === "attraction") {
        tableName = "attractions";
      } else {
        // Fallback: try adding 's' to the type
        tableName = `${saved.item_type}s`;
      }
      
      const { data } = await supabase
        .from(tableName as any)
        .select("*")
        .eq("id", saved.item_id)
        .maybeSingle();
      
      if (data && typeof data === 'object') {
        items.push(Object.assign({}, data, { savedType: saved.item_type }));
      }
    }

    if (offset === 0) {
      setSavedListings(items);
    } else {
      setSavedListings(prev => [...prev, ...items]);
    }
    
    setIsLoading(false);
    return items;
  };


  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleRemoveSelected = async () => {
    if (!userId || selectedItems.size === 0) return;

    const { error } = await supabase
      .from("saved_items")
      .delete()
      .in("item_id", Array.from(selectedItems))
      .eq("user_id", userId);

    if (!error) {
      setSavedListings(prev => prev.filter(item => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
      setIsSelectionMode(false);
      toast({ title: `Removed ${selectedItems.size} item(s) from saved` });
    }
  };

  const handleClearAll = async () => {
    if (!userId) return;

    const { error } = await supabase
      .from("saved_items")
      .delete()
      .eq("user_id", userId);

    if (!error) {
      setSavedListings([]);
      setShowClearAllDialog(false);
      toast({ title: "All saved items cleared" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-8">
        <div className="flex items-center justify-between mb-8">          
          {savedListings.length > 0 && (
            <div className="flex gap-2">
              {!isSelectionMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSelectionMode(true)}
                  >
                    Select Items
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowClearAllDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedItems(new Set());
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveSelected}
                    disabled={selectedItems.size === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove ({selectedItems.size})
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        
        {isLoading || authLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : !user ? (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">No saved items</p>
            <p className="text-muted-foreground mt-2 mb-6">Log in to see your saved items</p>
            <Link to="/auth">
              <Button className="gap-2">
                <LogIn className="h-4 w-4" />
                Log in
              </Button>
            </Link>
          </div>
        ) : savedListings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">No saved items yet</p>
            <p className="text-muted-foreground mt-2">Start exploring and save your favorites!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {savedListings.map((item) => (
              <div
                key={item.id}
                className="relative"
                onClick={() => isSelectionMode && toggleItemSelection(item.id)}
              >
                {isSelectionMode && (
                  <div
                    className={`absolute top-2 left-2 z-10 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedItems.has(item.id)
                        ? "bg-primary border-primary"
                        : "bg-background border-muted-foreground"
                    }`}
                  >
                    {selectedItems.has(item.id) && (
                      <CheckCircle className="h-5 w-5 text-primary-foreground" />
                    )}
                  </div>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all saved items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {savedListings.length} item(s) from your saved list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear All
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
