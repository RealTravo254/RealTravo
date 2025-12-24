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
import { MapPin, Navigation, X, CheckCircle2, Plus, Camera, ArrowLeft, ArrowRight, Loader2, Clock, DollarSign } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { compressImages } from "@/lib/imageCompression";
import { DynamicItemList, DynamicItem } from "@/components/creation/DynamicItemList";
import { OperatingHoursSection } from "@/components/creation/OperatingHoursSection";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  SOFT_GRAY: "#F8F9FA"
};

const TOTAL_STEPS = 6;

const CreateHotel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

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

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('country').eq('id', user.id).single();
        if (profile?.country) setFormData(prev => ({ ...prev, country: profile.country }));
      }
    };
    fetchUserProfile();
  }, [user]);

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setFormData(prev => ({ ...prev, latitude, longitude }));
          toast({ title: "Coordinates Captured", description: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
        },
        () => toast({ title: "Error", description: "Enable location permissions.", variant: "destructive" })
      );
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 5 - galleryImages.length);
    try {
      const compressed = await compressImages(newFiles);
      setGalleryImages(prev => [...prev, ...compressed.map(c => c.file)]);
    } catch (error) {
      console.error("Error compressing images:", error);
      setGalleryImages(prev => [...prev, ...newFiles]);
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.registrationName.trim()) {
          toast({ title: "Required", description: "Business name is required", variant: "destructive" });
          return false;
        }
        if (!formData.registrationNumber.trim()) {
          toast({ title: "Required", description: "Registration number is required", variant: "destructive" });
          return false;
        }
        return true;
      case 2:
        if (!formData.country) {
          toast({ title: "Required", description: "Country is required", variant: "destructive" });
          return false;
        }
        if (!formData.place.trim()) {
          toast({ title: "Required", description: "City/Place is required", variant: "destructive" });
          return false;
        }
        if (!formData.latitude) {
          toast({ title: "Required", description: "GPS location is required", variant: "destructive" });
          return false;
        }
        return true;
      case 3:
        return true; // Operating hours optional
      case 4:
        return true; // Amenities/facilities/activities optional
      case 5:
        if (galleryImages.length === 0) {
          toast({ title: "Required", description: "At least one photo is required", variant: "destructive" });
          return false;
        }
        return true;
      case 6:
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

  const formatItemsForDB = (items: DynamicItem[]) => {
    return items.map(item => ({
      name: item.name,
      price: item.priceType === "paid" ? parseFloat(item.price) || 0 : 0,
      is_free: item.priceType === "free",
      capacity: item.capacity ? parseInt(item.capacity) : null
    }));
  };

  const handleSubmit = async () => {
    if (!user) return navigate("/auth");
    if (!validateStep(currentStep)) return;

    setLoading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of galleryImages) {
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const { error: uploadError } = await supabase.storage.from('listing-images').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      const selectedDays = Object.entries(workingDays).filter(([_, s]) => s).map(([d]) => d);

      const { error } = await supabase.from("hotels").insert([{
        name: formData.registrationName,
        registration_number: formData.registrationNumber,
        location: formData.place,
        place: formData.place,
        country: formData.country,
        description: formData.description,
        email: formData.email,
        phone_numbers: formData.phoneNumber ? [formData.phoneNumber] : [],
        latitude: formData.latitude,
        longitude: formData.longitude,
        image_url: uploadedUrls[0],
        gallery_images: uploadedUrls,
        establishment_type: formData.establishmentType,
        opening_hours: formData.openingHours,
        closing_hours: formData.closingHours,
        days_opened: selectedDays,
        amenities: amenities.map(a => a.name),
        facilities: formatItemsForDB(facilities),
        activities: formatItemsForDB(activities),
        created_by: user.id,
        approval_status: "pending"
      }]);

      if (error) throw error;
      toast({ title: "Listing Submitted", description: "Our team will verify your property shortly." });
      navigate("/become-host");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center gap-2 flex-1">
          <div
            className={`h-2 flex-1 rounded-full transition-all duration-300 ${
              step <= currentStep ? 'bg-[#008080]' : 'bg-slate-200'
            }`}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* Hero Header */}
      <div className="relative w-full h-[25vh] md:h-[35vh] bg-slate-900 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200" 
          className="w-full h-full object-cover opacity-50" 
          alt="Hotel Header"
        />
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
        <StepIndicator />

        {/* Step 1: Registration Details */}
        {currentStep === 1 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <CheckCircle2 className="h-5 w-5" /> Registration Details
            </h2>
            
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Name *</Label>
                <Input 
                  className="rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all h-12 font-bold"
                  value={formData.registrationName} 
                  onChange={(e) => setFormData({...formData, registrationName: e.target.value})}
                  placeholder="As per official documents"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Number *</Label>
                  <Input 
                    className="rounded-xl border-slate-100 bg-slate-50 h-12 font-bold"
                    value={formData.registrationNumber} 
                    onChange={(e) => setFormData({...formData, registrationNumber: e.target.value})}
                    placeholder="e.g. BN-12345"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Property Category</Label>
                  <Select onValueChange={(v) => setFormData({...formData, establishmentType: v})} defaultValue="hotel">
                    <SelectTrigger className="rounded-xl border-slate-100 bg-slate-50 h-12 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="hotel">Hotel / Resort</SelectItem>
                      <SelectItem value="apartment">Serviced Apartment</SelectItem>
                      <SelectItem value="lodge">Safari Lodge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2: Location & Contact */}
        {currentStep === 2 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <MapPin className="h-5 w-5" /> Location & Contact
            </h2>
            
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Country *</Label>
                  <CountrySelector value={formData.country} onChange={(v) => setFormData({...formData, country: v})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">City / Place *</Label>
                  <Input 
                    className="rounded-xl border-slate-100 bg-slate-50 h-12 font-bold"
                    value={formData.place} 
                    onChange={(e) => setFormData({...formData, place: e.target.value})}
                    placeholder="e.g. Nairobi"
                  />
                </div>
              </div>

              <div className="p-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center text-center gap-4">
                <div className="p-4 rounded-full bg-white shadow-sm">
                  <Navigation className="h-6 w-6" style={{ color: COLORS.CORAL }} />
                </div>
                <div>
                  <h4 className="font-black uppercase tracking-tighter text-sm">GPS Location *</h4>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">Stand at the property entrance</p>
                </div>
                <Button 
                  type="button" 
                  onClick={getCurrentLocation}
                  className="rounded-full px-8 font-black uppercase tracking-widest text-[10px] h-11 transition-all active:scale-95"
                  style={{ background: formData.latitude ? COLORS.TEAL : COLORS.CORAL }}
                >
                  {formData.latitude ? "✓ Location Captured" : "Capture My Location"}
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Email</Label>
                  <Input 
                    type="email"
                    className="rounded-xl border-slate-100 bg-slate-50 h-12 font-bold"
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="contact@business.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</Label>
                  <PhoneInput value={formData.phoneNumber} onChange={(v) => setFormData({...formData, phoneNumber: v})} country={formData.country} />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Operating Hours */}
        {currentStep === 3 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <Clock className="h-5 w-5" /> Operating Hours & Days
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

        {/* Step 4: Amenities, Facilities & Activities */}
        {currentStep === 4 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <DollarSign className="h-5 w-5" /> Amenities, Facilities & Activities
            </h2>
            
            <div className="space-y-8">
              <DynamicItemList
                items={amenities}
                onChange={setAmenities}
                label="Amenities"
                placeholder="e.g. Free WiFi, Pool, Gym"
                showCapacity={false}
                accentColor={COLORS.TEAL}
              />

              <DynamicItemList
                items={facilities}
                onChange={setFacilities}
                label="Facilities"
                placeholder="e.g. Conference Room, Restaurant"
                showCapacity={true}
                accentColor={COLORS.CORAL}
              />

              <DynamicItemList
                items={activities}
                onChange={setActivities}
                label="Activities"
                placeholder="e.g. Spa Treatment, City Tour"
                showCapacity={false}
                accentColor="#6366f1"
              />
            </div>
          </Card>
        )}

        {/* Step 5: Photos */}
        {currentStep === 5 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <Camera className="h-5 w-5" /> Gallery (Max 5) *
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {galleryImages.map((file, i) => (
                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-100">
                  <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setGalleryImages(galleryImages.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-red-500 p-1 rounded-full text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {galleryImages.length < 5 && (
                <Label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors">
                  <Plus className="h-6 w-6 text-slate-400" />
                  <span className="text-[9px] font-black uppercase mt-1 text-slate-400">Add Photo</span>
                  <Input type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e.target.files)} />
                </Label>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center">Upload at least 1 photo to proceed</p>
          </Card>
        )}

        {/* Step 6: Description */}
        {currentStep === 6 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-black uppercase tracking-tight mb-4" style={{ color: COLORS.TEAL }}>The Experience</h2>
            <Textarea 
              className="rounded-[20px] border-slate-100 bg-slate-50 min-h-[200px] p-4 font-medium"
              placeholder="Tell guests what makes your property unique..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-4 mt-8">
          {currentStep > 1 && (
            <Button 
              type="button"
              onClick={handlePrevious}
              variant="outline"
              className="flex-1 py-6 rounded-2xl font-black uppercase tracking-widest text-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Previous
            </Button>
          )}
          
          {currentStep < TOTAL_STEPS ? (
            <Button 
              type="button"
              onClick={handleNext}
              className="flex-1 py-6 rounded-2xl font-black uppercase tracking-widest text-sm text-white"
              style={{ background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)` }}
            >
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              type="button"
              onClick={handleSubmit}
              disabled={loading}
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

export default CreateHotel;
