import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Share2, Heart, Map as MapIcon, Calendar, Users, Mail, Phone, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { SimilarItems } from "@/components/SimilarItems";

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

import { ReviewSection } from "@/components/ReviewSection";
import { useSavedItems } from "@/hooks/useSavedItems";

interface Activity {
  name: string;
  price: number;
}

interface SelectedActivity extends Activity {
  numberOfPeople: number;
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

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [referralLink, setReferralLink] = useState<string>("");
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const isSaved = savedItems.has(id || "");
  const [bookedTickets, setBookedTickets] = useState(0);
  
  // Booking form state
  const [bookingLoading, setBookingLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isPaymentCompleted, setIsPaymentCompleted] = useState(false);
  const [completedBookingId, setCompletedBookingId] = useState<string | null>(null);
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

  useEffect(() => {
    if (id) {
      fetchEvent();
      fetchBookedTickets();
    }
  }, [id, user]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", id)
        .eq("type", "event")
        .single();

      if (error) throw error;
      setEvent(data as any);
    } catch (error) {
      console.error("Error fetching event:", error);
      toast({ title: "Event not found", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchBookedTickets = async () => {
    try {
      const { data } = await supabase
        .from("bookings")
        .select("slots_booked")
        .eq("item_id", id)
        .in("status", ["confirmed", "pending"]);

      if (data) {
        const total = data.reduce((sum, booking) => sum + (booking.slots_booked || 0), 0);
        setBookedTickets(total);
      }
    } catch (error) {
      console.error("Error fetching booked tickets:", error);
    }
  };

  const handleSave = () => {
    if (id) {
      handleSaveItem(id, "event");
    }
  };

  const handleShare = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to share with referral link",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    try {
      const { data: trackingData } = await supabase
        .from("referral_tracking")
        .insert({
          referrer_id: user.id,
          referral_type: "item_share",
          item_type: "event",
          item_id: id,
        })
        .select()
        .single();

      const shareUrl = `${window.location.origin}/event/${id}?ref=${trackingData?.id}`;
      setReferralLink(shareUrl);

      if (navigator.share) {
        await navigator.share({
          title: event?.name,
          text: `Check out this event: ${event?.name}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Link copied to clipboard!" });
      }
    } catch (error) {
      console.error("Error sharing:", error);
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
    const ticketTotal = (adults * event.price) + (children * (event.price_child || 0));
    const activityTotal = selectedActivities.reduce((sum, a) => sum + (a.price * a.numberOfPeople), 0);
    return ticketTotal + activityTotal;
  };

  const handleBooking = async () => {
    if (!event) return;

    // Validation
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
          visit_date: event.date,
          total_amount: 0,
          slots_booked: totalPeople,
          booking_details: {
            trip_name: event.name,
            date: event.date,
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
        }]).select();

        if (error) throw error;

        // Get event creator for notification
        const { data: eventData } = await supabase
          .from('trips')
          .select('created_by')
          .eq('id', id)
          .single();

        // Send notifications to host
        if (eventData?.created_by) {
          await supabase.from('notifications').insert({
            user_id: eventData.created_by,
            type: 'booking',
            title: 'New Booking Received',
            message: `You have a new free booking for ${event.name}`,
            data: { booking_id: bookingData[0].id, item_type: 'trip' },
          });
        }

        // Send notification to guest if logged in
        if (user) {
          await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'booking',
            title: 'Booking Confirmed',
            message: `Your free booking for ${event.name} has been confirmed`,
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
            itemName: event.name,
            totalAmount: 0,
            bookingDetails: {
              adults,
              children,
              selectedActivities,
              phone: user ? "" : guestPhone,
            },
            visitDate: event.date,
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
        itemName: event.name,
        totalAmount: calculateTotal(),
        bookingDetails: {
          adults,
          children,
          selectedActivities,
          phone: user ? "" : guestPhone,
        },
        visitDate: event.date,
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
          visit_date: event.date,
          booking_details: {
            trip_name: event.name,
            date: event.date,
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
            accountReference: `EVENT-${event.id}`,
            transactionDesc: `Booking for ${event.name}`,
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
        visit_date: event.date,
        total_amount: calculateTotal(),
        slots_booked: totalPeople,
        booking_details: {
          trip_name: event.name,
          date: event.date,
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
      
      setShowBooking(false);
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Event not found</p>
      </div>
    );
  }

  const allImages = [event.image_url, ...(event.images || [])].filter(Boolean);
  const remainingTickets = (event.available_tickets || 0) - bookedTickets;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container px-4 py-8 max-w-7xl mx-auto mb-20 md:mb-0">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Image Carousel */}
          <div className="space-y-4">
            <Carousel className="w-full relative">
              <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground z-20 text-xs font-bold px-3 py-1">
                EVENT
              </Badge>
              <CarouselContent>
                {allImages.map((image, index) => (
                  <CarouselItem key={index}>
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
                      <img
                        src={image}
                        alt={`${event.name} - Image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {allImages.length > 1 && (
                <>
                  <CarouselPrevious className="left-2" />
                  <CarouselNext className="right-2" />
                </>
              )}
            </Carousel>
          </div>

          {/* Event Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <MapPin className="h-4 w-4" />
                <span>{event.location}, {event.country}</span>
              </div>
              
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openInMaps}>
                <MapIcon className="h-4 w-4 mr-2" />
                Map
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                className={isSaved ? "bg-red-500 text-white hover:bg-red-600" : ""}
              >
                <Heart className={`h-4 w-4 mr-2 ${isSaved ? "fill-current" : ""}`} />
                Save
              </Button>
            </div>

            {/* Event Info Card - Hidden on small screens, shown on large */}
            <Card className="p-6 hidden md:block">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Event Date</p>
                    <p className="font-semibold">{new Date(event.date).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tickets Remaining</p>
                    <p className="font-semibold">{remainingTickets} / {event.available_tickets}</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Price per ticket</p>
                      <p className="text-2xl font-bold">KSh {event.price}</p>
                      {event.price_child && event.price_child > 0 && (
                        <p className="text-sm text-muted-foreground">Child: KSh {event.price_child}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      if (!user) {
                        toast({
                          title: "Login Required",
                          description: "Please login to book this event",
                          variant: "destructive",
                        });
                        navigate('/auth');
                        return;
                      }
                      setShowBooking(true);
                    }}
                    disabled={remainingTickets <= 0}
                  >
                    {remainingTickets <= 0 ? "Sold Out" : "Book Tickets"}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Contact Info */}
            {(event.phone_number || event.email) && (
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Contact Information</h3>
                <div className="space-y-3">
                  {event.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${event.phone_number}`} className="hover:underline">
                        {event.phone_number}
                      </a>
                    </div>
                  )}
                  {event.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${event.email}`} className="hover:underline">
                        {event.email}
                      </a>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-8">
          {event.description && (
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">About This Event</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
            </Card>
          )}
        </div>

        {/* Booking Button for Small Screens - Below Description */}
        <div className="md:hidden mb-8">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Event Date</p>
                  <p className="font-semibold">{new Date(event.date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Tickets Remaining</p>
                  <p className="font-semibold">{remainingTickets} / {event.available_tickets}</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Price per ticket</p>
                    <p className="text-2xl font-bold">KSh {event.price}</p>
                    {event.price_child && event.price_child > 0 && (
                      <p className="text-sm text-muted-foreground">Child: KSh {event.price_child}</p>
                    )}
                  </div>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => {
                    if (!user) {
                      toast({
                        title: "Login Required",
                        description: "Please login to book this event",
                        variant: "destructive",
                      });
                      navigate('/auth');
                      return;
                    }
                    setShowBooking(true);
                  }}
                  disabled={remainingTickets <= 0}
                >
                  {remainingTickets <= 0 ? "Sold Out" : "Book Tickets"}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <ReviewSection itemId={event.id} itemType="event" />

        {/* Similar Events */}
        <SimilarItems currentItemId={event.id} itemType="trip" location={event.location} country={event.country} />
      </main>

      {/* Booking Dialog - Full implementation matching AttractionDetail */}
      <Dialog open={showBooking} onOpenChange={setShowBooking}>
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
                setShowBooking(false);
                setIsPaymentCompleted(false);
                if (user) navigate('/bookings');
              }} className="w-full">
                View Bookings
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Book Event Tickets</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
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
                {event.activities && Array.isArray(event.activities) && event.activities.length > 0 && (
                  <div className="space-y-3">
                    <Label>Select Activities (Optional)</Label>
                    {event.activities.map((activity: any, idx: number) => {
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

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default EventDetail;
