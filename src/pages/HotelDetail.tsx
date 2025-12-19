import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Phone, Share2, Mail, Clock, ArrowLeft, 
  Heart, Copy, Star, CheckCircle2, BedDouble, Zap, Calendar, Circle
} from "lucide-react";
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
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  RED: "#FF0000",
  ORANGE: "#FF9800",
  SOFT_GRAY: "#F8F9FA"
};

const HotelDetail = () => {
  const { slug } = useParams();
  const id = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { position, requestLocation } = useGeolocation();
  
  const [hotel, setHotel] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isOpenNow, setIsOpenNow] = useState(false);
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const isSaved = savedItems.has(id || "");

  const distance = position && hotel?.latitude && hotel?.longitude
    ? calculateDistance(position.latitude, position.longitude, hotel.latitude, hotel.longitude)
    : null;

  useEffect(() => {
    if (id) fetchHotel();
    requestLocation();
  }, [id]);

  // Real-time Opening Status Check
  useEffect(() => {
    if (!hotel) return;

    const checkOpenStatus = () => {
      const now = new Date();
      const currentDay = now.toLocaleString('en-us', { weekday: 'long' });
      const currentTime = now.getHours() * 60 + now.getMinutes();

      // Parse hours (e.g., "08:00 AM" to minutes)
      const parseTime = (timeStr: string) => {
        if (!timeStr) return 0;
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };

      const openTime = parseTime(hotel.opening_hours || "08:00 AM");
      const closeTime = parseTime(hotel.closing_hours || "06:00 PM");
      const days = Array.isArray(hotel.days_opened) ? hotel.days_opened : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

      const isDayOpen = days.includes(currentDay);
      const isTimeOpen = currentTime >= openTime && currentTime <= closeTime;

      setIsOpenNow(isDayOpen && isTimeOpen);
    };

    checkOpenStatus();
    const interval = setInterval(checkOpenStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [hotel]);

  const fetchHotel = async () => {
    if (!id) return;
    try {
      let { data, error } = await supabase.from("hotels").select("*").eq("id", id).single();
      if (error) throw error;
      setHotel(data);
    } catch (error) {
      toast({ title: "Hotel not found", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const getDisplayPrice = () => {
    if (!hotel) return { price: 0, label: "Starting Price" };
    const allItems = [...(hotel.facilities || []), ...(hotel.activities || [])];
    const entranceFee = allItems.find(item => item.name?.toLowerCase().includes("entrance fee"));
    if (entranceFee) return { price: entranceFee.price, label: "Entrance Fee" };
    const prices = allItems.map(i => i.price).filter(p => p != null);
    return { price: prices.length > 0 ? Math.min(...prices) : 0, label: "Starting Price" };
  };

  const handleSave = () => id && handleSaveItem(id, "hotel");
  const openInMaps = () => window.open(hotel?.map_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel?.name + " " + hotel?.location)}`, "_blank");

  const { submitBooking } = useBookingSubmit();

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!hotel) return;
    setIsProcessing(true);
    try {
      await submitBooking({
        itemId: hotel.id, itemName: hotel.name, bookingType: 'hotel', totalAmount: 0, 
        slotsBooked: data.num_adults + data.num_children, visitDate: data.visit_date,
        guestName: data.guest_name, guestEmail: data.guest_email, guestPhone: data.guest_phone,
        hostId: hotel.created_by, bookingDetails: { ...data, hotel_name: hotel.name }
      });
      setIsCompleted(true);
      setBookingOpen(false);
    } catch (error: any) {
      toast({ title: "Error", variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 animate-pulse" />;
  if (!hotel) return null;

  const allImages = [hotel.image_url, ...(hotel.gallery_images || [])].filter(Boolean);
  const { price: displayPrice, label: priceLabel } = getDisplayPrice();

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* Hero Image Section */}
      <div className="relative w-full overflow-hidden h-[50vh] md:h-[65vh]">
        <div className="absolute top-4 left-4 right-4 z-50 flex justify-between">
          <Button onClick={() => navigate(-1)} className="rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0 hover:bg-black/50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button onClick={handleSave} className={`rounded-full backdrop-blur-md border-none w-10 h-10 p-0 shadow-lg ${isSaved ? "bg-red-500" : "bg-black/30 hover:bg-black/50"}`}>
            <Heart className={`h-5 w-5 text-white ${isSaved ? "fill-white" : ""}`} />
          </Button>
        </div>

        <Carousel plugins={[Autoplay({ delay: 4000 })]} className="w-full h-full">
          <CarouselContent className="h-full">
            {allImages.map((img, idx) => (
              <CarouselItem key={idx} className="h-full">
                <div className="relative h-full w-full">
                  <img src={img} alt={hotel.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent z-10" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="absolute bottom-10 left-0 z-40 w-full p-8 pointer-events-none">
          <div className="relative z-10 space-y-3 pointer-events-auto">
            <div className="flex items-center gap-2">
               <Badge className={`${isOpenNow ? "bg-emerald-500" : "bg-red-500"} text-white border-none px-3 py-1 text-[9px] font-black uppercase rounded-full flex items-center gap-1.5`}>
                 <Circle className={`h-2 w-2 fill-current ${isOpenNow ? "animate-pulse" : ""}`} />
                 {isOpenNow ? "Open Now" : "Closed"}
               </Badge>
               {distance && (
                 <Badge className="bg-[#008080] text-white border-none px-3 py-1 text-[9px] font-black uppercase rounded-full">
                   {distance.toFixed(1)} KM AWAY
                 </Badge>
               )}
            </div>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white drop-shadow-2xl">{hotel.name}</h1>
            <div className="flex items-center gap-2 text-white/90" onClick={openInMaps}>
              <MapPin className="h-4 w-4 text-[#FF7F50]" />
              <span className="text-sm font-black uppercase tracking-widest">{hotel.location}</span>
            </div>
          </div>
        </div>
      </div>

      <main className="container px-4 max-w-6xl mx-auto -mt-10 relative z-50">
        <div className="flex flex-col lg:grid lg:grid-cols-[1.7fr,1fr] gap-6">
          
          <div className="order-1 lg:order-none bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
            <h2 className="text-xl font-black uppercase tracking-tight mb-4" style={{ color: COLORS.TEAL }}>Description</h2>
            <p className="text-slate-500 text-sm leading-relaxed">{hotel.description}</p>
          </div>

          {/* SIDEBAR CARD */}
          <div className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100 lg:sticky lg:top-24">
              <div className="mb-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{priceLabel}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black" style={{ color: COLORS.RED }}>KSh {displayPrice}</span>
                  <span className="text-slate-400 text-[10px] font-bold uppercase">/ entry</span>
                </div>
              </div>

              {/* REAL-TIME WORKING HOURS */}
              <div className="space-y-3 mb-6 bg-slate-50 p-5 rounded-2xl border border-dashed border-slate-200">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-tight">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="h-4 w-4 text-[#008080]" />
                    <span>Hours</span>
                  </div>
                  <span className={isOpenNow ? "text-emerald-600" : "text-red-500"}>
                    {hotel.opening_hours || "08:00 AM"} - {hotel.closing_hours || "06:00 PM"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-tight">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="h-4 w-4 text-[#008080]" />
                    <span>Days</span>
                  </div>
                  <span className="text-slate-700 text-right max-w-[120px]">
                    {Array.isArray(hotel.days_opened) ? hotel.days_opened.slice(0, 3).join(", ") + "..." : "Mon - Sun"}
                  </span>
                </div>
              </div>

              <Button 
                onClick={() => setBookingOpen(true)}
                className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl border-none mb-6 transition-all active:scale-95"
                style={{ background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)` }}
              >
                Reserve Now
              </Button>

              <div className="grid grid-cols-3 gap-3 mb-8">
                <UtilityButton icon={<MapPin className="h-5 w-5" />} label="Map" onClick={openInMaps} />
                <UtilityButton icon={<Copy className="h-5 w-5" />} label="Copy" onClick={() => {}} />
                <UtilityButton icon={<Share2 className="h-5 w-5" />} label="Share" onClick={() => {}} />
              </div>

              {/* CONTACT DETAILS */}
              <div className="space-y-4 pt-6 border-t border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Direct Contact</h3>
                {hotel.email && (
                  <a href={`mailto:${hotel.email}`} className="flex items-center gap-3 text-slate-600 hover:text-teal-600 transition-colors group">
                    <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-teal-50">
                      <Mail className="h-4 w-4 text-[#008080]" />
                    </div>
                    <span className="text-xs font-bold truncate">{hotel.email}</span>
                  </a>
                )}
                {hotel.phone_numbers?.map((p: string, i: number) => (
                  <a key={i} href={`tel:${p}`} className="flex items-center gap-3 text-slate-600 hover:text-teal-600 transition-colors group">
                    <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-teal-50">
                      <Phone className="h-4 w-4 text-[#008080]" />
                    </div>
                    <span className="text-xs font-bold">{p}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* FACILITIES */}
          <div className="order-3 lg:col-start-1">
            {hotel.facilities?.length > 0 && (
              <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <BedDouble className="h-5 w-5 text-[#008080]" />
                  <h2 className="text-xl font-black uppercase tracking-tight text-[#008080]">Facilities</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hotel.facilities.map((f: any, i: number) => (
                    <div key={i} className="p-5 rounded-[22px] bg-slate-50 border border-slate-100 flex justify-between items-center hover:bg-slate-100 transition-colors">
                      <span className="text-sm font-black uppercase text-slate-700">{f.name}</span>
                      <Badge className="bg-white text-[#008080] text-[10px] font-black shadow-sm">KSH {f.price}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <MobileBottomBar />
    </div>
  );
};

const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <Button variant="ghost" onClick={onClick} className="flex-col h-auto py-3 bg-[#F8F9FA] text-slate-500 rounded-2xl border border-slate-100 flex-1 hover:bg-slate-100">
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
  </Button>
);

export default HotelDetail;