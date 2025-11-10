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

// MOCK Slideshow Component (Replace with your actual implementation)
const ImageSlideshow = () => {
  // Mock data for the slideshow
  const slides = [
    {
      name: "Bali's Sunrise Temples",
      description: "Witness the breathtaking dawn at the most sacred sites.",
      imageUrl: "https://images.unsplash.com/photo-1544439169-d4c399c5608d",
    },
    {
      name: "European Alps Adventure",
      description: "Hike and bike through stunning mountain landscapes this summer.",
      imageUrl: "https://images.unsplash.com/photo-1549877452-9c3132629b3c",
    },
    {
      name: "Luxury Maldives Retreat",
      description: "Seven days of pure relaxation in an overwater bungalow.",
      imageUrl: "https://images.unsplash.com/photo-1540306786884-2977f0cc34e2",
    },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[currentSlide];

  return (
    // Simple mock structure using Tailwind classes
    <div className="relative w-full aspect-video rounded-xl shadow-2xl overflow-hidden bg-gray-200">
      {/* Background Image */}
      <img
        src={slide.imageUrl}
        alt={slide.name}
        className="w-full h-full object-cover transition-opacity duration-1000"
      />
      
      {/* Overlay Content (Dark Navy theme style) */}
      <div className="absolute inset-0 bg-blue-900/60 flex flex-col justify-end p-6 md:p-8">
        <h3 className="text-3xl font-extrabold text-white mb-2 leading-tight">
          {slide.name}
        </h3>
        <p className="text-lg text-blue-200 mb-4">
          {slide.description}
        </p>
        <button 
            onClick={() => { /* Navigate to the slide's detail page */ }}
            className="w-fit px-5 py-2 text-sm font-semibold rounded-full bg-white text-blue-900 hover:bg-gray-100 transition-colors"
        >
            View Deal
        </button>
      </div>

      {/* Navigation Dots (Optional: for a full implementation) */}
      <div className="absolute bottom-4 right-4 flex space-x-2">
        {slides.map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full transition-all duration-300 ${
              index === currentSlide ? "bg-white scale-125" : "bg-white/50 hover:bg-white"
            }`}
            onClick={() => setCurrentSlide(index)}
          ></div>
        ))}
      </div>
    </div>
  );
};

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

      <main className="container px-4 py-8 space-y-8 md:space-y-12">
        {/* Search */}
        <section>
          <SearchBarWithSuggestions
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={handleSearch}
          />
        </section>

        {/* Categories & Slideshow Section */}
        {/* Use flex on medium screens and up to place categories left and slideshow right */}
        <section className="flex flex-col md:flex-row gap-8 md:gap-12">
          
          {/* Categories (Vertical Column on Large Screens) */}
          <div className="w-full md:w-1/3 lg:w-1/4">
             <h2 className="text-2xl font-bold mb-4 hidden md:block">Explore Categories</h2>
             <div className="grid grid-cols-3 md:grid-cols-1 gap-3 md:gap-4">
              {categories.map((category) => (
                <CategoryCard
                  key={category.title}
                  icon={category.icon}
                  title={category.title}
                  description={category.description}
                  onClick={() => navigate(category.path)}
                  // Adjust padding and focus on column layout for md screens
                  className="p-3 md:p-4 text-center md:text-left"
                  // Ensure CategoryCard looks good in a vertical stack (may need to adjust its internal flex direction)
                />
              ))}
            </div>
          </div>
          
          {/* Slideshow (Takes up remaining space) */}
          <div className="w-full md:w-2/3 lg:w-3/4">
            <ImageSlideshow />
          </div>

        </section>

        {/* COMBINED LISTINGS: Trips, Events, Hotels, and Adventure Places */}
        <section>
          {/* A more suitable title for the listings section after the main hero content */}
          <h2 className="text-3xl font-bold mb-6">Popular Picks and Recent Finds</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-6">
            {loading ? (
              // Display shimmer loading effect if loading
              <>
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="group relative rounded-xl overflow-hidden shadow-lg border-2 border-transparent transition-all duration-300 hover:shadow-xl"
                  >
                    <div className="aspect-[4/3] bg-muted animate-pulse" />
                    <div className="p-2 md:p-4 space-y-2 md:space-y-3">
                      <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                      <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                      <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
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

                {/* Events */}
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

                {/* Hotels */}
                {hotels.map((hotel) => (
                  <ListingCard
                    key={hotel.id}
                    id={hotel.id}
                    type="HOTEL"
                    name={hotel.name}
                    imageUrl={hotel.image_url}
                    location={hotel.location}
                    country={hotel.country}
                    price={hotel.price} 
                    onSave={handleSave}
                    isSaved={savedItems.has(hotel.id)}
                  />
                ))}

                {/* Adventure Places */}
                {adventurePlaces.map((place) => (
                  <ListingCard
                    key={place.id}
                    id={place.id}
                    type="ADVENTURE PLACE"
                    name={place.name}
                    imageUrl={place.image_url}
                    location={place.location}
                    country={place.country}
                    price={place.price} 
                    onSave={handleSave}
                    isSaved={savedItems.has(place.id)}
                  />
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