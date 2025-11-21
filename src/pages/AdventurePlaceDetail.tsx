import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Share2, Mail, DollarSign, Wifi, ArrowLeft } from "lucide-react"; // Added Wifi for amenity icon
import { BookAdventureDialog } from "@/components/booking/BookAdventureDialog";
import { SimilarItems } from "@/components/SimilarItems";
import { AvailabilityCalendar } from "@/components/booking/AvailabilityCalendar";
import { LiveViewerCount } from "@/components/LiveViewerCount";
import { useToast } from "@/hooks/use-toast";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface Facility {
  name: string;
  price: number;
}

interface Activity {
  name: string;
  price: number;
}

interface AdventurePlace {
  id: string;
  name: string;
  location: string;
  place: string;
  country: string;
  image_url: string;
  images: string[];
  gallery_images: string[];
  description: string;
  entry_fee: number;
  entry_fee_type: string;
  phone_numbers: string[];
  email: string;
  facilities: Facility[];
  activities: Activity[];
  amenities: string[];
  registration_number: string;
  map_link: string;
}

const AdventurePlaceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [place, setPlace] = useState<AdventurePlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  // State for current slide index to implement custom dots
  const [current, setCurrent] = useState(0); 

  useEffect(() => {
    fetchPlace();
  }, [id]);

  const fetchPlace = async () => {
    try {
      const { data, error } = await supabase
        .from("adventure_places")
        .select("id, name, location, place, country, image_url, description, email, phone_numbers, amenities, activities, facilities, entry_fee, entry_fee_type, map_link, gallery_images, images, approval_status, created_at, created_by, is_hidden, allowed_admin_emails")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPlace(data as any);
    } catch (error) {
      console.error("Error fetching adventure place:", error);
      toast({
        title: "Error",
        description: "Failed to load place details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: place?.name,
          text: place?.description,
          url: window.location.href,
        });
      } catch (error) {
        console.log("Share failed:", error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Place link copied to clipboard",
      });
    }
  };

  const openInMaps = () => {
    if (place?.map_link) {
      window.open(place.map_link, '_blank');
    } else {
      const query = encodeURIComponent(`${place?.name}, ${place?.location}, ${place?.country}`);
      // NOTE: Fixed the incorrect URL structure here for Google Maps
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background">Loading...</div>;
  }

  if (!place) {
    return <div className="min-h-screen bg-background">Place not found</div>;
  }

  const displayImages = place.gallery_images?.length > 0 
    ? place.gallery_images 
    : place.images?.length > 0 
    ? place.images 
    : [place.image_url];

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
        {/* Image Gallery Carousel */}
        <div className="w-full mb-6">
          <Carousel
            opts={{ loop: true }}
            plugins={[Autoplay({ delay: 3000 })]}
            className="w-full"
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
                    alt={`${place.name} ${idx + 1}`}
                    className="w-full h-64 md:h-96 object-cover"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious 
              className="left-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" 
            />
            <CarouselNext 
              className="right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" 
            />
            
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

        {/* Title, Location on left, Map & Share buttons on right */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl md:text-3xl font-bold">{place.name}</h1>
            <p className="text-sm md:text-base text-muted-foreground">{place.location}, {place.country}</p>
            <LiveViewerCount itemId={place.id} itemType="adventure" />
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="lg"
              onClick={openInMaps}
              className="bg-blue-600 text-white hover:bg-blue-700 text-xs md:text-base"
            >
              <MapPin className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              Location
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              className="hover:bg-accent"
            >
              <Share2 className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6 p-4 md:p-6 border rounded-lg bg-card shadow-sm">
            
            {/* Entry Fee and About Section */}
            <div>
              <h2 className="text-lg md:text-xl font-semibold mb-2">About This Place</h2>
              <div className="flex items-center gap-4 mb-3 text-base md:text-lg font-semibold">
                <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    <span className="text-xs md:text-base">
                      {place.entry_fee_type === 'free' ? 'Free Entry' : `$${place.entry_fee} Entry Fee`}
                    </span>
                </div>
              </div>
              <p className="text-xs md:text-base text-muted-foreground">{place.description}</p>
            </div>

            {/* Amenities Section */}
            {place.amenities && place.amenities.length > 0 && (
              <div className="pt-4 border-t">
                <h2 className="text-lg md:text-xl font-semibold mb-2">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {place.amenities.map((amenity, idx) => (
                    <span key={idx} className="bg-secondary px-3 py-1 rounded-full text-xs md:text-sm flex items-center gap-1">
                      <Wifi className="h-3 w-3" />
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Facilities and Activities Section - Side by Side on Large Screens */}
            <div className="pt-4 border-t grid md:grid-cols-2 gap-6">
              {/* Facilities Section */}
              {place.facilities && place.facilities.length > 0 && (
                <div>
                  <h2 className="text-lg md:text-xl font-semibold mb-3">Available Facilities</h2>
                  <div className="grid gap-3">
                    {place.facilities.map((facility, idx) => (
                      <div key={idx} className="border rounded-lg p-4 flex justify-between items-center bg-background">
                        <span className="font-medium text-xs md:text-base">{facility.name}</span>
                        <span className="font-bold text-xs md:text-base">${facility.price}/day</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activities Section */}
              {place.activities && place.activities.length > 0 && (
                <div>
                  <h2 className="text-lg md:text-xl font-semibold mb-3">Available Activities</h2>
                  <div className="grid gap-3">
                    {place.activities.map((activity, idx) => (
                      <div key={idx} className="border rounded-lg p-4 flex justify-between items-center bg-background">
                        <span className="font-medium text-xs md:text-base">{activity.name}</span>
                        <span className="font-bold text-xs md:text-base">${activity.price}/person</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contact and Booking (Sidebar) */}
          <div className="space-y-4">
            <div className="bg-card p-6 rounded-lg border space-y-3 shadow-sm">
              <h3 className="font-semibold text-base md:text-lg">Contact & Booking</h3>
              {/* Contact Information */}
              <div className="pt-2 border-t space-y-3">
                {place.phone_numbers && place.phone_numbers.map((phone, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Phone className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                    <a href={`tel:${phone}`} className="text-xs md:text-sm">{phone}</a>
                  </div>
                ))}
                {place.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                    <a href={`mailto:${place.email}`} className="text-xs md:text-sm">{place.email}</a>
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

            {/* Registration number hidden from public for security */}
          </div>

          {/* Availability Calendar */}
          <div className="mt-8">
            <AvailabilityCalendar 
              itemId={place.id} 
              itemType="adventure"
            />
          </div>
        </div>

        {place && <SimilarItems currentItemId={place.id} itemType="adventure" country={place.country} />}
      </main>

      <BookAdventureDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        place={place}
      />

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default AdventurePlaceDetail;