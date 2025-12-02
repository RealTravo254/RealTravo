import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Icons will be Teal: #008080
import { MapPin, Phone, Share2, Mail, Clock, Calendar, DollarSign, ArrowLeft, Heart, Copy } from "lucide-react"; 
import { SimilarItems } from "@/components/SimilarItems";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ReviewSection } from "@/components/ReviewSection";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { generateReferralLink, trackReferralClick, getReferralTrackingId } from "@/lib/referralUtils";

interface Facility {
  name: string;
  price?: number;
  capacity?: number;
}

interface Activity {
  name: string;
  price: number;
}

interface Attraction {
  id: string;
  location_name: string;
  local_name: string | null;
  country: string;
  photo_urls: string[];
  gallery_images: string[];
  description: string;
  entrance_type: string;
  price_adult: number;
  price_child: number;
  phone_number: string;
  email: string;
  facilities: Facility[];
  activities: Activity[];
  amenities: string[];
  opening_hours: string | null;
  closing_hours: string | null;
  days_opened: string[] | null;
  location_link: string | null;
}

// Define the Teal color for repeated use (0,128,128)
const TEAL_COLOR = "#008080";
const ORANGE_COLOR = "#FF9800";
const RED_COLOR = "#EF4444"; // Using a strong red for visibility

const AttractionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [attraction, setAttraction] = useState<Attraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const isSaved = savedItems.has(id || "");

  useEffect(() => {
    fetchAttraction();
    
    // Track referral clicks
    const urlParams = new URLSearchParams(window.location.search);
    const refSlug = urlParams.get("ref");
    if (refSlug && id) {
      trackReferralClick(refSlug, id, "attraction", "booking");
    }
  }, [id]);

  const fetchAttraction = async () => {
    try {
      const { data, error } = await supabase.from("attractions").select("*").eq("id", id).single();
      if (error) throw error;
      setAttraction(data as any);
    } catch (error) {
      console.error("Error fetching attraction:", error);
      toast({ title: "Error", description: "Failed to load attraction details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (id) {
      handleSaveItem(id, "attraction");
    }
  };

  const handleCopyLink = async () => {
    if (!attraction) {
      toast({ title: "Unable to Copy", description: "Attraction information not available", variant: "destructive" });
      return;
    }

    const refLink = await generateReferralLink(attraction.id, "attraction", attraction.id);

    try {
      await navigator.clipboard.writeText(refLink);
      toast({ 
        title: "Link Copied!", 
        description: user 
          ? "Share this link to earn commission on bookings!" 
          : "Share this attraction with others!" 
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
    if (!attraction) {
      toast({ title: "Unable to Share", description: "Attraction information not available", variant: "destructive" });
      return;
    }

    const refLink = await generateReferralLink(attraction.id, "attraction", attraction.id);

    if (navigator.share) {
      try {
        await navigator.share({ title: attraction?.location_name, text: attraction?.description, url: refLink });
      } catch (error) {
        console.log("Share failed:", error);
      }
    } else {
      await handleCopyLink();
    }
  };

  const openInMaps = () => {
    if (attraction?.location_link) {
      window.open(attraction.location_link, '_blank');
    } else {
      const query = encodeURIComponent(`${attraction?.location_name}, ${attraction?.country}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!attraction) return;

    setIsProcessing(true);

    try {
      const totalAmount = (data.num_adults * (attraction.price_adult || 0)) +
                           (data.num_children * (attraction.price_child || 0)) +
                           data.selectedActivities.reduce((sum, a) => sum + (a.price * a.numberOfPeople), 0);

      if (totalAmount === 0 || attraction.entrance_type === 'free') {
        const { data: bookingResult, error } = await supabase.from('bookings').insert([{
          user_id: user?.id || null,
          item_id: id,
          booking_type: 'attraction',
          visit_date: data.visit_date,
          total_amount: 0,
          booking_details: { attraction_name: attraction.location_name, adults: data.num_adults, children: data.num_children, activities: data.selectedActivities } as any,
          payment_method: 'free',
          is_guest_booking: !user,
          guest_name: !user ? data.guest_name : null,
          guest_email: !user ? data.guest_email : null,
          guest_phone: !user ? data.guest_phone : null,
          payment_status: 'paid',
          referral_tracking_id: getReferralTrackingId(),
        }]).select();

        if (error) throw error;

        setIsProcessing(false);
        setIsCompleted(true);
        return;
      }

      // M-Pesa flow
      if (data.payment_method === "mpesa") {
        const bookingPayload = {
          user_id: user?.id || null,
          booking_type: "attraction",
          item_id: id,
          visit_date: data.visit_date,
          total_amount: totalAmount,
          payment_method: data.payment_method,
          payment_phone: data.payment_phone || null,
          booking_details: { attraction_name: attraction.location_name, adults: data.num_adults, children: data.num_children, activities: data.selectedActivities } as any,
          referral_tracking_id: getReferralTrackingId(),
        };

        const { data: mpesaResponse, error: mpesaError } = await supabase.functions.invoke("mpesa-stk-push", {
          body: { phoneNumber: data.payment_phone, amount: totalAmount, accountReference: `ATTR-${attraction.id}`, transactionDesc: `Booking for ${attraction.location_name}`, bookingData: bookingPayload },
        });

        if (mpesaError || !mpesaResponse?.success) throw new Error("M-Pesa payment failed");

        const checkoutRequestId = mpesaResponse.checkoutRequestId;
        const startTime = Date.now();

        while (Date.now() - startTime < 40000) {
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

        const { data: queryResponse } = await supabase.functions.invoke('mpesa-stk-query', { body: { checkoutRequestId } });
        if (queryResponse?.resultCode === '0') {
          setIsProcessing(false);
          setIsCompleted(true);
          return;
        } else {
          throw new Error('Payment timeout');
        }
      }
    } catch (error: any) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  if (loading || !attraction) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header />
        <div className="container px-4 py-6"><div className="h-96 bg-muted animate-pulse rounded-lg" /></div>
        <MobileBottomBar />
      </div>
    );
  }

  const images = [
    ...(attraction.photo_urls || []),
    ...(attraction.gallery_images || [])
  ].filter(Boolean);

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
                {images?.map((url, index) => (
                  <CarouselItem key={index}>
                    <img src={url} alt={`${attraction.location_name} ${index + 1}`} loading="lazy" decoding="async" className="w-full h-64 md:h-96 object-cover" />
                  </CarouselItem>
                ))}
              </CarouselContent>

              {images && images.length > 1 && (
                <>
                  <CarouselPrevious className="left-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                  <CarouselNext className="right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                </>
              )}
            </Carousel>
            
            {attraction.description && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white p-4 z-10">
                <h2 className="text-lg font-semibold mb-2">About This Attraction</h2>
                <p className="text-sm line-clamp-3">{attraction.description}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{attraction.location_name}</h1>
              {attraction.local_name && <p className="text-xl text-muted-foreground mb-2">{attraction.local_name}</p>}
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                {/* Location Icon Teal */}
                <MapPin className="h-4 w-4" style={{ color: TEAL_COLOR }} /> 
                <span>{attraction.country}</span>
              </div>
            </div>

            <div className="space-y-3 p-4 border bg-card">
              {(attraction.opening_hours || attraction.closing_hours) && (
                <div className="flex items-center gap-2">
                  {/* Clock Icon Teal */}
                  <Clock className="h-5 w-5" style={{ color: TEAL_COLOR }} /> 
                  <div>
                    <p className="text-sm text-muted-foreground">Operating Hours</p>
                    <p className="font-semibold">{attraction.opening_hours} - {attraction.closing_hours}</p>
                    {attraction.days_opened && attraction.days_opened.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{attraction.days_opened.join(', ')}</p>
                    )}
                  </div>
                </div>
              )}
              
              <div className={`${attraction.opening_hours || attraction.closing_hours ? 'border-t pt-3' : ''}`}>
                <p className="text-sm text-muted-foreground mb-1">Entrance Fee</p>
                <p className="text-2xl font-bold">
                  {attraction.entrance_type === 'free' ? 'Free Entry' : 
                    attraction.price_adult ? `KSh ${attraction.price_adult}` : 'Contact for pricing'}
                </p>
                {attraction.price_child > 0 && <p className="text-sm text-muted-foreground">Child: KSh {attraction.price_child}</p>}
              </div>

              {/* Book Now Button Teal and dark hover */}
              <Button 
                size="lg" 
                className="w-full text-white" 
                onClick={() => setBookingOpen(true)}
                style={{ backgroundColor: TEAL_COLOR }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#005555')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL_COLOR)}
              >
                Book Now
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

        {attraction.amenities && attraction.amenities.length > 0 && (
          <div className="mt-6 p-6 border bg-card">
            <h2 className="text-xl font-semibold mb-4">Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {attraction.amenities.map((amenity: string, idx: number) => (
                // Amenities Badge Red
                <div 
                  key={idx} 
                  className="px-4 py-2 text-white rounded-full text-sm"
                  style={{ backgroundColor: RED_COLOR }} 
                >
                  {amenity}
                </div>
              ))}
            </div>
          </div>
        )}

        {attraction.facilities && attraction.facilities.length > 0 && (
          <div className="mt-6 p-6 border bg-card">
            <h2 className="text-xl font-semibold mb-4">Facilities</h2>
            <div className="flex flex-wrap gap-2">
              {attraction.facilities.map((facility: any, idx: number) => (
                // Facilities Badge Teal
                <div 
                  key={idx} 
                  className="px-4 py-2 text-white rounded-full text-sm flex items-center gap-2"
                  style={{ backgroundColor: TEAL_COLOR }}
                >
                  <span className="font-medium">{facility.name}</span>
                  {facility.price !== undefined && (
                    <span className="text-xs opacity-90">{facility.price === 0 ? 'Free' : `KSh ${facility.price}`}</span>
                  )}
                  {facility.capacity && <span className="text-xs opacity-90">• Capacity: {facility.capacity}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {attraction.activities && attraction.activities.length > 0 && (
          <div className="mt-6 p-6 border bg-card">
            <h2 className="text-xl font-semibold mb-4">Activities</h2>
            <div className="flex flex-wrap gap-2">
              {attraction.activities.map((activity: Activity, idx: number) => (
                // Activities Badge Orange
                <div 
                  key={idx} 
                  className="px-4 py-2 text-white rounded-full text-sm flex items-center gap-2"
                  style={{ backgroundColor: ORANGE_COLOR }} 
                >
                  <span className="font-medium">{activity.name}</span>
                  <span className="text-xs opacity-90">{activity.price === 0 ? 'Free' : `KSh ${activity.price}/person`}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(attraction.phone_number || attraction.email) && (
          <div className="mt-6 p-6 border bg-card">
            <h2 className="text-xl font-semibold mb-3">Contact Information</h2>
            <div className="space-y-2">
              {attraction.phone_number && (
                <p className="flex items-center gap-2">
                  {/* Phone Icon Teal */}
                  <Phone className="h-4 w-4" style={{ color: TEAL_COLOR }} /> 
                  <a href={`tel:${attraction.phone_number}`} className="hover:underline" style={{ color: TEAL_COLOR }}>{attraction.phone_number}</a>
                </p>
              )}
              {attraction.email && (
                <p className="flex items-center gap-2">
                  {/* Mail Icon Teal */}
                  <Mail className="h-4 w-4" style={{ color: TEAL_COLOR }} /> 
                  <a href={`mailto:${attraction.email}`} className="hover:underline" style={{ color: TEAL_COLOR }}>{attraction.email}</a>
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6">
          <ReviewSection itemId={attraction.id} itemType="attraction" />
        </div>

        {attraction && <SimilarItems currentItemId={attraction.id} itemType="attraction" country={attraction.country} />}
      </main>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        {/* Calendar Icon used internally in MultiStepBooking may need internal update for Teal */}
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <MultiStepBooking 
            onSubmit={handleBookingSubmit} 
            priceAdult={attraction.price_adult || 0}
            priceChild={attraction.price_child || 0}
            entranceType={attraction.entrance_type}
            facilities={(attraction.facilities || []).map(f => ({ ...f, price: f.price || 0 }))}
            activities={attraction.activities || []}
            isProcessing={isProcessing} 
            isCompleted={isCompleted} 
            itemName={attraction.location_name} 
          />
        </DialogContent>
      </Dialog>

      <MobileBottomBar />
    </div>
  );
};

export default AttractionDetail;