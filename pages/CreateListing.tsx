import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { HostLayout } from "@/components/host/HostLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBanCheck } from "@/hooks/useBanCheck";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { OperatingHoursSection } from "@/components/creation/OperatingHoursSection";
import { ReviewStep } from "@/components/creation/ReviewStep";
import { GeneralFacilitiesSelector } from "@/components/creation/GeneralFacilitiesSelector";
import { compressImages } from "@/lib/imageCompression";
import { approvalStatusSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";
import {
  MapPin, Navigation, Clock, X, Plus, Minus, Camera, CheckCircle2, Info, ArrowLeft, Loader2,
  DollarSign, Calendar, ChevronLeft, ChevronRight, Link2, ShieldCheck, FileImage, Upload, Star,
  Globe, Sparkles, Tent, BedDouble, Home, Building2, UserRound, Map as MapIcon, Ticket, Ban,
} from "lucide-react";

/**
 * ── CreateListing — ONE page for every kind of hosting ───────────────────
 * Route:  <Route path="/host/create" element={<CreateListing />} />
 * (the old /create-trip, /create-event, /create-adventure, /create-hotel and
 *  /create-airbnb routes can simply redirect here: /host/create?type=trip …)
 *
 * A host only ever sees what they are verified for:
 *   • approved guide verification   → Trip / Tour
 *   • approved company verification → Trip / Tour + Event
 *   • otherwise (adventure hosts)   → first listing: Campsite, Hotel or Airbnb.
 *       – approved campsite / Airbnb hosts can keep adding that same kind
 *       – a hotel host is capped at one listing (goes to /my-listing)
 *       – a pending listing blocks new submissions until it is reviewed
 *
 * DB columns required (same as before):
 *   trips:            division_id uuid, registration_name text,
 *                     registration_number text, registration_type text
 *   adventure_places: division_id uuid, registration_type text, star_rating int,
 *                     cancellation_policy text, registration_name text (airbnb)
 *   host_verifications: host_type / registration_name / registration_number (optional)
 * ────────────────────────────────────────────────────────────────────────── */

// ─── Constants & helpers ──────────────────────────────────────────────────────
const COLORS = { TEAL: "#008080", CORAL: "#FF7F50", CORAL_LIGHT: "#FF9E7A", KHAKI: "#F0E68C", KHAKI_DARK: "#857F3E" };
const db = supabase as any;

type Kind = "trip" | "event" | "campsite" | "hotel" | "airbnb";

const KIND_META: Record<Kind, { label: string; desc: string; icon: any }> = {
  trip: { label: "Trip / Tour", desc: "Guided trips with flexible or fixed dates.", icon: MapIcon },
  event: { label: "Event", desc: "A fixed-date event with tickets.", icon: Ticket },
  campsite: { label: "Outdoor / Campsite", desc: "A campsite or outdoor place. Add more once approved.", icon: Tent },
  hotel: { label: "Hotel", desc: "A hotel with room types. One hotel per account.", icon: BedDouble },
  airbnb: { label: "Airbnb / BnB", desc: "A single bookable property. Add more once approved.", icon: Home },
};

const generateFriendlySlug = (name: string): string => {
  const clean = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").substring(0, 30);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${clean}-${code}`;
};
let _idCounter = 0;
const makeId = () => `item-${Date.now()}-${++_idCounter}`;
const safeObjectUrl = (file: File): string => { try { return URL.createObjectURL(file); } catch { return ""; } };
const isImageFile = (file: File) => file.type.startsWith("image/");
const namesClash = (a: string, b: string) => !!a.trim() && !!b.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();
const wordsOf = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

const EVENT_CATEGORIES = [
  "Roadtrips", "Music Events", "Children Events", "Pool Party", "Outdoor", "Cultural Events", "Food",
  "Training", "Dancing Events", "Educational", "Religious Events", "Night Parties", "Charity Events", "Others",
];
const BED_TYPES = ["Single", "Double", "Queen", "King", "Twin", "Bunk"];
const CHECK_TIMES = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
const PROPERTY_TYPES = [
  "Entire apartment", "Entire house", "Villa", "Cottage", "Cabin",
  "Studio", "Guesthouse", "Private room", "Treehouse", "Tent / Glamping",
];
const DURATION_PRESETS = [1, 2, 3, 4, 6, 12, 24];
const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Per-country ID format for individual guides.
const GUIDE_ID_HINTS: Record<string, { label: string; placeholder: string; pattern?: RegExp; hint: string }> = {
  Kenya: { label: "National ID Number", placeholder: "e.g. 23456789", pattern: /^\d{7,8}$/, hint: "7–8 digit Kenyan National ID number" },
  Uganda: { label: "National ID Number (NIN)", placeholder: "e.g. CM12345678ABC1", pattern: /^[A-Za-z0-9]{14}$/, hint: "14-character Ugandan NIN" },
  Tanzania: { label: "NIDA Number", placeholder: "e.g. 19850101-12345-00001-23", pattern: /^\d{8}-\d{5}-\d{5}-\d{2}$/, hint: "Tanzanian NIDA number" },
  Rwanda: { label: "National ID Number", placeholder: "e.g. 1198000000000000", pattern: /^\d{16}$/, hint: "16-digit Rwandan National ID" },
  Nigeria: { label: "National Identification Number (NIN)", placeholder: "e.g. 12345678901", pattern: /^\d{11}$/, hint: "11-digit Nigerian NIN" },
  "South Africa": { label: "National ID Number", placeholder: "e.g. 8001015009087", pattern: /^\d{13}$/, hint: "13-digit South African ID number" },
};
const DEFAULT_GUIDE_ID_HINT = { label: "Government ID / Passport Number", placeholder: "e.g. A1234567", hint: "A government-issued ID or passport number" };
const getGuideIdInfo = (country: string) => GUIDE_ID_HINTS[country] || (DEFAULT_GUIDE_ID_HINT as any);

const regNumberError = (type: string, name: string, number: string, country: string, skipPattern = false): string | null => {
  if (!number.trim()) return type === "guide" ? "Please enter your ID number." : "Please enter your company registration number.";
  if (namesClash(name, number))
    return type === "guide"
      ? "Your ID number can't be the same as your registration name."
      : "Your registration number can't be the same as your registration name.";
  if (type === "guide" && !skipPattern) {
    const info = getGuideIdInfo(country);
    if (info.pattern && !info.pattern.test(number.trim())) return `Please enter a valid ${info.label.toLowerCase()} (${info.hint}).`;
  }
  return null;
};

// Compress + merge a FileList into an existing array of images.
const mergeImages = async (existing: File[], list: FileList | null, max: number, onReject: (m: string) => void): Promise<File[] | null> => {
  if (!list || list.length === 0) return null;
  const slots = max - existing.length;
  if (slots <= 0) return null;
  const incoming = Array.from(list).slice(0, slots);
  if (incoming.some((f) => !isImageFile(f))) { onReject("Only image files (JPG, PNG) are accepted."); return null; }
  try {
    const c = await compressImages(incoming);
    return [...existing, ...c.map((x) => x.file)].slice(0, max);
  } catch {
    return [...existing, ...incoming].slice(0, max);
  }
};

// ─── Hooks ────────────────────────────────────────────────────────────────────
const useImages = (max: number) => {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const add = async (list: FileList | null, replace = false) => {
    const base = replace ? [] : files;
    setCompressing(true);
    const merged = await mergeImages(base, list, max, (m) => toast({ title: "File type not supported", description: m, variant: "destructive" }));
    setCompressing(false);
    if (!merged) return;
    setFiles(merged);
    setPreviews(merged.map(safeObjectUrl));
  };
  const remove = (i: number) => {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    setPreviews(next.map(safeObjectUrl));
  };
  return { files, previews, compressing, add, remove };
};

// Country + division ids (CountrySelector is ID-based) resolved to plain names.
const useCountry = (user: any) => {
  const [countryId, setCountryId] = useState<string | null>(null);
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  const [place, setPlace] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("country").eq("id", user.id).single().then(async ({ data }: any) => {
      if (!data?.country) return;
      const { data: row } = await supabase.from("countries").select("id").ilike("name", data.country).maybeSingle();
      if (row?.id) setCountryId(row.id);
      else setCountry(data.country);
    });
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!countryId) { setCountry(""); return; }
    (async () => {
      const { data } = await supabase.from("countries").select("name").eq("id", countryId).maybeSingle();
      if (!cancelled && data?.name) setCountry(data.name);
    })();
    return () => { cancelled = true; };
  }, [countryId]);

  useEffect(() => {
    let cancelled = false;
    if (!divisionId) { setPlace(""); return; }
    (async () => {
      const { data } = await supabase.from("country_divisions").select("name").eq("id", divisionId).maybeSingle();
      if (!cancelled && data?.name) setPlace(data.name);
    })();
    return () => { cancelled = true; };
  }, [divisionId]);

  return { countryId, divisionId, country, place, setCountryId, setDivisionId };
};

// What is this host allowed to create?
type VerifiedHost = { type: "company" | "guide"; name: string; number: string };
type Access =
  | { state: "loading" }
  | { state: "banned" }
  | { state: "blocked"; title: string; message: string; cta?: { label: string; to: string } }
  | { state: "ready"; kinds: Kind[]; host?: VerifiedHost; canVerify: boolean };

const useHostAccess = (user: any, navigate: (to: string) => void): Access => {
  const [access, setAccess] = useState<Access>({ state: "loading" });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: profile } = await db.from("profiles").select("profile_completed, is_banned").eq("id", user.id).single();
        if (cancelled) return;
        if (profile?.is_banned) { setAccess({ state: "banned" }); return; }
        if (profile && !profile.profile_completed) { navigate("/complete-profile"); return; }

        const [{ data: ver }, { data: comp }] = await Promise.all([
          db.from("host_verifications").select("*").eq("user_id", user.id).maybeSingle(),
          db.from("companies").select("verification_status").eq("user_id", user.id).maybeSingle(),
        ]);
        if (cancelled) return;

        const guideApproved = ver?.status === "approved" && ver?.hosting_category !== "adventure";
        const companyApproved = comp?.verification_status === "approved";

        // ── Verified guide / company → trips (+ events for companies) ──
        if (guideApproved || companyApproved) {
          const raw = String(ver?.host_type ?? ver?.registration_type ?? ver?.hosting_category ?? "").toLowerCase();
          const type: "company" | "guide" = companyApproved || raw === "company" ? "company" : "guide";
          setAccess({
            state: "ready",
            kinds: type === "company" ? ["trip", "event"] : ["trip"],
            host: { type, name: ver?.registration_name ?? "", number: ver?.registration_number ?? "" },
            canVerify: false,
          });
          return;
        }

        // ── Adventure hosts (campsite / hotel / Airbnb) ──
        const { data: places } = await db.from("adventure_places").select("id, category, approval_status").eq("created_by", user.id);
        if (cancelled) return;
        const list: any[] = places ?? [];
        const status = (p: any) => String(p.approval_status ?? "").toLowerCase().trim();
        const approved = list.filter((p) => status(p) === "approved");
        const pending = list.filter((p) => status(p) !== "approved" && status(p) !== "rejected");

        if (approved.length === 0 && pending.length > 0) {
          setAccess({
            state: "blocked",
            title: "Your listing is under review",
            message: "You can't submit another listing while one is being reviewed. We'll notify you once it goes live (usually 24–48 hours).",
            cta: { label: "View my listing", to: "/become-host" },
          });
          return;
        }
        if (approved.length > 0) {
          const cats = Array.from(new Set(approved.map((p) => p.category))) as string[];
          if (cats.includes("hotel") || cats.some((c) => c !== "campsite" && c !== "airbnb")) {
            setAccess({
              state: "blocked",
              title: "One listing per account",
              message: "Hotel hosts are limited to a single listing. You can edit it from My listing.",
              cta: { label: "Go to my listing", to: "/my-listing" },
            });
            return;
          }
          setAccess({ state: "ready", kinds: cats as Kind[], canVerify: false });
          return;
        }
        // First listing (nothing yet, or only rejected ones)
        setAccess({ state: "ready", kinds: ["campsite", "hotel", "airbnb"], canVerify: true });
      } catch (err) {
        console.error(err);
        setAccess({ state: "blocked", title: "Something went wrong", message: "We couldn't check your hosting access. Please refresh and try again." });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return access;
};

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
    {children}{required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

const StyledInput = ({ className = "", isInvalid = false, ...props }: React.ComponentProps<typeof Input> & { isInvalid?: boolean }) => (
  <Input
    className={`h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080] transition-all disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${isInvalid ? "border-red-400 ring-2 ring-red-100 bg-red-50" : ""} ${className}`}
    {...props}
  />
);

const ErrText = ({ children }: { children: React.ReactNode }) => (
  <p className="text-red-500 text-[10px] font-semibold mt-1">{children}</p>
);

const SectionCard = ({ title, subtitle, icon: Icon, children, accent = COLORS.TEAL }: {
  title?: string; subtitle?: string; icon?: any; children: React.ReactNode; accent?: string;
}) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
    {title && (
      <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex items-center gap-3">
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}12` }}>
            <Icon className="h-4 w-4" style={{ color: accent }} />
          </div>
        )}
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    )}
    <div className="px-6 sm:px-8 py-6">{children}</div>
  </div>
);

const CompressingBanner = ({ label = "Compressing photos…" }: { label?: string }) => (
  <div className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-xl">
    <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
    <p className="text-teal-700 text-xs font-semibold">{label}</p>
  </div>
);

const OptionTiles = ({ options, value, onChange, cols = "grid-cols-2 lg:grid-cols-3" }: {
  options: string[]; value: string; onChange: (v: string) => void; cols?: string;
}) => (
  <div className={`grid ${cols} gap-2`}>
    {options.map((o) => (
      <button key={o} type="button" onClick={() => onChange(o)}
        className={`px-3 py-2.5 rounded-xl text-[11px] font-bold text-center transition-all ${value === o ? "text-white shadow-md" : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100"}`}
        style={value === o ? { background: COLORS.TEAL } : {}}>
        {o}
      </button>
    ))}
  </div>
);

