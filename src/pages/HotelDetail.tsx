import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Share2, Mail, Wifi, Users, Clock, DollarSign, ArrowLeft, Heart, Loader2 } from "lucide-react";
import { SimilarItems } from "@/components/SimilarItems";
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
import { ReviewSection } from "@/components/ReviewSection";
import Autoplay from "embla-carousel-autoplay";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";

interface Facility {
  name: string;
  price: number;
  capacity: number;
}

interface Activity {
  name: string;
  price: number;
}

interface SelectedFacility extends Facility {
  startDate: string;
  endDate: string;
}

interface SelectedActivity extends Activity {
  numberOfPeople: number;
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
  const { user } = useAuth();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  
  // Booking form state
  const [bookingLoading, setBookingLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isPaymentCompleted, setIsPaymentCompleted] = useState(false);
  const [completedBookingId, setCompletedBookingId] = useState<string | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);
  const [selectedFacilities, setSelectedFacilities] = useState<SelectedFacility[]>([]);
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
    fetchHotel();
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

  const handleSave = () => {
    if (id) {
      handleSaveItem(id, "hotel");
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

  const toggleFacility = (facility: Facility, checked: boolean) => {
    if (checked) {
      setSelectedFacilities([...selectedFacilities, { ...facility, startDate: "", endDate: "" }]);
    } else {
      setSelectedFacilities(selectedFacilities.filter(f => f.name !== facility.name));
    }
  };

  const toggleActivity = (activity: Activity, checked: boolean) => {
    if (checked) {
      setSelectedActivities([...selectedActivities, { ...activity, numberOfPeople: 1 }]);
    } else {
      setSelectedActivities(selectedActivities.filter(a => a.name !== activity.name));
    }
  };

  const updateFacilityDates = (name: string, field: 'startDate' | 'endDate', value: string) => {
    setSelectedFacilities(selectedFacilities.map(f => 
      f.name === name ? { ...f, [field]: value } : f
    ));
  };

  const updateActivityPeople = (name: string, count: number) => {
    setSelectedActivities(selectedActivities.map(a => 
      a.name === name ? { ...a, numberOfPeople: Math.max(1, count) } : a
    ));
  };

  const calculateTotal = () => {
    let total = 0;
    
    // Facilities
    total += selectedFacilities.reduce((sum, facility) => {
      if (!facility.startDate || !facility.endDate) return sum;
      const days = Math.ceil((new Date(facility.endDate).getTime() - new Date(facility.startDate).getTime()) / (1000 * 60 * 60 * 24));
      return sum + (facility.price * Math.max(days, 1));
    }, 0);
    
    // Activities
    total += selectedActivities.reduce((sum, activity) => sum + (activity.price * activity.numberOfPeople), 0);
    
    return total;
  };

  const handleBooking = async () => {
    if (!hotel) return;

    // Validation
    if (!visitDate) {
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

    const incompleteFacilities = selectedFacilities.some(f => !f.startDate || !f.endDate);
    if (incompleteFacilities) {
      toast({
        title: "Missing dates",
        description: "Please enter dates for all selected facilities",
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
        const { data: bookingResult, error } = await supabase.from('bookings').insert([{
          user_id: user?.id || null,
          item_id: id,
          booking_type: 'hotel',
          visit_date: visitDate,
          total_amount: 0,
          booking_details: {
            hotel_name: hotel.name,
            adults,
            children,
            facilities: selectedFacilities,
            activities: selectedActivities,
          } as any,
          payment_method: 'free',
          is_guest_booking: !user,
          guest_name: !user ? guestName : null,
          guest_email: !user ? guestEmail : null,
          guest_phone: !user ? guestPhone : null,
          payment_status: 'paid',
        }]).select();

        if (error) throw error;

        // Get hotel creator for notification
        const { data: hotelData } = await supabase
          .from('hotels')
          .select('created_by')
          .eq('id', id)
          .single();

        // Send notifications to host
        if (hotelData?.created_by) {
          await supabase.from('notifications').insert({
            user_id: hotelData.created_by,
            type: 'booking',
            title: 'New Booking Received',
            message: `You have a new free booking for ${hotel.name}`,
            data: { booking_id: bookingResult[0].id, item_type: 'hotel' },
          });
        }

        // Send notification to guest if logged in
        if (user) {
          await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'booking',
            title: 'Booking Confirmed',
            message: `Your free booking for ${hotel.name} has been confirmed`,
            data: { booking_id: bookingResult[0].id, item_type: 'hotel' },
          });
        }

        // Send confirmation email
        await supabase.functions.invoke('send-booking-confirmation', {
          body: {
            bookingId: bookingResult[0].id,
            email: user ? user.email : guestEmail,
            guestName: user ? user.user_metadata?.name || guestName : guestName,
            bookingType: 'hotel',
            itemName: hotel.name,
            totalAmount: 0,
            bookingDetails: {
              adults,
              children,
              selectedFacilities,
              selectedActivities,
              phone: user ? "" : guestPhone,
            },
            visitDate,
          },
        });

        setCompletedBookingId(bookingResult[0].id);
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
      const emailData = {
        bookingId: '',
        email: user ? user.email : guestEmail,
        guestName: user ? user.user_metadata?.name || guestName : guestName,
        bookingType: "hotel",
        itemName: hotel.name,
        totalAmount: calculateTotal(),
        bookingDetails: {
          adults,
          children,
          selectedFacilities,
          selectedActivities,
          phone: user ? "" : guestPhone,
        },
        visitDate,
      };

      // M-Pesa payment flow
      if (paymentMethod === "mpesa") {
        const bookingData = {
          user_id: user?.id || null,
          booking_type: "hotel",
          item_id: id,
          visit_date: visitDate,
          total_amount: calculateTotal(),
          payment_method: paymentMethod,
          payment_phone: paymentPhone || null,
          is_guest_booking: !user,
          guest_name: !user ? guestName : null,
          guest_email: !user ? guestEmail : null,
          guest_phone: !user ? guestPhone : null,
          booking_details: {
            hotel_name: hotel.name,
            adults,
            children,
            facilities: selectedFacilities,
            activities: selectedActivities,
          } as any,
          emailData,
        };

        const { data: mpesaResponse, error: mpesaError } = await supabase.functions.invoke("mpesa-stk-push", {
          body: {
            phoneNumber: paymentPhone,
            amount: calculateTotal(),
            accountReference: `HOTEL-${hotel.id}`,
            transactionDesc: `Booking for ${hotel.name}`,
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
        booking_type: 'hotel',
        visit_date: visitDate,
        total_amount: calculateTotal(),
        booking_details: {
          hotel_name: hotel.name,
          adults,
          children,
          facilities: selectedFacilities,
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
                onClick={() => {
                  if (!user) {
                    toast({
                      title: "Login Required",
                      description: "Please login to book this hotel",
                      variant: "destructive",
                    });
                    navigate('/auth');
                    return;
                  }
                  setBookingOpen(true);
                }}
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
            onClick={() => {
              if (!user) {
                toast({
                  title: "Login Required",
                  description: "Please login to book this hotel",
                  variant: "destructive",
                });
                navigate('/auth');
                return;
              }
              setBookingOpen(true);
            }}
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
                          <div>
                            <h3 className="font-semibold text-xs md:text-base">{facility.name}</h3>
                            <p className="text-xs text-muted-foreground mt-1">Capacity: {facility.capacity} guests</p>
                          </div>
                          <span className="text-base md:text-lg font-bold">
                            KSh {facility.price}/day
                          </span>
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
                          KSh {activity.price}
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
                <DialogTitle>Book Your Stay</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="visit_date">Check-in Date</Label>
                  <Input
                    id="visit_date"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    required
                  />
                </div>

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

                {/* Facilities Selection */}
                {hotel.facilities && Array.isArray(hotel.facilities) && hotel.facilities.length > 0 && (
                  <div className="space-y-3">
                    <Label>Select Rooms (Optional)</Label>
                    {hotel.facilities.map((facility: any, idx: number) => {
                      const selected = selectedFacilities.find(f => f.name === facility.name);
                      return (
                        <div key={idx} className="border rounded p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={!!selected}
                                onCheckedChange={(checked) => toggleFacility(facility, !!checked)}
                              />
                              <div>
                                <p className="font-medium">{facility.name}</p>
                                <p className="text-xs text-muted-foreground">Capacity: {facility.capacity} guests</p>
                              </div>
                            </div>
                            <span className="font-bold">KSh {facility.price}/day</span>
                          </div>
                          {selected && (
                            <div className="ml-8 grid grid-cols-2 gap-2">
                              <div>
                                <Label htmlFor={`facility-start-${idx}`} className="text-xs">Start Date</Label>
                                <Input
                                  id={`facility-start-${idx}`}
                                  type="date"
                                  min={visitDate || new Date().toISOString().split('T')[0]}
                                  value={selected.startDate}
                                  onChange={(e) => updateFacilityDates(facility.name, 'startDate', e.target.value)}
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor={`facility-end-${idx}`} className="text-xs">End Date</Label>
                                <Input
                                  id={`facility-end-${idx}`}
                                  type="date"
                                  min={selected.startDate || visitDate || new Date().toISOString().split('T')[0]}
                                  value={selected.endDate}
                                  onChange={(e) => updateFacilityDates(facility.name, 'endDate', e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Activities Selection */}
                {hotel.activities && Array.isArray(hotel.activities) && hotel.activities.length > 0 && (
                  <div className="space-y-3">
                    <Label>Select Activities (Optional)</Label>
                    {hotel.activities.map((activity: any, idx: number) => {
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

export default HotelDetail;
