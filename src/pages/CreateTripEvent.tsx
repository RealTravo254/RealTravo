import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBanCheck } from "@/hooks/useBanCheck";
import {
  Calendar, MapPin, DollarSign, Users, Navigation, ArrowLeft, Camera,
  CheckCircle2, X, Loader2, ChevronLeft, ChevronRight, Plus, Link2, Ticket, FileImage
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { CountySelector } from "@/components/creation/CountySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { approvalStatusSchema } from "@/lib/validation";
import { ReviewStep } from "@/components/creation/ReviewStep";
import { compressImages } from "@/lib/imageCompression";
import { OperatingHoursSection } from "@/components/creation/OperatingHoursSection";
import { CreateFormStepper } from "@/components/creation/CreateFormStepper";
import { useCurrency } from "@/contexts/CurrencyContext";

const COLORS = { TEAL: "#008080", CORAL: "#FF7F50", CORAL_LIGHT: "#FF9E7A", SOFT_GRAY: "#F8F9FA" };

const generateFriendlySlug = (name: string): string => {
  const cleanName = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").substring(0, 30);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${cleanName}-${code}`;
};

interface WorkingDays { Mon: boolean; Tue: boolean; Wed: boolean; Thu: boolean; Fri: boolean; Sat: boolean; Sun: boolean; }
interface TicketType { name: string; price: number; }

const EVENT_CATEGORIES = [
  "Roadtrips", "Music Events", "Children Events", "Pool Party", "Outdoor",
  "Cultural Events", "Food", "Training", "Dancing Events", "Educational",
  "Religious Events", "Night Parties", "Charity Events", "Others"
];

const STEP_NAMES = ["Basic Info", "Date & Pricing", "Contact & Photos", "Schedule", "Review"];

// ─── Styled Input ─────────────────────────────────────────────────────────────
const StyledInput = ({ className = "", isInvalid = false, ...props }: React.ComponentProps<typeof Input> & { isInvalid?: boolean }) => (
  <Input
    className={`h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080] transition-all ${isInvalid ? "border-red-400 ring-2 ring-red-100 bg-red-50" : ""} ${className}`}
    {...props}
  />
);

// ─── Field Label ──────────────────────────────────────────────────────────────
const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
    {children}{required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

// ─── Section Card ─────────────────────────────────────────────────────────────
const SectionCard = ({ title, subtitle, icon: Icon, children, accent = COLORS.TEAL }: { title: string; subtitle?: string; icon?: any; children: React.ReactNode; accent?: string }) => (
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

// ─── Step Sidebar ─────────────────────────────────────────────────────────────
const StepSidebar = ({ steps, currentStep, onStepClick, type }: { steps: any[]; currentStep: number; onStepClick?: (i: number) => void; type: string }) => (
  <aside className="hidden lg:flex flex-col w-72 shrink-0 sticky top-24 self-start">
    <div className="rounded-2xl overflow-hidden mb-6 relative h-44">
      <img src="/images/category-trips.webp" className="w-full h-full object-cover" alt="" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute bottom-4 left-5 right-5">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS.CORAL }}>
          {type === "event" ? "Event" : "Trip / Tour"}
        </span>
        <h2 className="text-white text-xl font-black uppercase tracking-tight leading-tight mt-0.5">Create Experience</h2>
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
          const isDone = step.isComplete && currentStep > num;
          const isPast = currentStep > num;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => isPast && onStepClick?.(num)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${isActive ? "bg-[#008080] text-white shadow-md" : isPast ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"}`}
              >
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

// ─── Image Gallery Grid ───────────────────────────────────────────────────────
const ImageGalleryGrid = ({ images, onRemove, onAdd, isInvalid }: {
  images: File[]; onRemove: (i: number) => void;
  onAdd: (files: FileList | null) => void; isInvalid?: boolean;
}) => {
  const slots = 5;
  return (
    <div className={`grid grid-cols-5 gap-3 p-4 rounded-xl border-2 border-dashed transition-all ${isInvalid ? "border-red-400 bg-red-50/30" : "border-slate-200 bg-slate-50/40"}`}>
      {Array.from({ length: slots }).map((_, i) => {
        const file = images[i];
        if (file) {
          return (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt={`Photo ${i + 1}`} />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                <button type="button" onClick={() => onRemove(i)}
                  className="opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-1 shadow-lg transition-all scale-75 group-hover:scale-100">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                {i === 0 ? "Cover" : `#${i + 1}`}
              </div>
            </div>
          );
        }
        return (
          <label key={i}
            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-slate-100 ${isInvalid ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-slate-300"}`}>
            <Camera className={`h-5 w-5 mb-1 ${isInvalid ? "text-red-400" : "text-slate-300"}`} />
            <span className={`text-[9px] font-bold uppercase tracking-wide ${isInvalid ? "text-red-400" : "text-slate-300"}`}>
              {i === 0 ? "Cover" : `Photo ${i + 1}`}
            </span>
            <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => onAdd(e.target.files)} />
          </label>
        );
      })}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const CreateTripEvent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useSafeBack("/become-host");
  const { toast } = useToast();
  const { user } = useAuth();
  const { usdHint } = useCurrency();
  useBanCheck();
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);

  const isEventRoute = location.pathname === "/create-event";
  const searchParams = new URLSearchParams(location.search);

  // ── Fixed-date trips disabled ──────────────────────────────────────────────
  // Trips are now always flexible-date (guests pick their own date, capacity is
  // tracked per day). The old "?flexible=true" query param / toggle is no
  // longer needed since flexible is the only option for trips.
  // const isFlexibleFromRoute = searchParams.get("flexible") === "true";

  const [formData, setFormData] = useState({
    name: "", description: "", location: "", place: "", country: "", date: "",
    price: "0", price_child: "0", available_tickets: "0", email: "", phone_number: "",
    map_link: "",
    // Trips: always flexible-date (is_custom_date = true). Events: always fixed-date (is_custom_date = false).
    is_custom_date: !isEventRoute,
    type: (isEventRoute ? "event" : "trip") as "trip" | "event",
    latitude: null as number | null, longitude: null as number | null,
    opening_hours: "00:00", closing_hours: "23:59", flexible_duration_months: "3",
    event_category: "" as string, location_link: "", allow_children: true,
    pickup_location: "",
  });

  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [newTicketName, setNewTicketName] = useState("");
  const [newTicketPrice, setNewTicketPrice] = useState("");
  const [useTicketTypes, setUseTicketTypes] = useState(false);
  const [inclusions, setInclusions] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [newInclusion, setNewInclusion] = useState("");
  const [newExclusion, setNewExclusion] = useState("");
  const [activityNames, setActivityNames] = useState<string[]>([]);
  const [newActivityName, setNewActivityName] = useState("");
  const [locationMode, setLocationMode] = useState<'link' | 'gps' | null>(null);
  const [workingDays, setWorkingDays] = useState<WorkingDays>({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: true });
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [eventCertificate, setEventCertificate] = useState<File | null>(null);
  const [certificatePreview, setCertificatePreview] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('country, email, name, phone_number').eq('id', user.id).single();
        if (profile?.country) setFormData(prev => ({ ...prev, country: profile.country, email: profile.email || user.email || '' }));
        else if (user.email) setFormData(prev => ({ ...prev, email: user.email || '' }));
      }
    };
    fetchUserProfile();
  }, [user]);

  // Step 1: trip requires pickup_location; event doesn't
  const isStep1Complete = !!formData.name.trim() && !!formData.country && !!formData.place.trim() && !!formData.location.trim()
    && (formData.type === "event" || !!formData.pickup_location.trim());

  const isStep2Complete = (formData.is_custom_date || !!formData.date) && (useTicketTypes ? ticketTypes.length > 0 : parseFloat(formData.price) >= 0) && parseInt(formData.available_tickets) > 0;
  const isStep3Complete = !!formData.phone_number && galleryImages.length >= 5 && (formData.type !== 'event' || !!eventCertificate);
  const isStep4Complete = !!formData.description.trim();

  const steps = [
    { name: STEP_NAMES[0], isComplete: isStep1Complete },
    { name: STEP_NAMES[1], isComplete: isStep2Complete },
    { name: STEP_NAMES[2], isComplete: isStep3Complete },
    { name: STEP_NAMES[3], isComplete: isStep4Complete },
    { name: STEP_NAMES[4], isComplete: isStep1Complete && isStep2Complete && isStep3Complete && isStep4Complete },
  ];

  const validateCurrentStep = (): string[] => {
    const errors: string[] = [];
    if (currentStep === 1) {
      if (!formData.name.trim()) errors.push("name");
      if (!formData.country) errors.push("country");
      if (!formData.place.trim()) errors.push("place");
      if (!formData.location.trim()) errors.push("location");
      // Pickup location required for trips
      if (formData.type === "trip" && !formData.pickup_location.trim()) errors.push("pickup_location");
      if (formData.location_link && !formData.location_link.startsWith("https://")) errors.push("location_link");
    } else if (currentStep === 2) {
      if (!formData.is_custom_date && !formData.date) errors.push("date");
      if (useTicketTypes) { if (ticketTypes.length === 0) errors.push("ticket_types"); }
      else { if (!formData.price || parseFloat(formData.price) < 0) errors.push("price"); }
      if (!formData.available_tickets || parseInt(formData.available_tickets) <= 0) errors.push("available_tickets");
    } else if (currentStep === 3) {
      if (!formData.phone_number) errors.push("phone_number");
      if (galleryImages.length < 5) errors.push("gallery");
      if (formData.type === 'event' && !eventCertificate) errors.push("event_certificate");
    } else if (currentStep === 4) {
      if (!formData.description.trim()) errors.push("description");
    }
    return errors;
  };

  const handleNext = () => {
    if (newInclusion.trim()) { setInclusions(prev => [...prev, newInclusion.trim()]); setNewInclusion(""); }
    if (newExclusion.trim()) { setExclusions(prev => [...prev, newExclusion.trim()]); setNewExclusion(""); }
    if (newActivityName.trim()) { setActivityNames(prev => [...prev, newActivityName.trim()]); setNewActivityName(""); }
    const errors = validateCurrentStep();
    setValidationErrors(errors);
    if (errors.length > 0) {
      toast({ title: "Complete this step", description: `${errors.length} field(s) need attention`, variant: "destructive" });
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 5));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    setValidationErrors([]);
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const mapUrl = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
          setFormData(prev => ({ ...prev, map_link: mapUrl, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
          toast({ title: "Location Added", description: "Current location pinned." });
        },
        () => toast({ title: "Error", description: "Unable to get location.", variant: "destructive" })
      );
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 5 - galleryImages.length);
    try {
      const compressed = await compressImages(newFiles);
      const updated = [...galleryImages, ...compressed.map(c => c.file)].slice(0, 5);
      setGalleryImages(updated);
      if (updated.length >= 5) setValidationErrors(prev => prev.filter(e => e !== "gallery"));
    } catch {
      const updated = [...galleryImages, ...newFiles].slice(0, 5);
      setGalleryImages(updated);
      if (updated.length >= 5) setValidationErrors(prev => prev.filter(e => e !== "gallery"));
    }
  };

  const removeImage = (index: number) => setGalleryImages(prev => prev.filter((_, i) => i !== index));

  const addTicketType = () => {
    if (!newTicketName.trim() || !newTicketPrice || parseFloat(newTicketPrice) < 0) {
      toast({ title: "Invalid ticket", description: "Please enter a ticket name and valid price.", variant: "destructive" });
      return;
    }
    setTicketTypes([...ticketTypes, { name: newTicketName.trim(), price: parseFloat(newTicketPrice) }]);
    setNewTicketName(""); setNewTicketPrice("");
    setValidationErrors(prev => prev.filter(e => e !== "ticket_types"));
  };

  const removeTicketType = (index: number) => setTicketTypes(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!user) { navigate("/auth"); return; }
    const allErrors: string[] = [];
    if (!formData.name.trim()) allErrors.push("name");
    if (!formData.country) allErrors.push("country");
    if (!formData.place.trim()) allErrors.push("place");
    if (!formData.location.trim()) allErrors.push("location");
    // Pickup location required for trips
    if (formData.type === "trip" && !formData.pickup_location.trim()) allErrors.push("pickup_location");
    if (!formData.is_custom_date && !formData.date) allErrors.push("date");
    if (useTicketTypes) { if (ticketTypes.length === 0) allErrors.push("ticket_types"); }
    else { if (!formData.price || parseFloat(formData.price) < 0) allErrors.push("price"); }
    if (!formData.available_tickets || parseInt(formData.available_tickets) <= 0) allErrors.push("available_tickets");
    if (!formData.phone_number) allErrors.push("phone_number");
    if (!formData.description.trim()) allErrors.push("description");
    if (galleryImages.length < 5) allErrors.push("gallery");
    if (formData.type === 'event' && !eventCertificate) allErrors.push("event_certificate");
    if (formData.location_link && !formData.location_link.startsWith("https://")) allErrors.push("location_link");
    if (allErrors.length > 0) {
      setValidationErrors(allErrors);
      toast({ title: "Missing Fields", description: "Please complete all steps.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const friendlySlug = generateFriendlySlug(formData.name);
      const uploadedUrls: string[] = [];
      for (const file of galleryImages) {
        const fileName = `${user.id}/${Math.random()}.${file.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('user-content-images').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('user-content-images').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }
      const daysOpened = (Object.keys(workingDays) as (keyof WorkingDays)[]).filter(day => workingDays[day]);
      let flexibleEndDate: string | null = null;
      if (formData.is_custom_date) {
        const months = parseInt(formData.flexible_duration_months) || 3;
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + months);
        flexibleEndDate = endDate.toISOString().split('T')[0];
      }
      let eventCertificateUrl: string | null = null;
      if (formData.type === 'event' && eventCertificate) {
        const certFileName = `${user.id}/cert-${Math.random()}.${eventCertificate.name.split('.').pop()}`;
        const { error: certUploadError } = await supabase.storage.from('user-content-images').upload(certFileName, eventCertificate);
        if (certUploadError) throw certUploadError;
        eventCertificateUrl = supabase.storage.from('user-content-images').getPublicUrl(certFileName).data.publicUrl;
      }
      const { error } = await supabase.from("trips").insert([{
        id: friendlySlug, slug: friendlySlug,
        name: formData.name, description: formData.description, location: formData.location,
        place: formData.place, country: formData.country,
        date: formData.is_custom_date ? new Date().toISOString().split('T')[0] : formData.date,
        is_custom_date: formData.is_custom_date, is_flexible_date: formData.is_custom_date,
        type: formData.type, image_url: uploadedUrls[0] || "", gallery_images: uploadedUrls,
        price: useTicketTypes ? (ticketTypes.length > 0 ? ticketTypes[0].price : 0) : parseFloat(formData.price),
        price_child: useTicketTypes ? 0 : (parseFloat(formData.price_child) || 0),
        available_tickets: parseInt(formData.available_tickets) || 0,
        email: formData.email, phone_number: formData.phone_number, map_link: formData.map_link,
        opening_hours: formData.opening_hours || null, closing_hours: formData.closing_hours || null,
        days_opened: daysOpened.length > 0 ? daysOpened : null,
        created_by: user.id, approval_status: approvalStatusSchema.parse("pending"),
        flexible_end_date: flexibleEndDate,
        inclusions: inclusions.length > 0 ? inclusions : null,
        exclusions: exclusions.length > 0 ? exclusions : null,
        event_category: formData.type === 'event' ? (formData.event_category || null) : null,
        ticket_types: useTicketTypes ? ticketTypes : [],
        allow_children: formData.allow_children,
        location_link: formData.location_link || null,
        activities: activityNames.length > 0 ? activityNames.map(name => ({ name, price: 0 })) : [],
        event_certificate_url: eventCertificateUrl,
        // Save pickup_location to database
        pickup_location: formData.type === "trip" ? (formData.pickup_location || null) : null,
      } as any]);
      if (error) throw error;
      toast({ title: "Success!", description: `Ref: ${friendlySlug} — Submitted for approval.`, duration: 5000 });
      navigate("/become-host");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />

      {/* Mobile Hero */}
      <div className="lg:hidden relative h-36 overflow-hidden">
        <img src="/images/category-trips.webp" className="w-full h-full object-cover" alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-5">
          <Button onClick={goBack} className="absolute top-4 left-4 rounded-full bg-white/20 backdrop-blur-md border-none w-10 h-10 p-0 text-white">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">Create <span style={{ color: COLORS.TEAL }}>Experience</span></h1>
          <p className="text-white/60 text-xs font-semibold mt-0.5">Step {currentStep} of {STEP_NAMES.length}</p>
        </div>
      </div>

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6 lg:py-10">
        <div className="flex gap-8 items-start">
          {/* Sidebar */}
          <StepSidebar
            steps={steps}
            currentStep={currentStep}
            onStepClick={(n) => { setValidationErrors([]); setCurrentStep(n); }}
            type={formData.type}
          />

          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Desktop page title */}
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
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${((currentStep - 1) / (STEP_NAMES.length - 1)) * 100}%`, background: COLORS.TEAL }} />
                </div>
                <span className="text-xs font-bold text-slate-400">{Math.round(((currentStep - 1) / (STEP_NAMES.length - 1)) * 100)}%</span>
              </div>
            </div>

            {/* Mobile stepper */}
            <div className="lg:hidden">
              <CreateFormStepper steps={steps} currentStep={currentStep} />
            </div>

            {/* ══════════ STEP 1: Basic Info ══════════ */}
            {currentStep === 1 && (
              <div className="space-y-5">
                {/* Type badge */}
                <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.TEAL }} />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    {formData.type === "event" ? "Creating an Event — Fixed date session" : "Creating a Trip / Tour — Flexible dates, guests book any day"}
                  </span>
                </div>

                {/* Event Category */}
                {formData.type === "event" && (
                  <SectionCard title="Event Category" subtitle="Select the best category for your event" icon={Ticket}>
                    <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                      {EVENT_CATEGORIES.map((cat) => (
                        <button key={cat} type="button" onClick={() => setFormData({ ...formData, event_category: cat })}
                          className={`px-3 py-2.5 rounded-xl text-[11px] font-bold text-center transition-all ${formData.event_category === cat ? 'text-white shadow-md' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-100'}`}
                          style={formData.event_category === cat ? { background: COLORS.TEAL } : {}}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* Experience Details */}
                <SectionCard title="Experience Details" icon={MapPin}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5">
                    {/* Name — full width */}
                    <div className="lg:col-span-2">
                      <FieldLabel required>Experience Name</FieldLabel>
                      <StyledInput
                        isInvalid={validationErrors.includes("name")}
                        value={formData.name}
                        onChange={(e) => { setFormData({ ...formData, name: e.target.value }); if (e.target.value) setValidationErrors(prev => prev.filter(err => err !== "name")); }}
                        placeholder="e.g. Hiking in the Clouds"
                      />
                      {validationErrors.includes("name") && <p className="text-red-500 text-[10px] font-semibold mt-1">⚠ Experience name is required</p>}
                    </div>

                    {/* Country */}
                    <div>
                      <FieldLabel required>Country</FieldLabel>
                      <div className={validationErrors.includes("country") ? "rounded-xl ring-2 ring-red-300" : ""}>
                        <CountrySelector value={formData.country} onChange={(val) => { setFormData({ ...formData, country: val, place: val === "Other" ? "" : formData.place }); setValidationErrors(prev => prev.filter(err => err !== "country")); }} />
                      </div>
                      {validationErrors.includes("country") && <p className="text-red-500 text-[10px] font-semibold mt-1">⚠ Country is required</p>}
                    </div>

                    {/* County/Region */}
                    <div>
                      <FieldLabel required>{formData.country === "Other" ? "Region / City" : "County"}</FieldLabel>
                      <div className={validationErrors.includes("place") ? "rounded-xl ring-2 ring-red-300" : ""}>
                        {formData.country === "Other"
                          ? <StyledInput value={formData.place} onChange={(e) => { setFormData({ ...formData, place: e.target.value }); setValidationErrors(prev => prev.filter(err => err !== "place")); }} placeholder="e.g. Dar es Salaam" />
                          : <CountySelector value={formData.place} onChange={(val) => { setFormData({ ...formData, place: val }); setValidationErrors(prev => prev.filter(err => err !== "place")); }} />
                        }
                      </div>
                      {validationErrors.includes("place") && <p className="text-red-500 text-[10px] font-semibold mt-1">⚠ {formData.country === "Other" ? "Region/City" : "County"} is required</p>}
                    </div>

                    {/* Specific Location — full width */}
                    <div className="lg:col-span-2">
                      <FieldLabel required>Specific Location</FieldLabel>
                      <StyledInput
                        isInvalid={validationErrors.includes("location")}
                        value={formData.location}
                        onChange={(e) => { setFormData({ ...formData, location: e.target.value }); if (e.target.value) setValidationErrors(prev => prev.filter(err => err !== "location")); }}
                        placeholder="e.g. Nanyuki Main Gate"
                      />
                      {validationErrors.includes("location") && <p className="text-red-500 text-[10px] font-semibold mt-1">⚠ Specific location is required</p>}
                    </div>

                    {/* Pickup Location — trips only, required, full width */}
                    {formData.type === "trip" && (
                      <div className="lg:col-span-2">
                        <FieldLabel required>Pickup Location</FieldLabel>
                        <div className="relative">
                          <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                          <StyledInput
                            isInvalid={validationErrors.includes("pickup_location")}
                            value={formData.pickup_location}
                            onChange={(e) => {
                              setFormData({ ...formData, pickup_location: e.target.value });
                              if (e.target.value) setValidationErrors(prev => prev.filter(err => err !== "pickup_location"));
                            }}
                            placeholder="e.g. Nairobi CBD, Globe Cinema Roundabout"
                            className="pl-9"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Where guests will be picked up for this trip</p>
                        {validationErrors.includes("pickup_location") && <p className="text-red-500 text-[10px] font-semibold mt-1">⚠ Pickup location is required for trips</p>}
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Map Location */}
                <SectionCard title="Map Location" subtitle="Help guests find you — paste a link or use GPS" icon={Navigation}>
                  <div className="flex gap-3 mb-5">
                    {[
                      { mode: 'link', icon: Link2, label: 'Paste Map Link' },
                      { mode: 'gps', icon: Navigation, label: 'Use My GPS' },
                    ].map(({ mode, icon: Icon, label }) => (
                      <button key={mode} type="button" onClick={() => setLocationMode(mode as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all ${locationMode === mode ? 'text-white shadow-md' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                        style={locationMode === mode ? { background: COLORS.TEAL } : {}}>
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </button>
                    ))}
                  </div>
                  {locationMode === 'link' && (
                    <div>
                      <FieldLabel>Location Link (must start with https://)</FieldLabel>
                      <StyledInput
                        isInvalid={validationErrors.includes("location_link")}
                        value={formData.location_link}
                        onChange={(e) => { setFormData({ ...formData, location_link: e.target.value }); if (!e.target.value || e.target.value.startsWith("https://")) setValidationErrors(prev => prev.filter(err => err !== "location_link")); }}
                        placeholder="https://maps.google.com/..."
                      />
                      {validationErrors.includes("location_link") && <p className="text-red-500 text-[10px] font-semibold mt-1">⚠ Link must start with https://</p>}
                    </div>
                  )}
                  {locationMode === 'gps' && (
                    <button type="button" onClick={getCurrentLocation}
                      className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-white text-sm font-bold transition-all active:scale-[0.98] shadow-md hover:opacity-90"
                      style={{ background: formData.map_link ? "#16a34a" : COLORS.CORAL }}>
                      {formData.map_link ? <><CheckCircle2 className="h-4 w-4" /> Location Captured</> : <><Navigation className="h-4 w-4" /> Capture My Location</>}
                    </button>
                  )}
                </SectionCard>
              </div>
            )}

            {/* ══════════ STEP 2: Date & Pricing ══════════ */}
            {currentStep === 2 && (
              <div className="space-y-5">
                {/* Date */}
                <SectionCard title="Date Settings" icon={Calendar}>
                  {/* ── Fixed-date trips disabled ──────────────────────────────
                      Trips no longer offer a "Flexible dates" toggle — every
                      trip is flexible-date only (is_custom_date is forced to
                      true for type === "trip" in the initial formData state
                      above). Uncomment below to restore the fixed/flexible
                      choice for trips.
                  {formData.type === "trip" && (
                    <label className="flex items-center gap-3 cursor-pointer mb-5 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-all">
                      <Checkbox id="custom_date" checked={formData.is_custom_date} onCheckedChange={(checked) => setFormData({ ...formData, is_custom_date: checked as boolean })} />
                      <div>
                        <p className="text-sm font-bold text-slate-700">Flexible dates</p>
                        <p className="text-xs text-slate-400">Open availability — guests choose their own date</p>
                      </div>
                    </label>
                  )}
                  */}
                  {formData.is_custom_date ? (
                    <div className="space-y-3">
                      <FieldLabel>Listing Duration</FieldLabel>
                      <p className="text-xs text-slate-400">How long will this flexible trip be available? (Max 12 months)</p>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5, 6, 9, 12].map((months) => (
                          <button key={months} type="button" onClick={() => setFormData({ ...formData, flexible_duration_months: String(months) })}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${formData.flexible_duration_months === String(months) ? 'text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            style={formData.flexible_duration_months === String(months) ? { background: COLORS.TEAL } : {}}>
                            {months} {months === 1 ? 'Month' : 'Months'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <FieldLabel required>Event / Trip Date</FieldLabel>
                      <StyledInput
                        isInvalid={validationErrors.includes("date")}
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={formData.date}
                        onChange={(e) => { setFormData({ ...formData, date: e.target.value }); if (e.target.value) setValidationErrors(prev => prev.filter(err => err !== "date")); }}
                        className="max-w-xs"
                      />
                      {validationErrors.includes("date") && <p className="text-red-500 text-[10px] font-semibold mt-1">⚠ Please select a date</p>}
                    </div>
                  )}
                </SectionCard>

                {/* Pricing */}
                <SectionCard title="Pricing & Tickets" icon={DollarSign}>
                  <div className="space-y-5">
                    {formData.type === "event" && (
                      <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-all">
                        <Checkbox id="use_ticket_types" checked={useTicketTypes} onCheckedChange={(checked) => setUseTicketTypes(checked as boolean)} />
                        <div>
                          <p className="text-sm font-bold text-slate-700">Custom ticket types</p>
                          <p className="text-xs text-slate-400">VIP, VVIP, Regular, etc. with different prices</p>
                        </div>
                      </label>
                    )}

                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-all">
                      <Checkbox id="allow_children" checked={formData.allow_children} onCheckedChange={(checked) => setFormData({ ...formData, allow_children: checked as boolean })} />
                      <div>
                        <p className="text-sm font-bold text-slate-700">Allow children</p>
                        <p className="text-xs text-slate-400">Enable child pricing for this experience</p>
                      </div>
                    </label>

                    {useTicketTypes ? (
                      <div className="space-y-4">
                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <FieldLabel>Ticket Name</FieldLabel>
                            <StyledInput value={newTicketName} onChange={(e) => setNewTicketName(e.target.value)} placeholder="e.g. VIP, Regular, VVIP" />
                          </div>
                          <div className="w-36">
                            <FieldLabel>Price (KSh)</FieldLabel>
                            <StyledInput type="number" min="0" value={newTicketPrice} onChange={(e) => setNewTicketPrice(e.target.value)} placeholder="0" />
                          </div>
                          <button type="button" onClick={addTicketType} className="h-11 px-4 rounded-xl text-white font-bold flex items-center gap-1.5 shrink-0 hover:opacity-90 transition-all" style={{ background: COLORS.TEAL }}>
                            <Plus className="h-4 w-4" /> Add
                          </button>
                        </div>
                        {validationErrors.includes("ticket_types") && <p className="text-red-500 text-[10px] font-semibold">⚠ Add at least one ticket type</p>}
                        <div className="space-y-2">
                          {ticketTypes.map((ticket, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                              <div className="flex items-center gap-2.5">
                                <Ticket className="h-4 w-4 text-slate-400" />
                                <span className="text-sm font-bold text-slate-800">{ticket.name}</span>
                                <span className="text-xs text-slate-500">KSh {ticket.price.toLocaleString()}</span>
                                {ticket.price > 0 && <span className="text-[10px] text-blue-500 font-semibold">{usdHint(ticket.price)}</span>}
                              </div>
                              <button type="button" onClick={() => removeTicketType(i)} className="text-red-400 hover:text-red-600 transition-colors">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div>
                          <FieldLabel required>Adult Price (KSh)</FieldLabel>
                          <StyledInput isInvalid={validationErrors.includes("price")} type="number" value={formData.price} onChange={(e) => { setFormData({ ...formData, price: e.target.value }); if (e.target.value && parseFloat(e.target.value) >= 0) setValidationErrors(prev => prev.filter(err => err !== "price")); }} />
                          {parseFloat(formData.price) > 0 && <p className="text-[10px] text-blue-500 font-semibold mt-1">{usdHint(parseFloat(formData.price))}</p>}
                          {validationErrors.includes("price") && <p className="text-red-500 text-[10px] font-semibold mt-1">⚠ Enter a valid price</p>}
                        </div>
                        {formData.allow_children && (
                          <div>
                            <FieldLabel>Child Price (KSh)</FieldLabel>
                            <StyledInput type="number" min="0" value={formData.price_child} onChange={(e) => setFormData({ ...formData, price_child: e.target.value })} />
                            {parseFloat(formData.price_child) > 0 && <p className="text-[10px] text-blue-500 font-semibold mt-1">{usdHint(parseFloat(formData.price_child))}</p>}
                          </div>
                        )}
                        <div>
                          <FieldLabel required>{formData.type === "trip" ? "Max Slots Per Day" : "Max Slots"}</FieldLabel>
                          <StyledInput isInvalid={validationErrors.includes("available_tickets")} type="number" value={formData.available_tickets} onChange={(e) => { setFormData({ ...formData, available_tickets: e.target.value }); if (e.target.value && parseInt(e.target.value) > 0) setValidationErrors(prev => prev.filter(err => err !== "available_tickets")); }} />
                          {formData.type === "trip" && <p className="text-[10px] text-slate-400 mt-1 font-medium">Since this trip is flexible-date, this is the capacity available each day — it resets daily.</p>}
                          {validationErrors.includes("available_tickets") && <p className="text-red-500 text-[10px] font-semibold mt-1">⚠ Enter number of slots (min 1)</p>}
                        </div>
                      </div>
                    )}
                    {useTicketTypes && (
                      <div>
                        <FieldLabel required>Max Slots</FieldLabel>
                        <StyledInput isInvalid={validationErrors.includes("available_tickets")} type="number" className="max-w-xs" value={formData.available_tickets} onChange={(e) => { setFormData({ ...formData, available_tickets: e.target.value }); if (e.target.value && parseInt(e.target.value) > 0) setValidationErrors(prev => prev.filter(err => err !== "available_tickets")); }} />
                        {validationErrors.includes("available_tickets") && <p className="text-red-500 text-[10px] font-semibold mt-1">⚠ Enter number of slots (min 1)</p>}
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Inclusions & Exclusions */}
                {(!formData.is_custom_date || formData.type === "event") && (
                  <SectionCard title="What's Included & Excluded" subtitle="Optional — helps guests know what to expect">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <FieldLabel>✓ Inclusions</FieldLabel>
                        <div className="flex gap-2 mb-3">
                          <StyledInput value={newInclusion} onChange={(e) => { const val = e.target.value; if (val.endsWith(',') || val.endsWith('.')) { const item = val.slice(0, -1).trim(); if (item) { setInclusions([...inclusions, item]); setNewInclusion(""); } } else setNewInclusion(val); }} placeholder="Type, press comma to add" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newInclusion.trim()) { setInclusions([...inclusions, newInclusion.trim()]); setNewInclusion(""); } } }} />
                          <button type="button" onClick={() => { if (newInclusion.trim()) { setInclusions([...inclusions, newInclusion.trim()]); setNewInclusion(""); } }} className="px-4 rounded-xl text-white text-sm font-bold shrink-0" style={{ background: COLORS.TEAL }}>Add</button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {inclusions.map((item, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                              ✓ {item}<button type="button" onClick={() => setInclusions(inclusions.filter((_, idx) => idx !== i))}><X className="h-2.5 w-2.5 ml-0.5 hover:text-red-500" /></button>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <FieldLabel>✗ Exclusions</FieldLabel>
                        <div className="flex gap-2 mb-3">
                          <StyledInput value={newExclusion} onChange={(e) => { const val = e.target.value; if (val.endsWith(',') || val.endsWith('.')) { const item = val.slice(0, -1).trim(); if (item) { setExclusions([...exclusions, item]); setNewExclusion(""); } } else setNewExclusion(val); }} placeholder="Type, press comma to add" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newExclusion.trim()) { setExclusions([...exclusions, newExclusion.trim()]); setNewExclusion(""); } } }} />
                          <button type="button" onClick={() => { if (newExclusion.trim()) { setExclusions([...exclusions, newExclusion.trim()]); setNewExclusion(""); } }} className="px-4 rounded-xl bg-slate-600 hover:bg-slate-700 text-white text-sm font-bold shrink-0">Add</button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {exclusions.map((item, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] font-semibold border border-red-200">
                              ✗ {item}<button type="button" onClick={() => setExclusions(exclusions.filter((_, idx) => idx !== i))}><X className="h-2.5 w-2.5 ml-0.5 hover:text-red-800" /></button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                )}
              </div>
            )}

            {/* ══════════ STEP 3: Contact & Photos ══════════ */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <SectionCard title="Contact Details" subtitle="How guests can reach you" icon={MapPin}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <FieldLabel>Contact Email</FieldLabel>
                      <StyledInput type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="contact@example.com" />
                    </div>
                    <div>
                      <PhoneInput
                        value={formData.phone_number}
                        onChange={(val) => { setFormData({ ...formData, phone_number: val }); if (val) setValidationErrors(prev => prev.filter(err => err !== "phone_number")); }}
                        country={formData.country}
                        placeholder="712 345 678"
                      />
                      {validationErrors.includes("phone_number") && <p className="text-red-500 text-[10px] font-semibold mt-1">⚠ Phone number is required</p>}
                    </div>
                  </div>
                </SectionCard>

                {/* Gallery */}
                <SectionCard
                  title={`Photo Gallery — ${galleryImages.length}/5 uploaded`}
                  subtitle={galleryImages.length < 5 ? `Upload ${5 - galleryImages.length} more photos to continue` : "All 5 photos uploaded ✓"}
                  icon={Camera}
                >
                  {validationErrors.includes("gallery") && (
                    <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                      <span className="text-red-500">⚠</span>
                      <p className="text-red-600 text-xs font-semibold">You need exactly 5 photos. Please upload {5 - galleryImages.length} more.</p>
                    </div>
                  )}
                  <ImageGalleryGrid images={galleryImages} onRemove={removeImage} onAdd={handleImageUpload} isInvalid={validationErrors.includes("gallery")} />
                  <p className="text-[10px] text-slate-400 mt-3 font-medium">First photo becomes your cover image. Use landscape photos for best results.</p>
                </SectionCard>

                {/* Event Certificate */}
                {formData.type === 'event' && (
                  <SectionCard title="Event Certificate / Permit" subtitle="Prove you're authorized to host this event" icon={FileImage}>
                    {certificatePreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200">
                        <img src={certificatePreview} alt="Event Certificate" className="w-full h-48 object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-green-500 text-white px-3 py-1 rounded-lg text-[11px] font-bold">
                              <CheckCircle2 className="h-3 w-3" /> Certificate Uploaded
                            </div>
                            <button type="button" onClick={() => { setEventCertificate(null); setCertificatePreview(null); }} className="bg-red-500 text-white px-3 py-1 rounded-lg text-[11px] font-bold">Remove</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed cursor-pointer transition-all ${validationErrors.includes("event_certificate") ? "border-red-400 bg-red-50" : "border-slate-200 hover:border-[#008080] hover:bg-[#008080]/5"}`}>
                        <FileImage className={`h-8 w-8 mb-2 ${validationErrors.includes("event_certificate") ? "text-red-400" : "text-slate-300"}`} />
                        <span className={`text-xs font-bold ${validationErrors.includes("event_certificate") ? "text-red-500" : "text-slate-400"}`}>Click to upload certificate image</span>
                        <span className="text-[10px] text-slate-300 mt-0.5">PNG, JPG up to 10MB</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) { setEventCertificate(file); setCertificatePreview(URL.createObjectURL(file)); setValidationErrors(prev => prev.filter(err => err !== "event_certificate")); }
                        }} />
                      </label>
                    )}
                    {validationErrors.includes("event_certificate") && <p className="text-red-500 text-[10px] font-semibold mt-2">⚠ Event certificate is required to host an event</p>}
                  </SectionCard>
                )}
              </div>
            )}

            {/* ══════════ STEP 4: Schedule ══════════ */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <SectionCard title={formData.type === "event" ? "Event Hours" : "Operating Hours & Days"} icon={Calendar}>
                  <OperatingHoursSection
                    openingHours={formData.opening_hours}
                    closingHours={formData.closing_hours}
                    workingDays={workingDays}
                    onOpeningChange={(v) => setFormData({ ...formData, opening_hours: v })}
                    onClosingChange={(v) => setFormData({ ...formData, closing_hours: v })}
                    onDaysChange={setWorkingDays}
                    accentColor={COLORS.TEAL}
                    hideDays={formData.type === "event"}
                    hide24HourToggle={true}
                  />
                </SectionCard>

                <SectionCard title="Experience Description">
                  <FieldLabel required>Describe your experience (max 20 words)</FieldLabel>
                  <Textarea
                    className={`rounded-xl border min-h-[140px] text-sm font-medium resize-none transition-all ${validationErrors.includes("description") ? "border-red-400 ring-2 ring-red-100 bg-red-50" : "border-slate-200 focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080]"}`}
                    value={formData.description}
                    onChange={(e) => {
                      const words = e.target.value.trim().split(/\s+/);
                      if (e.target.value.trim() === "" || words.length <= 20) setFormData({ ...formData, description: e.target.value });
                      if (e.target.value.trim()) setValidationErrors(prev => prev.filter(err => err !== "description"));
                    }}
                    placeholder="Describe your experience in 20 words or less..."
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-slate-400">{formData.description.trim() ? formData.description.trim().split(/\s+/).length : 0}/20 words</p>
                    {validationErrors.includes("description") && <p className="text-red-500 text-[10px] font-semibold">⚠ Description is required</p>}
                  </div>
                </SectionCard>

                <SectionCard title="Activities" subtitle="Optional — activities guests can enjoy">
                  <div className="flex gap-3 mb-4">
                    <StyledInput
                      value={newActivityName}
                      onChange={(e) => setNewActivityName(e.target.value)}
                      placeholder="e.g. Hiking, Swimming, Game Drive"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newActivityName.trim()) { setActivityNames([...activityNames, newActivityName.trim()]); setNewActivityName(""); } } }}
                    />
                    <button type="button" onClick={() => { if (newActivityName.trim()) { setActivityNames([...activityNames, newActivityName.trim()]); setNewActivityName(""); } }} className="px-4 rounded-xl text-white font-bold shrink-0 hover:opacity-90" style={{ background: COLORS.TEAL }}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activityNames.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border" style={{ background: `${COLORS.TEAL}10`, color: COLORS.TEAL, borderColor: `${COLORS.TEAL}25` }}>
                        {name}<button type="button" onClick={() => setActivityNames(activityNames.filter((_, idx) => idx !== i))}><X className="h-2.5 w-2.5 ml-0.5 hover:text-red-500" /></button>
                      </span>
                    ))}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ══════════ STEP 5: Review ══════════ */}
            {currentStep === 5 && (
              <ReviewStep
                type={formData.type as 'trip' | 'event'}
                accentColor={COLORS.TEAL}
                data={{
                  name: formData.name, location: formData.location, place: formData.place,
                  country: formData.country, description: formData.description,
                  email: formData.email, phoneNumber: formData.phone_number,
                  openingHours: formData.opening_hours, closingHours: formData.closing_hours,
                  workingDays: (Object.keys(workingDays) as (keyof typeof workingDays)[]).filter(day => workingDays[day]),
                  date: formData.date, isFlexibleDate: formData.is_custom_date,
                  flexibleDurationMonths: formData.flexible_duration_months,
                  priceAdult: formData.price, priceChild: formData.price_child,
                  capacity: formData.available_tickets, tripType: formData.type,
                  latitude: formData.latitude, longitude: formData.longitude, mapLink: formData.map_link,
                  galleryPreviewUrls: galleryImages.map(f => URL.createObjectURL(f)),
                  inclusions, exclusions,
                  ticketTypes: useTicketTypes ? ticketTypes : [],
                  allowChildren: formData.allow_children,
                  activities: activityNames.map(name => ({ name, price: 0, images: [] as string[], previewUrls: [] as string[] })),
                  eventCertificatePreviewUrl: certificatePreview || undefined,
                  pickupLocation: formData.pickup_location || undefined,
                }}
                creatorEmail={user?.email}
              />
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              {currentStep > 1 && (
                <button type="button" onClick={handlePrev}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
              )}
              {currentStep < 5 ? (
                <button type="button" onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-bold shadow-lg hover:opacity-90 transition-all active:scale-[0.99]"
                  style={{ background: `linear-gradient(135deg, ${COLORS.TEAL}, #005f5f)` }}>
                  Continue to {STEP_NAMES[currentStep]} <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-bold shadow-lg hover:opacity-90 transition-all active:scale-[0.99] disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT}, ${COLORS.CORAL})` }}>
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

export default CreateTripEvent;