import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Clock, ArrowLeft, 
  Heart, Star, Circle, Calendar, Loader2, Share2, Copy, Navigation, AlertCircle, Phone, Mail
} from "lucide-react";
import { SimilarItems } from "@/components/SimilarItems";
import { useToast } from "@/hooks/use-toast";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ReviewSection } from "@/components/ReviewSection";
import { FacilitiesGrid, ActivitiesGrid } from "@/components/detail/FacilityActivityCards";
import { useSavedItems } from "@/hooks/useSavedItems";
import { extractIdFromSlug } from "@/lib/slugUtils";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { trackReferralClick, generateReferralLink } from "@/lib/referralUtils";
import { Header } from "@/components/Header";
import { ImageGalleryModal } from "@/components/detail/ImageGalleryModal";
import { QuickNavigationBar } from "@/components/detail/QuickNavigationBar";
import { AmenitiesSection } from "@/components/detail/AmenitiesSection";
import { GeneralFacilitiesDisplay } from "@/components/detail/GeneralFacilitiesDisplay";
import { DetailMapSection } from "@/components/detail/DetailMapSection";
import { DetailPageSkeleton } from "@/components/detail/DetailPageSkeleton";

const AdventurePlaceDetail = () => {
  const { slug } = useParams();
  const id = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();
  const goBack = useSafeBack();
  const { toast } = useToast();
  const { position, requestLocation } = useGeolocation();
  
  const [place, setPlace] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpenNow, setIsOpenNow] = useState(false);
  const [liveRating, setLiveRating] = useState({ avg: 0, count: 0 });

  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const isSaved = savedItems.has(id || "");

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
      Promise.all([fetchPlace(), fetchLiveRating()]);
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
      
      // Check if open 24 hours
      if (place.opening_hours === "00:00" && place.closing_hours === "23:59") {
        const days = Array.isArray(place.days_opened) 
          ? place.days_opened.map((d: string) => d.toLowerCase()) 
          : ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        setIsOpenNow(days.includes(currentDay));
        return;
      }

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

  if (loading) return <DetailPageSkeleton />;

  if (!place) return null;

  // Collect all images: gallery + facility images + activity images
  const facilityImages = (Array.isArray(place.facilities) ? place.facilities : [])
    .flatMap((f: any) => (Array.isArray(f.images) ? f.images : []));
  const activityImages = (Array.isArray(place.activities) ? place.activities : [])
    .flatMap((a: any) => (Array.isArray(a.images) ? a.images : []));
  const allImages = [place.image_url, ...(place.gallery_images || []), ...facilityImages, ...activityImages].filter(Boolean);

  const is24Hours = place.opening_hours === "00:00" && place.closing_hours === "23:59";

  const OperatingHoursInfo = () => (
    <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="h-4 w-4 text-teal-600" />
          <span className="text-[10px] font-black uppercase tracking-tight">Working Hours</span>
        </div>
        <span className={`text-[10px] font-black uppercase ${isOpenNow ? "text-emerald-600" : "text-red-500"}`}>
          {is24Hours ? "Open 24 Hours" : `${place.opening_hours || "08:00 AM"} - ${place.closing_hours || "06:00 PM"}`}
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
      {/* Header - All Screens */}
      <Header showSearchIcon={false} />

      {/* HERO / IMAGE GALLERY */}
      <div className="max-w-6xl mx-auto md:px-4 md:pt-3">
        {/* Mobile Carousel View */}
        <div className="relative w-full h-[45vh] bg-slate-900 overflow-hidden md:rounded-3xl md:hidden">
          {/* Action Buttons - Overlaid on Gallery */}
          <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-center">
            <Button
              onClick={goBack}
              className="rounded-full w-10 h-10 p-0 border-none bg-white/90 backdrop-blur-sm text-slate-900 hover:bg-white shadow-lg transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <Button
              onClick={() => id && handleSaveItem(id, "adventure_place")}
              className={`rounded-full w-10 h-10 p-0 border-none shadow-lg backdrop-blur-sm transition-all ${
                isSaved ? "bg-red-500 hover:bg-red-600" : "bg-white/90 text-slate-900 hover:bg-white"
              }`}
            >
              <Heart className={`h-5 w-5 ${isSaved ? "fill-white text-white" : "text-slate-900"}`} />
            </Button>
          </div>
          <Carousel plugins={[Autoplay({ delay: 3500 })]} className="w-full h-full">
            <CarouselContent className="h-full ml-0">
              {allImages.length > 0 ? allImages.map((img, idx) => (
                <CarouselItem key={idx} className="h-full pl-0 basis-full">
                  <img src={img} alt={`${place.name} - ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent z-10" />
                </CarouselItem>
              )) : (
                <div className="h-full w-full bg-slate-200 flex items-center justify-center text-slate-400 font-black uppercase text-xs">No Image</div>
              )}
            </CarouselContent>
          </Carousel>
          {/* Mobile See All Gallery Button */}
          {allImages.length > 1 && (
            <ImageGalleryModal images={allImages} name={place.name} />
          )}
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

        {/* Desktop Grid View */}
        <div className="hidden md:block relative">
          {/* Action Buttons - Overlaid on Gallery */}
          <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-center">
            <Button
              onClick={goBack}
              className="rounded-full w-12 h-12 p-0 border-none bg-white/90 backdrop-blur-sm text-slate-900 hover:bg-white shadow-lg transition-all"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>

            <Button
              onClick={() => id && handleSaveItem(id, "adventure_place")}
              className={`rounded-full w-12 h-12 p-0 border-none shadow-lg backdrop-blur-sm transition-all ${
                isSaved ? "bg-red-500 hover:bg-red-600" : "bg-white/90 text-slate-900 hover:bg-white"
              }`}
            >
              <Heart className={`h-6 w-6 ${isSaved ? "fill-white text-white" : "text-slate-900"}`} />
            </Button>
          </div>

          {/* Image Grid Layout */}
          <div className="grid grid-cols-4 gap-2 h-[500px]">
            {allImages.length > 0 ? (
              <>
                {/* Main Large Image - Takes 2 columns and full height */}
                <div className="col-span-2 row-span-2 rounded-3xl overflow-hidden relative group">
                  <img 
                    src={allImages[0]} 
                    alt={place.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  
                  {/* Place Info Overlay */}
                  <div className="absolute bottom-6 left-6 right-6 z-20">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-amber-400 text-black border-none px-3 py-1 text-[10px] font-black uppercase rounded-full flex items-center gap-1.5 shadow-lg">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {liveRating.avg > 0 ? liveRating.avg : ""}
                        </Badge>
                        <Badge className={`${isOpenNow ? "bg-emerald-500" : "bg-red-500"} text-white border-none px-3 py-1 text-[10px] font-black uppercase rounded-full flex items-center gap-1.5`}>
                          <Circle className={`h-2.5 w-2.5 fill-current ${isOpenNow ? "animate-pulse" : ""}`} />
                          {isOpenNow ? "open now" : ""}
                        </Badge>
                      </div>
                      <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{place.name}</h1>
                      <div className="flex items-center gap-2 text-white">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm font-bold uppercase">
                          {[place.place, place.location, place.country].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Right Image */}
                {allImages[1] && (
                  <div className="col-span-2 rounded-3xl overflow-hidden relative group">
                    <img 
                      src={allImages[1]} 
                      alt={`${place.name} - Gallery 2`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                )}

                {/* Bottom Right - 3 Small Images */}
                <div className="col-span-2 grid grid-cols-3 gap-2">
                  {allImages.slice(2, 5).map((img, idx) => (
                    <div key={idx} className="rounded-2xl overflow-hidden relative group">
                      <img 
                        src={img} 
                        alt={`${place.name} - Gallery ${idx + 3}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  ))}
                </div>

                {/* See All Button */}
                <ImageGalleryModal images={allImages} name={place.name} />
              </>
            ) : (
              <div className="col-span-4 rounded-3xl bg-slate-200 flex items-center justify-center">
                <p className="text-slate-400 font-black uppercase text-sm">No Images Available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Navigation - Mobile Only */}
      <div className="md:hidden container px-4 mt-4 max-w-6xl mx-auto">
        <QuickNavigationBar 
          hasFacilities={place.facilities?.length > 0} 
          hasActivities={place.activities?.length > 0}
          hasContact={place.phone_numbers?.length > 0 || !!place.email}
        />
      </div>

      {/* 3. MAIN BODY */}
      <main className="container px-4 mt-6 relative z-30 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr,1fr] gap-4">
          <div className="space-y-4">
            {/* Description */}
            <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-[11px] font-black uppercase tracking-widest mb-3 text-slate-400">About This Property</h2>
              {place.description ? (
                <p className="text-slate-500 text-sm leading-relaxed">{place.description}</p>
              ) : (
                <div className="flex items-center gap-2 text-slate-300 italic py-4"><AlertCircle className="h-4 w-4" /> Description coming soon</div>
              )}
            </section>

            {/* Operating Hours - Mobile Only (below description) */}
            <div className="md:hidden">
              <OperatingHoursInfo />
            </div>

            {/* Amenities - Using new component */}
            <AmenitiesSection amenities={place.amenities || []} />

            {/* General Facilities with Icons */}
            <GeneralFacilitiesDisplay facilityIds={
              Array.isArray(place.amenities) 
                ? place.amenities.map((a: any) => typeof a === 'string' ? a : a.name || '') 
                : []
            } />

            {/* Facilities with Images */}
            {place.facilities?.length > 0 && (
              <div id="facilities-section">
                <FacilitiesGrid 
                  facilities={place.facilities} 
                  itemId={place.id} 
                  itemType="adventure_place"
                  accentColor="#008080"
                />
              </div>
            )}

            {/* Activities with Images */}
            {place.activities?.length > 0 && (
              <div id="activities-section">
                <ActivitiesGrid 
                  activities={place.activities} 
                  itemId={place.id} 
                  itemType="adventure_place"
                  accentColor="#FF7F50"
                />
              </div>
            )}

            {/* Mobile Booking Card - Below Activities */}
            <div className="bg-white rounded-[32px] p-6 shadow-xl border border-slate-100 lg:hidden">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Starting from</p>
                  {place.entry_fee && place.entry_fee > 0 ? (
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-red-600">KSh {Number(place.entry_fee).toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">/ adult</span>
                      </div>
                      {place.child_entry_fee !== undefined && (
                        <div className="text-sm font-bold text-slate-500">
                          Child: KSh {Number(place.child_entry_fee || 0).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-3xl font-black text-emerald-600">Free Entry</span>
                  )}
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-1 text-amber-500 font-black text-lg">
                        <Star className="h-4 w-4 fill-current" />
                        <span>{liveRating.avg || "0"}</span>
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">{liveRating.count} reviews</p>
                </div>
              </div>
              {/* Operating hours removed from mobile price card - now shown below description */}
              <Button onClick={() => navigate(`/booking/adventure_place/${place.id}`)} className="w-full py-7 rounded-2xl text-md font-black uppercase tracking-widest bg-gradient-to-r from-[#FF7F50] to-[#FF4E50] border-none shadow-lg transition-all active:scale-95">Book Now</Button>
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
                     toast({ title: "Copying link..." });
                     const refLink = await generateReferralLink(id!, "adventure_place", id!);
                     await navigator.clipboard.writeText(refLink);
                     toast({ title: "Link Copied!" });
                   }}
                />
                <UtilityButton
                   icon={<Share2 className="h-5 w-5" />}
                   label="Share"
                   onClick={async () => {
                     toast({ title: "Preparing share..." });
                     const refLink = await generateReferralLink(id!, "adventure_place", id!);
                     if (navigator.share) {
                       try { await navigator.share({ title: place.name, url: refLink }); } catch (e) {}
                     } else {
                       await navigator.clipboard.writeText(refLink);
                       toast({ title: "Link Copied!" });
                     }
                   }}
                />
              </div>
            </div>

            {/* Contact Section - Mobile (for quick nav link) */}
            <div id="contact-section" className="lg:hidden">
              {(place.phone_numbers?.length > 0 || place.email) && (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-3">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Contact</h3>
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

          {/* Desktop Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-24 bg-white rounded-[40px] p-8 shadow-2xl border border-slate-100 space-y-6">
                <div className="text-center">
                  <p className="text-xs font-black uppercase text-slate-400 mb-1">Starting from/Entrtace Fee</p>
                  {place.entry_fee && place.entry_fee > 0 ? (
                    <div className="space-y-1">
                      <h3 className="text-4xl font-black text-red-600">KSh {Number(place.entry_fee).toLocaleString()}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">per adult</p>
                      {place.child_entry_fee !== undefined && (
                        <p className="text-sm font-bold text-slate-500">
                          Child: KSh {Number(place.child_entry_fee || 0).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <h3 className="text-4xl font-black text-emerald-600 mb-2">Free Entry</h3>
                  )}
                  <div className="flex items-center justify-center gap-1.5 text-amber-500 font-black mt-2">
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
                       toast({ title: "Copying link..." });
                       const refLink = await generateReferralLink(id!, "adventure_place", id!);
                       await navigator.clipboard.writeText(refLink);
                       toast({ title: "Link Copied!" });
                     }}
                  />
                  <UtilityButton
                     icon={<Share2 className="h-5 w-5" />}
                     label="Share"
                     onClick={async () => {
                       toast({ title: "Preparing share..." });
                       const refLink = await generateReferralLink(id!, "adventure_place", id!);
                       if (navigator.share) {
                         try { await navigator.share({ title: place.name, url: refLink }); } catch (e) {}
                       } else {
                         await navigator.clipboard.writeText(refLink);
                         toast({ title: "Link Copied!" });
                       }
                     }}
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

        {/* Map Section */}
        <DetailMapSection
          currentItem={{
            id: place.id,
            name: place.name,
            latitude: place.latitude,
            longitude: place.longitude,
            location: place.location,
            country: place.country,
            image_url: place.image_url,
            entry_fee: place.entry_fee,
          }}
          itemType="adventure"
        />

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