import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { useBookingNavigate } from "@/hooks/useBookingNavigate";
import { Button } from "@/components/ui/button";
import {
  MapPin, Share2, Copy, Clock, Users,
  ChevronLeft, ChevronRight, Grid2X2, Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedItems } from "@/hooks/useSavedItems";
import { trackReferralClick } from "@/lib/referralUtils";
import { getShareLink } from "@/lib/shareUtils";
import { getSlugLookupCandidates } from "@/lib/slugUtils";
import { useBookingSubmit, BookingFormData } from "@/hooks/useBookingSubmit";
import { useRealtimeItemAvailability } from "@/hooks/useRealtimeBookings";
import { DetailNavBar } from "@/components/detail/DetailNavBar";
import { DetailMapSection } from "@/components/detail/DetailMapSection";
import { TealLoader } from "@/components/ui/teal-loader";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Footer } from "@/components/Footer";

const TEAL        = "#008080";
const CORAL       = "#FF7F50";
const CORAL_LIGHT = "#FF9E7A";

const SELECT_FIELDS = "id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,price,price_child,available_tickets,description,activities,created_by,type,opening_hours,closing_hours,days_opened,map_link,is_flexible_date,inclusions,exclusions,allow_children,ticket_types,slot_limit_type,latitude,longitude,average_rating,total_reviews";

