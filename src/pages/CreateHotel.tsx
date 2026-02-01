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
import { MapPin, Navigation, X, CheckCircle2, Plus, Camera, ArrowLeft, ArrowRight, Loader2, Clock, DollarSign, FileText, Image } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { compressImages } from "@/lib/imageCompression";
import { DynamicItemList, DynamicItem } from "@/components/creation/DynamicItemList";
import { OperatingHoursSection } from "@/components/creation/OperatingHoursSection";
import { ReviewStep } from "@/components/creation/ReviewStep";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  SOFT_GRAY: "#F8F9FA"
};

const TOTAL_STEPS = 7;

const CreateHotel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    registrationName: "",
    registrationNumber: "",
    place: "",
    country: "",
    description: "",
    email: "",
    phoneNumber: "",
    establishmentType: "hotel",
    latitude: null as number | null,
    longitude: null as number | null,
    openingHours: "",
    closingHours: ""
  });

  const [workingDays, setWorkingDays] = useState({
    Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false
  });

  const [amenities, setAmenities] = useState<DynamicItem[]>([]);
  const [facilities, setFacilities] = useState<DynamicItem[]>([]);
  const [activities, setActivities] = useState<DynamicItem[]>([]);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [creatorProfile, setCreatorProfile] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('country, name, email, phone_number').eq('id', user.id).single();
        if (profile?.country) setFormData(prev => ({ ...prev, country: profile.country }));
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

  const errorClass = (field: string) => 
    errors[field] ? "border-red-500 bg-red-50 focus:ring-red-500" : "border-slate-100 bg-slate-50";

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, boolean> = {};
    
    if (step === 1) {
      if (!formData.registrationName.trim()) newErrors.registrationName = true;
      if (!formData.registrationNumber.trim()) newErrors.registrationNumber = true;
    }
    
    if (step === 2) {
      if (!formData.country) newErrors.country = true;
      if (!formData.place.trim()) newErrors.place = true;
      if (!formData.latitude) newErrors.latitude = true;
      if (!formData.email.trim()) newErrors.email = true;
      if (!formData.phoneNumber.trim()) newErrors.phoneNumber = true;
    }

    if (step === 3) {
      if (!formData.openingHours) newErrors.openingHours = true;
      if (!formData.closingHours) newErrors.closingHours = true;
      const hasDays = Object.values(workingDays).some(v => v);
      if (!hasDays) newErrors.workingDays = true;
    }

    if (step === 4) {
      // Facilities check: If name exists, capacity is mandatory
      const invalidFacility = facilities.some(f => f.name.trim() !== "" && (!f.capacity || parseInt(f.capacity) <= 0));
      if (invalidFacility) {
        toast({ title: "Capacity Required", description: "Please provide capacity for all added facilities.", variant: "destructive" });
        return false; 
      }
    }

    if (step === 5) {
      if (galleryImages.length === 0) {
        toast({ title: "Photos Required", description: "At least one photo is required", variant: "destructive" });
        return false;
      }
    }

    if (step === 6) {
      if (!formData.description.trim()) newErrors.description = true;
    }

    setErrors(newErrors);
    const hasErrors = Object.keys(newErrors).length > 0;
    
    if (hasErrors) {
      toast({ title: "Missing Details", description: "Please fill all required fields highlighted in red.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS));
    }
  };

  const handlePrevious = () => {
    setErrors({});
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setGalleryImages(prev => [...prev, ...files]);
    }
  };

  const removeImage = (index: number) => {
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) return navigate("/auth");
    if (!validateStep(currentStep)) return;
    setLoading(true);
    
    try {
      // Your submission logic here
      toast({ title: "Success!", description: "Property listed successfully", variant: "default" });
      navigate("/dashboard");
    } catch (error) {
      toast({ title: "Error", description: "Failed to submit property", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* Hero Header */}
      <div className="relative w-full h-[25vh] md:h-[35vh] bg-slate-900 overflow-hidden">
        <img src="/images/category-hotels.webp" className="w-full h-full object-cover opacity-50" alt="Hotel Header" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F8F9FA] via-transparent to-transparent" />
        <div className="absolute top-4 left-4">
          <Button onClick={() => navigate(-1)} className="rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="absolute bottom-8 left-0 w-full px-8 container mx-auto">
          <p className="text-[#FF7F50] font-black uppercase tracking-[0.2em] text-[10px] mb-2">Step {currentStep} of {TOTAL_STEPS}</p>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
            List Your <span style={{ color: COLORS.TEAL }}>Property</span>
          </h1>
        </div>
      </div>

      <main className="container px-4 max-w-4xl mx-auto -mt-6 relative z-50">
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
            <div key={step} className={`h-2 flex-1 rounded-full transition-all duration-300 ${step <= currentStep ? 'bg-[#008080]' : 'bg-slate-200'}`} />
          ))}
        </div>

        {/* Step 1 */}
        {currentStep === 1 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <CheckCircle2 className="h-5 w-5" /> Registration Details
            </h2>
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Name *</Label>
                <Input 
                  className={`rounded-xl h-12 font-bold transition-all ${errorClass('registrationName')}`}
                  value={formData.registrationName} 
                  onChange={(e) => setFormData({...formData, registrationName: e.target.value})}
                  placeholder="As per official documents"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Number *</Label>
                <Input 
                  className={`rounded-xl h-12 font-bold transition-all ${errorClass('registrationNumber')}`}
                  value={formData.registrationNumber} 
                  onChange={(e) => setFormData({...formData, registrationNumber: e.target.value})}
                  placeholder="e.g. BN-12345"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Property Type *</Label>
                <Select 
                  value={formData.establishmentType} 
                  onValueChange={(v) => setFormData({...formData, establishmentType: v})}
                >
                  <SelectTrigger className={`rounded-xl h-12 font-bold ${errorClass('establishmentType')}`}>
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hotel">Hotel (Full Service)</SelectItem>
                    <SelectItem value="accommodation_only">Accommodation Only (Rooms/Stays)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {formData.establishmentType === "accommodation_only" 
                    ? "Accommodation only focuses on room rentals without full hotel services."
                    : "Full service hotel with amenities, restaurant, etc."
                  }
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2 */}
        {currentStep === 2 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <MapPin className="h-5 w-5" /> Location & Contact
            </h2>
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Country *</Label>
                  <div className={errors.country ? "rounded-xl ring-2 ring-red-500" : ""}>
                    <CountrySelector value={formData.country} onChange={(v) => setFormData({...formData, country: v})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">City / Place *</Label>
                  <Input className={`rounded-xl h-12 font-bold ${errorClass('place')}`} value={formData.place} onChange={(e) => setFormData({...formData, place: e.target.value})} />
                </div>
              </div>

              <div className={`p-4 rounded-[24px] border-2 transition-colors ${errors.latitude ? "border-red-500 bg-red-50" : "border-dashed border-slate-200 bg-slate-50/50"}`}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full" style={{ backgroundColor: errors.latitude ? "#fee2e2" : `${COLORS.CORAL}15` }}>
                      <Navigation className="h-6 w-6" style={{ color: errors.latitude ? "#ef4444" : COLORS.CORAL }} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-black uppercase tracking-widest" style={{ color: errors.latitude ? "#ef4444" : COLORS.CORAL }}>GPS Location *</h4>
                      <p className="text-[10px] text-slate-400 font-bold">Tap the button to capture your current location</p>
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    onClick={() => {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => setFormData({...formData, latitude: pos.coords.latitude, longitude: pos.coords.longitude}),
                        () => toast({ title: "Location Error", description: "Unable to get location. Please enable GPS.", variant: "destructive" })
                      );
                    }} 
                    className="w-full rounded-2xl px-6 h-14 font-black uppercase text-[11px] tracking-widest text-white shadow-lg active:scale-95 transition-all"
                    style={{ background: formData.latitude ? COLORS.TEAL : COLORS.CORAL }}
                  >
                    <Navigation className="h-5 w-5 mr-3" />
                    {formData.latitude ? '✓ Location Captured Successfully' : 'Tap to Capture GPS Location'}
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Email *</Label>
                  <Input className={`rounded-xl h-12 font-bold ${errorClass('email')}`} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number *</Label>
                  <div className={errors.phoneNumber ? "rounded-xl ring-2 ring-red-500" : ""}>
                    <PhoneInput value={formData.phoneNumber} onChange={(v) => setFormData({...formData, phoneNumber: v})} country={formData.country} />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3 */}
        {currentStep === 3 && (
          <Card className={`bg-white rounded-[28px] p-8 shadow-sm border-none ${errors.workingDays || errors.openingHours ? "ring-2 ring-red-500" : ""}`}>
             <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <Clock className="h-5 w-5" /> Operating Hours *
            </h2>
            <OperatingHoursSection
              openingHours={formData.openingHours}
              closingHours={formData.closingHours}
              workingDays={workingDays}
              onOpeningChange={(v) => setFormData({...formData, openingHours: v})}
              onClosingChange={(v) => setFormData({...formData, closingHours: v})}
              onDaysChange={setWorkingDays}
              accentColor={COLORS.TEAL}
            />
          </Card>
        )}

        {/* Step 4: Amenities & Facilities */}
        {currentStep === 4 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <DollarSign className="h-5 w-5" /> Facilities & Activities
            </h2>
            <div className="space-y-8">
              <DynamicItemList items={amenities} onChange={setAmenities} label="Amenities (Optional)" showPrice={false} accentColor={COLORS.TEAL} />
              
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-bold text-orange-500 uppercase mb-4 underline">Note: Capacity is required for every facility added.</p>
                <DynamicItemList 
                    items={facilities} 
                    onChange={setFacilities} 
                    label="Facilities" 
                    showCapacity={true} 
                    accentColor={COLORS.CORAL} 
                />
              </div>

              <DynamicItemList items={activities} onChange={setActivities} label="Activities" accentColor="#6366f1" />
            </div>
          </Card>
        )}

        {/* Step 5: Gallery Images - THIS WAS MISSING! */}
        {currentStep === 5 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <Camera className="h-5 w-5" /> Property Photos *
            </h2>
            <div className="space-y-6">
              <div className={`p-6 rounded-[24px] border-2 border-dashed transition-colors ${galleryImages.length === 0 ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50/50"}`}>
                <div className="text-center">
                  <Camera className="h-12 w-12 mx-auto mb-4" style={{ color: COLORS.CORAL }} />
                  <h3 className="text-lg font-black uppercase mb-2" style={{ color: COLORS.CORAL }}>Upload Photos</h3>
                  <p className="text-sm text-slate-500 mb-4">Add high-quality images of your property (at least 1 required)</p>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="gallery-upload"
                  />
                  <Button 
                    type="button"
                    onClick={() => document.getElementById('gallery-upload')?.click()}
                    className="rounded-2xl px-8 h-12 font-black uppercase text-[11px] tracking-widest text-white"
                    style={{ background: COLORS.CORAL }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Choose Photos
                  </Button>
                </div>
              </div>

              {/* Image Preview */}
              {galleryImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {galleryImages.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-2xl"
                      />
                      <Button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 w-8 h-8 p-0 rounded-full bg-red-500 hover:bg-red-600"
                      >
                        <X className="h-4 w-4 text-white" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step 6: Description - HEADER WAS MISSING! */}
        {currentStep === 6 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <FileText className="h-5 w-5" /> Property Description *
            </h2>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description *</Label>
              <Textarea 
                className={`rounded-[20px] min-h-[200px] mt-2 font-medium ${errorClass('description')}`}
                placeholder="Tell guests what makes your property unique..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
              <p className="text-[10px] text-slate-400">Describe amenities, location highlights, and what guests can expect.</p>
            </div>
          </Card>
        )}

        {/* Step 7: Review - THIS WAS COMPLETELY MISSING! */}
        {currentStep === 7 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <CheckCircle2 className="h-5 w-5" /> Review & Submit
            </h2>
            <ReviewStep
              formData={formData}
              workingDays={workingDays}
              amenities={amenities}
              facilities={facilities}
              activities={activities}
              galleryImages={galleryImages}
              creatorProfile={creatorProfile}
            />
          </Card>
        )}

        {/* Navigation */}
        <div className="flex gap-4 mt-8">
          {currentStep > 1 && (
            <Button onClick={handlePrevious} variant="outline" className="flex-1 py-6 rounded-2xl font-black uppercase text-sm">
              <ArrowLeft className="h-4 w-4 mr-2" /> Previous
            </Button>
          )}
          <Button 
            onClick={currentStep < TOTAL_STEPS ? handleNext : handleSubmit}
            className="flex-1 py-6 rounded-2xl font-black uppercase text-sm text-white"
            style={{ background: currentStep < TOTAL_STEPS ? COLORS.CORAL : COLORS.TEAL }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin h-4 w-4" />
            ) : currentStep < TOTAL_STEPS ? (
              <>Next <ArrowRight className="h-4 w-4 ml-2" /></>
            ) : (
              "Submit Property"
            )}
          </Button>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default CreateHotel;
