import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { useBookingNavigate } from "@/hooks/useBookingNavigate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Star, Circle, Share2, Copy, Navigation, AlertCircle, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ReviewSection } from "@/components/ReviewSection";
import { FacilitiesGrid, ActivitiesGrid } from "@/components/detail/FacilityActivityCards";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { trackReferralClick } from "@/lib/referralUtils";
import { getShareLink } from "@/lib/shareUtils";
import { extractIdFromSlug } from "@/lib/slugUtils";
import { DetailNavBar } from "@/components/detail/DetailNavBar";
import { ImageGalleryModal } from "@/components/detail/ImageGalleryModal";
import { QuickNavigationBar } from "@/components/detail/QuickNavigationBar";
import { GeneralFacilitiesDisplay } from "@/components/detail/GeneralFacilitiesDisplay";
import { DetailMapSection } from "@/components/detail/DetailMapSection";
import { TealLoader } from "@/components/ui/teal-loader";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Footer } from "@/components/Footer";

const AdventurePlaceDetail = () => {
  const { slug: rawSlug } = useParams();
  const id = rawSlug ? extractIdFromSlug(rawSlug) : null;
  const navigate = useNavigate();
  const goBack = useSafeBack();
  const navigateToBooking = useBookingNavigate();
  const { toast } = useToast();
  const { position, requestLocation } = useGeolocation();
  const { formatPrice } = useCurrency();

  const [place, setPlace] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpenNow, setIsOpenNow] = useState(false);
  const [liveRating, setLiveRating] = useState({ avg: 0, count: 0 });
  const [scrolled, setScrolled] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const isSaved = savedItems.has(id || "");

  const getStartingPrice = () => {
    if (!place) return 0;
    const prices: number[] = [];
    if (place.entry_fee) prices.push(Number(place.entry_fee));
    const extractPrices = (arr: any[]) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((item) => { const p = typeof item === "object" ? item.price : null; if (p) prices.push(Number(p)); });
    };
    extractPrices(place.facilities);
    extractPrices(place.activities);
    return prices.length > 0 ? Math.min(...prices) : 0;
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (rawSlug) Promise.all([fetchPlace(), fetchLiveRating()]);
    const urlParams = new URLSearchParams(window.location.search);
    const refSlug = urlParams.get("ref");
    if (refSlug && id) trackReferralClick(refSlug, id, "adventure_place", "booking");
    requestLocation();
  }, [rawSlug]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!place) return;
    const checkOpenStatus = () => {
      const now = new Date();
      const currentDay = now.toLocaleString("en-us", { weekday: "long" }).toLowerCase();
      if (place.opening_hours === "00:00" && place.closing_hours === "23:59") {
        const days = Array.isArray(place.days_opened) ? place.days_opened.map((d: string) => d.toLowerCase()) : ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
        setIsOpenNow(days.includes(currentDay)); return;
      }
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const parseTime = (timeStr: string) => {
        if (!timeStr) return 0;
        const [time, modifier] = timeStr.split(" ");
        let [hours, minutes] = time.split(":").map(Number);
        if (modifier === "PM" && hours < 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };
      const openTime = parseTime(place.opening_hours || "08:00 AM");
      const closeTime = parseTime(place.closing_hours || "06:00 PM");
      const days = Array.isArray(place.days_opened) ? place.days_opened.map((d: string) => d.toLowerCase()) : ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
      setIsOpenNow(days.includes(currentDay) && currentTime >= openTime && currentTime <= closeTime);
    };
    checkOpenStatus();
    const interval = setInterval(checkOpenStatus, 60000);
    return () => clearInterval(interval);
  }, [place]);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setActiveSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", onSelect);
    return () => { carouselApi.off("select", onSelect); };
  }, [carouselApi]);

  const fetchPlace = async () => {
    if (!rawSlug) return;
    try {
      let data: any = null;
      const candidates = [...new Set([id, rawSlug].filter(Boolean))] as string[];
      for (const candidate of candidates) {
        if (data) break;
        const { data: byId } = await supabase.from("adventure_places").select("*").eq("id", candidate).maybeSingle();
        if (byId) { data = byId; break; }
        const { data: bySlug } = await supabase.from("adventure_places").select("*").eq("slug", candidate).maybeSingle();
        if (bySlug) { data = bySlug; break; }
      }
      if (!data && rawSlug) {
        const { data: byPartial } = await supabase.from("adventure_places").select("*").filter("id", "neq", "").limit(100);
        if (byPartial) data = byPartial.find(item => rawSlug.endsWith(item.id) || rawSlug.includes(item.id)) || null;
      }
      if (!data) throw new Error("Not found");
      setPlace(data);
    } catch (error) {
      console.error("AdventurePlaceDetail fetch error:", error, { rawSlug, id });
      toast({ title: "Place not found", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const fetchLiveRating = async () => {
    if (!id && !rawSlug) return;
    const lookupId = id || rawSlug!;
    const { data } = await supabase.from("reviews").select("rating").eq("item_id", lookupId).eq("item_type", "adventure_place");
    if (data && data.length > 0) {
      const avg = data.reduce((acc, curr) => acc + curr.rating, 0) / data.length;
      setLiveRating({ avg: parseFloat(avg.toFixed(1)), count: data.length });
    }
  };

  if (loading) return <TealLoader />;
  if (!place) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <AlertCircle className="h-12 w-12 text-red-400" />
      <p className="text-lg font-black uppercase text-slate-500">Place not found</p>
      <Button onClick={() => navigate(-1)} className="rounded-full bg-teal-600 text-white border-none">Go Back</Button>
    </div>
  );

  const facilityImages = (Array.isArray(place.facilities) ? place.facilities : []).flatMap((f: any) => (Array.isArray(f.images) ? f.images : []));
  const activityImages = (Array.isArray(place.activities) ? place.activities : []).flatMap((a: any) => (Array.isArray(a.images) ? a.images : []));
  const allImagesRaw = [place.image_url, ...(place.gallery_images || []), ...facilityImages, ...activityImages].filter(Boolean);
  const allImages = allImagesRaw.slice(0, 5);
  const dotImages = allImages.slice(0, 5);
  const is24Hours = place.opening_hours === "00:00" && place.closing_hours === "23:59";
  const resolvedId = place.id;

  return (
    <div className="min-h-screen bg-background pb-24">
      <DetailNavBar scrolled={scrolled} itemName={place.name} isSaved={isSaved}
        onSave={() => handleSaveItem(resolvedId, "adventure_place")} onBack={goBack} />

      {/* ══ IMAGE GALLERY ══════════════════════════════════════════════════════ */}

      {/* Mobile — 45vh, clean, only See All + dots overlay */}
      <div className="relative w-full bg-slate-900 overflow-hidden md:hidden" style={{ height: "45vh", minHeight: "220px", maxHeight: "380px" }}>
        <Carousel setApi={setCarouselApi} plugins={[Autoplay({ delay: 3500 })]} className="w-full h-full">
          <CarouselContent className="h-full ml-0">
            {allImages.length > 0 ? allImages.map((img, idx) => (
              <CarouselItem key={idx} className="h-full pl-0 basis-full">
                <img src={img} alt={`${place.name} - ${idx + 1}`} className="w-full h-full object-cover" />
              </CarouselItem>
            )) : (
              <div className="h-full w-full bg-slate-200 flex items-center justify-center text-slate-400 font-black uppercase text-xs">No Image</div>
            )}
          </CarouselContent>
        </Carousel>
        {allImages.length > 1 && <ImageGalleryModal images={allImages} name={place.name} />}
        {allImages.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 z-30 flex justify-center gap-1.5 pointer-events-none">
            {dotImages.map((_, idx) => (
              <span key={idx} className="transition-all duration-300 block" style={{
                width: activeSlide === idx ? "20px" : "6px", height: "6px", borderRadius: "3px",
                background: activeSlide === idx ? "white" : "rgba(255,255,255,0.5)",
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop — constrained, rounded, no overlay */}
      <div className="hidden md:block max-w-6xl mx-auto px-4 pt-4">
        <div className="relative grid grid-cols-4 gap-1.5 h-[420px] rounded-2xl overflow-hidden">
          {allImages.length > 0 ? (
            <>
              <div className="col-span-2 row-span-2 overflow-hidden group">
                <img src={allImages[0]} alt={place.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              {allImages[1] && (
                <div className="col-span-2 overflow-hidden group">
                  <img src={allImages[1]} alt={`${place.name} - 2`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
              )}
              <div className="col-span-2 grid grid-cols-3 gap-1.5">
                {allImages.slice(2, 5).map((img, idx) => (
                  <div key={idx} className="overflow-hidden relative group">
                    <img src={img} alt={`${place.name} - ${idx + 3}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    {idx === 2 && allImages.length > 3 && (
                      <div className="absolute inset-0 bg-black/55 flex items-center justify-center backdrop-blur-[2px] cursor-pointer">
                        <div className="text-center">
                          <span className="text-white text-2xl font-black">+{allImages.length - 3}</span>
                          <p className="text-white text-[10px] font-black uppercase tracking-widest mt-0.5">See All</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="col-span-4 bg-slate-200 flex items-center justify-center rounded-2xl">
              <p className="text-slate-400 font-black uppercase text-sm">No Images Available</p>
            </div>
          )}
          <ImageGalleryModal images={allImages} name={place.name} />
        </div>
      </div>

      {/* ══ NAME / CATEGORY / LOCATION — below gallery, same style mobile & desktop ══ */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-block bg-teal-600 text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">Adventure</span>
          {liveRating.avg > 0 && (
            <span className="inline-flex items-center gap-1 bg-amber-400 text-black px-2.5 py-0.5 rounded-full text-[10px] font-black">
              <Star className="h-3 w-3 fill-current" />{liveRating.avg}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter leading-tight text-foreground">{place.name}</h1>
        <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-sm font-semibold">{[place.place, place.location, place.country].filter(Boolean).join(", ")}</span>
        </div>
      </div>

      {/* Quick nav bar — mobile only */}
      <div className="md:hidden container px-4 mt-3 max-w-6xl mx-auto">
        <QuickNavigationBar
          hasFacilities={place.facilities?.length > 0}
          hasActivities={place.activities?.length > 0}
          hasContact={place.phone_numbers?.length > 0 || !!place.email}
        />
      </div>

      {/* ══ MAIN CONTENT ══════════════════════════════════════════════════════ */}
      <main className="container px-4 mt-5 relative z-10 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr,1fr] gap-6">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* About */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h2 className="text-base font-black text-slate-900 mb-3">About this property</h2>
              <div className="space-y-3">
                {is24Hours ? (
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">Open 24 Hours</p>
                      <p className="text-xs text-slate-500">Available round the clock</p>
                    </div>
                  </div>
                ) : (place.opening_hours || place.closing_hours) && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{place.opening_hours || "08:00 AM"} – {place.closing_hours || "06:00 PM"}</p>
                      <p className="text-xs text-slate-500">{Array.isArray(place.days_opened) ? place.days_opened.join(", ") : "Open daily"}</p>
                    </div>
                  </div>
                )}
                {place.entry_fee && place.entry_fee > 0 ? (
                  <>
                    <div className="flex items-start gap-3">
                      <Circle className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">Adult from {formatPrice(Number(place.entry_fee))}</p>
                        <p className="text-xs text-slate-500">Per adult admission</p>
                      </div>
                    </div>
                    {place.child_entry_fee > 0 && (
                      <div className="flex items-start gap-3">
                        <Circle className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-slate-900">Child {formatPrice(Number(place.child_entry_fee))}</p>
                          <p className="text-xs text-slate-500">Per child admission</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-start gap-3">
                    <Circle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-700">Free entry</p>
                      <p className="text-xs text-slate-500">No admission fee required</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{[place.place, place.location].filter(Boolean).join(", ")}</p>
                    <p className="text-xs text-slate-500">{place.country}</p>
                  </div>
                </div>
                {place.phone_numbers?.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">Phone</p>
                      <p className="text-xs text-slate-500">{place.phone_numbers[0]}</p>
                    </div>
                  </div>
                )}
                {place.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">Email</p>
                      <a href={`mailto:${place.email}`} className="text-xs text-teal-600 hover:underline">{place.email}</a>
                    </div>
                  </div>
                )}
              </div>
              {place.description && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{place.description}</p>
                </div>
              )}
            </section>

            {/* General amenities — inline display, NOT buttons — mobile */}
            <div className="lg:hidden">
              <GeneralFacilitiesDisplay facilityIds={
                Array.isArray(place.amenities) ? place.amenities.map((a: any) => typeof a === "string" ? a : a.name || "") : []
              } />
            </div>

            {/* Mobile booking card */}
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 lg:hidden">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">From</p>
                  {place.entry_fee && place.entry_fee > 0 ? (
                    <div>
                      <span className="text-xl font-black text-slate-900">{formatPrice(Number(place.entry_fee))}</span>
                      <span className="text-xs text-slate-500 ml-1">/ adult</span>
                      {place.child_entry_fee > 0 && (
                        <p className="text-sm text-slate-600 mt-0.5">Child: {formatPrice(Number(place.child_entry_fee))}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-lg font-bold text-emerald-600">Free Entry</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  <span className="text-sm font-bold">{liveRating.avg || "0"}</span>
                  <span className="text-[10px] text-slate-500">({liveRating.count})</span>
                </div>
              </div>
              <Button onClick={() => navigateToBooking(`/booking/adventure_place/${resolvedId}`)}
                className="w-full py-5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 border-none shadow-md">
                Check availability
              </Button>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
                <UtilityButton icon={<Navigation className="h-4 w-4" />} label="Map"
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.location}`)}`, "_blank")} />
                <UtilityButton icon={<Copy className="h-4 w-4" />} label="Copy"
                  onClick={async () => { const link = getShareLink(resolvedId, "adventure_place", place.name, place.location); await navigator.clipboard.writeText(link); toast({ title: "Link Copied!" }); }} />
                <UtilityButton icon={<Share2 className="h-4 w-4" />} label="Share"
                  onClick={async () => {
                    const link = getShareLink(resolvedId, "adventure_place", place.name, place.location);
                    if (navigator.share) { try { await navigator.share({ title: place.name, url: link }); } catch {} }
                    else { await navigator.clipboard.writeText(link); toast({ title: "Link Copied!" }); }
                  }} />
              </div>
            </div>

            {/* General amenities — desktop */}
            <div className="hidden lg:block">
              <GeneralFacilitiesDisplay facilityIds={
                Array.isArray(place.amenities) ? place.amenities.map((a: any) => typeof a === "string" ? a : a.name || "") : []
              } />
            </div>

            {place.facilities?.length > 0 && (
              <div id="facilities-section">
                <FacilitiesGrid facilities={place.facilities} itemId={resolvedId} itemType="adventure_place" accentColor="#008080" />
              </div>
            )}

            {place.activities?.length > 0 && (
              <div id="activities-section">
                <ActivitiesGrid activities={place.activities} itemId={resolvedId} itemType="adventure_place" accentColor="#FF7F50" />
              </div>
            )}

            <div id="contact-section" className="lg:hidden">
              {(place.phone_numbers?.length > 0 || place.email) && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">Contact</h3>
                  {place.phone_numbers?.map((phone: string, idx: number) => (
                    <a key={idx} href={`tel:${phone}`} className="flex items-center gap-3 text-slate-600 hover:text-teal-600 transition-colors">
                      <Phone className="h-4 w-4 text-slate-500" /><span className="text-sm">{phone}</span>
                    </a>
                  ))}
                  {place.email && (
                    <a href={`mailto:${place.email}`} className="flex items-center gap-3 text-slate-600 hover:text-teal-600 transition-colors">
                      <Mail className="h-4 w-4 text-slate-500" /><span className="text-sm">{place.email}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Desktop sidebar ── */}
          <div className="hidden lg:block">
            <div className="sticky top-24 bg-white rounded-2xl p-6 shadow-lg border border-slate-200 space-y-4">
              <div>
                <p className="text-xs text-slate-500">From</p>
                {place.entry_fee && place.entry_fee > 0 ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">{formatPrice(Number(place.entry_fee))}</span>
                    <span className="text-sm text-slate-500">/ person</span>
                  </div>
                ) : <span className="text-xl font-bold text-emerald-600">Free Entry</span>}
                {place.child_entry_fee > 0 && <p className="text-sm text-slate-600 mt-1">Child: {formatPrice(Number(place.child_entry_fee))}</p>}
              </div>
              <Button onClick={() => navigateToBooking(`/booking/adventure_place/${resolvedId}`)}
                className="w-full py-6 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 border-none shadow-md">
                Check availability
              </Button>
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <Star className="h-5 w-5 fill-slate-800 text-slate-800" />
                <span className="text-lg font-black text-slate-900">{liveRating.avg || "0"}</span>
                <span className="text-xs text-slate-500">({liveRating.count} reviews)</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                <UtilityButton icon={<Navigation className="h-4 w-4" />} label="Map"
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.location}`)}`, "_blank")} />
                <UtilityButton icon={<Copy className="h-4 w-4" />} label="Copy"
                  onClick={async () => { const link = getShareLink(resolvedId, "adventure_place", place.name, place.location); await navigator.clipboard.writeText(link); toast({ title: "Link Copied!" }); }} />
                <UtilityButton icon={<Share2 className="h-4 w-4" />} label="Share"
                  onClick={async () => {
                    const link = getShareLink(resolvedId, "adventure_place", place.name, place.location);
                    if (navigator.share) { try { await navigator.share({ title: place.name, url: link }); } catch {} }
                    else { await navigator.clipboard.writeText(link); toast({ title: "Link Copied!" }); }
                  }} />
              </div>
              {(place.phone_numbers?.length > 0 || place.email) && (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-500">Contact</h3>
                  {place.phone_numbers?.map((phone: string, idx: number) => (
                    <a key={idx} href={`tel:${phone}`} className="flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors">
                      <Phone className="h-4 w-4" /><span className="text-sm">{phone}</span>
                    </a>
                  ))}
                  {place.email && (
                    <a href={`mailto:${place.email}`} className="flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors">
                      <Mail className="h-4 w-4" /><span className="text-sm">{place.email}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <ReviewSection itemId={resolvedId} itemType="adventure_place" />
        </div>

        <DetailMapSection
          currentItem={{ id: resolvedId, name: place.name, latitude: place.latitude, longitude: place.longitude, location: place.location, country: place.country, image_url: place.image_url, entry_fee: place.entry_fee }}
          itemType="adventure"
        />
      </main>

      <Footer />

      {/* Mobile bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgb(0,0,0,0.08)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            {place.entry_fee && place.entry_fee > 0 ? (
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-slate-500">From</span>
                <span className="text-lg font-black text-slate-900">{formatPrice(Number(place.entry_fee))}</span>
                <span className="text-xs text-slate-500">/ person</span>
              </div>
            ) : getStartingPrice() > 0 ? (
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-slate-500">From</span>
                <span className="text-lg font-black text-slate-900">{formatPrice(getStartingPrice())}</span>
              </div>
            ) : (
              <span className="text-sm font-bold text-emerald-600">Free Entry</span>
            )}
          </div>
          <Button onClick={() => navigateToBooking(`/booking/adventure_place/${resolvedId}`)}
            className="px-6 py-5 rounded-xl text-sm font-bold text-white border-none bg-emerald-600 hover:bg-emerald-700">
            Check availability
          </Button>
        </div>
      </div>
    </div>
  );
};

const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <Button variant="ghost" onClick={onClick}
    className="flex-col h-auto py-2.5 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors flex-1">
    <div className="mb-0.5">{icon}</div>
    <span className="text-[9px] font-bold uppercase">{label}</span>
  </Button>
);

export default AdventurePlaceDetail;