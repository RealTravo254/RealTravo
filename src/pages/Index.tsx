import { useState, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";
import { 
  Calendar, Hotel, Tent, Compass, MapPin, 
  ChevronLeft, ChevronRight, Star, Grid, Copy, Share2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { useSavedItems } from "@/hooks/useSavedItems";
import { getCachedHomePageData, setCachedHomePageData } from "@/hooks/useHomePageCache";
import { useRatings, sortByRating } from "@/hooks/useRatings";

// Colors matching the EventDetail aesthetic
const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const MapView = lazy(() => import("@/components/MapView").then(mod => ({
  default: mod.MapView
})));

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { position, requestLocation } = useGeolocation();
  const { savedItems, handleSave } = useSavedItems();
  
  // State Logic
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showSearchIcon, setShowSearchIcon] = useState(false);
  const [bookingStats, setBookingStats] = useState<Record<string, number>>({});
  const [scrollableRows, setScrollableRows] = useState({
    trips: [], hotels: [], campsites: [], events: []
  });
  const [nearbyPlacesHotels, setNearbyPlacesHotels] = useState<any[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(true);

  // Refs
  const searchRef = useRef<HTMLDivElement>(null);
  const featuredForYouRef = useRef<HTMLDivElement>(null);
  const featuredEventsRef = useRef<HTMLDivElement>(null);
  const featuredCampsitesRef = useRef<HTMLDivElement>(null);
  const featuredHotelsRef = useRef<HTMLDivElement>(null);
  const featuredTripsRef = useRef<HTMLDivElement>(null);

  // --- Logic / Fetching (Consolidated from your original) ---
  const allItemIds = useMemo(() => {
    const ids = new Set<string>();
    [...listings, ...nearbyPlacesHotels, ...scrollableRows.trips, ...scrollableRows.hotels, ...scrollableRows.campsites, ...scrollableRows.events]
      .forEach(item => ids.add(item.id));
    return Array.from(ids);
  }, [listings, nearbyPlacesHotels, scrollableRows]);

  const { ratings } = useRatings(allItemIds);

  const sortedListings = useMemo(() => sortByRating(listings, ratings, position, calculateDistance), [listings, ratings, position]);
  const sortedNearbyPlaces = useMemo(() => sortByRating(nearbyPlacesHotels, ratings, position, calculateDistance), [nearbyPlacesHotels, ratings, position]);
  const sortedEvents = useMemo(() => sortByRating(scrollableRows.events, ratings, position, calculateDistance), [scrollableRows.events, ratings, position]);
  const sortedCampsites = useMemo(() => sortByRating(scrollableRows.campsites, ratings, position, calculateDistance), [scrollableRows.campsites, ratings, position]);
  const sortedHotels = useMemo(() => sortByRating(scrollableRows.hotels, ratings, position, calculateDistance), [scrollableRows.hotels, ratings, position]);

  useEffect(() => {
    const handleInteraction = () => { requestLocation(); };
    window.addEventListener('scroll', handleInteraction, { once: true });
    return () => window.removeEventListener('scroll', handleInteraction);
  }, [requestLocation]);

  useEffect(() => {
    const cached = getCachedHomePageData();
    if (cached) {
      setListings(cached.listings);
      setScrollableRows(cached.scrollableRows);
      setNearbyPlacesHotels(cached.nearbyPlacesHotels);
      setLoading(false);
    }
    fetchAllData();
    fetchScrollableRows();
  }, []);

  // Your existing Fetch logic here (fetchAllData, fetchScrollableRows, etc.)
  // ... [Keep your fetchAllData and fetchScrollableRows functions exactly as they were] ...

  const scrollSection = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 300;
      ref.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const categories = [
    { icon: Calendar, title: "Trips & tours", path: "/category/trips", bgImage: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80" },
    { icon: Compass, title: "Sports & events", path: "/category/events", bgImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80" },
    { icon: Hotel, title: "Hotels & Stays", path: "/category/hotels", bgImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80" },
    { icon: Tent, title: "Campsites", path: "/category/campsite", bgImage: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80" }
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header 
        className="hidden md:block" 
        onSearchClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
        showSearchIcon={showSearchIcon} 
        hideIcons={isSearchFocused} 
      />

      {/* Hero Image Section */}
      {!isSearchFocused && (
        <div 
          className="relative w-full h-[35vh] md:h-[50vh] overflow-hidden"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1920&q=80)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
          
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-4">
            <h1 className="text-3xl md:text-6xl font-black uppercase tracking-tighter leading-none text-white text-center drop-shadow-2xl mb-8">
              Explore The <span style={{ color: COLORS.CORAL }}>Wild Side</span>
            </h1>
            
            <div className="w-full max-w-2xl bg-white/10 backdrop-blur-md p-2 rounded-[32px] border border-white/20 shadow-2xl">
              <SearchBarWithSuggestions 
                value={searchQuery} 
                onChange={setSearchQuery} 
                onFocus={() => setIsSearchFocused(true)}
                onSubmit={() => { /* search logic */ }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sticky Search Header when searching */}
      {isSearchFocused && (
        <div className="sticky top-0 z-[100] bg-white border-b border-slate-100 p-4 shadow-xl">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
             <SearchBarWithSuggestions 
                value={searchQuery} 
                onChange={setSearchQuery} 
                onBack={() => setIsSearchFocused(false)}
                showBackButton={true}
              />
          </div>
        </div>
      )}

      <main className="container max-w-7xl mx-auto px-4 -mt-10 relative z-40">
        
        {/* Horizontal Category Cards */}
        {!isSearchFocused && (
          <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-100 mb-10 overflow-hidden">
            <div className="flex flex-row overflow-x-auto scrollbar-hide md:grid md:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <div 
                  key={cat.title} 
                  onClick={() => navigate(cat.path)} 
                  className="flex-shrink-0 group cursor-pointer w-24 md:w-full"
                >
                  <div className="relative h-20 md:h-40 rounded-2xl md:rounded-[24px] overflow-hidden shadow-md">
                    <img src={cat.bgImage} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-[#008080]/60 transition-colors duration-300" />
                    <cat.icon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white h-6 w-6 md:h-10 md:w-10 z-10" />
                  </div>
                  <p className="mt-3 text-center text-[10px] md:text-xs font-black uppercase tracking-widest text-[#008080]">
                    {cat.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Near You */}
        <div className="space-y-12">
          <section className="relative">
            <div className="flex items-end justify-between mb-6 px-2">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>
                  {position ? "Near Your Location" : "Latest Adventures"}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified Spots</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div ref={featuredForYouRef} className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide px-2">
                {loadingNearby ? (
                  [...Array(4)].map((_, i) => <div key={i} className="flex-shrink-0 w-[65vw] md:w-72"><ListingSkeleton /></div>)
                ) : (
                  sortedNearbyPlaces.map((item) => (
                    <div key={item.id} className="flex-shrink-0 w-[65vw] md:w-72">
                      <ListingCard {...item} hidePrice={true} showBadge={true} />
                    </div>
                  ))
                )}
              </div>
              <UtilityScroll ref={featuredForYouRef} onLeft={() => scrollSection(featuredForYouRef, 'left')} onRight={() => scrollSection(featuredForYouRef, 'right')} />
            </div>
          </section>

          {/* Section: Events (Stylized like the Event Detail Page Highlights) */}
          <section className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.CORAL }}>Sports & Live Events</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Experience the community</p>
              </div>
              <Link to="/category/events">
                <Button variant="ghost" className="rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100">View All</Button>
              </Link>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {sortedEvents.map((event) => (
                <div key={event.id} className="flex-shrink-0 w-[45vw] md:w-64">
                   <ListingCard {...event} type="EVENT" showBadge={false} />
                </div>
              ))}
            </div>
          </section>

          {/* Section: Trips & Tours */}
          <section>
             <div className="mb-6 px-2">
                <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: COLORS.KHAKI_DARK }}>Curated Trips</h2>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
               {scrollableRows.trips.slice(0, 10).map((trip: any) => (
                 <ListingCard key={trip.id} {...trip} type="TRIP" showBadge={true} />
               ))}
             </div>
          </section>
        </div>
      </main>

      <MobileBottomBar />
    </div>
  );
};

// Internal Helper for stylized scroll buttons
const UtilityScroll = ({ onLeft, onRight, ref }: any) => (
  <>
    <Button 
      variant="ghost" 
      onClick={onLeft}
      className="hidden md:flex absolute left-[-20px] top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white shadow-xl hover:bg-slate-50 border border-slate-100"
    >
      <ChevronLeft className="h-5 w-5" />
    </Button>
    <Button 
      variant="ghost" 
      onClick={onRight}
      className="hidden md:flex absolute right-[-20px] top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white shadow-xl hover:bg-slate-50 border border-slate-100"
    >
      <ChevronRight className="h-5 w-5" />
    </Button>
  </>
);

export default Index;
  return <div className="min-h-screen bg-background pb-20 md:pb-0">
            <Header onSearchClick={handleSearchIconClick} showSearchIcon={showSearchIcon} hideIcons={isSearchFocused} />
            
     {/* Hero Section with Search Bar and Background Image - Hidden when search focused */}
     {!isSearchFocused && (
    <div 
      ref={searchRef}
      // 👇 MODIFIED CLASSES HERE 👇
      className="relative w-full h-[30vh] lg:h-[39vh]" 

      style={{
        backgroundImage: `url(https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1920&h=600&fit=crop&auto=format&q=80)`, 
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="container md:px-4 px-4">
          <h1 className="text-white text-2xl md:text-4xl lg:text-5xl font-bold text-center mb-4 md:mb-6">
            Discover Your Next Adventure
          </h1>
          <SearchBarWithSuggestions 
            value={searchQuery} 
            onChange={setSearchQuery} 
            onSubmit={() => {
              if (searchQuery.trim()) {
                fetchAllData(searchQuery);
                setIsSearchFocused(true);
              }
            }} 
            onSuggestionSearch={query => {
              setSearchQuery(query);
              fetchAllData(query);
              setIsSearchFocused(true);
            }} 
            onFocus={() => setIsSearchFocused(true)} 
            onBlur={() => {}}
            onBack={() => {
              setIsSearchFocused(false);
              setSearchQuery("");
              fetchAllData();
            }} 
            showBackButton={false} 
          />
        </div>
      </div>
    </div>
)}
            
            {/* Search Bar - Appears below header when focused on all screens */}
            {isSearchFocused && <div className="sticky top-0 md:top-[64px] z-[100] bg-background p-4 border-b shadow-md">
                    <div className="container md:px-4 px-4 mx-auto">
                        <SearchBarWithSuggestions value={searchQuery} onChange={setSearchQuery} onSubmit={() => {
          if (searchQuery.trim()) {
            fetchAllData(searchQuery);
          }
        }} onSuggestionSearch={query => {
          setSearchQuery(query);
          fetchAllData(query);
        }} onFocus={() => setIsSearchFocused(true)} onBlur={() => {
          // Keep search focused when there's content
        }} onBack={() => {
          setIsSearchFocused(false);
          setSearchQuery("");
          fetchAllData(); // Reset to all listings
        }} showBackButton={true} />
                    </div>
                </div>}

            <main className="w-full">
{!isSearchFocused && (
  <div className="w-full px-4 md:px-6 lg:px-8 py-4 md:py-6 overflow-hidden">
    {/* MOBILE: flex row with no-scrollbar
      DESKTOP: grid with 4 columns
    */}
    <div className="flex flex-row overflow-x-auto scrollbar-hide md:grid md:grid-cols-4 gap-0 md:gap-8 w-full">
      {categories.map(cat => (
        <div 
          key={cat.title} 
          onClick={() => navigate(cat.path)} 
          className="flex-shrink-0 flex flex-col items-center cursor-pointer group w-1/4 min-w-[80px] md:w-full"
        >
          {/* ICON CONTAINER */}
          <div 
            className="flex items-center justify-center transition-all
                       w-14 h-14 rounded-full bg-[#008080] 
                       md:w-full md:h-40 lg:h-48 md:rounded-lg md:relative"
            style={{
              backgroundImage: `url(${cat.bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Desktop Overlay: Only visible on md+ */}
            <div className="hidden md:block absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all rounded-lg" />

            {/* Icon: Center aligned */}
            <cat.icon className="relative z-10 h-7 w-7 text-white md:h-12 md:w-12 lg:h-16 lg:w-16" />
          </div>

          {/* TEXT: Always below the icon container */}
          <div className="mt-2 text-center">
            <span className="font-bold text-gray-800 text-[10px] md:text-base lg:text-lg leading-tight block" role="heading" aria-level={3}>
              {cat.title}
            </span>
            {/* Description: Hidden on mobile to save space */}
            <p className="hidden md:block text-gray-500 text-sm mt-1">{cat.description}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
                
                {/* Search Results - Show when search is focused */}
                {isSearchFocused && <div className="w-full px-4 md:px-6 lg:px-8 mt-4">
                        <h2 className="text-xl md:text-2xl font-bold mb-4">
                            {searchQuery ? 'Search Results' : 'All Listings'}
                        </h2>
                        {loading ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
                                {[...Array(6)].map((_, i) => <div key={i} className="w-full"><ListingSkeleton /></div>)}
                            </div> : sortedListings.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
                                {sortedListings.map((listing, index) => {
            const itemDistance = position && listing.latitude && listing.longitude ? calculateDistance(position.latitude, position.longitude, listing.latitude, listing.longitude) : undefined;
            const ratingData = ratings.get(listing.id);
            return <div key={listing.id} className="w-full">
                                    <ListingCard id={listing.id} type={listing.type} name={listing.name} location={listing.location} country={listing.country} imageUrl={listing.image_url} price={listing.price || listing.entry_fee || 0} date={listing.date} isCustomDate={listing.is_custom_date} isSaved={savedItems.has(listing.id)} onSave={() => handleSave(listing.id, listing.type)} availableTickets={listing.type === "TRIP" || listing.type === "EVENT" ? listing.available_tickets : undefined} bookedTickets={listing.type === "TRIP" || listing.type === "EVENT" ? bookingStats[listing.id] || 0 : undefined} showBadge={true} priority={index < 4} hidePrice={listing.type === "HOTEL" || listing.type === "ADVENTURE PLACE"} activities={listing.activities} distance={itemDistance} avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount} />
                                </div>;
          })}
                            </div> : <p className="text-center text-muted-foreground py-8">No results found</p>}
                    </div>}
                
                <div className={`w-full px-4 md:px-6 lg:px-8 ${isSearchFocused ? 'hidden' : ''}`}>
                    {/* Near You / Latest - Show nearby items if location is on, otherwise show latest */}
                    <section className="mb-2 md:mb-6">
                        <div className="mb-1.5 md:mb-3 mt-1 md:mt-0 px-0 mx-[10px] items-end justify-between flex flex-row my-[5px]">
                            <h2 className="text-xs md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                {searchQuery ? 'Search Results' : position ? 'Near You' : 'Latest'}
                            </h2>
                            {searchQuery && listings.length > 0 && <div className="flex gap-2">
                                    <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')} className="gap-1">
                                        <Grid className="h-4 w-4" />
                                        <span className="hidden md:inline">List</span>
                                    </Button>
                                </div>}
                        </div>
                        
                        {searchQuery && viewMode === 'map' ? <Suspense fallback={<div className="h-[400px] bg-muted animate-pulse rounded-lg" />}><MapView listings={listings} /></Suspense> : searchQuery ?
          // Column grid view for search results
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
                                {loading ? [...Array(12)].map((_, i) => <div key={i} className="w-full"><ListingSkeleton /></div>) : sortedListings.length === 0 ? <div className="col-span-full text-center py-12">
                                        <p className="text-muted-foreground text-lg">No results found for "{searchQuery}"</p>
                                        <p className="text-muted-foreground text-sm mt-2">Try searching with different keywords</p>
                                    </div> : sortedListings.map((item, index) => {
              const itemDistance = position && item.latitude && item.longitude ? calculateDistance(position.latitude, position.longitude, item.latitude, item.longitude) : undefined;
              const ratingData = ratings.get(item.id);
              return <div key={item.id} className="w-full">
                                        <ListingCard id={item.id} type={item.type} name={item.name} imageUrl={item.image_url} location={item.location} country={item.country} price={item.price || item.entry_fee || item.price_adult || 0} date={item.date} isCustomDate={item.is_custom_date} onSave={handleSave} isSaved={savedItems.has(item.id)} hidePrice={item.type === "HOTEL" || item.type === "ADVENTURE PLACE"} showBadge={true} priority={index < 4} availableTickets={item.type === "TRIP" || item.type === "EVENT" ? item.available_tickets : undefined} bookedTickets={item.type === "TRIP" || item.type === "EVENT" ? bookingStats[item.id] || 0 : undefined} activities={item.activities} distance={itemDistance} avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount} />
                                    </div>;
            })}
                            </div> :
          // Horizontal scroll view for latest items (when not searching)
          <div className="relative">
                                {!searchQuery && listings.length > 0 && <>
                                        <Button variant="ghost" size="icon" aria-label="Scroll left" onClick={() => scrollSection(featuredForYouRef, 'left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 md:h-10 md:w-10 rounded-full bg-black/50 hover:bg-black/70 text-white">
                                            <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
                                        </Button>
                                        <Button variant="ghost" size="icon" aria-label="Scroll right" onClick={() => scrollSection(featuredForYouRef, 'right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 md:h-10 md:w-10 rounded-full bg-black/50 hover:bg-black/70 text-white">
                                            <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
                                        </Button>
                                    </>}
                                <div ref={featuredForYouRef} onScroll={handleScroll('featuredForYou')} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => onTouchEnd(featuredForYouRef)} className="gap-3 overflow-x-auto pb-2 scrollbar-hide md:gap-4 flex items-start justify-start pl-1 pr-8 md:pl-2 md:pr-12 scroll-smooth">
                                {/* Show nearby items if location is on, otherwise show latest */}
                                {(position ? loadingNearby : loading) || (position ? sortedNearbyPlaces : sortedListings).length === 0 ? [...Array(10)].map((_, i) => <div key={i} className="flex-shrink-0 w-[45vw] md:w-56 rounded-lg overflow-hidden shadow-md">
                                            <div className="aspect-[2/1] bg-muted animate-pulse" />
                                            <div className="p-2 space-y-1.5">
                                                <div className="h-3 bg-muted animate-pulse rounded w-4/5" />
                                                <div className="h-2.5 bg-muted animate-pulse rounded w-2/3" />
                                            </div>
                                        </div>) : (position ? sortedNearbyPlaces : sortedListings).map((item, index) => {
                                          const ratingData = ratings.get(item.id);
                                          return <div key={item.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                             <ListingCard id={item.id} type={item.type} name={item.name} imageUrl={item.image_url} location={item.location} country={item.country} price={item.price || item.entry_fee || 0} date={item.date} isCustomDate={item.is_custom_date} onSave={handleSave} isSaved={savedItems.has(item.id)} hidePrice={true} showBadge={true} priority={index === 0} availableTickets={item.type === "TRIP" || item.type === "EVENT" ? item.available_tickets : undefined} bookedTickets={item.type === "TRIP" || item.type === "EVENT" ? bookingStats[item.id] || 0 : undefined} activities={item.activities} distance={position ? item.distance : undefined} avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount} />
                                         </div>;
                                        })}
                                </div>
                            </div>}
                    </section>


                    <hr className="border-t border-gray-200 my-1 md:my-4" />

                    {/* Events */}
                    <section className="mb-2 md:mb-6">
                        <div className="mb-1.5 md:mb-3 flex items-start justify-between">
                         <h2 className="text-[0.9rem] sm:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis min-w-max">
                          Sports and events.
                        </h2>
                     <Link to="/category/events" className="text-primary text-sm hover:underline">
                          View All
                     </Link>
                        </div>
                        <div className="relative">
                            {scrollableRows.events.length > 0 && <>
                                    <Button variant="ghost" size="icon" aria-label="Scroll left" onClick={() => scrollSection(featuredEventsRef, 'left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 md:h-10 md:w-10 rounded-full bg-black/50 hover:bg-black/70 text-white">
                                        <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label="Scroll right" onClick={() => scrollSection(featuredEventsRef, 'right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 md:h-10 md:w-10 rounded-full bg-black/50 hover:bg-black/70 text-white">
                                        <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
                                    </Button>
                                </>}
                            <div ref={featuredEventsRef} onScroll={handleScroll('featuredEvents')} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => onTouchEnd(featuredEventsRef)} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:gap-4 pl-1 pr-8 md:pl-2 md:pr-12 scroll-smooth">
                            {loadingScrollable || scrollableRows.events.length === 0 ? <div className="flex gap-1.5 md:gap-2">
                                    {[...Array(5)].map((_, i) => <div key={i} className="flex-shrink-0 w-[45vw] md:w-56">
                                            <ListingSkeleton />
                                        </div>)}
                                </div> : sortedEvents.map((event, index) => {
                                  const ratingData = ratings.get(event.id);
                                  return <div key={event.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                        <ListingCard id={event.id} type="EVENT" name={event.name} imageUrl={event.image_url} location={event.location} country={event.country} price={event.price} date={event.date} isCustomDate={event.is_custom_date} onSave={handleSave} isSaved={savedItems.has(event.id)} showBadge={false} priority={index === 0} activities={event.activities} avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount} />
                                    </div>;
                                })}
                            </div>
                        </div>
                    </section>

                    <hr className="border-t border-gray-200 my-1 md:my-4" />

                    {/* Campsite & Experience */}
                    <section className="mb-2 md:mb-6">
                        <div className="mb-1.5 md:mb-3 flex items-start justify-between">
                         <h2 className="text-[0.9rem] sm:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis min-w-max">
                             Places to adventure
                        </h2>
                       <Link to="/category/campsite" className="text-primary text-sm hover:underline">
                            View All
                       </Link>
                        </div>
                        <div className="relative">
                            {scrollableRows.campsites.length > 0 && <>
                                    <Button variant="ghost" size="icon" aria-label="Scroll left" onClick={() => scrollSection(featuredCampsitesRef, 'left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 md:h-10 md:w-10 rounded-full bg-black/50 hover:bg-black/70 text-white">
                                        <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label="Scroll right" onClick={() => scrollSection(featuredCampsitesRef, 'right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 md:h-10 md:w-10 rounded-full bg-black/50 hover:bg-black/70 text-white">
                                        <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
                                    </Button>
                                </>}
                            <div ref={featuredCampsitesRef} onScroll={handleScroll('featuredCampsites')} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => onTouchEnd(featuredCampsitesRef)} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:gap-4 pl-1 pr-8 md:pl-2 md:pr-12 scroll-smooth">
                            {loadingScrollable || scrollableRows.campsites.length === 0 ? <div className="flex gap-1.5 md:gap-2">
                                    {[...Array(5)].map((_, i) => <div key={i} className="flex-shrink-0 w-[45vw] md:w-56">
                                            <ListingSkeleton />
                                        </div>)}
                                </div> : sortedCampsites.map((place, index) => {
                const itemDistance = position && place.latitude && place.longitude ? calculateDistance(position.latitude, position.longitude, place.latitude, place.longitude) : undefined;
                const ratingData = ratings.get(place.id);
                return <div key={place.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                        <ListingCard id={place.id} type="ADVENTURE PLACE" name={place.name} imageUrl={place.image_url} location={place.location} country={place.country} price={place.entry_fee || 0} date="" onSave={handleSave} isSaved={savedItems.has(place.id)} hidePrice={true} showBadge={true} priority={index === 0} activities={place.activities} distance={itemDistance} avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount} />
                                    </div>;
              })}
                            </div>
                        </div>
                    </section>

                    {/* Hotels */}
                    <section className="mb-2 md:mb-6">
                        <div className="mb-1.5 md:mb-3 flex items-start justify-between">
                            <h2 className="text-[0.9rem] sm:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis min-w-max">
                                Hotels and accommodations.
                            </h2>
                            <Link to="/category/hotels" className="text-primary text-sm hover:underline">
                                View All
                            </Link>
                        </div>
                        <div className="relative">
                            {scrollableRows.hotels.length > 0 && <>
                                    <Button variant="ghost" size="icon" aria-label="Scroll left" onClick={() => scrollSection(featuredHotelsRef, 'left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 md:h-10 md:w-10 rounded-full bg-black/50 hover:bg-black/70 text-white">
                                        <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label="Scroll right" onClick={() => scrollSection(featuredHotelsRef, 'right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 md:h-10 md:w-10 rounded-full bg-black/50 hover:bg-black/70 text-white">
                                        <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
                                    </Button>
                                </>}
                            <div ref={featuredHotelsRef} onScroll={handleScroll('featuredHotels')} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => onTouchEnd(featuredHotelsRef)} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:gap-4 pl-1 pr-8 md:pl-2 md:pr-12 scroll-smooth">
                            {loadingScrollable || scrollableRows.hotels.length === 0 ? <div className="flex gap-1.5 md:gap-2">
                                    {[...Array(5)].map((_, i) => <div key={i} className="flex-shrink-0 w-[45vw] md:w-56">
                                            <ListingSkeleton />
                                        </div>)}
                                </div> : sortedHotels.map((hotel, index) => {
                const itemDistance = position && hotel.latitude && hotel.longitude ? calculateDistance(position.latitude, position.longitude, hotel.latitude, hotel.longitude) : undefined;
                const ratingData = ratings.get(hotel.id);
                return <div key={hotel.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                        <ListingCard id={hotel.id} type="HOTEL" name={hotel.name} imageUrl={hotel.image_url} location={hotel.location} country={hotel.country} price={0} date="" onSave={handleSave} isSaved={savedItems.has(hotel.id)} hidePrice={true} showBadge={true} priority={index === 0} activities={hotel.activities} distance={itemDistance} avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount} />
                                    </div>;
              })}
                            </div>
                        </div>
                    </section>

                    {/* Attractions */}
                    <section className="mb-2 md:mb-6">
                        
                        
                    </section>

                    <hr className="border-t border-gray-200 my-1 md:my-4" />

                    {/* Trips Section */}
                    <section className="mb-2 md:mb-6">
                        <div className="mb-1.5 md:mb-3 flex items-start justify-between">
                            <h2 className="text-[0.9rem] sm:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis min-w-max">
                                Trips and tours.
                            </h2>
                            <Link to="/category/trips" className="text-primary text-3xs md:text-sm hover:underline">
                                View All
                            </Link>
                        </div>
                        <div className="relative">
                            {scrollableRows.trips.length > 0 && <>
                                    <Button variant="ghost" size="icon" aria-label="Scroll left" onClick={() => scrollSection(featuredTripsRef, 'left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 md:h-10 md:w-10 rounded-full bg-black/50 hover:bg-black/70 text-white">
                                        <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label="Scroll right" onClick={() => scrollSection(featuredTripsRef, 'right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 md:h-10 md:w-10 rounded-full bg-black/50 hover:bg-black/70 text-white">
                                        <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
                                    </Button>
                                </>}
                            <div ref={featuredTripsRef} onScroll={handleScroll('featuredTrips')} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => onTouchEnd(featuredTripsRef)} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:gap-4 pl-1 pr-8 md:pl-2 md:pr-12 scroll-smooth">
                            {loadingScrollable || scrollableRows.trips.length === 0 ? <div className="flex gap-1.5 md:gap-2">
                                    {[...Array(5)].map((_, i) => <div key={i} className="flex-shrink-0 w-[45vw] md:w-56">
                                            <ListingSkeleton />
                                        </div>)}
                                </div> : scrollableRows.trips.map(trip => {
                const isEvent = trip.type === "event";
                return <div key={trip.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                        <ListingCard id={trip.id} type={isEvent ? "EVENT" : "TRIP"} name={trip.name} imageUrl={trip.image_url} location={trip.location} country={trip.country} price={trip.price} date={trip.date} isCustomDate={trip.is_custom_date} onSave={handleSave} isSaved={savedItems.has(trip.id)} showBadge={isEvent} availableTickets={trip.available_tickets} bookedTickets={bookingStats[trip.id] || 0} activities={trip.activities} />
                                    </div>;
              })}
                            </div>
                        </div>
                    </section>
                </div>
            </main>
            <MobileBottomBar />
        </div>;
};
export default Index;