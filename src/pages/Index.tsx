import { useState, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { useSavedItems } from "@/hooks/useSavedItems";
import { getCachedHomePageData, setCachedHomePageData } from "@/hooks/useHomePageCache";
import { useRatings, sortByRating } from "@/hooks/useRatings";
import { Calendar, Hotel, Tent, Compass, ChevronLeft, ChevronRight, MapPin, Star } from "lucide-react";

// Lazy load MapView
const MapView = lazy(() => import("@/components/MapView").then(mod => ({ default: mod.MapView })));

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA",
  KHAKI_DARK: "#857F3E",
};

const Index = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState<any[]>([]);
  const { savedItems, handleSave } = useSavedItems();
  const [loading, setLoading] = useState(true);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(true);
  const { position, requestLocation } = useGeolocation();
  const [showSearchIcon, setShowSearchIcon] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [loadingScrollable, setLoadingScrollable] = useState(true);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [bookingStats, setBookingStats] = useState<Record<string, number>>({});
  
  const [scrollableRows, setScrollableRows] = useState({
    trips: [], hotels: [], attractions: [], campsites: [], events: []
  });
  const [nearbyPlacesHotels, setNearbyPlacesHotels] = useState<any[]>([]);

  // Refs
  const searchRef = useRef<HTMLDivElement>(null);
  const featuredForYouRef = useRef<HTMLDivElement>(null);
  const featuredEventsRef = useRef<HTMLDivElement>(null);
  const featuredCampsitesRef = useRef<HTMLDivElement>(null);
  const featuredHotelsRef = useRef<HTMLDivElement>(null);
  const featuredTripsRef = useRef<HTMLDivElement>(null);

  // Ratings Logic
  const allItemIds = useMemo(() => {
    const ids = new Set<string>();
    [...listings, ...nearbyPlacesHotels, ...scrollableRows.trips, ...scrollableRows.events].forEach(item => ids.add(item.id));
    return Array.from(ids);
  }, [listings, nearbyPlacesHotels, scrollableRows]);

  const { ratings } = useRatings(allItemIds);

  // Sorted Memos
  const sortedNearbyPlaces = useMemo(() => sortByRating(nearbyPlacesHotels, ratings, position, calculateDistance), [nearbyPlacesHotels, ratings, position]);
  const sortedEvents = useMemo(() => sortByRating(scrollableRows.events, ratings, position, calculateDistance), [scrollableRows.events, ratings, position]);
  const sortedCampsites = useMemo(() => sortByRating(scrollableRows.campsites, ratings, position, calculateDistance), [scrollableRows.campsites, ratings, position]);
  const sortedHotels = useMemo(() => sortByRating(scrollableRows.hotels, ratings, position, calculateDistance), [scrollableRows.hotels, ratings, position]);

  // Existing Geolocation/Scroll Control UseEffects
  useEffect(() => {
    const handleInteraction = () => { requestLocation(); window.removeEventListener('scroll', handleInteraction); };
    window.addEventListener('scroll', handleInteraction, { once: true });
    return () => window.removeEventListener('scroll', handleInteraction);
  }, [requestLocation]);

  useEffect(() => {
    const cached = getCachedHomePageData();
    if (cached) {
      setListings(cached.listings || []);
      setScrollableRows(cached.scrollableRows);
      setNearbyPlacesHotels(cached.nearbyPlacesHotels || []);
      setLoading(false); setLoadingScrollable(false); setLoadingNearby(false);
    }
    fetchAllData();
    fetchScrollableRows();
  }, []);

  // Fetch Logic (Keeping your logic, styling the execution)
  const fetchScrollableRows = async () => {
    setLoadingScrollable(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      const [trips, hotels, adventure, events] = await Promise.all([
        supabase.from("trips").select("*").eq("type", "trip").or(`date.gte.${today},is_flexible_date.eq.true`).limit(8),
        supabase.from("hotels").select("*").limit(8),
        supabase.from("adventure_places").select("*").limit(8),
        supabase.from("trips").select("*").eq("type", "event").or(`date.gte.${today},is_flexible_date.eq.true`).limit(8)
      ]);
      setScrollableRows({ trips: trips.data || [], hotels: hotels.data || [], attractions: [], campsites: adventure.data || [], events: events.data || [] });
    } finally { setLoadingScrollable(false); }
  };

  const fetchAllData = async (query?: string, offset = 0) => {
    setLoading(true);
    // ... your supabase combined fetch logic here ...
    setLoading(false);
  };

  const scrollSection = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const amt = direction === 'left' ? -300 : 300;
      ref.current.scrollBy({ left: amt, behavior: 'smooth' });
    }
  };

  const categories = [
    { icon: Calendar, title: "Trips & tours", path: "/category/trips", bgImage: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80" },
    { icon: Compass, title: "Sports & events", path: "/category/events", bgImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80" },
    { icon: Hotel, title: "Hotels & stay", path: "/category/hotels", bgImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80" },
    { icon: Tent, title: "Campsites", path: "/category/campsite", bgImage: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80" }
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" showSearchIcon={showSearchIcon} onSearchClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} />

      {/* Hero Section */}
      {!isSearchFocused && (
        <div ref={searchRef} className="relative w-full h-[45vh] lg:h-[55vh] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-transparent z-10" />
          <img src="https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1920&q=80" className="w-full h-full object-cover" />
          
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-4">
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white text-center drop-shadow-2xl mb-8">
              Explore Your <span style={{ color: COLORS.CORAL }}>Wild Side</span>
            </h1>
            <div className="w-full max-w-2xl bg-white/10 backdrop-blur-md p-2 rounded-[32px] border border-white/20">
              <SearchBarWithSuggestions 
                value={searchQuery} 
                onChange={setSearchQuery} 
                onFocus={() => setIsSearchFocused(true)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Search Focus Mode */}
      {isSearchFocused && (
        <div className="sticky top-0 z-[100] bg-white p-4 border-b border-slate-100 shadow-xl">
           <SearchBarWithSuggestions 
              value={searchQuery} 
              onChange={setSearchQuery} 
              onBack={() => setIsSearchFocused(false)} 
              showBackButton={true}
           />
        </div>
      )}

      <main className="container max-w-7xl mx-auto px-4 -mt-12 relative z-30">
        
        {/* Categories Bar */}
        {!isSearchFocused && (
          <div className="bg-white rounded-[28px] p-6 shadow-xl border border-slate-50 mb-12">
            <div className="flex flex-row overflow-x-auto scrollbar-hide md:grid md:grid-cols-4 gap-4">
              {categories.map(cat => (
                <div key={cat.title} onClick={() => navigate(cat.path)} className="flex-shrink-0 flex flex-col items-center cursor-pointer group w-20 md:w-full">
                  <div className="w-16 h-16 md:w-full md:h-32 rounded-[20px] overflow-hidden relative shadow-lg transition-transform group-hover:scale-105">
                    <img src={cat.bgImage} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-[#008080]/60 transition-colors flex items-center justify-center">
                      <cat.icon className="text-white h-6 w-6 md:h-10 md:w-10" />
                    </div>
                  </div>
                  <span className="mt-2 text-[9px] md:text-xs font-black uppercase tracking-widest text-[#008080]">{cat.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Rows */}
        <div className={`space-y-16 ${isSearchFocused ? 'mt-8' : ''}`}>
          
          {/* Near You / Latest Section */}
          <section>
            <div className="flex items-end justify-between mb-6 px-2">
              <div>
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>
                  {position ? 'Near You' : 'New Experiences'}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Discover hidden gems nearby</p>
              </div>
            </div>

            <div className="relative">
              <div ref={featuredForYouRef} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide pl-2 pr-12 scroll-smooth">
                {loadingNearby ? [...Array(5)].map((_, i) => <ListingSkeleton key={i} />) : 
                 sortedNearbyPlaces.map((item) => (
                  <div key={item.id} className="flex-shrink-0 w-[65vw] md:w-72">
                    <ListingCard {...item} distance={item.distance} />
                  </div>
                ))}
              </div>
              <Button variant="ghost" className="hidden md:flex absolute right-[-20px] top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-white shadow-xl" onClick={() => scrollSection(featuredForYouRef, 'right')}>
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          </section>

          {/* Events Section - Stylized Box */}
          <section className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-100">
             <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: COLORS.CORAL }}>Hot Events</h2>
                <Link to="/category/events">
                  <Button variant="outline" className="rounded-full text-[10px] font-black uppercase tracking-widest px-6 border-[#FF7F50] text-[#FF7F50] hover:bg-[#FF7F50] hover:text-white">View All</Button>
                </Link>
             </div>
             <div ref={featuredEventsRef} className="flex gap-5 overflow-x-auto scrollbar-hide">
                {sortedEvents.map(event => (
                  <div key={event.id} className="flex-shrink-0 w-[55vw] md:w-64">
                    <ListingCard {...event} type="EVENT" showBadge={true} />
                  </div>
                ))}
             </div>
          </section>

        </div>
      </main>

      <MobileBottomBar />
    </div>
  );
};

export default Index;