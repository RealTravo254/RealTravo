import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { ListingCard } from "@/components/ListingCard";
import { Footer } from "@/components/Footer";
import { Calendar, Hotel, Mountain, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";

const ImageSlideshow = () => {
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
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    const slide = slides[currentSlide];

    return (
        <div className="relative w-full aspect-[16/9] md:aspect-video lg:aspect-[2/1] overflow-hidden bg-gray-200">
            <img src={slide.imageUrl} alt={slide.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-blue-900/60 flex flex-col justify-end p-4 md:p-6 lg:p-8">
                <h3 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-white mb-1 md:mb-2">{slide.name}</h3>
                <p className="text-sm md:text-base lg:text-lg text-blue-200 mb-2 md:mb-4">{slide.description}</p>
            </div>
            <div className="absolute bottom-2 md:bottom-4 right-2 md:right-4 flex space-x-2">
                {slides.map((_, index) => (
                    <div
                        key={index}
                        className={`h-2 w-2 rounded-full transition-all ${index === currentSlide ? "bg-white scale-125" : "bg-white/50"}`}
                        onClick={() => setCurrentSlide(index)}
                    />
                ))}
            </div>
        </div>
    );
};

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
    const [scrollableRows, setScrollableRows] = useState<{ trips: any[], events: any[], hotels: any[] }>({ trips: [], events: [], hotels: [] });
    const [accommodations, setAccommodations] = useState<any[]>([]);
    const [nearbyPlacesHotels, setNearbyPlacesHotels] = useState<any[]>([]);
    const [loadingScrollable, setLoadingScrollable] = useState(true);
    const [loadingNearby, setLoadingNearby] = useState(true);

    const fetchScrollableRows = async () => {
        setLoadingScrollable(true);
        const [hotelsData, accommodationsData] = await Promise.all([
            supabase.from("hotels").select("*").eq("approval_status", "approved").eq("is_hidden", false).limit(10),
            supabase.from("accommodations").select("*").eq("approval_status", "approved").eq("is_hidden", false).limit(10)
        ]);

        setScrollableRows({
            trips: [],
            events: [],
            hotels: hotelsData.data || []
        });

        // Store accommodations separately
        setAccommodations(accommodationsData.data || []);
        
        // Only set loading to false if we have data
        if ((hotelsData.data && hotelsData.data.length > 0) || (accommodationsData.data && accommodationsData.data.length > 0)) {
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

        const nearby = combined.slice(0, 10);
        setNearbyPlacesHotels(nearby);
        // Only set loading to false if we have data
        if (nearby.length > 0) {
            setLoadingNearby(false);
        }
    };

    const fetchAllData = async (query?: string) => {
        setLoading(true);

        const fetchTable = async (table: "trips" | "events" | "hotels" | "adventure_places", type: string) => {
            let dbQuery = supabase.from(table).select("*").eq("approval_status", "approved").eq("is_hidden", false);
            if (query) {
                dbQuery = dbQuery.or(`name.ilike.%${query}%,location.ilike.%${query}%,country.ilike.%${query}%`);
            }
            const { data } = await dbQuery;
            return (data || []).map((item: any) => ({ ...item, type }));
        };

        const [trips, events, hotels, adventures] = await Promise.all([
            fetchTable("trips", "TRIP"),
            fetchTable("events", "EVENT"),
            fetchTable("hotels", "HOTEL"),
            fetchTable("adventure_places", "ADVENTURE PLACE")
        ]);

        let combined = [...trips, ...events, ...hotels, ...adventures];

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
            if (window.innerWidth < 768) {
                if (currentScrollY > 200) {
                    setIsSearchVisible(false);
                    setShowSearchIcon(true);
                } else {
                    setIsSearchVisible(true);
                    setShowSearchIcon(false);
                }
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
        { icon: Calendar, title: "Trips", path: "/category/trips", bgImage: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800" },
        { icon: PartyPopper, title: "Events", path: "/category/events", bgImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800" },
        { icon: Hotel, title: "Hotels", path: "/category/hotels", bgImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800" },
        { icon: Mountain, title: "Adventure", path: "/category/adventure", bgImage: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800" },
    ];

    return (
        <div className="min-h-screen bg-background pb-20 md:pb-0">
            <Header onSearchClick={handleSearchIconClick} showSearchIcon={showSearchIcon} />
            <div
                ref={searchRef}
                className={`sticky top-0 md:top-16 z-40 bg-background border-b shadow-sm transition-all duration-300 ${
                    isSearchVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
                }`}
            >
                <div className="container px-4 py-4">
                    <SearchBarWithSuggestions value={searchQuery} onChange={setSearchQuery} onSubmit={() => fetchAllData(searchQuery)} />
                </div>
            </div>
            <main className="container px-0 md:px-4 py-0 md:py-8">
                <section className="flex flex-col lg:flex-row gap-4 md:gap-6">
                    <div className="w-full lg:w-1/3 order-2 lg:order-1 flex"> {/* Added flex to make the categories container stretch */}
                        <div className="grid grid-cols-2 gap-2 md:gap-0 lg:gap-4 w-full px-2 md:px-0"> {/* Added lg:gap-4 for column/row gap, and w-full */}
                            {categories.map((cat) => (
                                <div
                                    key={cat.title}
                                    onClick={() => navigate(cat.path)}
                                    // Adjusted class to make boxes bigger on lg, remove fixed h-24 on lg, and enforce aspect-square
                                    className="relative h-24 lg:h-full lg:aspect-square cursor-pointer overflow-hidden group"
                                    style={{ backgroundImage: `url(${cat.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                                >
                                    <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-all flex flex-col items-center justify-center p-4">
                                        <cat.icon className="h-6 w-6 md:h-12 md:w-12 text-white mb-1 md:mb-2" />
                                        <h3 className="font-bold text-white text-xs md:text-lg">{cat.title}</h3>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="w-full lg:w-2/3 order-1 lg:order-2">
                        <ImageSlideshow />
                    </div>
                </section>
                <div className="px-4">
                    {/* Main Listings - First - MODIFIED FOR HORIZONTAL SCROLLING */}
                    <section className="mb-8">
                        {/* Modified h2 for smaller font on small screens and added top margin */}
                        <h2 className="text-sm md:text-2xl font-bold mb-4 mt-4 md:mt-0 whitespace-nowrap overflow-hidden text-ellipsis">
                            Featured Trips & Events
                        </h2>
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                            {loading ? (
                                [...Array(10)].map((_, i) => (
                                    <div key={i} className="flex-shrink-0 w-64 rounded-lg overflow-hidden shadow-lg">
                                        <div className="aspect-[4/3] bg-muted animate-pulse" />
                                        <div className="p-4 space-y-2">
                                            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                listings.map((item) => (
                                    <div key={item.id} className="flex-shrink-0 w-64">
                                        <ListingCard
                                            id={item.id}
                                            type={item.type}
                                            name={item.name}
                                            imageUrl={item.image_url}
                                            location={item.location}
                                            country={item.country}
                                            price={item.price || item.entry_fee || 0}
                                            date={item.date}
                                            onSave={handleSave}
                                            isSaved={savedItems.has(item.id)}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </section>


                    <hr className="border-t border-gray-200 my-4 md:my-8" />

                    {/* Featured Places */}
                    <section className="mb-4 md:mb-8">
                        {/* Modified h2 for smaller font on small screens */}
                        <h2 className="text-sm md:text-2xl font-bold mb-4 whitespace-nowrap overflow-hidden text-ellipsis">
                            Featured Places
                        </h2>
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                            {loadingScrollable ? (
                                [...Array(5)].map((_, i) => (
                                    <div key={i} className="flex-shrink-0 w-64">
                                        <div className="aspect-[4/3] bg-muted animate-pulse rounded-lg" />
                                        <div className="h-4 bg-muted animate-pulse rounded mt-2 w-3/4" />
                                        <div className="h-3 bg-muted animate-pulse rounded mt-1 w-1/2" />
                                    </div>
                                ))
                            ) : (
                                nearbyPlacesHotels.filter((item) => item.table === "adventure_places").slice(0, 10).map((place) => (
                                    <div key={place.id} className="flex-shrink-0 w-64">
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
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Featured Hotels */}
                    <section className="mb-4 md:mb-8">
                        {/* Modified h2 for smaller font on small screens */}
                        <h2 className="text-sm md:text-2xl font-bold mb-4 whitespace-nowrap overflow-hidden text-ellipsis">
                            Featured Hotels
                        </h2>
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                            {loadingScrollable ? (
                                [...Array(5)].map((_, i) => (
                                    <div key={i} className="flex-shrink-0 w-64">
                                        <div className="aspect-[4/3] bg-muted animate-pulse rounded-lg" />
                                        <div className="h-4 bg-muted animate-pulse rounded mt-2 w-3/4" />
                                        <div className="h-3 bg-muted animate-pulse rounded mt-1 w-1/2" />
                                    </div>
                                ))
                            ) : (
                                scrollableRows.hotels.map((hotel) => (
                                    <div key={hotel.id} className="flex-shrink-0 w-64">
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
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Featured Accommodations */}
                    <section className="mb-4 md:mb-8">
                        <h2 className="text-sm md:text-2xl font-bold mb-4 whitespace-nowrap overflow-hidden text-ellipsis">
                            Featured Accommodations
                        </h2>
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                            {loadingScrollable ? (
                                [...Array(5)].map((_, i) => (
                                    <div key={i} className="flex-shrink-0 w-64">
                                        <div className="aspect-[4/3] bg-muted animate-pulse rounded-lg" />
                                        <div className="h-4 bg-muted animate-pulse rounded mt-2 w-3/4" />
                                        <div className="h-3 bg-muted animate-pulse rounded mt-1 w-1/2" />
                                    </div>
                                ))
                            ) : (
                                accommodations.map((accommodation) => (
                                    <div key={accommodation.id} className="flex-shrink-0 w-64">
                                        <ListingCard
                                            id={accommodation.id}
                                            type="ACCOMMODATION"
                                            name={accommodation.name}
                                            imageUrl={accommodation.image_url}
                                            location={accommodation.location}
                                            country={accommodation.country}
                                            price={accommodation.price || 0}
                                            date=""
                                            onSave={handleSave}
                                            isSaved={savedItems.has(accommodation.id)}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Nearby Places/Hotels */}
                    <section className="mb-8">
                        {/* Modified h2 for smaller font on small screens */}
                        <h2 className="text-sm md:text-2xl font-bold mb-4 whitespace-nowrap overflow-hidden text-ellipsis">
                            Near You
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {loadingNearby ? (
                                [...Array(10)].map((_, i) => (
                                    <div key={i}>
                                        <div className="aspect-square bg-muted animate-pulse rounded-lg" />
                                        <div className="h-4 bg-muted animate-pulse rounded mt-2 w-3/4" />
                                    </div>
                                ))
                            ) : nearbyPlacesHotels.length > 0 ? (
                                nearbyPlacesHotels.map((item) => (
                                    <div
                                        key={item.id}
                                        className="cursor-pointer"
                                        onClick={() => navigate(item.table === "hotels" ? `/hotel/${item.id}` : `/adventure/${item.id}`)}
                                    >
                                        <div className="relative aspect-square overflow-hidden rounded-lg">
                                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                            <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded-full text-xs">
                                                {item.category}
                                            </div>
                                        </div>
                                        <h3 className="font-semibold mt-2 text-sm">{item.name}</h3>
                                    </div>
                                ))
                            ) : (
                                <p className="col-span-full text-muted-foreground text-center">No nearby places found</p>
                            )}
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