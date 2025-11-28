import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Share2, Calendar, Mail, ArrowLeft, Copy, Heart, Loader2 } from "lucide-react";
import { generateReferralLink, trackReferralClick, getReferralTrackingId } from "@/lib/referralUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useSavedItems } from "@/hooks/useSavedItems";

interface Activity {
  name: string;
  price: number;
}

interface SelectedActivity extends Activity {
  numberOfPeople: number;
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
  
  // Booking form state
  const [bookingLoading, setBookingLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isPaymentCompleted, setIsPaymentCompleted] = useState(false);
  const [completedBookingId, setCompletedBookingId] = useState<string | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);
  const [selectedActivities, setSelectedActivities] = useState<SelectedActivity[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mpesa");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const isSaved = savedItems.has(id || "");

  useEffect(() => {
    fetchTrip();
    
    // Check for referral parameter
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
      window.open(`https://maps.google.com/?q=${query}`, '_blank');
    }
  };

  const toggleActivity = (activity: Activity, checked: boolean) => {
    if (checked) {
      setSelectedActivities([...selectedActivities, { ...activity, numberOfPeople: 1 }]);
    } else {
      setSelectedActivities(selectedActivities.filter(a => a.name !== activity.name));
    }
  };

  const updateActivityPeople = (name: string, count: number) => {
    setSelectedActivities(selectedActivities.map(a => 
      a.name === name ? { ...a, numberOfPeople: Math.max(1, count) } : a
    ));
  };

  const calculateTotal = () => {
    const ticketTotal = (adults * trip.price) + (children * (trip.price_child || 0));
    const activityTotal = selectedActivities.reduce((sum, a) => sum + (a.price * a.numberOfPeople), 0);
    return ticketTotal + activityTotal;
  };

  const handleBooking = async () => {
    if (!trip) return;

    // Validation
    const dateToUse = trip.is_custom_date ? visitDate : trip.date;
    if (trip.is_custom_date && !visitDate) {
      toast({
        title: "Missing information",
        description: "Please select a visit date",
        variant: "destructive",
      });
      return;
    }

    if (adults === 0 && children === 0) {
      toast({
        title: "Missing information",
        description: "Please add at least one guest",
        variant: "destructive",
      });
      return;
    }

    if (!user && (!guestName || !guestEmail || !guestPhone)) {
      toast({
        title: "Missing information",
        description: "Please fill in all guest details",
        variant: "destructive",
      });
      return;
    }

    const totalAmount = calculateTotal();

    // Handle free bookings (amount = 0)
    if (totalAmount === 0) {
      setBookingLoading(true);
      setIsProcessingPayment(true);

      try {
        const totalPeople = adults + children;
        const { data: bookingData, error } = await supabase.from('bookings').insert([{
          user_id: user?.id || null,
          item_id: id,
          booking_type: 'trip',
          visit_date: dateToUse,
          total_amount: 0,
          slots_booked: totalPeople,
          booking_details: {
            trip_name: trip.name,
            date: dateToUse,
            adults,
            children,
            activities: selectedActivities,
          } as any,
          payment_status: 'paid',
          payment_method: 'free',
          is_guest_booking: !user,
          guest_name: !user ? guestName : null,
          guest_email: !user ? guestEmail : null,
          guest_phone: !user ? guestPhone : null,
          referral_tracking_id: getReferralTrackingId(),
        }]).select();

        if (error) throw error;

        // Get trip creator for notification
        const { data: tripData } = await supabase
          .from('trips')
          .select('created_by')
          .eq('id', id)
          .single();

        // Send notifications to host
        if (tripData?.created_by) {
          await supabase.from('notifications').insert({
            user_id: tripData.created_by,
            type: 'booking',
            title: 'New Booking Received',
            message: `You have a new free booking for ${trip.name}`,
            data: { booking_id: bookingData[0].id, item_type: 'trip' },
          });
        }

        // Send notification to guest if logged in
        if (user) {
          await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'booking',
            title: 'Booking Confirmed',
            message: `Your free booking for ${trip.name} has been confirmed`,
            data: { booking_id: bookingData[0].id, item_type: 'trip' },
          });
        }

        // Send confirmation email
        await supabase.functions.invoke('send-booking-confirmation', {
          body: {
            bookingId: bookingData[0].id,
            email: user ? user.email : guestEmail,
            guestName: user ? user.user_metadata?.name || guestName : guestName,
            bookingType: 'trip',
            itemName: trip.name,
            totalAmount: 0,
            bookingDetails: {
              adults,
              children,
              selectedActivities,
              phone: user ? "" : guestPhone,
            },
            visitDate: dateToUse,
          },
        });

        setCompletedBookingId(bookingData[0].id);
        setIsProcessingPayment(false);
        setIsPaymentCompleted(true);
        toast({
          title: "Booking confirmed!",
          description: "Your free booking has been confirmed",
        });
        return;
      } catch (error: any) {
        console.error('Free booking error:', error);
        toast({
          title: "Booking failed",
          description: error.message || "Failed to create booking",
          variant: "destructive",
        });
        setIsProcessingPayment(false);
        setBookingLoading(false);
        return;
      }
    }

    if (!paymentMethod) {
      toast({
        title: "Payment required",
        description: "Please select a payment method",
        variant: "destructive",
      });
      return;
    }

    if ((paymentMethod === 'mpesa' || paymentMethod === 'airtel') && !paymentPhone) {
      toast({
        title: "Payment required",
        description: "Please provide payment phone number",
        variant: "destructive",
      });
      return;
    }

    setBookingLoading(true);
    setIsProcessingPayment(true);

    try {
      const totalPeople = adults + children;
      const emailData = {
        bookingId: '',
        email: user ? user.email : guestEmail,
        guestName: user ? user.user_metadata?.name || guestName : guestName,
        bookingType: "trip",
        itemName: trip.name,
        totalAmount: calculateTotal(),
        bookingDetails: {
          adults,
          children,
          selectedActivities,
          phone: user ? "" : guestPhone,
        },
        visitDate: dateToUse,
      };

      // M-Pesa payment flow
      if (paymentMethod === "mpesa") {
        const bookingData = {
          user_id: user?.id || null,
          booking_type: "trip",
          item_id: id,
          total_amount: calculateTotal(),
          payment_method: paymentMethod,
          payment_phone: paymentPhone || null,
          payment_status: "pending",
          is_guest_booking: !user,
          guest_name: !user ? guestName : null,
          guest_email: !user ? guestEmail : null,
          guest_phone: !user ? guestPhone : null,
          slots_booked: totalPeople,
          visit_date: dateToUse,
          referral_tracking_id: getReferralTrackingId(),
        booking_details: {
          trip_name: trip.name,
          date: dateToUse,
          adults,
          children,
          activities: selectedActivities,
        } as any,
          emailData,
        };

        const { data: mpesaResponse, error: mpesaError } = await supabase.functions.invoke("mpesa-stk-push", {
          body: {
            phoneNumber: paymentPhone,
            amount: calculateTotal(),
            accountReference: `TRIP-${trip.id}`,
            transactionDesc: `Booking for ${trip.name}`,
            bookingData,
          },
        });

        if (mpesaError || !mpesaResponse?.success) {
          throw new Error(mpesaResponse?.error || "M-Pesa payment failed");
        }

        const checkoutRequestId = mpesaResponse.checkoutRequestId;
        setIsProcessingPayment(true);

        // Poll for payment status for up to 120 seconds
        const startTime = Date.now();
        const timeout = 120000; // 120 seconds
        let paymentConfirmed = false;

        while (Date.now() - startTime < timeout) {
          await new Promise(resolve => setTimeout(resolve, 2000));

          const { data: pendingPayment } = await supabase
            .from('pending_payments')
            .select('payment_status')
            .eq('checkout_request_id', checkoutRequestId)
            .single();

          if (pendingPayment?.payment_status === 'completed') {
            paymentConfirmed = true;

            const { data: bookings } = await supabase
              .from('bookings')
              .select('id')
              .eq('payment_phone', paymentPhone)
              .eq('item_id', id)
              .eq('payment_status', 'paid')
              .order('created_at', { ascending: false })
              .limit(1);

            if (bookings && bookings.length > 0) {
              setCompletedBookingId(bookings[0].id);
            }

            setIsProcessingPayment(false);
            setIsPaymentCompleted(true);
            break;
          } else if (pendingPayment?.payment_status === 'failed') {
            throw new Error('Payment failed');
          }
        }

        if (!paymentConfirmed) {
          // Query M-Pesa directly for payment status
          console.log('Polling timeout - querying M-Pesa directly');
          try {
            const { data: queryResponse } = await supabase.functions.invoke('mpesa-stk-query', {
              body: { checkoutRequestId },
            });
            
            if (queryResponse?.resultCode === '0') {
              const { data: bookings } = await supabase
                .from('bookings')
                .select('id')
                .eq('payment_phone', paymentPhone)
                .eq('item_id', id)
                .eq('payment_status', 'paid')
                .order('created_at', { ascending: false })
                .limit(1);

              if (bookings && bookings.length > 0) {
                setCompletedBookingId(bookings[0].id);
              }

              setIsProcessingPayment(false);
              setIsPaymentCompleted(true);
              toast({
                title: "Payment successful!",
                description: "Your booking has been confirmed",
              });
              return;
            } else if (queryResponse?.resultCode === 'RATE_LIMIT') {
              // Rate limit hit - don't mark as failed, suggest retry
              throw new Error('Too many verification attempts. Please check your payment history in a few moments.');
            } else {
              throw new Error(queryResponse?.resultDesc || 'Payment confirmation timeout');
            }
          } catch (queryError) {
            console.error('Error querying payment status:', queryError);
            throw new Error('Payment confirmation timeout - please check payment history');
          }
        }
        return;
      }

      // Non-M-Pesa payment flow
      const { data: bookingData, error } = await supabase.from('bookings').insert([{
        user_id: user?.id || null,
        item_id: id,
        booking_type: 'trip',
        visit_date: dateToUse,
        total_amount: calculateTotal(),
        slots_booked: totalPeople,
          booking_details: {
            trip_name: trip.name,
            date: dateToUse,
            adults,
            children,
            activities: selectedActivities,
          } as any,
        is_guest_booking: !user,
        guest_name: user ? null : guestName,
        guest_email: user ? null : guestEmail,
        guest_phone: user ? null : guestPhone,
        payment_method: paymentMethod,
        payment_phone: paymentPhone || null,
        status: 'pending',
        payment_status: 'paid',
        referral_tracking_id: getReferralTrackingId(),
      }]).select();

      if (error) throw error;

      if (bookingData && bookingData[0]) {
        emailData.bookingId = bookingData[0].id;
      }

      await supabase.functions.invoke("send-booking-confirmation", {
        body: emailData,
      });

      toast({
        title: "Booking successful!",
        description: "Your booking has been submitted",
      });
      
      setBookingOpen(false);
      if (user) {
        navigate('/bookings');
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      toast({
        title: "Booking failed",
        description: error.message || "Failed to create booking",
        variant: "destructive",
      });
    } finally {
      setBookingLoading(false);
      setIsProcessingPayment(false);
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

            {/* Pricing and Booking - Hidden on small screens, shown on large */}
            <div className="hidden md:block bg-card p-6 rounded-lg border space-y-4 shadow-sm">
              <h3 className="font-semibold text-base md:text-lg">Tour Details & Booking</h3>
              <div className="pt-2 border-t space-y-2">
                <div className="flex justify-between items-center pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    <span className="text-xs md:text-base font-semibold">Date</span>
                  </div>
                  <div className="text-lg md:text-xl font-bold">KSh {trip.price}</div>
                </div>
                <div className="text-xs md:text-base text-muted-foreground">
                  {trip.is_custom_date ? "Available for 30 days - Choose your visit date" : new Date(trip.date).toLocaleDateString()}
                </div>
                
                {trip.price_child > 0 && (
                  <div className="pt-2">
                    <p className="text-xs md:text-sm text-muted-foreground">Child Price</p>
                    <p className="text-base md:text-xl font-semibold">KSh {trip.price_child}</p>
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
            <div className="flex flex-wrap gap-4 pt-4 border-t md:border-0 md:pt-0">
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

        {/* Booking Button for Small Screens - Below Description */}
        <div className="md:hidden mt-6 bg-card p-6 rounded-lg border space-y-4 shadow-sm">
          <h3 className="font-semibold text-base">Tour Details & Booking</h3>
          <div className="pt-2 border-t space-y-2">
            <div className="flex justify-between items-center pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold">Date</span>
              </div>
              <div className="text-lg font-bold">KSh {trip.price}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              {trip.is_custom_date ? "Available for 30 days - Choose your visit date" : new Date(trip.date).toLocaleDateString()}
            </div>
            
            {trip.price_child > 0 && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">Child Price</p>
                <p className="text-base font-semibold">KSh {trip.price_child}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Available Tickets</p>
              <p className="text-base font-semibold">{trip.available_tickets}</p>
            </div>
          </div>
          
          <Button 
            className="w-full text-xs" 
            onClick={() => {
              if (!user) {
                toast({
                  title: "Login Required",
                  description: "Please login to book this trip",
                  variant: "destructive",
                });
                navigate('/auth');
                return;
              }
              setBookingOpen(true);
            }}
            disabled={trip.available_tickets === 0 || (!trip.is_custom_date && new Date(trip.date) < new Date())}
          >
            {!trip.is_custom_date && new Date(trip.date) < new Date()
              ? 'Tour Passed' 
              : trip.available_tickets === 0 
              ? 'Sold Out' 
              : 'Book Now'}
          </Button>
        </div>

        <ReviewSection itemId={trip.id} itemType="trip" />

        {trip && <SimilarItems currentItemId={trip.id} itemType="trip" country={trip.country} />}
      </main>

      {/* Booking Dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {isProcessingPayment ? (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <DialogTitle>Processing Payment...</DialogTitle>
              <p className="text-sm text-muted-foreground">Please complete the payment on your phone</p>
            </div>
          ) : isPaymentCompleted ? (
            <div className="py-8 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-green-100 mx-auto flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <DialogTitle>Payment Completed!</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Your booking has been confirmed
                {completedBookingId && ` (ID: ${completedBookingId})`}
              </p>
              <Button onClick={() => {
                setBookingOpen(false);
                setIsPaymentCompleted(false);
                if (user) navigate('/bookings');
              }} className="w-full">
                View Bookings
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Book Your Trip</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {trip.is_custom_date && (
                  <div>
                    <Label htmlFor="visit_date">Visit Date</Label>
                    <Input
                      id="visit_date"
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="num_adults">Number of Adults</Label>
                  <Input
                    id="num_adults"
                    type="number"
                    min="0"
                    value={adults}
                    onChange={(e) => setAdults(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <Label htmlFor="num_children">Number of Children</Label>
                  <Input
                    id="num_children"
                    type="number"
                    min="0"
                    value={children}
                    onChange={(e) => setChildren(parseInt(e.target.value) || 0)}
                  />
                </div>

                {/* Activities Selection */}
                {trip.activities && Array.isArray(trip.activities) && trip.activities.length > 0 && (
                  <div className="space-y-3">
                    <Label>Select Activities (Optional)</Label>
                    {trip.activities.map((activity: any, idx: number) => {
                      const selected = selectedActivities.find(a => a.name === activity.name);
                      return (
                        <div key={idx} className="border rounded p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={!!selected}
                                onCheckedChange={(checked) => toggleActivity(activity, !!checked)}
                              />
                              <div>
                                <p className="font-medium">{activity.name}</p>
                                <p className="text-xs text-muted-foreground">KSh {activity.price}/person</p>
                              </div>
                            </div>
                          </div>
                          {selected && (
                            <div className="ml-8">
                              <Label htmlFor={`activity-${idx}`}>Number of People</Label>
                              <Input
                                id={`activity-${idx}`}
                                type="number"
                                min="1"
                                value={selected.numberOfPeople}
                                onChange={(e) => updateActivityPeople(activity.name, parseInt(e.target.value) || 1)}
                                className="w-24"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!user && (
                  <>
                    <div>
                      <Label htmlFor="guest_name">Your Name</Label>
                      <Input
                        id="guest_name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="guest_email">Email</Label>
                      <Input
                        id="guest_email"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="guest_phone">Phone Number</Label>
                      <Input
                        id="guest_phone"
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        required
                      />
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="payment_method">Payment Method</Label>
                  <select
                    id="payment_method"
                    className="w-full border rounded-md p-2"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="mpesa">M-Pesa</option>
                    <option value="airtel">Airtel</option>
                    <option value="card">Card</option>
                  </select>
                </div>

                {(paymentMethod === 'mpesa' || paymentMethod === 'airtel') && (
                  <div>
                    <Label htmlFor="payment_phone">Phone Number</Label>
                    <Input
                      id="payment_phone"
                      type="tel"
                      value={paymentPhone}
                      onChange={(e) => setPaymentPhone(e.target.value)}
                      placeholder="+254..."
                      required
                    />
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="card_number">Card Number</Label>
                      <Input
                        id="card_number"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="1234 5678 9012 3456"
                        maxLength={19}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="card_expiry">Expiry Date</Label>
                        <Input
                          id="card_expiry"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          maxLength={5}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="card_cvv">CVV</Label>
                        <Input
                          id="card_cvv"
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          placeholder="123"
                          maxLength={4}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <p className="text-lg font-semibold">
                    Total Amount: KSh {calculateTotal().toFixed(2)}
                  </p>
                </div>

                <Button onClick={handleBooking} className="w-full" disabled={bookingLoading}>
                  {bookingLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Complete Booking"
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <MobileBottomBar />
    </div>
  );
};

export default TripDetail;