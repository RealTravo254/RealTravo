import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Footer } from "@/components/Footer";
import { ListingCard } from "@/components/ListingCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trash2, CheckCircle } from "lucide-react";
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

const Saved = () => {
  const [savedListings, setSavedListings] = useState<any[]>([]);
  const { savedItems } = useSavedItems();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const initializeData = async () => {
      const uid = await getUserId();
      if (!uid) {
        toast({
          title: "Login required",
          description: "Please log in to view saved items",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }
      setUserId(uid);
      fetchSavedItems(uid);
    };
    initializeData();
  }, []);

  // Refetch when savedItems changes (realtime updates)
  useEffect(() => {
    if (userId) {
      fetchSavedItems(userId);
    }
  }, [savedItems, userId]);

  const fetchSavedItems = async (uid: string) => {
    setIsLoading(true);
    const { data: savedData } = await supabase
      .from("saved_items")
      .select("*")
      .eq("user_id", uid);

    if (!savedData) {
      setIsLoading(false);
      return;
    }

    const items: any[] = [];
    
    for (const saved of savedData) {
      const tableName = saved.item_type === "adventure_place" ? "adventure_places" : `${saved.item_type}s`;
      const { data } = await supabase
        .from(tableName as any)
        .select("*")
        .eq("id", saved.item_id)
        .maybeSingle();
      
      if (data && typeof data === 'object') {
        items.push(Object.assign({}, data, { savedType: saved.item_type }));
      }
    }

    setSavedListings(items);
    setIsLoading(false);
  };

  const handleUnsave = async (itemId: string) => {
    if (!userId) return;
    
    const { error } = await supabase
      .from("saved_items")
      .delete()
      .eq("item_id", itemId)
      .eq("user_id", userId);

    if (!error) {
      setSavedListings(prev => prev.filter(item => item.id !== itemId));
      toast({ title: "Removed from saved" });
    }
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
          <h1 className="text-3xl font-bold">Saved Items</h1>
          
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
        
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : savedListings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">No saved items yet</p>
            <p className="text-muted-foreground mt-2">Start exploring and save your favorites!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
                  name={item.name}
                  imageUrl={item.image_url}
                  location={item.location}
                  country={item.country}
                  price={item.price}
                  date={item.date}
                  onSave={handleUnsave}
                  isSaved={true}
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
