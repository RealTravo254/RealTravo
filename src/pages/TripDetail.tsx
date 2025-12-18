import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Share2, Mail, Clock, ArrowLeft, Heart, Copy, Star, Zap, Calendar } from "lucide-react";
import { SimilarItems } from "@/components/SimilarItems";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ReviewSection } from "@/components/ReviewSection";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { generateReferralLink, trackReferralClick } from "@/lib/referralUtils";
import { useBookingSubmit } from "@/hooks/useBookingSubmit";
import { extractIdFromSlug } from "@/lib/slugUtils";

// ADVENURE-STYLE DESIGN TOKENS
const COLORS = {
  TEAL: "#008080",
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
      const { data, error } = await supabase.from("trips").select("*").eq("id", id).single();
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
      const totalAmount = (data.num_adults * trip.price) + (data.num_children * trip.price_child);
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

  if (loading) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;
  if (!trip) return null;

  const allImages = [trip.image_url, ...(trip.gallery_images || []), ...(trip.images || [])].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* HERO SECTION WITH ADVENTURE OVERLAYS */}
      <div className="relative w-full overflow-hidden h-[50vh] md:h-[60vh]">
        <div className="absolute top-4 left-4 right-4 z-50 flex justify-between">
          <Button onClick={() => navigate(-1)} className="rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0 hover:bg-black/50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button onClick={handleSave} className={`rounded-full backdrop-blur-md border-none w-10 h-10 p-0 shadow-lg transition-colors ${isSaved ? "bg-red-500" : "bg-black/30 hover:bg-black/50"}`}>
            <Heart className={`h-5 w-5 text-white ${isSaved ? "fill-white" : ""}`} />
          </Button>
        </div>

        <Carousel plugins={[Autoplay({ delay: 4000 })]} className="w-full h-full">
          <CarouselContent className="h-full">
            {allImages.map((img, idx) => (
              <CarouselItem key={idx} className="h-full">
                <div className="relative h-full w-full">
                  <img src={img} alt={trip.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* FLOATING ADVENTURE INFO - RADIAL GRADIENT STYLE */}
        <div className="absolute bottom-10 left-0 z-40 w-full md:w-3/4 lg:w-1/2 p-8 pointer-events-none">
          <div 
            className="absolute inset-0 z-0 opacity-80"
            style={{
              background: `radial-gradient(circle at 20% 50%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0) 85%)`,
              filter: 'blur(15px)',
              marginLeft: '-20px'
            }}
          />
          
          <div className="relative z-10 space-y-4 pointer-events-auto">
            <Button className="bg-[#008080] hover:bg-[#008080] border-none px-4 py-1.5 h-auto uppercase font-black tracking-[0.15em] text-[10px] rounded-full shadow-lg text-white">
              Scheduled Trip
            </Button>
            
            <div>
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl mb-3">
                {trip.name}
              </h1>
              
              <div className="flex flex-wrap items-center gap-3 cursor-pointer group w-fit" onClick={openInMaps}>
                <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl group-hover:bg-[#008080] transition-all duration-300">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#008080] uppercase tracking-widest">Destination</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white uppercase tracking-wider group-hover:text-[#008080] transition-colors">
                      {trip.location}, {trip.country}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="container px-4 max-w-6xl mx-auto -mt-10 relative z-50">
        <div className="grid lg:grid-cols-[1.7fr,1fr] gap-6">
          
          <div className="space-y-6">
            {/* Description Card */}
            <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <h2 className="text-xl font-black uppercase tracking-tight mb-4" style={{ color: COLORS.TEAL }}>Overview</h2>
              <p className="text-slate-500 text-sm leading-relaxed">{trip.description}</p>
            </div>

            {/* ACTIVITIES SECTION - ADVENTURE STYLE */}
            {trip.activities?.length > 0 && (
              <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-orange-50">
                    <Zap className="h-5 w-5 text-[#FF9800]" />
                  </div>
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
            )}
          </div>

          {/* BOOKING SIDEBAR - ADVENTURE STYLE */}
          <div className="space-y-4">
            <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100 lg:sticky lg:top-24">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Price</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black" style={{ color: COLORS.RED }}>
                      KSh {trip.price}
                    </span>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">/ adult</span>
                  </div>
                </div>
                <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: COLORS.TEAL }} />
                  <span className="text-xs font-black text-slate-600 uppercase">
                    {trip.available_tickets} Left
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                  <span className="text-slate-400">Departure Date</span>
                  <span className="text-slate-700">{trip.is_custom_date ? "Flexible" : new Date(trip.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                   <span className="text-slate-400">Child Rate</span>
                   <span className="text-slate-700">KSh {trip.price_child || 'N/A'}</span>
                </div>
              </div>

              <Button 
                onClick={() => setBookingOpen(true)}
                disabled={trip.available_tickets <= 0}
                className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none mb-6"
                style={{ 
                    background: `linear-gradient(135deg, #00A3A3 0%, ${COLORS.TEAL} 100%)`,
                    boxShadow: `0 12px 24px -8px ${COLORS.TEAL}88`
                }}
              >
                {trip.available_tickets <= 0 ? "Sold Out" : "Secure My Spot"}
              </Button>

              <div className="grid grid-cols-3 gap-3 mb-8">
                <UtilityButton icon={<MapPin className="h-5 w-5" />} label="Map" onClick={openInMaps} />
                <UtilityButton icon={<Copy className="h-5 w-5" />} label="Copy" onClick={handleCopyLink} />
                <UtilityButton icon={<Share2 className="h-5 w-5" />} label="Share" onClick={handleShare} />
              </div>

              {/* Contact Footer */}
              <div className="space-y-4 pt-6 border-t border-slate-50">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Organizer Contact</h3>
                {trip.phone_number && (
                  <a href={`tel:${trip.phone_number}`} className="flex items-center gap-3 text-slate-600 hover:text-[#008080] transition-colors">
                    <Phone className="h-4 w-4 text-[#008080]" />
                    <span className="text-xs font-bold uppercase tracking-tight">{trip.phone_number}</span>
                  </a>
                )}
                {trip.email && (
                  <a href={`mailto:${trip.email}`} className="flex items-center gap-3 text-slate-600 hover:text-[#008080] transition-colors">
                    <Mail className="h-4 w-4 text-[#008080]" />
                    <span className="text-xs font-bold uppercase tracking-tight truncate">{trip.email}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Guest Ratings Section */}
        <div className="mt-12 bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Trip Reviews</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Feedback from travelers</p>
              </div>
              <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center gap-2">
                <Star className="h-4 w-4 fill-[#FF7F50] text-[#FF7F50]" />
                <span className="text-lg font-black" style={{ color: COLORS.TEAL }}>4.9</span>
              </div>
            </div>
            <ReviewSection itemId={trip.id} itemType="trip" />
        </div>

        <div className="mt-16">
            <SimilarItems currentItemId={trip.id} itemType="trip" country={trip.country} />
        </div>
      </main>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-[40px] border-none shadow-2xl">
          <MultiStepBooking 
            onSubmit={handleBookingSubmit} 
            activities={trip.activities || []} 
            priceAdult={trip.price} 
            priceChild={trip.price_child} 
            isProcessing={isProcessing} 
            isCompleted={isCompleted} 
            itemName={trip.name}
            itemId={trip.id}
            bookingType="trip"
            hostId={trip.created_by || ""}
            onPaymentSuccess={() => setIsCompleted(true)}
          />
        </DialogContent>
      </Dialog>

      <MobileBottomBar />
    </div>
  );
};

const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <Button 
    variant="ghost" 
    onClick={onClick} 
    className="flex-col h-auto py-3 bg-[#F8F9FA] text-slate-500 rounded-2xl hover:bg-slate-100 transition-colors border border-slate-100 flex-1"
  >
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
  </Button>
);

export default TripDetail;