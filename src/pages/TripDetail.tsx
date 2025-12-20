import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Share2, Mail, Clock, ArrowLeft, Heart, Copy, Star, Zap, Calendar, Users } from "lucide-react";
import { SimilarItems } from "@/components/SimilarItems";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ReviewSection } from "@/components/ReviewSection";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { generateReferralLink } from "@/lib/referralUtils";
import { useBookingSubmit } from "@/hooks/useBookingSubmit";
import { extractIdFromSlug } from "@/lib/slugUtils";
import { useRealtimeItemAvailability } from "@/hooks/useRealtimeBookings";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  ORANGE: "#FF9800",
  SOFT_GRAY: "#F8F9FA"
};

const TripDetail = () => {
  const { slug } = useParams();
  const id = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [trip, setTrip] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const isSaved = savedItems.has(id || "");

  useEffect(() => {
    if (id) fetchTrip();
  }, [id]);

  const fetchTrip = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("trips")
        .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,price,price_child,available_tickets,description,activities,phone_number,email,created_by")
        .eq("id", id)
        .single();
      if (error) throw error;
      setTrip(data);
    } catch (error) {
      toast({ title: "Trip not found", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSave = () => id && handleSaveItem(id, "trip");
  
  const handleCopyLink = async () => {
    const refLink = await generateReferralLink(trip.id, "trip", trip.id);
    await navigator.clipboard.writeText(refLink);
    toast({ title: "Link Copied!" });
  };

  const handleShare = async () => {
    const refLink = await generateReferralLink(trip.id, "trip", trip.id);
    if (navigator.share) {
      try { await navigator.share({ title: trip.name, url: refLink }); } catch (e) {}
    } else { handleCopyLink(); }
  };

  const openInMaps = () => {
    const query = encodeURIComponent(`${trip?.name}, ${trip?.location}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const { submitBooking } = useBookingSubmit();

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!trip) return;
    setIsProcessing(true);
    try {
      const totalAmount = (data.num_adults * trip.price) + (data.num_children * (trip.price_child || 0));
      await submitBooking({
        itemId: trip.id, itemName: trip.name, bookingType: 'trip', totalAmount,
        slotsBooked: data.num_adults + data.num_children, visitDate: data.visit_date,
        guestName: data.guest_name, guestEmail: data.guest_email, guestPhone: data.guest_phone,
        hostId: trip.created_by, bookingDetails: { ...data, trip_name: trip.name }
      });
      setIsCompleted(true);
      setBookingOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  // Real-time availability tracking
  const { remainingSlots, isSoldOut } = useRealtimeItemAvailability(id || undefined, trip?.available_tickets || 0);

  if (loading) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;
  if (!trip) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tripDate = trip.date ? new Date(trip.date) : null;
  const isExpired = !trip.is_custom_date && tripDate && tripDate < today;
  const canBook = !isExpired && !isSoldOut;
  const allImages = [trip.image_url, ...(trip.gallery_images || []), ...(trip.images || [])].filter(Boolean);

  // SECTION COMPONENTS
  const OverviewSection = () => (
    <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
      <h2 className="text-xl font-black uppercase tracking-tight mb-4" style={{ color: COLORS.TEAL }}>Overview</h2>
      <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-line">{trip.description}</p>
    </div>
  );

  const ActivitiesSection = () => trip.activities?.length > 0 && (
    <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-orange-50"><Zap className="h-5 w-5 text-[#FF9800]" /></div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.ORANGE }}>Included Activities</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Experiences in this package</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {trip.activities.map((act: any, i: number) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-orange-50/50 border border-orange-100/50">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF9800]" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide">{act.name}</span>
              <span className="text-[10px] font-bold text-[#FF9800]">{act.price === 0 ? "Included" : `Value: KSh ${act.price}`}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const BookingCard = () => (
    <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100 lg:sticky lg:top-24">
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Price</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black" style={{ color: COLORS.RED }}>KSh {trip.price}</span>
            <span className="text-slate-400 text-[10px] font-bold uppercase">/ adult</span>
          </div>
        </div>
        <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center gap-2">
          <Clock className="h-4 w-4" style={{ color: COLORS.TEAL }} />
          <span className={`text-xs font-black uppercase ${isSoldOut ? "text-red-500" : "text-slate-600"}`}>
            {isSoldOut ? "Full" : `${remainingSlots} Left`}
          </span>
        </div>
      </div>

      <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Users className="h-3 w-3" /> Booking Availability
          </span>
          <span className={`text-[10px] font-black uppercase ${remainingSlots < 5 ? 'text-red-500' : 'text-emerald-600'}`}>
            {isSoldOut ? "Sold Out" : `${remainingSlots} Tickets Remaining`}
          </span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
           <div 
            className={`h-full transition-all duration-500 ${remainingSlots < 5 ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${Math.min((remainingSlots / (trip.available_tickets || 50)) * 100, 100)}%` }}
           />
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
          <span className="text-slate-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> Trip Date</span>
          <span className={isExpired ? "text-red-500" : "text-slate-700"}>
            {trip.is_custom_date ? "Flexible" : new Date(trip.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            {isExpired && " (Past)"}
          </span>
        </div>
        <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
           <span className="text-slate-400">Child Rate</span>
           <span className="text-slate-700">KSh {trip.price_child || 'N/A'}</span>
        </div>
      </div>

      <Button 
        onClick={() => setBookingOpen(true)}
        disabled={!canBook}
        className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none mb-6"
        style={{ 
            background: !canBook 
                ? "#cbd5e1" 
                : `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
        }}
      >
        {isSoldOut ? "Fully Booked" : isExpired ? "Trip Expired" : "Secure My Spot"}
      </Button>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <UtilityButton icon={<MapPin className="h-5 w-5" />} label="Map" onClick={openInMaps} />
        <UtilityButton icon={<Copy className="h-5 w-5" />} label="Copy" onClick={handleCopyLink} />
        <UtilityButton icon={<Share2 className="h-5 w-5" />} label="Share" onClick={handleShare} />
      </div>

      <div className="space-y-4 pt-6 border-t border-slate-50">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Organizer Contact</h3>
        {trip.phone_number && (
          <a href={`tel:${trip.phone_number}`} className="flex items-center gap-3 text-slate-600 hover:text-[#008080] transition-colors">
            <div className="p-2 rounded-lg bg-slate-50">
              <Phone className="h-4 w-4 text-[#008080]" />
            </div>
            <span className="text-xs font-bold uppercase tracking-tight">{trip.phone_number}</span>
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* HERO SECTION */}
      <div className="relative w-full overflow-hidden h-[55vh] md:h-[65vh] bg-slate-900">
        <div className="absolute top-4 left-4 right-4 z-50 flex justify-between">
          <Button onClick={() => navigate(-1)} className="rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0 hover:bg-black/50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button onClick={handleSave} className={`rounded-full backdrop-blur-md border-none w-10 h-10 p-0 shadow-lg transition-colors ${isSaved ? "bg-red-500" : "bg-black/30 hover:bg-black/50"}`}>
            <Heart className={`h-5 w-5 text-white ${isSaved ? "fill-white" : ""}`} />
          </Button>
        </div>

        <Carousel plugins={[Autoplay({ delay: 4000 })]} className="w-full h-full p-0">
          <CarouselContent className="h-full ml-0">
            {allImages.map((img, idx) => (
              <CarouselItem key={idx} className="h-full pl-0 basis-full">
                <div className="relative h-full w-full">
                  <img src={img} alt={trip.name} className="w-full h-full object-cover object-center" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent z-10" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="absolute bottom-10 left-0 z-40 w-full p-8 pointer-events-none">
          <div className="relative z-10 space-y-4 pointer-events-auto">
            <Button className="bg-[#FF7F50] border-none px-4 py-1.5 h-auto uppercase font-black tracking-[0.15em] text-[10px] rounded-full shadow-lg">Scheduled Trip</Button>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl mb-3">{trip.name}</h1>
          <div className="flex items-center gap-3 group w-fit cursor-pointer" onClick={openInMaps}>
               <MapPin className="h-5 w-5 text-white" />
               <span className="text-sm font-black text-white uppercase tracking-wider px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm">
                 {[trip.place, trip.location, trip.country].filter(Boolean).join(', ')}
               </span>
          </div>
          </div>
        </div>
      </div>

      <main className="container px-4 max-w-6xl mx-auto -mt-10 relative z-50">
        <div className="flex flex-col lg:grid lg:grid-cols-[1.7fr,1fr] gap-6">
          
          {/* LEFT COLUMN: Main Content Stack */}
          <div className="flex flex-col gap-6">
            <OverviewSection />

            {/* Mobile Only Booking Card */}
            <div className="block lg:hidden">
              <BookingCard />
            </div>

            <ActivitiesSection />

            {/* REVIEWS: Now inside the left column to fill the gap on desktop */}
            <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <ReviewSection itemId={trip.id} itemType="trip" />
            </div>
          </div>

          {/* RIGHT COLUMN: Desktop Sticky Sidebar */}
          <div className="hidden lg:block">
            <BookingCard />
          </div>
        </div>

        {/* Similar Items: Stays full-width at the bottom */}
        <div className="mt-12 lg:mt-16">
          <SimilarItems currentItemId={trip.id} itemType="trip" country={trip.country} />
        </div>
      </main>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[95vh] p-0 overflow-hidden rounded-[32px] border-none shadow-2xl">
          <MultiStepBooking 
            onSubmit={handleBookingSubmit} activities={trip.activities || []} 
            priceAdult={trip.price} priceChild={trip.price_child} 
            isProcessing={isProcessing} isCompleted={isCompleted} 
            itemName={trip.name} itemId={trip.id} bookingType="trip"
            hostId={trip.created_by || ""} onPaymentSuccess={() => setIsCompleted(true)}
            onCancel={() => setBookingOpen(false)} primaryColor={COLORS.TEAL} accentColor={COLORS.CORAL}
          />
        </DialogContent>
      </Dialog>
      <MobileBottomBar />
    </div>
  );
};

const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <Button variant="ghost" onClick={onClick} className="flex-col h-auto py-3 bg-[#F8F9FA] text-slate-500 rounded-2xl hover:bg-slate-100 transition-colors border border-slate-100 flex-1">
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
  </Button>
);

export default TripDetail;