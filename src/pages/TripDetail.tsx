import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Share2, Calendar, Mail, ArrowLeft } from "lucide-react";
import { BookTripDialog } from "@/components/booking/BookTripDialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselPrevious, 
  CarouselNext 
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface Trip {
  id: string;
  name: string;
  location: string;
  place: string;
  country: string;
  image_url: string;
  images: string[];
  gallery_images: string[];
  description: string;
  price: number;
  price_child: number;
  date: string;
  is_custom_date: boolean;
  available_tickets: number;
  phone_number: string;
  email: string;
  map_link: string;
}

import { SimilarItems } from "@/components/SimilarItems";
import { AvailabilityCalendar } from "@/components/booking/AvailabilityCalendar";

const TripDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [current, setCurrent] = useState(0); 

  useEffect(() => {
    fetchTrip();
  }, [id]);

  const fetchTrip = async () => {
    try {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setTrip(data as any);
    } catch (error) {
      console.error("Error fetching trip:", error);
      toast({
        title: "Error",
        description: "Failed to load trip details",
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
          title: trip?.name,
          text: trip?.description,
          url: window.location.href,
        });
      } catch (error) {
        console.log("Share failed:", error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Trip link copied to clipboard",
      });
    }
  };

  const openInMaps = () => {
    if (trip?.map_link) {
      window.open(trip.map_link, '_blank');
    } else {
      const query = encodeURIComponent(`${trip?.name}, ${trip?.location}, ${trip?.country}`);
      // NOTE: Corrected the Google Maps URL structure for the fallback
      window.open(`https://maps.google.com/?q=${query}`, '_blank');
    }
  };

  if (loading) {
    // MODIFICATION: Changed loading background
    return <div className="min-h-screen **bg-orange-50**">Loading...</div>;
  }

  if (!trip) {
    // MODIFICATION: Changed not found background
    return <div className="min-h-screen **bg-orange-50**">Trip not found</div>;
  }

  const displayImages = trip.gallery_images?.length > 0 
    ? trip.gallery_images 
    : trip.images?.length > 0 
    ? trip.images 
    : [trip.image_url];

  return (
    // MODIFICATION: Changed the main background class to bg-orange-50 (light orange)
    <div className="min-h-screen **bg-orange-50** pb-20 md:pb-0">
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
                    alt={`${trip.name} ${idx + 1}`}
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
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-bold">{trip.name}</h1>
            <p className="text-sm md:text-base text-muted-foreground">{trip.location}, {trip.country}</p>
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
          </div>
        </div>

        {/* BELOW CAROUSEL: Description and Booking sidebar */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4 p-4 md:p-6 border rounded-lg bg-card shadow-sm">
            {/* Date, Phone, and Email */}
            <div className="flex flex-wrap gap-4 pb-4 border-b">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="text-xs md:text-base">
                  {trip.is_custom_date ? "Custom" : new Date(trip.date).toLocaleDateString()}
                </span>
              </div>
              {trip.phone_number && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  <a href={`tel:${trip.phone_number}`} className="text-xs md:text-base">{trip.phone_number}</a>
                </div>
              )}
              {trip.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  <a href={`mailto:${trip.email}`} className="text-xs md:text-base">{trip.email}</a>
                </div>
              )}
            </div>
            
            <h2 className="text-lg md:text-xl font-semibold">About This Trip</h2>
            <p className="text-xs md:text-base text-muted-foreground">{trip.description}</p>
          </div>

          {/* Pricing and Booking (Sidebar) */}
          <div className="space-y-4">
            <div className="bg-card p-6 rounded-lg border space-y-4 shadow-sm">
              <h3 className="font-semibold text-base md:text-lg">Trip Details & Booking</h3>
              <div className="pt-2 border-t space-y-2">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Adult Price</p>
                  <p className="text-xl md:text-2xl font-bold">${trip.price}</p>
                </div>
                {trip.price_child > 0 && (
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Child Price</p>
                    <p className="text-base md:text-xl font-semibold">${trip.price_child}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Available Tickets</p>
                  <p className="text-base md:text-lg font-semibold">{trip.available_tickets}</p>
                </div>
              </div>
              
              <Button 
                className="w-full text-xs md:text-sm" 
                onClick={() => setBookingOpen(true)}
                disabled={trip.available_tickets === 0 || new Date(trip.date) < new Date()}
              >
                {new Date(trip.date) < new Date() 
                  ? 'Trip Passed' 
                  : trip.available_tickets === 0 
                  ? 'Sold Out' 
                  : 'Book Now'}
              </Button>
            </div>
          </div>

          {/* Availability Calendar */}
          <div className="mt-8">
            <AvailabilityCalendar 
              itemId={trip.id} 
              itemType="trip"
            />
          </div>
        </div>

        {trip && <SimilarItems currentItemId={trip.id} itemType="trip" country={trip.country} />}
      </main>

      <BookTripDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        trip={trip}
      />

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default TripDetail;