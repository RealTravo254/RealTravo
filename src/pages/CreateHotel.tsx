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
import { MapPin, Navigation, X, CheckCircle2, Plus, Camera, ArrowLeft, ArrowRight, Loader2, Clock, DollarSign, Image as ImageIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { compressImages } from "@/lib/imageCompression";
import { DynamicItemList, DynamicItem } from "@/components/creation/DynamicItemList";
import { DynamicItemListWithImages, DynamicItemWithImages, uploadItemImages, formatItemsWithImagesForDB } from "@/components/creation/DynamicItemListWithImages";
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
  const [facilities, setFacilities] = useState<DynamicItemWithImages[]>([]);
  const [activities, setActivities] = useState<DynamicItemWithImages[]>([]);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
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
        newErrors.galleryImages = true;
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    setErrors({});
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Add new files to existing ones
    const newImages = [...galleryImages, ...files];
    setGalleryImages(newImages);

    // Create preview URLs
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setImagePreviewUrls(prev => [...prev, ...newPreviewUrls]);

    // Clear error if images are now present
    if (newImages.length > 0) {
      setErrors(prev => ({ ...prev, galleryImages: false }));
    }
  };

  const removeImage = (index: number) => {
    // Revoke the URL to free memory
    URL.revokeObjectURL(imagePreviewUrls[index]);
    
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) return navigate("/auth");
    if (!validateStep(currentStep)) return;
    
    setLoading(true);
    
    try {
      // Compress images
      const compressedImages = await compressImages(galleryImages);
      
      // Upload images to storage
      const imageUrls: string[] = [];
      for (const image of compressedImages) {
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(fileName, image.file);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('listing-images')
          .getPublicUrl(fileName);
        
        imageUrls.push(publicUrl);
      }

      // Get the selected working days as an array
      const selectedDays = Object.entries(workingDays)
        .filter(([_, isSelected]) => isSelected)
        .map(([day]) => day);

      // Upload facility and activity images
      const uploadedFacilities = await uploadItemImages(facilities, user.id);
      const uploadedActivities = await uploadItemImages(activities, user.id);

      // Prepare data for submission
      const hotelData = {
        created_by: user.id,
        name: formData.registrationName,
        location: formData.place,
        place: formData.place,
        country: formData.country,
        description: formData.description,
        email: formData.email,
        phone_numbers: formData.phoneNumber ? [formData.phoneNumber] : [],
        establishment_type: formData.establishmentType,
        latitude: formData.latitude,
        longitude: formData.longitude,
        opening_hours: formData.openingHours,
        closing_hours: formData.closingHours,
        days_opened: selectedDays,
        amenities: amenities.filter(a => a.name.trim() !== "").map(a => a.name),
        facilities: formatItemsWithImagesForDB(uploadedFacilities),
        activities: formatItemsWithImagesForDB(uploadedActivities),
        image_url: imageUrls[0] || '',
        gallery_images: imageUrls,
        registration_number: formData.registrationNumber,
        approval_status: 'pending'
      };

      const { error } = await supabase.from('hotels').insert([hotelData]);
      
      if (error) throw error;

      toast({ 
        title: "Success!", 
        description: "Your hotel listing has been submitted for review.",
        variant: "default"
      });
      
      navigate('/become-host');
    } catch (error) {
      console.error('Submission error:', error);
      toast({ 
        title: "Submission Failed", 
        description: "There was an error submitting your listing. Please try again.",
        variant: "destructive"
      });
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

        {/* Step 1: Registration Details */}
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

        {/* Step 2: Location & Contact */}
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
                        (pos) => {
                          setFormData({...formData, latitude: pos.coords.latitude, longitude: pos.coords.longitude});
                          setErrors(prev => ({ ...prev, latitude: false }));
                        },
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

        {/* Step 3: Operating Hours */}
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
                <p className="text-[10px] font-bold text-orange-500 uppercase mb-4 underline">Note: Capacity is required for every facility added. Add photos to showcase facilities.</p>
                <DynamicItemListWithImages 
                  items={facilities} 
                  onChange={setFacilities} 
                  label="Facilities (with photos)" 
                  showCapacity={true} 
                  accentColor={COLORS.CORAL}
                  maxImages={5}
                  userId={user?.id}
                />
              </div>

              <DynamicItemListWithImages 
                items={activities} 
                onChange={setActivities} 
                label="Activities (with photos)" 
                accentColor="#6366f1"
                maxImages={5}
                userId={user?.id}
              />
            </div>
          </Card>
        )}

        {/* Step 5: Gallery Images */}
        {currentStep === 5 && (
          <Card className={`bg-white rounded-[28px] p-8 shadow-sm border-none ${errors.galleryImages ? "ring-2 ring-red-500" : ""}`}>
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <Camera className="h-5 w-5" /> Property Photos *
            </h2>
            
            <div className="space-y-6">
              {/* Upload Button */}
              <div className={`p-6 rounded-[24px] border-2 border-dashed transition-colors ${errors.galleryImages ? "border-red-500 bg-red-50" : "border-slate-200 bg-slate-50/50"}`}>
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full" style={{ backgroundColor: errors.galleryImages ? "#fee2e2" : `${COLORS.TEAL}15` }}>
                    <ImageIcon className="h-8 w-8" style={{ color: errors.galleryImages ? "#ef4444" : COLORS.TEAL }} />
                  </div>
                  <div className="text-center">
                    <h4 className="text-sm font-black uppercase tracking-widest mb-1" style={{ color: errors.galleryImages ? "#ef4444" : COLORS.TEAL }}>
                      Upload Property Images *
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold">At least one photo is required. Add multiple photos to showcase your property.</p>
                  </div>
                  <label className="w-full">
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      className="hidden" 
                      onChange={handleImageUpload}
                    />
                    <div 
                      className="w-full rounded-2xl px-6 py-4 font-black uppercase text-[11px] tracking-widest text-white shadow-lg active:scale-95 transition-all cursor-pointer text-center"
                      style={{ background: COLORS.CORAL }}
                    >
                      <Camera className="h-5 w-5 inline mr-2" />
                      Choose Photos
                    </div>
                  </label>
                </div>
              </div>

              {/* Image Preview Grid */}
              {galleryImages.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Selected Photos ({galleryImages.length})
                    </Label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {imagePreviewUrls.map((url, index) => (
                      <div key={index} className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-100">
                        <img 
                          src={url} 
                          alt={`Preview ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 p-2 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-[10px] font-bold">Photo {index + 1}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step 6: Description */}
        {currentStep === 6 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <CheckCircle2 className="h-5 w-5" /> Property Description *
            </h2>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Tell guests what makes your property special
              </Label>
              <Textarea 
                className={`rounded-[20px] min-h-[200px] mt-2 font-medium resize-none ${errorClass('description')}`}
                placeholder="Describe your property's unique features, amenities, nearby attractions, and what guests can expect during their stay..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
              <p className="text-[10px] text-slate-400 mt-2">
                {formData.description.length} characters
              </p>
            </div>
          </Card>
        )}

        {/* Step 7: Review & Submit */}
        {currentStep === 7 && (
          <ReviewStep
            type="hotel"
            data={{
              name: formData.registrationName,
              registrationName: formData.registrationName,
              registrationNumber: formData.registrationNumber,
              location: formData.place,
              place: formData.place,
              country: formData.country,
              description: formData.description,
              email: formData.email,
              phoneNumber: formData.phoneNumber,
              openingHours: formData.openingHours,
              closingHours: formData.closingHours,
              workingDays: Object.entries(workingDays).filter(([_, v]) => v).map(([d]) => d),
              amenities: amenities.filter(a => a.name.trim()).map(a => a.name),
              facilities: facilities.filter(f => f.name.trim()).map(f => ({ 
                name: f.name, 
                price: typeof f.price === 'string' ? parseFloat(f.price) || 0 : (f.price || 0),
                capacity: f.capacity ? parseInt(f.capacity) : null,
                is_free: f.priceType === 'free',
                images: f.tempImages ? f.tempImages.map(img => URL.createObjectURL(img)) : (f.images || [])
              })),
              activities: activities.filter(a => a.name.trim()).map(a => ({ 
                name: a.name, 
                price: typeof a.price === 'string' ? parseFloat(a.price) || 0 : (a.price || 0),
                is_free: a.priceType === 'free',
                images: a.tempImages ? a.tempImages.map(img => URL.createObjectURL(img)) : (a.images || [])
              })),
              imageCount: galleryImages.length,
            }}
            creatorName={creatorProfile.name}
            creatorEmail={creatorProfile.email}
            creatorPhone={creatorProfile.phone}
            accentColor={COLORS.TEAL}
          />
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-4 mt-8 mb-8">
          {currentStep > 1 && (
            <Button 
              onClick={handlePrevious} 
              variant="outline" 
              className="flex-1 py-6 rounded-2xl font-black uppercase text-sm"
              disabled={loading}
            >
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
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Submitting...
              </>
            ) : (
              <>
                {currentStep < TOTAL_STEPS ? (
                  <>
                    Next <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Submit for Review
                  </>
                )}
              </>
            )}
          </Button>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default CreateHotel;