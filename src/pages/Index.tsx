import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";
import { MapView } from "@/components/MapView";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Calendar, Hotel, Tent, Compass, Map, Grid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";



const Index = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [listings, setListings] = useState<any[]>([]);
    const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const { toast } = useToast();
    const { position } = useGeolocation();
    const [isSearchVisible, setIsSearchVisible] = useState(true);
    const [showSearchIcon, setShowSearchIcon] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const [scrollableRows, setScrollableRows] = useState<{ trips: any[], hotels: any[], attractions: any[], campsites: any[] }>({ trips: [], hotels: [], attractions: [], campsites: [] });
    const [nearbyPlacesHotels, setNearbyPlacesHotels] = useState<any[]>([]);
    const [loadingScrollable, setLoadingScrollable] = useState(true);
    const [loadingNearby, setLoadingNearby] = useState(true);
    const [bookingStats, setBookingStats] = useState<Record<string, number>>({});
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const fetchScrollableRows = async () => {
        setLoadingScrollable(true);
        try {
            const [tripsData, hotelsData, attractionsData, campsitesData] = await Promise.all([
                supabase.from("trips").select("*").eq("approval_status", "approved").eq("is_hidden", false).limit(10),
                supabase.from("hotels").select("*").eq("approval_status", "approved").eq("is_hidden", false).limit(10),
                supabase.from("attractions").select("*").eq("approval_status", "approved").eq("is_hidden", false).limit(10),
                supabase.from("adventure_places").select("*").eq("approval_status", "approved").eq("is_hidden", false).limit(10)
            ]);

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
                attractions: {
                    count: attractionsData.data?.length || 0,
                    error: attractionsData.error,
                    data: attractionsData.data
                },
                campsites: {
                    count: campsitesData.data?.length || 0,
                    error: campsitesData.error,
                    data: campsitesData.data
                }
            });

            setScrollableRows({
                trips: tripsData.data || [],
                hotels: hotelsData.data || [],
                attractions: attractionsData.data || [],
                campsites: campsitesData.data || []
            });
            
            // Fetch booking statistics for trips/events
            const tripIds = (tripsData.data || []).map((trip: any) => trip.id);
            if (tripIds.length > 0) {
                const { data: bookingsData } = await supabase
                    .from('bookings')
                    .select('item_id, slots_booked')
                    .in('item_id', tripIds)
                    .in('status', ['confirmed', 'pending']);
                
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

        const [placesData, hotelsData] = await Promise.all([
            supabase.from("adventure_places").select("*").eq("approval_status", "approved").eq("is_hidden", false).limit(20),
            supabase.from("hotels").select("*").eq("approval_status", "approved").eq("is_hidden", false).limit(20)
        ]);

        const combined = [
            ...(placesData.data || []).map(item => ({ ...item, table: "adventure_places", category: "Adventure Place" })),
            ...(hotelsData.data || []).map(item => ({ ...item, table: "hotels", category: "Hotel" }))
        ];

        const nearby = combined.slice(0, 12);
        setNearbyPlacesHotels(nearby);
        // Only set loading to false if we have data
        if (nearby.length > 0) {
            setLoadingNearby(false);
        }
    };

    const fetchAllData = async (query?: string) => {
        setLoading(true);

        const fetchTable = async (table: "trips" | "hotels" | "adventure_places" | "attractions", type: string) => {
            let dbQuery = supabase.from(table).select("*").eq("approval_status", "approved").eq("is_hidden", false);
            if (query) {
                // Search in name, location, country, and activities
                const searchPattern = `%${query}%`;
                if (table === "attractions") {
                    dbQuery = dbQuery.or(`location_name.ilike.${searchPattern},country.ilike.${searchPattern}`);
                } else {
                    dbQuery = dbQuery.or(`name.ilike.${searchPattern},location.ilike.${searchPattern},country.ilike.${searchPattern}`);
                }
            }
            const { data } = await dbQuery;
            
            if (table === "attractions") {
                return (data || []).map((item: any) => ({ 
                    ...item, 
                    type,
                    name: item.local_name || item.location_name,
                    location: item.location_name,
                    image_url: item.photo_urls?.[0] || ""
                }));
            }
            return (data || []).map((item: any) => ({ ...item, type }));
        };

        const [trips, hotels, adventures, attractions] = await Promise.all([
            fetchTable("trips", "TRIP"),
            fetchTable("hotels", "HOTEL"),
            fetchTable("adventure_places", "ADVENTURE PLACE"),
            fetchTable("attractions", "ATTRACTION")
        ]);

        let combined = [...trips, ...hotels, ...adventures, ...attractions];

        if (position) {
            combined = combined.sort((a, b) => {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
        } else {
            combined = combined.sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
        }

        setListings(combined);
        setLoading(false);
    };

    useEffect(() => {
        fetchAllData();
        fetchScrollableRows();
        const initUserId = async () => {
            const id = await getUserId();
            setUserId(id);
            if (id) {
                const { data } = await supabase.from("saved_items").select("item_id").eq("user_id", id);
                if (data) setSavedItems(new Set(data.map(item => item.item_id)));
            }
        };
        initUserId();
    }, []);

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
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };


    const handleSave = async (itemId: string, itemType: string) => {
        if (!userId) {
            toast({ title: "Login required", variant: "destructive" });
            return;
        }
        const isSaved = savedItems.has(itemId);
        if (isSaved) {
            await supabase.from("saved_items").delete().eq("item_id", itemId).eq("user_id", userId);
            setSavedItems(prev => { const newSet = new Set(prev); newSet.delete(itemId); return newSet; });
        } else {
            await supabase.from("saved_items").insert([{ user_id: userId, item_id: itemId, item_type: itemType }]);
            setSavedItems(prev => new Set([...prev, itemId]));
        }
    };

    const categories = [
        { icon: Calendar, title: "Trips", path: "/category/trips", bgImage: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800", description: "Explore guided tours and day trips" },
        { icon: Compass, title: "Attractions", path: "/category/adventure", bgImage: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800", description: "Visit must-see landmarks" },
        { icon: Hotel, title: "Hotels", path: "/category/hotels", bgImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800", description: "Find comfortable stays" },
        { icon: Tent, title: "Campsite & Experience", path: "/category/campsite", bgImage: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800", description: "Adventure camping spots" },
    ];

    return (
        <div className="min-h-screen bg-background pb-20 md:pb-0">
            <Header onSearchClick={handleSearchIconClick} showSearchIcon={showSearchIcon} />
            
            {/* Search Bar - Appears below header when focused on mobile */}
            {isSearchFocused && (
                <div className="md:hidden sticky top-[64px] z-[100] bg-background p-4 border-b shadow-md">
                    <SearchBarWithSuggestions 
                        value={searchQuery} 
                        onChange={setSearchQuery} 
                        onSubmit={() => {
                            fetchAllData(searchQuery);
                            setIsSearchFocused(false);
                        }}
                        onSuggestionSearch={(query) => {
                            fetchAllData(query);
                            setIsSearchFocused(false);
                        }}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => {
                            // Only blur if search query is empty
                            if (!searchQuery) {
                                setTimeout(() => setIsSearchFocused(false), 200);
                            }
                        }}
                    />
                </div>
            )}

            <main className={`container px-0 md:px-4 py-0 md:py-8 ${isSearchFocused ? 'md:block hidden' : ''}`}>
                <section className="flex flex-col gap-1 md:gap-3">
                {/* Hero Section with Background Image */}
                    <div className="w-full">
                        <div 
                            className="relative w-full overflow-hidden flex flex-col items-center justify-center p-4 md:p-12 py-12 md:py-24"
                            style={{
                                backgroundImage: 'url(https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920)',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            }}
                        >
                            {/* Overlay for better text readability */}
                            <div className="absolute inset-0 bg-black/40" />
                            
                            {/* Content */}
                            <div className="relative z-10 flex flex-col items-center gap-4 md:gap-6 max-w-3xl mx-auto">
                                <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-2 md:mb-4 text-center drop-shadow-lg">
                                    Discover Your Next Adventure
                                </h1>
                                
                                {/* Search Bar Below Paragraph */}
                                <div className="w-full mt-2 md:mt-4 relative z-[200]">
                                    <SearchBarWithSuggestions 
                                        value={searchQuery} 
                                        onChange={setSearchQuery} 
                                        onSubmit={() => fetchAllData(searchQuery)}
                                        onSuggestionSearch={(query) => fetchAllData(query)}
                                        onFocus={() => setIsSearchFocused(true)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Categories Section - Below on all screens */}
                    <div className="w-full px-2 md:px-0">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-4">
                            {categories.map((cat) => (
                                <div
                                    key={cat.title}
                                    onClick={() => navigate(cat.path)}
                                    className="relative h-16 md:h-40 lg:h-48 cursor-pointer overflow-hidden group rounded-lg"
                                    style={{ backgroundImage: `url(${cat.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                                >
                                    <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-all flex flex-col items-center justify-center p-2 md:p-4">
                                        <cat.icon className="h-4 w-4 md:h-12 md:w-12 lg:h-16 lg:w-16 text-white mb-0.5 md:mb-3" />
                                        <h3 className="font-bold text-white text-3xs md:text-base lg:text-lg">{cat.title}</h3>
                                        <p className="text-white/80 text-2xs md:text-sm text-center mt-0.5 md:mt-1 hidden md:block">{cat.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                <div className="px-4">
                    {/* Latest - MODIFIED FOR HORIZONTAL SCROLLING OR MAP VIEW */}
                    <section className="mb-4 md:mb-8">
                        <div className="flex justify-between items-center mb-2 md:mb-4 mt-2 md:mt-0">
                            <h2 className="text-xs md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                {searchQuery ? 'Search Results' : 'Latest'}
                            </h2>
                            {searchQuery && listings.length > 0 && (
                                <div className="flex gap-2">
                                    <Button
                                        variant={viewMode === 'list' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setViewMode('list')}
                                        className="gap-1"
                                    >
                                        <Grid className="h-4 w-4" />
                                        <span className="hidden md:inline">List</span>
                                    </Button>
                                    <Button
                                        variant={viewMode === 'map' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setViewMode('map')}
                                        className="gap-1"
                                    >
                                        <Map className="h-4 w-4" />
                                        <span className="hidden md:inline">Map</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                        
                        {searchQuery && viewMode === 'map' ? (
                            <MapView listings={listings} />
                        ) : searchQuery ? (
                            // Column grid view for search results
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {loading ? (
                                    [...Array(12)].map((_, i) => (
                                        <ListingSkeleton key={i} />
                                    ))
                                ) : listings.length === 0 ? (
                                    <div className="col-span-full text-center py-12">
                                        <p className="text-muted-foreground text-lg">No results found for "{searchQuery}"</p>
                                        <p className="text-muted-foreground text-sm mt-2">Try searching with different keywords</p>
                                    </div>
                                ) : (
                                    listings.map((item, index) => (
                                        <ListingCard
                                            key={item.id}
                                            id={item.id}
                                            type={item.type}
                                            name={item.name}
                                            imageUrl={item.image_url}
                                            location={item.location}
                                            country={item.country}
                                            price={item.price || item.entry_fee || item.price_adult || 0}
                                            date={item.date}
                                            isCustomDate={item.is_custom_date}
                                            onSave={handleSave}
                                            isSaved={savedItems.has(item.id)}
                                            hidePrice={item.type === "HOTEL" || item.type === "ADVENTURE PLACE"}
                                            showBadge={true}
                                            priority={index < 4}
                                        />
                                    ))
                                )}
                            </div>
                        ) : (
                            // Horizontal scroll view for latest items (when not searching)
                            <div className="flex gap-2 md:gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory md:snap-none">
                                {loading || listings.length === 0 ? (
                                    [...Array(10)].map((_, i) => (
                                        <div key={i} className="flex-shrink-0 w-[85vw] md:w-64 rounded-lg overflow-hidden shadow-md snap-center md:snap-align-none">
                                            <div className="aspect-[4/3] bg-muted animate-pulse" />
                                            <div className="p-2 md:p-4 space-y-2 md:space-y-3">
                                                <div className="h-4 md:h-5 bg-muted animate-pulse rounded w-4/5" />
                                                <div className="h-3 md:h-4 bg-muted animate-pulse rounded w-2/3" />
                                                <div className="h-3 md:h-4 bg-muted animate-pulse rounded w-1/2" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    listings.map((item, index) => (
                                        <div key={item.id} className="flex-shrink-0 w-[85vw] md:w-64 snap-center md:snap-align-none">
                                            <ListingCard
                                                id={item.id}
                                                type={item.type}
                                                name={item.name}
                                                imageUrl={item.image_url}
                                                location={item.location}
                                                country={item.country}
                                                price={item.price || item.entry_fee || 0}
                                                date={item.date}
                                                isCustomDate={item.is_custom_date}
                                                onSave={handleSave}
                                                isSaved={savedItems.has(item.id)}
                                                hidePrice={true}
                                                showBadge={true}
                                                priority={index === 0}
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </section>


                    <hr className="border-t border-gray-200 my-2 md:my-6" />

                    {/* Featured Campsite & Experience */}
                    <section className="mb-3 md:mb-8">
                        <div className="flex justify-between items-center mb-2 md:mb-4">
                            <h2 className="text-xs md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                Featured Campsite & Experience
                            </h2>
                            <Link to="/category/campsite" className="text-primary text-3xs md:text-sm hover:underline">
                                View All
                            </Link>
                        </div>
                        <div className="flex gap-2 md:gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory md:snap-none">
                            {loadingScrollable ? (
                                <div className="flex gap-2 md:gap-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="flex-shrink-0 w-[85vw] md:w-64 snap-center md:snap-align-none">
                                            <ListingSkeleton />
                                        </div>
                                    ))}
                                </div>
                            ) : scrollableRows.campsites.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8 w-full">No campsites available</p>
            ) : (
                scrollableRows.campsites.map((place, index) => (
                                    <div key={place.id} className="flex-shrink-0 w-[85vw] md:w-64 snap-center md:snap-align-none">
                                        <ListingCard
                                            id={place.id}
                                            type="ADVENTURE PLACE"
                                            name={place.name}
                                            imageUrl={place.image_url}
                                            location={place.location}
                                            country={place.country}
                                            price={place.entry_fee || 0}
                                            date=""
                                            onSave={handleSave}
                                            isSaved={savedItems.has(place.id)}
                                            hidePrice={true}
                                            priority={index === 0}
                                        />
                                    </div>
                ))
            )}
                        </div>
                    </section>

                    {/* Featured Hotels */}
                    <section className="mb-3 md:mb-8">
                        <div className="flex justify-between items-center mb-2 md:mb-4">
                            <h2 className="text-xs md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                Featured Hotels
                            </h2>
                            <Link to="/category/hotels" className="text-primary text-3xs md:text-sm hover:underline">
                                View All
                            </Link>
                        </div>
                        <div className="flex gap-2 md:gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory md:snap-none">
                            {loadingScrollable ? (
                                <div className="flex gap-2 md:gap-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="flex-shrink-0 w-[85vw] md:w-64 snap-center md:snap-align-none">
                                            <ListingSkeleton />
                                        </div>
                                    ))}
                                </div>
                            ) : scrollableRows.hotels.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8 w-full">No hotels available</p>
                            ) : (
                scrollableRows.hotels.map((hotel) => (
                                    <div key={hotel.id} className="flex-shrink-0 w-[85vw] md:w-64 snap-center md:snap-align-none">
                                        <ListingCard
                                            id={hotel.id}
                                            type="HOTEL"
                                            name={hotel.name}
                                            imageUrl={hotel.image_url}
                                            location={hotel.location}
                                            country={hotel.country}
                                            price={0}
                                            date=""
                                            onSave={handleSave}
                                            isSaved={savedItems.has(hotel.id)}
                                            hidePrice={true}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Featured Attractions */}
                    <section className="mb-3 md:mb-8">
                        <div className="flex justify-between items-center mb-2 md:mb-4">
                            <h2 className="text-xs md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                Featured Attractions
                            </h2>
                            <Link to="/category/adventure" className="text-primary text-3xs md:text-sm hover:underline">
                                View All
                            </Link>
                        </div>
                        <div className="flex gap-2 md:gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory md:snap-none">
                            {loadingScrollable ? (
                                <div className="flex gap-2 md:gap-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="flex-shrink-0 w-[85vw] md:w-64 snap-center md:snap-align-none">
                                            <ListingSkeleton />
                                        </div>
                                    ))}
                                </div>
                            ) : scrollableRows.attractions.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8 w-full">No attractions available</p>
                            ) : (
                scrollableRows.attractions.map((attraction) => (
                                    <div key={attraction.id} className="flex-shrink-0 w-[85vw] md:w-64 snap-center md:snap-align-none">
                                        <ListingCard
                                            id={attraction.id}
                                            type="ATTRACTION"
                                            name={attraction.local_name || attraction.location_name}
                                            imageUrl={attraction.photo_urls?.[0] || ""}
                                            location={attraction.location_name}
                                            country={attraction.country}
                                            price={attraction.price_adult || 0}
                                            date=""
                                            onSave={handleSave}
                                            isSaved={savedItems.has(attraction.id)}
                                            hidePrice={true}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <hr className="border-t border-gray-200 my-2 md:my-6" />

                    {/* Featured Trips Only Section */}
                    <section className="mb-3 md:mb-8">
                        <div className="flex justify-between items-center mb-2 md:mb-4">
                            <h2 className="text-xs md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                Featured Trips
                            </h2>
                            <Link to="/category/trips" className="text-primary text-3xs md:text-sm hover:underline">
                                View All
                            </Link>
                        </div>
                        <div className="flex gap-2 md:gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory md:snap-none">
                            {loadingScrollable ? (
                                <div className="flex gap-2 md:gap-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="flex-shrink-0 w-[85vw] md:w-64 snap-center md:snap-align-none">
                                            <ListingSkeleton />
                                        </div>
                                    ))}
                                </div>
                            ) : scrollableRows.trips.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8 w-full">No trips available</p>
                            ) : (
                                scrollableRows.trips.map((trip) => {
                                    const isEvent = trip.type === "event";
                                    return (
                                    <div key={trip.id} className="flex-shrink-0 w-[85vw] md:w-64 snap-center md:snap-align-none">
                                        <ListingCard
                                            id={trip.id}
                                            type={isEvent ? "EVENT" : "TRIP"}
                                            name={trip.name}
                                            imageUrl={trip.image_url}
                                            location={trip.location}
                                            country={trip.country}
                                            price={trip.price}
                                            date={trip.date}
                                            isCustomDate={trip.is_custom_date}
                                            onSave={handleSave}
                                            isSaved={savedItems.has(trip.id)}
                                            availableTickets={isEvent ? trip.available_tickets : undefined}
                                            bookedTickets={isEvent ? (bookingStats[trip.id] || 0) : undefined}
                                        />
                                    </div>
                                )})
                            )}
                        </div>
                    </section>

                    <hr className="border-t border-gray-200 my-4 md:my-8" />

                    {/* Nearby Places/Hotels */}
                    <section className="mb-8">
                        <h2 className="text-sm md:text-2xl font-bold mb-4 whitespace-nowrap overflow-hidden text-ellipsis">
                            Near You
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {loadingNearby ? (
                                [...Array(12)].map((_, i) => (
                                    <ListingSkeleton key={i} />
                                ))
                            ) : nearbyPlacesHotels.length > 0 ? (
                                nearbyPlacesHotels.map((item) => (
                                    <ListingCard
                                        key={item.id}
                                        id={item.id}
                                        type={item.table === "hotels" ? "HOTEL" : "ADVENTURE PLACE"}
                                        name={item.name}
                                        imageUrl={item.image_url}
                                        location={item.location}
                                        country={item.country}
                                        price={item.table === "hotels" ? 0 : item.entry_fee || 0}
                                        onSave={handleSave}
                                        isSaved={savedItems.has(item.id)}
                                        hidePrice={true}
                                        showBadge={true}
                                    />
                                ))
                            ) : (
                                <p className="col-span-full text-muted-foreground text-center">No nearby places found</p>
                            )}
                        </div>
                    </section>

                    {/* Vlogs Section */}
                    <section className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-sm md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                Travel Vlogs
                            </h2>
                            <Link to="/vlog" className="text-primary text-3xs md:text-sm hover:underline">
                                View All
                            </Link>
                        </div>
                        <div className="flex gap-2 md:gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory md:snap-none">
                            {[
                                {
                                    id: "1",
                                    title: "Exploring the Swiss Alps",
                                    description: "Join us on an incredible journey through the majestic Swiss Alps",
                                    image_url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&h=600&fit=crop"
                                },
                                {
                                    id: "2",
                                    title: "Tokyo Street Food Adventure",
                                    description: "Dive into the vibrant food culture of Tokyo",
                                    image_url: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&h=600&fit=crop"
                                },
                                {
                                    id: "3",
                                    title: "Safari Adventure in Kenya",
                                    description: "Witness the incredible wildlife of Kenya",
                                    image_url: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800&h=600&fit=crop"
                                },
                                {
                                    id: "4",
                                    title: "Diving the Great Barrier Reef",
                                    description: "Explore the underwater wonders of Australia",
                                    image_url: "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800&h=600&fit=crop"
                                },
                                {
                                    id: "5",
                                    title: "Northern Lights in Iceland",
                                    description: "Chase the aurora borealis across Iceland",
                                    image_url: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=800&h=600&fit=crop"
                                }
                            ].map((vlog) => (
                                <div key={vlog.id} className="flex-shrink-0 w-[85vw] md:w-64 snap-center md:snap-align-none">
                                    <Card className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden h-full">
                                        <img
                                            src={vlog.image_url}
                                            alt={vlog.title}
                                            className="w-full h-48 object-cover"
                                        />
                                        <div className="p-4">
                                            <h3 className="font-bold text-base mb-2 line-clamp-1">{vlog.title}</h3>
                                            <p className="text-sm text-muted-foreground line-clamp-2">{vlog.description}</p>
                                        </div>
                                    </Card>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
            <Footer />
            <MobileBottomBar />
        </div>
    );
};

export default Index;