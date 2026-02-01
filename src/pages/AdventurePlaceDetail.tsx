import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Clock, ArrowLeft, 
  Heart, Star, Circle, ShieldCheck, Tent, Zap, Calendar, Loader2, Share2, Copy, Navigation, AlertCircle, Phone, Mail
} from "lucide-react";
import { SimilarItems } from "@/components/SimilarItems";
import { useToast } from "@/hooks/use-toast";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ReviewSection } from "@/components/ReviewSection";
import { useSavedItems } from "@/hooks/useSavedItems";
import { extractIdFromSlug } from "@/lib/slugUtils";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { trackReferralClick, generateReferralLink } from "@/lib/referralUtils";
import { Header } from "@/components/Header";
import { useIsMobile } from "@/hooks/use-mobile";

const AdventurePlaceDetail = () => {
  const { slug } = useParams();
  const id = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { position, requestLocation } = useGeolocation();
  
  const [place, setPlace] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpenNow, setIsOpenNow] = useState(false);
  const [liveRating, setLiveRating] = useState({ avg: 0, count: 0 });

  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const isSaved = savedItems.has(id || "");
  const isMobile = useIsMobile();

  const distance = position && place?.latitude && place?.longitude
    ? calculateDistance(position.latitude, position.longitude, place.latitude, place.longitude)
    : undefined;

  const getStartingPrice = () => {
    if (!place) return 0;
    const prices: number[] = [];
    if (place.entry_fee) prices.push(Number(place.entry_fee));
    
    const extractPrices = (arr: any[]) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((item) => {
        const p = typeof item === 'object' ? item.price : null;
        if (p) prices.push(Number(p));
      });
    };

    extractPrices(place.facilities);
    extractPrices(place.activities);
    return prices.length > 0 ? Math.min(...prices) : 0;
  };

  const startingPrice = getStartingPrice();

  useEffect(() => {
    if (id) {
      fetchPlace();
      fetchLiveRating();
    }
    const urlParams = new URLSearchParams(window.location.search);
    const refSlug = urlParams.get("ref");
    if (refSlug && id) trackReferralClick(refSlug, id, "adventure_place", "booking");
    requestLocation();
    window.scrollTo(0, 0);
  }, [id, slug]);

  useEffect(() => {
    if (!place) return;
    const checkOpenStatus = () => {
      const now = new Date();
      const currentDay = now.toLocaleString('en-us', { weekday: 'long' }).toLowerCase();
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
      const days = Array.isArray(place.days_opened) 
        ? place.days_opened.map((d: string) => d.toLowerCase()) 
        : ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      
      setIsOpenNow(days.includes(currentDay) && currentTime >= openTime && currentTime <= closeTime);
    };
    checkOpenStatus();
    const interval = setInterval(checkOpenStatus, 60000);
    return () => clearInterval(interval);
  }, [place]);

  const fetchPlace = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("adventure_places")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      setPlace(data);
    } catch (error) {
      toast({ title: "Place not found", variant: "destructive" });
      navigate('/');
    } finally { setLoading(false); }
  };

  const fetchLiveRating = async () => {
    if (!id) return;
    const { data } = await supabase.from("reviews").select("rating").eq("item_id", id).eq("item_type", "adventure_place");
    if (data && data.length > 0) {
      const avg = data.reduce((acc, curr) => acc + curr.rating, 0) / data.length;
      setLiveRating({ avg: parseFloat(avg.toFixed(1)), count: data.length });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600 mb-4" />
        <p className="text-sm font-black uppercase tracking-tighter animate-pulse">Loading Details...</p>
      </div>
    );
  }

  if (!place) return null;

  const allImages = [place.image_url, ...(place.gallery_images || [])].filter(Boolean);

  const OperatingHoursInfo = () => (
    <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="h-4 w-4 text-teal-600" />
          <span className="text-[10px] font-black uppercase tracking-tight">Working Hours</span>
        </div>
        <span className={`text-[10px] font-black uppercase ${isOpenNow ? "text-emerald-600" : "text-red-500"}`}>
          {place.opening_hours || "08:00 AM"} - {place.closing_hours || "06:00 PM"}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-2 text-slate-400">
          <Calendar className="h-4 w-4 text-teal-600" />
          <span className="text-[10px] font-black uppercase tracking-tight">Working Days</span>
        </div>
        <p className="text-[10px] font-normal leading-tight text-slate-500 lowercase italic">
          {Array.isArray(place.days_opened) ? place.days_opened.join(", ") : "monday, tuesday, wednesday, thursday, friday, saturday, sunday"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      {/* Header - Desktop Only */}
      {!isMobile && <Header showSearchIcon={false} />}

      {/* Action Bar - Below Header */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
        <Button
          onClick={() => navigate(-1)}
          className="rounded-full w-10 h-10 p-0 border-none bg-slate-100 text-slate-900 hover:bg-slate-200 transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <Button
          onClick={() => id && handleSaveItem(id, "adventure_place")}
          className={`rounded-full w-10 h-10 p-0 border-none shadow-lg transition-all ${
            isSaved ? "bg-red-500 hover:bg-red-600" : "bg-slate-100 text-slate-900 hover:bg-slate-200"
          }`}
        >
          <Heart className={`h-5 w-5 ${isSaved ? "fill-white text-white" : "text-slate-900"}`} />
        </Button>
      </div>

      {/* HERO / IMAGE GALLERY */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="relative w-full h-[45vh] md:h-[65vh] bg-slate-900 overflow-hidden rounded-3xl">
          <Carousel plugins={[Autoplay({ delay: 3500 })]} className="w-full h-full">
            <CarouselContent className="h-full ml-0">
              {allImages.length > 0 ? allImages.map((img, idx) => (
                <CarouselItem key={idx} className="h-full pl-0 basis-full">
                  <img src={img} alt={place.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent z-10" />
                </CarouselItem>
              )) : (
                <div className="h-full w-full bg-slate-200 flex items-center justify-center text-slate-400 font-black uppercase text-xs">No Image</div>
              )}
            </CarouselContent>
          </Carousel>

          <div className="absolute bottom-6 left-0 w-full px-4 z-20">
            <div className="bg-gradient-to-r from-black/70 via-black/50 to-transparent rounded-2xl p-4 max-w-xl">
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge className="bg-amber-400 text-black border-none px-2 py-0.5 text-[9px] font-black uppercase rounded-full flex items-center gap-1 shadow-lg">
                  <Star className="h-3 w-3 fill-current" />
                  {liveRating.avg > 0 ? liveRating.avg : "New"}
                </Badge>
                <Badge className={`${isOpenNow ? "bg-emerald-500" : "bg-red-500"} text-white border-none px-2 py-0.5 text-[9px] font-black uppercase rounded-full flex items-center gap-1`}>
                  <Circle className={`h-2 w-2 fill-current ${isOpenNow ? "animate-pulse" : ""}`} />
                  {isOpenNow ? "open" : "closed"}
                </Badge>
              </div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-2">{place.name}</h1>
              <div className="flex items-center gap-1 text-white">
                <MapPin className="h-3.5 w-3.5" />
                <span className="text-xs font-bold uppercase truncate">
                  {[place.place, place.location, place.country].filter(Boolean).join(', ')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN BODY */}
      <main className="container px-4 -mt-4 relative z-30 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr,1fr] gap-4">
          <div className="space-y-4">
            {/* Description */}
            <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-[11px] font-black uppercase tracking-widest mb-3 text-slate-400">Description</h2>
              {place.description ? (
                <p className="text-slate-500 text-sm leading-relaxed">{place.description}</p>
              ) : (
                <div className="flex items-center gap-2 text-slate-300 italic py-4"><AlertCircle className="h-4 w-4" /> Description coming soon</div>
              )}
            </section>

            {/* Mobile Booking Card */}
            <div className="bg-white rounded-[32px] p-6 shadow-xl border border-slate-100 lg:hidden">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Starting Price</p>
                  <span className="text-4xl font-black text-red-600">KSh {startingPrice.toLocaleString()}</span>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-1 text-amber-500 font-black text-lg">
                        <Star className="h-4 w-4 fill-current" />
                        <span>{liveRating.avg || "0"}</span>
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">{liveRating.count} reviews</p>
                </div>
              </div>
              <OperatingHoursInfo />
              <Button onClick={() => navigate(`/booking/adventure_place/${place.id}`)} className="w-full mt-6 py-7 rounded-2xl text-md font-black uppercase tracking-widest bg-gradient-to-r from-[#FF7F50] to-[#FF4E50] border-none shadow-lg transition-all active:scale-95">Book Now</Button>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <UtilityButton
                   icon={<Navigation className="h-5 w-5" />}
                   label="Map"
                   onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.location}`)}`, "_blank")}
                />
                <UtilityButton
                   icon={<Copy className="h-5 w-5" />}
                   label="Copy"
                   onClick={async () => {
                     const refLink = await generateReferralLink(id!, "adventure_place", id!);
                     await navigator.clipboard.writeText(refLink);
                     toast({ title: "Link Copied!" });
                   }}
                />
                <UtilityButton
                   icon={<Share2 className="h-5 w-5" />}
                   label="Share"
                   onClick={() => navigator.share && navigator.share({ title: place.name, url: window.location.href })}
                />
              </div>
            </div>

            {/* Amenities */}
            {place.amenities?.length > 0 && (
              <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="h-5 w-5 text-red-600" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-red-600">Amenities</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(Array.isArray(place.amenities) ? place.amenities : []).map((amenity: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-3 bg-red-50/50 rounded-xl border border-red-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span className="text-[10px] font-black uppercase text-red-700 truncate">{typeof amenity === 'string' ? amenity : amenity.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Facilities & Pricing */}
            {place.facilities?.length > 0 && (
              <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <Tent className="h-5 w-5 text-[#008080]" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-[#008080]">Facilities & Pricing</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Array.isArray(place.facilities) ? place.facilities : []).map((f: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-teal-50/50 border border-teal-100 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-[#008080]">{f.name || f}</span>
                      {f.price && <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-lg">KSh {f.price.toLocaleString()}</span>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Activities */}
            {place.activities?.length > 0 && (
              <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-5 w-5 text-orange-500" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-orange-500">Activities</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(place.activities) ? place.activities : []).map((act: any, i: number) => (
                    <Badge key={i} className="bg-orange-50 text-orange-600 border-orange-100 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2">
                      {act.name || act}
                      {act.price && <span className="text-orange-400">| KSh {act.price.toLocaleString()}</span>}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Desktop Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-24 bg-white rounded-[40px] p-8 shadow-2xl border border-slate-100 space-y-6">
                <div className="text-center">
                  <p className="text-xs font-black uppercase text-slate-400 mb-1">Starting from</p>
                  <h3 className="text-5xl font-black text-red-600 mb-2">KSh {startingPrice.toLocaleString()}</h3>
                  <div className="flex items-center justify-center gap-1.5 text-amber-500 font-black">
                    <Star className="h-4 w-4 fill-current" />
                    <span className="text-lg">{liveRating.avg || "0"}</span>
                  </div>
                </div>

                <OperatingHoursInfo />

                <Button onClick={() => navigate(`/booking/adventure_place/${place.id}`)} className="w-full py-7 rounded-3xl text-lg font-black uppercase tracking-widest bg-gradient-to-r from-[#FF7F50] to-[#FF4E50] border-none shadow-xl transition-all active:scale-95">Reserve Now</Button>

                <div className="grid grid-cols-3 gap-3">
                  <UtilityButton
                     icon={<Navigation className="h-5 w-5" />}
                     label="Map"
                     onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.location}`)}`, "_blank")}
                  />
                  <UtilityButton
                     icon={<Copy className="h-5 w-5" />}
                     label="Copy"
                     onClick={async () => {
                       const refLink = await generateReferralLink(id!, "adventure_place", id!);
                       await navigator.clipboard.writeText(refLink);
                       toast({ title: "Link Copied!" });
                     }}
                  />
                  <UtilityButton
                     icon={<Share2 className="h-5 w-5" />}
                     label="Share"
                     onClick={() => navigator.share && navigator.share({ title: place.name, url: window.location.href })}
                  />
                </div>

                {/* Contact Section */}
                {(place.phone_numbers?.length > 0 || place.email) && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</h3>
                    {place.phone_numbers?.map((phone: string, idx: number) => (
                      <a key={idx} href={`tel:${phone}`} className="flex items-center gap-3 text-slate-600 hover:text-[#008080] transition-colors">
                        <div className="p-2 rounded-lg bg-slate-50">
                          <Phone className="h-4 w-4 text-[#008080]" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-tight">{phone}</span>
                      </a>
                    ))}
                    {place.email && (
                      <a href={`mailto:${place.email}`} className="flex items-center gap-3 text-slate-600 hover:text-[#008080] transition-colors">
                        <div className="p-2 rounded-lg bg-slate-50">
                          <Mail className="h-4 w-4 text-[#008080]" />
                        </div>
                        <span className="text-xs font-bold tracking-tight">{place.email}</span>
                      </a>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Review Section */}
        <div className="mt-12 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <ReviewSection itemId={place.id} itemType="adventure_place" />
        </div>

        <SimilarItems currentItemId={place.id} itemType="adventure" country={place.country} />
      </main>
    </div>
  );
};

// Utility button matching the hotel style
const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <Button
    variant="ghost"
    onClick={onClick}
    className="flex-col h-auto py-4 bg-slate-50 text-slate-500 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors flex-1"
  >
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
  </Button>
);

export default AdventurePlaceDetail;