import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { CategoryCard } from "@/components/CategoryCard";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
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
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
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
    setLoading(false);
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

    // Sanitize search query to prevent SQL injection
    const sanitizedQuery = searchQuery.toLowerCase().replace(/[%_]/g, '\\$&');
    const query = `%${sanitizedQuery}%`;

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

  // NEW FUNCTION: Format date to show month as letters (e.g., Dec 25)
  const formatDateToMonthDay = (dateString: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      // Options for short month (e.g., Jan) and numeric day (e.g., 25)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateString; // Return original if parsing fails
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

      <main className="container px-4 py-8 space-y-8 md:space-y-12"> {/* Reduced vertical space on mobile */}
        {/* Search */}
        <section>
          <SearchBarWithSuggestions
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={handleSearch}
          />
        </section>

        {/* Categories */}
        <section>
          <h2 className="text-3xl font-bold mb-6 text-center md:block hidden">What are you looking for?</h2>
          <div className="grid grid-cols-3 md:grid-cols-3 gap-3 md:gap-6"> {/* Reduced gap on mobile */}
            {categories.map((category) => (
              <CategoryCard
                key={category.title}
                icon={category.icon}
                title={category.title}
                description={category.description}
                onClick={() => navigate(category.path)}
                className="p-3 md:p-6" // Reduced padding on mobile
              />
            ))}
          </div>
        </section>

        {/* COMBINED LISTINGS: Trips, Events, Hotels, and Adventure Places */}
<section>
  <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6"> {/* Significantly reduced gap on small screens (mobile) */}
    {loading ? (
      // Display shimmer loading effect if loading
      <>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="group relative rounded-xl overflow-hidden shadow-lg border-2 border-transparent transition-all duration-300 hover:shadow-xl"
          >
            <div className="aspect-[4/3] bg-muted animate-pulse" />
            <div className="p-2 md:p-4 space-y-2 md:space-y-3"> {/* Reduced padding and space on mobile */}
              <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
              <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
              <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
              {/* Price/Date placeholder for Trips/Events */}
              <div className="h-4 bg-muted animate-pulse rounded w-1/3 mt-1" />
            </div>
          </div>
        ))}
      </>
    ) : (
      // Display all listings: Trips, then Events, then Hotels, then Adventure Places
      <>
        {/* Trips */}
        {trips.map((trip) => (
          <div
            key={trip.id}
            className="group relative rounded-xl overflow-hidden shadow-sm cursor-pointer border border-gray-100 transition-all duration-300 hover:shadow-lg hover:scale-[1.01]" // Reduced shadow and scale for tighter fit
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <ListingCard
                id={trip.id}
                type="TRIP"
                name={trip.name}
                imageUrl={trip.image_url}
                location={trip.location}
                country={trip.country}
                // Setting smallScreenStyles to true to trigger the save button background change
                smallScreenStyles={true} 
                onSave={handleSave}
                isSaved={savedItems.has(trip.id)}
              />
              {/* NEW: Price and Date Overlay */}
              {(trip.price || trip.date) && (
                <div className="absolute bottom-2 right-2 z-10">
                  <div className="flex items-center space-x-1.5 text-white **font-bold** text-xs md:text-sm bg-black/40 px-2 py-1 rounded-full backdrop-blur-[2px]">
                    {trip.price && (
                      <span>{`$${trip.price}`}</span>
                    )}
                    {trip.date && (
                      <span className="text-right">
                        {formatDateToMonthDay(trip.date)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Location and Name (Unchanged) */}
            <div className="p-2 bg-white"> 
              <h3 className="text-sm font-bold text-gray-800 line-clamp-1 group-hover:text-primary transition-colors duration-200"> 
                {trip.name}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center mt-0.5"> 
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3 mr-0.5 opacity-70" 
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                {`${trip.location}, ${trip.country}`}
              </p>
              {/* Old Price and Date section REMOVED */}
            </div>
          </div>
        ))}

        {/* Events */}
        {events.map((event) => (
          <div
            key={event.id}
            className="group relative rounded-xl overflow-hidden shadow-sm cursor-pointer border border-gray-100 transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <ListingCard
                id={event.id}
                type="EVENT"
                name={event.name}
                imageUrl={event.image_url}
                location={event.location}
                country={event.country}
                smallScreenStyles={true} // Setting smallScreenStyles to true
                onSave={handleSave}
                isSaved={savedItems.has(event.id)}
              />
              {/* NEW: Price and Date Overlay */}
              {(event.price || event.date) && (
                <div className="absolute bottom-2 right-2 z-10">
                  <div className="flex items-center space-x-1.5 text-white **font-bold** text-xs md:text-sm bg-black/40 px-2 py-1 rounded-full backdrop-blur-[2px]">
                    {event.price && (
                      <span>{`$${event.price}`}</span>
                    )}
                    {event.date && (
                      <span className="text-right">
                        {formatDateToMonthDay(event.date)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Location and Name (Unchanged) */}
            <div className="p-2 bg-white">
              <h3 className="text-sm font-bold text-gray-800 line-clamp-1 group-hover:text-primary transition-colors duration-200">
                {event.name}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center mt-0.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3 mr-0.5 opacity-70"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                {`${event.location}, ${event.country}`}
              </p>
              {/* Old Price and Date section REMOVED */}
            </div>
          </div>
        ))}

        {/* Hotels */}
        {hotels.map((hotel) => (
          <div
            key={hotel.id}
            className="group relative rounded-xl overflow-hidden shadow-sm cursor-pointer border border-gray-100 transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <ListingCard
                id={hotel.id}
                type="HOTEL"
                name={hotel.name}
                imageUrl={hotel.image_url}
                location={hotel.location}
                country={hotel.country}
                smallScreenStyles={true} // Setting smallScreenStyles to true
                onSave={handleSave}
                isSaved={savedItems.has(hotel.id)}
              />
            </div>
            <div className="p-2 bg-white"> {/* Reduced padding on mobile */}
              <h3 className="text-sm font-bold text-gray-800 line-clamp-1 group-hover:text-primary transition-colors duration-200">
                {hotel.name}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center mt-0.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3 mr-0.5 opacity-70"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                {`${hotel.location}, ${hotel.country}`}
              </p>
            </div>
          </div>
        ))}

        {/* Adventure Places */}
        {adventurePlaces.map((place) => (
          <div
            key={place.id}
            className="group relative rounded-xl overflow-hidden shadow-sm cursor-pointer border border-gray-100 transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <ListingCard
                key={place.id}
                id={place.id}
                type="ADVENTURE PLACE"
                name={place.name}
                imageUrl={place.image_url}
                location={place.location}
                country={place.country}
                smallScreenStyles={true} // Setting smallScreenStyles to true
                onSave={handleSave}
                isSaved={savedItems.has(place.id)}
              />
            </div>
            <div className="p-2 bg-white"> {/* Reduced padding on mobile */}
              <h3 className="text-sm font-bold text-gray-800 line-clamp-1 group-hover:text-primary transition-colors duration-200">
                {place.name}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center mt-0.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3 mr-0.5 opacity-70"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                {`${place.location}, ${place.country}`}
              </p>
            </div>
          </div>
        ))}
      </>
    )}
  </div>
</section>

      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default Index;