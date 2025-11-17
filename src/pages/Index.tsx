import { useState, useEffect } from "react";
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
    <div className="relative w-full aspect-video lg:aspect-[2/1] overflow-hidden bg-gray-200">
      <img src={slide.imageUrl} alt={slide.name} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-blue-900/60 flex flex-col justify-end p-6 md:p-8">
        <h3 className="text-3xl font-extrabold text-white mb-2">{slide.name}</h3>
        <p className="text-lg text-blue-200 mb-4">{slide.description}</p>
      </div>
      <div className="absolute bottom-4 right-4 flex space-x-2">
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

  useEffect(() => {
    fetchAllData();
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

  const fetchAllData = async (query?: string) => {
    setLoading(true);

    // Fetch each table separately with explicit table names for TypeScript
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

    const combined = [...trips, ...events, ...hotels, ...adventures].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setListings(combined);
    setLoading(false);
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
      <Header />
      <div className="sticky top-0 md:top-16 z-40 bg-background border-b shadow-sm">
        <div className="container px-4 py-4">
          <SearchBarWithSuggestions value={searchQuery} onChange={setSearchQuery} onSubmit={() => fetchAllData(searchQuery)} />
        </div>
      </div>
      <main className="container px-0 md:px-4 py-0 md:py-8">
        <section className="flex flex-col lg:flex-row gap-4 md:gap-6">
          <div className="w-full lg:w-1/3 order-2 lg:order-1">
            <div className="grid grid-cols-2 gap-2 md:gap-0 px-2 md:px-0">
              {categories.map((cat) => (
                <div
                  key={cat.title}
                  onClick={() => navigate(cat.path)}
                  className="relative h-24 lg:aspect-square cursor-pointer overflow-hidden group"
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
          <hr className="border-t border-gray-200 my-8" />
          <section>
            <div className="bg-blue-950 text-white w-full py-3 mb-6 px-4">
              <h2 className="font-bold text-xl lg:text-2xl">Popular Picks and Recent Finds</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <div key={i} className="shadow-lg">
                    <div className="aspect-[4/3] bg-muted animate-pulse" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                    </div>
                  </div>
                ))
              ) : (
                listings.map((item) => (
                  <ListingCard
                    key={item.id}
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
                ))
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
