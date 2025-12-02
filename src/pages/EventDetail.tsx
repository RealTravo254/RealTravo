import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";

import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Icons will be Teal: #008080
import { MapPin, Share2, Heart, Calendar, Phone, Mail, ArrowLeft, Copy } from "lucide-react"; 
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SimilarItems } from "@/components/SimilarItems";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ReviewSection } from "@/components/ReviewSection";
import { useSavedItems } from "@/hooks/useSavedItems";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { generateReferralLink, trackReferralClick, getReferralTrackingId } from "@/lib/referralUtils";

interface Activity {
  name: string;
  price: number;
}
interface Event {
  id: string;
  name: string;
  location: string;
  country: string;
  place: string;
  image_url: string;
  images: string[];
  description: string;
  price: number;
  price_child: number;
  date: string;
  is_custom_date: boolean;
  available_tickets: number;
  phone_number?: string;
  email?: string;
  map_link?: string;
  activities?: Activity[];
  type: string;
}

// Define the Teal and Orange colors
const TEAL_COLOR = "#008080";
const ORANGE_COLOR = "#FF9800";

const EventDetail = () => {
  const {
    id
  } = useParams();
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const {
    savedItems,
    handleSave: handleSaveItem
  } = useSavedItems();
  const isSaved = savedItems.has(id || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  useEffect(() => {
    if (id) {
      fetchEvent();
    }
    
    // Track referral clicks
    const urlParams = new URLSearchParams(window.location.search);
    const refSlug = urlParams.get("ref");
    if (refSlug && id) {
      trackReferralClick(refSlug, id, "event", "booking");
    }
  }, [id]);

  const fetchEvent = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("trips").select("*").eq("id", id).eq("type", "event").single();
      if (error) throw error;
      setEvent(data as any);
    } catch (error) {
      console.error("Error fetching event:", error);
      toast({
        title: "Event not found",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleSave = () => {
    if (id) {
      handleSaveItem(id, "event");
    }
  };
  const handleCopyLink = async () => {
    if (!event) {
      toast({ title: "Unable to Copy", description: "Event information not available", variant: "destructive" });
      return;
    }

    const refLink = await generateReferralLink(event.id, "event", event.id);

    try {
      await navigator.clipboard.writeText(refLink);
      toast({ 
        title: "Link Copied!", 
        description: user 
          ? "Share this link to earn commission on bookings!" 
          : "Share this event with others!" 
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
    if (!event) {
      toast({ title: "Unable to Share", description: "Event information not available", variant: "destructive" });
      return;
    }

    const refLink = await generateReferralLink(event.id, "event", event.id);

    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.name,
          text: `Check out this event: ${event?.name}`,
          url: refLink
        });
      } catch (error) {
        console.log("Share failed:", error);
      }
    } else {
      await handleCopyLink();
    }
  };

  const openInMaps = () => {
    if (event?.map_link) {
      window.open(event.map_link, "_blank");
    } else {
      const query = encodeURIComponent(`${event?.name}, ${event?.location}, ${event?.country}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
    }
  };
  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!event) return;
    setIsProcessing(true);
    try {
      const totalPeople = data.num_adults + data.num_children;
      const totalAmount = data.num_adults * event.price + data.num_children * event.price_child + data.selectedActivities.reduce((sum, a) => sum + a.price * a.numberOfPeople, 0);

      // Free booking flow
      if (totalAmount === 0) {
        const {
          data: bookingData,
          error
        } = await supabase.from('bookings').insert([{
          user_id: user?.id || null,
          item_id: id,
          booking_type: 'trip',
          visit_date: event.date,
          total_amount: 0,
          slots_booked: totalPeople,
          booking_details: {
            trip_name: event.name,
            date: event.date,
            adults: data.num_adults,
            children: data.num_children,
            activities: data.selectedActivities
          } as any,
          payment_status: 'paid',
          payment_method: 'free',
          is_guest_booking: !user,
          guest_name: !user ? data.guest_name : null,
          guest_email: !user ? data.guest_email : null,
          guest_phone: !user ? data.guest_phone : null
        }]).select();
        if (error) throw error;
        const {
          data: eventData
        } = await supabase.from('trips').select('created_by').eq('id', id).single();
        if (eventData?.created_by) {
          await supabase.from('notifications').insert({
            user_id: eventData.created_by,
            type: 'booking',
            title: 'New Booking Received',
            message: `You have a new free booking for ${event.name}`,
            data: {
              booking_id: bookingData[0].id,
              item_type: 'trip'
            }
          });
        }
        if (user) {
          await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'booking',
            title: 'Booking Confirmed',
            message: `Your free booking for ${event.name} has been confirmed`,
            data: {
              booking_id: bookingData[0].id,
              item_type: 'trip'
            }
          });
        }
        await supabase.functions.invoke('send-booking-confirmation', {
          body: {
            bookingId: bookingData[0].id,
            email: user ? user.email : data.guest_email,
            guestName: user ? user.user_metadata?.name || data.guest_name : data.guest_name,
            bookingType: 'trip',
            itemName: event.name,
            totalAmount: 0,
            bookingDetails: {
              adults: data.num_adults,
              children: data.num_children,
              selectedActivities: data.selectedActivities,
              phone: user ? "" : data.guest_phone
            },
            visitDate: event.date
          }
        });
        setIsProcessing(false);
        setIsCompleted(true);
        return;
      }

      // M-Pesa payment flow
      if (data.payment_method === "mpesa") {
        const bookingPayload = {
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
          visit_date: event.date,
          referral_tracking_id: getReferralTrackingId(),
          booking_details: {
            trip_name: event.name,
            date: event.date,
            adults: data.num_adults,
            children: data.num_children,
            activities: data.selectedActivities
          } as any,
          emailData: {
            bookingId: '',
            email: user ? user.email : data.guest_email,
            guestName: user ? user.user_metadata?.name || data.guest_name : data.guest_name,
            bookingType: "trip",
            itemName: event.name,
            totalAmount,
            bookingDetails: {
              adults: data.num_adults,
              children: data.num_children,
              selectedActivities: data.selectedActivities,
              phone: user ? "" : data.guest_phone
            },
            visitDate: event.date
          }
        };
        const {
          data: mpesaResponse,
          error: mpesaError
        } = await supabase.functions.invoke("mpesa-stk-push", {
          body: {
            phoneNumber: data.payment_phone,
            amount: totalAmount,
            accountReference: `EVENT-${event.id}`,
            transactionDesc: `Booking for ${event.name}`,
            bookingData: bookingPayload
          }
        });
        if (mpesaError || !mpesaResponse?.success) {
          throw new Error(mpesaResponse?.error || "M-Pesa payment failed");
        }
        const checkoutRequestId = mpesaResponse.checkoutRequestId;

        // Poll for payment
        const startTime = Date.now();
        const timeout = 40000;
        while (Date.now() - startTime < timeout) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const {
            data: pendingPayment
          } = await supabase.from('pending_payments').select('payment_status').eq('checkout_request_id', checkoutRequestId).single();
          if (pendingPayment?.payment_status === 'completed') {
            setIsProcessing(false);
            setIsCompleted(true);
            return;
          } else if (pendingPayment?.payment_status === 'failed') {
            throw new Error('Payment failed');
          }
        }

        // Fallback query
        const {
          data: queryResponse
        } = await supabase.functions.invoke('mpesa-stk-query', {
          body: {
            checkoutRequestId
          }
        });
        if (queryResponse?.resultCode === '0') {
          setIsProcessing(false);
          setIsCompleted(true);
          return;
        } else {
          throw new Error('Payment confirmation timeout');
        }
      }

      // Other payment methods
      const {
        error
      } = await supabase.from('bookings').insert([{
        user_id: user?.id || null,
        item_id: id,
        booking_type: 'trip',
        visit_date: event.date,
        total_amount: totalAmount,
        slots_booked: totalPeople,
        booking_details: {
          trip_name: event.name,
          date: event.date,
          adults: data.num_adults,
          children: data.num_children,
          activities: data.selectedActivities
        } as any,
        payment_method: data.payment_method,
        is_guest_booking: !user,
        guest_name: !user ? data.guest_name : null,
        guest_email: !user ? data.guest_email : null,
        guest_phone: !user ? data.guest_phone : null,
        payment_status: 'completed'
      }]);
      if (error) throw error;
      setIsProcessing(false);
      setIsCompleted(true);
    } catch (error: any) {
      console.error('Booking error:', error);
      toast({
        title: "Booking failed",
        description: error.message || "Failed to create booking",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };
  if (loading) {
    return <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header />
        <div className="container px-4 py-6 max-w-6xl mx-auto">
          <div className="h-64 md:h-96 bg-muted animate-pulse rounded-lg" />
        </div>
        <MobileBottomBar />
      </div>;
  }
  if (!event) {
    return <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <p>Event not found</p>
        </div>
        <MobileBottomBar />
      </div>;
  }
  const allImages = [event.image_url, ...(event.images || [])].filter(Boolean);
  return <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-6 max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
          <div className="w-full relative opacity-100">
            <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground z-20 text-xs font-bold px-3 py-1">
              EVENT
            </Badge>
            <Carousel className="w-full rounded-2xl overflow-hidden">
              <CarouselContent>
                {allImages.map((img, idx) => <CarouselItem key={idx}>
                    <img src={img} alt={`${event.name} ${idx + 1}`} loading="lazy" decoding="async" className="w-full h-64 md:h-96 object-cover" />
                  </CarouselItem>)}
              </CarouselContent>
              {allImages.length > 1 && <>
                  <CarouselPrevious className="left-2" />
                  <CarouselNext className="right-2" />
                </>}
            </Carousel>
            
            {event.description && <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white p-4 z-10">
                <h2 className="text-lg font-semibold mb-2 text-justify">About This Event</h2>
                <p className="text-sm line-clamp-3">{event.description}</p>
              </div>}
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                {/* Map Pin Icon Teal */}
                <MapPin className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                <span>{event.location}, {event.country}</span>
              </div>
            </div>

            <div className="space-y-3 p-4 border bg-card px-px py-0">
              <div className="flex items-center gap-2">
                {/* Calendar Icon Teal */}
                <Calendar className="h-5 w-5" style={{ color: TEAL_COLOR }} />
                <div>
                  <p className="text-sm text-muted-foreground">Event Date</p>
                  <p className="font-semibold">{new Date(event.date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground mb-1">Entrance Fee</p>
                <p className="text-2xl font-bold">KSh {event.price}</p>
                {event.price_child > 0 && <p className="text-sm text-muted-foreground">Child: KSh {event.price_child}</p>}
                <p className="text-sm text-muted-foreground mt-2">Available Tickets: {event.available_tickets}</p>
              </div>

              {/* Book Now Button Teal and dark hover */}
              <Button 
                size="lg" 
                className="w-full text-white" 
                onClick={() => setShowBooking(true)} 
                disabled={event.available_tickets <= 0}
                style={{ backgroundColor: TEAL_COLOR }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#005555')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL_COLOR)}
              >
                {event.available_tickets <= 0 ? "Sold Out" : "Book Now"}
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

        {event.activities && event.activities.length > 0 && <div className="mt-6 p-6 border bg-card">
            <h2 className="text-xl font-semibold mb-4">Included Activities</h2>
            <div className="flex flex-wrap gap-2">
              {event.activities.map((activity, idx) => 
                // Activities Badge Orange
                <div 
                  key={idx} 
                  className="px-4 py-2 text-white rounded-full text-sm flex items-center gap-2"
                  style={{ backgroundColor: ORANGE_COLOR }} 
                >
                  <span className="font-medium">{activity.name}</span>
                  <span className="text-xs opacity-90">KSh {activity.price}</span>
                </div>
              )}
            </div>
          </div>}

        {(event.phone_number || event.email) && <div className="mt-6 p-6 border bg-card my-[2px] rounded-none">
            <h2 className="text-xl font-semibold mb-3">Contact Information</h2>
            <div className="space-y-2">
              {event.phone_number && <p className="flex items-center gap-2">
                  {/* Phone Icon Teal */}
                  <Phone className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                  {/* Phone Link Teal */}
                  <a href={`tel:${event.phone_number}`} className="hover:underline" style={{ color: TEAL_COLOR }}>{event.phone_number}</a>
                </p>}
              {event.email && <p className="flex items-center gap-2">
                  {/* Mail Icon Teal */}
                  <Mail className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                  {/* Email Link Teal */}
                  <a href={`mailto:${event.email}`} className="hover:underline" style={{ color: TEAL_COLOR }}>{event.email}</a>
                </p>}
            </div>
          </div>}

        <div className="mt-6 rounded-none my-[10px]">
          <ReviewSection itemId={event.id} itemType="event" />
        </div>

        <SimilarItems currentItemId={event.id} itemType="trip" location={event.location} country={event.country} />
      </main>

      <Dialog open={showBooking} onOpenChange={setShowBooking}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <MultiStepBooking 
            onSubmit={handleBookingSubmit} 
            activities={event.activities || []} 
            priceAdult={event.price} 
            priceChild={event.price_child} 
            isProcessing={isProcessing} 
            isCompleted={isCompleted} 
            itemName={event.name} 
            skipDateSelection={true} 
            fixedDate={event.date} 
            skipFacilitiesAndActivities={true} 
          />
        </DialogContent>
      </Dialog>

      <MobileBottomBar />
    </div>;
};
export default EventDetail;