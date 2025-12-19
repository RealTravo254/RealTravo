import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Phone, Share2, Mail, Clock, ArrowLeft, 
  Heart, Copy, Star, CheckCircle2, BedDouble, Zap, Calendar 
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
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const isSaved = savedItems.has(id || "");

  const distance = position && hotel?.latitude && hotel?.longitude
    ? calculateDistance(position.latitude, position.longitude, hotel.latitude, hotel.longitude)
    : null;

  useEffect(() => {
    if (id) fetchHotel();
    requestLocation();
  }, [id]);

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
    const entranceFee = allItems.find(item => 
      item.name?.toLowerCase().includes("entrance fee") || 
      item.name?.toLowerCase().includes("entry fee")
    );
    if (entranceFee) return { price: entranceFee.price, label: "Entrance Fee" };
    const prices = allItems.map(i => i.price).filter(p => p !== undefined && p !== null);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    return { price: minPrice, label: "Starting Price" };
  };

  const handleSave = () => id && handleSaveItem(id, "hotel");

  const openInMaps = () => {
    const query = encodeURIComponent(`${hotel?.name}, ${hotel?.location}`);
    window.open(hotel?.map_link || `https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

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
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 animate-pulse" />;
  if (!hotel) return null;

  const allImages = [hotel.image_url, ...(hotel.gallery_images || []), ...(hotel.images || [])].filter(Boolean);
  const { price: displayPrice, label: priceLabel } = getDisplayPrice();

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* 1. HERO SECTION - UPDATED FOR FULL COVERAGE */}
      <div className="relative w-full overflow-hidden h-[50vh] md:h-[65vh] bg-slate-900">
        <div className="absolute top-4 left-4 right-4 z-50 flex justify-between">
          <Button onClick={() => navigate(-1)} className="rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0 hover:bg-black/50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button onClick={handleSave} className={`rounded-full backdrop-blur-md border-none w-10 h-10 p-0 shadow-lg transition-colors ${isSaved ? "bg-red-500" : "bg-black/30 hover:bg-black/50"}`}>
            <Heart className={`h-5 w-5 text-white ${isSaved ? "fill-white" : ""}`} />
          </Button>
        </div>

        <Carousel plugins={[Autoplay({ delay: 4000 })]} className="w-full h-full">
          <CarouselContent className="h-full ml-0"> {/* ml-0 removes slide offset gap */}
            {allImages.map((img, idx) => (
              <CarouselItem key={idx} className="h-full pl-0 basis-full"> {/* pl-0 and basis-full ensures edge-to-edge */}
                <div className="relative h-full w-full">
                  <img 
                    src={img} 
                    alt={hotel.name} 
                    className="w-full h-full object-cover object-center" 
                  />
                  {/* Bottom Gradient for text contrast */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent z-10" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="absolute bottom-10 left-0 z-40 w-full p-8 pointer-events-none">
          <div className="relative z-10 space-y-3 pointer-events-auto">
            <div className="flex items-center gap-2">
               <Badge className="bg-[#FF7F50] text-white border-none px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-full">
                 Premium
               </Badge>
               {distance && (
                 <Badge className="bg-[#008080] text-white border-none px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-full">
                   {distance.toFixed(1)} KM AWAY
                 </Badge>
               )}
            </div>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white drop-shadow-2xl">
              {hotel.name}
            </h1>
            <div className="flex items-center gap-2 text-white/90 cursor-pointer w-fit" onClick={openInMaps}>
              <MapPin className="h-4 w-4 text-[#FF7F50]" />
              <span className="text-sm font-black uppercase tracking-widest">{hotel.location}</span>
            </div>
          </div>
        </div>
      </div>

      <main className="container px-4 max-w-6xl mx-auto -mt-10 relative z-50">
        <div className="flex flex-col lg:grid lg:grid-cols-[1.7fr,1fr] gap-6">
          
          {/* DESCRIPTION */}
          <div className="order-1 lg:order-none bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
            <h2 className="text-xl font-black uppercase tracking-tight mb-4" style={{ color: COLORS.TEAL }}>Description</h2>
            <p className="text-slate-500 text-sm leading-relaxed">{hotel.description}</p>
          </div>

          {/* PRICE & CONTACT CARD (SIDEBAR) */}
          <div className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100 lg:sticky lg:top-24">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{priceLabel}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black" style={{ color: COLORS.RED }}>KSh {displayPrice}</span>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">/ entry</span>
                  </div>
                </div>
                {distance && (
                  <div className="bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-100 text-center">
                    <span className="text-[10px] font-black text-[#008080] block uppercase">{distance.toFixed(1)} KM</span>
                    <span className="text-[8px] font-bold text-slate-400 block uppercase">Away</span>
                  </div>
                )}
              </div>

              <Button 
                onClick={() => setBookingOpen(true)}
                className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl border-none mb-6 hover:opacity-90 transition-opacity"
                style={{ background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)` }}
              >
                Reserve Now
              </Button>

              <div className="grid grid-cols-3 gap-3 mb-8">
                <UtilityButton icon={<MapPin className="h-5 w-5" />} label="Map" onClick={openInMaps} />
                <UtilityButton icon={<Copy className="h-5 w-5" />} label="Copy" onClick={() => {}} />
                <UtilityButton icon={<Share2 className="h-5 w-5" />} label="Share" onClick={() => {}} />
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Host Inquiries</h3>
                
                {hotel.email && (
                  <a href={`mailto:${hotel.email}`} className="flex items-center gap-3 text-slate-600 hover:text-[#008080] transition-colors group">
                    <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-teal-50 transition-colors">
                      <Mail className="h-4 w-4 text-[#008080]" />
                    </div>
                    <span className="text-xs font-bold truncate">{hotel.email}</span>
                  </a>
                )}

                {hotel.phone_numbers?.map((p: string, i: number) => (
                  <a key={i} href={`tel:${p}`} className="flex items-center gap-3 text-slate-600 hover:text-[#008080] transition-colors group">
                    <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-teal-50 transition-colors">
                      <Phone className="h-4 w-4 text-[#008080]" />
                    </div>
                    <span className="text-xs font-bold">{p}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* FACILITIES & ACTIVITIES */}
          <div className="order-3 lg:col-start-1 space-y-6">
            {hotel.facilities?.length > 0 && (
              <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <BedDouble className="h-5 w-5 text-[#008080]" />
                  <h2 className="text-xl font-black uppercase tracking-tight text-[#008080]">Facilities</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hotel.facilities.map((f: any, i: number) => (
                    <div key={i} className="p-5 rounded-[22px] bg-slate-50 border border-slate-100 flex justify-between items-center">
                      <span className="text-sm font-black uppercase text-slate-700">{f.name}</span>
                      <Badge className="bg-white text-[#008080] text-[10px] font-black shadow-sm">KSH {f.price}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hotel.activities?.length > 0 && (
              <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <Zap className="h-5 w-5 text-[#FF9800]" />
                  <h2 className="text-xl font-black uppercase tracking-tight text-[#FF9800]">Activities</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  {hotel.activities.map((act: any, i: number) => (
                    <div key={i} className="px-5 py-3 rounded-2xl bg-orange-50/50 border border-orange-100 flex items-center gap-3">
                      <span className="text-[11px] font-black text-slate-700 uppercase">{act.name}</span>
                      <span className="text-[10px] font-bold text-[#FF9800]">KSh {act.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12">
            <ReviewSection itemId={hotel.id} itemType="hotel" />
        </div>
      </main>

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

export default HotelDetail;