const Counter = ({ label, value, onChange, min = 0, max = 50 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) => (
  <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white">
    <span className="text-sm font-bold text-slate-700">{label}</span>
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
      <span className="w-6 text-center text-sm font-black text-slate-800">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
    </div>
  </div>
);

const ImageGalleryGrid = ({ previews, onRemove, onAdd, isInvalid, slots = 5 }: {
  previews: string[]; onRemove: (i: number) => void; onAdd: (files: FileList | null) => void; isInvalid?: boolean; slots?: number;
}) => (
  <div className={`grid gap-3 p-4 rounded-xl border-2 border-dashed transition-all ${isInvalid ? "border-red-400 bg-red-50/30" : "border-slate-200 bg-slate-50/40"}`}
    style={{ gridTemplateColumns: `repeat(${Math.min(slots, 5)}, minmax(0, 1fr))` }}>
    {Array.from({ length: slots }).map((_, i) => {
      const url = previews[i];
      if (url) return (
        <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <img src={url} className="w-full h-full object-cover" alt={`Photo ${i + 1}`} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
            <button type="button" onClick={() => onRemove(i)} className="opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-1 shadow-lg transition-all scale-75 group-hover:scale-100"><X className="h-3 w-3" /></button>
          </div>
          <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">{i === 0 ? "Cover" : `#${i + 1}`}</div>
        </div>
      );
      return (
        <label key={i} className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-slate-100 ${isInvalid ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-slate-300"}`}>
          <Camera className={`h-5 w-5 mb-1 ${isInvalid ? "text-red-400" : "text-slate-300"}`} />
          <span className={`text-[9px] font-bold uppercase ${isInvalid ? "text-red-400" : "text-slate-300"}`}>{i === 0 ? "Cover" : `#${i + 1}`}</span>
          <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
        </label>
      );
    })}
  </div>
);

// Single-image document upload (TRA licence / event certificate)
const DocumentUpload = ({ title, hint, img, isInvalid, requiredNote = "Required" }: {
  title: string; hint: string; img: ReturnType<typeof useImages>; isInvalid?: boolean; requiredNote?: string;
}) => {
  const file = img.files[0];
  const preview = img.previews[0];
  return (
    <div className="mt-6 pt-6 border-t border-slate-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#008080,#005f5f)" }}>
          <ShieldCheck className="h-[18px] w-[18px] text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-800 tracking-tight">{title}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>
        </div>
        <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-full">{requiredNote}</span>
      </div>
      {img.compressing && <CompressingBanner label="Compressing image…" />}
      {preview ? (
        <div className={`rounded-2xl overflow-hidden border-2 ${isInvalid ? "border-red-300" : "border-teal-200"}`} style={{ background: "linear-gradient(135deg,#f0fdfa,#e6fffa)" }}>
          <div className="flex items-center gap-4 p-4">
            <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-teal-200 shadow-md"><img src={preview} alt={title} className="w-full h-full object-cover" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" /><span className="text-sm font-black text-teal-700">Uploaded</span></div>
              <p className="text-[11px] text-teal-600 truncate font-medium">{file?.name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{file ? `${(file.size / 1024).toFixed(0)} KB` : ""}</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700 border border-teal-300 bg-white rounded-lg px-3 py-1.5 cursor-pointer hover:bg-teal-50">
                <Upload className="h-3 w-3" /> Replace
                <input type="file" className="hidden" accept="image/*" onChange={(e) => { img.add(e.target.files, true); e.target.value = ""; }} />
              </label>
              <button type="button" onClick={() => img.remove(0)} className="flex items-center gap-1.5 text-[11px] font-bold text-red-500 border border-red-200 bg-white rounded-lg px-3 py-1.5 hover:bg-red-50"><X className="h-3 w-3" /> Remove</button>
            </div>
          </div>
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#008080,#00b3b3)" }} />
        </div>
      ) : (
        <label className={cn("flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all py-9 px-6 group",
          isInvalid ? "border-red-300 bg-red-50/40 hover:bg-red-50" : "border-slate-200 bg-slate-50/50 hover:border-teal-400 hover:bg-teal-50/30")}>
          <FileImage className={cn("h-7 w-7", isInvalid ? "text-red-400" : "text-slate-400 group-hover:text-teal-600")} />
          <div className="text-center">
            <p className={cn("text-sm font-bold", isInvalid ? "text-red-500" : "text-slate-600 group-hover:text-teal-700")}>{isInvalid ? `${title} is required` : `Upload ${title}`}</p>
            <p className="text-[11px] text-slate-400">JPG or PNG only</p>
          </div>
          <div className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold text-white", isInvalid ? "bg-red-500" : "bg-[#008080] group-hover:bg-[#005f5f]")}><Upload className="h-3.5 w-3.5" /> Choose image</div>
          <input type="file" className="hidden" accept="image/*" onChange={(e) => { img.add(e.target.files, true); e.target.value = ""; }} />
        </label>
      )}
      <div className="mt-3 flex items-start gap-2 px-1">
        <Info className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
        <p className="text-[10px] text-slate-400 leading-relaxed">Used for verification only.</p>
      </div>
    </div>
  );
};

const TagInput = ({ tags, input, onInputChange, onAdd, onRemove, hasError, placeholder }: {
  tags: string[]; input: string; onInputChange: (v: string) => void; onAdd: () => void; onRemove: (i: number) => void; hasError?: boolean; placeholder?: string;
}) => (
  <div className={cn("min-h-[44px] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-xl border bg-white transition-all",
    hasError ? "border-red-400 ring-2 ring-red-100" : "border-slate-200 focus-within:ring-2 focus-within:ring-[#008080]/20 focus-within:border-[#008080]")}>
    {tags.map((tag, i) => (
      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold" style={{ background: `${COLORS.TEAL}10`, color: COLORS.TEAL }}>
        {tag}<button type="button" onClick={() => onRemove(i)} className="hover:text-red-500"><X className="h-2.5 w-2.5" /></button>
      </span>
    ))}
    <input value={input} onChange={(e) => onInputChange(e.target.value)} onBlur={onAdd}
      onKeyDown={(e) => {
        if (e.key === "," || e.key === "Enter") { e.preventDefault(); onAdd(); }
        if (e.key === "Backspace" && !input && tags.length > 0) onRemove(tags.length - 1);
      }}
      placeholder={tags.length === 0 ? placeholder ?? "Type, press comma to add…" : "Add more…"}
      className="flex-1 min-w-[120px] text-sm font-medium outline-none bg-transparent placeholder:text-slate-300 placeholder:font-normal" />
  </div>
);

// Company / Individual selector
const RegistrationTypeSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="grid grid-cols-2 gap-2.5 p-1 max-w-sm">
    {[{ value: "company", label: "Company", icon: Building2 }, { value: "guide", label: "Individual / Guide", icon: UserRound }].map((opt) => {
      const active = value === opt.value;
      return (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={cn("flex flex-col items-center justify-center gap-1.5 h-20 rounded-xl text-[11px] font-bold border transition-all",
            active ? "text-white shadow-md border-transparent scale-[1.02]" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}
          style={active ? { background: COLORS.TEAL } : {}}>
          <opt.icon className={cn("h-5 w-5", active ? "text-white" : "text-slate-400")} />{opt.label}
        </button>
      );
    })}
  </div>
);

const VerifiedBadge = ({ type }: { type: "company" | "guide" }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 max-w-sm">
    {type === "company" ? <Building2 className="h-5 w-5 text-emerald-600" /> : <UserRound className="h-5 w-5 text-emerald-600" />}
    <div>
      <p className="text-sm font-bold text-emerald-700">{type === "company" ? "Company" : "Individual / Guide"}</p>
      <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Verified host</p>
    </div>
  </div>
);

// Registration block: type, name, number, country (+ division)
const RegistrationSection = ({
  title, subtitle, showTypeSelector, verified, regType, setRegType, name, setName, number, setNumber,
  geo, errors, nameLabel, skipPattern, children,
}: {
  title: string; subtitle: string; showTypeSelector: boolean; verified?: VerifiedHost; regType: string; setRegType: (v: string) => void;
  name: string; setName: (v: string) => void; number: string; setNumber: (v: string) => void;
  geo: ReturnType<typeof useCountry>; errors: { name: boolean; number: boolean; country: boolean }; nameLabel?: string; skipPattern?: boolean; children?: React.ReactNode;
}) => {
  const numErr = regNumberError(regType, name, number, geo.country, skipPattern);
  const guide = regType === "guide";
  return (
    <SectionCard title={title} subtitle={subtitle} icon={Info}>
      <div className="grid gap-5">
        {(verified || showTypeSelector) && (
          <div>
            <FieldLabel required>Registering as</FieldLabel>
            {verified ? <VerifiedBadge type={verified.type} /> : <RegistrationTypeSelector value={regType} onChange={setRegType} />}
          </div>
        )}
        <div>
          <FieldLabel required>{nameLabel ?? "Registration name"}</FieldLabel>
          <StyledInput value={name} disabled={!!verified?.name} onChange={(e) => setName(e.target.value)}
            placeholder={guide ? "Your full legal name" : "Official business / company name"}
            isInvalid={errors.name || (errors.number && namesClash(name, number))} />
          {errors.name && <ErrText>⚠ Registration name is required</ErrText>}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <FieldLabel required>{guide ? getGuideIdInfo(geo.country).label : "Company registration number"}</FieldLabel>
            <StyledInput value={number} disabled={!!verified?.number} onChange={(e) => setNumber(e.target.value)}
              placeholder={guide ? getGuideIdInfo(geo.country).placeholder : "e.g. BN-X12345"} isInvalid={errors.number} />
            {guide && !verified && <p className="text-[10px] text-slate-400 mt-1">{getGuideIdInfo(geo.country).hint}</p>}
            {errors.number && <ErrText>{numErr || "⚠ This field is required"}</ErrText>}
          </div>
          <div>
            <FieldLabel required>Country</FieldLabel>
            <div className={cn("rounded-xl", errors.country && "ring-2 ring-red-300")}>
              <CountrySelector countryId={geo.countryId} divisionId={geo.divisionId}
                onChange={({ countryId, divisionId }: any) => { geo.setCountryId(countryId); geo.setDivisionId(divisionId); }} />
            </div>
            {errors.country && <ErrText>⚠ Country is required</ErrText>}
            <p className="text-[10px] text-slate-400 mt-1">Picking a division/region helps guests find you when browsing by region.</p>
          </div>
        </div>
        {children}
      </div>
    </SectionCard>
  );
};

// Map link or GPS
const LocationPicker = ({ latitude, longitude, link, onLink, onGps, linkInvalid }: {
  latitude: number | null; longitude: number | null; link: string; onLink: (v: string) => void;
  onGps: (lat: number, lng: number) => void; linkInvalid?: boolean;
}) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"link" | "gps" | null>(null);
  const [getting, setGetting] = useState(false);
  const capture = () => {
    if (!("geolocation" in navigator)) return;
    setGetting(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { onGps(coords.latitude, coords.longitude); toast({ title: "Location captured", description: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` }); setGetting(false); },
      () => { toast({ title: "GPS error", description: "Could not get location.", variant: "destructive" }); setGetting(false); }
    );
  };
  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        {[{ m: "link", label: "Paste map link", icon: Link2 }, { m: "gps", label: "Use my GPS", icon: Navigation }].map(({ m, label, icon: Icon }) => (
          <button key={m} type="button" onClick={() => setMode(m as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all ${mode === m ? "text-white shadow-md" : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100"}`}
            style={mode === m ? { background: COLORS.TEAL } : {}}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>
      {mode === "link" && (
        <div>
          <StyledInput value={link} onChange={(e) => onLink(e.target.value)} placeholder="https://maps.google.com/..." isInvalid={linkInvalid} />
          {linkInvalid && <ErrText>⚠ Link must start with https://</ErrText>}
        </div>
      )}
      {mode === "gps" && (
        <button type="button" onClick={capture} disabled={getting}
          className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-white text-sm font-bold shadow-md hover:opacity-90 disabled:opacity-70"
          style={{ background: latitude ? "#16a34a" : COLORS.CORAL }}>
          {getting ? <><Loader2 className="h-4 w-4 animate-spin" /> Getting location…</>
            : latitude ? <><CheckCircle2 className="h-4 w-4" /> Location captured — {latitude.toFixed(4)}, {longitude?.toFixed(4)}</>
            : <><Navigation className="h-4 w-4" /> Capture my location</>}
        </button>
      )}
    </div>
  );
};

// Step shell: title, progress, clickable chips, nav buttons
const Wizard = ({ heading, steps, step, onJump, onNext, onPrev, onSubmit, loading, children }: {
  heading: string; steps: { name: string; isComplete: boolean }[]; step: number; onJump: (n: number) => void;
  onNext: () => void; onPrev: () => void; onSubmit: () => void; loading: boolean; children: React.ReactNode;
}) => {
  const total = steps.length;
  const pct = Math.round(((step - 1) / (total - 1)) * 100);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: COLORS.CORAL }}>{heading}</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{steps[step - 1].name}</h1>
          <p className="text-sm text-slate-400 font-medium mt-0.5">Step {step} of {total}</p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: COLORS.TEAL }} /></div>
          <span className="text-xs font-bold text-slate-400">{pct}%</span>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {steps.map((s, i) => {
          const n = i + 1; const active = n === step; const past = n < step; const done = past && s.isComplete;
          return (
            <button key={s.name} type="button" onClick={() => past && onJump(n)}
              className={cn("flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                active ? "text-white border-transparent" : done ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-400 border-slate-200",
                past ? "cursor-pointer" : "cursor-default")}
              style={active ? { background: COLORS.TEAL } : {}}>
              {done ? <CheckCircle2 className="h-3 w-3" /> : <span>{n}</span>} {s.name}
            </button>
          );
        })}
      </div>
      {children}
      <div className="flex gap-3 pt-2">
        {step > 1 && (
          <button type="button" onClick={onPrev} className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm"><ChevronLeft className="h-4 w-4" /> Back</button>
        )}
        {step < total ? (
          <button type="button" onClick={onNext} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-bold shadow-lg hover:opacity-90 active:scale-[0.99]" style={{ background: `linear-gradient(135deg, ${COLORS.TEAL}, #005f5f)` }}>
            Continue to {steps[step].name} <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={onSubmit} disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-bold shadow-lg hover:opacity-90 active:scale-[0.99] disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT}, ${COLORS.CORAL})` }}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><CheckCircle2 className="h-4 w-4" /> Submit for approval</>}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Builders (campsite facilities / hotel rooms, activities, special prices) ─
interface UnitItem {
  id: string; name: string; bedType: string; price: string; capacity: string; quantity: string;
  amenities: string[]; amenityInput: string; images: File[]; previewUrls: string[]; saved: boolean;
}
interface ActivityItem { id: string; name: string; price: string; images: File[]; previewUrls: string[]; saved: boolean }
interface SpecialTier { id: string; label: string; citizenPrice: string; nonCitizenPrice: string; requirement: string; saved: boolean }
const emptyUnit = (): UnitItem => ({ id: makeId(), name: "", bedType: "Double", price: "", capacity: "", quantity: "1", amenities: [], amenityInput: "", images: [], previewUrls: [], saved: false });
const emptyActivity = (): ActivityItem => ({ id: makeId(), name: "", price: "", images: [], previewUrls: [], saved: false });
const emptyTier = (): SpecialTier => ({ id: makeId(), label: "", citizenPrice: "", nonCitizenPrice: "", requirement: "", saved: false });

const unitComplete = (u: UnitItem, isRoom: boolean) =>
  !!u.name.trim() && u.amenities.length > 0 && !!u.capacity.trim() && u.images.length >= 2 &&
  (!isRoom || (parseFloat(u.price) > 0 && parseInt(u.quantity, 10) >= 1));

const useItemImages = (onFail: (m: string) => void) => {
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const run = async (id: string, existing: File[], list: FileList | null, max: number): Promise<File[] | null> => {
    setBusy((p) => new Set(p).add(id));
    const merged = await mergeImages(existing, list, max, onFail);
    setBusy((p) => { const n = new Set(p); n.delete(id); return n; });
    return merged;
  };
  return { busy, run };
};

const UnitBuilder = ({ items, onChange, showErrors, onFail, isRoom }: {
  items: UnitItem[]; onChange: (i: UnitItem[]) => void; showErrors: boolean; onFail: (m: string) => void; isRoom: boolean;
}) => {
  const { usdHint } = useCurrency();
  const { busy, run } = useItemImages(onFail);
  const update = (id: string, patch: Partial<UnitItem>) => onChange(items.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => onChange(items.filter((r) => r.id !== id));
  const addTag = (it: UnitItem) => {
    const v = it.amenityInput.replace(/,/g, "").trim();
    if (v) update(it.id, { amenities: [...it.amenities, v], amenityInput: "" });
  };
  const setImages = async (it: UnitItem, list: FileList | null) => {
    const merged = await run(it.id, it.images, list, 5);
    if (merged) update(it.id, { images: merged, previewUrls: merged.map(safeObjectUrl) });
  };
  const dropImage = (it: UnitItem, idx: number) => {
    const next = it.images.filter((_, i) => i !== idx);
    update(it.id, { images: next, previewUrls: next.map(safeObjectUrl) });
  };
  const save = (it: UnitItem) => {
    if (!it.name.trim()) return onFail(isRoom ? "Please enter a room type name (e.g. Deluxe Double)." : "Please enter a facility name.");
    if (isRoom && !(parseFloat(it.price) > 0)) return onFail("Please enter a price per night greater than 0.");
    if (!it.capacity.trim()) return onFail(isRoom ? "Please enter how many guests the room sleeps." : "Please enter the facility capacity.");
    if (isRoom && !(parseInt(it.quantity, 10) >= 1)) return onFail("Please enter how many rooms of this type you have.");
    if (it.amenities.length === 0) return onFail("Please add at least one amenity.");
    if (it.images.length < 2) return onFail("Please add at least 2 photos.");
    update(it.id, { saved: true });
  };
  return (
    <div className="space-y-4">
      <FieldLabel>{isRoom ? "Room types (with photos)" : "Facilities (with photos)"}</FieldLabel>
      {items.map((it) => (
        <div key={it.id} className={cn("rounded-xl border overflow-hidden", it.saved ? "border-[#FF7F50]/30 bg-[#FF7F50]/5" : "border-slate-200 bg-white")}>
          {it.saved ? (
            <div className="p-4 flex items-center gap-4 flex-wrap">
              <div className="flex gap-2 shrink-0">
                {it.previewUrls.slice(0, 3).map((u, i) => <img key={i} src={u} className="w-12 h-12 rounded-xl object-cover border border-slate-200" alt="" />)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 truncate">{it.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{isRoom ? `${it.bedType} bed · sleeps ${it.capacity} · ${it.quantity} room${it.quantity === "1" ? "" : "s"}` : it.amenities.join(", ")}</p>
                {it.price && <p className="text-[11px] font-semibold mt-0.5" style={{ color: COLORS.CORAL }}>KSh {it.price}{isRoom ? " / night" : ""} <span className="text-blue-500">{usdHint(parseFloat(it.price) || 0)}</span></p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => update(it.id, { saved: false })} className="text-[11px] font-bold uppercase border rounded-lg px-3 py-1.5 hover:bg-orange-50" style={{ color: COLORS.CORAL, borderColor: `${COLORS.CORAL}40` }}>Edit</button>
                <button type="button" onClick={() => remove(it.id)} className="text-[11px] font-bold uppercase text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50">Remove</button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1"><FieldLabel required>{isRoom ? "Room type" : "Name"}</FieldLabel>
                  <StyledInput value={it.name} onChange={(e) => update(it.id, { name: e.target.value })} placeholder={isRoom ? "e.g. Deluxe Double" : "e.g. Campsite A"} isInvalid={showErrors && !it.name.trim()} /></div>
                {isRoom && (
                  <div className="space-y-1"><FieldLabel>Bed type</FieldLabel>
                    <Select value={it.bedType} onValueChange={(v) => update(it.id, { bedType: v })}>
                      <SelectTrigger className="rounded-xl h-11 font-semibold border-slate-200"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white rounded-xl">{BED_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select></div>
                )}
                <div className="space-y-1"><FieldLabel required={isRoom}>{isRoom ? "Price / night (KSh)" : "Price (KSh)"}</FieldLabel>
                  <StyledInput type="number" min={0} value={it.price} onChange={(e) => update(it.id, { price: e.target.value })} placeholder="0" isInvalid={showErrors && isRoom && !(parseFloat(it.price) > 0)} />
                  {parseFloat(it.price) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-0.5">{usdHint(parseFloat(it.price))}</p>}</div>
                <div className="space-y-1"><FieldLabel required>{isRoom ? "Sleeps (guests)" : "Capacity"}</FieldLabel>
                  <StyledInput type="number" min={1} value={it.capacity} onChange={(e) => update(it.id, { capacity: e.target.value.replace(/[^0-9]/g, "") })} placeholder="e.g. 2" isInvalid={showErrors && !it.capacity.trim()} /></div>
                {isRoom && (
                  <div className="space-y-1"><FieldLabel required>Rooms available</FieldLabel>
                    <StyledInput type="number" min={1} value={it.quantity} onChange={(e) => update(it.id, { quantity: e.target.value.replace(/[^0-9]/g, "") })} placeholder="e.g. 10" isInvalid={showErrors && !(parseInt(it.quantity, 10) >= 1)} /></div>
                )}
              </div>
              <div className="space-y-1"><FieldLabel required>Amenities</FieldLabel>
                <TagInput tags={it.amenities} input={it.amenityInput} onInputChange={(v) => update(it.id, { amenityInput: v })} onAdd={() => addTag(it)}
                  onRemove={(i) => update(it.id, { amenities: it.amenities.filter((_, x) => x !== i) })} hasError={showErrors && it.amenities.length === 0}
                  placeholder={isRoom ? "e.g. Wi-Fi, en-suite bathroom…" : "e.g. Fire pit, toilets…"} /></div>
              <div>
                <FieldLabel required>Photos (min 2, max 5)</FieldLabel>
                {busy.has(it.id) && <CompressingBanner />}
                <ImageGalleryGrid previews={it.previewUrls} onRemove={(i) => dropImage(it, i)} onAdd={(f) => setImages(it, f)} isInvalid={showErrors && it.images.length < 2} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => save(it)} className="flex-1 h-10 rounded-xl text-white text-[12px] font-bold hover:opacity-90" style={{ background: `linear-gradient(135deg, ${COLORS.CORAL}, #e06040)` }}>{isRoom ? "Save room type" : "Save facility"}</button>
                {items.length > 1 && <button type="button" onClick={() => remove(it.id)} className="h-10 px-4 rounded-xl text-red-400 hover:bg-red-50"><X className="h-4 w-4" /></button>}
              </div>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, emptyUnit()])} className="w-full h-11 rounded-xl text-[11px] font-bold uppercase border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#FF7F50] hover:text-[#FF7F50] flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> {isRoom ? "Add room type" : "Add facility"}
      </button>
    </div>
  );
};

