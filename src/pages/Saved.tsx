import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Footer } from "@/components/Footer";
import { ListingCard } from "@/components/ListingCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Saved = () => {
  const [savedListings, setSavedListings] = useState<any[]>([]);
  const { toast } = useToast();

  const sessionId = localStorage.getItem("sessionId") || "";

  useEffect(() => {
    fetchSavedItems();
  }, []);

  const fetchSavedItems = async () => {
    const { data: savedData } = await supabase
      .from("saved_items")
      .select("*")
      .eq("session_id", sessionId);

    if (!savedData) return;

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
  };

  const handleUnsave = async (itemId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("saved_items")
      .delete()
      .eq("item_id", itemId)
      .eq("session_id", sessionId);

    if (!error) {
      setSavedListings(prev => prev.filter(item => item.id !== itemId));
      toast({ title: "Removed from saved" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Saved Items</h1>
        
        {savedListings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">No saved items yet</p>
            <p className="text-muted-foreground mt-2">Start exploring and save your favorites!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedListings.map((item) => (
              <ListingCard
                key={item.id}
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
            ))}
          </div>
        )}
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default Saved;
