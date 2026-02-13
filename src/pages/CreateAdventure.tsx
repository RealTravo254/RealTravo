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
import { MapPin, Navigation, Clock, X, Plus, Camera, CheckCircle2, Info, ArrowLeft, Loader2, DollarSign } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { compressImages } from "@/lib/imageCompression";
import { DynamicItemList, DynamicItem } from "@/components/creation/DynamicItemList";
import { DynamicItemListWithImages, DynamicItemWithImages, uploadItemImages, formatItemsWithImagesForDB } from "@/components/creation/DynamicItemListWithImages";
import { OperatingHoursSection } from "@/components/creation/OperatingHoursSection";
import { GeneralFacilitiesSelector } from "@/components/creation/GeneralFacilitiesSelector";
import { cn } from "@/lib/utils";

const COLORS = { TEAL: "#008080", CORAL: "#FF7F50", CORAL_LIGHT: "#FF9E7A", KHAKI: "#F0E68C", KHAKI_DARK: "#857F3E", SOFT_GRAY: "#F8F9FA" };

const CreateAdventure = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack("/become-host");
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  
  const [formData, setFormData] = useState({
    registrationName: "", registrationNumber: "", locationName: "", place: "", country: "",
    description: "", email: "", phoneNumber: "", openingHours: "00:00", closingHours: "23:59",
    entranceFeeType: "free", adultPrice: "0", childPrice: "0",
    latitude: null as number | null, longitude: null as number | null
  });

  const [workingDays, setWorkingDays] = useState({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: true });
  const [amenities, setAmenities] = useState<DynamicItem[]>([]);
  const [generalFacilities, setGeneralFacilities] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<DynamicItemWithImages[]>([]);
  const [activities, setActivities] = useState<DynamicItemWithImages[]>([]);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('country, name, email, phone_number').eq('id', user.id).single();
        if (profile?.country) setFormData(prev => ({ ...prev, country: profile.country }));
      }
    };
    fetchUserProfile();
  }, [user]);

  const isFieldMissing = (value: any) => {
    if (!showErrors) return false;
    if (typeof value === "string") return !value.trim();
    if (value === null || value === undefined) return true;
    return false;
  };

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({ ...prev, latitude: position.coords.latitude, longitude: position.coords.longitude }));
          toast({ title: "Coordinates captured", description: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}` });
        },
        () => toast({ title: "Location Error", description: "Could not retrieve GPS.", variant: "destructive" })
      );
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 5 - galleryImages.length);
    try {
      const compressed = await compressImages(newFiles);
      setGalleryImages(prev => [...prev, ...compressed.map(c => c.file)].slice(0, 5));
    } catch { setGalleryImages(prev => [...prev, ...newFiles].slice(0, 5)); }
  };

  const removeImage = (index: number) => setGalleryImages(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!user) { navigate("/auth"); return; }
    setShowErrors(true);
    if (!formData.registrationName.trim() || !formData.registrationNumber.trim() || !formData.country || !formData.locationName.trim() || !formData.place.trim() || !formData.latitude || !formData.description.trim() || galleryImages.length === 0) {
      toast({ title: "Action Required", description: "Please fill in all mandatory fields.", variant: "destructive" });
      return;
    }

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
      const uploadedFacilities = await uploadItemImages(facilities, user.id);
      const uploadedActivities = await uploadItemImages(activities, user.id);

      const { error } = await supabase.from("adventure_places").insert([{
        name: formData.registrationName, registration_number: formData.registrationNumber,
        location: formData.locationName, place: formData.place, country: formData.country,
        description: formData.description, email: formData.email,
        phone_numbers: formData.phoneNumber ? [formData.phoneNumber] : [],
        map_link: formData.latitude ? `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}` : "",
        latitude: formData.latitude, longitude: formData.longitude,
        opening_hours: formData.openingHours, closing_hours: formData.closingHours, days_opened: selectedDays,
        image_url: uploadedUrls[0], gallery_images: uploadedUrls,
        entry_fee_type: formData.entranceFeeType,
        entry_fee: formData.entranceFeeType === "paid" ? parseFloat(formData.adultPrice) : 0,
        child_entry_fee: formData.entranceFeeType === "paid" ? parseFloat(formData.childPrice) : 0,
        amenities: [...amenities.map(a => a.name), ...generalFacilities],
        facilities: formatItemsWithImagesForDB(uploadedFacilities), activities: formatItemsWithImagesForDB(uploadedActivities),
        created_by: user.id, approval_status: "pending"
      }]);
      if (error) throw error;
      toast({ title: "Experience Submitted", description: "Pending admin review." });
      navigate("/become-host");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      <div className="relative h-[30vh] w-full overflow-hidden bg-slate-900">
        <img src="/images/category-campsite.webp" className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Header" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F8F9FA] via-transparent to-transparent" />
        <Button onClick={goBack} className="absolute top-4 left-4 rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0 z-50"><ArrowLeft className="h-5 w-5" /></Button>
        <div className="absolute bottom-8 left-0 w-full px-8 container max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
            Create <span style={{ color: COLORS.KHAKI }}>Adventure</span>
          </h1>
        </div>
      </div>

      <main className="container px-4 max-w-4xl mx-auto -mt-6 relative z-50 space-y-6">
        {/* Registration */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[#008080]/10 text-[#008080]"><Info className="h-5 w-5" /></div>
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Registration</h2>
          </div>
          <div className="grid gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Name *</Label>
              <Input value={formData.registrationName} onChange={(e) => setFormData({...formData, registrationName: e.target.value})} placeholder="Official Government Name" className={cn("rounded-xl h-12 font-bold", isFieldMissing(formData.registrationName) && "border-red-500 bg-red-50")} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Number *</Label>
                <Input value={formData.registrationNumber} onChange={(e) => setFormData({...formData, registrationNumber: e.target.value})} placeholder="e.g. BN-X12345" className={cn("rounded-xl h-12 font-bold", isFieldMissing(formData.registrationNumber) && "border-red-500 bg-red-50")} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Country *</Label>
                <div className={cn("rounded-xl", isFieldMissing(formData.country) && "border-2 border-red-500 overflow-hidden")}><CountrySelector value={formData.country} onChange={(value) => setFormData({...formData, country: value})} /></div>
              </div>
            </div>
          </div>
        </Card>

        {/* Location */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[#FF7F50]/10 text-[#FF7F50]"><MapPin className="h-5 w-5" /></div>
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Location Details</h2>
          </div>
          <div className="grid gap-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location Name *</Label>
                <Input value={formData.locationName} onChange={(e) => setFormData({...formData, locationName: e.target.value})} placeholder="Area / Forest / Beach" className={cn("rounded-xl h-12 font-bold", isFieldMissing(formData.locationName) && "border-red-500 bg-red-50")} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Place (City/Town) *</Label>
                <Input value={formData.place} onChange={(e) => setFormData({...formData, place: e.target.value})} placeholder="e.g. Nairobi" className={cn("rounded-xl h-12 font-bold", isFieldMissing(formData.place) && "border-red-500 bg-red-50")} />
              </div>
            </div>
            <div className={cn("p-4 rounded-2xl border-2 transition-all", isFieldMissing(formData.latitude) ? "border-red-500 bg-red-50" : "bg-[#F0E68C]/10 border-[#F0E68C]/30")}>
              <Button type="button" onClick={getCurrentLocation} className="w-full text-white rounded-2xl px-6 h-14 font-black uppercase text-[11px] tracking-widest shadow-lg active:scale-95 transition-all" style={{ background: formData.latitude ? COLORS.TEAL : COLORS.KHAKI_DARK }}>
                <Navigation className="h-5 w-5 mr-3" />{formData.latitude ? '✓ Location Captured' : 'Tap to Auto-Capture GPS'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Contact & Description */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[#008080]/10 text-[#008080]"><CheckCircle2 className="h-5 w-5" /></div>
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Contact & About</h2>
          </div>
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="contact@business.com" className="rounded-xl h-12 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">WhatsApp / Phone</Label>
                <PhoneInput value={formData.phoneNumber} onChange={(value) => setFormData({...formData, phoneNumber: value})} country={formData.country} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description *</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Tell the community what makes this adventure special..." rows={5} className={cn("rounded-2xl font-bold resize-none", isFieldMissing(formData.description) && "border-red-500 bg-red-50")} />
            </div>
          </div>
        </Card>

        {/* Access & Pricing */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[#FF7F50]/10 text-[#FF7F50]"><Clock className="h-5 w-5" /></div>
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Access & Pricing</h2>
          </div>
          <div className="grid gap-8">
            <OperatingHoursSection openingHours={formData.openingHours} closingHours={formData.closingHours} workingDays={workingDays} onOpeningChange={(v) => setFormData({...formData, openingHours: v})} onClosingChange={(v) => setFormData({...formData, closingHours: v})} onDaysChange={setWorkingDays} accentColor={COLORS.TEAL} />
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entrance Fee</Label>
                <Select value={formData.entranceFeeType} onValueChange={(v) => setFormData({...formData, entranceFeeType: v})}>
                  <SelectTrigger className="rounded-xl h-12 font-bold border-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white rounded-xl font-bold"><SelectItem value="free">FREE ACCESS</SelectItem><SelectItem value="paid">PAID ADMISSION</SelectItem></SelectContent>
                </Select>
              </div>
              {formData.entranceFeeType === "paid" && (<>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adult Entry (KSh)</Label><Input type="number" value={formData.adultPrice} onChange={(e) => setFormData({...formData, adultPrice: e.target.value})} className="rounded-xl h-12 font-bold" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Child Entry (KSh)</Label><Input type="number" value={formData.childPrice} onChange={(e) => setFormData({...formData, childPrice: e.target.value})} className="rounded-xl h-12 font-bold" /></div>
              </>)}
            </div>
          </div>
        </Card>

        {/* Amenities, Facilities & Activities */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[#008080]/10 text-[#008080]"><DollarSign className="h-5 w-5" /></div>
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Amenities, Facilities & Activities</h2>
          </div>
          <div className="space-y-8">
            <GeneralFacilitiesSelector selected={generalFacilities} onChange={setGeneralFacilities} accentColor={COLORS.TEAL} />
            <DynamicItemList items={amenities} onChange={setAmenities} label="Additional Amenities" placeholder="e.g. Parking, Restrooms" showCapacity={false} showPrice={false} accentColor={COLORS.TEAL} />
            <DynamicItemListWithImages items={facilities} onChange={setFacilities} label="Facilities (with photos)" placeholder="e.g. Campsite" showCapacity={true} showPrice={true} accentColor={COLORS.CORAL} maxImages={5} userId={user?.id} showAmenities={true} />
            <DynamicItemListWithImages items={activities} onChange={setActivities} label="Activities (with photos)" placeholder="e.g. Hiking" showCapacity={false} showPrice={false} accentColor="#6366f1" maxImages={5} userId={user?.id} />
          </div>
        </Card>

        {/* Photos */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[#008080]/10 text-[#008080]"><Camera className="h-5 w-5" /></div>
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Gallery (Max 5) *</h2>
          </div>
          <div className={cn("grid grid-cols-2 md:grid-cols-5 gap-4 p-4 rounded-2xl", isFieldMissing(galleryImages.length === 0 ? null : true) && "border-2 border-red-500 bg-red-50")}>
            {galleryImages.map((file, index) => (
              <div key={index} className="relative aspect-square rounded-[20px] overflow-hidden border-2 border-slate-100">
                <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="Preview" />
                <button type="button" onClick={() => removeImage(index)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {galleryImages.length < 5 && (
              <Label className="aspect-square rounded-[20px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50">
                <Plus className="h-6 w-6 text-slate-400" /><span className="text-[9px] font-black uppercase text-slate-400 mt-1">Add Photo</span>
                <Input type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e.target.files)} />
              </Label>
            )}
          </div>
        </Card>

        {/* Submit */}
        <div className="mb-8">
          <Button type="button" onClick={handleSubmit} disabled={loading} className="w-full py-6 rounded-2xl font-black uppercase tracking-widest text-sm text-white" style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #006666 100%)` }}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : "Submit for Approval"}
          </Button>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default CreateAdventure;