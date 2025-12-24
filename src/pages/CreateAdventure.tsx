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

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  SOFT_GRAY: "#F8F9FA"
};

const TOTAL_STEPS = 6;

const CreateAdventure = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
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
    adultPrice: "0",
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
          toast({ title: "Coordinates captured", description: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
        },
        () => toast({ title: "Location Error", variant: "destructive" })
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

  const removeImage = (index: number) => setGalleryImages(prev => prev.filter((_, i) => i !== index));

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.registrationName.trim()) {
          toast({ title: "Required", description: "Registration name is required", variant: "destructive" });
          return false;
        }
        if (!formData.registrationNumber.trim()) {
          toast({ title: "Required", description: "Registration number is required", variant: "destructive" });
          return false;
        }
        if (!formData.country) {
          toast({ title: "Required", description: "Country is required", variant: "destructive" });
          return false;
        }
        return true;
      case 2:
        if (!formData.locationName.trim()) {
          toast({ title: "Required", description: "Location name is required", variant: "destructive" });
          return false;
        }
        if (!formData.place.trim()) {
          toast({ title: "Required", description: "Place/City is required", variant: "destructive" });
          return false;
        }
        if (!formData.latitude) {
          toast({ title: "Required", description: "GPS coordinates are required", variant: "destructive" });
          return false;
        }
        return true;
      case 3:
        if (!formData.description.trim()) {
          toast({ title: "Required", description: "Description is required", variant: "destructive" });
          return false;
        }
        return true;
      case 4:
        return true; // Operating hours optional
      case 5:
        return true; // Amenities/facilities/activities optional
      case 6:
        if (galleryImages.length === 0) {
          toast({ title: "Required", description: "At least one photo is required", variant: "destructive" });
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

  const formatItemsForDB = (items: DynamicItem[]) => {
    return items.map(item => ({
      name: item.name,
      price: item.priceType === "paid" ? parseFloat(item.price) || 0 : 0,
      is_free: item.priceType === "free",
      capacity: item.capacity ? parseInt(item.capacity) : null
    }));
  };

  const handleSubmit = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!validateStep(currentStep)) return;

    setLoading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of galleryImages) {
        const fileName = `${user.id}/${Math.random()}.${file.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('listing-images').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      const selectedDays = Object.entries(workingDays).filter(([_, s]) => s).map(([d]) => d);

      const { error } = await supabase.from("adventure_places").insert([{
        name: formData.registrationName,
        registration_number: formData.registrationNumber,
        location: formData.locationName,
        place: formData.place,
        country: formData.country,
        description: formData.description,
        email: formData.email,
        phone_numbers: formData.phoneNumber ? [formData.phoneNumber] : [],
        map_link: formData.latitude ? `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}` : "",
        latitude: formData.latitude,
        longitude: formData.longitude,
        opening_hours: formData.openingHours,
        closing_hours: formData.closingHours,
        days_opened: selectedDays,
        image_url: uploadedUrls[0],
        gallery_images: uploadedUrls,
        entry_fee_type: formData.entranceFeeType,
        entry_fee: formData.entranceFeeType === "paid" ? parseFloat(formData.adultPrice) : 0,
        amenities: formatItemsForDB(amenities),
        facilities: formatItemsForDB(facilities),
        activities: formatItemsForDB(activities),
        created_by: user.id,
        approval_status: "pending"
      }]);

      if (error) throw error;
      toast({ title: "Experience Submitted", description: "Pending admin review." });
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

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      
      {/* Hero Header */}
      <div className="relative h-[30vh] w-full overflow-hidden bg-slate-900">
        <img src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200" 
          className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Header"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F8F9FA] via-transparent to-transparent" />
        <Button onClick={() => navigate(-1)} className="absolute top-4 left-4 rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0 z-50">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="absolute bottom-8 left-0 w-full px-8 container max-w-4xl mx-auto">
          <p className="text-[#FF7F50] font-black uppercase tracking-[0.2em] text-[10px] mb-2">Step {currentStep} of {TOTAL_STEPS}</p>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
            Create <span style={{ color: COLORS.KHAKI }}>Adventure</span>
          </h1>
        </div>
      </div>

      <main className="container px-4 max-w-4xl mx-auto -mt-6 relative z-50">
        <StepIndicator />

        {/* Step 1: Registration */}
        {currentStep === 1 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-[#008080]/10 text-[#008080]">
                <Info className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Registration</h2>
            </div>
            
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Name *</Label>
                <Input
                  value={formData.registrationName}
                  onChange={(e) => setFormData({...formData, registrationName: e.target.value})}
                  placeholder="Official Government Name"
                  className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all h-12 font-bold"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Number *</Label>
                  <Input
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({...formData, registrationNumber: e.target.value})}
                    placeholder="e.g. BN-X12345"
                    className="rounded-xl border-slate-100 bg-slate-50/50 h-12 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Country *</Label>
                  <CountrySelector value={formData.country} onChange={(value) => setFormData({...formData, country: value})} />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2: Location */}
        {currentStep === 2 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-[#FF7F50]/10 text-[#FF7F50]">
                <MapPin className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Location Details</h2>
            </div>

            <div className="grid gap-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location Name *</Label>
                  <Input
                    value={formData.locationName}
                    onChange={(e) => setFormData({...formData, locationName: e.target.value})}
                    placeholder="Area / Forest / Beach"
                    className="rounded-xl border-slate-100 bg-slate-50/50 h-12 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Place (City/Town) *</Label>
                  <Input
                    value={formData.place}
                    onChange={(e) => setFormData({...formData, place: e.target.value})}
                    placeholder="e.g. Nairobi"
                    className="rounded-xl border-slate-100 bg-slate-50/50 h-12 font-bold"
                  />
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[#F0E68C]/10 border border-[#F0E68C]/30 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-[#857F3E]">GPS Coordinates *</h4>
                    <p className="text-[10px] text-[#857F3E]/80 font-bold uppercase mt-1">Capture precise location for maps</p>
                  </div>
                  <Button type="button" onClick={getCurrentLocation}
                    className="text-white rounded-xl px-6 h-12 font-black uppercase text-[10px] tracking-widest"
                    style={{ background: formData.latitude ? COLORS.TEAL : COLORS.KHAKI_DARK }}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    {formData.latitude ? '✓ Location Captured' : 'Auto-Capture GPS'}
                  </Button>
                </div>
                {formData.latitude && (
                  <div className="flex items-center gap-2 text-[#857F3E] text-xs font-black bg-white/50 p-3 rounded-lg border border-[#F0E68C]">
                    <CheckCircle2 className="h-4 w-4" /> 
                    COORD: {formData.latitude.toFixed(6)}, {formData.longitude?.toFixed(6)}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Contact & Description */}
        {currentStep === 3 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-[#008080]/10 text-[#008080]">
                <Mail className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Contact & About</h2>
            </div>
            
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Email</Label>
                  <Input type="email" value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="contact@business.com"
                    className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all h-12 font-bold"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">WhatsApp / Phone</Label>
                  <PhoneInput value={formData.phoneNumber}
                    onChange={(value) => setFormData({...formData, phoneNumber: value})}
                    country={formData.country}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Tell the community what makes this adventure special..."
                  rows={5}
                  className="rounded-2xl border-slate-100 bg-slate-50/50 font-bold resize-none"
                />
              </div>
            </div>
          </Card>
        )}

        {/* Step 4: Pricing & Schedule */}
        {currentStep === 4 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-[#FF7F50]/10 text-[#FF7F50]">
                <Clock className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Access & Pricing</h2>
            </div>

            <div className="grid gap-8">
              <OperatingHoursSection
                openingHours={formData.openingHours}
                closingHours={formData.closingHours}
                workingDays={workingDays}
                onOpeningChange={(v) => setFormData({...formData, openingHours: v})}
                onClosingChange={(v) => setFormData({...formData, closingHours: v})}
                onDaysChange={setWorkingDays}
                accentColor={COLORS.TEAL}
              />

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entrance Fee</Label>
                  <Select value={formData.entranceFeeType} onValueChange={(v) => setFormData({...formData, entranceFeeType: v})}>
                    <SelectTrigger className="rounded-xl h-12 font-bold border-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white rounded-xl font-bold">
                      <SelectItem value="free">FREE ACCESS</SelectItem>
                      <SelectItem value="paid">PAID ADMISSION</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.entranceFeeType === "paid" && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adult Entry (KSh)</Label>
                    <Input type="number" value={formData.adultPrice}
                      onChange={(e) => setFormData({...formData, adultPrice: e.target.value})}
                      className="rounded-xl h-12 border-slate-100 font-bold"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Step 5: Amenities, Facilities & Activities */}
        {currentStep === 5 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-[#008080]/10 text-[#008080]">
                <DollarSign className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Amenities, Facilities & Activities</h2>
            </div>
            
            <div className="space-y-8">
              <DynamicItemList
                items={amenities}
                onChange={setAmenities}
                label="Amenities"
                placeholder="e.g. Parking, Restrooms, Picnic Area"
                showCapacity={false}
                accentColor={COLORS.TEAL}
              />

              <DynamicItemList
                items={facilities}
                onChange={setFacilities}
                label="Facilities"
                placeholder="e.g. Campsite, Viewing Deck"
                showCapacity={true}
                accentColor={COLORS.CORAL}
              />

              <DynamicItemList
                items={activities}
                onChange={setActivities}
                label="Activities"
                placeholder="e.g. Hiking, Bird Watching, Zip Lining"
                showCapacity={false}
                accentColor="#6366f1"
              />
            </div>
          </Card>
        )}

        {/* Step 6: Photos */}
        {currentStep === 6 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-[#008080]/10 text-[#008080]">
                <Camera className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Gallery (Max 5) *</h2>
            </div>

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
                  <Plus className="h-6 w-6 text-slate-400" />
                  <span className="text-[9px] font-black uppercase text-slate-400 mt-1">Add Photo</span>
                  <Input type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e.target.files)} />
                </Label>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center">Upload at least 1 photo to submit</p>
          </Card>
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

export default CreateAdventure;
