import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Share2, Mail, Wifi, Users, Clock, DollarSign, ArrowLeft, Heart } from "lucide-react";
import { BookHotelDialog } from "@/components/booking/BookHotelDialog";
import { SimilarItems } from "@/components/SimilarItems";


import { useToast } from "@/hooks/use-toast";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselPrevious, 
  CarouselNext 
} from "@/components/ui/carousel";
import { ReviewSection } from "@/components/ReviewSection";
import Autoplay from "embla-carousel-autoplay";

interface Facility {
  name: string;
  price: number;
  capacity: number;
}

interface Activity {
  name: string;
  price: number;
}

interface Hotel {
  id: string;
  name: string;
  location: string;
  place: string;
  country: string;
  image_url: string;
  images: string[];
  gallery_images: string[];
  description: string;
  amenities: string[];
  phone_numbers: string[];
  email: string;
  facilities: Facility[];
  activities: Activity[];
  registration_number: string;
  map_link: string;
  establishment_type: string;
}

const HotelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    fetchHotel();
    checkIfSaved();
  }, [id]);

  const fetchHotel = async () => {
    try {
      const { data, error } = await supabase
        .from("hotels")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setHotel(data as any);
    } catch (error) {
      console.error("Error fetching hotel:", error);
      toast({
        title: "Error",
        description: "Failed to load hotel details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkIfSaved = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || !id) return;
    
    const { data } = await supabase
      .from("saved_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("item_id", id)
      .maybeSingle();
    
    setIsSaved(!!data);
  };

  const handleSave = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to save this hotel",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (isSaved) {
      await supabase
        .from("saved_items")
        .delete()
        .eq("item_id", id)
        .eq("user_id", user.id);
      setIsSaved(false);
      toast({ title: "Removed from wishlist" });
    } else {
      await supabase
        .from("saved_items")
        .insert([{ user_id: user.id, item_id: id, item_type: "hotel" }]);
      setIsSaved(true);
      toast({ title: "Added to wishlist" });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: hotel?.name,
          text: hotel?.description,
          url: window.location.href,
        });
      } catch (error) {
        console.log("Share failed:", error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Hotel link copied to clipboard",
      });
    }
  };

  const openInMaps = () => {
    if (hotel?.map_link) {
      window.open(hotel.map_link, '_blank');
    } else {
      const query = encodeURIComponent(`${hotel?.name}, ${hotel?.location}, ${hotel?.country}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background">Loading...</div>;
  }

  if (!hotel) {
    return <div className="min-h-screen bg-background">Hotel not found</div>;
  }

  const displayImages = hotel.gallery_images?.length > 0 
    ? hotel.gallery_images 
    : hotel.images?.length > 0 
    ? hotel.images 
    : [hotel.image_url];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-6 max-w-6xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {/* Two Column Layout on Large Screens */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column: Image Gallery with border-radius */}
          <div className="w-full relative">
            <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground z-20 text-xs font-bold px-3 py-1">
              HOTEL
            </Badge>
            <Carousel
              opts={{ loop: true }}
              plugins={[Autoplay({ delay: 3000 })]}
              className="w-full rounded-2xl overflow-hidden"
              setApi={(api) => {
                if (api) {
                  api.on("select", () => {
                    setCurrent(api.selectedScrollSnap());
                  });
                }
              }}
            >
              <CarouselContent>
                {displayImages.map((img, idx) => (
                  <CarouselItem key={idx}>
                    <img
                      src={img}
                      alt={`${hotel.name} ${idx + 1}`}
                      className="w-full h-64 md:h-96 object-cover"
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>

              {displayImages.length > 1 && (
                <>
                  <CarouselPrevious 
                    className="left-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" 
                  />
                  <CarouselNext 
                    className="right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" 
                  />
                </>
              )}
              
              {displayImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
                  {displayImages.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === current
                          ? 'bg-white'
                          : 'bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              )}
            </Carousel>
          </div>

          {/* Right Column: Item Details */}
          <div className="flex flex-col gap-4">
            {/* Title and Actions */}
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl md:text-3xl font-bold">{hotel.name}</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                {hotel.location}, {hotel.country}
              </p>
              {hotel.establishment_type && (
                <p className="text-xs text-muted-foreground capitalize">
                  {hotel.establishment_type}
                </p>
              )}
              
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={openInMaps}
                className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600 text-xs md:text-sm"
              >
                <MapPin className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                View on Map
              </Button>
              <Button
                variant="outline"
                onClick={handleShare}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Share2 className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <Button
                variant="outline"
                onClick={handleSave}
                className={isSaved ? "bg-red-500 text-white hover:bg-red-600" : ""}
              >
                <Heart className={`h-4 w-4 md:h-5 md:w-5 ${isSaved ? "fill-current" : ""}`} />
              </Button>
            </div>

            {/* Contact Info - Hidden on small, shown on large */}
            <div className="hidden md:block bg-card p-6 rounded-lg border space-y-3 shadow-sm">
              <h3 className="font-semibold text-base md:text-lg">Contact & Booking</h3>
              
              <div className="pt-2 border-t space-y-3">
                {hotel.phone_numbers && hotel.phone_numbers.map((phone, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Phone className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                    <a href={`tel:${phone}`} className="text-xs md:text-sm">{phone}</a>
                  </div>
                ))}
                {hotel.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                    <a href={`mailto:${hotel.email}`} className="text-xs md:text-sm">{hotel.email}</a>
                  </div>
                )}
              </div>
              
              <Button 
                className="w-full mt-4 text-xs md:text-sm" 
                onClick={() => setBookingOpen(true)}
              >
                Book Now
              </Button>
            </div>
          </div>
        </div>

        {/* Description Below Image Gallery on Left Side */}
        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          {/* About Section - Left Column */}
          <div className="p-4 md:p-6 border rounded-lg bg-card shadow-sm">
            <h2 className="text-lg md:text-xl font-semibold mb-2">About {hotel.name}</h2>
            <p className="text-xs md:text-base text-muted-foreground">{hotel.description}</p>
          </div>

          {/* Right Column - Placeholder or Additional Content */}
          <div></div>
        </div>

        {/* Contact Info for Small Screens - Below Description */}
        <div className="md:hidden mt-6 bg-card p-6 rounded-lg border space-y-3 shadow-sm">
          <h3 className="font-semibold text-base md:text-lg">Contact Information</h3>
          
          <div className="pt-2 border-t space-y-3">
            {hotel.phone_numbers && hotel.phone_numbers.map((phone, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Phone className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                <a href={`tel:${phone}`} className="text-xs md:text-sm">{phone}</a>
              </div>
            ))}
            {hotel.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                <a href={`mailto:${hotel.email}`} className="text-xs md:text-sm">{hotel.email}</a>
              </div>
            )}
          </div>
          
          <Button 
            className="w-full mt-4 text-xs md:text-sm" 
            onClick={() => setBookingOpen(true)}
          >
            Book Now
          </Button>
        </div>

        {/* Amenities and Facilities Below */}
        <div className="space-y-6 mt-6">
          <div className="space-y-6 p-4 md:p-6 border rounded-lg bg-card shadow-sm">

            {/* Amenities Section */}
            {hotel.amenities && hotel.amenities.length > 0 && (
              <div>
                <h2 className="text-lg md:text-xl font-semibold mb-2">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {hotel.amenities.map((amenity, idx) => (
                    <span key={idx} className="bg-secondary px-3 py-1 rounded-full text-xs md:text-sm flex items-center gap-1">
                      <Wifi className="h-3 w-3" />
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Facilities and Activities Section - Side by Side on Large Screens */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Facilities Section */}
              {hotel.facilities && hotel.facilities.length > 0 && (
                <div>
                  <h2 className="text-lg md:text-xl font-semibold mb-3">Available Rooms</h2>
                  <div className="grid gap-3">
                    {hotel.facilities.map((facility, idx) => (
                      <div key={idx} className="border rounded-lg p-4 bg-background">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-xs md:text-base">{facility.name}</h3>
                          <span className="text-base md:text-lg font-bold">
                            <DollarSign className="inline h-4 w-4" />
                            {facility.price}/day
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>Capacity: {facility.capacity} guests</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activities Section */}
              {hotel.activities && hotel.activities.length > 0 && (
                <div>
                  <h2 className="text-lg md:text-xl font-semibold mb-3">Available Activities</h2>
                  <div className="grid gap-3">
                    {hotel.activities.map((activity, idx) => (
                      <div key={idx} className="border rounded-lg p-4 flex justify-between items-center bg-background">
                        <span className="font-medium text-xs md:text-base">{activity.name}</span>
                        <span className="font-bold text-xs md:text-base">
                          <DollarSign className="inline h-4 w-4" />
                          {activity.price}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <ReviewSection itemId={hotel.id} itemType="hotel" />

        {hotel && <SimilarItems currentItemId={hotel.id} itemType="hotel" country={hotel.country} />}
      </main>

      <BookHotelDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        hotel={hotel}
      />

      <MobileBottomBar />
    </div>
  );
};

export default HotelDetail;
