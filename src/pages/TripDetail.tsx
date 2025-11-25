import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Share2, Calendar, Mail, ArrowLeft, Copy, Heart } from "lucide-react";
import { generateReferralLink, trackReferralClick, getReferralTrackingId } from "@/lib/referralUtils";
import { useAuth } from "@/contexts/AuthContext";
import { BookTripDialog } from "@/components/booking/BookTripDialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselPrevious, 
  CarouselNext 
} from "@/components/ui/carousel";
import { SimilarItems } from "@/components/SimilarItems";

import { ReviewSection } from "@/components/ReviewSection";

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

const TripDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [referralLink, setReferralLink] = useState<string>("");
  const [isSaved, setIsSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrip();
    checkIfSaved();
    
    // Check for referral parameter
    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get("ref");
    if (refId && id) {
      trackReferralClick(refId, id, "trip", "booking");
    }
  }, [id, user]);

  const checkIfSaved = async () => {
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
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to save this trip",
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
        .insert([{ user_id: user.id, item_id: id, item_type: "trip" }]);
      setIsSaved(true);
      toast({ title: "Added to wishlist" });
    }
  };

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
    if (!user || !trip) {
      toast({
        title: "Login Required",
        description: "Please login to share this tour",
        variant: "destructive",
      });
      return;
    }

    const refLink = generateReferralLink(trip.id, "trip", user.id);
    setReferralLink(refLink);

    if (navigator.share) {
      try {
        await navigator.share({
          title: trip?.name,
          text: trip?.description,
          url: refLink,
        });
      } catch (error) {
        console.log("Share failed:", error);
      }
    } else {
      navigator.clipboard.writeText(refLink);
      toast({
        title: "Referral Link Copied",
        description: "Share this link to earn commission on bookings!",
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
        
        {/* Two Column Layout on Large Screens */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column: Image Gallery with border-radius */}
          <div className="w-full relative">
            <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground z-20 text-xs font-bold px-3 py-1">
              TRIP
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
                      alt={`${trip.name} ${idx + 1}`}
                      className="w-full h-64 md:h-96 object-cover"
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>

              {/* Hide prev/next if only 1 image */}
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
              <Button
                variant="outline"
                onClick={handleSave}
                className={isSaved ? "bg-red-500 text-white hover:bg-red-600" : ""}
              >
                <Heart className={`h-4 w-4 md:h-5 md:w-5 ${isSaved ? "fill-current" : ""}`} />
              </Button>
            </div>

            {/* Pricing and Booking */}
            <div className="bg-card p-6 rounded-lg border space-y-4 shadow-sm">
              <h3 className="font-semibold text-base md:text-lg">Tour Details & Booking</h3>
              <div className="pt-2 border-t space-y-2">
                <div className="flex justify-between items-center pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    <span className="text-xs md:text-base font-semibold">Date</span>
                  </div>
                  <div className="text-lg md:text-xl font-bold">${trip.price}</div>
                </div>
                <div className="text-xs md:text-base text-muted-foreground">
                  {trip.is_custom_date ? "Available for 30 days - Choose your visit date" : new Date(trip.date).toLocaleDateString()}
                </div>
                
                {trip.price_child > 0 && (
                  <div className="pt-2">
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
                disabled={trip.available_tickets === 0 || (!trip.is_custom_date && new Date(trip.date) < new Date())}
              >
                {!trip.is_custom_date && new Date(trip.date) < new Date()
                  ? 'Tour Passed' 
                  : trip.available_tickets === 0 
                  ? 'Sold Out' 
                  : 'Book Now'}
              </Button>
            </div>

            {/* Contact Info */}
            <div className="flex flex-wrap gap-4 pt-4 border-t">
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
          </div>
        </div>

        {/* Description Section - Below Image Gallery on Left Side */}
        <div className="mt-6">
          <div className="p-4 md:p-6 border rounded-lg bg-card shadow-sm">
            <h2 className="text-lg md:text-xl font-semibold mb-4">About This Tour</h2>
            <p className="text-xs md:text-base text-muted-foreground">{trip.description}</p>
          </div>
        </div>

        <ReviewSection itemId={trip.id} itemType="trip" />

        {trip && <SimilarItems currentItemId={trip.id} itemType="trip" country={trip.country} />}
      </main>

      <BookTripDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        trip={trip}
      />

      <MobileBottomBar />
    </div>
  );
};

export default TripDetail;