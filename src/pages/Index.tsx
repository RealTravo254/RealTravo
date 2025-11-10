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

// --- START: Slideshow Data & Component Simulation ---
// Mock data for the slideshow
const SlideData = [
  {
    id: 1,
    name: "Luxury Beach Escapes 🏝️",
    description: "Exclusive resorts and pristine beaches await. Book your paradise now!",
    imageUrl: "https://images.unsplash.com/photo-1543632349-4700d8324f2b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w1MDcxMzJ8MHwxfHNlYXJjaHw0fHxsb3dlciUyMHRvJTJGY2xhc3MlMjByZXNvcnRzfGVufDB8fHx8MTY5MDExMDY3NXww&ixlib=rb-4.0.3&q=80&w=1080",
    link: "/category/hotels",
  },
  {
    id: 2,
    name: "Himalayan Trekking Adventures 🏔️",
    description: "Challenge yourself with breathtaking mountain trails and majestic views.",
    imageUrl: "https://images.unsplash.com/photo-1596707323114-1e05a81e3a4e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w1MDcxMzJ8MHwxfHNlYXJjaHwzMHx8aGltYWxheWFuJTIwdHJla2tpbmd8ZW58MHx8fHwxNjk1OTQ4NDgzfDA&ixlib=rb-4.0.3&q=80&w=1080",
    link: "/category/adventure",
  },
  {
    id: 3,
    name: "Annual Music Festival 🎶",
    description: "Don't miss the biggest event of the year! Tickets are selling fast.",
    imageUrl: "https://images.unsplash.com/photo-1540350280456-e6924e392505?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w1MDcxMzJ8MHwxfHNlYXJjaHw2fHxtdXNpYyUyMGZlc3RpdmFsfGVufDB8fHx8MTY5NTk0ODQ4M3ww&ixlib=rb-4.0.3&q=80&w=1080",
    link: "/category/events",
  },
];

const AutoSlideshow = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SlideData.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const slide = SlideData[currentSlide];

  return (
    <Link to={slide.link}>
      <div className="relative w-full h-full rounded-xl overflow-hidden shadow-lg cursor-pointer">
        {/* Background Image */}
        <img
          src={slide.imageUrl}
          alt={slide.name}
          className="w-full h-full object-cover transition-opacity duration-1000"
          style={{ opacity: 1 }}
        />
        
        {/* Overlay for Name and Description */}
        {/* UPDATED: Using bg-blue-900/60 for a solid navy overlay and text-blue-200 for description */}
        <div className="absolute inset-0 bg-blue-900/60 flex items-end p-6 md:p-8">
          <div className="text-white">
            <h3 className="text-2xl md:text-4xl font-extrabold mb-1">
              {slide.name}
            </h3>
            <p className="text-sm md:text-base text-blue-200 max-w-lg">
              {slide.description}
            </p>
          </div>
        </div>
        
        {/* Navigation Dots */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {SlideData.map((_, index) => (
            <button
              key={index}
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                index === currentSlide ? "bg-white" : "bg-white/40 hover:bg-white/70"
              }`}
              onClick={(e) => {
                e.preventDefault();
                setCurrentSlide(index);
              }}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </Link>
  );
};
// --- END: Slideshow Data & Component Simulation ---


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

        {/* Slideshow and Categories Section */}
        <section>
          <h2 className="text-3xl font-bold mb-6 text-center md:hidden">What are you looking for?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Slideshow (Takes 2/3 width on large screens) */}
            <div className="md:col-span-2 h-64 md:h-96">
              <AutoSlideshow />
            </div>

            {/* Categories (Takes 1/3 width on large screens, displayed in a column) */}
            <div className="md:col-span-1">
              <div className="grid grid-cols-3 gap-3 md:grid-cols-1 md:gap-4 h-full">
                {categories.map((category) => (
                  <CategoryCard
                    key={category.title}
                    icon={category.icon}
                    title={category.title}
                    description={category.description}
                    onClick={() => navigate(category.path)}
                    className="p-3 md:p-6"
                  />
                ))}
              </div>
            </div>
            
          </div>
        </section>

        {/* COMBINED LISTINGS: Trips, Events, Hotels, and Adventure Places */}
        <section>
          <h2 className="text-3xl font-bold mb-6 text-center">Featured Destinations</h2>
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
                    price={trip.price} // Pass price and date so ListingCard can display them in the overlay
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
                    price={event.price} // Pass price and date
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
                    price={hotel.price} // Pass price
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
                    price={place.price} // Pass price
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