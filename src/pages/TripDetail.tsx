import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Share2, Calendar, Mail, ArrowLeft, Heart } from "lucide-react";
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

  const handleShare = async () => {
    if (!user || !trip) {
      toast({ title: "Login Required", description: "Please login to share this tour", variant: "destructive" });
      return;
    }

    const refLink = generateReferralLink(trip.id, "trip", user.id);
    setReferralLink(refLink);

    if (navigator.share) {
      try {
        await navigator.share({ title: trip?.name, text: trip?.description, url: refLink });
      } catch (error) {
        console.log("Share failed:", error);
      }
    } else {
      navigator.clipboard.writeText(refLink);
      toast({ title: "Referral Link Copied", description: "Share this link to earn commission on bookings!" });
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
    
    try {
      const dateToUse = trip.is_custom_date ? data.visit_date : trip.date;
      const totalPeople = data.num_adults + data.num_children;
      const totalAmount = (data.num_adults * trip.price) + (data.num_children * trip.price_child) +
                         data.selectedActivities.reduce((sum, a) => sum + (a.price * a.numberOfPeople), 0);

      // Free booking flow
      if (totalAmount === 0) {
        const { data: bookingData, error } = await supabase.from('bookings').insert([{
          user_id: user?.id || null,
          item_id: id,
          booking_type: 'trip',
          visit_date: dateToUse,
          total_amount: 0,
          slots_booked: totalPeople,
          booking_details: { trip_name: trip.name, date: dateToUse, adults: data.num_adults, children: data.num_children, activities: data.selectedActivities } as any,
          payment_status: 'paid',
          payment_method: 'free',
          is_guest_booking: !user,
          guest_name: !user ? data.guest_name : null,
          guest_email: !user ? data.guest_email : null,
          guest_phone: !user ? data.guest_phone : null,
          referral_tracking_id: getReferralTrackingId(),
        }]).select();

        if (error) throw error;

        const { data: tripData } = await supabase.from('trips').select('created_by').eq('id', id).single();

        if (tripData?.created_by) {
          await supabase.from('notifications').insert({
            user_id: tripData.created_by,
            type: 'booking',
            title: 'New Booking Received',
            message: `You have a new free booking for ${trip.name}`,
            data: { booking_id: bookingData[0].id, item_type: 'trip' },
          });
        }

        if (user) {
          await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'booking',
            title: 'Booking Confirmed',
            message: `Your free booking for ${trip.name} has been confirmed`,
            data: { booking_id: bookingData[0].id, item_type: 'trip' },
          });
        }

        await supabase.functions.invoke('send-booking-confirmation', {
          body: {
            bookingId: bookingData[0].id,
            email: user ? user.email : data.guest_email,
            guestName: user ? user.user_metadata?.name || data.guest_name : data.guest_name,
            bookingType: 'trip',
            itemName: trip.name,
            totalAmount: 0,
            bookingDetails: { adults: data.num_adults, children: data.num_children, selectedActivities: data.selectedActivities, phone: user ? "" : data.guest_phone },
            visitDate: dateToUse,
          },
        });

        setIsProcessing(false);
        setIsCompleted(true);
        return;
      }

      // M-Pesa payment flow
      if (data.payment_method === "mpesa") {
        const bookingData = {
          user_id: user?.id || null,
          booking_type: "trip",
          item_id: id,
          total_amount: totalAmount,
          payment_method: data.payment_method,
          payment_phone: data.payment_phone || null,
          payment_status: "pending",
          is_guest_booking: !user,
          guest_name: !user ? data.guest_name : null,
          guest_email: !user ? data.guest_email : null,
          guest_phone: !user ? data.guest_phone : null,
          slots_booked: totalPeople,
          visit_date: dateToUse,
          booking_details: { trip_name: trip.name, date: dateToUse, adults: data.num_adults, children: data.num_children, activities: data.selectedActivities } as any,
          emailData: {
            bookingId: '',
            email: user ? user.email : data.guest_email,
            guestName: user ? user.user_metadata?.name || data.guest_name : data.guest_name,
            bookingType: "trip",
            itemName: trip.name,
            totalAmount,
            bookingDetails: { adults: data.num_adults, children: data.num_children, selectedActivities: data.selectedActivities, phone: user ? "" : data.guest_phone },
            visitDate: dateToUse,
          },
        };

        const { data: mpesaResponse, error: mpesaError } = await supabase.functions.invoke("mpesa-stk-push", {
          body: {
            phoneNumber: data.payment_phone,
            amount: totalAmount,
            accountReference: `TRIP-${trip.id}`,
            transactionDesc: `Booking for ${trip.name}`,
            bookingData,
          },
        });

        if (mpesaError || !mpesaResponse?.success) {
          throw new Error(mpesaResponse?.error || "M-Pesa payment failed");
        }

        const checkoutRequestId = mpesaResponse.checkoutRequestId;

        // Poll for payment
        const startTime = Date.now();
        const timeout = 120000;

        while (Date.now() - startTime < timeout) {
          await new Promise(resolve => setTimeout(resolve, 2000));

          const { data: pendingPayment } = await supabase.from('pending_payments').select('payment_status').eq('checkout_request_id', checkoutRequestId).single();

          if (pendingPayment?.payment_status === 'completed') {
            setIsProcessing(false);
            setIsCompleted(true);
            return;
          } else if (pendingPayment?.payment_status === 'failed') {
            throw new Error('Payment failed');
          }
        }

        // Fallback query
        const { data: queryResponse } = await supabase.functions.invoke('mpesa-stk-query', { body: { checkoutRequestId } });
        
        if (queryResponse?.resultCode === '0') {
          setIsProcessing(false);
          setIsCompleted(true);
          return;
        } else {
          throw new Error('Payment confirmation timeout');
        }
      }

      // Other payment methods
      const { error } = await supabase.from('bookings').insert([{
        user_id: user?.id || null,
        item_id: id,
        booking_type: 'trip',
        visit_date: dateToUse,
        total_amount: totalAmount,
        slots_booked: totalPeople,
        booking_details: { trip_name: trip.name, date: dateToUse, adults: data.num_adults, children: data.num_children, activities: data.selectedActivities } as any,
        payment_method: data.payment_method,
        is_guest_booking: !user,
        guest_name: !user ? data.guest_name : null,
        guest_email: !user ? data.guest_email : null,
        guest_phone: !user ? data.guest_phone : null,
        payment_status: 'completed',
      }]);

      if (error) throw error;

      setIsProcessing(false);
      setIsCompleted(true);
    } catch (error: any) {
      console.error('Booking error:', error);
      toast({ title: "Booking failed", description: error.message || "Failed to create booking", variant: "destructive" });
      setIsProcessing(false);
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
                    <img src={img} alt={`${trip.name} ${idx + 1}`} className="w-full h-64 md:h-96 object-cover" />
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
            
            {trip.description && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white p-4 z-10">
                <h2 className="text-lg font-semibold mb-2">About This Trip</h2>
                <p className="text-sm line-clamp-3">{trip.description}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{trip.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <MapPin className="h-4 w-4" />
                <span>{trip.location}, {trip.country}</span>
              </div>
            </div>

            <div className="space-y-3 p-4 border bg-card">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Trip Date</p>
                  <p className="font-semibold">{trip.is_custom_date ? "Flexible" : new Date(trip.date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground mb-1">Price</p>
                <p className="text-2xl font-bold">KSh {trip.price}</p>
                {trip.price_child > 0 && <p className="text-sm text-muted-foreground">Child: KSh {trip.price_child}</p>}
                <p className="text-sm text-muted-foreground mt-2">Available Tickets: {trip.available_tickets}</p>
              </div>

              <Button size="lg" className="w-full" onClick={() => setBookingOpen(true)} disabled={trip.available_tickets <= 0}>
                {trip.available_tickets <= 0 ? "Sold Out" : "Book Now"}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={openInMaps} className="flex-1">
                <MapPin className="h-4 w-4 mr-2" />
                Map
              </Button>
              <Button variant="outline" onClick={handleShare} className="flex-1">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" onClick={handleSave} className={isSaved ? "bg-red-500 text-white hover:bg-red-600" : ""}>
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
                <div key={idx} className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm flex items-center gap-2">
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
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${trip.phone_number}`} className="text-primary hover:underline">{trip.phone_number}</a>
                </p>
              )}
              {trip.email && (
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${trip.email}`} className="text-primary hover:underline">{trip.email}</a>
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6">
          <ReviewSection itemId={trip.id} itemType="trip" />
        </div>

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
          />
        </DialogContent>
      </Dialog>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default TripDetail;
