import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Footer } from "@/components/Footer";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";
import { FilterBar } from "@/components/FilterBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CategoryDetail = () => {
  const { category } = useParams<{ category: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const sessionId = localStorage.getItem("sessionId") || (() => {
    const newId = Math.random().toString(36).substring(7);
    localStorage.setItem("sessionId", newId);
    return newId;
  })();

  const categoryConfig: {
    [key: string]: {
      title: string;
      tables: string[];
      type: string;
    };
  } = {
    trips: {
      title: "Trips & Events",
      tables: ["trips", "events"],
      type: "TRIP"
    },
    events: {
      title: "Events",
      tables: ["events"],
      type: "EVENT"
    },
    hotels: {
      title: "Hotels & Accommodation",
      tables: ["hotels"],
      type: "HOTEL"
    },
    adventure: {
      title: "Adventure Places",
      tables: ["adventure_places"],
      type: "ADVENTURE PLACE"
    }
  };

  const config = category ? categoryConfig[category] : null;

  useEffect(() => {
    fetchData();
    fetchSavedItems();
  }, [category]);

  useEffect(() => {
    setFilteredItems(items);
  }, [items]);

  const fetchData = async () => {
    if (!config) return;

    const allData: any[] = [];
    
    for (const table of config.tables) {
      const { data } = await supabase
        .from(table as any)
        .select("*")
        .limit(20);
      
      if (data && Array.isArray(data)) {
        allData.push(...data.map((item: any) => ({ ...item, table })));
      }
    }
    
    setItems(allData);
  };

  const fetchSavedItems = async () => {
    const { data } = await supabase
      .from("saved_items")
      .select("item_id")
      .eq("session_id", sessionId);
    
    if (data) {
      setSavedItems(new Set(data.map(item => item.item_id)));
    }
  };

  const handleSearch = async () => {
    if (!config || !searchQuery.trim()) {
      fetchData();
      return;
    }

    // Sanitize search query to prevent SQL injection
    const sanitizedQuery = searchQuery.toLowerCase().replace(/[%_]/g, '\\$&');
    const query = `%${sanitizedQuery}%`;
    const allData: any[] = [];
    
    for (const table of config.tables) {
      const { data } = await supabase
        .from(table as any)
        .select("*")
        .or(`name.ilike.${query},location.ilike.${query},country.ilike.${query},place.ilike.${query}`);
      
      if (data && Array.isArray(data)) {
        allData.push(...data.map((item: any) => ({ ...item, table })));
      }
    }
    
    setItems(allData);
  };

  const handleSave = async (itemId: string, itemType: string) => {
    const isSaved = savedItems.has(itemId);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (isSaved) {
      const { error } = await supabase
        .from("saved_items")
        .delete()
        .eq("item_id", itemId)
        .eq("session_id", sessionId);
      
      if (!error) {
        setSavedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
        toast({ title: "Removed from saved" });
      }
    } else {
      const { error } = await supabase
        .from("saved_items")
        .insert({ item_id: itemId, item_type: itemType, session_id: sessionId, user_id: user?.id || null });
      
      if (!error) {
        setSavedItems(prev => new Set([...prev, itemId]));
        toast({ title: "Added to saved!" });
      }
    }
  };

  const handleApplyFilters = (filters: any) => {
    let filtered = [...items];

    if (filters.location) {
      const locationQuery = filters.location.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.location?.toLowerCase().includes(locationQuery) ||
          item.country?.toLowerCase().includes(locationQuery) ||
          item.place?.toLowerCase().includes(locationQuery)
      );
    }

    if (filters.dateFrom && filters.dateTo) {
      filtered = filtered.filter((item) => {
        if (!item.date) return false;
        const itemDate = new Date(item.date);
        return itemDate >= filters.dateFrom && itemDate <= filters.dateTo;
      });
    }

    if (filters.minPrice !== undefined) {
      filtered = filtered.filter((item) => item.price >= filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter((item) => item.price <= filters.maxPrice);
    }

    setFilteredItems(filtered);
  };

  if (!config) {
    return <div>Category not found</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-8 space-y-4">
        <h1 className="text-3xl font-bold">{config.title}</h1>

        <SearchBarWithSuggestions
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={handleSearch}
        />

        <FilterBar
          type={
            category === "trips" || category === "events"
              ? "trips-events"
              : category === "hotels"
              ? "hotels"
              : "adventure"
          }
          onApplyFilters={handleApplyFilters}
        />

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredItems.map((item) => (
            <ListingCard
              key={item.id}
              id={item.id}
              type={item.table === "trips" ? "TRIP" : item.table === "events" ? "EVENT" : item.table === "hotels" ? "HOTEL" : "ADVENTURE PLACE"}
              name={item.name}
              imageUrl={item.image_url}
              location={item.location}
              country={item.country}
              price={item.price}
              date={item.date}
              onSave={handleSave}
              isSaved={savedItems.has(item.id)}
              amenities={item.amenities}
            />
          ))}
        </div>

        {filteredItems.length === 0 && items.length > 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No items match your filters. Try adjusting the criteria.</p>
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No items found. Try a different search.</p>
          </div>
        )}
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default CategoryDetail;