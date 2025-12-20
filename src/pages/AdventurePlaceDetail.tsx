import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Phone, Share2, Mail, Clock, ArrowLeft, 
  Heart, Copy, Star, CheckCircle2, Tent, Zap, Calendar, Circle, ShieldCheck
} from "lucide-react";
import { SimilarItems } from "@/components/SimilarItems";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ReviewSection } from "@/components/ReviewSection";
import { useSavedItems } from "@/hooks/useSavedItems";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { generateReferralLink } from "@/lib/referralUtils";
import { useBookingSubmit } from "@/hooks/useBookingSubmit";
import { extractIdFromSlug } from "@/lib/slugUtils";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  RED: "#FF0000",
  ORANGE: "#FF9800",
  SOFT_GRAY: "#F8F9FA"
};

const AdventurePlaceDetail = () => {
  const { slug } = useParams();
  const id = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { position, requestLocation } = useGeolocation();
  
  const [place, setPlace] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isOpenNow, setIsOpenNow] = useState(false);
  const [liveRating, setLiveRating] = useState({ avg: 0, count: 0 });
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const isSaved = savedItems.has(id || "");

  useEffect(() => {
    if (id) {
      fetchPlace();
      fetchLiveRating();
    }
    requestLocation();
    window.scrollTo(0, 0);
  }, [id, slug]);

  useEffect(() => {
    if (!place) return;
    const checkOpenStatus = () => {
      const now = new Date();
      const currentDay = now.toLocaleString('en-us', { weekday: 'long' });
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const parseTime = (timeStr: string) => {
        if (!timeStr) return 0;
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };

      const openTime = parseTime(place.opening_hours || "08:00 AM");
      const closeTime = parseTime(place.closing_hours || "06:00 PM");
      const days = Array.isArray(place.days_opened) ? place.days_opened : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      
      setIsOpenNow(days.includes(currentDay) && currentTime >= openTime && currentTime <= closeTime);
    };
    checkOpenStatus();
    const interval = setInterval(checkOpenStatus, 60000);
    return () => clearInterval(interval);
  }, [place]);

  const fetchPlace = async () => {
    if (!id) return;
    try {
      let { data, error } = await supabase
        .from("adventure_places")
        .select("id,name,location,place,country,image_url,gallery_images,images,description,amenities,facilities,activities,phone_numbers,email,opening_hours,closing_hours,days_opened,entry_fee,entry_fee_type,available_slots,latitude,longitude,created_by")
        .eq("id", id)
        .single();
      if (error) throw error;
      setPlace(data);
    } catch (error) {
      toast({ title: "Place not found", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const fetchLiveRating = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("reviews")
      .select("rating")
      .eq("item_id", id)
      .eq("item_type", "adventure_place");

    if (data && data.length > 0) {
      const avg = data.reduce((acc, curr) => acc + curr.rating, 0) / data.length;
      setLiveRating({ avg: parseFloat(avg.toFixed(1)), count: data.length });
    }
  };

  const openInMaps = () => {
    const query = encodeURIComponent(`${place?.name}, ${place?.location}`);
    window.open(place?.map_link || `https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const handleCopyLink = async () => {
    if (!id) return;
    const refLink = await generateReferralLink(id, "adventure_place", id);
    await navigator.clipboard.writeText(refLink);
    toast({ title: "Link Copied!" });
  };

  const { submitBooking } = useBookingSubmit();

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!place) return;
    setIsProcessing(true);
    try {
      await submitBooking({
        itemId: place.id, itemName: place.name, bookingType: 'adventure_place', totalAmount: 0,
        slotsBooked: data.num_adults + data.num_children, visitDate: data.visit_date,
        guestName: data.guest_name, guestEmail: data.guest_email, guestPhone: data.guest_phone,
        hostId: place.created_by, bookingDetails: { ...data, place_name: place.name }
      });
      setIsCompleted(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 animate-pulse" />;
  if (!place) return null;

  const allImages = [place.image_url, ...(place.gallery_images || []), ...(place.images || [])].filter(Boolean);
  const entryPrice = place.entry_fee || 0;

  // Components for sections to maintain clean code
  const DescriptionSection = () => (
    <section className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100 order-1">
      <h2 className="text-xl font-black uppercase tracking-tight mb-4 text-[#008080]">Description</h2>
      <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-line">{place.description}</p>
    </section>
  );

  const PriceCard = () => (
    <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100">
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entrance Fee</p>
          <span className="text-4xl font-black text-red-600">{entryPrice === 0 ? "FREE" : `KSh ${entryPrice}`}</span>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end text-amber-500 font-black text-lg"><Star className="h-4 w-4 fill-current" />{liveRating.avg}</div>
          <p className="text-[8px] font-black text-slate-400 uppercase">{liveRating.count} reviews</p>
        </div>
      </div>

      <div className="space-y-3 mb-6 bg-slate-50 p-5 rounded-2xl border border-dashed border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400"><Clock className="h-4 w-4 text-[#008080]" /><span className="text-[10px] font-black uppercase tracking-tight">hours</span></div>
          <span className={`text-[10px] font-black uppercase ${isOpenNow ? "text-emerald-600" : "text-red-500"}`}>{place.opening_hours || "08:00 AM"} - {place.closing_hours || "06:00 PM"}</span>
        </div>
        <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-400"><Calendar className="h-4 w-4 text-[#008080]" /><span className="text-[10px] font-black uppercase tracking-tight">working days</span></div>
          <p className="text-[9px] font-normal leading-tight text-slate-500 lowercase italic">
            {Array.isArray(place.days_opened) ? place.days_opened.join(", ") : "mon to sun"}
          </p>
        </div>
      </div>

      <Button onClick={() => setBookingOpen(true)} className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl border-none mb-6 transition-all active:scale-95" style={{ background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)` }}>
        Book Adventure
      </Button>

      <div className="grid grid-cols-3 gap-3 mb-2">
        <UtilityButton icon={<MapPin className="h-5 w-5" />} label="Map" onClick={openInMaps} />
        <UtilityButton icon={<Copy className="h-5 w-5" />} label="Copy" onClick={handleCopyLink} />
        <UtilityButton icon={<Share2 className="h-5 w-5" />} label="Share" onClick={() => { if(navigator.share) navigator.share({title: place.name, url: window.location.href}) }} />
      </div>
    </div>
  );

  const AmenitiesSection = () => place.amenities && (
    <section className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100 order-3">
      <div className="flex items-center gap-3 mb-6"><ShieldCheck className="h-5 w-5 text-red-600" /><h2 className="text-xl font-black uppercase tracking-tight text-red-600">Amenities</h2></div>
      <div className="flex flex-wrap gap-2">
        {(Array.isArray(place.amenities) ? place.amenities : place.amenities.split(',')).map((item: string, i: number) => (
          <div key={i} className="flex items-center gap-2 bg-red-50/50 px-4 py-2.5 rounded-2xl border border-red-100">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[11px] font-black text-red-700 uppercase">{item.trim()}</span>
          </div>
        ))}
      </div>
    </section>
  );

  const FacilitiesSection = () => place.facilities?.length > 0 && (
    <section className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100 order-4">
      <div className="flex items-center gap-3 mb-6"><Tent className="h-5 w-5 text-[#008080]" /><h2 className="text-xl font-black uppercase tracking-tight text-[#008080]">Facilities</h2></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {place.facilities.map((f: any, i: number) => (
          <div key={i} className="p-5 rounded-[22px] bg-slate-50 border border-slate-100 flex justify-between items-center"><span className="text-sm font-black uppercase text-slate-700">{f.name}</span><Badge className="bg-white text-[#008080] text-[10px] font-black">KSH {f.price}</Badge></div>
        ))}
      </div>
    </section>
  );

  const ActivitiesSection = () => place.activities?.length > 0 && (
    <section className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100 order-5">
      <div className="flex items-center gap-3 mb-6"><Zap className="h-5 w-5 text-[#FF9800]" /><h2 className="text-xl font-black uppercase tracking-tight text-[#FF9800]">Activities</h2></div>
      <div className="flex flex-wrap gap-3">
        {place.activities.map((act: any, i: number) => (
          <div key={i} className="px-5 py-3 rounded-2xl bg-orange-50/50 border border-orange-100 flex items-center gap-3">
            <span className="text-[11px] font-black text-slate-700 uppercase">{act.name}</span>
            <span className="text-[10px] font-bold text-[#FF9800]">KSh {act.price}</span>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      <div className="relative w-full h-[55vh] md:h-[70vh] bg-slate-900 overflow-hidden">
        <div className="absolute top-4 left-4 right-4 z-50 flex justify-between">
          <Button onClick={() => navigate(-1)} className="rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0"><ArrowLeft className="h-5 w-5" /></Button>
          <Button onClick={() => id && handleSaveItem(id, "adventure_place")} className={`rounded-full backdrop-blur-md border-none w-10 h-10 p-0 shadow-lg ${isSaved ? "bg-red-500" : "bg-black/30"}`}><Heart className={`h-5 w-5 text-white ${isSaved ? "fill-white" : ""}`} /></Button>
        </div>

        <Carousel plugins={[Autoplay({ delay: 4000 })]} className="w-full h-full">
          <CarouselContent className="h-full ml-0">
            {allImages.map((img, idx) => (
              <CarouselItem key={idx} className="h-full pl-0 basis-full">
                <div className="relative h-full w-full">
                  <img src={img} alt={place.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent z-10" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="absolute bottom-12 left-0 z-40 w-full p-6 md:p-12 pointer-events-none">
          <div className="space-y-4 pointer-events-auto max-w-4xl">
            <div className="flex flex-wrap gap-2">
                <Badge className="bg-amber-400 text-black border-none px-3 py-1 text-[10px] font-black uppercase rounded-full flex items-center gap-1 shadow-lg">
                  <Star className="h-3 w-3 fill-current" />
                  {liveRating.avg > 0 ? liveRating.avg : "New"}
                </Badge>
                <Badge className={`${isOpenNow ? "bg-emerald-500" : "bg-red-500"} text-white border-none px-3 py-1 text-[10px] font-black uppercase rounded-full flex items-center gap-1.5`}><Circle className={`h-2 w-2 fill-current ${isOpenNow ? "animate-pulse" : ""}`} />{isOpenNow ? "open now" : "closed"}</Badge>
            </div>
            <h1 className="text-4xl md:text-7xl font-black uppercase tracking-tighter text-white leading-[0.9]">{place.name}</h1>
            <div className="flex items-center gap-2 mt-3" onClick={() => window.open(place?.map_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place?.name}, ${place?.location}`)}`, "_blank")}>
              <MapPin className="h-4 w-4 text-white" />
              <span className="text-sm font-bold text-white uppercase tracking-wider px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm cursor-pointer hover:bg-black/60 transition-colors">
                {[place.place, place.location, place.country].filter(Boolean).join(', ')}
              </span>
              {position && place.latitude && place.longitude && (
                <span className="text-xs font-bold text-white px-2 py-1 rounded-full bg-[#FF7F50]/80 backdrop-blur-sm">
                  {calculateDistance(position.latitude, position.longitude, place.latitude, place.longitude).toFixed(2)} km away
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="container px-4 max-w-6xl mx-auto -mt-10 relative z-50">
        {/* Main Grid: Description and Sidebar */}
        <div className="flex flex-col lg:grid lg:grid-cols-[1.7fr,1fr] gap-6">
          
          <div className="flex flex-col gap-6">
            <DescriptionSection />
            
            {/* Mobile Only: Price Card below description */}
            <div className="block lg:hidden order-2"><PriceCard /></div>

            {/* In Mobile: Amenities is order 3. In Desktop: it follows Description */}
            <AmenitiesSection />
            <FacilitiesSection />
            <ActivitiesSection />

            {/* Mobile Only: Review Section and Similar items in specific order */}
            <div className="block lg:hidden space-y-6 order-6">
              <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
                <ReviewSection itemId={place.id} itemType="adventure_place" />
              </div>
              <div className="mt-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 text-slate-800">Explore Similar Adventures</h2>
                <SimilarItems currentItemId={place.id} itemType="adventure" country={place.country} />
              </div>
            </div>
          </div>

          {/* Desktop Only Sidebar */}
          <div className="hidden lg:block lg:sticky lg:top-24 h-fit">
            <PriceCard />
          </div>
        </div>

        {/* Desktop Only: Sections below the main grid area to maintain original column widths */}
        <div className="hidden lg:block">
           <div className="mt-12 bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
             <ReviewSection itemId={place.id} itemType="adventure_place" />
           </div>
           <div className="mt-16">
             <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 text-slate-800">Explore Similar Adventures</h2>
             <SimilarItems currentItemId={place.id} itemType="adventure" country={place.country} />
           </div>
        </div>
      </main>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[95vh] p-0 overflow-hidden rounded-[32px] border-none shadow-2xl bg-white">
          <MultiStepBooking 
            onSubmit={handleBookingSubmit} facilities={place.facilities || []} activities={place.activities || []} 
            priceAdult={place.entry_fee || 0} priceChild={place.entry_fee || 0} 
            isProcessing={isProcessing} isCompleted={isCompleted} itemName={place.name}
            itemId={place.id} bookingType="adventure_place" hostId={place.created_by || ""}
            onPaymentSuccess={() => setIsCompleted(true)} onCancel={() => setBookingOpen(false)}
            primaryColor={COLORS.TEAL} accentColor={COLORS.CORAL}
          />
        </DialogContent>
      </Dialog>
      <MobileBottomBar />
    </div>
  );
};

const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <Button variant="ghost" onClick={onClick} className="flex-col h-auto py-3 bg-[#F8F9FA] text-slate-500 rounded-2xl border border-slate-100 flex-1 hover:bg-slate-100 transition-colors">
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
  </Button>
);

export default AdventurePlaceDetail;