const ActivityBuilder = ({ items, onChange, showErrors, onFail }: { items: ActivityItem[]; onChange: (i: ActivityItem[]) => void; showErrors: boolean; onFail: (m: string) => void }) => {
  const { usdHint } = useCurrency();
  const { busy, run } = useItemImages(onFail);
  const update = (id: string, patch: Partial<ActivityItem>) => onChange(items.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = (id: string) => onChange(items.filter((a) => a.id !== id));
  const setImages = async (a: ActivityItem, list: FileList | null) => {
    const merged = await run(a.id, a.images, list, 5);
    if (merged) update(a.id, { images: merged, previewUrls: merged.map(safeObjectUrl) });
  };
  const dropImage = (a: ActivityItem, idx: number) => {
    const next = a.images.filter((_, i) => i !== idx);
    update(a.id, { images: next, previewUrls: next.map(safeObjectUrl) });
  };
  const save = (a: ActivityItem) => {
    if (!a.name.trim()) return onFail("Please enter an activity name.");
    if (a.images.length === 0) return onFail("Please upload at least 1 photo for this activity.");
    update(a.id, { saved: true });
  };
  return (
    <div className="space-y-4">
      <FieldLabel>Activities (with photos)</FieldLabel>
      {items.map((a) => (
        <div key={a.id} className={cn("rounded-xl border overflow-hidden", a.saved ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 bg-white")}>
          {a.saved ? (
            <div className="p-4 flex items-center gap-4 flex-wrap">
              <div className="flex gap-2 shrink-0">{a.previewUrls.slice(0, 3).map((u, i) => <img key={i} src={u} className="w-12 h-12 rounded-xl object-cover border border-slate-200" alt="" />)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 truncate">{a.name}</p>
                {a.price && <p className="text-[11px] font-semibold text-indigo-500">KSh {a.price} <span className="text-blue-500">{usdHint(parseFloat(a.price))}</span></p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => update(a.id, { saved: false })} className="text-[11px] font-bold uppercase text-indigo-500 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50">Edit</button>
                <button type="button" onClick={() => remove(a.id)} className="text-[11px] font-bold uppercase text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50">Remove</button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><FieldLabel required>Activity name</FieldLabel><StyledInput value={a.name} onChange={(e) => update(a.id, { name: e.target.value })} placeholder="e.g. Hiking" isInvalid={showErrors && !a.name.trim()} /></div>
                <div className="space-y-1"><FieldLabel>Price (KSh)</FieldLabel><StyledInput type="number" value={a.price} onChange={(e) => update(a.id, { price: e.target.value })} placeholder="0 = Free" /></div>
              </div>
              <div>
                <FieldLabel required>Photos (min 1, max 5)</FieldLabel>
                {busy.has(a.id) && <CompressingBanner />}
                <ImageGalleryGrid previews={a.previewUrls} onRemove={(i) => dropImage(a, i)} onAdd={(f) => setImages(a, f)} isInvalid={showErrors && a.images.length === 0} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => save(a)} className="flex-1 h-10 rounded-xl text-white text-[12px] font-bold hover:opacity-90" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>Save activity</button>
                {items.length > 1 && <button type="button" onClick={() => remove(a.id)} className="h-10 px-4 rounded-xl text-red-400 hover:bg-red-50"><X className="h-4 w-4" /></button>}
              </div>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, emptyActivity()])} className="w-full h-11 rounded-xl text-[11px] font-bold uppercase border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-400 flex items-center justify-center gap-2"><Plus className="h-4 w-4" /> Add activity</button>
    </div>
  );
};

const SpecialPriceBuilder = ({ items, onChange, showErrors, onFail }: { items: SpecialTier[]; onChange: (i: SpecialTier[]) => void; showErrors: boolean; onFail: (m: string) => void }) => {
  const { usdHint } = useCurrency();
  const update = (id: string, patch: Partial<SpecialTier>) => onChange(items.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const remove = (id: string) => onChange(items.filter((t) => t.id !== id));
  const save = (t: SpecialTier) => {
    if (!t.label.trim()) return onFail("Please enter a name for this special price (e.g. Student, Family).");
    if (!(parseFloat(t.citizenPrice) > 0)) return onFail("Please enter a citizen price greater than 0.");
    update(t.id, { saved: true });
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" style={{ color: COLORS.CORAL }} /><FieldLabel>Special entry prices (Student, Family, Senior, Group…)</FieldLabel></div>
      <p className="text-[11px] text-slate-400 -mt-3">Optional. Custom categories with their own requirements.</p>
      {items.map((t) => (
        <div key={t.id} className={cn("rounded-xl border overflow-hidden", t.saved ? "border-purple-200 bg-purple-50/30" : "border-slate-200 bg-white")}>
          {t.saved ? (
            <div className="p-4 flex items-center gap-4 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0"><Sparkles className="h-4 w-4 text-purple-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 truncate">{t.label}</p>
                <p className="text-[11px] font-semibold text-purple-600">Citizen: KSh {t.citizenPrice} <span className="text-blue-500">{usdHint(parseFloat(t.citizenPrice) || 0)}</span></p>
                {parseFloat(t.nonCitizenPrice) > 0 && <p className="text-[11px] font-semibold text-amber-600">Non-citizen: KSh {t.nonCitizenPrice}</p>}
                {t.requirement.trim() && <p className="text-[10px] text-slate-500 mt-1 italic">Requires: {t.requirement}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => update(t.id, { saved: false })} className="text-[11px] font-bold uppercase text-purple-500 border border-purple-200 rounded-lg px-3 py-1.5 hover:bg-purple-50">Edit</button>
                <button type="button" onClick={() => remove(t.id)} className="text-[11px] font-bold uppercase text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50">Remove</button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="space-y-1"><FieldLabel required>Category name</FieldLabel><StyledInput value={t.label} onChange={(e) => update(t.id, { label: e.target.value })} placeholder="e.g. Student" isInvalid={showErrors && !t.label.trim()} /></div>
                <div className="space-y-1"><FieldLabel required>Citizen price (KSh)</FieldLabel><StyledInput type="number" value={t.citizenPrice} onChange={(e) => update(t.id, { citizenPrice: e.target.value })} placeholder="0" isInvalid={showErrors && !(parseFloat(t.citizenPrice) > 0)} /></div>
                <div className="space-y-1"><FieldLabel>Non-citizen price (KSh)</FieldLabel><StyledInput type="number" value={t.nonCitizenPrice} onChange={(e) => update(t.id, { nonCitizenPrice: e.target.value })} placeholder="Optional" /></div>
              </div>
              <div className="space-y-1"><FieldLabel>Requirement (shown to visitors)</FieldLabel><StyledInput value={t.requirement} onChange={(e) => update(t.id, { requirement: e.target.value })} placeholder="e.g. Valid student ID required at entry" /></div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => save(t)} className="flex-1 h-10 rounded-xl text-white text-[12px] font-bold hover:opacity-90" style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}>Save special price</button>
                <button type="button" onClick={() => remove(t.id)} className="h-10 px-4 rounded-xl text-red-400 hover:bg-red-50"><X className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, emptyTier()])} className="w-full h-11 rounded-xl text-[11px] font-bold uppercase border-2 border-dashed border-slate-200 text-slate-400 hover:border-purple-400 hover:text-purple-400 flex items-center justify-center gap-2"><Plus className="h-4 w-4" /> Add special price</button>
    </div>
  );
};

const StarRatingPicker = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex items-center gap-1.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" onClick={() => onChange(value === n ? 0 : n)} aria-label={`${n} stars`} className="p-1 rounded-lg hover:bg-slate-50">
        <Star className="h-6 w-6" style={n <= value ? { color: COLORS.CORAL, fill: COLORS.CORAL } : { color: "#cbd5e1" }} />
      </button>
    ))}
    <span className="ml-2 text-[11px] text-slate-400 font-medium">{value ? `${value}-star` : "Unrated"}</span>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// TRIP / EVENT FORM
// ═════════════════════════════════════════════════════════════════════════════
const TRIP_STEPS = ["Basic info", "Date & pricing", "Contact & photos", "Schedule", "Review"];

const TripEventForm = ({ kind, user, host }: { kind: "trip" | "event"; user: any; host?: VerifiedHost }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { usdHint } = useCurrency();
  const isEvent = kind === "event";
  const geo = useCountry(user);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [regType, setRegType] = useState<string>(host?.type ?? "company");
  const [useTicketTypes, setUseTicketTypes] = useState(false);
  const [ticketTypes, setTicketTypes] = useState<{ name: string; price: number }[]>([]);
  const [newTicketName, setNewTicketName] = useState("");
  const [newTicketPrice, setNewTicketPrice] = useState("");
  const [inclusions, setInclusions] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [newInc, setNewInc] = useState("");
  const [newExc, setNewExc] = useState("");
  const [activityNames, setActivityNames] = useState<string[]>([]);
  const [newActivity, setNewActivity] = useState("");
  const [workingDays, setWorkingDays] = useState<any>({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: true });
  const gallery = useImages(5);
  const cert = useImages(1);

  const [f, setF] = useState({
    registrationName: host?.name ?? "", registrationNumber: host?.number ?? "",
    name: "", description: "", location: "", pickup_location: "", date: "",
    price: "0", price_child: "0", available_tickets: "0", email: user?.email ?? "", phone_number: "",
    location_link: "", map_link: "", latitude: null as number | null, longitude: null as number | null,
    is_custom_date: !isEvent, flexible_duration_months: "3", event_category: "",
    allow_children: true, opening_hours: "00:00", closing_hours: "23:59",
  });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  const clear = (k: string) => setErrors((p) => p.filter((e) => e !== k));
  const has = (k: string) => errors.includes(k);

  const months = Math.floor(Number(f.flexible_duration_months));
  const monthsValid = Number.isFinite(months) && months >= 1; // no upper limit
  const regErr = regNumberError(regType, f.registrationName, f.registrationNumber, geo.country, !!host);

  const stepErrors = (s: number): string[] => {
    const e: string[] = [];
    if (s === 1) {
      if (!f.registrationName.trim()) e.push("registration_name");
      if (regErr) e.push("registration_number");
      if (!f.name.trim()) e.push("name");
      if (!geo.country) e.push("country");
      if (!f.location.trim()) e.push("location");
      if (!isEvent && !f.pickup_location.trim()) e.push("pickup_location");
      if (f.location_link && !f.location_link.startsWith("https://")) e.push("location_link");
    } else if (s === 2) {
      if (f.is_custom_date) { if (!monthsValid) e.push("duration"); } else if (!f.date) e.push("date");
      if (useTicketTypes) { if (ticketTypes.length === 0) e.push("ticket_types"); }
      else if (!f.price || parseFloat(f.price) < 0) e.push("price");
      if (!f.available_tickets || parseInt(f.available_tickets) <= 0) e.push("available_tickets");
    } else if (s === 3) {
      if (!f.phone_number) e.push("phone_number");
      if (gallery.files.length < 5) e.push("gallery");
      if (isEvent && cert.files.length === 0) e.push("event_certificate");
    } else if (s === 4) {
      if (!f.description.trim()) e.push("description");
    }
    return e;
  };

  const steps = TRIP_STEPS.map((name, i) => ({ name, isComplete: i === 4 ? [1, 2, 3, 4].every((s) => stepErrors(s).length === 0) : stepErrors(i + 1).length === 0 }));

  const flushPending = () => {
    if (newInc.trim()) { setInclusions((p) => [...p, newInc.trim()]); setNewInc(""); }
    if (newExc.trim()) { setExclusions((p) => [...p, newExc.trim()]); setNewExc(""); }
    if (newActivity.trim()) { setActivityNames((p) => [...p, newActivity.trim()]); setNewActivity(""); }
  };
  const handleNext = () => {
    flushPending();
    const e = stepErrors(step);
    setErrors(e);
    if (e.length) { toast({ title: "Complete this step", description: `${e.length} field(s) need attention`, variant: "destructive" }); return; }
    setStep((p) => Math.min(p + 1, 5));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handlePrev = () => { setErrors([]); setStep((p) => Math.max(p - 1, 1)); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const addTicketType = () => {
    if (!newTicketName.trim() || !newTicketPrice || parseFloat(newTicketPrice) < 0) {
      toast({ title: "Invalid ticket", description: "Please enter a ticket name and valid price.", variant: "destructive" });
      return;
    }
    setTicketTypes((p) => [...p, { name: newTicketName.trim(), price: parseFloat(newTicketPrice) }]);
    setNewTicketName(""); setNewTicketPrice(""); clear("ticket_types");
  };

  const addTag = (val: string, list: string[], setList: (v: string[]) => void, setVal: (v: string) => void) => {
    if (val.trim()) { setList([...list, val.trim()]); setVal(""); }
  };
  const tagChange = (val: string, list: string[], setList: (v: string[]) => void, setVal: (v: string) => void) => {
    if (val.endsWith(",") || val.endsWith(".")) { const item = val.slice(0, -1).trim(); if (item) { setList([...list, item]); setVal(""); } } else setVal(val);
  };

  const handleSubmit = async () => {
    const all = [1, 2, 3, 4].flatMap(stepErrors);
    if (all.length) { setErrors(all); toast({ title: "Missing fields", description: "Please complete all steps.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const slug = generateFriendlySlug(f.name);
      const upload = async (file: File, prefix: string) => {
        const path = `${user.id}/${prefix}${Math.random()}.${file.name.split(".").pop()}`;
        const { error } = await supabase.storage.from("user-content-images").upload(path, file);
        if (error) throw error;
        return supabase.storage.from("user-content-images").getPublicUrl(path).data.publicUrl;
      };
      const urls: string[] = [];
      for (const file of gallery.files) urls.push(await upload(file, ""));
      const certUrl = isEvent && cert.files[0] ? await upload(cert.files[0], "cert-") : null;

      let flexibleEnd: string | null = null;
      if (f.is_custom_date) {
        const end = new Date();
        end.setMonth(end.getMonth() + months);
        flexibleEnd = end.toISOString().split("T")[0];
      }
      const days = ALL_DAYS.filter((d) => workingDays[d]);
      const mapLink = f.latitude ? `https://www.google.com/maps?q=${f.latitude},${f.longitude}` : f.location_link;

      const { error } = await supabase.from("trips").insert([{
        id: slug, slug, name: f.name, description: f.description, location: f.location,
        place: geo.place, country: geo.country, division_id: geo.divisionId,
        registration_name: f.registrationName, registration_number: f.registrationNumber, registration_type: regType,
        date: f.is_custom_date ? new Date().toISOString().split("T")[0] : f.date,
        is_custom_date: f.is_custom_date, is_flexible_date: f.is_custom_date,
        type: kind, image_url: urls[0] || "", gallery_images: urls,
        price: useTicketTypes ? (ticketTypes[0]?.price ?? 0) : parseFloat(f.price),
        price_child: useTicketTypes ? 0 : parseFloat(f.price_child) || 0,
        available_tickets: parseInt(f.available_tickets) || 0,
        email: f.email, phone_number: f.phone_number, map_link: mapLink,
        opening_hours: f.opening_hours || null, closing_hours: f.closing_hours || null,
        days_opened: days.length ? days : null,
        created_by: user.id, approval_status: approvalStatusSchema.parse("pending"),
        flexible_end_date: flexibleEnd,
        inclusions: inclusions.length ? inclusions : null, exclusions: exclusions.length ? exclusions : null,
        event_category: isEvent ? f.event_category || null : null,
        ticket_types: useTicketTypes ? ticketTypes : [],
        allow_children: f.allow_children, location_link: f.location_link || null,
        activities: activityNames.map((name) => ({ name, price: 0 })),
        event_certificate_url: certUrl,
        pickup_location: !isEvent ? f.pickup_location || null : null,
      } as any]);
      if (error) throw error;
      toast({ title: "Success!", description: `Ref: ${slug} — Submitted for approval.`, duration: 5000 });
      navigate("/become-host");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const wc = wordsOf(f.description);

  return (
    <Wizard heading={isEvent ? "Event" : "Trip / Tour"} steps={steps} step={step} onJump={(n) => { setErrors([]); setStep(n); }}
      onNext={handleNext} onPrev={handlePrev} onSubmit={handleSubmit} loading={loading}>
      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.TEAL }} />
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{isEvent ? "Creating an event — fixed date session" : "Creating a trip / tour — flexible or fixed dates"}</span>
          </div>
          <RegistrationSection title="Registration details" subtitle={host ? "Pulled from your verified host profile" : "Who is registering this experience"}
            showTypeSelector={!host} verified={host} regType={regType} setRegType={setRegType}
            name={f.registrationName} setName={(v) => { set({ registrationName: v }); if (v.trim()) clear("registration_name"); }}
            number={f.registrationNumber} setNumber={(v) => { set({ registrationNumber: v }); clear("registration_number"); }}
            geo={geo} errors={{ name: has("registration_name"), number: has("registration_number"), country: has("country") }} skipPattern={!!host} />

          {isEvent && (
            <SectionCard title="Event category" subtitle="Select the best category for your event" icon={Ticket}>
              <OptionTiles options={EVENT_CATEGORIES} value={f.event_category} onChange={(v) => set({ event_category: v })} cols="grid-cols-3 lg:grid-cols-4" />
            </SectionCard>
          )}

          <SectionCard title="Experience details" icon={MapPin}>
            <div className="grid gap-5">
              <div><FieldLabel required>Experience name</FieldLabel>
                <StyledInput isInvalid={has("name")} value={f.name} onChange={(e) => { set({ name: e.target.value }); if (e.target.value) clear("name"); }} placeholder="e.g. Hiking in the Clouds" />
                {has("name") && <ErrText>⚠ Experience name is required</ErrText>}</div>
              <div><FieldLabel required>Specific location</FieldLabel>
                <StyledInput isInvalid={has("location")} value={f.location} onChange={(e) => { set({ location: e.target.value }); if (e.target.value) clear("location"); }} placeholder="e.g. Nanyuki Main Gate" />
                {has("location") && <ErrText>⚠ Specific location is required</ErrText>}</div>
              {!isEvent && (
                <div><FieldLabel required>Pickup location</FieldLabel>
                  <div className="relative"><Navigation className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <StyledInput className="pl-9" isInvalid={has("pickup_location")} value={f.pickup_location} onChange={(e) => { set({ pickup_location: e.target.value }); if (e.target.value) clear("pickup_location"); }} placeholder="e.g. Nairobi CBD, Globe Cinema Roundabout" /></div>
                  <p className="text-[10px] text-slate-400 mt-1">Where guests will be picked up for this trip</p>
                  {has("pickup_location") && <ErrText>⚠ Pickup location is required for trips</ErrText>}</div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Map location" subtitle="Help guests find you — paste a link or use GPS" icon={Navigation}>
            <LocationPicker latitude={f.latitude} longitude={f.longitude} link={f.location_link}
              onLink={(v) => { set({ location_link: v }); if (!v || v.startsWith("https://")) clear("location_link"); }}
              onGps={(lat, lng) => set({ latitude: lat, longitude: lng })} linkInvalid={has("location_link")} />
          </SectionCard>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-5">
          <SectionCard title="Date settings" icon={Calendar}>
            {!isEvent && (
              <label className="flex items-center gap-3 cursor-pointer mb-5 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100">
                <Checkbox checked={f.is_custom_date} onCheckedChange={(c) => set({ is_custom_date: c as boolean })} />
                <div><p className="text-sm font-bold text-slate-700">Flexible dates</p>
                  <p className="text-xs text-slate-400">Guests choose their own date. Uncheck for a fixed, single-date trip.</p></div>
              </label>
            )}
            {f.is_custom_date ? (
              <div className="space-y-3">
                <FieldLabel required>Listing duration</FieldLabel>
                <p className="text-xs text-slate-400">How many months will this flexible trip stay available? Pick one or type any number — there is no limit.</p>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((m) => (
                    <button key={m} type="button" onClick={() => { set({ flexible_duration_months: String(m) }); clear("duration"); }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${f.flexible_duration_months === String(m) ? "text-white shadow-md" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                      style={f.flexible_duration_months === String(m) ? { background: COLORS.TEAL } : {}}>
                      {m} {m === 1 ? "month" : "months"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 max-w-xs">
                  <StyledInput type="number" min={1} step={1} value={f.flexible_duration_months} isInvalid={has("duration")}
                    onChange={(e) => { set({ flexible_duration_months: e.target.value }); clear("duration"); }} placeholder="e.g. 18" />
                  <span className="text-sm font-semibold text-slate-500">months</span>
                </div>
                {has("duration") && <ErrText>⚠ Enter at least 1 month</ErrText>}
              </div>
            ) : (
              <div><FieldLabel required>{isEvent ? "Event date" : "Trip date"}</FieldLabel>
                <StyledInput isInvalid={has("date")} type="date" min={new Date().toISOString().split("T")[0]} value={f.date} className="max-w-xs"
                  onChange={(e) => { set({ date: e.target.value }); if (e.target.value) clear("date"); }} />
                {has("date") && <ErrText>⚠ Please select a date</ErrText>}</div>
            )}
          </SectionCard>

          <SectionCard title="Pricing & tickets" icon={DollarSign}>
            <div className="space-y-5">
              {isEvent && (
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100">
                  <Checkbox checked={useTicketTypes} onCheckedChange={(c) => setUseTicketTypes(c as boolean)} />
                  <div><p className="text-sm font-bold text-slate-700">Custom ticket types</p><p className="text-xs text-slate-400">VIP, VVIP, Regular, etc. with different prices</p></div>
                </label>
              )}
              <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100">
                <Checkbox checked={f.allow_children} onCheckedChange={(c) => set({ allow_children: c as boolean })} />
                <div><p className="text-sm font-bold text-slate-700">Allow children</p><p className="text-xs text-slate-400">Enable child pricing for this experience</p></div>
              </label>

              {useTicketTypes ? (
                <div className="space-y-4">
                  <div className="flex gap-3 items-end flex-wrap">
                    <div className="flex-1 min-w-[140px]"><FieldLabel>Ticket name</FieldLabel><StyledInput value={newTicketName} onChange={(e) => setNewTicketName(e.target.value)} placeholder="e.g. VIP, Regular" /></div>
                    <div className="w-36"><FieldLabel>Price (KSh)</FieldLabel><StyledInput type="number" min="0" value={newTicketPrice} onChange={(e) => setNewTicketPrice(e.target.value)} placeholder="0" /></div>
                    <button type="button" onClick={addTicketType} className="h-11 px-4 rounded-xl text-white font-bold flex items-center gap-1.5 hover:opacity-90" style={{ background: COLORS.TEAL }}><Plus className="h-4 w-4" /> Add</button>
                  </div>
                  {has("ticket_types") && <ErrText>⚠ Add at least one ticket type</ErrText>}
                  <div className="space-y-2">
                    {ticketTypes.map((t, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2.5"><Ticket className="h-4 w-4 text-slate-400" /><span className="text-sm font-bold text-slate-800">{t.name}</span>
                          <span className="text-xs text-slate-500">KSh {t.price.toLocaleString()}</span>{t.price > 0 && <span className="text-[10px] text-blue-500 font-semibold">{usdHint(t.price)}</span>}</div>
                        <button type="button" onClick={() => setTicketTypes((p) => p.filter((_, x) => x !== i))} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div><FieldLabel required>Adult price (KSh)</FieldLabel>
                    <StyledInput isInvalid={has("price")} type="number" value={f.price} onChange={(e) => { set({ price: e.target.value }); if (e.target.value && parseFloat(e.target.value) >= 0) clear("price"); }} />
                    {parseFloat(f.price) > 0 && <p className="text-[10px] text-blue-500 font-semibold mt-1">{usdHint(parseFloat(f.price))}</p>}
                    {has("price") && <ErrText>⚠ Enter a valid price</ErrText>}</div>
                  {f.allow_children && (
                    <div><FieldLabel>Child price (KSh)</FieldLabel>
                      <StyledInput type="number" min="0" value={f.price_child} onChange={(e) => set({ price_child: e.target.value })} />
                      {parseFloat(f.price_child) > 0 && <p className="text-[10px] text-blue-500 font-semibold mt-1">{usdHint(parseFloat(f.price_child))}</p>}</div>
                  )}
                  <div><FieldLabel required>{!isEvent && f.is_custom_date ? "Max booking limit per day" : "Max slots"}</FieldLabel>
                    <StyledInput isInvalid={has("available_tickets")} type="number" value={f.available_tickets} onChange={(e) => { set({ available_tickets: e.target.value }); if (parseInt(e.target.value) > 0) clear("available_tickets"); }} />
                    {!isEvent && f.is_custom_date && <p className="text-[10px] text-slate-400 mt-1">Maximum slots a single booking can reserve for any given day — not the day's total capacity.</p>}
                    {!isEvent && !f.is_custom_date && <p className="text-[10px] text-slate-400 mt-1">Total slots available for this trip's date.</p>}
                    {has("available_tickets") && <ErrText>⚠ Enter number of slots (min 1)</ErrText>}</div>
                </div>
              )}
              {useTicketTypes && (
                <div><FieldLabel required>Max slots</FieldLabel>
                  <StyledInput isInvalid={has("available_tickets")} type="number" className="max-w-xs" value={f.available_tickets} onChange={(e) => { set({ available_tickets: e.target.value }); if (parseInt(e.target.value) > 0) clear("available_tickets"); }} />
                  {has("available_tickets") && <ErrText>⚠ Enter number of slots (min 1)</ErrText>}</div>
              )}
            </div>
          </SectionCard>

          {(!f.is_custom_date || isEvent) && (
            <SectionCard title="What's included & excluded" subtitle="Optional — helps guests know what to expect">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[
                  { label: "✓ Inclusions", list: inclusions, setList: setInclusions, val: newInc, setVal: setNewInc, chip: "bg-emerald-50 text-emerald-700 border-emerald-200", mark: "✓" },
                  { label: "✗ Exclusions", list: exclusions, setList: setExclusions, val: newExc, setVal: setNewExc, chip: "bg-red-50 text-red-600 border-red-200", mark: "✗" },
                ].map((b) => (
                  <div key={b.label}>
                    <FieldLabel>{b.label}</FieldLabel>
                    <div className="flex gap-2 mb-3">
                      <StyledInput value={b.val} placeholder="Type, press comma to add" onChange={(e) => tagChange(e.target.value, b.list, b.setList, b.setVal)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(b.val, b.list, b.setList, b.setVal); } }} />
                      <button type="button" onClick={() => addTag(b.val, b.list, b.setList, b.setVal)} className="px-4 rounded-xl text-white text-sm font-bold shrink-0" style={{ background: COLORS.TEAL }}>Add</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {b.list.map((item, i) => (
                        <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${b.chip}`}>
                          {b.mark} {item}<button type="button" onClick={() => b.setList(b.list.filter((_, x) => x !== i))}><X className="h-2.5 w-2.5 ml-0.5 hover:text-red-500" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-5">
          <SectionCard title="Contact details" subtitle="How guests can reach you" icon={MapPin}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div><FieldLabel>Contact email</FieldLabel><StyledInput type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="contact@example.com" /></div>
              <div><PhoneInput value={f.phone_number} onChange={(v: string) => { set({ phone_number: v }); if (v) clear("phone_number"); }} country={geo.country} placeholder="712 345 678" />
                {has("phone_number") && <ErrText>⚠ Phone number is required</ErrText>}</div>
            </div>
          </SectionCard>
          <SectionCard title={`Photo gallery — ${gallery.files.length}/5 uploaded`} subtitle={gallery.files.length < 5 ? `Upload ${5 - gallery.files.length} more photos to continue` : "All 5 photos uploaded ✓"} icon={Camera}>
            {has("gallery") && <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl"><span className="text-red-500">⚠</span><p className="text-red-600 text-xs font-semibold">You need 5 photos. Upload {5 - gallery.files.length} more.</p></div>}
            {gallery.compressing && <CompressingBanner />}
            <ImageGalleryGrid previews={gallery.previews} onRemove={gallery.remove} onAdd={(l) => { gallery.add(l); }} isInvalid={has("gallery")} />
            <p className="text-[10px] text-slate-400 mt-3 font-medium">First photo becomes your cover image. Landscape photos work best.</p>
          </SectionCard>
          {isEvent && (
            <SectionCard title="Event certificate / permit" subtitle="Prove you're authorized to host this event" icon={FileImage}>
              <div className="-mt-6"><DocumentUpload title="Event certificate" hint="A clear photo of your event permit or certificate" img={cert} isInvalid={has("event_certificate")} /></div>
            </SectionCard>
          )}
        </div>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <div className="space-y-5">
          <SectionCard title={isEvent ? "Event hours" : "Operating hours & days"} icon={Calendar}>
            <OperatingHoursSection openingHours={f.opening_hours} closingHours={f.closing_hours} workingDays={workingDays}
              onOpeningChange={(v: string) => set({ opening_hours: v })} onClosingChange={(v: string) => set({ closing_hours: v })}
              onDaysChange={setWorkingDays} accentColor={COLORS.TEAL} hideDays={isEvent} hide24HourToggle={true} />
          </SectionCard>
          <SectionCard title="Experience description">
            <FieldLabel required>Describe your experience (max 20 words)</FieldLabel>
            <Textarea className={`rounded-xl border min-h-[140px] text-sm font-medium resize-none ${has("description") ? "border-red-400 ring-2 ring-red-100 bg-red-50" : "border-slate-200 focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080]"}`}
              value={f.description} placeholder="Describe your experience in 20 words or less…"
              onChange={(e) => { if (e.target.value.trim() === "" || wordsOf(e.target.value) <= 20) set({ description: e.target.value }); if (e.target.value.trim()) clear("description"); }} />
            <div className="flex items-center justify-between mt-2"><p className="text-[10px] text-slate-400">{wc}/20 words</p>{has("description") && <ErrText>⚠ Description is required</ErrText>}</div>
          </SectionCard>
          <SectionCard title="Activities" subtitle="Optional — activities guests can enjoy">
            <div className="flex gap-3 mb-4">
              <StyledInput value={newActivity} onChange={(e) => setNewActivity(e.target.value)} placeholder="e.g. Hiking, Swimming, Game drive"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(newActivity, activityNames, setActivityNames, setNewActivity); } }} />
              <button type="button" onClick={() => addTag(newActivity, activityNames, setActivityNames, setNewActivity)} className="px-4 rounded-xl text-white font-bold shrink-0 hover:opacity-90" style={{ background: COLORS.TEAL }}><Plus className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {activityNames.map((n, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border" style={{ background: `${COLORS.TEAL}10`, color: COLORS.TEAL, borderColor: `${COLORS.TEAL}25` }}>
                  {n}<button type="button" onClick={() => setActivityNames(activityNames.filter((_, x) => x !== i))}><X className="h-2.5 w-2.5 ml-0.5 hover:text-red-500" /></button>
                </span>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* STEP 5 */}
      {step === 5 && (
        <ReviewStep type={kind} accentColor={COLORS.TEAL} creatorEmail={user?.email}
          data={{
            name: f.name, location: f.location, place: geo.place, country: geo.country, description: f.description,
            email: f.email, phoneNumber: f.phone_number, openingHours: f.opening_hours, closingHours: f.closing_hours,
            workingDays: ALL_DAYS.filter((d) => workingDays[d]), date: f.date, isFlexibleDate: f.is_custom_date,
            flexibleDurationMonths: String(months || ""), priceAdult: f.price, priceChild: f.price_child,
            capacity: f.available_tickets, tripType: kind, latitude: f.latitude, longitude: f.longitude, mapLink: f.location_link,
            galleryPreviewUrls: gallery.previews, inclusions, exclusions, ticketTypes: useTicketTypes ? ticketTypes : [],
            allowChildren: f.allow_children,
            activities: activityNames.map((name) => ({ name, price: 0, images: [] as string[], previewUrls: [] as string[] })),
            eventCertificatePreviewUrl: cert.previews[0] || undefined, pickupLocation: f.pickup_location || undefined,
          } as any} />
      )}
    </Wizard>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PLACE FORM — campsite / hotel / airbnb (adventure_places)
// ═════════════════════════════════════════════════════════════════════════════
const PLACE_STEPS: Record<string, { key: string; name: string }[]> = {
  campsite: [{ key: "reg", name: "Registration" }, { key: "loc", name: "Location" }, { key: "about", name: "Contact & about" }, { key: "access", name: "Access & pricing" }, { key: "units", name: "Facilities" }, { key: "gallery", name: "Gallery" }, { key: "review", name: "Review" }],
  hotel: [{ key: "reg", name: "Registration" }, { key: "loc", name: "Location" }, { key: "about", name: "Contact & about" }, { key: "stay", name: "Stay details" }, { key: "units", name: "Rooms" }, { key: "gallery", name: "Gallery" }, { key: "review", name: "Review" }],
  airbnb: [{ key: "reg", name: "Host details" }, { key: "loc", name: "Location" }, { key: "about", name: "About" }, { key: "property", name: "Property" }, { key: "gallery", name: "Gallery" }, { key: "review", name: "Review" }],
};

const PlaceForm = ({ category, user }: { category: "campsite" | "hotel" | "airbnb"; user: any }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { usdHint } = useCurrency();
  const geo = useCountry(user);
  const isHotel = category === "hotel";
  const isAirbnb = category === "airbnb";
  const isCampsite = category === "campsite";
  const stepDefs = PLACE_STEPS[category];

  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [step, setStep] = useState(1);
  const [regType, setRegType] = useState<string>("company");
  const effectiveRegType = isHotel ? "company" : regType;

  const [f, setF] = useState({
    registrationName: "", registrationNumber: "", listingTitle: "", locationName: "", description: "", email: user?.email ?? "", phoneNumber: "",
    openingHours: "00:00", closingHours: "23:59",
    entranceFeeType: "free", adultPrice: "0", childPrice: "0",
    hasNonCitizen: false, ncAdult: "0", ncChild: "0",
    starRating: 0, checkIn: "14:00", checkOut: "11:00", cancellationPolicy: "", houseRules: "",
    propertyType: "Entire apartment", guests: 2, bedrooms: 1, beds: 1, bathrooms: 1, price: "", cleaningFee: "",
    latitude: null as number | null, longitude: null as number | null, locationLink: "",
  });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  const [workingDays, setWorkingDays] = useState<any>({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: true });
  const [generalFacilities, setGeneralFacilities] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitItem[]>(() => [emptyUnit()]);
  const [activities, setActivities] = useState<ActivityItem[]>(() => [emptyActivity()]);
  const [tiers, setTiers] = useState<SpecialTier[]>([]);
  const gallery = useImages(5);
  const licence = useImages(1);

  const onFail = useCallback((msg: string) => toast({ title: "Required", description: msg, variant: "destructive" }), [toast]);

  const regErr = regNumberError(effectiveRegType, f.registrationName, f.registrationNumber, geo.country);
  const priceValid = parseFloat(f.price) > 0;
  const needsLicence = isCampsite || isHotel;

  // Completeness / validation per step key. Returns an error message or null.
  const check = (key: string, u = units, t = tiers): { title: string; desc: string } | null => {
    switch (key) {
      case "reg":
        if (!f.registrationName.trim() || !geo.country) return { title: "Complete this step", desc: "Fill all required fields" };
        if (regErr) return { title: "Registration details required", desc: regErr };
        if (needsLicence && licence.files.length === 0) return { title: "TRA licence required", desc: "Upload a JPG or PNG photo of your TRA licence to continue." };
        return null;
      case "loc":
        if (!f.locationName.trim() || (!f.latitude && !f.locationLink.trim())) return { title: "Complete this step", desc: "Fill location and provide a link or GPS" };
        return null;
      case "about":
        if (isAirbnb && !f.listingTitle.trim()) return { title: "Complete this step", desc: "Give your listing a title" };
        if (!f.description.trim()) return { title: "Complete this step", desc: "Description is required" };
        return null;
      case "property":
        if (!priceValid) return { title: "Price required", desc: "Enter a price per night greater than 0" };
        return null;
      case "units":
        if (isHotel && u.length === 0) return { title: "Add a room type", desc: "Add at least one room type to continue" };
        if (u.some((x) => !x.saved)) return { title: isHotel ? "Unsaved room" : "Unsaved facility", desc: "Please save all items first" };
        if (t.some((x) => !x.saved)) return { title: "Unsaved special price", desc: "Please save or remove all special pricing tiers" };
        return null;
      case "gallery":
        if (gallery.files.length < 5) return { title: "Photos required", desc: `Upload ${5 - gallery.files.length} more photos` };
        return null;
      default:
        return null;
    }
  };
  const keys = stepDefs.map((s) => s.key);
  const steps = stepDefs.map((s) => ({ name: s.name, isComplete: s.key === "review" ? keys.filter((k) => k !== "review").every((k) => !check(k)) : !check(s.key) }));
  const currentKey = stepDefs[step - 1].key;
  const miss = (v: string) => showErrors && !v.trim();

  const handleNext = () => {
    // Auto-save items that are complete but weren't explicitly saved
    const nextUnits = units.map((u) => {
      if (u.saved) return u;
      let n = { ...u };
      if (u.amenityInput.trim()) n = { ...n, amenities: [...n.amenities, n.amenityInput.replace(/,/g, "").trim()], amenityInput: "" };
      if (unitComplete(n, isHotel)) n.saved = true;
      return n;
    });
    const nextActs = activities.map((a) => (!a.saved && a.name.trim() && a.images.length >= 1 ? { ...a, saved: true } : a));
    const nextTiers = tiers.map((x) => (!x.saved && x.label.trim() && parseFloat(x.citizenPrice) > 0 ? { ...x, saved: true } : x));
    setUnits(nextUnits); setActivities(nextActs); setTiers(nextTiers);

    const err = check(currentKey, nextUnits, nextTiers);
    if (err) { setShowErrors(true); toast({ title: err.title, description: err.desc, variant: "destructive" }); return; }
    setShowErrors(false);
    setStep((p) => Math.min(p + 1, stepDefs.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handlePrev = () => { setShowErrors(false); setStep((p) => Math.max(p - 1, 1)); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const upload = async (file: File, prefix: string): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("listing-images").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async () => {
    setShowErrors(true);
    for (const k of keys.filter((x) => x !== "review")) {
      const err = check(k);
      if (err) { toast({ title: err.title, description: err.desc, variant: "destructive" }); return; }
    }
    setLoading(true);
    try {
      const displayName = isAirbnb ? f.listingTitle : f.registrationName;
      const slug = generateFriendlySlug(displayName);
      const licenceUrl = needsLicence && licence.files[0] ? await upload(licence.files[0], "tra-licence") : "";
      const galleryUrls = await Promise.all(gallery.files.map((x) => upload(x, "gallery")));
      const mapLink = f.latitude ? `https://www.google.com/maps?q=${f.latitude},${f.longitude}` : f.locationLink || "";

      let facilities: any[] = [];
      let activitiesForDB: any[] = [];
      let special: any[] = [];
      if (isAirbnb) {
        facilities = [{
          name: f.listingTitle, property_type: f.propertyType, price: parseFloat(f.price) || 0, cleaning_fee: parseFloat(f.cleaningFee) || 0,
          capacity: f.guests, guests: f.guests, bedrooms: f.bedrooms, beds: f.beds, bathrooms: f.bathrooms,
          house_rules: f.houseRules.trim() || null, amenities: generalFacilities, images: galleryUrls, quantity: 1,
        }];
      } else if (isHotel) {
        facilities = await Promise.all(units.map(async (r) => ({
          name: r.name, bed_type: r.bedType, amenities: r.amenities, capacity: parseInt(r.capacity, 10) || 0,
          quantity: parseInt(r.quantity, 10) || 1, price: parseFloat(r.price) || 0, images: await Promise.all(r.images.map((x) => upload(x, "room"))),
        })));
      } else {
        facilities = await Promise.all(units.map(async (u) => ({
          name: u.name, amenities: u.amenities, capacity: parseInt(u.capacity, 10) || 0, price: parseFloat(u.price) || 0,
          images: await Promise.all(u.images.map((x) => upload(x, "fac"))),
        })));
        activitiesForDB = await Promise.all(activities.filter((a) => a.name.trim()).map(async (a) => ({
          name: a.name, price: parseFloat(a.price) || 0, images: await Promise.all(a.images.map((x) => upload(x, "act"))),
        })));
        special = tiers.filter((x) => x.saved && x.label.trim()).map((x) => ({
          id: x.id, label: x.label.trim(), citizen_price: parseFloat(x.citizenPrice) || 0,
          non_citizen_price: parseFloat(x.nonCitizenPrice) || 0, requirement: x.requirement.trim(),
        }));
      }

      const paid = isCampsite && f.entranceFeeType === "paid";
      const days = isCampsite ? ALL_DAYS.filter((d) => workingDays[d]) : ALL_DAYS;

      const { error } = await supabase.from("adventure_places").insert([{
        id: slug, slug, name: displayName, category,
        registration_name: f.registrationName, registration_number: f.registrationNumber, registration_type: effectiveRegType,
        tra_license_url: licenceUrl,
        location: f.locationName, place: geo.place, country: geo.country, division_id: geo.divisionId,
        description: f.description, email: f.email, phone_numbers: f.phoneNumber ? [f.phoneNumber] : [],
        map_link: mapLink, latitude: f.latitude, longitude: f.longitude,
        opening_hours: isCampsite ? f.openingHours : f.checkIn, closing_hours: isCampsite ? f.closingHours : f.checkOut,
        days_opened: days, image_url: galleryUrls[0] ?? "", gallery_images: galleryUrls,
        entry_fee_type: paid ? "paid" : "free",
        entry_fee: paid ? parseFloat(f.adultPrice) || 0 : 0,
        child_entry_fee: paid ? parseFloat(f.childPrice) || 0 : 0,
        has_non_citizen_pricing: paid && f.hasNonCitizen,
        non_citizen_entry_fee: paid && f.hasNonCitizen ? parseFloat(f.ncAdult) || 0 : 0,
        non_citizen_child_entry_fee: paid && f.hasNonCitizen ? parseFloat(f.ncChild) || 0 : 0,
        special_entry_prices: special,
        star_rating: isHotel ? f.starRating || null : null,
        cancellation_policy: !isCampsite ? f.cancellationPolicy.trim() || null : null,
        amenities: generalFacilities, facilities, activities: activitiesForDB,
        created_by: user.id, approval_status: "pending",
      } as any]);
      if (error) throw error;

      await supabase.from("host_verifications").upsert({ user_id: user.id, hosting_category: "adventure", status: "pending" }, { onConflict: "user_id" });
      toast({ title: "Listing submitted", description: `Ref: ${slug} — Pending admin review.`, duration: 5000 });
      navigate("/become-host");
    } catch (err: any) {
      toast({ title: "Submission error", description: err?.message ?? "Something went wrong.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const wc = wordsOf(f.description);
  const timeSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="rounded-xl h-11 font-semibold border-slate-200"><SelectValue /></SelectTrigger>
      <SelectContent className="bg-white rounded-xl max-h-64">{CHECK_TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
    </Select>
  );
  const descriptionBox = (
    <div>
      <FieldLabel required>Description (max 20 words)</FieldLabel>
      <Textarea rows={4} value={f.description} placeholder="Describe it in 20 words or less…"
        onChange={(e) => { if (e.target.value.trim() === "" || wordsOf(e.target.value) <= 20) set({ description: e.target.value }); }}
        className={cn("rounded-xl border text-sm font-medium resize-none", miss(f.description) ? "border-red-400 ring-2 ring-red-100 bg-red-50" : "border-slate-200 focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080]")} />
      <p className="text-[10px] text-slate-400 mt-1">{wc}/20 words</p>
    </div>
  );

  return (
    <Wizard heading={KIND_META[category].label} steps={steps} step={step} onJump={(n) => { setShowErrors(false); setStep(n); }}
      onNext={handleNext} onPrev={handlePrev} onSubmit={handleSubmit} loading={loading}>

      {currentKey === "reg" && (
        <RegistrationSection title={isAirbnb ? "Host details" : "Registration details"} subtitle={isAirbnb ? "Who is hosting this stay" : "Official business registration information"}
          showTypeSelector={!isHotel} regType={effectiveRegType} setRegType={setRegType}
          name={f.registrationName} setName={(v) => set({ registrationName: v })} number={f.registrationNumber} setNumber={(v) => set({ registrationNumber: v })}
          geo={geo} nameLabel={isHotel ? "Hotel / business name" : "Registration name"} skipPattern={isAirbnb}
          errors={{ name: miss(f.registrationName), number: showErrors && !!regErr, country: showErrors && !geo.country }}>
          {needsLicence && <DocumentUpload title="TRA licence" hint="A clear photo of your Tax Registration Authority licence" img={licence} isInvalid={showErrors && licence.files.length === 0} />}
        </RegistrationSection>
      )}

      {currentKey === "loc" && (
        <SectionCard title="Location details" subtitle="Where is your listing located?" icon={MapPin}>
          <div className="grid gap-5">
            <div><FieldLabel required>Location name</FieldLabel>
              <StyledInput value={f.locationName} onChange={(e) => set({ locationName: e.target.value })} placeholder="Town / area / estate" isInvalid={miss(f.locationName)} /></div>
            <div><FieldLabel required>Map location</FieldLabel>
              <p className="text-[11px] text-slate-400 mb-3">Paste a map link or capture your GPS coordinates</p>
              <LocationPicker latitude={f.latitude} longitude={f.longitude} link={f.locationLink} onLink={(v) => set({ locationLink: v })} onGps={(lat, lng) => set({ latitude: lat, longitude: lng })} /></div>
          </div>
        </SectionCard>
      )}

      {currentKey === "about" && (
        <SectionCard title={isAirbnb ? "About your stay" : "Contact & about"} subtitle="How guests can reach you, and a short description" icon={CheckCircle2}>
          <div className="space-y-5">
            {isAirbnb && (
              <div><FieldLabel required>Listing title</FieldLabel>
                <StyledInput value={f.listingTitle} onChange={(e) => set({ listingTitle: e.target.value })} placeholder="e.g. Cosy studio near Karura Forest" isInvalid={miss(f.listingTitle)} /></div>
            )}
            <div className="grid lg:grid-cols-2 gap-5">
              <div><FieldLabel>Business email</FieldLabel><StyledInput type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="contact@business.com" /></div>
              <div><PhoneInput value={f.phoneNumber} onChange={(v: string) => set({ phoneNumber: v })} country={geo.country} placeholder="712 345 678" /></div>
            </div>
            {descriptionBox}
          </div>
        </SectionCard>
      )}

      {currentKey === "access" && (
        <SectionCard title="Access & pricing" subtitle="Operating hours and entrance fees" icon={Clock}>
          <div className="space-y-8">
            <OperatingHoursSection openingHours={f.openingHours} closingHours={f.closingHours} workingDays={workingDays}
              onOpeningChange={(v: string) => set({ openingHours: v })} onClosingChange={(v: string) => set({ closingHours: v })} onDaysChange={setWorkingDays} accentColor={COLORS.TEAL} />
            <div className="grid lg:grid-cols-3 gap-4">
              <div><FieldLabel>Entrance fee</FieldLabel>
                <Select value={f.entranceFeeType} onValueChange={(v) => set({ entranceFeeType: v })}>
                  <SelectTrigger className="rounded-xl h-11 font-semibold border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white rounded-xl"><SelectItem value="free">Free access</SelectItem><SelectItem value="paid">Paid admission</SelectItem></SelectContent>
                </Select></div>
              {f.entranceFeeType === "paid" && (<>
                <div><FieldLabel>Citizen — adult entry (KSh)</FieldLabel><StyledInput type="number" value={f.adultPrice} onChange={(e) => set({ adultPrice: e.target.value })} />
                  {parseFloat(f.adultPrice) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-1">{usdHint(parseFloat(f.adultPrice))}</p>}</div>
                <div><FieldLabel>Citizen — child entry (KSh)</FieldLabel><StyledInput type="number" min="0" value={f.childPrice} onChange={(e) => set({ childPrice: e.target.value })} />
                  {parseFloat(f.childPrice) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-1">{usdHint(parseFloat(f.childPrice))}</p>}</div>
              </>)}
            </div>
            {f.entranceFeeType === "paid" && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><Globe className="h-4 w-4 text-amber-600" /></div>
                    <div><p className="text-sm font-black text-slate-800">Non-citizen pricing</p><p className="text-[11px] text-slate-500">Charge a different rate for international visitors</p></div>
                  </div>
                  <button type="button" onClick={() => set({ hasNonCitizen: !f.hasNonCitizen })} className={cn("relative w-11 h-6 rounded-full transition-all shrink-0", f.hasNonCitizen ? "bg-amber-500" : "bg-slate-300")}>
                    <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", f.hasNonCitizen && "translate-x-5")} />
                  </button>
                </div>
                {f.hasNonCitizen && (
                  <div className="grid grid-cols-2 gap-4">
                    <div><FieldLabel>Non-citizen — adult (KSh)</FieldLabel><StyledInput type="number" value={f.ncAdult} onChange={(e) => set({ ncAdult: e.target.value })} /></div>
                    <div><FieldLabel>Non-citizen — child (KSh)</FieldLabel><StyledInput type="number" value={f.ncChild} onChange={(e) => set({ ncChild: e.target.value })} /></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {currentKey === "stay" && (
        <SectionCard title="Stay details" subtitle="Star rating, check-in times, policy and hotel amenities" icon={Clock}>
          <div className="space-y-8">
            <div><FieldLabel>Star rating (optional)</FieldLabel><StarRatingPicker value={f.starRating} onChange={(v) => set({ starRating: v })} /></div>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div><FieldLabel>Check-in from</FieldLabel>{timeSelect(f.checkIn, (v) => set({ checkIn: v }))}</div>
              <div><FieldLabel>Check-out by</FieldLabel>{timeSelect(f.checkOut, (v) => set({ checkOut: v }))}</div>
            </div>
            <div><FieldLabel>Cancellation policy (optional)</FieldLabel>
              <Textarea rows={3} value={f.cancellationPolicy} onChange={(e) => set({ cancellationPolicy: e.target.value })} placeholder="e.g. Free cancellation up to 48 hours before check-in." className="rounded-xl border border-slate-200 text-sm font-medium resize-none" /></div>
            <GeneralFacilitiesSelector selected={generalFacilities} onChange={setGeneralFacilities} accentColor={COLORS.TEAL} />
          </div>
        </SectionCard>
      )}

      {currentKey === "units" && (
        <SectionCard title={isHotel ? "Rooms" : "Amenities, facilities & activities"} subtitle={isHotel ? "Add each room type with its nightly price and photos" : "What can guests enjoy at your listing?"} icon={isHotel ? BedDouble : DollarSign}>
          <div className="space-y-8">
            {isCampsite && <GeneralFacilitiesSelector selected={generalFacilities} onChange={setGeneralFacilities} accentColor={COLORS.TEAL} />}
            <UnitBuilder items={units} onChange={setUnits} showErrors={showErrors} onFail={onFail} isRoom={isHotel} />
            {isCampsite && <ActivityBuilder items={activities} onChange={setActivities} showErrors={showErrors} onFail={onFail} />}
            {isCampsite && <SpecialPriceBuilder items={tiers} onChange={setTiers} showErrors={showErrors} onFail={onFail} />}
          </div>
        </SectionCard>
      )}

      {currentKey === "property" && (
        <SectionCard title="Property details" subtitle="Type, size, price, check-in and amenities" icon={Home}>
          <div className="space-y-8">
            <div><FieldLabel required>Property type</FieldLabel><OptionTiles options={PROPERTY_TYPES} value={f.propertyType} onChange={(v) => set({ propertyType: v })} /></div>
            <div className="grid lg:grid-cols-2 gap-3">
              <Counter label="Guests" value={f.guests} min={1} onChange={(v) => set({ guests: v })} />
              <Counter label="Bedrooms" value={f.bedrooms} min={0} onChange={(v) => set({ bedrooms: v })} />
              <Counter label="Beds" value={f.beds} min={1} onChange={(v) => set({ beds: v })} />
              <Counter label="Bathrooms" value={f.bathrooms} min={1} onChange={(v) => set({ bathrooms: v })} />
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <div><FieldLabel required>Price / night (KSh)</FieldLabel><StyledInput type="number" min={0} value={f.price} onChange={(e) => set({ price: e.target.value })} placeholder="0" isInvalid={showErrors && !priceValid} />
                {priceValid && <p className="text-[10px] text-blue-500 font-semibold mt-1">{usdHint(parseFloat(f.price))}</p>}</div>
              <div><FieldLabel>Cleaning fee (KSh, optional)</FieldLabel><StyledInput type="number" min={0} value={f.cleaningFee} onChange={(e) => set({ cleaningFee: e.target.value })} placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div><FieldLabel>Check-in from</FieldLabel>{timeSelect(f.checkIn, (v) => set({ checkIn: v }))}</div>
              <div><FieldLabel>Check-out by</FieldLabel>{timeSelect(f.checkOut, (v) => set({ checkOut: v }))}</div>
            </div>
            <div><FieldLabel>House rules (optional)</FieldLabel>
              <Textarea rows={3} value={f.houseRules} onChange={(e) => set({ houseRules: e.target.value })} placeholder="e.g. No smoking, no parties, quiet hours after 10pm." className="rounded-xl border border-slate-200 text-sm font-medium resize-none" /></div>
            <div><FieldLabel>Cancellation policy (optional)</FieldLabel>
              <Textarea rows={3} value={f.cancellationPolicy} onChange={(e) => set({ cancellationPolicy: e.target.value })} placeholder="e.g. Free cancellation up to 48 hours before check-in." className="rounded-xl border border-slate-200 text-sm font-medium resize-none" /></div>
            <GeneralFacilitiesSelector selected={generalFacilities} onChange={setGeneralFacilities} accentColor={COLORS.TEAL} />
          </div>
        </SectionCard>
      )}

      {currentKey === "gallery" && (
        <SectionCard title={`Photo gallery — ${gallery.files.length}/5 uploaded`} subtitle={gallery.files.length < 5 ? `You need ${5 - gallery.files.length} more photos to continue` : "All 5 photos ready ✓"} icon={Camera}>
          {gallery.files.length < 5 && showErrors && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl"><span className="text-red-500">⚠</span><p className="text-red-600 text-xs font-semibold">Upload at least {5 - gallery.files.length} more photos</p></div>
          )}
          {gallery.compressing && <CompressingBanner />}
          <ImageGalleryGrid previews={gallery.previews} onRemove={gallery.remove} onAdd={(l) => { gallery.add(l); }} isInvalid={showErrors && gallery.files.length < 5} />
          <p className="text-[10px] text-slate-400 mt-3 font-medium">JPG or PNG only. First photo becomes your cover image.</p>
        </SectionCard>
      )}

      {currentKey === "review" && (
        <ReviewStep type="adventure" accentColor={COLORS.TEAL} creatorEmail={user?.email}
          data={{
            category, name: isAirbnb ? f.listingTitle : f.registrationName, registrationName: f.registrationName, registrationNumber: f.registrationNumber,
            locationName: f.locationName, place: geo.place, country: geo.country, description: f.description, email: f.email, phoneNumber: f.phoneNumber,
            openingHours: isCampsite ? f.openingHours : f.checkIn, closingHours: isCampsite ? f.closingHours : f.checkOut,
            workingDays: isCampsite ? ALL_DAYS.filter((d) => workingDays[d]) : ALL_DAYS,
            entranceFeeType: isCampsite ? f.entranceFeeType : "free", adultPrice: isCampsite ? f.adultPrice : "0", childPrice: isCampsite ? f.childPrice : "0",
            hasNonCitizenPricing: isCampsite && f.hasNonCitizen, nonCitizenAdultPrice: isCampsite ? f.ncAdult : "0", nonCitizenChildPrice: isCampsite ? f.ncChild : "0",
            latitude: f.latitude, longitude: f.longitude, generalFacilities,
            facilities: isAirbnb
              ? [{
                  name: `${f.listingTitle} (${f.propertyType})`, price: parseFloat(f.price) || 0, capacity: f.guests,
                  amenities: [`${f.bedrooms} bedroom${f.bedrooms === 1 ? "" : "s"}`, `${f.beds} bed${f.beds === 1 ? "" : "s"}`, `${f.bathrooms} bathroom${f.bathrooms === 1 ? "" : "s"}`],
                  images: gallery.previews,
                }]
              : units.filter((u) => u.saved).map((u) => ({ name: u.name, price: parseFloat(u.price) || 0, capacity: parseInt(u.capacity, 10) || null, amenities: u.amenities, images: u.previewUrls })),
            activities: isCampsite ? activities.filter((a) => a.saved && a.name.trim()).map((a) => ({ name: a.name, price: parseFloat(a.price) || 0, images: a.previewUrls })) : [],
            specialPrices: isCampsite ? tiers.filter((t) => t.saved && t.label.trim()).map((t) => ({ label: t.label, citizenPrice: parseFloat(t.citizenPrice) || 0, nonCitizenPrice: parseFloat(t.nonCitizenPrice) || 0, requirement: t.requirement })) : [],
            galleryPreviewUrls: gallery.previews,
          } as any} />
      )}
    </Wizard>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════
const StateCard = ({ icon: Icon, tone, title, message, children }: { icon: any; tone: "red" | "amber" | "teal"; title: string; message: string; children?: React.ReactNode }) => {
  const tones = { red: "bg-red-50 text-red-500 border-red-200", amber: "bg-amber-50 text-amber-600 border-amber-200", teal: "bg-teal-50 text-teal-600 border-teal-200" };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center max-w-lg mx-auto">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border ${tones[tone]}`}><Icon className="h-7 w-7" /></div>
      <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-slate-500 leading-relaxed mb-6">{message}</p>
      {children}
    </div>
  );
};

const CreateListing = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack("/become-host");
  const { user } = useAuth();
  const [params] = useSearchParams();
  useBanCheck();

  useEffect(() => { if (!user) navigate("/auth"); }, [user, navigate]);

  const access = useHostAccess(user, navigate);
  const [picked, setPicked] = useState<Kind | null>(null);

  if (!user) return null;

  let body: React.ReactNode;
  if (access.state === "loading") {
    body = <div className="min-h-[40vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: COLORS.TEAL }} /></div>;
  } else if (access.state === "banned") {
    body = <StateCard icon={Ban} tone="red" title="Hosting access restricted" message="Your account has been banned from hosting. If you think this is a mistake, contact support." />;
  } else if (access.state === "blocked") {
    body = (
      <StateCard icon={Info} tone="amber" title={access.title} message={access.message}>
        {access.cta && <Button onClick={() => navigate(access.cta!.to)} className="rounded-xl text-white font-semibold" style={{ background: COLORS.TEAL }}>{access.cta.label}</Button>}
      </StateCard>
    );
  } else {
    const fromUrl = params.get("type") as Kind | null;
    const kind: Kind | null = picked ?? (fromUrl && access.kinds.includes(fromUrl) ? fromUrl : access.kinds.length === 1 ? access.kinds[0] : null);

    if (!kind) {
      body = (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">What are you hosting?</h1>
            <p className="text-sm text-slate-400 mt-1">You can only create the kinds of listing you're set up for.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {access.kinds.map((k) => {
              const m = KIND_META[k];
              return (
                <button key={k} type="button" onClick={() => setPicked(k)} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left hover:-translate-y-1 hover:shadow-md transition-all">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${COLORS.TEAL}14` }}><m.icon className="h-6 w-6" style={{ color: COLORS.TEAL }} /></div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">{m.label}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{m.desc}</p>
                </button>
              );
            })}
          </div>
          {access.canVerify && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-100">
              <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" style={{ color: COLORS.TEAL }} />
              <div className="text-sm text-slate-500">Want to host trips or events instead? <button type="button" onClick={() => navigate("/host-verification")} className="font-bold underline" style={{ color: COLORS.TEAL }}>Verify as a guide or company</button> first.</div>
            </div>
          )}
        </div>
      );
    } else {
      body = (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={access.kinds.length > 1 ? () => setPicked(null) : goBack} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 shadow-sm" aria-label="Back">
              <ArrowLeft className="h-4 w-4 text-slate-600" />
            </button>
            {access.kinds.length > 1 && <p className="text-xs text-slate-400 font-medium">Change type</p>}
          </div>
          {kind === "trip" || kind === "event"
            ? <TripEventForm key={kind} kind={kind} user={user} host={access.host} />
            : <PlaceForm key={kind} category={kind} user={user} />}
        </div>
      );
    }
  }

  return <HostLayout>{body}</HostLayout>;
};

export default CreateListing;