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
import { MapPin, Mail, Navigation, Clock, X, Plus, Camera, CheckCircle2, Info, ArrowLeft, ArrowRight, Loader2, DollarSign } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { compressImages } from "@/lib/imageCompression";
import { DynamicItemList, DynamicItem } from "@/components/creation/DynamicItemList";
import { OperatingHoursSection } from "@/components/creation/OperatingHoursSection";
import { ReviewStep } from "@/components/creation/ReviewStep";

const TOTAL_STEPS = 7;

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  SOFT_GRAY: "#F8F9FA"
};

const CreateAdventure = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    registrationName: "",
    registrationNumber: "",
    locationName: "",
    place: "",
    country: "",
    description: "",
    email: "",
    phoneNumber: "",
    openingHours: "",
    closingHours: "",
    entranceFeeType: "free",
    adultPrice: "",
    childPrice: "",
    latitude: null as number | null,
    longitude: null as number | null
  });

  const [workingDays, setWorkingDays] = useState({
    Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false
  });
  
  const [amenities, setAmenities] = useState<DynamicItem[]>([]);
  const [facilities, setFacilities] = useState<DynamicItem[]>([]);
  const [activities, setActivities] = useState<DynamicItem[]>([]);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);

  const errorClass = (field: string) => 
    errors[field] ? "border-red-500 bg-red-50 ring-2 ring-red-500" : "border-slate-100 bg-slate-50/50";

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, boolean> = {};

    if (step === 1) {
      if (!formData.registrationName.trim()) newErrors.registrationName = true;
      if (!formData.registrationNumber.trim()) newErrors.registrationNumber = true;
      if (!formData.country) newErrors.country = true;
    }

    if (step === 2) {
      if (!formData.locationName.trim()) newErrors.locationName = true;
      if (!formData.place.trim()) newErrors.place = true;
      if (!formData.latitude) newErrors.gps = true;
    }

    if (step === 3) {
      if (!formData.email.trim()) newErrors.email = true;
      if (!formData.phoneNumber.trim()) newErrors.phoneNumber = true;
      if (!formData.description.trim()) newErrors.description = true;
    }

    if (step === 4) {
      if (!formData.openingHours) newErrors.openingHours = true;
      if (!formData.closingHours) newErrors.closingHours = true;
      if (!Object.values(workingDays).some(v => v)) newErrors.workingDays = true;
      
      if (formData.entranceFeeType === "paid") {
        if (!formData.adultPrice || parseFloat(formData.adultPrice) < 0) newErrors.adultPrice = true;
        if (!formData.childPrice || parseFloat(formData.childPrice) < 0) newErrors.childPrice = true;
      }
    }

    if (step === 5) {
      // Logic: Facilities and Amenities are optional to START, 
      // but IF a Facility is named, Capacity is MANDATORY.
      const hasIncompleteFacility = facilities.some(f => 
        f.name.trim() !== "" && (!f.capacity || parseInt(f.capacity) <= 0)
      );
      
      if (hasIncompleteFacility) {
        newErrors.facilities = true;
        toast({ 
          title: "Capacity Required", 
          description: "Please enter a valid capacity for all named facilities.", 
          variant: "destructive" 
        });
      }
    }

    if (step === 6) {
      if (galleryImages.length === 0) newErrors.gallery = true;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setErrors({});
      setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS));
    } else {
      toast({ 
        title: "Incomplete Details", 
        description: "Please fill all required fields highlighted in red.", 
        variant: "destructive" 
      });
    }
  };

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({ 
            ...prev, 
            latitude: position.coords.latitude, 
            longitude: position.coords.longitude 
          }));
          setErrors(prev => ({ ...prev, gps: false }));
          toast({ title: "Location captured successfully" });
        },
        () => toast({ title: "Error", description: "Could not capture GPS", variant: "destructive" })
      );
    }
  };

  const handleSubmit = async () => {
    if (!user) return navigate("/auth");
    if (!validateStep(currentStep)) return;

    setLoading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of galleryImages) {
        const fileName = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('listing-images').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      const { error } = await supabase.from("adventure_places").insert([{
        name: formData.registrationName,
        registration_number: formData.registrationNumber,
        location: formData.locationName,
        place: formData.place,
        country: formData.country,
        description: formData.description,
        email: formData.email,
        phone_numbers: [formData.phoneNumber],
        latitude: formData.latitude,
        longitude: formData.longitude,
        opening_hours: formData.openingHours,
        closing_hours: formData.closingHours,
        days_opened: Object.entries(workingDays).filter(([_, s]) => s).map(([d]) => d),
        image_url: uploadedUrls[0],
        gallery_images: uploadedUrls,
        entry_fee_type: formData.entranceFeeType,
        entry_fee: parseFloat(formData.adultPrice || "0"),
        child_entry_fee: parseFloat(formData.childPrice || "0"),
        amenities: amenities.map(a => a.name),
        facilities: facilities.map(f => ({ name: f.name, capacity: parseInt(f.capacity || "0") })),
        activities: activities.map(a => ({ name: a.name })),
        created_by: user.id,
        approval_status: "pending"
      }]);

      if (error) throw error;
      toast({ title: "Submitted!", description: "Your adventure is under review." });
      navigate("/become-host");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      
      <div className="relative h-[30vh] bg-slate-900 overflow-hidden">
        <img src="/images/category-campsite.webp" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="absolute bottom-8 left-0 w-full px-8 container max-w-4xl mx-auto">
          <p className="text-[#FF7F50] font-black uppercase tracking-[0.2em] text-[10px] mb-2">Step {currentStep} of {TOTAL_STEPS}</p>
          <h1 className="text-3xl md:text-5xl font-black uppercase text-white tracking-tighter">Create <span style={{ color: COLORS.KHAKI }}>Adventure</span></h1>
        </div>
      </div>

      <main className="container px-4 max-w-4xl mx-auto -mt-6 relative z-50">
        <div className="flex gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className="h-2 flex-1 rounded-full transition-all" style={{ backgroundColor: i + 1 <= currentStep ? COLORS.TEAL : '#e2e8f0' }} />
          ))}
        </div>

        {/* Step 1: Registration */}
        {currentStep === 1 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-3" style={{ color: COLORS.TEAL }}><Info className="h-5 w-5" /> Registration</h2>
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Registration Name *</Label>
                <Input value={formData.registrationName} onChange={(e) => setFormData({...formData, registrationName: e.target.value})} className={errorClass('registrationName')} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Reg Number *</Label>
                  <Input value={formData.registrationNumber} onChange={(e) => setFormData({...formData, registrationNumber: e.target.value})} className={errorClass('registrationNumber')} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Country *</Label>
                  <div className={errors.country ? "rounded-xl ring-2 ring-red-500" : ""}>
                    <CountrySelector value={formData.country} onChange={(v) => setFormData({...formData, country: v})} />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2: Location */}
        {currentStep === 2 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-3" style={{ color: COLORS.TEAL }}><MapPin className="h-5 w-5" /> Location</h2>
            <div className="grid gap-6">
              <Input placeholder="Location Name" value={formData.locationName} onChange={(e) => setFormData({...formData, locationName: e.target.value})} className={errorClass('locationName')} />
              <Input placeholder="City/Place" value={formData.place} onChange={(e) => setFormData({...formData, place: e.target.value})} className={errorClass('place')} />
              
              <div className={`p-6 rounded-2xl border-2 border-dashed ${errors.gps ? "border-red-500 bg-red-50" : "border-slate-100"}`}>
                <Button onClick={getCurrentLocation} className="w-full h-12 text-white font-black uppercase tracking-widest" style={{ background: formData.latitude ? COLORS.TEAL : COLORS.CORAL }}>
                  {formData.latitude ? "✓ GPS Captured" : "Capture Precise GPS *"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 4: Pricing & Fees */}
        {currentStep === 4 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-3" style={{ color: COLORS.TEAL }}><Clock className="h-5 w-5" /> Schedule & Fees</h2>
            <OperatingHoursSection
              openingHours={formData.openingHours} closingHours={formData.closingHours} workingDays={workingDays}
              onOpeningChange={(v) => setFormData({...formData, openingHours: v})}
              onClosingChange={(v) => setFormData({...formData, closingHours: v})}
              onDaysChange={setWorkingDays} accentColor={COLORS.TEAL}
            />
            <div className="mt-8 pt-6 border-t border-slate-100">
              <Label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Admission Type *</Label>
              <Select value={formData.entranceFeeType} onValueChange={(v) => setFormData({...formData, entranceFeeType: v})}>
                <SelectTrigger className="rounded-xl h-12 font-bold mb-4"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white"><SelectItem value="free">FREE</SelectItem><SelectItem value="paid">PAID</SelectItem></SelectContent>
              </Select>

              {formData.entranceFeeType === "paid" && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Adult Price (KSh) *</Label>
                    <Input type="number" value={formData.adultPrice} onChange={(e) => setFormData({...formData, adultPrice: e.target.value})} className={errorClass('adultPrice')} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Child Price (KSh) *</Label>
                    <Input type="number" value={formData.childPrice} onChange={(e) => setFormData({...formData, childPrice: e.target.value})} className={errorClass('childPrice')} />
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step 5: Facilities Guard */}
        {currentStep === 5 && (
          <Card className={`bg-white rounded-[28px] p-8 shadow-sm border transition-all ${errors.facilities ? "border-red-500 bg-red-50/10" : "border-slate-100"}`}>
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-3" style={{ color: COLORS.TEAL }}><DollarSign className="h-5 w-5" /> Features</h2>
            <div className="space-y-8">
              <DynamicItemList items={amenities} onChange={setAmenities} label="Amenities (Optional)" accentColor={COLORS.TEAL} />
              
              <div className={`p-5 rounded-2xl border-2 border-dashed ${errors.facilities ? "border-red-400 bg-red-50" : "border-slate-100"}`}>
                <div className="flex flex-col mb-4">
                  <Label className="text-sm font-black uppercase text-slate-600">Facilities</Label>
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">Capacity is mandatory for every facility listed!</p>
                </div>
                <DynamicItemList items={facilities} onChange={setFacilities} label="" showCapacity={true} accentColor={COLORS.CORAL} />
              </div>

              <DynamicItemList items={activities} onChange={setActivities} label="Activities (Optional)" accentColor="#6366f1" />
            </div>
          </Card>
        )}

        <div className="flex gap-4 mt-8">
          {currentStep > 1 && <Button onClick={() => setCurrentStep(s => s - 1)} variant="outline" className="flex-1 py-6 rounded-2xl font-black uppercase">Previous</Button>}
          <Button 
            onClick={currentStep < TOTAL_STEPS ? handleNext : handleSubmit} 
            disabled={loading}
            className="flex-1 py-6 rounded-2xl font-black uppercase text-white shadow-lg"
            style={{ background: currentStep < TOTAL_STEPS ? COLORS.CORAL : COLORS.TEAL }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : currentStep < TOTAL_STEPS ? "Next" : "Submit Listing"}
          </Button>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default CreateAdventure;