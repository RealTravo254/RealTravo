import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Share2, Mail, DollarSign, Clock, ArrowLeft, Heart } from "lucide-react";
import { SimilarItems } from "@/components/SimilarItems";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ReviewSection } from "@/components/ReviewSection";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { getReferralTrackingId } from "@/lib/referralUtils";

interface Facility { name: string; price: number; capacity?: number; }
interface Activity { name: string; price: number; }

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
  opening_hours: string | null;
  closing_hours: string | null;
  days_opened: string[] | null;
  available_slots: number;
}

const AdventurePlaceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [place, setPlace] = useState<AdventurePlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const isSaved = savedItems.has(id || "");

  useEffect(() => { fetchPlace(); }, [id]);

  const fetchPlace = async () => {
    try {
      const { data, error } = await supabase.from("adventure_places").select("*").eq("id", id).single();
      if (error) throw error;
      setPlace(data as any);
    } catch (error) {
      console.error("Error fetching adventure place:", error);
      toast({ title: "Error", description: "Failed to load place details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => { if (id) handleSaveItem(id, "adventure_place"); };
  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: place?.name, text: place?.description, url: window.location.href }); }
      catch (error) { console.log("Share failed:", error); }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied", description: "Place link copied to clipboard" });
    }
  };

  const openInMaps = () => {
    if (place?.map_link) {
      window.open(place.map_link, '_blank');
    } else {
      const query = encodeURIComponent(`${place?.name}, ${place?.location}, ${place?.country}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!place) return;
    setIsProcessing(true);

    try {
      const totalAmount = (data.num_adults * (place.entry_fee_type === 'free' ? 0 : place.entry_fee)) +
                         (data.num_children * (place.entry_fee_type === 'free' ? 0 : place.entry_fee)) +
                         data.selectedFacilities.reduce((sum, f) => { 
                           if (f.startDate && f.endDate) {
                             const days = Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (1000 * 60 * 60 * 24));
                             return sum + (f.price * Math.max(days, 1));
                           }
                           return sum + f.price;
                         }, 0) +
                         data.selectedActivities.reduce((sum, a) => sum + (a.price * a.numberOfPeople), 0);

      if (totalAmount === 0) {
        const { data: bookingResult, error } = await supabase.from('bookings').insert([{
          user_id: user?.id || null, item_id: id, booking_type: 'adventure_place', visit_date: data.visit_date, total_amount: 0,
          booking_details: { place_name: place.name, adults: data.num_adults, children: data.num_children, facilities: data.selectedFacilities, activities: data.selectedActivities } as any,
          payment_method: 'free', is_guest_booking: !user, guest_name: !user ? data.guest_name : null, guest_email: !user ? data.guest_email : null,
          guest_phone: !user ? data.guest_phone : null, payment_status: 'paid',
        }]).select();

        if (error) throw error;
        setIsProcessing(false);
        setIsCompleted(true);
        return;
      }

      // M-Pesa flow
      if (data.payment_method === "mpesa") {
        const { data: mpesaResponse } = await supabase.functions.invoke("mpesa-stk-push", {
          body: { phoneNumber: data.payment_phone, amount: totalAmount, accountReference: `ADVENTURE-${place.id}`, transactionDesc: `Booking for ${place.name}`,
            bookingData: { user_id: user?.id, booking_type: "adventure_place", item_id: id, total_amount: totalAmount, visit_date: data.visit_date, booking_details: { place_name: place.name, adults: data.num_adults, children: data.num_children } as any, referral_tracking_id: getReferralTrackingId() }
          },
        });

        if (!mpesaResponse?.success) throw new Error("M-Pesa payment failed");

        const startTime = Date.now();
        while (Date.now() - startTime < 120000) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const { data: pendingPayment } = await supabase.from('pending_payments').select('payment_status').eq('checkout_request_id', mpesaResponse.checkoutRequestId).single();
          if (pendingPayment?.payment_status === 'completed') { setIsProcessing(false); setIsCompleted(true); return; }
        }
        throw new Error('Payment timeout');
      }
    } catch (error: any) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  if (loading || !place) return <div className="min-h-screen bg-background"><Header /><div className="h-96 bg-muted animate-pulse" /><Footer /><MobileBottomBar /></div>;

  const displayImages = [place.image_url, ...(place.gallery_images || []), ...(place.images || [])].filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      <main className="container px-4 py-6 max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        
        <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
          <div className="w-full relative">
            <Carousel opts={{ loop: true }} plugins={[Autoplay({ delay: 3000 })]} className="w-full rounded-2xl overflow-hidden">
              <CarouselContent>
                {displayImages.map((img, idx) => <CarouselItem key={idx}><img src={img} alt={`${place.name} ${idx + 1}`} className="w-full h-64 md:h-96 object-cover" /></CarouselItem>)}
              </CarouselContent>
              {displayImages.length > 1 && (
                <>
                  <CarouselPrevious className="left-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                  <CarouselNext className="right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                </>
              )}
            </Carousel>
            
            {place.description && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white p-4 z-10">
                <h2 className="text-lg font-semibold mb-2">About This Place</h2>
                <p className="text-sm line-clamp-3">{place.description}</p>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{place.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <MapPin className="h-4 w-4" />
                <span>{place.location}, {place.country}</span>
              </div>
            </div>

            <div className="space-y-3 p-4 border bg-card">
              {(place.opening_hours || place.closing_hours) && (
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Operating Hours</p>
                    <p className="font-semibold">{place.opening_hours} - {place.closing_hours}</p>
                    {place.days_opened && place.days_opened.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{place.days_opened.join(', ')}</p>
                    )}
                  </div>
                </div>
              )}
              
              <div className={`${place.opening_hours || place.closing_hours ? 'border-t pt-3' : ''}`}>
                <p className="text-sm text-muted-foreground mb-1">Entry Fee</p>
                <p className="text-2xl font-bold">
                  {place.entry_fee_type === 'free' ? 'Free Entry' : 
                   place.entry_fee ? `KSh ${place.entry_fee}` : 'Contact for pricing'}
                </p>
                {place.available_slots && <p className="text-sm text-muted-foreground mt-2">Available Slots: {place.available_slots}</p>}
              </div>

              <Button size="lg" className="w-full" onClick={() => setBookingOpen(true)}>
                Book Now
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

        {place.amenities && place.amenities.length > 0 && (
          <div className="mt-6 p-6 border bg-card">
            <h2 className="text-xl font-semibold mb-4">Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {place.amenities.map((amenity: any, idx: number) => (
                <div key={idx} className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm">
                  {amenity}
                </div>
              ))}
            </div>
          </div>
        )}

        {place.facilities && place.facilities.length > 0 && (
          <div className="mt-6 p-6 border bg-card">
            <h2 className="text-xl font-semibold mb-4">Facilities</h2>
            <div className="flex flex-wrap gap-2">
              {place.facilities.map((facility: Facility, idx: number) => (
                <div key={idx} className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm flex items-center gap-2">
                  <span className="font-medium">{facility.name}</span>
                  <span className="text-xs opacity-90">{facility.price === 0 ? 'Free' : `KSh ${facility.price}/day`}</span>
                  {facility.capacity && <span className="text-xs opacity-90">• Capacity: {facility.capacity}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {place.activities && place.activities.length > 0 && (
          <div className="mt-6 p-6 border bg-card">
            <h2 className="text-xl font-semibold mb-4">Activities</h2>
            <div className="flex flex-wrap gap-2">
              {place.activities.map((activity: Activity, idx: number) => (
                <div key={idx} className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm flex items-center gap-2">
                  <span className="font-medium">{activity.name}</span>
                  <span className="text-xs opacity-90">{activity.price === 0 ? 'Free' : `KSh ${activity.price}/person`}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(place.phone_numbers || place.email) && (
          <div className="mt-6 p-6 border bg-card">
            <h2 className="text-xl font-semibold mb-3">Contact Information</h2>
            <div className="space-y-2">
              {place.phone_numbers?.map((phone, idx) => (
                <p key={idx} className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${phone}`} className="text-primary hover:underline">{phone}</a>
                </p>
              ))}
              {place.email && (
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${place.email}`} className="text-primary hover:underline">{place.email}</a>
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6">
          <ReviewSection itemId={place.id} itemType="adventure_place" />
        </div>

        {place && <SimilarItems currentItemId={place.id} itemType="adventure" country={place.country} />}
      </main>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <MultiStepBooking 
            onSubmit={handleBookingSubmit} 
            facilities={place.facilities || []} 
            activities={place.activities || []} 
            priceAdult={place.entry_fee_type === 'free' ? 0 : place.entry_fee} 
            priceChild={place.entry_fee_type === 'free' ? 0 : place.entry_fee} 
            entranceType={place.entry_fee_type} 
            isProcessing={isProcessing} 
            isCompleted={isCompleted} 
            itemName={place.name} 
          />
        </DialogContent>
      </Dialog>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default AdventurePlaceDetail;
