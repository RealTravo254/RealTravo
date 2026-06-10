import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Mail, Phone, Clock, ArrowLeft, CheckCircle2, XCircle,
  ShieldAlert, Users, Tag, Globe, Navigation, Ban, FileImage,
  ChevronLeft, ChevronRight, Grid2X2, Eye, ExternalLink, Zap,
  Copy, Share2, Landmark, Calendar, Info, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { approvalStatusSchema } from "@/lib/validation";
import { TealLoader } from "@/components/ui/teal-loader";

const TEAL        = "#008080";
const CORAL       = "#FF7F50";
const CORAL_LIGHT = "#FF9E7A";

// ── Facility label map ──────────────────────────────────────────────────────
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

// ── Image Gallery Modal ─────────────────────────────────────────────────────
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [images.length, onClose]);

  const modal = (
    <div
      style={{
        position: "fixed", inset: 0, background: "#000000",
        display: "flex", flexDirection: "column",
        zIndex: 2147483647,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>{name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700 }}>{current + 1} / {images.length}</span>
          <button
            onClick={onClose}
            aria-label="Close gallery"
            style={{
              width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.12)",
              border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 16, fontWeight: 700, transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
          >✕</button>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "0 48px" }}>
        <img key={current} src={images[current]} alt={`${name} ${current + 1}`}
          style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", borderRadius: 0, userSelect: "none", display: "block" }} />
        {images.length > 1 && (
          <>
            <button onClick={() => setCurrent((p) => (p - 1 + images.length) % images.length)}
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.10)", backdropFilter: "blur(4px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.20)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}>
              <ChevronLeft style={{ width: 20, height: 20, color: "#fff" }} />
            </button>
            <button onClick={() => setCurrent((p) => (p + 1) % images.length)}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.10)", backdropFilter: "blur(4px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.20)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}>
              <ChevronRight style={{ width: 20, height: 20, color: "#fff" }} />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div style={{ flexShrink: 0, padding: "10px 16px", overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ display: "flex", gap: 6, width: "max-content", margin: "0 auto" }}>
            {images.map((img, idx) => (
              <button key={idx} onClick={() => setCurrent(idx)}
                style={{
                  flexShrink: 0, width: 56, height: 42, padding: 0,
                  border: idx === current ? `2px solid ${CORAL}` : "2px solid rgba(255,255,255,0.22)",
                  borderRadius: 0, outline: "none", opacity: idx === current ? 1 : 0.5,
                  cursor: "pointer", overflow: "hidden", boxSizing: "border-box", transition: "opacity 0.15s, border-color 0.15s",
                }}>
                <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: 0 }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
};

// ── Desktop gallery grid ────────────────────────────────────────────────────
const DesktopGallery = ({ images, name }: { images: string[]; name: string }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState(0);
  const open = (idx: number) => { setModalStart(idx); setModalOpen(true); };
  if (!images.length) return null;
  return (
    <>
      {modalOpen && <ImageGalleryModal images={images} name={name} startIndex={modalStart} onClose={() => setModalOpen(false)} />}
      <div className="hidden md:block max-w-6xl mx-auto px-4 pt-4">
        <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gridTemplateRows: "200px 130px", gap: "3px", borderRadius: 0, overflow: "hidden", border: "2px solid rgba(0,0,0,0.08)" }}>
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

// ── Mobile carousel ─────────────────────────────────────────────────────────
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
    <div className="md:hidden w-full bg-slate-200 flex items-center justify-center text-slate-400 font-black uppercase text-xs" style={{ height: "45vh", minHeight: "200px", maxHeight: "360px" }}>
      No Image
    </div>
  );

  return (
    <>
      {modalOpen && <ImageGalleryModal images={images} name={name} startIndex={modalStart} onClose={() => setModalOpen(false)} />}
      <div className="md:hidden relative overflow-hidden bg-slate-900" style={{ height: "45vh", minHeight: "200px", maxHeight: "360px" }}>
        {images.map((img, idx) => (
          <img key={idx} src={img} alt={`${name} ${idx + 1}`}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            style={{ opacity: active === idx ? 1 : 0, borderRadius: 0 }} />
        ))}
        <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none z-10" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }} />
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
              <span key={idx} className="transition-all duration-300 block pointer-events-auto cursor-pointer" onClick={() => go(idx)}
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

// ── General Amenities ───────────────────────────────────────────────────────
const AmenitiesScroll = ({ amenities }: { amenities: string[] }) => {
  if (!amenities.length) return null;
  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: TEAL }}>General Amenities</h2>
      <div className="flex flex-wrap gap-1.5">
        {amenities.map((fId, i) => (
          <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-full border" style={{ background: `${TEAL}10`, borderColor: `${TEAL}30` }}>
            <CheckCircle2 className="h-2.5 w-2.5 flex-shrink-0" style={{ color: TEAL }} />
            <span className="text-[9px] font-bold uppercase tracking-tight whitespace-nowrap" style={{ color: TEAL }}>{facilityLabel(fId)}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

// ── FacSlideshow ────────────────────────────────────────────────────────────
const CARD_IMG_HEIGHT = 100;
const FacSlideshow = ({ images, name, height, onClick }: { images: string[]; name: string; height: number; onClick?: () => void }) => {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const iv = setInterval(() => setActive((p) => (p + 1) % images.length), 3000);
    return () => clearInterval(iv);
  }, [images.length]);
  return (
    <div className="relative overflow-hidden" style={{ height, borderRadius: 0, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      {images.map((img, idx) => (
        <img key={idx} src={img} alt={name}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: active === idx ? 1 : 0, borderRadius: 0 }} />
      ))}
      {images.length > 1 && (
        <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-0.5 pointer-events-none z-10">
          {images.map((_, idx) => (
            <span key={idx} className="transition-all duration-300 block"
              style={{ width: active === idx ? "10px" : "3px", height: "3px", borderRadius: "2px", background: active === idx ? "white" : "rgba(255,255,255,0.4)" }} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Facilities Grid ─────────────────────────────────────────────────────────
const InlineFacilitiesGrid = ({ facilities }: { facilities: any[] }) => {
  const [modalImages, setModalImages] = useState<string[] | null>(null);
  const [modalName, setModalName]     = useState("");
  const [modalStart, setModalStart]   = useState(0);
  const [showAll, setShowAll]         = useState(false);
  if (!facilities?.length) return null;

  const visibleFacilities = showAll ? facilities : facilities.slice(0, 6);
  const allFacilityImages: string[] = facilities.flatMap((f: any) =>
    Array.isArray(f.images) ? f.images.filter(Boolean) : []
  );
  const openCardGallery = (imgs: string[], name: string, startIdx = 0) => { setModalImages(imgs); setModalName(name); setModalStart(startIdx); };
  const openSectionGallery = () => { if (allFacilityImages.length > 0) { setModalImages(allFacilityImages); setModalName("All Facilities"); setModalStart(0); } };

  return (
    <>
      {modalImages && <ImageGalleryModal images={modalImages} name={modalName} startIndex={modalStart} onClose={() => setModalImages(null)} />}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black uppercase tracking-tight" style={{ color: TEAL }}>Facilities</h2>
          <div className="flex items-center gap-2">
            {allFacilityImages.length > 0 && (
              <button onClick={openSectionGallery}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all"
                style={{ color: TEAL, borderColor: `${TEAL}40`, background: `${TEAL}0D` }}>
                <Grid2X2 className="h-3 w-3" /> See All Photos
              </button>
            )}
            {facilities.length > 6 && (
              <button onClick={() => setShowAll((v) => !v)}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all"
                style={{ color: TEAL, borderColor: `${TEAL}40`, background: `${TEAL}0D` }}>
                {showAll ? "Show Less" : `All (${facilities.length})`}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {visibleFacilities.map((fac: any, i: number) => {
            const imgs: string[] = Array.isArray(fac.images) ? fac.images.filter(Boolean) : [];
            return (
              <div key={i} className="bg-white overflow-hidden shadow-sm border border-slate-100" style={{ borderRadius: 0 }}>
                {imgs.length > 0 ? (
                  <div className="relative overflow-hidden" style={{ height: CARD_IMG_HEIGHT, borderRadius: 0 }}>
                    <FacSlideshow images={imgs} name={fac.name} height={CARD_IMG_HEIGHT} onClick={() => openCardGallery(imgs, fac.name, 0)} />
                    {imgs.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); openCardGallery(imgs, fac.name, 0); }}
                        className="absolute top-1.5 right-1.5 z-20 flex items-center gap-0.5 bg-black/50 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full hover:bg-black/70 transition-all">
                        <Grid2X2 className="h-2 w-2" /> {imgs.length}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center bg-slate-100" style={{ height: CARD_IMG_HEIGHT }}>
                    <MapPin className="h-5 w-5 text-slate-300" />
                  </div>
                )}
                <div className="p-2">
                  <p className="font-black text-[11px] text-slate-800 uppercase tracking-tight leading-tight">{fac.name}</p>
                  {fac.capacity && <p className="text-[9px] text-slate-500 mt-0.5 flex items-center gap-0.5"><Users className="h-2.5 w-2.5" /> {fac.capacity}</p>}
                  {fac.price > 0 && <p className="text-[10px] font-bold mt-0.5" style={{ color: TEAL }}>KSh {fac.price?.toLocaleString()}</p>}
                  {Array.isArray(fac.amenities) && fac.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {fac.amenities.slice(0, 3).map((a: string, ai: number) => (
                        <span key={ai} className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${TEAL}12`, color: TEAL }}>{a}</span>
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

// ── Activity Card ───────────────────────────────────────────────────────────
const ActivityCard = ({ act, imgs, onImageClick }: { act: any; imgs: string[]; onImageClick?: () => void }) => {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (imgs.length <= 1) return;
    const iv = setInterval(() => setActive((p) => (p + 1) % imgs.length), 3200);
    return () => clearInterval(iv);
  }, [imgs.length]);
  return (
    <div className="bg-white overflow-hidden shadow-sm border border-slate-100" style={{ borderRadius: 0 }}>
      <div className="relative overflow-hidden" style={{ height: CARD_IMG_HEIGHT, borderRadius: 0, cursor: imgs.length > 0 ? "pointer" : "default" }} onClick={imgs.length > 0 ? onImageClick : undefined}>
        {imgs.length > 0
          ? imgs.map((img, idx) => (
              <img key={idx} src={img} alt={act.name}
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                style={{ opacity: active === idx ? 1 : 0, borderRadius: 0 }} />
            ))
          : <div className="absolute inset-0 bg-slate-200 flex items-center justify-center"><MapPin className="h-5 w-5 text-slate-300" /></div>}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)" }} />
        {imgs.length > 1 && (
          <button onClick={(e) => { e.stopPropagation(); onImageClick?.(); }}
            className="absolute top-1.5 right-1.5 z-20 flex items-center gap-0.5 bg-black/50 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full hover:bg-black/70 transition-all">
            <Grid2X2 className="h-2 w-2" /> {imgs.length}
          </button>
        )}
        {imgs.length > 1 && (
          <div className="absolute bottom-1 right-1.5 flex gap-0.5 z-20 pointer-events-none">
            {imgs.map((_, idx) => (
              <span key={idx} className="transition-all duration-300 block"
                style={{ width: active === idx ? "10px" : "3px", height: "3px", borderRadius: "2px", background: active === idx ? "white" : "rgba(255,255,255,0.4)" }} />
            ))}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="font-black text-[11px] text-slate-800 uppercase tracking-tight leading-tight">{act.name}</p>
        {act.price > 0
          ? <p className="text-[10px] font-bold mt-0.5" style={{ color: CORAL }}>KSh {Number(act.price).toLocaleString()}</p>
          : <p className="text-[10px] font-bold mt-0.5 text-emerald-600">Free</p>}
      </div>
    </div>
  );
};

// ── Activities Grid ─────────────────────────────────────────────────────────
const InlineActivitiesGrid = ({ activities }: { activities: any[] }) => {
  const [modalImages, setModalImages] = useState<string[] | null>(null);
  const [modalName, setModalName]     = useState("");
  const [modalStart, setModalStart]   = useState(0);
  const [showAll, setShowAll]         = useState(false);
  if (!activities?.length) return null;

  const visibleActivities = showAll ? activities : activities.slice(0, 6);
  const allActivityImages: string[] = activities.flatMap((a: any) =>
    Array.isArray(a.images) ? a.images.filter(Boolean) : []
  );
  const openCardGallery = (imgs: string[], name: string, startIdx = 0) => { setModalImages(imgs); setModalName(name); setModalStart(startIdx); };
  const openSectionGallery = () => { if (allActivityImages.length > 0) { setModalImages(allActivityImages); setModalName("All Activities"); setModalStart(0); } };

  return (
    <>
      {modalImages && <ImageGalleryModal images={modalImages} name={modalName} startIndex={modalStart} onClose={() => setModalImages(null)} />}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black uppercase tracking-tight" style={{ color: CORAL }}>Activities</h2>
          <div className="flex items-center gap-2">
            {allActivityImages.length > 0 && (
              <button onClick={openSectionGallery}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all"
                style={{ color: CORAL, borderColor: `${CORAL}40`, background: `${CORAL}0D` }}>
                <Grid2X2 className="h-3 w-3" /> See All Photos
              </button>
            )}
            {activities.length > 6 && (
              <button onClick={() => setShowAll((v) => !v)}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all"
                style={{ color: CORAL, borderColor: `${CORAL}40`, background: `${CORAL}0D` }}>
                {showAll ? "Show Less" : `All (${activities.length})`}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {visibleActivities.map((act: any, i: number) => {
            const imgs: string[] = Array.isArray(act.images) ? act.images.filter(Boolean) : [];
            return (
              <ActivityCard key={i} act={act} imgs={imgs}
                onImageClick={imgs.length > 0 ? () => openCardGallery(imgs, act.name, 0) : undefined} />
            );
          })}
        </div>
      </section>
    </>
  );
};

// ── Trip Highlights Tags ────────────────────────────────────────────────────
const HighlightsTags = ({ activities }: { activities: any[] }) => {
  if (!activities?.length) return null;
  const palettes = [
    { bg: "#FFF0EB", border: "#FFD5C2", text: "#C24D1A", dot: CORAL },
    { bg: "#E6F7F7", border: "#B2E4E4", text: "#006666", dot: TEAL },
    { bg: "#FFF8E6", border: "#FFE5A0", text: "#8A6200", dot: "#F0A500" },
    { bg: "#F0F4FF", border: "#C7D4FF", text: "#3A56C4", dot: "#5B7BE8" },
    { bg: "#F3F0FF", border: "#D4C9FF", text: "#5B3FC4", dot: "#7B5EE8" },
    { bg: "#EFFFF5", border: "#B6EDD0", text: "#1A7A45", dot: "#2DB461" },
  ];
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${CORAL}18` }}>
          <Zap className="h-3.5 w-3.5" style={{ color: CORAL }} />
        </div>
        <h2 className="text-base font-black uppercase tracking-tight" style={{ color: CORAL }}>Highlights</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {activities.map((act: any, i: number) => {
          const p = palettes[i % palettes.length];
          return (
            <div key={i} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:scale-[1.03] hover:shadow-sm"
              style={{ background: p.bg, borderColor: p.border }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.dot }} />
              <span className="text-[12px] font-black uppercase tracking-tight leading-none" style={{ color: p.text }}>{act.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Map Section ─────────────────────────────────────────────────────────────
const MapSection = ({
  name, latitude, longitude, location, country, mapLink,
}: {
  name: string; latitude?: number | null; longitude?: number | null; location?: string; country?: string; mapLink?: string;
}) => {
  const hasCoords = latitude != null && longitude != null;
  const coordMatch = mapLink?.match(/[?&]q=([-\d.]+),([-\d.]+)/);
  const searchQuery = encodeURIComponent([name, location, country].filter(Boolean).join(", "));
  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : mapLink || `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
  const embedUrl = hasCoords
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`
    : coordMatch
      ? `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&z=15&output=embed`
      : `https://maps.google.com/maps?q=${searchQuery}&z=13&output=embed`;

  return (
    <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" style={{ color: TEAL }} />
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight" style={{ color: TEAL }}>Location</h2>
            <p className="text-[10px] text-slate-400 font-medium">{[name, location, country].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[10px] font-bold transition-all hover:opacity-90 active:scale-95"
          style={{ background: `linear-gradient(135deg, ${TEAL}, #005f5f)` }}>
          <ExternalLink className="h-3 w-3" /> View on Google Maps
        </a>
      </div>
      <div style={{ height: "300px", position: "relative" }}>
        <iframe title={`Map of ${name}`} src={embedUrl} width="100%" height="100%"
          style={{ border: 0, display: "block" }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm shadow-md rounded-full px-3 py-1.5 pointer-events-none">
          <MapPin className="h-3 w-3" style={{ color: CORAL }} />
          <span className="text-[10px] font-black uppercase tracking-tight text-slate-700">{name}</span>
        </div>
      </div>
    </section>
  );
};

// ── Host Verification Status Banner ────────────────────────────────────────
const HostVerificationBanner = ({ hostVerification }: { hostVerification: any | null }) => {
  if (!hostVerification) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-2xl border-2 border-dashed border-red-200 bg-red-50">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-black uppercase tracking-tight text-red-700">Host Not Verified</p>
          <p className="text-xs text-red-500 mt-0.5">This host has no verification record. Adventure place cannot be approved for public view until host is verified.</p>
        </div>
      </div>
    );
  }
  const statusMap: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
    approved: { color: "#065f46", bg: "#ecfdf5", border: "#6ee7b7", icon: <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />, label: "Host Verified & Approved" },
    pending:  { color: "#92400e", bg: "#fffbeb", border: "#fcd34d", icon: <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />, label: "Host Verification Pending" },
    rejected: { color: "#991b1b", bg: "#fef2f2", border: "#fca5a5", icon: <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />, label: "Host Verification Rejected" },
  };
  const s = statusMap[hostVerification.status] ?? statusMap.pending;
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl border-2" style={{ background: s.bg, borderColor: s.border }}>
      {s.icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black uppercase tracking-tight" style={{ color: s.color }}>{s.label}</p>
        <p className="text-xs mt-0.5" style={{ color: s.color, opacity: 0.8 }}>
          Category: <span className="font-bold uppercase">{hostVerification.hosting_category || "—"}</span>
        </p>
        {hostVerification.status !== "approved" && (
          <p className="text-xs mt-1 font-semibold" style={{ color: s.color }}>
            ⚠ Adventure place cannot be approved for public view until host verification is approved.
          </p>
        )}
      </div>
    </div>
  );
};

// ── Admin Sidebar Card ──────────────────────────────────────────────────────
interface AdminCardProps {
  item: any;
  creator: any;
  isBanned: boolean;
  type: string;
  hostVerification: any | null;
  onOpenMaps: () => void;
  onApprove: () => void;
  onReject: () => void;
  onToggleBan: () => void;
}

const AdminSideCard = ({ item, creator, isBanned, type, hostVerification, onOpenMaps, onApprove, onReject, onToggleBan }: AdminCardProps) => {
  const isAdventure = type === "adventure" || type === "adventure_place";
  const price = item.entry_fee ?? item.price ?? item.price_adult ?? 0;
  const childPrice = item.child_entry_fee ?? item.price_child;
  const isApproved = item.approval_status === "approved";
  // Adventure places require host to be verified before approval
  const hostIsVerified = !isAdventure || (hostVerification?.status === "approved");
  const canApprove = !isApproved && hostIsVerified;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 space-y-4 lg:sticky lg:top-24">
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Approval Status</span>
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isApproved ? "bg-emerald-100 text-emerald-700" : item.approval_status === "rejected" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
          {item.approval_status || "Pending"}
        </span>
      </div>

      {/* Host verification status for adventure places */}
      {isAdventure && (
        <HostVerificationBanner hostVerification={hostVerification} />
      )}

      {/* Pricing */}
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{isAdventure ? "Entry Fee" : "Ticket Price"}</p>
        {price > 0
          ? <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-900">KSh {Number(price).toLocaleString()}</span>
              <span className="text-sm text-slate-500">/ {isAdventure ? "person" : "adult"}</span>
            </div>
          : <span className="text-xl font-bold text-emerald-600">Free Entry</span>}
        {childPrice != null && childPrice > 0 && (
          <p className="text-sm text-slate-600 mt-0.5">Child: KSh {Number(childPrice).toLocaleString()}</p>
        )}
      </div>

      {/* Hours & Days */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
        {(item.opening_hours || item.closing_hours) && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Hours</span>
            <span className="text-xs font-black text-slate-700">
              {item.opening_hours === "00:00" && item.closing_hours === "23:59"
                ? "Open 24 Hours"
                : `${item.opening_hours || "08:00"} – ${item.closing_hours || "18:00"}`}
            </span>
          </div>
        )}
        {Array.isArray(item.days_opened) && item.days_opened.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Available Days</p>
            <div className="flex flex-wrap gap-1">
              {item.days_opened.map((day: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase border"
                  style={{ background: `${TEAL}12`, color: TEAL, borderColor: `${TEAL}30` }}>{day}</span>
              ))}
            </div>
          </div>
        )}
        {item.date && (
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
            <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> Date</span>
            <span className="text-xs font-black text-slate-700">
              {item.is_custom_date
                ? <span className="text-emerald-600">Flexible</span>
                : new Date(item.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        )}
        {item.available_tickets != null && (
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
            <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Users className="h-3 w-3" /> Slots</span>
            <span className="text-xs font-black text-slate-700">{item.available_tickets} available</span>
          </div>
        )}
        {(item.daily_capacity ?? item.capacity_per_day ?? item.capacity) != null && (
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
            <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Users className="h-3 w-3" /> Daily Capacity</span>
            <span className="text-xs font-black text-slate-700">{item.daily_capacity ?? item.capacity_per_day ?? item.capacity} guests</span>
          </div>
        )}
      </div>

      {/* Submitter Info */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Submitter</p>
        <p className="text-sm font-black text-slate-800 uppercase">{creator?.name || "Unknown Host"}</p>
        {isBanned && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-black uppercase">
            <Ban className="h-3 w-3" /> Banned
          </span>
        )}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Mail className="h-3 w-3 text-teal-600" />
          <span>{item.email || creator?.email || "No Email"}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Phone className="h-3 w-3 text-teal-600" />
          <span>{item.phone_number || creator?.phone_number || "No Phone"}</span>
        </div>
      </div>

      {/* Utility buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
        <Button variant="ghost" onClick={onOpenMaps} className="flex-col h-auto py-2.5 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
          <Navigation className="h-4 w-4 mb-0.5" />
          <span className="text-[9px] font-bold uppercase">Verify Map</span>
        </Button>
        <Button variant="ghost" onClick={() => window.open(`/${type}/${item.id}`, "_blank")} className="flex-col h-auto py-2.5 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
          <Eye className="h-4 w-4 mb-0.5" />
          <span className="text-[9px] font-bold uppercase">Live View</span>
        </Button>
      </div>

      {/* Registration */}
      {item.registration_number && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
          <Landmark className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase">Reg / License No.</p>
            <p className="text-xs font-black text-slate-700">{item.registration_number}</p>
          </div>
        </div>
      )}

      {/* Approve — blocked if adventure host not verified */}
      <Button
        onClick={onApprove}
        disabled={!canApprove}
        title={!hostIsVerified ? "Host must be verified before approving this adventure place" : undefined}
        className="w-full py-6 rounded-xl text-sm font-bold text-white border-none shadow-md transition-all active:scale-95"
        style={{ background: canApprove ? `linear-gradient(135deg, #2dd4bf 0%, ${TEAL} 100%)` : "#94a3b8" }}
      >
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {isApproved ? "Already Approved" : !hostIsVerified ? "Verify Host First" : "Approve Entry"}
      </Button>

      {!isApproved && (
        <Button variant="ghost" onClick={onReject}
          className="w-full py-4 text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-xl">
          <XCircle className="mr-2 h-4 w-4" /> Reject Submission
        </Button>
      )}

      <Button variant="ghost" onClick={onToggleBan}
        className={`w-full py-4 text-xs font-black uppercase tracking-widest rounded-xl ${isBanned ? "text-green-600 hover:bg-green-50 border border-green-200" : "text-orange-500 hover:bg-orange-50 border border-orange-200"}`}>
        <Ban className="mr-2 h-4 w-4" />
        {isBanned ? "Unban User" : "Ban User"}
      </Button>
    </div>
  );
};

// ── Adventure Place Identity Panel ─────────────────────────────────────────
// Shows name, phone, registration number, TRA license prominently for admin review
const AdventureIdentityPanel = ({ item, creator }: { item: any; creator: any }) => {
  const registrationNumber = item.registration_number || creator?.registration_number;
  const traLicenseUrl = item.tra_license_url || creator?.tra_license_url;
  const name = creator?.name || item.contact_name || "Unknown Host";
  const phone = item.phone_number || creator?.phone_number;
  const email = item.email || creator?.email;

  return (
    <section className="bg-white rounded-2xl p-5 shadow-sm border-2 border-amber-200 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-50">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-tight text-amber-700">Adventure Place — Identity & Compliance</h2>
          <p className="text-[10px] text-slate-400 font-medium">Verify these details before approving</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Host Name */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Host / Contact Name</p>
          <p className="text-sm font-black text-slate-800 uppercase">{name}</p>
        </div>

        {/* Phone */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <Phone className="h-3 w-3" /> Phone Number
          </p>
          <p className="text-sm font-bold text-slate-700">{phone || "Not provided"}</p>
        </div>

        {/* Email */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <Mail className="h-3 w-3" /> Email Address
          </p>
          <p className="text-sm font-bold text-slate-700 break-all">{email || "Not provided"}</p>
        </div>

        {/* Registration Number */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <Landmark className="h-3 w-3" /> Registration / License No.
          </p>
          {registrationNumber
            ? <p className="text-sm font-black text-slate-800">{registrationNumber}</p>
            : <p className="text-sm text-slate-400 italic font-medium">Not provided</p>}
        </div>
      </div>

      {/* TRA License Image */}
      {traLicenseUrl ? (
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
            <FileImage className="h-3 w-3" /> TRA License / Permit
          </p>
          <div className="rounded-xl overflow-hidden border-2 border-amber-100 bg-slate-50">
            <img src={traLicenseUrl} alt="TRA License" className="w-full h-56 object-contain" />
          </div>
          <Button variant="link" className="mt-1 text-[10px] font-black uppercase text-teal-600 px-0"
            onClick={() => window.open(traLicenseUrl, "_blank")}>
            View Full Size →
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-xs font-bold text-red-500 uppercase tracking-wide">No TRA License uploaded</p>
        </div>
      )}
    </section>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────
const AdminReviewDetail = () => {
  const { itemType: type, id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [item, setItem]                       = useState<any>(null);
  const [creator, setCreator]                 = useState<any>(null);
  const [hostVerification, setHostVerification] = useState<any | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [isAdmin, setIsAdmin]                 = useState(false);
  const [isBanned, setIsBanned]               = useState(false);
  const [scrolled, setScrolled]               = useState(false);

  useEffect(() => { checkAdminStatus(); }, [user]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const checkAdminStatus = async () => {
    if (!user) { navigate("/auth"); return; }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const hasAdminRole = roles?.some((r) => r.role === "admin");
    if (!hasAdminRole) { toast({ title: "Access Denied", variant: "destructive" }); navigate("/"); return; }
    setIsAdmin(true);
    fetchItemDetails();
  };

  const fetchItemDetails = async () => {
    try {
      let itemData: any = null;
      let tableName = "";
      if (type === "trip" || type === "event") tableName = "trips";
      else if (type === "hotel") tableName = "hotels";
      else if (type === "adventure" || type === "adventure_place") tableName = "adventure_places";

      if (tableName) {
        const { data } = await supabase.from(tableName as "trips" | "hotels" | "adventure_places").select("*").eq("id", id).maybeSingle();
        itemData = data;
      }
      if (!itemData) { toast({ title: "Item not found", variant: "destructive" }); navigate("/admin"); return; }
      setItem({ ...itemData, type, tableName });

      if (itemData.created_by) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", itemData.created_by).maybeSingle();
        setCreator(profile);
        setIsBanned(profile?.is_banned || false);

        // Fetch host verification record for this creator
        const { data: verification } = await supabase
          .from("host_verifications")
          .select("*")
          .eq("user_id", itemData.created_by)
          .maybeSingle();
        setHostVerification(verification || null);
      }
    } catch {
      toast({ title: "Error loading item", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const updateApprovalStatus = async (status: string) => {
    try {
      // For adventure places, block approval if host is not verified
      const isAdventure = type === "adventure" || type === "adventure_place";
      if (isAdventure && status === "approved" && hostVerification?.status !== "approved") {
        toast({
          title: "Cannot Approve",
          description: "The host must be verified before this adventure place can be approved for public view.",
          variant: "destructive",
        });
        return;
      }

      const validatedStatus = approvalStatusSchema.parse(status);
      const { error } = await supabase.from(item.tableName).update({
        approval_status: validatedStatus,
        approved_by: validatedStatus === "approved" ? user?.id : null,
        approved_at: validatedStatus === "approved" ? new Date().toISOString() : null,
        is_hidden: validatedStatus === "approved" ? false : item.is_hidden,
      }).eq("id", id);
      if (error) throw error;
      toast({ title: `Item ${status} successfully` });
      navigate("/admin");
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const toggleBanUser = async () => {
    if (!item?.created_by) return;
    const newBanStatus = !isBanned;
    try {
      const { error } = await supabase.from("profiles").update({ is_banned: newBanStatus }).eq("id", item.created_by);
      if (error) throw error;
      setIsBanned(newBanStatus);
      toast({ title: newBanStatus ? "User Banned" : "User Unbanned" });
    } catch {
      toast({ title: "Failed to update ban status", variant: "destructive" });
    }
  };

  const openInMaps = () => {
    if (!item) return;
    const query = encodeURIComponent(`${item.name}, ${item.location || item.place || ""}`);
    const url = item.latitude && item.longitude
      ? `https://www.google.com/maps?q=${item.latitude},${item.longitude}`
      : item.map_link || item.location_link || `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, "_blank");
  };

  if (loading || !isAdmin || !item) return <TealLoader text="Loading review details..." />;

  const isAdventure = type === "adventure" || type === "adventure_place";
  const isTrip      = type === "trip" || type === "event";

  const facilityImgs = isAdventure
    ? (Array.isArray(item.facilities) ? item.facilities : []).flatMap((f: any) => Array.isArray(f.images) ? f.images : [])
    : [];
  const activityImgs = isAdventure
    ? (Array.isArray(item.activities) ? item.activities : []).flatMap((a: any) => Array.isArray(a.images) ? a.images : [])
    : [];
  const allImages = [
    item.image_url,
    ...(item.gallery_images || []),
    ...(item.images || []),
    ...facilityImgs,
    ...activityImgs,
    ...(item.photo_urls || []),
  ].filter(Boolean).filter((v: any, i: number, a: any[]) => a.indexOf(v) === i).slice(0, 12);

  const generalAmenities: string[] = isAdventure
    ? (Array.isArray(item.amenities) ? item.amenities.map((a: any) => typeof a === "string" ? a : a.name || "") : [])
    : [];

  const adminCardProps: AdminCardProps = {
    item, creator, isBanned, type: type || "",
    hostVerification,
    onOpenMaps: openInMaps,
    onApprove: () => updateApprovalStatus("approved"),
    onReject: () => updateApprovalStatus("rejected"),
    onToggleBan: toggleBanUser,
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header className="hidden md:block" />

      {/* Nav back bar */}
      <div
        className={`sticky top-0 z-[90] transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-transparent"}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-slate-700 hover:text-teal-600 transition-colors">
            <ArrowLeft className="h-5 w-5" /> Back to Admin
          </button>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white"
              style={{ background: CORAL }}>{type?.replace("_", " ")}</span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${item.approval_status === "approved" ? "bg-emerald-500 text-white" : item.approval_status === "rejected" ? "bg-red-500 text-white" : "bg-amber-400 text-white"}`}>
              {item.approval_status || "Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <MobileCarousel images={allImages} name={item.name} />
      <DesktopGallery images={allImages} name={item.name} />

      {/* Name + location */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-1 bg-background relative z-10">
        {isTrip && (
          <span className="inline-block mb-2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white" style={{ background: CORAL }}>Trip</span>
        )}
        <h1 className="text-2xl font-black uppercase tracking-tighter leading-tight text-foreground">{item.name}</h1>
        <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-sm font-semibold">{[item.place, item.location, item.country].filter(Boolean).join(", ")}</span>
        </div>
      </div>

      {/* Main content */}
      <main className="container px-4 mt-5 relative z-10 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr,1fr] gap-6">

          {/* ── Left column ── */}
          <div className="space-y-6">

            {/* Mobile admin card first */}
            <div className="lg:hidden">
              <AdminSideCard {...adminCardProps} />
            </div>

            {/* ── ADVENTURE PLACE: Identity & Compliance panel (always first) ── */}
            {isAdventure && (
              <AdventureIdentityPanel item={item} creator={creator} />
            )}

            {/* ── ADVENTURE PLACE SECTIONS ── */}
            {isAdventure && (
              <>
                {generalAmenities.length > 0 && <AmenitiesScroll amenities={generalAmenities} />}

                {item.facilities?.length > 0 && (
                  <div id="facilities-section">
                    <InlineFacilitiesGrid facilities={item.facilities} />
                  </div>
                )}

                {item.activities?.length > 0 && (
                  <div id="activities-section">
                    <InlineActivitiesGrid activities={item.activities} />
                  </div>
                )}
              </>
            )}

            {/* ── TRIP SECTIONS ── */}
            {isTrip && (
              <>
                {item.activities?.length > 0 && <HighlightsTags activities={item.activities} />}

                {((item.inclusions?.length > 0) || (item.exclusions?.length > 0)) && (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <h2 className="text-base font-black uppercase tracking-tight mb-4" style={{ color: TEAL }}>Package Details</h2>
                    <div className="grid grid-cols-2 gap-6">
                      {item.inclusions?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-2">✓ Included</p>
                          <ul className="space-y-1.5">
                            {item.inclusions.map((inc: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-emerald-700"><span className="text-emerald-500 mt-0.5">✓</span><span>{inc}</span></li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {item.exclusions?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-2">✗ Not Included</p>
                          <ul className="space-y-1.5">
                            {item.exclusions.map((exc: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-red-600"><span className="text-red-400 mt-0.5">✗</span><span>{exc}</span></li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h2 className="text-base font-black uppercase tracking-tight mb-4" style={{ color: TEAL }}>Trip Details</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                      <span className="text-slate-400">Children</span>
                      <span className={item.allow_children === false ? "text-red-500" : "text-emerald-600"}>
                        {item.allow_children === false ? "Not Allowed" : "Allowed"}
                      </span>
                    </div>
                    {item.allow_children !== false && item.price_child != null && (
                      <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                        <span className="text-slate-400">Child Price (Under 12)</span>
                        <span className="text-slate-700">KSh {Number(item.price_child).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-start text-xs font-bold uppercase tracking-tight gap-2">
                      <span className="text-slate-400 flex items-center gap-1 flex-shrink-0"><Navigation className="h-3 w-3" /> Pickup</span>
                      {item.pickup_location
                        ? <span className="text-slate-700 text-right normal-case font-semibold max-w-[60%] leading-snug capitalize">{item.pickup_location}</span>
                        : <span className="text-slate-400 italic font-semibold normal-case">Not Available</span>}
                    </div>
                    {item.ticket_types?.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Ticket Types</p>
                        {item.ticket_types.map((ticket: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs font-bold uppercase tracking-tight py-0.5">
                            <span className="text-slate-500">{ticket.name}</span>
                            <span className="text-slate-700">KSh {Number(ticket.price).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Description */}
            {item.description && (
              <section className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-slate-100">
                <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: TEAL }}>
                  {isAdventure ? "About this Place" : "About this Trip"}
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{item.description}</p>
              </section>
            )}

            {/* Map */}
            <MapSection
              name={item.name}
              latitude={item.latitude}
              longitude={item.longitude}
              location={item.location}
              country={item.country}
              mapLink={item.map_link || item.location_link}
            />

            {/* Admin-only: Full submitter info panel */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h2 className="text-base font-black uppercase tracking-tight mb-4" style={{ color: TEAL }}>Submitter Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Contact Name</p>
                  <p className="text-sm font-black uppercase">{creator?.name || "Unknown Host"}</p>
                  {isBanned && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-black uppercase">
                      <Ban className="h-3 w-3" /> Banned
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Email</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Mail className="h-3 w-3 text-teal-600" />
                    <p className="text-xs font-bold">{item.email || creator?.email || "No Email"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Phone</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Phone className="h-3 w-3 text-teal-600" />
                    <p className="text-xs font-bold">{item.phone_number || creator?.phone_number || "No Phone"}</p>
                  </div>
                </div>
              </div>
              {item.registration_number && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Reg / License No.</p>
                    <p className="text-sm font-black">{item.registration_number}</p>
                  </div>
                </div>
              )}
            </section>

            {/* Event Certificate */}
            {item.event_certificate_url && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h2 className="text-sm font-black uppercase tracking-tight mb-4 flex items-center gap-2" style={{ color: TEAL }}>
                  <FileImage className="h-4 w-4" /> Event Certificate / Permit
                </h2>
                <div className="rounded-xl overflow-hidden border-2 border-slate-100">
                  <img src={item.event_certificate_url} alt="Event Certificate" className="w-full h-64 object-contain bg-slate-50" />
                </div>
                <Button variant="link" className="mt-2 text-[10px] font-black uppercase text-teal-600"
                  onClick={() => window.open(item.event_certificate_url, "_blank")}>View Full Size →</Button>
              </div>
            )}

            {/* TRA License (non-adventure, if present at item level) */}
            {!isAdventure && item.tra_license_url && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h2 className="text-sm font-black uppercase tracking-tight mb-4 flex items-center gap-2" style={{ color: TEAL }}>
                  <FileImage className="h-4 w-4" /> TRA License
                </h2>
                <div className="rounded-xl overflow-hidden border-2 border-slate-100">
                  <img src={item.tra_license_url} alt="TRA License" className="w-full h-64 object-contain bg-slate-50" />
                </div>
                <Button variant="link" className="mt-2 text-[10px] font-black uppercase text-teal-600"
                  onClick={() => window.open(item.tra_license_url, "_blank")}>View Full Size →</Button>
              </div>
            )}
          </div>

          {/* ── Right column: Admin card, desktop only ── */}
          <div className="hidden lg:block">
            <AdminSideCard {...adminCardProps} />
          </div>
        </div>
      </main>

      {/* Mobile bottom admin bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-black/90 backdrop-blur-xl border-t border-white/10 shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: "#F59E0B" }}>
              <ShieldAlert className="h-4 w-4 text-black" />
            </div>
            <div>
              <p className="text-[8px] font-black text-white/50 uppercase tracking-widest">Admin Review</p>
              <p className="text-[10px] font-black text-white uppercase tracking-tight">{item.approval_status || "Pending"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateApprovalStatus("approved")}
              className="h-9 rounded-xl text-[10px] font-black px-4 border-none text-white"
              style={{ background: `linear-gradient(135deg, #2dd4bf 0%, ${TEAL} 100%)` }}>APPROVE</Button>
            <Button size="sm" variant="destructive" onClick={() => updateApprovalStatus("rejected")}
              className="h-9 rounded-xl text-[10px] font-black px-4">REJECT</Button>
          </div>
        </div>
      </div>

      <MobileBottomBar />
    </div>
  );
};

export default AdminReviewDetail;