// ─── Image Gallery Modal ──────────────────────────────────────────────────────
const ImageGalleryModal = ({
  images, name, startIndex = 0, onClose,
}: {
  images: string[]; name: string; startIndex?: number; onClose: () => void;
}) => {
  const [current, setCurrent] = useState(startIndex);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setCurrent((p) => (p + 1) % images.length);
      if (e.key === "ArrowLeft") setCurrent((p) => (p - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <span className="text-white/60 text-xs font-bold uppercase tracking-widest">{name}</span>
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-xs font-bold">{current + 1} / {images.length}</span>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white text-lg font-bold">
            ✕
          </button>
        </div>
      </div>
      <div className="flex-1 relative flex items-center justify-center overflow-hidden px-4">
        <img src={images[current]} alt={`${name} ${current + 1}`}
          className="max-h-full max-w-full object-contain select-none" />
        {images.length > 1 && (
          <>
            <button onClick={() => setCurrent((p) => (p - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <button onClick={() => setCurrent((p) => (p + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex-shrink-0 px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 w-max mx-auto">
            {images.map((img, idx) => (
              <button key={idx} onClick={() => setCurrent(idx)} className="flex-shrink-0 transition-all"
                style={{ width: 56, height: 42, outline: idx === current ? `2px solid ${CORAL}` : "2px solid transparent", outlineOffset: 1, opacity: idx === current ? 1 : 0.5 }}>
                <img src={img} alt="" className="w-full h-full object-cover" style={{ borderRadius: 0 }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Desktop gallery grid (constrained width, no border-radius) ───────────────
const DesktopGallery = ({ images, name }: { images: string[]; name: string }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState(0);
  const open = (idx: number) => { setModalStart(idx); setModalOpen(true); };

  if (!images.length) return null;
  return (
    <>
      {modalOpen && <ImageGalleryModal images={images} name={name} startIndex={modalStart} onClose={() => setModalOpen(false)} />}
      <div className="hidden md:block max-w-6xl mx-auto px-4 pt-4">
        <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gridTemplateRows: "200px 130px", gap: "3px", borderRadius: 0 }}>
          {/* Large left spanning 2 rows */}
          <div style={{ gridRow: "1 / 3", overflow: "hidden", borderRadius: 0, cursor: "pointer" }} onClick={() => open(0)}>
            {images[0] && (
              <img src={images[0]} alt={name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" style={{ borderRadius: 0 }} />
            )}
          </div>
          {/* Top right */}
          <div style={{ overflow: "hidden", borderRadius: 0, cursor: "pointer" }} onClick={() => open(1)}>
            {images[1]
              ? <img src={images[1]} alt={`${name} 2`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" style={{ borderRadius: 0 }} />
              : <div className="w-full h-full bg-slate-200" />}
          </div>
          {/* Bottom right with See All overlay */}
          <div style={{ overflow: "hidden", borderRadius: 0, position: "relative", cursor: "pointer" }} onClick={() => open(2)}>
            {images[2]
              ? <img src={images[2]} alt={`${name} 3`} className="w-full h-full object-cover" style={{ borderRadius: 0 }} />
              : <div className="w-full h-full bg-slate-200" />}
            {images.length > 3 && (
              <div className="absolute inset-0 bg-black/52 flex items-center justify-center backdrop-blur-[1px]">
                <div className="text-center">
                  <span className="text-white text-2xl font-black">+{images.length - 3}</span>
                  <p className="text-white text-[10px] font-black uppercase tracking-widest mt-0.5">See All</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Mobile carousel (constrained to max-w-6xl, no border-radius) ─────────────
const MobileCarousel = ({ images, name }: { images: string[]; name: string }) => {
  const [active, setActive] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const iv = setInterval(() => setActive((p) => (p + 1) % images.length), 4000);
    return () => clearInterval(iv);
  }, [images.length]);

  const go = (idx: number) => setActive((idx + images.length) % images.length);

  if (!images.length) return (
    <div className="md:hidden max-w-6xl mx-auto px-4 pt-4">
      <div className="w-full bg-slate-200 flex items-center justify-center text-slate-400 font-black uppercase text-xs"
        style={{ height: "45vh", minHeight: "200px", maxHeight: "360px" }}>No Image</div>
    </div>
  );

  return (
    <>
      {modalOpen && <ImageGalleryModal images={images} name={name} startIndex={modalStart} onClose={() => setModalOpen(false)} />}
      <div className="md:hidden max-w-6xl mx-auto px-4 pt-4">
        <div className="relative w-full overflow-hidden bg-slate-900"
          style={{ height: "45vh", minHeight: "200px", maxHeight: "360px", borderRadius: 0 }}>
          {images.map((img, idx) => (
            <img key={idx} src={img} alt={`${name} ${idx + 1}`}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
              style={{ opacity: active === idx ? 1 : 0, borderRadius: 0 }} />
          ))}
          <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none z-10"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }} />
          {images.length > 1 && (
            <>
              <button onClick={() => go(active - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <ChevronLeft className="h-4 w-4 text-white" />
              </button>
              <button onClick={() => go(active + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <ChevronRight className="h-4 w-4 text-white" />
              </button>
            </>
          )}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5 pointer-events-none">
              {images.slice(0, 6).map((_, idx) => (
                <span key={idx} className="transition-all duration-300 block pointer-events-auto cursor-pointer"
                  onClick={() => go(idx)}
                  style={{ width: active === idx ? "20px" : "6px", height: "6px", borderRadius: "3px", background: active === idx ? "white" : "rgba(255,255,255,0.45)" }} />
              ))}
            </div>
          )}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            {images.length > 1 && (
              <button onClick={() => { setModalStart(active); setModalOpen(true); }}
                className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full hover:bg-black/70 transition-all">
                <Grid2X2 className="h-3 w-3" /> See All
              </button>
            )}
            <div className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
              {active + 1} / {images.length}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Highlights / Activities — plain list, no images, no numbering ───────────
const ActivitiesGrid = ({ activities, formatPrice }: { activities: any[]; formatPrice: (n: number) => string }) => {
  if (!activities?.length) return null;
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: CORAL }}>Highlights</h2>
      <ul className="divide-y divide-slate-100">
        {activities.map((act: any, i: number) => (
          <li key={i} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="font-bold text-sm text-slate-800 leading-snug">{act.name}</p>
              {act.description && (
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{act.description}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              {act.price > 0 && !act.is_free ? (
                <p className="text-[12px] font-bold" style={{ color: CORAL }}>{formatPrice(Number(act.price))}</p>
              ) : (
                <p className="text-[12px] font-bold text-emerald-600">Included</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <Button variant="ghost" onClick={onClick}
    className="flex-col h-auto py-2.5 bg-[#F0E68C]/15 text-[#857F3E] rounded-xl hover:bg-[#F0E68C]/30 transition-colors border border-[#F0E68C]/30">
    <div className="mb-0.5">{icon}</div>
    <span className="text-[9px] font-black uppercase tracking-tight">{label}</span>
  </Button>
);

// ─── Rating Stars ─────────────────────────────────────────────────────────────
const RatingStars = ({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) => {
  const starSize = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={starSize}
          style={{
            fill: star <= Math.round(rating) ? "#FF7F50" : "none",
            color: star <= Math.round(rating) ? "#FF7F50" : "#d1d5db",
          }}
        />
      ))}
    </div>
  );
};

// ─── Reviews Section ──────────────────────────────────────────────────────────
const ReviewsSection = ({ itemId, averageRating, totalReviews }: {
  itemId: string; averageRating: number; totalReviews: number;
}) => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer_name, reviewer_avatar")
      .eq("item_id", itemId)
      .eq("item_type", "trip")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setReviews(data || []);
        setLoading(false);
      });
  }, [itemId]);

  const avg = averageRating || (reviews.length > 0
    ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
    : 0);
  const total = totalReviews || reviews.length;
  const displayed = showAll ? reviews : reviews.slice(0, 3);

  // Distribution
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));

  if (loading) return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-pulse">
      <div className="h-4 w-32 bg-slate-200 rounded mb-4" />
      <div className="space-y-3">
        {[1, 2].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
      </div>
    </div>
  );

  if (total === 0 && reviews.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h2 className="text-base font-black uppercase tracking-tight mb-4" style={{ color: TEAL }}>
        Reviews {total > 0 && <span className="text-slate-400 font-bold normal-case text-sm">({total})</span>}
      </h2>

      {/* Summary row */}
      {avg > 0 && (
        <div className="flex items-start gap-6 mb-5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          {/* Big score */}
          <div className="text-center shrink-0">
            <p className="text-4xl font-black text-slate-900 leading-none">{avg.toFixed(1)}</p>
            <RatingStars rating={avg} size="sm" />
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wide">{total} review{total !== 1 ? "s" : ""}</p>
          </div>
          {/* Bar chart */}
          <div className="flex-1 space-y-1.5">
            {dist.map(({ star, count }) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 w-3 shrink-0">{star}</span>
                  <Star className="h-2.5 w-2.5 shrink-0" style={{ fill: "#FF7F50", color: "#FF7F50" }} />
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: "linear-gradient(90deg, #FF9E7A, #FF7F50)" }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 w-6 text-right shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Individual reviews */}
      {displayed.length > 0 && (
        <div className="space-y-3">
          {displayed.map((review) => (
            <div key={review.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  {review.reviewer_avatar ? (
                    <img src={review.reviewer_avatar} alt={review.reviewer_name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black"
                      style={{ background: `linear-gradient(135deg, ${TEAL}, #005f5f)` }}>
                      {(review.reviewer_name || "A").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-black text-slate-800">{review.reviewer_name || "Anonymous"}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(review.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <RatingStars rating={review.rating} size="sm" />
              </div>
              {review.comment && (
                <p className="text-sm text-slate-600 leading-relaxed">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {reviews.length > 3 && (
        <button
          onClick={() => setShowAll((p) => !p)}
          className="mt-3 w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          {showAll ? "Show Less" : `Show All ${reviews.length} Reviews`}
        </button>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const TripDetail = () => {
  const { slug: rawSlug } = useParams();
  const navigate = useNavigate();
  const goBack = useSafeBack();
  const navigateToBooking = useBookingNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const [event, setEvent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const currentItemId = event?.id || "";
  const isSaved = savedItems.has(currentItemId);

  useEffect(() => { window.scrollTo(0, 0); if (rawSlug) fetchTrip(); }, [rawSlug]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refSlug = urlParams.get("ref");
    if (refSlug && event?.id) trackReferralClick(refSlug, event.id, "trip", "booking");
  }, [event?.id]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fetchTrip = async () => {
    if (!rawSlug) return;
    setLoading(true);
    setEvent(null);
    try {
      const candidates = getSlugLookupCandidates(rawSlug);
      const findMatch = (rows: any[] | null | undefined, field: "id" | "slug") => {
        if (!rows?.length) return null;
        for (const candidate of candidates) {
          const match = rows.find((row) => row?.[field] === candidate);
          if (match) return match;
        }
        return rows[0] || null;
      };
      const fetchByField = async (field: "id" | "slug", type?: string) => {
        let query: any = supabase.from("trips").select(SELECT_FIELDS).in(field, candidates);
        if (type) query = query.eq("type", type);
        const { data } = await query;
        return findMatch(data, field);
      };
      const data =
        (await fetchByField("id", "trip")) ||
        (await fetchByField("slug", "trip")) ||
        (await fetchByField("id")) ||
        (await fetchByField("slug"));
      if (!data) throw new Error("Not found");
      setEvent(data);
    } catch {
      toast({ title: "Trip not found", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSave = () => currentItemId && handleSaveItem(currentItemId, "trip");

  const handleCopyLink = async () => {
    if (!event) return;
    await navigator.clipboard.writeText(getShareLink(event.id, "trip", event.name, event.location));
    toast({ title: "Link Copied!" });
  };

  const handleShare = async () => {
    if (!event) return;
    const link = getShareLink(event.id, "trip", event.name, event.location);
    if (navigator.share) { try { await navigator.share({ title: event.name, url: link }); } catch {} }
    else { await navigator.clipboard.writeText(link); toast({ title: "Link Copied!" }); }
  };

  const openInMaps = () => {
    const query = encodeURIComponent(`${event?.name}, ${event?.location}`);
    window.open(event?.map_link || `https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const { submitBooking } = useBookingSubmit();

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!event) return;
    setIsProcessing(true);
    try {
      const totalAmount = (data.num_adults * event.price) + (data.num_children * (event.price_child || 0));
      await submitBooking({
        itemId: event.id, itemName: event.name, bookingType: "trip", totalAmount,
        slotsBooked: data.num_adults + data.num_children, visitDate: event.date,
        guestName: data.guest_name, guestEmail: data.guest_email, guestPhone: data.guest_phone,
        hostId: event.created_by, bookingDetails: { ...data, event_name: event.name }
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  const { remainingSlots, isSoldOut } = useRealtimeItemAvailability(event?.id || undefined, event?.available_tickets || 0);

  if (loading) return <TealLoader />;
  if (!event) return null;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const eventDate = event.date ? new Date(event.date) : null;
  const isExpired = !event.is_custom_date && eventDate && eventDate < today;
  const canBook = !isExpired && !isSoldOut;
  const allImages = [event?.image_url, ...(event?.gallery_images || []), ...(event?.images || [])].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

  return (
    <div className="min-h-screen bg-background pb-24">
      <DetailNavBar scrolled={scrolled} itemName={event.name} isSaved={isSaved} onSave={handleSave} onBack={goBack} />

      <div style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }} />

      {/* Gallery — constrained width on both mobile and desktop */}
      <MobileCarousel images={allImages} name={event.name} />
      <DesktopGallery images={allImages} name={event.name} />

      {/* ── Name / badge / location ── */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-1 bg-background">
        <span className="inline-block mb-2 bg-[#FF7F50] text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">Trip</span>
        <h1 className="text-2xl font-black uppercase tracking-tighter leading-tight text-foreground">{event.name}</h1>
        <button onClick={openInMaps} className="flex items-center gap-1.5 mt-1 text-muted-foreground hover:text-[#008080] transition-colors">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-sm font-semibold">{[event.place, event.location, event.country].filter(Boolean).join(", ")}</span>
        </button>
        {/* Rating summary */}
        {(event.average_rating > 0 || event.total_reviews > 0) && (
          <div className="flex items-center gap-2 mt-2">
            <RatingStars rating={event.average_rating || 0} size="sm" />
            <span className="text-sm font-black text-slate-800">{(event.average_rating || 0).toFixed(1)}</span>
            <span className="text-xs text-slate-400 font-semibold">({event.total_reviews || 0} review{event.total_reviews !== 1 ? "s" : ""})</span>
          </div>
        )}
      </div>

      {/* ══ MAIN CONTENT ══════════════════════════════════════════════════════ */}
      <main className="container px-4 max-w-6xl mx-auto mt-5 relative z-10">
        <div className="grid lg:grid-cols-[1.7fr,1fr] gap-6">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* About */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: TEAL }}>About this Trip</h2>
              {event.description
                ? <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">{event.description}</p>
                : <p className="text-muted-foreground text-sm italic">No description provided.</p>
              }
            </div>

            {/* Activities — text-only list, no images */}
            {event.activities?.length > 0 && (
              <ActivitiesGrid activities={event.activities} formatPrice={formatPrice} />
            )}

            {/* Inclusions & Exclusions */}
            {((event.inclusions?.length > 0) || (event.exclusions?.length > 0)) && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h2 className="text-base font-black uppercase tracking-tight mb-4" style={{ color: TEAL }}>Package Details</h2>
                <div className="grid grid-cols-2 gap-6">
                  {event.inclusions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-2">✓ Included</p>
                      <ul className="space-y-1.5">
                        {event.inclusions.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                            <span className="text-emerald-500 mt-0.5">✓</span><span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {event.exclusions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-2">✗ Not Included</p>
                      <ul className="space-y-1.5">
                        {event.exclusions.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-red-600">
                            <span className="text-red-400 mt-0.5">✗</span><span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reviews */}
            <ReviewsSection
              itemId={event.id}
              averageRating={event.average_rating || 0}
              totalReviews={event.total_reviews || 0}
            />

          </div>

          {/* ── Right column / Booking card ── */}
          <div className="space-y-5">
            <div className="bg-white rounded-[28px] p-5 shadow-2xl border border-slate-100 lg:sticky lg:top-24">

              {/* Price */}
              <div className="mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Ticket Price</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">{formatPrice(event.price)}</span>
                  <span className="text-sm text-slate-400 font-bold uppercase">/ adult</span>
                </div>
                {event.allow_children !== false && event.price_child != null && (
                  <p className="text-sm text-slate-600 mt-0.5">Child: {formatPrice(event.price_child || 0)}</p>
                )}
              </div>

              {/* Hours */}
              {(event.opening_hours || event.closing_hours || (event.is_flexible_date && event.days_opened?.length > 0)) && (
                <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {(event.opening_hours || event.closing_hours) && (
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Hours</span>
                      <span className="text-xs font-black text-slate-700">{event.opening_hours || "08:00"} – {event.closing_hours || "18:00"}</span>
                    </div>
                  )}
                  {event.is_flexible_date && event.days_opened?.length > 0 && (
                    <div className="mt-1.5">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Available Days</p>
                      <div className="flex flex-wrap gap-1">
                        {event.days_opened.map((day: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-primary/10 text-[9px] font-black uppercase text-primary border border-primary/20">{day}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trip meta */}
              <div className="space-y-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                  <span className="text-slate-400">Date</span>
                  <span className={isExpired ? "text-red-500" : "text-slate-700"}>
                    {event.is_custom_date
                      ? <span className="text-emerald-600 font-black">FLEXIBLE</span>
                      : <>{new Date(event.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}{isExpired && " (Past)"}</>
                    }
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                  <span className="text-slate-400">Children</span>
                  <span className={event.allow_children === false ? "text-red-500" : "text-emerald-600"}>
                    {event.allow_children === false ? "Not Allowed" : "Allowed"}
                  </span>
                </div>
                {event.ticket_types?.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Ticket Types</p>
                    {event.ticket_types.map((ticket: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs font-bold uppercase tracking-tight py-0.5">
                        <span className="text-slate-500">{ticket.name}</span>
                        <span className="text-slate-700">{formatPrice(Number(ticket.price))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reserve */}
              <Button
                onClick={() => navigateToBooking(`/booking/trip/${event.id}`)}
                disabled={!canBook}
                className="w-full py-6 rounded-2xl text-sm font-black uppercase tracking-[0.15em] text-white shadow-xl transition-all active:scale-95 border-none"
                style={{ background: !canBook ? "#cbd5e1" : `linear-gradient(135deg, ${CORAL_LIGHT} 0%, ${CORAL} 100%)` }}
              >
                {isSoldOut ? "Fully Booked" : isExpired ? "Trip Expired" : "Reserve Spot"}
              </Button>

              {/* Utilities */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
                <UtilityButton icon={<MapPin className="h-4 w-4" />} label="Map" onClick={openInMaps} />
                <UtilityButton icon={<Copy className="h-4 w-4" />} label="Copy" onClick={handleCopyLink} />
                <UtilityButton icon={<Share2 className="h-4 w-4" />} label="Share" onClick={handleShare} />
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="mt-6 rounded-2xl overflow-hidden shadow-sm border border-slate-100" style={{ height: "320px" }}>
          <DetailMapSection
            currentItem={{
              id: event.id,
              name: event.name,
              latitude: event.latitude ?? null,
              longitude: event.longitude ?? null,
              location: event.location,
              country: event.country,
              image_url: event.image_url,
              price: event.price,
            }}
            itemType="trip"
          />
        </div>
      </main>

      <Footer />

      {/* Mobile bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgb(0,0,0,0.08)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-destructive">{formatPrice(event.price)}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">/ adult</span>
            </div>
            {event.allow_children !== false && event.price_child != null && (
              <div className="text-[10px] font-bold text-slate-500">Child: {formatPrice(event.price_child || 0)}</div>
            )}
          </div>
          <Button
            onClick={() => navigateToBooking(`/booking/trip/${event.id}`)}
            disabled={!canBook}
            className="px-6 py-5 rounded-xl text-xs font-black uppercase tracking-widest text-white border-none"
            style={{ background: !canBook ? "#cbd5e1" : `linear-gradient(135deg, ${CORAL_LIGHT} 0%, ${CORAL} 100%)` }}
          >
            {isSoldOut ? "Fully Booked" : isExpired ? "Expired" : "Reserve"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TripDetail;