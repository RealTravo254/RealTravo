import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
// MobileBottomBar moved to PageLayout for persistence across all pages
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";
import { Card } from "@/components/ui/card";
import { Calendar, Hotel, Tent, Compass, Map, Grid, MapPin, ChevronLeft, ChevronRight, Loader2, Navigation } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { ListingSkeleton, ListingGridSkeleton, HorizontalScrollSkeleton } from "@/components/ui/listing-skeleton";
import { useSavedItems } from "@/hooks/useSavedItems";
import { getCachedHomePageData, setCachedHomePageData } from "@/hooks/useHomePageCache";
import { useRatings, sortByRating, RatingData } from "@/hooks/useRatings";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { useResponsiveLimit } from "@/hooks/useResponsiveLimit";

// Memoized listing card wrapper for performance
const MemoizedListingCard = memo(ListingCard);

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
    loading: locationLoading,
    permissionDenied,
    requestLocation,
    forceRequestLocation
  } = useGeolocation();
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  
  // Responsive fetch limits: 4 for mobile, 16 for desktop
  const { cardLimit, isLargeScreen } = useResponsiveLimit();

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
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Collect all item IDs for ratings
  const allItemIds = useMemo(() => {
    const ids = new Set<string>();
    listings.forEach(item => ids.add(item.id));
    nearbyPlacesHotels.forEach(item => ids.add(item.id));
    scrollableRows.trips.forEach(item => ids.add(item.id));
    scrollableRows.hotels.forEach(item => ids.add(item.id));
    scrollableRows.campsites.forEach(item => ids.add(item.id));
    scrollableRows.events.forEach(item => ids.add(item.id));
    return Array.from(ids);
  }, [listings, nearbyPlacesHotels, scrollableRows]);

  // Collect trip and event IDs for real-time booking stats
  const tripEventIds = useMemo(() => {
    return [...scrollableRows.trips, ...scrollableRows.events].map(item => item.id);
  }, [scrollableRows.trips, scrollableRows.events]);

  // Real-time booking stats subscription - all users see updates instantly
  const { bookingStats } = useRealtimeBookings(tripEventIds);

  // Fetch ratings for all items
  const { ratings } = useRatings(allItemIds);

  // Sort items by rating with location prioritization
  const sortedListings = useMemo(() => {
    return sortByRating(listings, ratings, position, calculateDistance);
  }, [listings, ratings, position]);

  const sortedNearbyPlaces = useMemo(() => {
    return sortByRating(nearbyPlacesHotels, ratings, position, calculateDistance);
  }, [nearbyPlacesHotels, ratings, position]);

  const sortedEvents = useMemo(() => {
    return sortByRating(scrollableRows.events, ratings, position, calculateDistance);
  }, [scrollableRows.events, ratings, position]);

  const sortedCampsites = useMemo(() => {
    return sortByRating(scrollableRows.campsites, ratings, position, calculateDistance);
  }, [scrollableRows.campsites, ratings, position]);

  const sortedHotels = useMemo(() => {
    return sortByRating(scrollableRows.hotels, ratings, position, calculateDistance);
  }, [scrollableRows.hotels, ratings, position]);

  const sortedTrips = useMemo(() => {
    return sortByRating(scrollableRows.trips, ratings, position, calculateDistance);
  }, [scrollableRows.trips, ratings, position]);
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
  const scrollSection = useCallback((ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 300;
      const newScrollLeft = direction === 'left' ? ref.current.scrollLeft - scrollAmount : ref.current.scrollLeft + scrollAmount;
      ref.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  }, []);

  const handleScroll = useCallback((sectionName: string) => (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollPositions(prev => ({
      ...prev,
      [sectionName]: target.scrollLeft
    }));
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const onTouchEnd = useCallback((ref: React.RefObject<HTMLDivElement>) => {
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
  }, [touchStart, touchEnd, minSwipeDistance, scrollSection]);
  const fetchScrollableRows = useCallback(async (limit: number) => {
    setLoadingScrollable(true);
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const [tripsData, hotelsData, campsitesData, eventsData] = await Promise.all([
        // Fetch trips with responsive limit
        supabase
          .from("trips")
          .select(
            "id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child"
          )
          .eq("approval_status", "approved")
          .eq("is_hidden", false)
          .eq("type", "trip")
          .order("date", { ascending: true })
          .limit(limit),
        supabase
          .from("hotels")
          .select("id,name,location,place,country,image_url,activities,latitude,longitude,created_at")
          .eq("approval_status", "approved")
          .eq("is_hidden", false)
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("adventure_places")
          .select("id,name,location,place,country,image_url,entry_fee,activities,latitude,longitude,created_at")
          .eq("approval_status", "approved")
          .eq("is_hidden", false)
          .order("created_at", { ascending: false })
          .limit(limit),
        // Fetch events with responsive limit
        supabase
          .from("trips")
          .select(
            "id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child"
          )
          .eq("approval_status", "approved")
          .eq("is_hidden", false)
          .eq("type", "event")
          .order("date", { ascending: true })
          .limit(limit),
      ]);
      
      setScrollableRows({
        trips: tripsData.data || [],
        hotels: hotelsData.data || [],
        attractions: [],
        campsites: campsitesData.data || [],
        events: eventsData.data || []
      });

      // Booking stats are now handled by useRealtimeBookings hook for real-time updates
    } catch (error) {
      console.error("Error fetching scrollable rows:", error);
    } finally {
      setLoadingScrollable(false);
    }
  }, []);
  const fetchNearbyPlacesAndHotels = async () => {
    setLoadingNearby(true);
    if (!position) {
      // Keep loading true if position is not available yet
      return;
    }
    const [placesData, hotelsData] = await Promise.all([
      supabase
        .from("adventure_places")
        .select("id,name,location,place,country,image_url,entry_fee,activities,latitude,longitude,created_at")
        .eq("approval_status", "approved")
        .eq("is_hidden", false)
        .limit(12),
      supabase
        .from("hotels")
        .select("id,name,location,place,country,image_url,activities,latitude,longitude,created_at")
        .eq("approval_status", "approved")
        .eq("is_hidden", false)
        .limit(12),
    ]);
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
    const today = new Date().toISOString().split('T')[0];
    
    const fetchEvents = async () => {
      let dbQuery = supabase
        .from("trips")
        .select(
          "id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child"
        )
        .eq("approval_status", "approved")
        .eq("is_hidden", false)
        .eq("type", "event")
        .or(`date.gte.${today},is_flexible_date.eq.true`);
        
      if (query) {
        const searchPattern = `%${query}%`;
        dbQuery = dbQuery.or(`name.ilike.${searchPattern},location.ilike.${searchPattern},country.ilike.${searchPattern}`);
      }
      dbQuery = dbQuery.order('date', { ascending: true }).range(offset, offset + limit - 1);
      const { data } = await dbQuery;
      return (data || []).map((item: any) => ({
        ...item,
        type: "EVENT"
      }));
    };
    
    const fetchTable = async (table: "hotels" | "adventure_places", type: string) => {
      let dbQuery = supabase
        .from(table)
        .select(
          table === "hotels"
            ? "id,name,location,place,country,image_url,activities,latitude,longitude,created_at"
            : "id,name,location,place,country,image_url,entry_fee,activities,latitude,longitude,created_at"
        )
        .eq("approval_status", "approved")
        .eq("is_hidden", false);
        
      if (query) {
        const searchPattern = `%${query}%`;
        dbQuery = dbQuery.or(`name.ilike.${searchPattern},location.ilike.${searchPattern},country.ilike.${searchPattern}`);
      }
      dbQuery = dbQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      const { data } = await dbQuery;
      return (data || []).map((item: any) => ({
        ...item,
        type
      }));
    };
    
    const [events, hotels, adventures] = await Promise.all([
      fetchEvents(), 
      fetchTable("hotels", "HOTEL"), 
      fetchTable("adventure_places", "ADVENTURE PLACE")
    ]);

    // Filter out events and trips from Featured For You section
    let combined = [...hotels, ...adventures];

    // Fetch booking statistics for events
    // Booking stats are now handled by useRealtimeBookings hook for real-time updates
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
      // Booking stats are now handled by useRealtimeBookings hook
      setLoading(false);
      setLoadingScrollable(false);
      setLoadingNearby(false);
    }

    // Then fetch fresh data in background
    fetchAllData();
    fetchScrollableRows(cardLimit);
    const initUserId = async () => {
      const id = await getUserId();
      setUserId(id);
    };
    initUserId();
  }, [cardLimit, fetchScrollableRows]);

  // Update cache when data changes
  useEffect(() => {
    if (!loading && !loadingScrollable && listings.length > 0) {
      setCachedHomePageData({
        scrollableRows,
        listings,
        nearbyPlacesHotels
      });
    }
  }, [loading, loadingScrollable, listings, scrollableRows, nearbyPlacesHotels]);
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
// View mode for listings: 'top_destinations' (sorted by rating) or 'my_location' (sorted by distance)
  const [listingViewMode, setListingViewMode] = useState<'top_destinations' | 'my_location'>('top_destinations');
  
  const categories = [{
    icon: Tent,
    title: "Campsite & Experience",
    path: "/category/campsite",
    bgImage: "/images/category-campsite.webp",
    description: "Adventure camping spots"
  }, {
    icon: Hotel,
    title: "Hotels & accommodation",
    path: "/category/hotels",
    bgImage: "/images/category-hotels.webp",
    description: "Find comfortable stays"
  }, {
    icon: Calendar,
    title: "Trips & tours",
    path: "/category/trips",
    bgImage: "/images/category-trips.webp",
    description: "Explore guided tours and day trips"
  }, {
    icon: Compass,
    title: "Sports & events",
    path: "/category/events",
    bgImage: "/images/category-events.webp",
    description: "Discover exciting events"
  }];

  // Handle My Location tap - request location and switch view mode
  const handleMyLocationTap = useCallback(() => {
    if (permissionDenied) {
      // Location was denied, show dialog
      setShowLocationDialog(true);
      return;
    }
    if (!position && !locationLoading) {
      forceRequestLocation();
    }
    setListingViewMode('my_location');
  }, [position, locationLoading, permissionDenied, forceRequestLocation]);

  // Show dialog if permission is denied after attempting
  useEffect(() => {
    if (permissionDenied && listingViewMode === 'my_location') {
      setShowLocationDialog(true);
    }
  }, [permissionDenied, listingViewMode]);

  // Get filtered/sorted items based on view mode
  const getDisplayItems = useCallback((items: any[], sortedByRating: any[], isTripsOrEvents: boolean = false) => {
    let result = [...items];
    
    if (listingViewMode === 'my_location' && position) {
      // Sort by distance when My Location is active
      result = result.sort((a, b) => {
        const distA = a.latitude && a.longitude 
          ? calculateDistance(position.latitude, position.longitude, a.latitude, a.longitude) 
          : Infinity;
        const distB = b.latitude && b.longitude 
          ? calculateDistance(position.latitude, position.longitude, b.latitude, b.longitude) 
          : Infinity;
        return distA - distB;
      });
    } else {
      // Default: top destinations (sorted by rating)
      result = sortedByRating;
    }
    
    // For trips/events: filter out unavailable/expired, prioritize flexible dates
    // HIDE: expired past-date items (unless flexible) and sold-out items
    if (isTripsOrEvents) {
      const today = new Date().toISOString().split('T')[0];
      const flexibleAndAvailable: any[] = [];
      const fixedDateAvailable: any[] = [];
      const soldOutItems: any[] = [];
      
      result.forEach(item => {
        const isOutdated = item.date && !item.is_flexible_date && item.date < today;
        const bookedCount = bookingStats[item.id] || 0;
        const isSoldOut = item.available_tickets !== null && item.available_tickets !== undefined && 
          (item.available_tickets <= 0 || bookedCount >= item.available_tickets);
        
        // HIDE expired items completely (unless flexible date)
        if (isOutdated) {
          return; // Skip expired items
        }
        
        // Show sold-out items at the end (they're still visible, just last)
        if (isSoldOut) {
          soldOutItems.push(item);
        } else if (item.is_flexible_date) {
          // Flexible date items are prioritized first
          flexibleAndAvailable.push(item);
        } else {
          fixedDateAvailable.push(item);
        }
      });
      
      // Flexible first, then available by date, then sold out at end
      return [...flexibleAndAvailable, ...fixedDateAvailable, ...soldOutItems];
    }
    
    return result;
  }, [listingViewMode, position, bookingStats]);

  const displayCampsites = useMemo(() => getDisplayItems(scrollableRows.campsites, sortedCampsites, false), [scrollableRows.campsites, sortedCampsites, getDisplayItems]);
  const displayHotels = useMemo(() => getDisplayItems(scrollableRows.hotels, sortedHotels, false), [scrollableRows.hotels, sortedHotels, getDisplayItems]);
  const displayTrips = useMemo(() => getDisplayItems(scrollableRows.trips, sortedTrips, true), [scrollableRows.trips, sortedTrips, getDisplayItems]);
  const displayEvents = useMemo(() => getDisplayItems(scrollableRows.events, sortedEvents, true), [scrollableRows.events, sortedEvents, getDisplayItems]);
  return <div className="min-h-screen bg-background pb-0 md:pb-0">
            <Header onSearchClick={handleSearchIconClick} showSearchIcon={showSearchIcon} hideIcons={isSearchFocused} />
            
     {/* Hero Section with Search Bar, Background Image, and Category Icons - Hidden when search focused */}
     {!isSearchFocused && (
    <div 
      ref={searchRef}
      className="relative w-full h-[55vh] md:h-[45vh] lg:h-[50vh] md:mt-16 overflow-hidden"
    >
      {/* Hero background image with high priority for LCP */}
      <picture>
        <source 
          media="(max-width: 640px)" 
          srcSet="/images/hero-background.webp" 
          type="image/webp"
        />
        <source 
          media="(max-width: 1024px)" 
          srcSet="/images/hero-background.webp" 
          type="image/webp"
        />
        <img 
          src="/images/hero-background.webp" 
          alt="Travel destination background" 
          fetchPriority="high"
          decoding="sync"
          loading="eager"
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </picture>
      {/* Dark overlay for visibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />
      
      {/* Search section centered */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-32 md:pb-24">
        <div className="container md:px-4 px-4">
          <h1 className="text-white text-2xl md:text-4xl lg:text-5xl font-bold text-center mb-4 md:mb-6 drop-shadow-lg">
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
      
      {/* Mobile Category Icons overlaid at bottom - only visible on mobile */}
      <div className="absolute bottom-0 left-0 right-0 md:hidden">
        <div 
          className="px-4 py-4 pb-5"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0) 100%)'
          }}
        >
          <div className="flex flex-row justify-around items-start">
            {categories.map((cat, index) => {
              // Eye-catching category colors
              const categoryColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#FF7F50'];
              const bgColor = categoryColors[index % categoryColors.length];
              return (
                <div 
                  key={cat.title} 
                  onClick={() => navigate(cat.path)} 
                  className="flex flex-col items-center cursor-pointer group"
                >
                  <div 
                    className="w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center border border-white/30 transition-all group-hover:scale-110"
                    style={{ backgroundColor: `${bgColor}CC` }}
                  >
                    <cat.icon className="h-5 w-5 text-white" />
                  </div>
                  <span 
                    className="text-[9px] font-bold uppercase tracking-tight mt-2 text-center leading-tight max-w-[70px]"
                    style={{ color: bgColor }}
                  >
                    {cat.title}
                  </span>
                </div>
              );
            })}
          </div>
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
{/* Desktop Category Cards - hidden on mobile since they're in hero */}
{!isSearchFocused && (
  <div className="hidden md:block w-full px-4 md:px-6 lg:px-8 py-4 md:py-6 overflow-hidden">
    <div className="grid grid-cols-4 gap-4 w-full">
      {categories.map((cat, index) => {
        // Eye-catching category colors matching mobile
        const categoryColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#FF7F50'];
        const iconColor = categoryColors[index % categoryColors.length];
        return (
          <div 
            key={cat.title} 
            onClick={() => navigate(cat.path)} 
            className="flex flex-col items-center cursor-pointer group"
          >
            {/* ICON CONTAINER with background image */}
            <div 
              className="flex items-end justify-center transition-all w-full h-40 lg:h-48 rounded-lg relative overflow-hidden"
            >
              {/* Category background image - lazy loaded */}
              <img 
                src={cat.bgImage}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 group-hover:from-black/70 group-hover:via-black/30 transition-all" />
              
              {/* Icon: Center aligned with category color */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <cat.icon className="h-12 w-12 lg:h-16 lg:w-16 drop-shadow-lg" style={{ color: iconColor }} />
              </div>

              {/* TEXT: Inside image at bottom */}
              <div className="relative z-10 p-3 text-center w-full">
                <span className="font-bold text-white text-base lg:text-lg leading-tight block drop-shadow-lg" role="heading" aria-level={3}>
                  {cat.title}
                </span>
                <p className="text-white/90 text-sm mt-1 drop-shadow">{cat.description}</p>
              </div>
            </div>
          </div>
        );
      })}
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
                    {/* Top Destinations / My Location Toggle Bar */}
<section className="mb-2 md:mb-6">
  <div className="mb-1.5 md:mb-3 mt-1 md:mt-0 px-0 mx-[10px] items-center justify-between flex flex-row my-[5px] gap-6">
    {/* Top Destinations Text */}
    <span
      onClick={() => setListingViewMode('top_destinations')}
      className={`cursor-pointer text-xs md:text-sm font-bold whitespace-nowrap transition-all ${
        listingViewMode === 'top_destinations'
          ? 'text-[#DC2626] underline underline-offset-4'
          : 'text-muted-foreground hover:text-[#DC2626]'
      }`}
    >
      Top Destinations
    </span>

    {/* My Location Text */}
    <div
      onClick={!locationLoading ? handleMyLocationTap : undefined}
      className={`flex items-center gap-1.5 cursor-pointer text-xs md:text-sm font-bold whitespace-nowrap transition-all ${
        listingViewMode === 'my_location'
          ? 'text-[#DC2626] underline underline-offset-4'
          : 'text-muted-foreground hover:text-[#DC2626]'
      } ${locationLoading ? 'opacity-70 cursor-wait' : ''}`}
    >
      {locationLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MapPin className="h-3.5 w-3.5" />
      )}
      <span>{locationLoading ? 'Finding...' : 'My Location'}</span>
    </div>
  </div>
</section>

                    {/* Campsite & Experience (Adventure Places) - First */}
                    <section className="mb-2 md:mb-6">
                        <div className="mb-1.5 md:mb-3 flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent py-2 px-3 rounded-lg border-l-4 border-primary">
                         <h2 className="text-[0.9rem] sm:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis min-w-max text-primary">
                             Places to adventure
                        </h2>
                       <Link to="/category/campsite" className="text-primary text-xs md:text-sm font-bold hover:underline bg-primary/10 px-2 py-1 rounded-full">
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
                                </div> : displayCampsites.length === 0 ? (
                                  <div className="flex-1 text-center py-8 text-muted-foreground">
                                    No adventure places available
                                  </div>
                                ) : displayCampsites.map((place, index) => {
                const itemDistance = position && place.latitude && place.longitude ? calculateDistance(position.latitude, position.longitude, place.latitude, place.longitude) : undefined;
                const ratingData = ratings.get(place.id);
                return <div key={place.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                        <ListingCard id={place.id} type="ADVENTURE PLACE" name={place.name} imageUrl={place.image_url} location={place.location} country={place.country} price={place.entry_fee || 0} date="" onSave={handleSave} isSaved={savedItems.has(place.id)} hidePrice={true} showBadge={true} priority={index === 0} activities={place.activities} distance={itemDistance} avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount} place={place.place} />
                                    </div>;
              })}
                            </div>
                        </div>
                    </section>

                    <hr className="border-t border-gray-200 my-1 md:my-4" />

                    {/* Hotels - Second */}
                    <section className="mb-2 md:mb-6">
                        <div className="mb-1.5 md:mb-3 flex items-center justify-between bg-gradient-to-r from-[#008080]/10 to-transparent py-2 px-3 rounded-lg border-l-4 border-[#008080]">
                            <h2 className="text-[0.9rem] sm:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis min-w-max text-[#008080]">
                                Hotels and accommodations
                            </h2>
                            <Link to="/category/hotels" className="text-[#008080] text-xs md:text-sm font-bold hover:underline bg-[#008080]/10 px-2 py-1 rounded-full">
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
                                </div> : displayHotels.length === 0 ? (
                                  <div className="flex-1 text-center py-8 text-muted-foreground">
                                    No hotels available
                                  </div>
                                ) : displayHotels.map((hotel, index) => {
                const itemDistance = position && hotel.latitude && hotel.longitude ? calculateDistance(position.latitude, position.longitude, hotel.latitude, hotel.longitude) : undefined;
                const ratingData = ratings.get(hotel.id);
                return <div key={hotel.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                        <ListingCard id={hotel.id} type="HOTEL" name={hotel.name} imageUrl={hotel.image_url} location={hotel.location} country={hotel.country} price={0} date="" onSave={handleSave} isSaved={savedItems.has(hotel.id)} hidePrice={true} showBadge={true} priority={index === 0} activities={hotel.activities} distance={itemDistance} avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount} place={hotel.place} />
                                    </div>;
              })}
                            </div>
                        </div>
                    </section>

                    <hr className="border-t border-gray-200 my-1 md:my-4" />

                    {/* Trips Section - Third */}
                    <section className="mb-2 md:mb-6">
                        <div className="mb-1.5 md:mb-3 flex items-center justify-between bg-gradient-to-r from-[#FF0000]/10 to-transparent py-2 px-3 rounded-lg border-l-4 border-[#FF0000]">
                            <h2 className="text-[0.9rem] sm:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis min-w-max text-[#FF0000]">
                                Trips and tours
                            </h2>
                            <Link to="/category/trips" className="text-[#FF0000] text-xs md:text-sm font-bold hover:underline bg-[#FF0000]/10 px-2 py-1 rounded-full">
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
                                </div> : displayTrips.length === 0 ? (
                                  <div className="flex-1 text-center py-8 text-muted-foreground">
                                    No trips available
                                  </div>
                                ) : displayTrips.map((trip, index) => {
                const isEvent = trip.type === "event";
                const today = new Date().toISOString().split('T')[0];
                const isOutdated = trip.date && !trip.is_flexible_date && trip.date < today;
                const ratingData = ratings.get(trip.id);
                return <div key={trip.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                        <ListingCard id={trip.id} type={isEvent ? "EVENT" : "TRIP"} name={trip.name} imageUrl={trip.image_url} location={trip.location} country={trip.country} price={trip.price} date={trip.date} isCustomDate={trip.is_custom_date} isFlexibleDate={trip.is_flexible_date} isOutdated={isOutdated} onSave={handleSave} isSaved={savedItems.has(trip.id)} showBadge={isEvent} availableTickets={trip.available_tickets} bookedTickets={bookingStats[trip.id] || 0} activities={trip.activities} priority={index === 0} avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount} />
                                    </div>;
              })}
                            </div>
                        </div>
                    </section>

                    <hr className="border-t border-gray-200 my-1 md:my-4" />

                    {/* Events - Fourth */}
                    <section className="mb-2 md:mb-6">
                        <div className="mb-1.5 md:mb-3 flex items-center justify-between bg-gradient-to-r from-[#FF7F50]/10 to-transparent py-2 px-3 rounded-lg border-l-4 border-[#FF7F50]">
                         <h2 className="text-[0.9rem] sm:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis min-w-max text-[#FF7F50]">
                          Sports and events
                        </h2>
                     <Link to="/category/events" className="text-[#FF7F50] text-xs md:text-sm font-bold hover:underline bg-[#FF7F50]/10 px-2 py-1 rounded-full">
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
                                </div> : displayEvents.length === 0 ? (
                                  <div className="flex-1 text-center py-8 text-muted-foreground">
                                    No events available
                                  </div>
                                ) : displayEvents.map((event, index) => {
                                  const ratingData = ratings.get(event.id);
                                  const today = new Date().toISOString().split('T')[0];
                                  const isOutdated = event.date && !event.is_flexible_date && event.date < today;
                                  return <div key={event.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                        <ListingCard id={event.id} type="EVENT" name={event.name} imageUrl={event.image_url} location={event.location} country={event.country} price={event.price} date={event.date} isCustomDate={event.is_custom_date} isFlexibleDate={event.is_flexible_date} isOutdated={isOutdated} onSave={handleSave} isSaved={savedItems.has(event.id)} showBadge={false} priority={index === 0} activities={event.activities} avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount} availableTickets={event.available_tickets} bookedTickets={bookingStats[event.id] || 0} />
                                    </div>;
                                })}
                            </div>
                        </div>
                    </section>

                    {/* Nearest to Me Section - Shows when location is available */}
                    {position && sortedNearbyPlaces.length > 0 && (
                        <section className="mb-2 md:mb-6">
                            <hr className="border-t border-gray-200 my-1 md:my-4" />
                            <div className="mb-1.5 md:mb-3 flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-transparent py-2 px-3 rounded-lg border-l-4 border-blue-500">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
                                    <h2 className="text-[0.9rem] sm:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis min-w-max text-blue-500">
                                        Nearest to You
                                    </h2>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:gap-4 pl-1 pr-8 md:pl-2 md:pr-12 scroll-smooth">
                                    {loadingNearby ? (
                                        <div className="flex gap-1.5 md:gap-2">
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} className="flex-shrink-0 w-[45vw] md:w-56">
                                                    <ListingSkeleton />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        sortedNearbyPlaces.slice(0, 8).map((item, index) => {
                                            const itemAny = item as any;
                                            const itemDistance = itemAny.latitude && itemAny.longitude && position
                                                ? calculateDistance(position.latitude, position.longitude, itemAny.latitude, itemAny.longitude)
                                                : undefined;
                                            const ratingData = ratings.get(item.id);
                                            return (
                                                <div key={item.id} className="flex-shrink-0 w-[45vw] md:w-56">
                                                    <MemoizedListingCard
                                                        id={item.id}
                                                        type={itemAny.type || itemAny.table === 'hotels' ? 'HOTEL' : 'ADVENTURE PLACE'}
                                                        name={item.name}
                                                        imageUrl={itemAny.image_url}
                                                        location={itemAny.location}
                                                        country={itemAny.country}
                                                        price={itemAny.entry_fee || 0}
                                                        date=""
                                                        onSave={handleSave}
                                                        isSaved={savedItems.has(item.id)}
                                                        hidePrice={true}
                                                        showBadge={true}
                                                        priority={index === 0}
                                                        activities={itemAny.activities}
                                                        distance={itemDistance}
                                                        avgRating={ratingData?.avgRating}
                                                        reviewCount={ratingData?.reviewCount}
                                                        place={itemAny.place}
                                                    />
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                </div>
            </main>

            {/* Location Permission Dialog */}
            <AlertDialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
              <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                  <div className="flex justify-center mb-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Navigation className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <AlertDialogTitle className="text-center">Turn On Location</AlertDialogTitle>
                  <AlertDialogDescription className="text-center">
                    To see places near you, please enable location access in your device settings. This helps us show you the best experiences in your area.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
                  <AlertDialogAction 
                    onClick={() => {
                      setShowLocationDialog(false);
                      forceRequestLocation();
                    }}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    Try Again
                  </AlertDialogAction>
                  <AlertDialogAction 
                    onClick={() => {
                      setShowLocationDialog(false);
                      setListingViewMode('top_destinations');
                    }}
                    className="w-full bg-muted text-muted-foreground hover:bg-muted/80"
                  >
                    Continue Without Location
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>;
};
export default Index;