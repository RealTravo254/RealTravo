import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { useBookingNavigate } from "@/hooks/useBookingNavigate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  MapPin, Clock, Share2, Copy, Navigation, AlertCircle,
  Users, CheckCircle2, ChevronLeft, ChevronRight, Grid2X2, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useGeolocation } from "@/hooks/useGeolocation";
import { trackReferralClick } from "@/lib/referralUtils";
import { getShareLink } from "@/lib/shareUtils";
import { extractIdFromSlug } from "@/lib/slugUtils";
import { DetailNavBar } from "@/components/detail/DetailNavBar";
import { QuickNavigationBar } from "@/components/detail/QuickNavigationBar";
import { TealLoader } from "@/components/ui/teal-loader";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Footer } from "@/components/Footer";

const TEAL        = "#008080";
const CORAL       = "#FF7F50";
const CORAL_LIGHT = "#FF9E7A";

const FACILITY_LABELS: Record<string, string> = {
  wifi: "Free Wi-Fi", parking: "On-site Parking", toilet: "Flush Toilets",
  shower: "Hot Showers", camping: "Camping Area", picnic: "Picnic Tables",
  braai: "Braai / BBQ Facilities", playground: "Children's Playground",
  restaurant: "Restaurant / Café", swimming: "Swimming Pool",
  security: "24-Hour Security", accessibility: "Wheelchair Accessible",
  pets: "Pet Friendly", guided: "Guided Tours Available",
  first_aid: "First-Aid Station", shop: "On-site Shop / Curio",
};
const facilityLabel = (id: string) =>
  FACILITY_LABELS[id] ?? id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
      style={{ paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <span className="text-white/60 text-xs font-bold uppercase tracking-widest">{name}</span>
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-xs font-bold">{current + 1} / {images.length}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white text-lg font-bold">✕</button>
        </div>
      </div>
      <div className="flex-1 relative flex items-center justify-center overflow-hidden px-4">
        <img src={images[current]} alt={`${name} ${current + 1}`} className="max-h-full max-w-full object-contain select-none" />
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

// ─── Desktop gallery grid ─────────────────────────────────────────────────────
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
          <div style={{ gridRow: "1 / 3", overflow: "hidden", borderRadius: 0, cursor: "pointer" }} onClick={() => open(0)}>
            <img src={images[0]} alt={name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" style={{ borderRadius: 0 }} />
          </div>
          <div style={{ overflow: "hidden", borderRadius: 0, cursor: "pointer" }} onClick={() => open(1)}>
            {images[1]
              ? <img src={images[1]} alt={`${name} 2`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" style={{ borderRadius: 0 }} />
              : <div className="w-full h-full bg-slate-200" />}
          </div>
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

// ─── Mobile carousel ──────────────────────────────────────────────────────────
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
    <div className="md:hidden w-full bg-slate-200 flex items-center justify-center text-slate-400 font-black uppercase text-xs"
      style={{ height: "45vh", minHeight: "200px", maxHeight: "360px" }}>No Image</div>
  );

  return (
    <>
      {modalOpen && <ImageGalleryModal images={images} name={name} startIndex={modalStart} onClose={() => setModalOpen(false)} />}
      <div className="md:hidden w-full relative overflow-hidden bg-slate-900"
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
            <button onClick={() => go(active - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>
            <button onClick={() => go(active + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
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
    </>
  );
};

// ─── General Amenities — small chips with horizontal scroll on mobile ─────────
const AmenitiesScroll = ({ amenities, accentColor }: { amenities: string[]; accentColor: string }) => {
  if (!amenities.length) return null;
  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: accentColor }}>General Amenities</h2>

      {/* Mobile: horizontal scroll */}
      <div className="sm:hidden">
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "thin", scrollbarColor: `${accentColor}40 transparent`, WebkitOverflowScrolling: "touch", marginLeft: "-16px", marginRight: "-16px", paddingLeft: "16px", paddingRight: "16px" }}>
          {amenities.map((fId, i) => (
            <div key={i} className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
              style={{ background: `${accentColor}10`, borderColor: `${accentColor}30` }}>
              <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: accentColor }} />
              <span className="text-[10px] font-bold uppercase tracking-tight whitespace-nowrap" style={{ color: accentColor }}>
                {facilityLabel(fId)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: wrap */}
      <div className="hidden sm:flex flex-wrap gap-2">
        {amenities.map((fId, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
            style={{ background: `${accentColor}10`, borderColor: `${accentColor}30` }}>
            <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: accentColor }} />
            <span className="text-[10px] font-bold uppercase tracking-tight" style={{ color: accentColor }}>
              {facilityLabel(fId)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

// ─── Facilities — horizontal scroll on mobile, grid on desktop ────────────────
const InlineFacilitiesGrid = ({ facilities, accentColor }: { facilities: any[]; accentColor: string }) => {
  const [modalImages, setModalImages] = useState<string[] | null>(null);
  const [modalName, setModalName] = useState("");
  const [showAll, setShowAll] = useState(false);

  if (!facilities?.length) return null;

  const visibleFacilities = showAll ? facilities : facilities.slice(0, 6);

  return (
    <>
      {modalImages && <ImageGalleryModal images={modalImages} name={modalName} onClose={() => setModalImages(null)} />}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black uppercase tracking-tight" style={{ color: accentColor }}>Facilities</h2>
          {facilities.length > 6 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all"
              style={{ color: accentColor, borderColor: `${accentColor}40`, background: `${accentColor}0D` }}>
              {showAll ? "Show Less" : `See All (${facilities.length})`}
            </button>
          )}
        </div>

        {/* Mobile: horizontal scroll */}
        <div className="sm:hidden">
          <div
            className="flex gap-3 overflow-x-auto pb-3"
            style={{ scrollbarWidth: "thin", scrollbarColor: `${accentColor}40 transparent`, WebkitOverflowScrolling: "touch", marginLeft: "-16px", marginRight: "-16px", paddingLeft: "16px", paddingRight: "16px" }}>
            {visibleFacilities.map((fac: any, i: number) => {
              const imgs: string[] = Array.isArray(fac.images) ? fac.images.filter(Boolean) : [];
              return (
                <div key={i} className="flex-shrink-0 bg-white overflow-hidden shadow-sm border border-slate-100" style={{ borderRadius: 0, width: 180 }}>
                  {imgs.length > 0 ? (
                    <div className="relative">
                      <FacSlideshow images={imgs} name={fac.name} />
                      {imgs.length > 1 && (
                        <button onClick={() => { setModalImages(imgs); setModalName(fac.name); }}
                          className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-1 rounded-full hover:bg-black/70 transition-all">
                          <Grid2X2 className="h-2.5 w-2.5" /> See All ({imgs.length})
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="h-36 bg-slate-100 flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-slate-300" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="font-black text-sm text-slate-800 uppercase tracking-tight">{fac.name}</p>
                    {fac.capacity && (
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1"><Users className="h-3 w-3" /> Capacity: {fac.capacity}</p>
                    )}
                    {fac.price > 0 && (
                      <p className="text-[11px] font-bold mt-0.5" style={{ color: accentColor }}>KSh {fac.price?.toLocaleString()}</p>
                    )}
                    {Array.isArray(fac.amenities) && fac.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {fac.amenities.map((a: string, ai: number) => (
                          <span key={ai} className="text-[9px] font-bold uppercase px-2 py-0.5 rounded"
                            style={{ background: `${accentColor}12`, color: accentColor }}>{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop: 2-column grid */}
        <div className="hidden sm:grid grid-cols-2 gap-4">
          {visibleFacilities.map((fac: any, i: number) => {
            const imgs: string[] = Array.isArray(fac.images) ? fac.images.filter(Boolean) : [];
            return (
              <div key={i} className="bg-white overflow-hidden shadow-sm border border-slate-100" style={{ borderRadius: 0 }}>
                {imgs.length > 0 ? (
                  <div className="relative">
                    <FacSlideshow images={imgs} name={fac.name} />
                    {imgs.length > 1 && (
                      <button onClick={() => { setModalImages(imgs); setModalName(fac.name); }}
                        className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-1 rounded-full hover:bg-black/70 transition-all">
                        <Grid2X2 className="h-2.5 w-2.5" /> See All ({imgs.length})
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="h-36 bg-slate-100 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-slate-300" />
                  </div>
                )}
                <div className="p-3">
                  <p className="font-black text-sm text-slate-800 uppercase tracking-tight">{fac.name}</p>
                  {fac.capacity && (
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1"><Users className="h-3 w-3" /> Capacity: {fac.capacity}</p>
                  )}
                  {fac.price > 0 && (
                    <p className="text-[11px] font-bold mt-0.5" style={{ color: accentColor }}>KSh {fac.price?.toLocaleString()}</p>
                  )}
                  {Array.isArray(fac.amenities) && fac.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {fac.amenities.map((a: string, ai: number) => (
                        <span key={ai} className="text-[9px] font-bold uppercase px-2 py-0.5 rounded"
                          style={{ background: `${accentColor}12`, color: accentColor }}>{a}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
};

const FacSlideshow = ({ images, name }: { images: string[]; name: string }) => {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const iv = setInterval(() => setActive((p) => (p + 1) % images.length), 3000);
    return () => clearInterval(iv);
  }, [images.length]);
  return (
    <div className="relative h-36 overflow-hidden" style={{ borderRadius: 0 }}>
      {images.map((img, idx) => (
        <img key={idx} src={img} alt={name}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: active === idx ? 1 : 0, borderRadius: 0 }} />
      ))}
      {images.length > 1 && (
        <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1 pointer-events-none z-10">
          {images.map((_, idx) => (
            <span key={idx} className="transition-all duration-300 block"
              style={{ width: active === idx ? "12px" : "4px", height: "4px", borderRadius: "2px", background: active === idx ? "white" : "rgba(255,255,255,0.4)" }} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Activities — horizontal scroll on mobile, grid on desktop ────────────────
const InlineActivitiesGrid = ({ activities, formatPrice }: { activities: any[]; formatPrice: (n: number) => string }) => {
  const [modalImages, setModalImages] = useState<string[] | null>(null);
  const [modalName, setModalName] = useState("");
  const [showAll, setShowAll] = useState(false);

  if (!activities?.length) return null;

  const visibleActivities = showAll ? activities : activities.slice(0, 6);

  return (
    <>
      {modalImages && <ImageGalleryModal images={modalImages} name={modalName} onClose={() => setModalImages(null)} />}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black uppercase tracking-tight" style={{ color: CORAL }}>Activities</h2>
          {activities.length > 6 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all"
              style={{ color: CORAL, borderColor: `${CORAL}40`, background: `${CORAL}0D` }}>
              {showAll ? "Show Less" : `See All (${activities.length})`}
            </button>
          )}
        </div>

        {/* Mobile: horizontal scroll */}
        <div className="sm:hidden">
          <div
            className="flex gap-3 overflow-x-auto pb-3"
            style={{ scrollbarWidth: "thin", scrollbarColor: `${CORAL}40 transparent`, WebkitOverflowScrolling: "touch", marginLeft: "-16px", marginRight: "-16px", paddingLeft: "16px", paddingRight: "16px" }}>
            {visibleActivities.map((act: any, i: number) => {
              const imgs: string[] = Array.isArray(act.images) ? act.images.filter(Boolean) : [];
              return (
                <div key={i} className="flex-shrink-0" style={{ width: 150 }}>
                  <ActivityCard act={act} imgs={imgs} formatPrice={formatPrice}
                    onSeeAll={imgs.length > 1 ? () => { setModalImages(imgs); setModalName(act.name); } : undefined} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop: 2-3 column grid */}
        <div className="hidden sm:grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visibleActivities.map((act: any, i: number) => {
            const imgs: string[] = Array.isArray(act.images) ? act.images.filter(Boolean) : [];
            return (
              <ActivityCard key={i} act={act} imgs={imgs} formatPrice={formatPrice}
                onSeeAll={imgs.length > 1 ? () => { setModalImages(imgs); setModalName(act.name); } : undefined} />
            );
          })}
        </div>
      </section>
    </>
  );
};

const ActivityCard = ({ act, imgs, formatPrice, onSeeAll }: { act: any; imgs: string[]; formatPrice: (n: number) => string; onSeeAll?: () => void }) => {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (imgs.length <= 1) return;
    const iv = setInterval(() => setActive((p) => (p + 1) % imgs.length), 3200);
    return () => clearInterval(iv);
  }, [imgs.length]);
  return (
    <div className="relative overflow-hidden" style={{ aspectRatio: "3/4", borderRadius: 0 }}>
      {imgs.length > 0 ? (
        imgs.map((img, idx) => (
          <img key={idx} src={img} alt={act.name}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
            style={{ opacity: active === idx ? 1 : 0, borderRadius: 0 }} />
        ))
      ) : (
        <div className="absolute inset-0 bg-slate-200 flex items-center justify-center">
          <MapPin className="h-6 w-6 text-slate-300" />
        </div>
      )}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)" }} />
      {onSeeAll && (
        <button onClick={onSeeAll}
          className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-1 rounded-full hover:bg-black/70 transition-all">
          <Grid2X2 className="h-2.5 w-2.5" /> All
        </button>
      )}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3">
        <p className="text-white font-black text-sm uppercase tracking-tight leading-tight drop-shadow">{act.name}</p>
        {act.price > 0 ? (
          <p className="text-[11px] font-bold mt-0.5" style={{ color: CORAL_LIGHT }}>{formatPrice(Number(act.price))}</p>
        ) : (
          <p className="text-[11px] font-bold mt-0.5 text-emerald-300">Free</p>
        )}
      </div>
      {imgs.length > 1 && (
        <div className="absolute bottom-1.5 right-2 flex gap-1 z-20 pointer-events-none">
          {imgs.map((_, idx) => (
            <span key={idx} className="transition-all duration-300 block"
              style={{ width: active === idx ? "10px" : "4px", height: "4px", borderRadius: "2px", background: active === idx ? "white" : "rgba(255,255,255,0.4)" }} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Always-open Map Section with Google Maps link ────────────────────────────
const AlwaysOpenMapSection = ({
  name, latitude, longitude, location, country,
}: {
  name: string; latitude?: number | null; longitude?: number | null; location?: string; country?: string;
}) => {
  const hasCoords = latitude != null && longitude != null;
  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${location || ""}, ${country || ""}`)}`;

  const embedUrl = hasCoords
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent(`${name}, ${location || ""}, ${country || ""}`)}&z=13&output=embed`;

  return (
    <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" style={{ color: TEAL }} />
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight" style={{ color: TEAL }}>Location</h2>
            <p className="text-[10px] text-slate-400 font-medium">{[name, location, country].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[10px] font-bold transition-all hover:opacity-90 active:scale-95"
          style={{ background: `linear-gradient(135deg, ${TEAL}, #005f5f)` }}
        >
          <ExternalLink className="h-3 w-3" />
          View on Google Maps
        </a>
      </div>

      {/* Map iframe — always open */}
      <div style={{ height: "300px", position: "relative" }}>
        <iframe
          title={`Map of ${name}`}
          src={embedUrl}
          width="100%"
          height="100%"
          style={{ border: 0, display: "block" }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        {/* Location name overlay pin */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm shadow-md rounded-full px-3 py-1.5 pointer-events-none">
          <MapPin className="h-3 w-3" style={{ color: CORAL }} />
          <span className="text-[10px] font-black uppercase tracking-tight text-slate-700">{name}</span>
        </div>
      </div>
    </section>
  );
};

const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <Button variant="ghost" onClick={onClick}
    className="flex-col h-auto py-2.5 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors flex-1">
    <div className="mb-0.5">{icon}</div>
    <span className="text-[9px] font-bold uppercase">{label}</span>
  </Button>
);

// ─── Main component ───────────────────────────────────────────────────────────
const AdventurePlaceDetail = () => {
  const { slug: rawSlug } = useParams();
  const id = rawSlug ? extractIdFromSlug(rawSlug) : null;
  const navigate = useNavigate();
  const goBack = useSafeBack();
  const navigateToBooking = useBookingNavigate();
  const { toast } = useToast();
  const { requestLocation } = useGeolocation();
  const { formatPrice } = useCurrency();

  const [place, setPlace]         = useState<any | null>(null);
  const [loading, setLoading]     = useState(true);
  const [isOpenNow, setIsOpenNow] = useState(false);
  const [scrolled, setScrolled]   = useState(false);

  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const isSaved = savedItems.has(id || "");

  const getStartingPrice = () => {
    if (!place) return 0;
    const prices: number[] = [];
    if (place.entry_fee) prices.push(Number(place.entry_fee));
    [place.facilities, place.activities].forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((item: any) => { if (item?.price) prices.push(Number(item.price)); });
    });
    return prices.length > 0 ? Math.min(...prices) : 0;
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (rawSlug) fetchPlace();
    const refSlug = new URLSearchParams(window.location.search).get("ref");
    if (refSlug && id) trackReferralClick(refSlug, id, "adventure_place", "booking");
    requestLocation();
  }, [rawSlug]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!place) return;
    const checkOpen = () => {
      const now = new Date();
      const currentDay = now.toLocaleString("en-us", { weekday: "long" }).toLowerCase();
      if (place.opening_hours === "00:00" && place.closing_hours === "23:59") {
        const days = Array.isArray(place.days_opened) ? place.days_opened.map((d: string) => d.toLowerCase()) : [];
        setIsOpenNow(!days.length || days.includes(currentDay)); return;
      }
      const cur = now.getHours() * 60 + now.getMinutes();
      const parseT = (t: string) => {
        if (!t) return 0;
        const [time, mod] = t.split(" ");
        let [h, m] = time.split(":").map(Number);
        if (mod === "PM" && h < 12) h += 12;
        if (mod === "AM" && h === 12) h = 0;
        return h * 60 + m;
      };
      const open  = parseT(place.opening_hours || "08:00 AM");
      const close = parseT(place.closing_hours  || "06:00 PM");
      const days  = Array.isArray(place.days_opened) ? place.days_opened.map((d: string) => d.toLowerCase()) : [];
      setIsOpenNow((!days.length || days.includes(currentDay)) && cur >= open && cur <= close);
    };
    checkOpen();
    const iv = setInterval(checkOpen, 60_000);
    return () => clearInterval(iv);
  }, [place]);

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
        if (byPartial) data = byPartial.find((item) => rawSlug.endsWith(item.id) || rawSlug.includes(item.id)) || null;
      }
      if (!data) throw new Error("Not found");
      setPlace(data);
    } catch (error) {
      console.error("fetch error:", error);
      toast({ title: "Place not found", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleCheckAvailability = () => {
    navigateToBooking(`/booking/adventure_place/${resolvedId}`);
  };

  if (loading) return <TealLoader />;
  if (!place) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <AlertCircle className="h-12 w-12 text-red-400" />
      <p className="text-lg font-black uppercase text-slate-500">Place not found</p>
      <Button onClick={() => navigate(-1)} className="rounded-full bg-teal-600 text-white border-none">Go Back</Button>
    </div>
  );

  const facilityImgs = (Array.isArray(place.facilities) ? place.facilities : []).flatMap((f: any) => Array.isArray(f.images) ? f.images : []);
  const activityImgs = (Array.isArray(place.activities) ? place.activities : []).flatMap((a: any) => Array.isArray(a.images) ? a.images : []);
  const allImages    = [place.image_url, ...(place.gallery_images || []), ...facilityImgs, ...activityImgs].filter(Boolean).slice(0, 12);

  const is24Hours       = place.opening_hours === "00:00" && place.closing_hours === "23:59";
  const resolvedId      = place.id;
  const generalAmenities: string[] = Array.isArray(place.amenities) ? place.amenities.map((a: any) => typeof a === "string" ? a : a.name || "") : [];
  const capacityPerDay: number | null = place.daily_capacity ?? place.capacity_per_day ?? place.capacity ?? null;
  const daysOpened: string[] = Array.isArray(place.days_opened) ? place.days_opened : [];

  const bookingCardProps = {
    place, is24Hours, daysOpened, capacityPerDay, formatPrice,
    onCheckAvailability: handleCheckAvailability,
    onMap: () => window.open(
      place.latitude && place.longitude
        ? `https://www.google.com/maps?q=${place.latitude},${place.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.location}`)}`,
      "_blank"
    ),
    onCopy: async () => { await navigator.clipboard.writeText(getShareLink(resolvedId, "adventure_place", place.name, place.location)); toast({ title: "Link Copied!" }); },
    onShare: async () => {
      const link = getShareLink(resolvedId, "adventure_place", place.name, place.location);
      if (navigator.share) { try { await navigator.share({ title: place.name, url: link }); } catch {} }
      else { await navigator.clipboard.writeText(link); toast({ title: "Link Copied!" }); }
    },
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <DetailNavBar scrolled={scrolled} itemName={place.name} isSaved={isSaved}
        onSave={() => handleSaveItem(resolvedId, "adventure_place")} onBack={goBack} />
      <div style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }} />

      {/* Gallery */}
      <MobileCarousel images={allImages} name={place.name} />
      <DesktopGallery images={allImages} name={place.name} />

      {/* Name / location */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-1 bg-background relative z-10">
        <h1 className="text-2xl font-black uppercase tracking-tighter leading-tight text-foreground">{place.name}</h1>
        <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-sm font-semibold">{[place.place, place.location, place.country].filter(Boolean).join(", ")}</span>
        </div>
      </div>

      <div className="md:hidden container px-4 mt-3 max-w-6xl mx-auto">
        <QuickNavigationBar hasFacilities={place.facilities?.length > 0} hasActivities={place.activities?.length > 0} hasContact={false} />
      </div>

      <main className="container px-4 mt-5 relative z-10 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr,1fr] gap-6">
          <div className="space-y-6">
            {/* General Amenities — small chips */}
            {generalAmenities.length > 0 && <AmenitiesScroll amenities={generalAmenities} accentColor={TEAL} />}

            {/* Booking card — mobile only, shown before facilities */}
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 lg:hidden">
              <BookingCard {...bookingCardProps} />
            </div>

            {/* Facilities */}
            {place.facilities?.length > 0 && (
              <div id="facilities-section">
                <InlineFacilitiesGrid facilities={place.facilities} accentColor={TEAL} />
              </div>
            )}

            {/* Activities */}
            {place.activities?.length > 0 && (
              <div id="activities-section">
                <InlineActivitiesGrid activities={place.activities} formatPrice={formatPrice} />
              </div>
            )}

            {/* Description — BELOW facilities and activities */}
            {place.description && (
              <section className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-slate-100">
                <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: TEAL }}>About this Place</h2>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{place.description}</p>
              </section>
            )}

            {/* Map — always open, with Google Maps link */}
            <AlwaysOpenMapSection
              name={place.name}
              latitude={place.latitude}
              longitude={place.longitude}
              location={place.location}
              country={place.country}
            />
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-24 bg-white rounded-2xl p-6 shadow-lg border border-slate-200 space-y-4">
              <BookingCard {...bookingCardProps} />
            </div>
          </div>
        </div>
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
          <Button onClick={handleCheckAvailability} className="px-6 py-5 rounded-xl text-sm font-bold text-white border-none"
            style={{ background: `linear-gradient(135deg, ${CORAL_LIGHT} 0%, ${CORAL} 100%)` }}>
            Check availability
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Booking card ─────────────────────────────────────────────────────────────
interface BookingCardProps {
  place: any; is24Hours: boolean; daysOpened: string[]; capacityPerDay: number | null;
  formatPrice: (n: number) => string;
  onCheckAvailability: () => void; onMap: () => void; onCopy: () => void; onShare: () => void;
}

const BookingCard = ({ place, is24Hours, daysOpened, capacityPerDay, formatPrice, onCheckAvailability, onMap, onCopy, onShare }: BookingCardProps) => (
  <>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">From</p>
      {place.entry_fee && place.entry_fee > 0 ? (
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black text-slate-900">{formatPrice(Number(place.entry_fee))}</span>
          <span className="text-sm text-slate-500">/ person</span>
        </div>
      ) : (
        <span className="text-xl font-bold text-emerald-600">Free Entry</span>
      )}
      {place.child_entry_fee > 0 && (
        <p className="text-sm text-slate-600 mt-0.5">Child: {formatPrice(Number(place.child_entry_fee))}</p>
      )}
    </div>

    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
          <Clock className="h-3 w-3" /> Hours
        </span>
        <span className="text-xs font-black text-slate-700">
          {is24Hours ? "Open 24 Hours" : `${place.opening_hours || "08:00"} – ${place.closing_hours || "18:00"}`}
        </span>
      </div>
      {daysOpened.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Available Days</p>
          <div className="flex flex-wrap gap-1">
            {daysOpened.map((day, i) => (
              <span key={i} className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase border"
                style={{ background: `${TEAL}12`, color: TEAL, borderColor: `${TEAL}30` }}>{day}</span>
            ))}
          </div>
        </div>
      )}
      {capacityPerDay != null && capacityPerDay > 0 && (
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
          <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
            <Users className="h-3 w-3" /> Daily Capacity
          </span>
          <span className="text-xs font-black text-slate-700">{capacityPerDay} guests</span>
        </div>
      )}
    </div>

    <Button onClick={onCheckAvailability} className="w-full py-6 rounded-xl text-sm font-bold text-white border-none shadow-md transition-all active:scale-95"
      style={{ background: `linear-gradient(135deg, ${CORAL_LIGHT} 0%, ${CORAL} 100%)` }}>
      Check availability
    </Button>

    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
      <UtilityButton icon={<Navigation className="h-4 w-4" />} label="Map" onClick={onMap} />
      <UtilityButton icon={<Copy className="h-4 w-4" />} label="Copy" onClick={onCopy} />
      <UtilityButton icon={<Share2 className="h-4 w-4" />} label="Share" onClick={onShare} />
    </div>
  </>
);

export default AdventurePlaceDetail; 