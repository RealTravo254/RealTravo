import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { CategoryCard } from "@/components/CategoryCard";
import { SearchBar } from "@/components/SearchBar";
import { ListingCard } from "@/components/ListingCard";
import { Footer } from "@/components/Footer";
import { Calendar, Hotel, Mountain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [trips, setTrips] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [adventurePlaces, setAdventurePlaces] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const sessionId = localStorage.getItem("sessionId") || (() => {
    const newId = Math.random().toString(36).substring(7);
    localStorage.setItem("sessionId", newId);
    return newId;
  })();

  useEffect(() => {
    fetchAllData();
    fetchSavedItems();
  }, []);

  const fetchAllData = async () => {
    const [tripsData, eventsData, hotelsData, adventurePlacesData] = await Promise.all([
      supabase.from("trips").select("*").limit(6),
      supabase.from("events").select("*").limit(6),
      supabase.from("hotels").select("*").limit(6),
      supabase.from("adventure_places").select("*").limit(6),
    ]);

    if (tripsData.data) setTrips(tripsData.data);
    if (eventsData.data) setEvents(eventsData.data);
    if (hotelsData.data) setHotels(hotelsData.data);
    if (adventurePlacesData.data) setAdventurePlaces(adventurePlacesData.data);
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
    if (!searchQuery.trim()) {
      fetchAllData();
      return;
    }

    const query = `%${searchQuery.toLowerCase()}%`;
    
    const [tripsData, eventsData, hotelsData, adventurePlacesData] = await Promise.all([
      supabase.from("trips").select("*").or(`name.ilike.${query},location.ilike.${query},country.ilike.${query},place.ilike.${query}`),
      supabase.from("events").select("*").or(`name.ilike.${query},location.ilike.${query},country.ilike.${query},place.ilike.${query}`),
      supabase.from("hotels").select("*").or(`name.ilike.${query},location.ilike.${query},country.ilike.${query},place.ilike.${query}`),
      supabase.from("adventure_places").select("*").or(`name.ilike.${query},location.ilike.${query},country.ilike.${query},place.ilike.${query}`),
    ]);

    if (tripsData.data) setTrips(tripsData.data);
    if (eventsData.data) setEvents(eventsData.data);
    if (hotelsData.data) setHotels(hotelsData.data);
    if (adventurePlacesData.data) setAdventurePlaces(adventurePlacesData.data);
  };

  const handleSave = async (itemId: string, itemType: string) => {
    const isSaved = savedItems.has(itemId);
    
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
        .insert({ item_id: itemId, item_type: itemType, session_id: sessionId });
      
      if (!error) {
        setSavedItems(prev => new Set([...prev, itemId]));
        toast({ title: "Added to saved!" });
      }
    }
  };

  const categories = [
    {
      icon: Calendar,
      title: "Events & Trips",
      description: "Discover exciting experiences",
      path: "/category/trips",
    },
    {
      icon: Hotel,
      title: "Hotels & Accommodation",
      description: "Find your perfect stay",
      path: "/category/hotels",
    },
    {
      icon: Mountain,
      title: "Adventure Places",
      description: "Explore thrilling destinations",
      path: "/category/adventure",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-8 space-y-12">
        {/* Search */}
        <section>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={handleSearch}
          />
        </section>

        {/* Categories */}
        <section>
          <h2 className="text-3xl font-bold mb-6 text-center md:block hidden">What are you looking for?</h2>
          <div className="grid grid-cols-3 md:grid-cols-3 gap-3 md:gap-6">
            {categories.map((category) => (
              <CategoryCard
                key={category.title}
                icon={category.icon}
                title={category.title}
                description={category.description}
                onClick={() => navigate(category.path)}
                className="md:p-6"
              />
            ))}
          </div>
        </section>

        {/* Trips */}
        {trips.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Featured Trips</h2>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {trips.map((trip) => (
                <ListingCard
                  key={trip.id}
                  id={trip.id}
                  type="TRIP"
                  name={trip.name}
                  imageUrl={trip.image_url}
                  location={trip.location}
                  country={trip.country}
                  price={trip.price}
                  date={trip.date}
                  onSave={handleSave}
                  isSaved={savedItems.has(trip.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Events */}
        {events.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Upcoming Events</h2>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {events.map((event) => (
                <ListingCard
                  key={event.id}
                  id={event.id}
                  type="EVENT"
                  name={event.name}
                  imageUrl={event.image_url}
                  location={event.location}
                  country={event.country}
                  price={event.price}
                  date={event.date}
                  onSave={handleSave}
                  isSaved={savedItems.has(event.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Hotels */}
        {hotels.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Amazing Hotels</h2>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {hotels.map((hotel) => (
                <ListingCard
                  key={hotel.id}
                  id={hotel.id}
                  type="HOTEL"
                  name={hotel.name}
                  imageUrl={hotel.image_url}
                  location={hotel.location}
                  country={hotel.country}
                  onSave={handleSave}
                  isSaved={savedItems.has(hotel.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Adventure Places */}
        {adventurePlaces.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Adventure Awaits</h2>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {adventurePlaces.map((place) => (
                <ListingCard
                  key={place.id}
                  id={place.id}
                  type="ADVENTURE PLACE"
                  name={place.name}
                  imageUrl={place.image_url}
                  location={place.location}
                  country={place.country}
                  onSave={handleSave}
                  isSaved={savedItems.has(place.id)}
                />
              ))}
            </div>
          </section>
        )}

      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default Index;
