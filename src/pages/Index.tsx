import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";

// Lazy load MapView to defer loading heavy mapbox-gl library
const MapView = lazy(() => import("@/components/MapView").then(mod => ({
  default: mod.MapView
})));
import { Card } from "@/components/ui/card";
import { Calendar, Hotel, Tent, Compass, Map, Grid, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { useSavedItems } from "@/hooks/useSavedItems";
import { getCachedHomePageData, setCachedHomePageData } from "@/hooks/useHomePageCache";
const Index = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState<any[]>([]);
  const {
    savedItems,
    handleSave
  } = useSavedItems();
  const [loading, setLoading] = useState(true);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const {
    toast
  } = useToast();
  const {
    position,
    requestLocation
  } = useGeolocation();

  // Request location on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      requestLocation();
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('scroll', handleInteraction, {
      once: true
    });
    window.addEventListener('click', handleInteraction, {
      once: true
    });
    return () => {
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [requestLocation]);
  const [isSearchVisible, setIsSearchVisible] = useState(true);
  const [showSearchIcon, setShowSearchIcon] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [scrollableRows, setScrollableRows] = useState<{
    trips: any[];
    hotels: any[];
    attractions: any[];
    campsites: any[];
    events: any[];
  }>({
    trips: [],
    hotels: [],
    attractions: [],
    campsites: [],
    events: []
  });
  const [nearbyPlacesHotels, setNearbyPlacesHotels] = useState<any[]>([]);
  const [loadingScrollable, setLoadingScrollable] = useState(true);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [bookingStats, setBookingStats] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Scroll refs for navigation
  const featuredForYouRef = useRef<HTMLDivElement>(null);
  const featuredEventsRef = useRef<HTMLDivElement>(null);
  const featuredCampsitesRef = useRef<HTMLDivElement>(null);
  const featuredHotelsRef = useRef<HTMLDivElement>(null);
  const featuredAttractionsRef = useRef<HTMLDivElement>(null);
  const featuredTripsRef = useRef<HTMLDivElement>(null);

  // Scroll position tracking
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({
    featuredForYou: 0,
    featuredEvents: 0,
    featuredCampsites: 0,
    featuredHotels: 0,
    featuredAttractions: 0,
    featuredTrips: 0
  });

  // Touch swipe tracking
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px) to trigger navigation
  const minSwipeDistance = 50;
  const scrollSection = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 300;
      const newScrollLeft = direction === 'left' ? ref.current.scrollLeft - scrollAmount : ref.current.scrollLeft + scrollAmount;
      ref.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };
  const handleScroll = (sectionName: string) => (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollPositions(prev => ({
      ...prev,
      [sectionName]: target.scrollLeft
    }));
  };
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const onTouchEnd = (ref: React.RefObject<HTMLDivElement>) => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      scrollSection(ref, 'right');
    }
    if (isRightSwipe) {
      scrollSection(ref, 'left');
    }
  };
  const fetchScrollableRows = async () => {
    setLoadingScrollable(true);
    try {
      const [tripsData, hotelsData, campsitesData, eventsData] = await Promise.all([supabase.from("trips").select("*").eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip").limit(8), supabase.from("hotels").select("*").eq("approval_status", "approved").eq("is_hidden", false).limit(8), supabase.from("adventure_places").select("*").eq("approval_status", "approved").eq("is_hidden", false).limit(8), supabase.from("trips").select("*").eq("approval_status", "approved").eq("is_hidden", false).eq("type", "event").limit(8)]);
      console.log("Fetched scrollable data:", {
        trips: {
          count: tripsData.data?.length || 0,
          error: tripsData.error,
          data: tripsData.data
        },
        hotels: {
          count: hotelsData.data?.length || 0,
          error: hotelsData.error,
          data: hotelsData.data
        },
        campsites: {
          count: campsitesData.data?.length || 0,
          error: campsitesData.error,
          data: campsitesData.data
        },
        events: {
          count: eventsData.data?.length || 0,
          error: eventsData.error,
          data: eventsData.data
        }
      });
      setScrollableRows({
        trips: tripsData.data || [],
        hotels: hotelsData.data || [],
        attractions: [],
        campsites: campsitesData.data || [],
        events: eventsData.data || []
      });

      // Fetch booking statistics for trips/events
      const allTripIds = [...(tripsData.data || []), ...(eventsData.data || [])].map((trip: any) => trip.id);
      if (allTripIds.length > 0) {
        const {
          data: bookingsData
        } = await supabase.from('bookings').select('item_id, slots_booked').in('item_id', allTripIds).in('status', ['confirmed', 'pending']);
        if (bookingsData) {
          const stats: Record<string, number> = {};
          bookingsData.forEach(booking => {
            const current = stats[booking.item_id] || 0;
            stats[booking.item_id] = current + (booking.slots_booked || 0);
          });
          setBookingStats(stats);
        }
      }
    } catch (error) {
      console.error("Error fetching scrollable rows:", error);
    } finally {
      setLoadingScrollable(false);
    }
  };
  const fetchNearbyPlacesAndHotels = async () => {
    setLoadingNearby(true);
    if (!position) {
      // Keep loading true if position is not available yet
      return;
    }
    const [placesData, hotelsData] = await Promise.all([supabase.from("adventure_places").select("*").eq("approval_status", "approved").eq("is_hidden", false).limit(12), supabase.from("hotels").select("*").eq("approval_status", "approved").eq("is_hidden", false).limit(12)]);
    const combined = [...(placesData.data || []).map(item => ({
      ...item,
      type: "ADVENTURE PLACE",
      table: "adventure_places",
      category: "Adventure Place"
    })), ...(hotelsData.data || []).map(item => ({
      ...item,
      type: "HOTEL",
      table: "hotels",
      category: "Hotel"
    }))];

    // Calculate distance for items with coordinates
    const withDistance = combined.map(item => {
      let distance: number | undefined;
      const itemAny = item as any;
      if (itemAny.latitude && itemAny.longitude && position) {
        distance = calculateDistance(position.latitude, position.longitude, itemAny.latitude, itemAny.longitude);
      }
      return {
        ...item,
        distance
      };
    });

    // Sort by distance (items with distance first, then others)
    const sorted = withDistance.sort((a, b) => {
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      if (a.distance !== undefined) return -1;
      if (b.distance !== undefined) return 1;
      return 0;
    });
    const nearby = sorted.slice(0, 12);
    setNearbyPlacesHotels(nearby);
    // Only set loading to false if we have data
    if (nearby.length > 0) {
      setLoadingNearby(false);
    }
  };
  const fetchAllData = async (query?: string, offset: number = 0, limit: number = 15) => {
    setLoading(true);
    const fetchEvents = async () => {
      let dbQuery = supabase.from("trips").select("*").eq("approval_status", "approved").eq("is_hidden", false).eq("type", "event");
      if (query) {
        const searchPattern = `%${query}%`;
        dbQuery = dbQuery.or(`name.ilike.${searchPattern},location.ilike.${searchPattern},country.ilike.${searchPattern}`);
      }
      dbQuery = dbQuery.range(offset, offset + limit - 1);
      const {
        data
      } = await dbQuery;
      return (data || []).map((item: any) => ({
        ...item,
        type: "EVENT"
      }));
    };
    const fetchTable = async (table: "hotels" | "adventure_places", type: string) => {
      let dbQuery = supabase.from(table).select("*").eq("approval_status", "approved").eq("is_hidden", false);
      if (query) {
        const searchPattern = `%${query}%`;
        dbQuery = dbQuery.or(`name.ilike.${searchPattern},location.ilike.${searchPattern},country.ilike.${searchPattern}`);
      }
      dbQuery = dbQuery.range(offset, offset + limit - 1);
      const {
        data
      } = await dbQuery;
      return (data || []).map((item: any) => ({
        ...item,
        type
      }));
    };
    const [events, hotels, adventures] = await Promise.all([fetchEvents(), fetchTable("hotels", "HOTEL"), fetchTable("adventure_places", "ADVENTURE PLACE")]);

    // Filter out events and trips from Featured For You section
    let combined = [...hotels, ...adventures];

    // Fetch booking statistics for events
    const eventIds = events.map((event: any) => event.id);
    if (eventIds.length > 0) {
      const {
        data: bookingsData
      } = await supabase.from('bookings').select('item_id, slots_booked').in('item_id', eventIds).in('status', ['confirmed', 'pending']);
      if (bookingsData) {
        const stats: Record<string, number> = {};
        bookingsData.forEach(booking => {
          const current = stats[booking.item_id] || 0;
          stats[booking.item_id] = current + (booking.slots_booked || 0);
        });
        setBookingStats(stats);
      }
    }
    if (position) {
      combined = combined.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else {
      combined = combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    if (offset === 0) {
      setListings(combined);
      setHasMoreSearchResults(true); // Reset when starting fresh search
    } else {
      setListings(prev => [...prev, ...combined]);
    }

    // Stop loading more if we got less data than requested
    if (combined.length < limit) {
      setHasMoreSearchResults(false);
    }
    setLoading(false);
    return combined;
  };

  // Infinite scroll for search results
  useEffect(() => {
    if (!searchQuery || !hasMoreSearchResults) return;
    const handleScroll = () => {
      if (loading || !hasMoreSearchResults) return;
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;
      if (scrollTop + clientHeight >= scrollHeight - 500) {
        loadMoreSearchResults();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, searchQuery, listings.length, hasMoreSearchResults]);
  const loadMoreSearchResults = async () => {
    if (loading || !searchQuery || !hasMoreSearchResults) return;
    const prevLength = listings.length;
    await fetchAllData(searchQuery, listings.length, 20);
    // Check if we got less data than requested
    if (listings.length === prevLength) {
      setHasMoreSearchResults(false);
    }
  };
  useEffect(() => {
    // Load from cache first for instant display
    const cachedData = getCachedHomePageData();
    if (cachedData) {
      setListings(cachedData.listings || []);
      setScrollableRows(cachedData.scrollableRows || {
        trips: [],
        hotels: [],
        attractions: [],
        campsites: [],
        events: []
      });
      setNearbyPlacesHotels(cachedData.nearbyPlacesHotels || []);
      setBookingStats(cachedData.bookingStats || {});
      setLoading(false);
      setLoadingScrollable(false);
      setLoadingNearby(false);
    }

    // Then fetch fresh data in background
    fetchAllData();
    fetchScrollableRows();
    const initUserId = async () => {
      const id = await getUserId();
      setUserId(id);
    };
    initUserId();
  }, []);

  // Update cache when data changes
  useEffect(() => {
    if (!loading && !loadingScrollable && listings.length > 0) {
      setCachedHomePageData({
        scrollableRows,
        listings,
        nearbyPlacesHotels,
        bookingStats
      });
    }
  }, [loading, loadingScrollable, listings, scrollableRows, nearbyPlacesHotels, bookingStats]);
  useEffect(() => {
    if (position) {
      fetchNearbyPlacesAndHotels();
    }
  }, [position]);
  useEffect(() => {
    const controlSearchBar = () => {
      const currentScrollY = window.scrollY;
      // Apply to all screen sizes
      if (currentScrollY > 200) {
        setIsSearchVisible(false);
        setShowSearchIcon(true);
      } else {
        setIsSearchVisible(true);
        setShowSearchIcon(false);
      }
    };
    window.addEventListener("scroll", controlSearchBar);
    return () => window.removeEventListener("scroll", controlSearchBar);
  }, []);
  const handleSearchIconClick = () => {
    setIsSearchVisible(true);
    setShowSearchIcon(false);
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  const categories = [{
    icon: Calendar,
    title: "Trips & tours",
    path: "/category/trips",
    bgImage: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=600&fit=crop&auto=format&q=80",
    description: "Explore guided tours and day trips"
  }, {
    icon: Compass,
    title: "Sports & events",
    path: "/category/events",
    bgImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop&auto=format&q=80",
    description: "Discover exciting events"
  }, {
    icon: Hotel,
    title: "Hotels & accommodation",
    path: "/category/hotels",
    bgImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop&auto=format&q=80",
    description: "Find comfortable stays"
  }, {
    icon: Tent,
    title: "Campsite & Experience",
    path: "/category/campsite",
    bgImage: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=600&fit=crop&auto=format&q=80",
    description: "Adventure camping spots"
  }];
  return <div className="min-h-screen bg-background pb-20 md:pb-0">
            <Header onSearchClick={handleSearchIconClick} showSearchIcon={showSearchIcon} />
            
            {/* Hero Section with Search Bar and Background Image - Hidden when search focused */}
            {!isSearchFocused && (
              <div 
                ref={searchRef}
                className="relative w-full h-48 md:h-72 lg:h-80"
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
            {isSearchFocused && <div className="sticky top-[64px] z-[100] bg-background p-4 border-b shadow-md">
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
                {/* Categories Section - Full width - Hidden when search focused */}
                {!isSearchFocused && (
                  <div className="w-full px-4 md:px-6 lg:px-8 py-4 md:py-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 w-full">
                          {categories.map(cat => (
                              <div 
                                  key={cat.title} 
                                  onClick={() => navigate(cat.path)} 
                                  className="relative h-24 md:h-40 lg:h-48 cursor-pointer overflow-hidden group rounded-lg" 
                                  style={{
                                      backgroundImage: `url(${cat.bgImage})`,
                                      backgroundSize: 'cover',
                                      backgroundPosition: 'center'
                                  }}
                              >
                                  <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-all text-center p-2 md:p-4 flex-col flex items-center justify-center">
                                      <cat.icon className="h-5 w-5 md:h-12 md:w-12 lg:h-16 lg:w-16 text-white mb-1 md:mb-3" />
                                      <span className="font-bold text-white text-xs md:text-base lg:text-lg leading-tight" role="heading" aria-level={3}>{cat.title}</span>
                                      <p className="text-white/80 text-2xs md:text-sm text-center mt-0.5 md:mt-1 hidden md:block">{cat.description}</p>
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
                            </div> : listings.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
                                {listings.map((listing, index) => {
            const itemDistance = position && listing.latitude && listing.longitude ? calculateDistance(position.latitude, position.longitude, listing.latitude, listing.longitude) : undefined;
            return <div key={listing.id} className="w-full">
                                    <ListingCard id={listing.id} type={listing.type} name={listing.name} location={listing.location} country={listing.country} imageUrl={listing.image_url} price={listing.price || listing.entry_fee || 0} date={listing.date} isCustomDate={listing.is_custom_date} isSaved={savedItems.has(listing.id)} onSave={() => handleSave(listing.id, listing.type)} availableTickets={listing.type === "TRIP" || listing.type === "EVENT" ? listing.available_tickets : undefined} bookedTickets={listing.type === "TRIP" || listing.type === "EVENT" ? bookingStats[listing.id] || 0 : undefined} showBadge={true} priority={index < 4} hidePrice={listing.type === "HOTEL" || listing.type === "ADVENTURE PLACE"} activities={listing.activities} distance={itemDistance} />
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
                                {loading ? [...Array(12)].map((_, i) => <div key={i} className="w-full"><ListingSkeleton /></div>) : listings.length === 0 ? <div className="col-span-full text-center py-12">
                                        <p className="text-muted-foreground text-lg">No results found for "{searchQuery}"</p>
                                        <p className="text-muted-foreground text-sm mt-2">Try searching with different keywords</p>
                                    </div> : listings.map((item, index) => {
              const itemDistance = position && item.latitude && item.longitude ? calculateDistance(position.latitude, position.longitude, item.latitude, item.longitude) : undefined;
              return <div key={item.id} className="w-full">
                                        <ListingCard id={item.id} type={item.type} name={item.name} imageUrl={item.image_url} location={item.location} country={item.country} price={item.price || item.entry_fee || item.price_adult || 0} date={item.date} isCustomDate={item.is_custom_date} onSave={handleSave} isSaved={savedItems.has(item.id)} hidePrice={item.type === "HOTEL" || item.type === "ADVENTURE PLACE"} showBadge={true} priority={index < 4} availableTickets={item.type === "TRIP" || item.type === "EVENT" ? item.available_tickets : undefined} bookedTickets={item.type === "TRIP" || item.type === "EVENT" ? bookingStats[item.id] || 0 : undefined} activities={item.activities} distance={itemDistance} />
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
                                {(position ? loadingNearby : loading) || (position ? nearbyPlacesHotels : listings).length === 0 ? [...Array(10)].map((_, i) => <div key={i} className="flex-shrink-0 w-[45vw] md:w-56 rounded-lg overflow-hidden shadow-md">
                                            <div className="aspect-[2/1] bg-muted animate-pulse" />
                                            <div className="p-2 space-y-1.5">
                                                <div className="h-3 bg-muted animate-pulse rounded w-4/5" />
                                                <div className="h-2.5 bg-muted animate-pulse rounded w-2/3" />
                                            </div>
                                        </div>) : (position ? nearbyPlacesHotels : listings).map((item, index) => <div key={item.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                             <ListingCard id={item.id} type={item.type} name={item.name} imageUrl={item.image_url} location={item.location} country={item.country} price={item.price || item.entry_fee || 0} date={item.date} isCustomDate={item.is_custom_date} onSave={handleSave} isSaved={savedItems.has(item.id)} hidePrice={true} showBadge={true} priority={index === 0} availableTickets={item.type === "TRIP" || item.type === "EVENT" ? item.available_tickets : undefined} bookedTickets={item.type === "TRIP" || item.type === "EVENT" ? bookingStats[item.id] || 0 : undefined} activities={item.activities} distance={position ? item.distance : undefined} />
                                         </div>)}
                                </div>
                            </div>}
                    </section>


                    <hr className="border-t border-gray-200 my-1 md:my-4" />

                    {/* Events */}
                    <section className="mb-2 md:mb-6">
                        <div className="mb-1.5 md:mb-3 flex items-start justify-between">
                            <h2 className="text-xs md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                Sports and events.
                            </h2>
                            <Link to="/category/events" className="text-primary text-3xs md:text-sm hover:underline">
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
                            {loadingScrollable ? <div className="flex gap-1.5 md:gap-2">
                                    {[...Array(5)].map((_, i) => <div key={i} className="flex-shrink-0 w-[45vw] md:w-56">
                                            <ListingSkeleton />
                                        </div>)}
                                </div> : scrollableRows.events.length === 0 ? <p className="text-center text-muted-foreground py-8 w-full">No events available</p> : scrollableRows.events.map((event, index) => <div key={event.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                        <ListingCard id={event.id} type="EVENT" name={event.name} imageUrl={event.image_url} location={event.location} country={event.country} price={event.price} date={event.date} isCustomDate={event.is_custom_date} onSave={handleSave} isSaved={savedItems.has(event.id)} showBadge={false} priority={index === 0} activities={event.activities} />
                                    </div>)}
                            </div>
                        </div>
                    </section>

                    <hr className="border-t border-gray-200 my-1 md:my-4" />

                    {/* Campsite & Experience */}
                    <section className="mb-2 md:mb-6">
                        <div className="mb-1.5 md:mb-3 flex items-start justify-between">
                            <h2 className="text-xs md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                Campsite & Experience
                            </h2>
                            <Link to="/category/campsite" className="text-primary text-3xs md:text-sm hover:underline">
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
                            {loadingScrollable ? <div className="flex gap-1.5 md:gap-2">
                                    {[...Array(5)].map((_, i) => <div key={i} className="flex-shrink-0 w-[45vw] md:w-56">
                                            <ListingSkeleton />
                                        </div>)}
                                </div> : scrollableRows.campsites.length === 0 ? <p className="text-center text-muted-foreground py-8 w-full">No campsites available</p> : [...scrollableRows.campsites].sort((a, b) => {
                if (!position) return 0;
                const distA = a.latitude && a.longitude ? calculateDistance(position.latitude, position.longitude, a.latitude, a.longitude) : Infinity;
                const distB = b.latitude && b.longitude ? calculateDistance(position.latitude, position.longitude, b.latitude, b.longitude) : Infinity;
                return distA - distB;
              }).map((place, index) => {
                const itemDistance = position && place.latitude && place.longitude ? calculateDistance(position.latitude, position.longitude, place.latitude, place.longitude) : undefined;
                return <div key={place.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                        <ListingCard id={place.id} type="ADVENTURE PLACE" name={place.name} imageUrl={place.image_url} location={place.location} country={place.country} price={place.entry_fee || 0} date="" onSave={handleSave} isSaved={savedItems.has(place.id)} hidePrice={true} showBadge={true} priority={index === 0} activities={place.activities} distance={itemDistance} />
                                    </div>;
              })}
                            </div>
                        </div>
                    </section>

                    {/* Hotels */}
                    <section className="mb-2 md:mb-6">
                        <div className="mb-1.5 md:mb-3 flex items-start justify-between">
                            <h2 className="text-xs md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                Hotels and accommodations.
                            </h2>
                            <Link to="/category/hotels" className="text-primary text-3xs md:text-sm hover:underline">
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
                            {loadingScrollable ? <div className="flex gap-1.5 md:gap-2">
                                    {[...Array(5)].map((_, i) => <div key={i} className="flex-shrink-0 w-[45vw] md:w-56">
                                            <ListingSkeleton />
                                        </div>)}
                                </div> : scrollableRows.hotels.length === 0 ? <p className="text-center text-muted-foreground py-8 w-full">No hotels available</p> : [...scrollableRows.hotels].sort((a, b) => {
                if (!position) return 0;
                const distA = a.latitude && a.longitude ? calculateDistance(position.latitude, position.longitude, a.latitude, a.longitude) : Infinity;
                const distB = b.latitude && b.longitude ? calculateDistance(position.latitude, position.longitude, b.latitude, b.longitude) : Infinity;
                return distA - distB;
              }).map((hotel, index) => {
                const itemDistance = position && hotel.latitude && hotel.longitude ? calculateDistance(position.latitude, position.longitude, hotel.latitude, hotel.longitude) : undefined;
                return <div key={hotel.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                        <ListingCard id={hotel.id} type="HOTEL" name={hotel.name} imageUrl={hotel.image_url} location={hotel.location} country={hotel.country} price={0} date="" onSave={handleSave} isSaved={savedItems.has(hotel.id)} hidePrice={true} showBadge={true} priority={index === 0} activities={hotel.activities} distance={itemDistance} />
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
                            <h2 className="text-xs md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">
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
                            {loadingScrollable ? <div className="flex gap-1.5 md:gap-2">
                                    {[...Array(5)].map((_, i) => <div key={i} className="flex-shrink-0 w-[45vw] md:w-56">
                                            <ListingSkeleton />
                                        </div>)}
                                </div> : scrollableRows.trips.length === 0 ? <p className="text-center text-muted-foreground py-8 w-full">No trips available</p> : scrollableRows.trips.map(trip => {
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