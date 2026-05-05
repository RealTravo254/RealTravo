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
import { Calendar, MapPin, DollarSign, Users, Navigation, ArrowLeft, Camera, CheckCircle2, X, Loader2, ChevronLeft, ChevronRight, Plus, Link2, Ticket, FileImage } from "lucide-react";
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

const StyledInput = ({ className = "", isInvalid = false, ...props }: React.ComponentProps<typeof Input> & { isInvalid?: boolean }) => (
  <Input className={`rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all h-12 font-bold ${isInvalid ? "border-red-500 ring-1 ring-red-500" : ""} ${className}`} {...props} />
);

interface WorkingDays { Mon: boolean; Tue: boolean; Wed: boolean; Thu: boolean; Fri: boolean; Sat: boolean; Sun: boolean; }

interface TicketType {
  name: string;
  price: number;
}

const EVENT_CATEGORIES = [
  "Roadtrips", "Music Events", "Children Events", "Pool Party", "Outdoor",
  "Cultural Events", "Food", "Training", "Dancing Events", "Educational",
  "Religious Events", "Night Parties", "Charity Events", "Others"
];

const STEP_NAMES = ["Basic Info", "Date & Pricing", "Contact & Photos", "Schedule", "Review"];

const CreateTripEvent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useSafeBack("/become-host");
  const { toast } = useToast();
  const { user } = useAuth();
  const { usdHint } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);

  // Auto-detect type from route
  const isEventRoute = location.pathname === "/create-event";
  const searchParams = new URLSearchParams(location.search);
  const isFlexibleFromRoute = searchParams.get("flexible") === "true";
  

  const [formData, setFormData] = useState({
    name: "", description: "", location: "", place: "", country: "", date: "",
    price: "0", price_child: "0", available_tickets: "0", email: "", phone_number: "",
    map_link: "", is_custom_date: isFlexibleFromRoute, type: (isEventRoute ? "event" : "trip") as "trip" | "event",
    latitude: null as number | null, longitude: null as number | null,
    opening_hours: "00:00", closing_hours: "23:59", flexible_duration_months: "3",
    event_category: "" as string,
    location_link: "",
    allow_children: true,
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
  const [traLicense, setTraLicense] = useState<File | null>(null);
  const [traLicensePreview, setTraLicensePreview] = useState<string | null>(null);
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

  // Step validation
  const isStep1Complete = !!formData.name.trim() && !!formData.country && !!formData.place.trim() && !!formData.location.trim();
  const isStep2Complete = (formData.is_custom_date || !!formData.date) && (useTicketTypes ? ticketTypes.length > 0 : parseFloat(formData.price) >= 0) && parseInt(formData.available_tickets) > 0;
  const isStep3Complete = !!formData.phone_number && galleryImages.length >= 5 && (formData.type !== 'event' || !!eventCertificate) && !!traLicense;
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
      if (formData.location_link && !formData.location_link.startsWith("https://")) errors.push("location_link");
    } else if (currentStep === 2) {
      if (!formData.is_custom_date && !formData.date) errors.push("date");
      if (useTicketTypes) {
        if (ticketTypes.length === 0) errors.push("ticket_types");
      } else {
        if (!formData.price || parseFloat(formData.price) < 0) errors.push("price");
      }
      if (!formData.available_tickets || parseInt(formData.available_tickets) <= 0) errors.push("available_tickets");
    } else if (currentStep === 3) {
      if (!formData.phone_number) errors.push("phone_number");
      if (galleryImages.length < 5) errors.push("gallery");
      if (formData.type === 'event' && !eventCertificate) errors.push("event_certificate");
      if (!traLicense) errors.push("tra_license");
    } else if (currentStep === 4) {
      if (!formData.description.trim()) errors.push("description");
    }
    return errors;
  };

  const handleNext = () => {
    // Auto-save any pending text in inclusion/exclusion/activity inputs
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
    setNewTicketName("");
    setNewTicketPrice("");
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
    if (!formData.is_custom_date && !formData.date) allErrors.push("date");
    if (useTicketTypes) {
      if (ticketTypes.length === 0) allErrors.push("ticket_types");
    } else {
      if (!formData.price || parseFloat(formData.price) < 0) allErrors.push("price");
    }
    if (!formData.available_tickets || parseInt(formData.available_tickets) <= 0) allErrors.push("available_tickets");
    if (!formData.phone_number) allErrors.push("phone_number");
    if (!formData.description.trim()) allErrors.push("description");
    if (galleryImages.length < 5) allErrors.push("gallery");
    if (formData.type === 'event' && !eventCertificate) allErrors.push("event_certificate");
    if (!traLicense) allErrors.push("tra_license");
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

      // Upload event certificate if event
      let eventCertificateUrl: string | null = null;
      if (formData.type === 'event' && eventCertificate) {
        const certFileName = `${user.id}/cert-${Math.random()}.${eventCertificate.name.split('.').pop()}`;
        const { error: certUploadError } = await supabase.storage.from('user-content-images').upload(certFileName, eventCertificate);
        if (certUploadError) throw certUploadError;
        eventCertificateUrl = supabase.storage.from('user-content-images').getPublicUrl(certFileName).data.publicUrl;
      }

      // Upload TRA license (required for all hosts)
      let traLicenseUrl: string | null = null;
      if (traLicense) {
        const traFileName = `${user.id}/tra-${Math.random()}.${traLicense.name.split('.').pop()}`;
        const { error: traUploadError } = await supabase.storage.from('user-content-images').upload(traFileName, traLicense);
        if (traUploadError) throw traUploadError;
        traLicenseUrl = supabase.storage.from('user-content-images').getPublicUrl(traFileName).data.publicUrl;
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
        tra_license_url: traLicenseUrl,
      } as any]);

      if (error) throw error;
      toast({ title: "Success!", description: `Ref: ${friendlySlug} — Submitted for approval.`, duration: 5000 });
      navigate("/become-host");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      <main className="container px-4 py-8 mx-auto">
        {/* Hero */}
        <div className="relative rounded-[40px] overflow-hidden mb-6 shadow-2xl h-[160px] md:h-[220px]">
          <img src="/images/category-trips.webp" className="w-full h-full object-cover" alt="Header" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
            <Button onClick={goBack} className="absolute top-4 left-4 rounded-full bg-white/20 backdrop-blur-md border-none w-10 h-10 p-0 text-white"><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter">
              Create <span style={{ color: COLORS.TEAL }}>Experience</span>
            </h1>
            <p className="text-white/70 text-xs font-bold mt-1">Step {currentStep} of {STEP_NAMES.length}</p>
          </div>
        </div>

        {/* Step Indicator */}
        <CreateFormStepper steps={steps} currentStep={currentStep} />

        <div className="space-y-6">
          {/* ═══ STEP 1: Basic Info ═══ */}
          {currentStep === 1 && (
            <>
              <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
                <h2 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: COLORS.TEAL }}>
                  {formData.type === "event" ? "Creating an Event" : "Creating a Trip / Tour"}
                </h2>
                <p className="text-sm text-slate-500">
                  {formData.type === "event" ? "Fixed date single sessions or matches" : "Flexible or fixed multi-day adventures"}
                </p>
              </Card>

              {/* Event Category Selector */}
              {formData.type === "event" && (
                <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-4">
                  <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: COLORS.TEAL }}>Event Category *</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {EVENT_CATEGORIES.map((cat) => (
                      <button key={cat} type="button" onClick={() => setFormData({...formData, event_category: cat})}
                        className={`p-3 rounded-xl text-center transition-all font-bold text-xs uppercase tracking-tight ${formData.event_category === cat ? 'bg-[#008080] text-white shadow-lg' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  {formData.event_category === "Others" && (
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Specify Event Type</Label>
                      <StyledInput value={formData.event_category === "Others" ? "" : formData.event_category} onChange={(e) => setFormData({...formData, event_category: e.target.value || "Others"})} placeholder="e.g. Yoga Retreat" />
                    </div>
                  )}
                </Card>
              )}
              <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-6">
                <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: COLORS.TEAL }}>Experience Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Experience Name *</Label>
                    <StyledInput isInvalid={validationErrors.includes("name")} value={formData.name} onChange={(e) => { setFormData({...formData, name: e.target.value}); if(e.target.value) setValidationErrors(prev => prev.filter(err => err !== "name")); }} placeholder="e.g. Hiking in the Clouds" />
                    {validationErrors.includes("name") && <p className="text-red-500 text-[10px] font-bold">⚠ Experience name is required</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Country *</Label>
                    <div className={validationErrors.includes("country") ? "rounded-xl ring-1 ring-red-500" : ""}><CountrySelector value={formData.country} onChange={(val) => { setFormData({...formData, country: val, place: val === "Other" ? "" : formData.place}); setValidationErrors(prev => prev.filter(err => err !== "country")); }} /></div>
                    {validationErrors.includes("country") && <p className="text-red-500 text-[10px] font-bold">⚠ Country is required</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formData.country === "Other" ? "Region / City *" : "County *"}</Label>
                    <div className={validationErrors.includes("place") ? "rounded-xl ring-1 ring-red-500" : ""}>
                      {formData.country === "Other" ? (
                        <StyledInput value={formData.place} onChange={(e) => { setFormData({...formData, place: e.target.value}); setValidationErrors(prev => prev.filter(err => err !== "place")); }} placeholder="e.g. Dar es Salaam" />
                      ) : (
                        <CountySelector value={formData.place} onChange={(val) => { setFormData({...formData, place: val}); setValidationErrors(prev => prev.filter(err => err !== "place")); }} />
                      )}
                    </div>
                    {validationErrors.includes("place") && <p className="text-red-500 text-[10px] font-bold">⚠ {formData.country === "Other" ? "Region/City" : "County"} is required</p>}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Specific Location *</Label>
                    <StyledInput isInvalid={validationErrors.includes("location")} value={formData.location} onChange={(e) => { setFormData({...formData, location: e.target.value}); if(e.target.value) setValidationErrors(prev => prev.filter(err => err !== "location")); }} placeholder="e.g. Nanyuki Main Gate" />
                    {validationErrors.includes("location") && <p className="text-red-500 text-[10px] font-bold">⚠ Specific location is required</p>}
                  </div>
                </div>
              </Card>

              {/* Access Location Section - Link OR GPS */}
              <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-4">
                <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: COLORS.TEAL }}>Access Location</h2>
                <p className="text-[10px] text-slate-400 font-bold">Choose one: paste a map link OR capture your GPS location</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setLocationMode('link')}
                    className={`p-4 rounded-2xl text-center transition-all font-black text-xs uppercase tracking-tight ${locationMode === 'link' ? 'bg-[#008080] text-white shadow-lg' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                    <Link2 className="h-5 w-5 mx-auto mb-1" /> Paste Link
                  </button>
                  <button type="button" onClick={() => setLocationMode('gps')}
                    className={`p-4 rounded-2xl text-center transition-all font-black text-xs uppercase tracking-tight ${locationMode === 'gps' ? 'bg-[#008080] text-white shadow-lg' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                    <Navigation className="h-5 w-5 mx-auto mb-1" /> Use GPS
                  </button>
                </div>
                {locationMode === 'link' && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Link2 className="h-3 w-3" /> Location Link
                    </Label>
                    <StyledInput isInvalid={validationErrors.includes("location_link")} value={formData.location_link} onChange={(e) => { setFormData({...formData, location_link: e.target.value}); if(!e.target.value || e.target.value.startsWith("https://")) setValidationErrors(prev => prev.filter(err => err !== "location_link")); }} placeholder="https://maps.google.com/..." />
                    {validationErrors.includes("location_link") && <p className="text-red-500 text-[10px] font-bold">⚠ Link must start with https://</p>}
                  </div>
                )}
                {locationMode === 'gps' && (
                  <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                    <Button type="button" onClick={getCurrentLocation} className="w-full h-14 rounded-2xl shadow-lg font-black uppercase text-[11px] tracking-widest text-white active:scale-95 transition-all" style={{ background: formData.map_link ? COLORS.TEAL : COLORS.CORAL }}>
                      <Navigation className="h-5 w-5 mr-3" />{formData.map_link ? '✓ Location Captured' : 'Tap to Capture GPS Location'}
                    </Button>
                  </div>
                )}
              </Card>
            </>
          )}

          {/* ═══ STEP 2: Date & Pricing ═══ */}
          {currentStep === 2 && (
            <>
              <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-6">
                <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: COLORS.TEAL }}>Date Settings *</h2>
                {formData.type === "trip" && (
                  <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl">
                    <Checkbox id="custom_date" checked={formData.is_custom_date} onCheckedChange={(checked) => setFormData({...formData, is_custom_date: checked as boolean})} />
                    <label htmlFor="custom_date" className="text-[11px] font-black uppercase tracking-tight text-slate-500 cursor-pointer">Flexible dates - Open availability</label>
                  </div>
                )}
                {formData.is_custom_date && (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Listing Duration *</Label>
                    <p className="text-[10px] text-slate-400">Choose how long this flexible trip will be available. Max 12 months.</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4, 5, 6, 9, 12].map((months) => (
                        <button key={months} type="button" onClick={() => setFormData({...formData, flexible_duration_months: String(months)})}
                          className={`p-3 rounded-xl text-center transition-all font-black text-xs uppercase tracking-tight ${formData.flexible_duration_months === String(months) ? 'bg-[#008080] text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                          {months} {months === 1 ? 'Month' : 'Months'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!formData.is_custom_date && (
                  <>
                    <div className="relative"><Calendar className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" /><StyledInput isInvalid={validationErrors.includes("date")} type="date" className="pl-11" min={new Date().toISOString().split('T')[0]} value={formData.date} onChange={(e) => { setFormData({...formData, date: e.target.value}); if(e.target.value) setValidationErrors(prev => prev.filter(err => err !== "date")); }} /></div>
                    {validationErrors.includes("date") && <p className="text-red-500 text-[10px] font-bold">⚠ Please select a date</p>}
                  </>
                )}
              </Card>

              {/* Ticket Types / Pricing */}
              <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-6">
                <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: COLORS.TEAL }}>Pricing & Tickets</h2>
                
                {/* Toggle: Across Price vs Custom Ticket Types */}
                {formData.type === "event" && (
                  <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl">
                    <Checkbox id="use_ticket_types" checked={useTicketTypes} onCheckedChange={(checked) => setUseTicketTypes(checked as boolean)} />
                    <label htmlFor="use_ticket_types" className="text-[11px] font-black uppercase tracking-tight text-slate-500 cursor-pointer">
                      Use custom ticket types (VIP, VVIP, Regular, etc.)
                    </label>
                  </div>
                )}

                {/* Allow Children Toggle */}
                <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl">
                  <Checkbox id="allow_children" checked={formData.allow_children} onCheckedChange={(checked) => setFormData({...formData, allow_children: checked as boolean})} />
                  <label htmlFor="allow_children" className="text-[11px] font-black uppercase tracking-tight text-slate-500 cursor-pointer">
                    Allow children / child pricing
                  </label>
                </div>

                {useTicketTypes ? (
                  <div className="space-y-4">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Add your ticket types with custom names and prices</p>
                    
                    {/* Add ticket type form */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ticket Name</Label>
                        <StyledInput value={newTicketName} onChange={(e) => setNewTicketName(e.target.value)} placeholder="e.g. VIP, Regular, VVIP" />
                      </div>
                      <div className="w-32 space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Price (KSh)</Label>
                        <StyledInput type="number" min="0" value={newTicketPrice} onChange={(e) => setNewTicketPrice(e.target.value)} placeholder="0" />
                      </div>
                      <Button type="button" onClick={addTicketType} className="rounded-xl h-12 px-4" style={{ background: COLORS.TEAL }}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {validationErrors.includes("ticket_types") && <p className="text-red-500 text-[10px] font-bold">⚠ Add at least one ticket type</p>}

                    {/* Ticket types list */}
                    <div className="space-y-2">
                      {ticketTypes.map((ticket, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#008080]/5 border border-[#008080]/20">
                          <div className="flex items-center gap-3">
                            <Ticket className="h-4 w-4 text-[#008080]" />
                            <div>
                              <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{ticket.name}</span>
                              <span className="text-xs text-slate-500 ml-2">KSh {ticket.price.toLocaleString()}</span>
                              {ticket.price > 0 && <span className="text-[9px] text-blue-500 font-bold ml-2">{usdHint(ticket.price)}</span>}
                            </div>
                          </div>
                          <button type="button" onClick={() => removeTicketType(i)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adult Price (KSh) *</Label>
                      <div className="relative"><DollarSign className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" /><StyledInput isInvalid={validationErrors.includes("price")} type="number" className="pl-11" value={formData.price} onChange={(e) => { setFormData({...formData, price: e.target.value}); if(e.target.value && parseFloat(e.target.value) >= 0) setValidationErrors(prev => prev.filter(err => err !== "price")); }} /></div>
                      {parseFloat(formData.price) > 0 && <p className="text-[9px] text-blue-500 font-bold mt-0.5">{usdHint(parseFloat(formData.price))}</p>}
                      {validationErrors.includes("price") && <p className="text-red-500 text-[10px] font-bold">⚠ Enter a valid price</p>}
                    </div>
                    {formData.allow_children && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Child Price (KSh)</Label>
                        <div className="relative"><DollarSign className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" /><StyledInput type="number" min="0" className="pl-11" value={formData.price_child} onChange={(e) => setFormData({...formData, price_child: e.target.value})} /></div>
                        <p className="text-[9px] text-muted-foreground">Set to 0 if not applicable for children</p>
                        {parseFloat(formData.price_child) > 0 && <p className="text-[9px] text-blue-500 font-bold mt-0.5">{usdHint(parseFloat(formData.price_child))}</p>}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Max Slots *</Label>
                      <div className="relative"><Users className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" /><StyledInput isInvalid={validationErrors.includes("available_tickets")} type="number" className="pl-11" value={formData.available_tickets} onChange={(e) => { setFormData({...formData, available_tickets: e.target.value}); if(e.target.value && parseInt(e.target.value) > 0) setValidationErrors(prev => prev.filter(err => err !== "available_tickets")); }} /></div>
                      {validationErrors.includes("available_tickets") && <p className="text-red-500 text-[10px] font-bold">⚠ Enter number of slots (min 1)</p>}
                    </div>
                  </div>
                )}

                {useTicketTypes && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Max Slots *</Label>
                    <div className="relative"><Users className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" /><StyledInput isInvalid={validationErrors.includes("available_tickets")} type="number" className="pl-11" value={formData.available_tickets} onChange={(e) => { setFormData({...formData, available_tickets: e.target.value}); if(e.target.value && parseInt(e.target.value) > 0) setValidationErrors(prev => prev.filter(err => err !== "available_tickets")); }} /></div>
                    {validationErrors.includes("available_tickets") && <p className="text-red-500 text-[10px] font-bold">⚠ Enter number of slots (min 1)</p>}
                  </div>
                )}
              </Card>

              {/* Inclusions & Exclusions */}
              {(!formData.is_custom_date || formData.type === "event") && (
                <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-6">
                  <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: COLORS.TEAL }}>What's Included & Excluded</h2>
                  
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">✓ Inclusions</Label>
                    <div className="flex gap-2">
                      <StyledInput value={newInclusion} onChange={(e) => {
                        const val = e.target.value;
                        if (val.endsWith(',') || val.endsWith('.')) {
                          const item = val.slice(0, -1).trim();
                          if (item) { setInclusions([...inclusions, item]); setNewInclusion(""); }
                        } else { setNewInclusion(val); }
                      }} placeholder="Type & press comma or fullstop to add" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newInclusion.trim()) { setInclusions([...inclusions, newInclusion.trim()]); setNewInclusion(""); } } }} />
                      <Button type="button" onClick={() => { if (newInclusion.trim()) { setInclusions([...inclusions, newInclusion.trim()]); setNewInclusion(""); } }} className="rounded-xl shrink-0" style={{ background: COLORS.TEAL }}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {inclusions.map((item, i) => (
                        <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                          ✓ {item}
                          <button type="button" onClick={() => setInclusions(inclusions.filter((_, idx) => idx !== i))} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">✗ Exclusions</Label>
                    <div className="flex gap-2">
                      <StyledInput value={newExclusion} onChange={(e) => {
                        const val = e.target.value;
                        if (val.endsWith(',') || val.endsWith('.')) {
                          const item = val.slice(0, -1).trim();
                          if (item) { setExclusions([...exclusions, item]); setNewExclusion(""); }
                        } else { setNewExclusion(val); }
                      }} placeholder="Type & press comma or fullstop to add" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newExclusion.trim()) { setExclusions([...exclusions, newExclusion.trim()]); setNewExclusion(""); } } }} />
                      <Button type="button" onClick={() => { if (newExclusion.trim()) { setExclusions([...exclusions, newExclusion.trim()]); setNewExclusion(""); } }} className="rounded-xl shrink-0 bg-slate-600 hover:bg-slate-700">Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {exclusions.map((item, i) => (
                        <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-600 text-xs font-bold border border-red-200">
                          ✗ {item}
                          <button type="button" onClick={() => setExclusions(exclusions.filter((_, idx) => idx !== i))} className="hover:text-red-800"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* ═══ STEP 3: Contact & Photos ═══ */}
          {currentStep === 3 && (
            <>
            <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${COLORS.TEAL}15` }}>
                  <MapPin className="h-5 w-5" style={{ color: COLORS.TEAL }} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Contact Details</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">How guests can reach you</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 bg-slate-50/80 rounded-2xl p-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#008080]" /> Contact Email
                  </Label>
                  <StyledInput type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="contact@example.com" />
                </div>
                <div className="space-y-2 bg-slate-50/80 rounded-2xl p-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF7F50]" /> Contact Phone *
                  </Label>
                  <div className={validationErrors.includes("phone_number") ? "rounded-xl ring-1 ring-red-500" : ""}><PhoneInput value={formData.phone_number} onChange={(val) => { setFormData({...formData, phone_number: val}); if(val) setValidationErrors(prev => prev.filter(err => err !== "phone_number")); }} country={formData.country} placeholder="712345678" /></div>
                  {validationErrors.includes("phone_number") && <p className="text-red-500 text-[10px] font-bold">⚠ Phone number is required</p>}
                </div>
              </div>

              {/* Gallery */}
              <div className={`pt-6 border-t transition-all ${validationErrors.includes("gallery") ? "border-red-300" : "border-slate-100"}`}>
                <h3 className={`text-xs font-black uppercase tracking-widest mb-2 ${validationErrors.includes("gallery") ? "text-red-500" : ""}`} style={validationErrors.includes("gallery") ? {} : { color: COLORS.TEAL }}>
                  Photos * — {galleryImages.length}/5 uploaded
                  {galleryImages.length < 5 && <span className="text-red-500 ml-1">— {5 - galleryImages.length} more needed</span>}
                </h3>
                {validationErrors.includes("gallery") && (
                  <div className="mb-4 px-4 py-3 bg-red-50 border border-red-300 rounded-2xl flex items-center gap-2">
                    <span className="text-red-500 text-lg">⚠</span>
                    <p className="text-red-600 text-xs font-bold uppercase tracking-wide">
                      You need exactly 5 photos. Please upload {5 - galleryImages.length} more.
                    </p>
                  </div>
                )}
                <div className={`grid grid-cols-2 md:grid-cols-5 gap-4 p-4 rounded-2xl transition-all ${validationErrors.includes("gallery") ? "ring-2 ring-red-400 bg-red-50/20" : "bg-slate-50/30"}`}>
                  {galleryImages.map((file, index) => (
                    <div key={index} className="relative aspect-square rounded-[20px] overflow-hidden border-2 border-slate-100">
                      <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="Preview" />
                      <button type="button" onClick={() => removeImage(index)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  {galleryImages.length < 5 && (
                    <Label className={`aspect-square rounded-[20px] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-white transition-all ${validationErrors.includes("gallery") ? "border-red-400 bg-red-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <Camera className={`h-6 w-6 ${validationErrors.includes("gallery") ? "text-red-400" : "text-slate-400"}`} />
                      <span className={`text-[9px] font-bold mt-1 uppercase tracking-wide ${validationErrors.includes("gallery") ? "text-red-400" : "text-slate-400"}`}>Add Photo</span>
                      <Input type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e.target.files)} />
                    </Label>
                  )}
                </div>
              </div>
            </Card>

            {/* Event Certificate Upload */}
            {formData.type === 'event' && (
              <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: COLORS.TEAL }}>
                  <FileImage className="h-4 w-4" /> Event Certificate / Permit *
                </h3>
                <p className="text-[10px] text-slate-400 font-bold">Upload your event permit or certificate proving you are authorized to host this event</p>
                
                {certificatePreview ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-[#008080]/30">
                    <img src={certificatePreview} alt="Event Certificate" className="w-full h-48 object-cover" />
                    <button type="button" onClick={() => { setEventCertificate(null); setCertificatePreview(null); }}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg">
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Certificate Uploaded
                    </div>
                  </div>
                ) : (
                  <Label className={`flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${validationErrors.includes("event_certificate") ? "border-red-400 bg-red-50" : "border-slate-200 hover:border-[#008080] hover:bg-[#008080]/5"}`}>
                    <FileImage className={`h-8 w-8 mb-2 ${validationErrors.includes("event_certificate") ? "text-red-400" : "text-slate-400"}`} />
                    <span className={`text-xs font-bold uppercase ${validationErrors.includes("event_certificate") ? "text-red-500" : "text-slate-400"}`}>Upload Certificate Image</span>
                    <Input type="file" className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setEventCertificate(file);
                        setCertificatePreview(URL.createObjectURL(file));
                        setValidationErrors(prev => prev.filter(err => err !== "event_certificate"));
                      }
                    }} />
                  </Label>
                )}
                {validationErrors.includes("event_certificate") && (
                  <p className="text-red-500 text-[10px] font-bold">⚠ Event certificate is required to host an event</p>
                )}
              </Card>
            )}

            {/* TRA License Upload (required for all hosts) */}
            <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: COLORS.TEAL }}>
                <FileImage className="h-4 w-4" /> TRA License *
              </h3>
              <p className="text-[10px] text-slate-400 font-bold">Upload your Tourism Regulatory Authority (TRA) license image to prove you are a regulated host</p>

              {traLicensePreview ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-[#008080]/30">
                  <img src={traLicensePreview} alt="TRA License" className="w-full h-48 object-cover" />
                  <button type="button" onClick={() => { setTraLicense(null); setTraLicensePreview(null); }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg">
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> License Uploaded
                  </div>
                </div>
              ) : (
                <Label className={`flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${validationErrors.includes("tra_license") ? "border-red-400 bg-red-50" : "border-slate-200 hover:border-[#008080] hover:bg-[#008080]/5"}`}>
                  <FileImage className={`h-8 w-8 mb-2 ${validationErrors.includes("tra_license") ? "text-red-400" : "text-slate-400"}`} />
                  <span className={`text-xs font-bold uppercase ${validationErrors.includes("tra_license") ? "text-red-500" : "text-slate-400"}`}>Upload TRA License</span>
                  <Input type="file" className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setTraLicense(file);
                      setTraLicensePreview(URL.createObjectURL(file));
                      setValidationErrors(prev => prev.filter(err => err !== "tra_license"));
                    }
                  }} />
                </Label>
              )}
              {validationErrors.includes("tra_license") && (
                <p className="text-red-500 text-[10px] font-bold">⚠ TRA license is required for all hosts</p>
              )}
            </Card>
            </>
          )}

          {/* ═══ STEP 4: Schedule & Description ═══ */}
          {currentStep === 4 && (
            <>
              <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
                <h2 className="text-xs font-black uppercase tracking-widest mb-6" style={{ color: COLORS.TEAL }}>
                  {formData.type === "event" ? "Event Hours *" : "Operating Hours & Days *"}
                </h2>
                <OperatingHoursSection
                  openingHours={formData.opening_hours}
                  closingHours={formData.closing_hours}
                  workingDays={workingDays}
                  onOpeningChange={(v) => setFormData({...formData, opening_hours: v})}
                  onClosingChange={(v) => setFormData({...formData, closing_hours: v})}
                  onDaysChange={setWorkingDays}
                  accentColor={COLORS.TEAL}
                  hideDays={formData.type === "event"}
                  hide24HourToggle={true}
                />
              </Card>

              <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
                <Label className="text-xs font-black uppercase tracking-widest mb-4 block" style={{ color: COLORS.TEAL }}>Experience Description *</Label>
                <Textarea className={`rounded-[24px] border-slate-100 bg-slate-50 p-6 min-h-[200px] focus:ring-[#008080] text-sm ${validationErrors.includes("description") ? "border-red-500 ring-1 ring-red-500" : ""}`} value={formData.description} onChange={(e) => {
                  const words = e.target.value.trim().split(/\s+/);
                  if (e.target.value.trim() === "" || words.length <= 20) {
                    setFormData({...formData, description: e.target.value});
                  }
                  if (e.target.value.trim()) setValidationErrors(prev => prev.filter(err => err !== "description"));
                }} placeholder="Describe in 20 words or less..." />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.description.trim() ? formData.description.trim().split(/\s+/).length : 0}/20 words
                </p>
                {validationErrors.includes("description") && <p className="text-red-500 text-[10px] font-bold mt-1">⚠ Description is required</p>}
              </Card>

              {/* Activities */}
              <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-4">
                <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: COLORS.TEAL }}>Activities (Optional)</h2>
                <p className="text-[10px] text-slate-400 font-bold">Add activities visitors can enjoy during this experience</p>
                <div className="flex gap-2">
                  <StyledInput value={newActivityName} onChange={(e) => setNewActivityName(e.target.value)} placeholder="e.g. Hiking, Swimming, Game Drive" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newActivityName.trim()) { setActivityNames([...activityNames, newActivityName.trim()]); setNewActivityName(""); } } }} />
                  <Button type="button" onClick={() => { if (newActivityName.trim()) { setActivityNames([...activityNames, newActivityName.trim()]); setNewActivityName(""); } }} className="rounded-xl shrink-0" style={{ background: COLORS.TEAL }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activityNames.map((name, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#008080]/10 text-[#008080] text-xs font-bold border border-[#008080]/20">
                      {name}
                      <button type="button" onClick={() => setActivityNames(activityNames.filter((_, idx) => idx !== i))} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* ═══ STEP 5: Review ═══ */}
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
                inclusions,
                exclusions,
                ticketTypes: useTicketTypes ? ticketTypes : [],
                allowChildren: formData.allow_children,
                activities: activityNames.map(name => ({ name, price: 0, images: [] as string[], previewUrls: [] as string[] })),
                eventCertificatePreviewUrl: certificatePreview || undefined,
                traLicensePreviewUrl: traLicensePreview || undefined,
              }}
              creatorEmail={user?.email}
            />
          )}

          {/* ═══ Navigation Buttons ═══ */}
          <div className="flex gap-3 pt-2">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={handlePrev}
                className="flex-1 py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest">
                <ChevronLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            )}
            {currentStep < 5 ? (
              <Button type="button" onClick={handleNext}
                className="flex-[2] py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest text-white shadow-xl active:scale-95 transition-all"
                style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #006666 100%)` }}>
                Continue <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={loading}
                className="flex-[2] py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest text-white shadow-xl active:scale-95 transition-all"
                style={{ background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)` }}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Submit for Approval</>}
              </Button>
            )}
          </div>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default CreateTripEvent;
