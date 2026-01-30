import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Calendar, MapPin, DollarSign, Users, Navigation, ArrowLeft, ArrowRight, Camera, CheckCircle2, X, Plus, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { approvalStatusSchema } from "@/lib/validation";
import { compressImages } from "@/lib/imageCompression";
import { OperatingHoursSection } from "@/components/creation/OperatingHoursSection";
import { ReviewStep } from "@/components/creation/ReviewStep";

interface WorkingDays {
  Mon: boolean;
  Tue: boolean;
  Wed: boolean;
  Thu: boolean;
  Fri: boolean;
  Sat: boolean;
  Sun: boolean;
}

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  SOFT_GRAY: "#F8F9FA"
};

const TOTAL_STEPS = 7;

const CreateTripEvent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    place: "",
    country: "",
    date: "",
    price: "0",
    price_child: "0",
    available_tickets: "0",
    email: "",
    phone_number: "",
    map_link: "",
    is_custom_date: false,
    type: "trip" as "trip" | "event",
    latitude: null as number | null,
    longitude: null as number | null,
    opening_hours: "",
    closing_hours: "",
  });
  
  const [workingDays, setWorkingDays] = useState<WorkingDays>({
    Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: false
  });
  
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [creatorProfile, setCreatorProfile] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('country, email, name, phone_number').eq('id', user.id).single();
        if (profile?.country) {
          setFormData(prev => ({ ...prev, country: profile.country, email: profile.email || user.email || '' }));
        } else if (user.email) {
          setFormData(prev => ({ ...prev, email: user.email || '' }));
        }
        if (profile) {
          setCreatorProfile({
            name: profile.name || "",
            email: profile.email || user.email || "",
            phone: profile.phone_number || ""
          });
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
          setFormData(prev => ({ ...prev, map_link: mapUrl, latitude, longitude }));
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
      setGalleryImages(prev => [...prev, ...compressed.map(c => c.file)].slice(0, 5));
    } catch (error) {
      console.error("Error compressing images:", error);
      setGalleryImages(prev => [...prev, ...newFiles].slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
  };

  // Step validation
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        // Type selection - always valid
        return true;
      case 2:
        if (!formData.name.trim()) {
          toast({ title: "Required", description: "Experience name is required", variant: "destructive" });
          return false;
        }
        if (!formData.country) {
          toast({ title: "Required", description: "Country is required", variant: "destructive" });
          return false;
        }
        if (!formData.place.trim()) {
          toast({ title: "Required", description: "Region/Place is required", variant: "destructive" });
          return false;
        }
        if (!formData.location.trim()) {
          toast({ title: "Required", description: "Specific location is required", variant: "destructive" });
          return false;
        }
        if (!formData.is_custom_date && !formData.date) {
          toast({ title: "Required", description: "Date is required (or select custom tour)", variant: "destructive" });
          return false;
        }
        return true;
      case 3:
        if (!formData.price || parseFloat(formData.price) < 0) {
          toast({ title: "Required", description: "Adult price is required", variant: "destructive" });
          return false;
        }
        if (!formData.available_tickets || parseInt(formData.available_tickets) <= 0) {
          toast({ title: "Required", description: "Max slots must be greater than 0", variant: "destructive" });
          return false;
        }
        return true;
      case 4:
        if (!formData.phone_number) {
          toast({ title: "Required", description: "Phone number is required", variant: "destructive" });
          return false;
        }
        if (!formData.map_link) {
          toast({ title: "Required", description: "GPS location is required", variant: "destructive" });
          return false;
        }
        return true;
      case 5:
        // Operating hours validation - only for custom date trips or events
        if (formData.is_custom_date || formData.type === 'event') {
          if (!formData.opening_hours || !formData.closing_hours) {
            toast({ title: "Required", description: "Operating hours are required", variant: "destructive" });
            return false;
          }
          const hasWorkingDays = Object.values(workingDays).some(Boolean);
          if (!hasWorkingDays) {
            toast({ title: "Required", description: "Select at least one operating day", variant: "destructive" });
            return false;
          }
        }
        return true;
      case 6:
        if (!formData.description.trim()) {
          toast({ title: "Required", description: "Description is required", variant: "destructive" });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!validateStep(currentStep)) return;

    setLoading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of galleryImages) {
        const fileName = `${user.id}/${Math.random()}.${file.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('user-content-images').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('user-content-images').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      // Convert working days to array of day names
      const daysOpened = (Object.keys(workingDays) as (keyof WorkingDays)[])
        .filter(day => workingDays[day]);

      const { error } = await supabase.from("trips").insert([{
        name: formData.name,
        description: formData.description,
        location: formData.location,
        place: formData.place,
        country: formData.country,
        date: formData.is_custom_date ? new Date().toISOString().split('T')[0] : formData.date,
        is_custom_date: formData.is_custom_date,
        is_flexible_date: formData.is_custom_date,
        type: formData.type,
        image_url: uploadedUrls[0] || "",
        gallery_images: uploadedUrls,
        price: parseFloat(formData.price),
        price_child: parseFloat(formData.price_child) || 0,
        available_tickets: parseInt(formData.available_tickets) || 0,
        email: formData.email,
        phone_number: formData.phone_number,
        map_link: formData.map_link,
        opening_hours: formData.opening_hours || null,
        closing_hours: formData.closing_hours || null,
        days_opened: daysOpened.length > 0 ? daysOpened : null,
        created_by: user.id,
        approval_status: approvalStatusSchema.parse("pending")
      }]);

      if (error) throw error;
      toast({ title: "Success!", description: "Submitted for approval." });
      navigate("/become-host");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
        <div key={step} className="h-2 flex-1 rounded-full transition-all duration-300"
          style={{ backgroundColor: step <= currentStep ? COLORS.TEAL : '#e2e8f0' }}
        />
      ))}
    </div>
  );

  const StyledInput = ({ className = "", ...props }: React.ComponentProps<typeof Input>) => (
    <Input className={`rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all h-12 font-bold ${className}`} {...props} />
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      
      <main className="container px-4 py-8 max-w-4xl mx-auto">
        <div className="relative rounded-[40px] overflow-hidden mb-8 shadow-2xl h-[200px] md:h-[280px]">
          <img src="/images/category-trips.webp" className="w-full h-full object-cover" alt="Header" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8">
            <Button onClick={() => navigate(-1)} className="absolute top-6 left-6 rounded-full bg-white/20 backdrop-blur-md border-none w-10 h-10 p-0 text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <p className="text-[#FF7F50] font-black uppercase tracking-[0.2em] text-[10px] mb-2">Step {currentStep} of {TOTAL_STEPS}</p>
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter">
              Create <span style={{ color: COLORS.TEAL }}>Experience</span>
            </h1>
          </div>
        </div>
        
        <StepIndicator />

        {/* Step 1: Type Selection */}
        {currentStep === 1 && (
          <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xs font-black uppercase tracking-widest mb-6" style={{ color: COLORS.TEAL }}>Select Listing Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: 'trip', label: 'Trip / Tour', sub: 'Flexible or fixed multi-day adventures' },
                { id: 'event', label: 'Event / Sport', sub: 'Fixed date single sessions or matches' }
              ].map((type) => (
                <label 
                  key={type.id}
                  className={`relative p-6 rounded-[24px] border-2 cursor-pointer transition-all ${
                    formData.type === type.id ? 'border-[#008080] bg-[#008080]/5' : 'border-slate-100 bg-slate-50 hover:bg-white'
                  }`}
                >
                  <input type="radio" name="type" value={type.id} className="hidden"
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                  />
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`block font-black uppercase tracking-tight text-sm ${formData.type === type.id ? 'text-[#008080]' : 'text-slate-600'}`}>
                        {type.label}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase mt-1 block">{type.sub}</span>
                    </div>
                    {formData.type === type.id && <CheckCircle2 className="h-5 w-5 text-[#008080]" />}
                  </div>
                </label>
              ))}
            </div>
          </Card>
        )}

        {/* Step 2: Experience Details */}
        {currentStep === 2 && (
          <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: COLORS.TEAL }}>Experience Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Experience Name *</Label>
                <StyledInput value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Hiking in the Clouds" />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Country *</Label>
                <CountrySelector value={formData.country} onChange={(value) => setFormData({...formData, country: value})} />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Region / Place *</Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                  <StyledInput className="pl-11" value={formData.place} onChange={(e) => setFormData({...formData, place: e.target.value})} placeholder="e.g. Mt. Kenya Region" />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Specific Location *</Label>
                <StyledInput value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} placeholder="e.g. Nanyuki Main Gate" />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-50">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date Settings *</Label>
              {formData.type === "trip" && (
                <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl">
                  <Checkbox id="custom_date" checked={formData.is_custom_date}
                    onCheckedChange={(checked) => setFormData({...formData, is_custom_date: checked as boolean})}
                  />
                  <label htmlFor="custom_date" className="text-[11px] font-black uppercase tracking-tight text-slate-500 cursor-pointer">
                    Flexible dates - Open availability
                  </label>
                </div>
              )}
              
              {!formData.is_custom_date && (
                <div className="relative">
                  <Calendar className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                  <StyledInput type="date" className="pl-11" min={new Date().toISOString().split('T')[0]}
                    value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})}
                  />
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step 3: Pricing & Capacity */}
        {currentStep === 3 && (
          <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xs font-black uppercase tracking-widest mb-6" style={{ color: COLORS.TEAL }}>Pricing & Logistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adult Price (KSh) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                  <StyledInput type="number" className="pl-11" value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Child Price (KSh)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                  <StyledInput type="number" className="pl-11" value={formData.price_child}
                    onChange={(e) => setFormData({...formData, price_child: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Max Slots *</Label>
                <div className="relative">
                  <Users className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                  <StyledInput type="number" className="pl-11" value={formData.available_tickets}
                    onChange={(e) => setFormData({...formData, available_tickets: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Step 4: Contact & Location */}
        {currentStep === 4 && (
          <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: COLORS.TEAL }}>Contact & GPS Location</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Email</Label>
                <StyledInput type="email" value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="contact@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Phone *</Label>
                <PhoneInput value={formData.phone_number}
                  onChange={(value) => setFormData({...formData, phone_number: value})}
                  country={formData.country} placeholder="712345678"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">GPS Location *</Label>
              <div className="flex gap-2">
                <StyledInput className="bg-slate-50 flex-1" readOnly value={formData.map_link} placeholder="Tap the icon to pin your location" />
                <Button type="button" onClick={getCurrentLocation}
                  className="h-12 w-12 rounded-2xl shadow-lg"
                  style={{ background: formData.map_link ? COLORS.TEAL : COLORS.CORAL }}
                >
                  <Navigation className="h-5 w-5 text-white" />
                </Button>
              </div>
            </div>

            {/* Gallery Upload */}
            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: COLORS.TEAL }}>Gallery (Max 5)</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {galleryImages.map((file, index) => (
                  <div key={index} className="relative aspect-square rounded-[20px] overflow-hidden border-2 border-slate-100">
                    <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="Preview" />
                    <button type="button" onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {galleryImages.length < 5 && (
                  <Label className="aspect-square rounded-[20px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50">
                    <Camera className="h-6 w-6 text-slate-400" />
                    <span className="text-[9px] font-black uppercase text-slate-400 mt-1">Add</span>
                    <Input type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e.target.files)} />
                  </Label>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Step 5: Operating Hours (for custom date or events) */}
        {currentStep === 5 && (
          <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xs font-black uppercase tracking-widest mb-6" style={{ color: COLORS.TEAL }}>
              Operating Hours {(formData.is_custom_date || formData.type === 'event') ? '*' : '(Optional)'}
            </h2>
            {!(formData.is_custom_date || formData.type === 'event') && (
              <p className="text-xs text-slate-400 mb-4">
                Since you have a fixed date, operating hours are optional. Skip if not applicable.
              </p>
            )}
            <OperatingHoursSection
              openingHours={formData.opening_hours}
              closingHours={formData.closing_hours}
              workingDays={workingDays}
              onOpeningChange={(value) => setFormData({...formData, opening_hours: value})}
              onClosingChange={(value) => setFormData({...formData, closing_hours: value})}
              onDaysChange={setWorkingDays}
              accentColor={COLORS.TEAL}
            />
          </Card>
        )}

        {/* Step 6: Description */}
        {currentStep === 6 && (
          <Card className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4">
            <Label className="text-xs font-black uppercase tracking-widest mb-4 block" style={{ color: COLORS.TEAL }}>Experience Description *</Label>
            <Textarea
              className="rounded-[24px] border-slate-100 bg-slate-50 p-6 min-h-[200px] focus:ring-[#008080] text-sm"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Tell travelers what makes this experience special..."
            />
          </Card>
        )}

        {/* Step 7: Review */}
        {currentStep === 7 && (
          <ReviewStep
            type={formData.type as 'trip' | 'event'}
            data={{
              name: formData.name,
              location: formData.location,
              place: formData.place,
              country: formData.country,
              description: formData.description,
              email: formData.email,
              phoneNumber: formData.phone_number,
              openingHours: formData.opening_hours,
              closingHours: formData.closing_hours,
              workingDays: formData.is_custom_date 
                ? Object.entries(workingDays).filter(([_, v]) => v).map(([d]) => d)
                : undefined,
              date: formData.date,
              isFlexibleDate: formData.is_custom_date,
              priceAdult: formData.price,
              priceChild: formData.price_child,
              capacity: formData.available_tickets,
              imageCount: galleryImages.length,
            }}
            creatorName={creatorProfile.name}
            creatorEmail={creatorProfile.email}
            creatorPhone={creatorProfile.phone}
            accentColor={COLORS.TEAL}
          />
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-4 mt-8">
          {currentStep > 1 && (
            <Button type="button" onClick={handlePrevious} variant="outline"
              className="flex-1 py-6 rounded-2xl font-black uppercase tracking-widest text-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Previous
            </Button>
          )}
          
          {currentStep < TOTAL_STEPS ? (
            <Button type="button" onClick={handleNext}
              className="flex-1 py-6 rounded-2xl font-black uppercase tracking-widest text-sm text-white"
              style={{ background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)` }}
            >
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={loading}
              className="flex-1 py-6 rounded-2xl font-black uppercase tracking-widest text-sm text-white"
              style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #006666 100%)` }}
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : "Submit for Approval"}
            </Button>
          )}
        </div>
      </main>
      
      <MobileBottomBar />
    </div>
  );
};

export default CreateTripEvent;
