import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Share2, Calendar, Mail, ArrowLeft, Heart, Copy } from "lucide-react";
import { generateReferralLink, trackReferralClick, getReferralTrackingId } from "@/lib/referralUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { SimilarItems } from "@/components/SimilarItems";
import { ReviewSection } from "@/components/ReviewSection";
import Autoplay from "embla-carousel-autoplay";
import { useSavedItems } from "@/hooks/useSavedItems";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";

// Define the specific colors
const TEAL_COLOR = "#008080"; // 0,128,128
const ORANGE_COLOR = "#FF9800"; // FF9800
const RED_COLOR = "#FF0000"; // Added for price emphasis

interface Activity {
  name: string;
  price: number;
}

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
  activities?: Activity[];
  created_by: string;
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
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string>("");
  
  const isSaved = savedItems.has(id || "");

  useEffect(() => {
    fetchTrip();
    
    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get("ref");
    if (refId && id) {
      trackReferralClick(refId, id, "trip", "booking");
    }
  }, [id, user]);

  const handleSave = () => {
    if (id) {
      handleSaveItem(id, "trip");
    }
  };

  const fetchTrip = async () => {
    try {
      const { data, error } = await supabase.from("trips").select("*").eq("id", id).single();
      if (error) throw error;
      setTrip(data as any);
    } catch (error) {
      console.error("Error fetching trip:", error);
      toast({ title: "Error", description: "Failed to load trip details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!trip) {
      toast({ title: "Unable to Copy", description: "Trip information not available", variant: "destructive" });
      return;
    }

    const refLink = await generateReferralLink(trip.id, "trip", trip.id);
    setReferralLink(refLink);

    try {
      await navigator.clipboard.writeText(refLink);
      toast({ 
        title: "Link Copied!", 
        description: user 
          ? "Share this link to earn commission on bookings!" 
          : "Share this trip with others!" 
      });
    } catch (error) {
      toast({ 
        title: "Copy Failed", 
        description: "Unable to copy link to clipboard", 
        variant: "destructive" 
      });
    }
  };

  const handleShare = async () => {
    if (!trip) {
      toast({ title: "Unable to Share", description: "Trip information not available", variant: "destructive" });
      return;
    }

    const refLink = await generateReferralLink(trip.id, "trip", trip.id);
    setReferralLink(refLink);

    if (navigator.share) {
      try {
        await navigator.share({ title: trip?.name, text: trip?.description, url: refLink });
      } catch (error) {
        console.log("Share failed:", error);
      }
    } else {
      await handleCopyLink();
    }
  };

  const openInMaps = () => {
    if (trip?.map_link) {
      window.open(trip.map_link, '_blank');
    } else {
      const query = encodeURIComponent(`${trip?.name}, ${trip?.location}, ${trip?.country}`);
      window.open(`https://maps.google.com/?q=${query}`, '_blank');
    }
  };

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!trip) return;
    
    setIsProcessing(true);
    setCheckoutRequestId(""); // Reset
    
    try {
      const totalAmount = (data.num_adults * trip.price) + (data.num_children * trip.price_child) +
                         data.selectedActivities.reduce((sum, a) => sum + (a.price * a.numberOfPeople), 0);
      const totalPeople = data.num_adults + data.num_children;

      // Free booking flow
      if (totalAmount === 0) {
        const { error } = await supabase.from('bookings').insert([{
          user_id: user?.id || null,
          item_id: id,
          booking_type: 'trip',
          visit_date: trip.date,
          total_amount: totalAmount,
          slots_booked: totalPeople,
          booking_details: {
            trip_name: trip.name,
            date: trip.date,
            adults: data.num_adults,
            children: data.num_children,
            activities: data.selectedActivities
          } as any,
          payment_method: 'free',
          is_guest_booking: !user,
          guest_name: !user ? data.guest_name : null,
          guest_email: !user ? data.guest_email : null,
          guest_phone: !user ? data.guest_phone : null,
          payment_status: 'paid',
          referral_tracking_id: getReferralTrackingId()
        }]);
        if (error) throw error;
        setIsProcessing(false);
        setIsCompleted(true);
        return;
      }

      // M-Pesa payment flow
      if (data.payment_method === "mpesa") {
        const bookingPayload = {
          user_id: user?.id || null,
          item_id: id,
          booking_type: 'trip',
          host_id: trip.created_by,
          is_guest_booking: !user,
          guest_name: !user ? data.guest_name : null,
          guest_email: !user ? data.guest_email : null,
          guest_phone: !user ? data.guest_phone : null,
          slots_booked: totalPeople,
          visit_date: trip.date,
          referral_tracking_id: getReferralTrackingId(),
          booking_details: {
            trip_name: trip.name,
            date: trip.date,
            adults: data.num_adults,
            children: data.num_children,
            activities: data.selectedActivities
          } as any,
          emailData: {
            bookingId: '',
            email: user ? user.email : data.guest_email,
            guestName: user ? user.user_metadata?.name || data.guest_name : data.guest_name,
            bookingType: "trip",
            itemName: trip.name,
            totalAmount,
            bookingDetails: {
              adults: data.num_adults,
              children: data.num_children,
              selectedActivities: data.selectedActivities,
              phone: user ? "" : data.guest_phone
            },
            visitDate: trip.date
          }
        };

        const { data: mpesaResponse, error: mpesaError } = await supabase.functions.invoke("mpesa-stk-push", {
          body: {
            phoneNumber: data.payment_phone,
            amount: totalAmount,
            accountReference: `TRIP-${trip.id}`,
            transactionDesc: `Booking for ${trip.name}`,
            bookingData: bookingPayload
          }
        });

        if (mpesaError || !mpesaResponse?.success) {
          throw new Error(mpesaResponse?.error || "M-Pesa payment failed");
        }

        const reqId = mpesaResponse.checkoutRequestId;
        setCheckoutRequestId(reqId); // Store for realtime subscription
        
        // The MultiStepBooking component will now handle showing payment status via realtime subscription
        // We keep processing state active so it shows the "Processing Payment..." UI
        return;
      }

      // Other payment methods
      const { error } = await supabase.from('bookings').insert([{
        user_id: user?.id || null,
        item_id: id,
        booking_type: 'trip',
        visit_date: trip.date,
        total_amount: totalAmount,
        slots_booked: totalPeople,
        booking_details: {
          trip_name: trip.name,
          date: trip.date,
          adults: data.num_adults,
          children: data.num_children,
          activities: data.selectedActivities
        } as any,
        payment_method: data.payment_method,
        is_guest_booking: !user,
        guest_name: !user ? data.guest_name : null,
        guest_email: !user ? data.guest_email : null,
        guest_phone: !user ? data.guest_phone : null,
        payment_status: 'completed',
        referral_tracking_id: getReferralTrackingId()
      }]);
      if (error) throw error;
      setIsProcessing(false);
      setIsCompleted(true);
    } catch (error: any) {
      console.error('Booking error:', error);
      toast({ title: "Booking failed", description: error.message || "Failed to create booking", variant: "destructive" });
      setIsProcessing(false);
      setCheckoutRequestId("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header />
        <div className="container px-4 py-6 max-w-6xl mx-auto">
          <div className="h-64 md:h-96 bg-muted animate-pulse rounded-lg" />
        </div>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <p>Trip not found</p>
        </div>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  const displayImages = [trip.image_url, ...(trip.gallery_images || []), ...(trip.images || [])].filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-6 max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
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
                  api.on("select", () => setCurrent(api.selectedScrollSnap()));
                }
              }}
            >
              <CarouselContent>
                {displayImages.map((img, idx) => (
                  <CarouselItem key={idx}>
                    <img src={img} alt={`${trip.name} ${idx + 1}`} loading="lazy" decoding="async" className="w-full h-64 md:h-96 object-cover" />
                  </CarouselItem>
                ))}
              </CarouselContent>

              {displayImages.length > 1 && (
                <>
                  <CarouselPrevious className="left-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                  <CarouselNext className="right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                </>
              )}
            </Carousel>
            
            {/* START: Modified Description Section for slide-down and border radius */}
            {trip.description && (
              <div 
                className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white p-4 z-10 
                           rounded-b-2xl 
                           shadow-lg 
                           transform translate-y-2" // The key styling for the "slide down" effect
              >
                <h2 className="text-lg font-semibold mb-2">About This Trip</h2>
                <p className="text-sm line-clamp-3">{trip.description}</p>
              </div>
            )}
            {/* END: Modified Description Section */}
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{trip.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                {/* Location Icon Teal */}
                <MapPin className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                <span>{trip.location}, {trip.country}</span>
              </div>
            </div>

            <div className="space-y-3 p-4 border bg-card">
              <div className="flex items-center gap-2">
                {/* Calendar Icon Teal */}
                <Calendar className="h-5 w-5" style={{ color: TEAL_COLOR }} />
                <div>
                  <p className="text-sm text-muted-foreground">Trip Date</p>
                  <p className="font-semibold">{trip.is_custom_date ? "Flexible" : new Date(trip.date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground mb-1">Price</p>
                {/* Price in Red */}
                <p className="text-2xl font-bold" style={{ color: RED_COLOR }}>KSh {trip.price}</p>
                {trip.price_child > 0 && <p className="text-sm text-muted-foreground">Child: KSh {trip.price_child}</p>}
                <p className="text-sm text-muted-foreground mt-2">Available Tickets: {trip.available_tickets}</p>
              </div>

              {/* Book Now Button Teal and dark hover */}
              <Button 
                size="lg" 
                className="w-full text-white" 
                onClick={() => setBookingOpen(true)} 
                disabled={trip.available_tickets <= 0}
                style={{ backgroundColor: TEAL_COLOR }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#005555')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL_COLOR)}
              >
                {trip.available_tickets <= 0 ? "Sold Out" : "Book Now"}
              </Button>
            </div>

            <div className="flex gap-2">
              {/* Map Button: Border/Icon Teal */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={openInMaps} 
                className="flex-1 md:size-lg"
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
              >
                <MapPin className="h-4 w-4 md:mr-2" style={{ color: TEAL_COLOR }} />
                <span className="hidden md:inline">Map</span>
              </Button>
              {/* Copy Link Button: Border/Icon Teal */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopyLink} 
                className="flex-1 md:size-lg"
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
              >
                <Copy className="h-4 w-4 md:mr-2" style={{ color: TEAL_COLOR }} />
                <span className="hidden md:inline">Copy Link</span>
              </Button>
              {/* Share Button: Border/Icon Teal */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleShare} 
                className="flex-1 md:size-lg"
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
              >
                <Share2 className="h-4 w-4 md:mr-2" style={{ color: TEAL_COLOR }} />
                <span className="hidden md:inline">Share</span>
              </Button>
              {/* Save Button: Border/Icon Teal (and filled red if saved) */}
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleSave} 
                className={isSaved ? "bg-red-500 text-white hover:bg-red-600" : ""}
                style={{ borderColor: TEAL_COLOR, color: isSaved ? 'white' : TEAL_COLOR }}
              >
                <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
              </Button>
            </div>
          </div>
        </div>

        {trip.activities && trip.activities.length > 0 && (
          <div className="mt-6 p-6 border bg-card">
            <h2 className="text-xl font-semibold mb-4">Included Activities</h2>
            <div className="flex flex-wrap gap-2">
              {trip.activities.map((activity, idx) => (
                // Activities Badge Orange
                <div 
                  key={idx} 
                  className="px-4 py-2 text-white rounded-full text-sm flex items-center gap-2"
                  style={{ backgroundColor: ORANGE_COLOR }}
                >
                  <span className="font-medium">{activity.name}</span>
                  <span className="text-xs opacity-90">KSh {activity.price}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(trip.phone_number || trip.email) && (
          <div className="mt-6 p-6 border bg-card">
            <h2 className="text-xl font-semibold mb-3">Contact Information</h2>
            <div className="space-y-2">
              {trip.phone_number && (
                <p className="flex items-center gap-2">
                  {/* Phone Icon Teal */}
                  <Phone className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                  {/* Phone Link Teal */}
                  <a href={`tel:${trip.phone_number}`} className="hover:underline" style={{ color: TEAL_COLOR }}>{trip.phone_number}</a>
                </p>
              )}
              {trip.email && (
                <p className="flex items-center gap-2">
                  {/* Mail Icon Teal */}
                  <Mail className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                  {/* Mail Link Teal */}
                  <a href={`mailto:${trip.email}`} className="hover:underline" style={{ color: TEAL_COLOR }}>{trip.email}</a>
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6">
          <ReviewSection itemId={trip.id} itemType="trip" />
        </div>

        {/* Similar Items Section */}
        {/* NOTE: Styling for price (red) and location icon (teal) on individual cards 
            within SimilarItems must be implemented inside the SimilarItems component itself. */}
        {trip && <SimilarItems currentItemId={trip.id} itemType="trip" country={trip.country} />}
      </main>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <MultiStepBooking
            onSubmit={handleBookingSubmit}
            activities={trip.activities || []}
            priceAdult={trip.price}
            priceChild={trip.price_child}
            isProcessing={isProcessing}
            isCompleted={isCompleted}
            itemName={trip.name}
            skipDateSelection={!trip.is_custom_date}
            fixedDate={trip.date}
            skipFacilitiesAndActivities={true}
            checkoutRequestId={checkoutRequestId}
          />
        </DialogContent>
      </Dialog>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default TripDetail;