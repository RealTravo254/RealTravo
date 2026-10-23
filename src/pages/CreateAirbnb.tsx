import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBanCheck } from "@/hooks/useBanCheck";
import {
  MapPin, Navigation, Clock, X, Camera, CheckCircle2, Info, ArrowLeft, Loader2,
  Home, ChevronLeft, ChevronRight, Link2, Building2, UserRound, Minus, Plus,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { compressImages } from "@/lib/imageCompression";
import { ReviewStep } from "@/components/creation/ReviewStep";
import { GeneralFacilitiesSelector } from "@/components/creation/GeneralFacilitiesSelector";
import { CreateFormStepper } from "@/components/creation/CreateFormStepper";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

/**
 * ── CreateAirbnb ─────────────────────────────────────────────────────────
 * Airbnb-style, accommodation-only hosting: ONE bookable property (an
 * entire home, apartment, villa, cabin, private room …) — no room-type
 * builder and no hotel TRA licence. Hotels keep using CreateHotel.
 *
 * Saved to the same `adventure_places` table with category = 'airbnb'.
 * The property details (type, guests, bedrooms, beds, bathrooms, nightly
 * price, cleaning fee, house rules) are stored as a single entry inside the
 * existing `facilities` jsonb column, so no new columns are needed beyond
 * the ones CreateHotel already requires:
 *
 *   alter table public.adventure_places
 *     add column if not exists division_id uuid references public.country_divisions(id),
 *     add column if not exists registration_type text not null default 'company',
 *     add column if not exists cancellation_policy text;
 *
 * If `adventure_places.category` has a CHECK constraint / enum, add 'airbnb'
 * to it. Route to register:  <Route path="/create-airbnb" element={<CreateAirbnb />} />
 * ────────────────────────────────────────────────────────────────────────── */

const COLORS = { TEAL: "#008080", CORAL: "#FF7F50", KHAKI: "#F0E68C", KHAKI_DARK: "#857F3E" };

const generateFriendlySlug = (name: string): string => {
  const clean = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").substring(0, 30);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${clean}-${code}`;
};
const safeObjectUrl = (file: File): string => { try { return URL.createObjectURL(file); } catch { return ""; } };
const isImageFile = (file: File) => file.type.startsWith("image/");
const namesClash = (a: string, b: string) => !!a.trim() && !!b.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();

const STEP_NAMES = ["Host Details", "Location", "About", "Property", "Gallery", "Review"];
const CHECK_TIMES = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
const PROPERTY_TYPES = [
  "Entire apartment", "Entire house", "Villa", "Cottage", "Cabin",
  "Studio", "Guesthouse", "Private room", "Treehouse", "Tent / Glamping",
];
const REGISTRATION_TYPE_OPTIONS = [
  { value: "company", label: "Company", icon: Building2 },
  { value: "guide", label: "Individual", icon: UserRound },
];

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

const SectionCard = ({ title, subtitle, icon: Icon, children, accent = COLORS.TEAL }: {
  title?: string; subtitle?: string; icon?: any; children: React.ReactNode; accent?: string;
}) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
    {title && (
      <div className="px-8 py-5 border-b border-slate-100 flex items-center gap-3">
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
    <div className="px-8 py-6">{children}</div>
  </div>
);

const CompressingBanner = ({ label = "Compressing photos…" }: { label?: string }) => (
  <div className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-xl">
    <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
    <p className="text-teal-700 text-xs font-semibold">{label}</p>
  </div>
);

// ─── Counter (guests / bedrooms / beds / bathrooms) ───────────────────────────
const Counter = ({ label, value, onChange, min = 0, max = 50 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) => (
  <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white">
    <span className="text-sm font-bold text-slate-700">{label}</span>
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-6 text-center text-sm font-black text-slate-800">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

// ─── Registration type selector ───────────────────────────────────────────────
const RegistrationTypeSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="grid grid-cols-2 gap-2.5 p-1 max-w-sm">
    {REGISTRATION_TYPE_OPTIONS.map((opt) => {
      const isActive = value === opt.value;
      return (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 h-20 rounded-xl text-[11px] font-bold border transition-all",
            isActive ? "text-white shadow-md border-transparent scale-[1.02]" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
          )}
          style={isActive ? { background: COLORS.TEAL } : {}}>
          <opt.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-400")} />
          {opt.label}
        </button>
      );
    })}
  </div>
);

// ─── Image grid ───────────────────────────────────────────────────────────────
const ImageGalleryGrid = ({ previews, onRemove, onAdd, isInvalid, slots = 5 }: {
  previews: string[]; onRemove: (i: number) => void; onAdd: (files: FileList | null) => void; isInvalid?: boolean; slots?: number;
}) => (
  <div
    className={`grid gap-3 p-4 rounded-xl border-2 border-dashed transition-all ${isInvalid ? "border-red-400 bg-red-50/30" : "border-slate-200 bg-slate-50/40"}`}
    style={{ gridTemplateColumns: `repeat(${Math.min(slots, 5)}, minmax(0, 1fr))` }}
  >
    {Array.from({ length: slots }).map((_, i) => {
      const url = previews[i];
      if (url) return (
        <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <img src={url} className="w-full h-full object-cover" alt={`Photo ${i + 1}`} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
            <button type="button" onClick={() => onRemove(i)} className="opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-1 shadow-lg transition-all scale-75 group-hover:scale-100">
              <X className="h-3 w-3" />
            </button>
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

// ─── Step sidebar ─────────────────────────────────────────────────────────────
const StepSidebar = ({ steps, currentStep, onStepClick }: { steps: { name: string; isComplete: boolean }[]; currentStep: number; onStepClick?: (i: number) => void }) => (
  <aside className="hidden lg:flex flex-col w-72 shrink-0 sticky top-24 self-start">
    <div className="rounded-2xl overflow-hidden mb-6 relative h-44">
      <img src="/images/category-hotel.webp" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/images/category-campsite.webp"; }} className="w-full h-full object-cover" alt="" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute bottom-4 left-5 right-5">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS.KHAKI }}>Airbnb · Stay</span>
        <h2 className="text-white text-xl font-black uppercase tracking-tight leading-tight mt-0.5">Create Airbnb</h2>
      </div>
    </div>
    <nav className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Your progress</p>
      </div>
      <ul className="p-3 space-y-1">
        {steps.map((step, i) => {
          const num = i + 1;
          const isActive = currentStep === num;
          const isPast = currentStep > num;
          const isDone = step.isComplete && isPast;
          return (
            <li key={i}>
              <button type="button" onClick={() => isPast && onStepClick?.(num)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${isActive ? "bg-[#008080] text-white shadow-md" : isPast ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${isActive ? "bg-white text-[#008080]" : isDone ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : num}
                </div>
                <div className="min-w-0">
                  <p className={`text-[12px] font-bold truncate ${isActive ? "text-white" : isDone ? "text-emerald-700" : "text-slate-500"}`}>{step.name}</p>
                  {isActive && <p className="text-[10px] text-white/70 mt-0.5">Current step</p>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
    <div className="mt-4 bg-slate-50 rounded-2xl p-5 border border-slate-100">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Need help?</p>
      <p className="text-xs text-slate-400 leading-relaxed">Fill each step carefully. Your listing will be reviewed before going live.</p>
    </div>
  </aside>
);

// ─── Main component ───────────────────────────────────────────────────────────
const CreateAirbnb = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack("/become-host");
  const { toast } = useToast();
  const { user } = useAuth();
  const { usdHint } = useCurrency();
  useBanCheck();

  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Company or Individual registration. Verified hosts have this locked from
  // their approved `host_verifications` record.
  const [registrationType, setRegistrationType] = useState<string>("company");
  const [verifiedHost, setVerifiedHost] = useState<{ type: "company" | "guide"; name: string; number: string } | null>(null);
  const [verifiedLoaded, setVerifiedLoaded] = useState(false);

  const [formData, setFormData] = useState({
    registrationName: "", registrationNumber: "",
    listingTitle: "", locationName: "", place: "", country: "",
    description: "", email: "", phoneNumber: "",
    propertyType: "Entire apartment",
    guests: 2, bedrooms: 1, beds: 1, bathrooms: 1,
    price: "", cleaningFee: "",
    checkInTime: "14:00", checkOutTime: "11:00",
    houseRules: "", cancellationPolicy: "",
    latitude: null as number | null, longitude: null as number | null, locationLink: "",
  });

  const [locationMode, setLocationMode] = useState<"link" | "gps" | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [isCompressingGallery, setIsCompressingGallery] = useState(false);

  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);

  const onValidationFail = useCallback((msg: string) => toast({ title: "Required", description: msg, variant: "destructive" }), [toast]);

  // ── Auth guard + country pre-fill ──
  useEffect(() => {
    if (!user) {
      toast({ title: "Login Required", description: "You must be logged in to host a listing.", variant: "destructive" });
      navigate("/login");
      return;
    }
    supabase.from("profiles").select("country").eq("id", user.id).single().then(async ({ data }) => {
      if (!data?.country) return;
      const { data: countryRow } = await supabase.from("countries").select("id").ilike("name", data.country).maybeSingle();
      if (countryRow?.id) setSelectedCountryId(countryRow.id);
      else setFormData((p) => ({ ...p, country: data.country }));
    });
  }, [user, navigate, toast]);

  // ── Verified host lookup (locks Company / Individual) ──
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("host_verifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const raw = String((data as any).host_type ?? (data as any).registration_type ?? "").toLowerCase();
        const type: "company" | "guide" = raw === "company" ? "company" : "guide";
        const name: string = (data as any).registration_name ?? "";
        const number: string = (data as any).registration_number ?? "";
        setVerifiedHost({ type, name, number });
        setRegistrationType(type);
        setFormData((p) => ({
          ...p,
          registrationName: name || p.registrationName,
          registrationNumber: number || p.registrationNumber,
        }));
      }
      setVerifiedLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ── Resolve ids → names ──
  useEffect(() => {
    let cancelled = false;
    if (!selectedCountryId) { setFormData((p) => ({ ...p, country: "" })); return; }
    (async () => {
      const { data } = await supabase.from("countries").select("name").eq("id", selectedCountryId).maybeSingle();
      if (!cancelled && data?.name) setFormData((p) => ({ ...p, country: data.name }));
    })();
    return () => { cancelled = true; };
  }, [selectedCountryId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedDivisionId) { setFormData((p) => ({ ...p, place: "" })); return; }
    (async () => {
      const { data } = await supabase.from("country_divisions").select("name").eq("id", selectedDivisionId).maybeSingle();
      if (!cancelled && data?.name) setFormData((p) => ({ ...p, place: data.name }));
    })();
    return () => { cancelled = true; };
  }, [selectedDivisionId]);

  const getRegistrationNumberError = (): string | null => {
    if (!formData.registrationNumber.trim())
      return registrationType === "guide" ? "Please enter your ID number." : "Please enter your business registration number.";
    if (namesClash(formData.registrationName, formData.registrationNumber))
      return "Your registration number can't be the same as your registration name.";
    return null;
  };

  const priceValid = parseFloat(formData.price) > 0;

  const isStep1Complete = !!formData.registrationName.trim() && !getRegistrationNumberError() && !!formData.country;
  const isStep2Complete = !!formData.locationName.trim() && (!!formData.latitude || !!formData.locationLink.trim());
  const isStep3Complete = !!formData.listingTitle.trim() && !!formData.description.trim();
  const isStep4Complete = priceValid && formData.guests >= 1 && formData.bedrooms >= 0 && formData.bathrooms >= 1;
  const isStep5Complete = galleryImages.length >= 5;

  const steps = [
    { name: STEP_NAMES[0], isComplete: isStep1Complete },
    { name: STEP_NAMES[1], isComplete: isStep2Complete },
    { name: STEP_NAMES[2], isComplete: isStep3Complete },
    { name: STEP_NAMES[3], isComplete: isStep4Complete },
    { name: STEP_NAMES[4], isComplete: isStep5Complete },
    { name: STEP_NAMES[5], isComplete: isStep1Complete && isStep2Complete && isStep3Complete && isStep4Complete && isStep5Complete },
  ];

  const isMissing = (v: any) => {
    if (!showErrors) return false;
    if (typeof v === "string") return !v.trim();
    return v === null || v === undefined;
  };

  const validateCurrentStep = (): boolean => {
    const fail = (title: string, description: string) => {
      setShowErrors(true);
      toast({ title, description, variant: "destructive" });
      return false;
    };
    if (currentStep === 1) {
      if (!formData.registrationName.trim() || !formData.country) return fail("Complete this step", "Fill all required fields");
      const regError = getRegistrationNumberError();
      if (regError) return fail("Registration Details Required", regError);
    } else if (currentStep === 2) {
      if (!formData.locationName.trim() || (!formData.latitude && !formData.locationLink.trim()))
        return fail("Complete this step", "Fill location and provide a link or GPS");
    } else if (currentStep === 3) {
      if (!formData.listingTitle.trim()) return fail("Complete this step", "Give your listing a title");
      if (!formData.description.trim()) return fail("Complete this step", "Description is required");
    } else if (currentStep === 4) {
      if (!priceValid) return fail("Price Required", "Enter a price per night greater than 0");
    } else if (currentStep === 5) {
      if (galleryImages.length < 5) return fail("Photos Required", `Upload ${5 - galleryImages.length} more photos`);
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setShowErrors(false);
    setCurrentStep((p) => Math.min(p + 1, 6));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrev = () => {
    setShowErrors(false);
    setCurrentStep((p) => Math.max(p - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getCurrentLocation = () => {
    if (!("geolocation" in navigator)) return;
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setFormData((p) => ({ ...p, latitude: coords.latitude, longitude: coords.longitude }));
        toast({ title: "Location captured", description: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` });
        setIsGettingLocation(false);
      },
      () => {
        toast({ title: "GPS Error", description: "Could not get location.", variant: "destructive" });
        setIsGettingLocation(false);
      }
    );
  };

  const handleGalleryUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const slots = 5 - galleryImages.length;
    if (slots <= 0) return;
    const incoming = Array.from(files).slice(0, slots);
    if (incoming.some((f) => !isImageFile(f))) {
      toast({ title: "File type not supported", description: "Only JPG and PNG images are accepted.", variant: "destructive" });
      return;
    }
    setIsCompressingGallery(true);
    let merged: File[];
    try { const c = await compressImages(incoming); merged = [...galleryImages, ...c.map((x) => x.file)].slice(0, 5); }
    catch { merged = [...galleryImages, ...incoming].slice(0, 5); }
    finally { setIsCompressingGallery(false); }
    setGalleryImages(merged);
    setGalleryPreviews(merged.map(safeObjectUrl));
  };

  const removeGalleryImage = (idx: number) => {
    const updated = galleryImages.filter((_, i) => i !== idx);
    setGalleryImages(updated);
    setGalleryPreviews(updated.map(safeObjectUrl));
  };

  const uploadFile = async (file: File, prefix: string): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user!.id}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("listing-images").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) { navigate("/login"); return; }
    setShowErrors(true);
    if (!isStep1Complete || !isStep2Complete || !isStep3Complete || !isStep4Complete || !isStep5Complete) {
      toast({ title: "Action Required", description: "Please complete all steps including 5 gallery photos.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const friendlySlug = generateFriendlySlug(formData.listingTitle);
      const galleryUrls = await Promise.all(galleryImages.map((f) => uploadFile(f, "gallery")));

      // The single Airbnb property is stored as one entry in `facilities`,
      // in the same shape hotel room types use, plus the extra property fields.
      const propertyForDB = {
        name: formData.listingTitle,
        property_type: formData.propertyType,
        price: parseFloat(formData.price) || 0,
        cleaning_fee: parseFloat(formData.cleaningFee) || 0,
        capacity: formData.guests,
        guests: formData.guests,
        bedrooms: formData.bedrooms,
        beds: formData.beds,
        bathrooms: formData.bathrooms,
        house_rules: formData.houseRules.trim() || null,
        amenities,
        images: galleryUrls,
        quantity: 1,
      };

      const { error } = await supabase.from("adventure_places").insert([{
        id: friendlySlug, slug: friendlySlug, name: formData.listingTitle,
        category: "airbnb",
        registration_name: formData.registrationName,
        registration_number: formData.registrationNumber,
        registration_type: registrationType,
        location: formData.locationName, place: formData.place, country: formData.country,
        division_id: selectedDivisionId,
        description: formData.description, email: formData.email,
        phone_numbers: formData.phoneNumber ? [formData.phoneNumber] : [],
        map_link: formData.latitude
          ? `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`
          : (formData.locationLink || ""),
        latitude: formData.latitude, longitude: formData.longitude,
        opening_hours: formData.checkInTime, closing_hours: formData.checkOutTime,
        days_opened: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        image_url: galleryUrls[0] ?? "", gallery_images: galleryUrls,
        entry_fee_type: "free", entry_fee: 0, child_entry_fee: 0,
        has_non_citizen_pricing: false, non_citizen_entry_fee: 0, non_citizen_child_entry_fee: 0,
        special_entry_prices: [],
        cancellation_policy: formData.cancellationPolicy.trim() || null,
        amenities, facilities: [propertyForDB], activities: [],
        created_by: user.id,
        approval_status: "pending",
      } as any]);
      if (error) throw error;

      await supabase.from("host_verifications").upsert(
        { user_id: user.id, hosting_category: "adventure", status: "pending" },
        { onConflict: "user_id" }
      );

      toast({ title: "Airbnb Submitted", description: `Ref: ${friendlySlug} — Pending admin review.`, duration: 5000 });
      navigate("/become-host");
    } catch (err: any) {
      toast({ title: "Submission Error", description: err?.message ?? "Something went wrong.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const locationModeOptions: { mode: "link" | "gps"; label: string; icon: React.ElementType }[] = [
    { mode: "link", label: "Paste Map Link", icon: Link2 },
    { mode: "gps", label: "Use My GPS", icon: Navigation },
  ];

  const wordCount = formData.description.trim() ? formData.description.trim().split(/\s+/).length : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />

      {/* Mobile hero */}
      <div className="lg:hidden relative h-36 overflow-hidden bg-slate-900">
        <img src="/images/category-hotel.webp" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/images/category-campsite.webp"; }} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-5">
          <Button onClick={goBack} className="absolute top-4 left-4 rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">
            Create <span style={{ color: COLORS.KHAKI }}>Airbnb</span>
          </h1>
          <p className="text-white/60 text-xs font-semibold mt-0.5">Step {currentStep} of {STEP_NAMES.length}</p>
        </div>
      </div>

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6 lg:py-10">
        <div className="flex gap-8 items-start">
          <StepSidebar steps={steps} currentStep={currentStep} onStepClick={(n) => { setShowErrors(false); setCurrentStep(n); }} />

          <div className="flex-1 min-w-0 space-y-5">
            {/* Desktop title */}
            <div className="hidden lg:flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm">
                  <ArrowLeft className="h-4 w-4 text-slate-600" />
                </button>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">{STEP_NAMES[currentStep - 1]}</h1>
                  <p className="text-sm text-slate-400 font-medium mt-0.5">Step {currentStep} of {STEP_NAMES.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((currentStep - 1) / (STEP_NAMES.length - 1)) * 100}%`, background: COLORS.TEAL }} />
                </div>
                <span className="text-xs font-bold text-slate-400">{Math.round(((currentStep - 1) / (STEP_NAMES.length - 1)) * 100)}%</span>
              </div>
            </div>

            <div className="lg:hidden"><CreateFormStepper steps={steps} currentStep={currentStep} /></div>

            {/* ══ STEP 1 — Host Details ══ */}
            {currentStep === 1 && (
              <SectionCard title="Host Details" subtitle={verifiedHost ? "Pulled from your verified host profile" : "Who is hosting this stay"} icon={Info}>
                <div className="grid gap-5">
                  <div>
                    <FieldLabel required>Hosting As</FieldLabel>
                    {!verifiedLoaded ? (
                      <div className="h-20 max-w-sm rounded-xl bg-slate-100 animate-pulse" />
                    ) : verifiedHost ? (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 max-w-sm">
                        {verifiedHost.type === "company" ? <Building2 className="h-5 w-5 text-emerald-600" /> : <UserRound className="h-5 w-5 text-emerald-600" />}
                        <div>
                          <p className="text-sm font-bold text-emerald-700">{verifiedHost.type === "company" ? "Company" : "Individual"}</p>
                          <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Verified host</p>
                        </div>
                      </div>
                    ) : (
                      <RegistrationTypeSelector value={registrationType} onChange={setRegistrationType} />
                    )}
                  </div>
                  <div>
                    <FieldLabel required>{registrationType === "guide" ? "Your Full Legal Name" : "Business / Company Name"}</FieldLabel>
                    <StyledInput
                      value={formData.registrationName}
                      disabled={!!verifiedHost?.name}
                      onChange={(e) => setFormData({ ...formData, registrationName: e.target.value })}
                      placeholder={registrationType === "guide" ? "As on your ID" : "Official registered name"}
                      isInvalid={isMissing(formData.registrationName) || (showErrors && namesClash(formData.registrationName, formData.registrationNumber))}
                    />
                  </div>
                  <div className="grid lg:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel required>{registrationType === "guide" ? "ID / Passport Number" : "Business Registration Number"}</FieldLabel>
                      <StyledInput
                        value={formData.registrationNumber}
                        disabled={!!verifiedHost?.number}
                        onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                        placeholder={registrationType === "guide" ? "e.g. 23456789" : "e.g. BN-X12345"}
                        isInvalid={showErrors && !!getRegistrationNumberError()}
                      />
                      {showErrors && getRegistrationNumberError() && (
                        <p className="text-red-400 text-[10px] font-semibold mt-1">{getRegistrationNumberError()}</p>
                      )}
                    </div>
                    <div>
                      <FieldLabel required>Country</FieldLabel>
                      <div className={cn("rounded-xl", isMissing(formData.country) && "ring-2 ring-red-300")}>
                        <CountrySelector
                          countryId={selectedCountryId}
                          divisionId={selectedDivisionId}
                          onChange={({ countryId, divisionId }) => {
                            setSelectedCountryId(countryId);
                            setSelectedDivisionId(divisionId);
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Selecting a division/region helps guests find your stay when browsing by region.</p>
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 2 — Location ══ */}
            {currentStep === 2 && (
              <SectionCard title="Location Details" subtitle="Where is your property located?" icon={MapPin}>
                <div className="grid gap-5">
                  <div>
                    <FieldLabel required>Location Name</FieldLabel>
                    <StyledInput value={formData.locationName} onChange={(e) => setFormData({ ...formData, locationName: e.target.value })} placeholder="Town / Area / Estate" isInvalid={isMissing(formData.locationName)} />
                  </div>
                  <div>
                    <FieldLabel required>Map Location</FieldLabel>
                    <p className="text-[11px] text-slate-400 mb-3">Paste a map link or capture your GPS coordinates</p>
                    <div className="flex gap-3 mb-4">
                      {locationModeOptions.map(({ mode, label, icon: Icon }) => (
                        <button key={mode} type="button" onClick={() => setLocationMode(mode)}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all ${locationMode === mode ? "text-white shadow-md" : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                          style={locationMode === mode ? { background: COLORS.TEAL } : {}}>
                          <Icon className="h-3.5 w-3.5" /> {label}
                        </button>
                      ))}
                    </div>
                    {locationMode === "link" && (
                      <StyledInput value={formData.locationLink} onChange={(e) => setFormData({ ...formData, locationLink: e.target.value })} placeholder="https://maps.google.com/..." />
                    )}
                    {locationMode === "gps" && (
                      <button type="button" onClick={getCurrentLocation} disabled={isGettingLocation}
                        className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-white text-sm font-bold transition-all active:scale-[0.98] shadow-md hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
                        style={{ background: formData.latitude ? "#16a34a" : COLORS.KHAKI_DARK }}>
                        {isGettingLocation
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Getting Location...</>
                          : formData.latitude
                          ? <><CheckCircle2 className="h-4 w-4" /> Location Captured — {formData.latitude.toFixed(4)}, {formData.longitude?.toFixed(4)}</>
                          : <><Navigation className="h-4 w-4" /> Tap to Capture GPS Location</>}
                      </button>
                    )}
                  </div>
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 3 — About ══ */}
            {currentStep === 3 && (
              <SectionCard title="About Your Stay" subtitle="Title, description and how guests can reach you" icon={CheckCircle2}>
                <div className="space-y-5">
                  <div>
                    <FieldLabel required>Listing Title</FieldLabel>
                    <StyledInput value={formData.listingTitle} onChange={(e) => setFormData({ ...formData, listingTitle: e.target.value })} placeholder="e.g. Cosy Studio near Karura Forest" isInvalid={isMissing(formData.listingTitle)} />
                  </div>
                  <div>
                    <FieldLabel required>Description (max 20 words)</FieldLabel>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => {
                        const words = e.target.value.trim().split(/\s+/);
                        if (e.target.value.trim() === "" || words.length <= 20) setFormData({ ...formData, description: e.target.value });
                      }}
                      placeholder="Describe your place in 20 words or less..."
                      rows={4}
                      className={cn("rounded-xl border text-sm font-medium resize-none transition-all", isMissing(formData.description) ? "border-red-400 ring-2 ring-red-100 bg-red-50" : "border-slate-200 focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080]")}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">{wordCount}/20 words</p>
                  </div>
                  <div className="grid lg:grid-cols-2 gap-5">
                    <div>
                      <FieldLabel>Contact Email</FieldLabel>
                      <StyledInput type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="host@example.com" />
                    </div>
                    <div>
                      <PhoneInput value={formData.phoneNumber} onChange={(v) => setFormData({ ...formData, phoneNumber: v })} country={formData.country} placeholder="712 345 678" />
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 4 — Property ══ */}
            {currentStep === 4 && (
              <SectionCard title="Property Details" subtitle="Type, size, price, check-in and amenities" icon={Home}>
                <div className="space-y-8">
                  <div>
                    <FieldLabel required>Property type</FieldLabel>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                      {PROPERTY_TYPES.map((t) => (
                        <button key={t} type="button" onClick={() => setFormData({ ...formData, propertyType: t })}
                          className={`px-3 py-2.5 rounded-xl text-[11px] font-bold text-center transition-all ${formData.propertyType === t ? "text-white shadow-md" : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                          style={formData.propertyType === t ? { background: COLORS.TEAL } : {}}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-3">
                    <Counter label="Guests" value={formData.guests} min={1} onChange={(v) => setFormData({ ...formData, guests: v })} />
                    <Counter label="Bedrooms" value={formData.bedrooms} min={0} onChange={(v) => setFormData({ ...formData, bedrooms: v })} />
                    <Counter label="Beds" value={formData.beds} min={1} onChange={(v) => setFormData({ ...formData, beds: v })} />
                    <Counter label="Bathrooms" value={formData.bathrooms} min={1} onChange={(v) => setFormData({ ...formData, bathrooms: v })} />
                  </div>

                  <div className="grid lg:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel required>Price / night (KSh)</FieldLabel>
                      <StyledInput type="number" min={0} value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0" isInvalid={showErrors && !priceValid} />
                      {priceValid && <p className="text-[10px] text-blue-500 font-semibold mt-1">{usdHint(parseFloat(formData.price))}</p>}
                    </div>
                    <div>
                      <FieldLabel>Cleaning fee (KSh, optional)</FieldLabel>
                      <StyledInput type="number" min={0} value={formData.cleaningFee} onChange={(e) => setFormData({ ...formData, cleaningFee: e.target.value })} placeholder="0" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div>
                      <FieldLabel>Check-in from</FieldLabel>
                      <Select value={formData.checkInTime} onValueChange={(v) => setFormData({ ...formData, checkInTime: v })}>
                        <SelectTrigger className="rounded-xl h-11 font-semibold border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white rounded-xl max-h-64">
                          {CHECK_TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>Check-out by</FieldLabel>
                      <Select value={formData.checkOutTime} onValueChange={(v) => setFormData({ ...formData, checkOutTime: v })}>
                        <SelectTrigger className="rounded-xl h-11 font-semibold border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white rounded-xl max-h-64">
                          {CHECK_TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <FieldLabel>House rules (optional)</FieldLabel>
                    <Textarea
                      value={formData.houseRules}
                      onChange={(e) => setFormData({ ...formData, houseRules: e.target.value })}
                      placeholder="e.g. No smoking, no parties, quiet hours after 10pm."
                      rows={3}
                      className="rounded-xl border border-slate-200 text-sm font-medium resize-none focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080]"
                    />
                  </div>

                  <div>
                    <FieldLabel>Cancellation policy (optional)</FieldLabel>
                    <Textarea
                      value={formData.cancellationPolicy}
                      onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                      placeholder="e.g. Free cancellation up to 48 hours before check-in."
                      rows={3}
                      className="rounded-xl border border-slate-200 text-sm font-medium resize-none focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080]"
                    />
                  </div>

                  <GeneralFacilitiesSelector selected={amenities} onChange={setAmenities} accentColor={COLORS.TEAL} />
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 5 — Gallery ══ */}
            {currentStep === 5 && (
              <SectionCard
                title={`Photo Gallery — ${galleryImages.length}/5 uploaded`}
                subtitle={galleryImages.length < 5 ? `You need ${5 - galleryImages.length} more photos to continue` : "All 5 photos ready ✓"}
                icon={Camera}
              >
                {galleryImages.length < 5 && showErrors && (
                  <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                    <span className="text-red-500">⚠</span>
                    <p className="text-red-600 text-xs font-semibold">Upload at least {5 - galleryImages.length} more photos</p>
                  </div>
                )}
                {isCompressingGallery && <CompressingBanner />}
                <ImageGalleryGrid previews={galleryPreviews} onRemove={removeGalleryImage} onAdd={handleGalleryUpload} isInvalid={showErrors && galleryImages.length < 5} />
                <p className="text-[10px] text-slate-400 mt-3 font-medium">JPG or PNG only. First photo becomes your cover image.</p>
              </SectionCard>
            )}

            {/* ══ STEP 6 — Review ══ */}
            {currentStep === 6 && (
              <ReviewStep
                type="adventure"
                accentColor={COLORS.TEAL}
                data={{
                  category: "airbnb",
                  name: formData.listingTitle, registrationName: formData.registrationName,
                  registrationNumber: formData.registrationNumber,
                  locationName: formData.locationName, place: formData.place, country: formData.country,
                  description: formData.description, email: formData.email, phoneNumber: formData.phoneNumber,
                  openingHours: formData.checkInTime, closingHours: formData.checkOutTime,
                  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                  entranceFeeType: "free", adultPrice: "0", childPrice: "0",
                  hasNonCitizenPricing: false, nonCitizenAdultPrice: "0", nonCitizenChildPrice: "0",
                  latitude: formData.latitude, longitude: formData.longitude, generalFacilities: amenities,
                  facilities: [{
                    name: `${formData.listingTitle} (${formData.propertyType})`,
                    price: parseFloat(formData.price) || 0,
                    capacity: formData.guests,
                    amenities: [
                      `${formData.bedrooms} bedroom${formData.bedrooms === 1 ? "" : "s"}`,
                      `${formData.beds} bed${formData.beds === 1 ? "" : "s"}`,
                      `${formData.bathrooms} bathroom${formData.bathrooms === 1 ? "" : "s"}`,
                    ],
                    images: galleryPreviews,
                  }],
                  activities: [],
                  specialPrices: [],
                  galleryPreviewUrls: galleryPreviews,
                }}
                creatorEmail={user?.email}
              />
            )}

            {/* ── Navigation ── */}
            <div className="flex gap-3 pt-2">
              {currentStep > 1 && (
                <button type="button" onClick={handlePrev} className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
              )}
              {currentStep < 6 ? (
                <button type="button" onClick={handleNext} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-bold shadow-lg hover:opacity-90 transition-all active:scale-[0.99]" style={{ background: `linear-gradient(135deg, ${COLORS.TEAL}, #005f5f)` }}>
                  Continue to {STEP_NAMES[currentStep]} <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-bold shadow-lg hover:opacity-90 transition-all active:scale-[0.99] disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${COLORS.CORAL}, #e06040)` }}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : <><CheckCircle2 className="h-4 w-4" /> Submit for Approval</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default CreateAirbnb;