import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { MapPin, Navigation, X, CheckCircle2, Plus, Camera, ArrowLeft, Loader2, Clock, DollarSign, Image as ImageIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { compressImages } from "@/lib/imageCompression";
import { DynamicItemList, DynamicItem } from "@/components/creation/DynamicItemList";
import { DynamicItemListWithImages, DynamicItemWithImages, uploadItemImages, formatItemsWithImagesForDB } from "@/components/creation/DynamicItemListWithImages";
import { OperatingHoursSection } from "@/components/creation/OperatingHoursSection";
import { GeneralFacilitiesSelector } from "@/components/creation/GeneralFacilitiesSelector";

const COLORS = { TEAL: "#008080", CORAL: "#FF7F50", CORAL_LIGHT: "#FF9E7A", SOFT_GRAY: "#F8F9FA" };

const CreateHotel = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack("/become-host");
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [isAdmin, setIsAdmin] = useState(false);

  const [formData, setFormData] = useState({
    registrationName: "", registrationNumber: "", place: "", country: "",
    description: "", email: "", phoneNumber: "", establishmentType: "hotel",
    latitude: null as number | null, longitude: null as number | null,
    openingHours: "00:00", closingHours: "23:59", generalBookingLink: "",
  });

  const isAccommodationOnly = formData.establishmentType === "accommodation_only";

  const [workingDays, setWorkingDays] = useState({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: true });
  const [amenities, setAmenities] = useState<DynamicItem[]>([]);
  const [generalFacilities, setGeneralFacilities] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<DynamicItemWithImages[]>([]);
  const [activities, setActivities] = useState<DynamicItemWithImages[]>([]);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from('profiles').select('country, name, email, phone_number').eq('id', user.id).single(),
          supabase.from('user_roles').select('role').eq('user_id', user.id)
        ]);
        const profile = profileRes.data;
        if (profile?.country) setFormData(prev => ({ ...prev, country: profile.country }));
        setIsAdmin(!!rolesRes.data?.some(r => r.role === "admin"));
      }
    };
    fetchUserProfile();
  }, [user]);

  const errorClass = (field: string) => errors[field] ? "border-red-500 bg-red-50 focus:ring-red-500" : "border-slate-100 bg-slate-50";

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newImages = [...galleryImages, ...files];
    setGalleryImages(newImages);
    setImagePreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    if (newImages.length > 0) setErrors(prev => ({ ...prev, galleryImages: false }));
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviewUrls[index]);
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const validateAll = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    if (!formData.registrationName.trim()) newErrors.registrationName = true;
    if (!isAccommodationOnly && !formData.registrationNumber.trim()) newErrors.registrationNumber = true;
    if (!formData.country) newErrors.country = true;
    if (!formData.place.trim()) newErrors.place = true;
    if (!isAccommodationOnly) {
      if (!formData.latitude) newErrors.latitude = true;
      if (!formData.email.trim()) newErrors.email = true;
      if (!formData.phoneNumber.trim()) newErrors.phoneNumber = true;
    }
    if (!formData.openingHours) newErrors.openingHours = true;
    if (!formData.closingHours) newErrors.closingHours = true;
    if (!Object.values(workingDays).some(v => v)) newErrors.workingDays = true;
    if (galleryImages.length === 0) newErrors.galleryImages = true;
    if (!formData.description.trim()) newErrors.description = true;

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast({ title: "Missing Details", description: "Please fill all required fields highlighted in red.", variant: "destructive" });
      const firstError = document.querySelector('[data-error="true"]');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return navigate("/auth");
    if (!validateAll()) return;
    setLoading(true);
    try {
      const compressedImages = await compressImages(galleryImages);
      const imageUrls: string[] = [];
      for (const image of compressedImages) {
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('listing-images').upload(fileName, image.file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }

      const selectedDays = Object.entries(workingDays).filter(([_, v]) => v).map(([d]) => d);
      const uploadedFacilities = await uploadItemImages(facilities, user.id);
      const uploadedActivities = await uploadItemImages(activities, user.id);

      const { error } = await supabase.from('hotels').insert([{
        created_by: user.id, name: formData.registrationName, location: formData.place, place: formData.place,
        country: formData.country, description: formData.description, email: formData.email,
        phone_numbers: formData.phoneNumber ? [formData.phoneNumber] : [], establishment_type: formData.establishmentType,
        latitude: formData.latitude, longitude: formData.longitude, opening_hours: formData.openingHours,
        closing_hours: formData.closingHours, days_opened: selectedDays,
        amenities: [...amenities.filter(a => a.name.trim()).map(a => a.name), ...generalFacilities],
        facilities: formatItemsWithImagesForDB(uploadedFacilities), activities: formatItemsWithImagesForDB(uploadedActivities),
        image_url: imageUrls[0] || '', gallery_images: imageUrls, registration_number: formData.registrationNumber || null,
        approval_status: isAccommodationOnly ? 'approved' : 'pending',
        general_booking_link: isAccommodationOnly ? formData.generalBookingLink : null,
      }]);
      if (error) throw error;
      toast({ title: "Success!", description: isAccommodationOnly ? "Your accommodation listing is now live." : "Your hotel listing has been submitted for review." });
      navigate('/become-host');
    } catch (error) {
      console.error('Submission error:', error);
      toast({ title: "Submission Failed", description: "There was an error submitting your listing. Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />
      <div className="relative w-full h-[25vh] md:h-[35vh] bg-slate-900 overflow-hidden">
        <img src="/images/category-hotels.webp" className="w-full h-full object-cover opacity-50" alt="Hotel Header" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F8F9FA] via-transparent to-transparent" />
        <div className="absolute top-4 left-4">
          <Button onClick={goBack} className="rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0"><ArrowLeft className="h-5 w-5" /></Button>
        </div>
        <div className="absolute bottom-8 left-0 w-full px-8 container mx-auto">
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
            List Your <span style={{ color: COLORS.TEAL }}>Property</span>
          </h1>
        </div>
      </div>

      <main className="container px-4 max-w-4xl mx-auto -mt-6 relative z-50 space-y-6">
        {/* Registration Details */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none" data-error={errors.registrationName || errors.registrationNumber}>
          <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
            <CheckCircle2 className="h-5 w-5" /> Registration Details
          </h2>
          <div className="grid gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Name *</Label>
              <Input className={`rounded-xl h-12 font-bold transition-all ${errorClass('registrationName')}`} value={formData.registrationName} onChange={(e) => setFormData({...formData, registrationName: e.target.value})} placeholder="As per official documents" />
            </div>
            {!isAccommodationOnly && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Number *</Label>
                <Input className={`rounded-xl h-12 font-bold transition-all ${errorClass('registrationNumber')}`} value={formData.registrationNumber} onChange={(e) => setFormData({...formData, registrationNumber: e.target.value})} placeholder="e.g. BN-12345" />
              </div>
            )}
            {isAdmin && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Property Type *</Label>
                <Select value={formData.establishmentType} onValueChange={(v) => setFormData({...formData, establishmentType: v})}>
                  <SelectTrigger className="rounded-xl h-12 font-bold"><SelectValue placeholder="Select property type" /></SelectTrigger>
                  <SelectContent><SelectItem value="hotel">Hotel (Full Service)</SelectItem><SelectItem value="accommodation_only">Accommodation Only</SelectItem></SelectContent>
                </Select>
              </div>
            )}
          </div>
        </Card>

        {/* Location & Contact */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none" data-error={errors.country || errors.place}>
          <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
            <MapPin className="h-5 w-5" /> Location & Contact
          </h2>
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Country *</Label>
                <div className={errors.country ? "rounded-xl ring-2 ring-red-500" : ""}><CountrySelector value={formData.country} onChange={(v) => setFormData({...formData, country: v})} /></div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">City / Place *</Label>
                <Input className={`rounded-xl h-12 font-bold ${errorClass('place')}`} value={formData.place} onChange={(e) => setFormData({...formData, place: e.target.value})} />
              </div>
            </div>
            {!isAccommodationOnly && (
              <>
                <div className={`p-4 rounded-[24px] border-2 transition-colors ${errors.latitude ? "border-red-500 bg-red-50" : "border-dashed border-slate-200 bg-slate-50/50"}`}>
                  <Button type="button" onClick={() => {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => { setFormData({...formData, latitude: pos.coords.latitude, longitude: pos.coords.longitude}); setErrors(prev => ({ ...prev, latitude: false })); },
                      () => toast({ title: "Location Error", description: "Unable to get location.", variant: "destructive" })
                    );
                  }} className="w-full rounded-2xl px-6 h-14 font-black uppercase text-[11px] tracking-widest text-white shadow-lg active:scale-95 transition-all" style={{ background: formData.latitude ? COLORS.TEAL : COLORS.CORAL }}>
                    <Navigation className="h-5 w-5 mr-3" />{formData.latitude ? '✓ Location Captured' : 'Tap to Capture GPS Location'}
                  </Button>
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
              </>
            )}
          </div>
        </Card>

        {/* Operating Hours */}
        <Card className={`bg-white rounded-[28px] p-8 shadow-sm border-none ${errors.workingDays || errors.openingHours ? "ring-2 ring-red-500" : ""}`}>
          <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
            <Clock className="h-5 w-5" /> Operating Hours *
          </h2>
          <OperatingHoursSection openingHours={formData.openingHours} closingHours={formData.closingHours} workingDays={workingDays} onOpeningChange={(v) => setFormData({...formData, openingHours: v})} onClosingChange={(v) => setFormData({...formData, closingHours: v})} onDaysChange={setWorkingDays} accentColor={COLORS.TEAL} />
        </Card>

        {/* Facilities & Activities */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
          <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
            <DollarSign className="h-5 w-5" /> Facilities & Activities
          </h2>
          <div className="space-y-8">
            <GeneralFacilitiesSelector selected={generalFacilities} onChange={setGeneralFacilities} accentColor={COLORS.TEAL} />
            <DynamicItemList items={amenities} onChange={setAmenities} label="Additional Amenities (Optional)" showPrice={false} accentColor={COLORS.TEAL} />
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold text-orange-500 uppercase mb-4 underline">
                Each facility must have name, capacity, price, amenities, and at least one photo.
                {isAccommodationOnly && " Each facility can have its own external booking link."}
              </p>
              <DynamicItemListWithImages items={facilities} onChange={setFacilities} label="Facilities (with photos)" showCapacity={true} accentColor={COLORS.CORAL} maxImages={5} userId={user?.id} showBookingLink={isAccommodationOnly} showAmenities={true} />
            </div>
            {!isAccommodationOnly && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <DynamicItemListWithImages items={activities} onChange={setActivities} label="Activities (with photos)" accentColor="#6366f1" maxImages={5} userId={user?.id} />
              </div>
            )}
          </div>
        </Card>

        {/* Gallery Images */}
        <Card className={`bg-white rounded-[28px] p-8 shadow-sm border-none ${errors.galleryImages ? "ring-2 ring-red-500" : ""}`}>
          <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
            <Camera className="h-5 w-5" /> Property Photos *
          </h2>
          <div className="space-y-6">
            <div className={`p-6 rounded-[24px] border-2 border-dashed transition-colors ${errors.galleryImages ? "border-red-500 bg-red-50" : "border-slate-200 bg-slate-50/50"}`}>
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full" style={{ backgroundColor: `${COLORS.TEAL}15` }}><ImageIcon className="h-8 w-8" style={{ color: COLORS.TEAL }} /></div>
                <label className="w-full"><input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  <div className="w-full rounded-2xl px-6 py-4 font-black uppercase text-[11px] tracking-widest text-white shadow-lg active:scale-95 transition-all cursor-pointer text-center" style={{ background: COLORS.CORAL }}>
                    <Camera className="h-5 w-5 inline mr-2" /> Choose Photos
                  </div>
                </label>
              </div>
            </div>
            {galleryImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {imagePreviewUrls.map((url, index) => (
                  <div key={index} className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-100">
                    <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(index)} className="absolute top-2 right-2 p-2 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Description */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
          <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
            <CheckCircle2 className="h-5 w-5" /> Property Description *
          </h2>
          <Textarea className={`rounded-[20px] min-h-[200px] font-medium resize-none ${errorClass('description')}`} placeholder="Describe your property..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          {isAccommodationOnly && (
            <div className="space-y-2 pt-4 border-t border-slate-100 mt-6">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">General Booking Link (External)</Label>
              <Input className="rounded-xl h-12 font-bold" value={formData.generalBookingLink} onChange={(e) => setFormData({...formData, generalBookingLink: e.target.value})} placeholder="https://booking.com/your-property" />
            </div>
          )}
        </Card>

        {/* Submit */}
        <div className="mb-8">
          <Button onClick={handleSubmit} className="w-full py-6 rounded-2xl font-black uppercase text-sm text-white" style={{ background: COLORS.TEAL }} disabled={loading}>
            {loading ? (<><Loader2 className="animate-spin h-4 w-4 mr-2" /> Submitting...</>) : (<><CheckCircle2 className="h-4 w-4 mr-2" />{isAccommodationOnly ? "Publish Listing" : "Submit for Review"}</>)}
          </Button>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default CreateHotel;