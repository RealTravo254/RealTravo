import { useState, useEffect, useCallback } from "react";
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
import {
  MapPin, Navigation, Clock, X, Plus, Camera,
  CheckCircle2, Info, ArrowLeft, Loader2, DollarSign,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { compressImages } from "@/lib/imageCompression";
import {
  DynamicItemWithImages,
  uploadItemImages,
  formatItemsWithImagesForDB,
} from "@/components/creation/DynamicItemListWithImages";
import { OperatingHoursSection } from "@/components/creation/OperatingHoursSection";
import { GeneralFacilitiesSelector } from "@/components/creation/GeneralFacilitiesSelector";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
};

const generateFriendlyId = (name: string): string => {
  const cleanName = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 30);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${cleanName}-${code}`;
};

// ─── Facility Types ───────────────────────────────────────────────────────────

interface FacilityItem {
  id: string;
  name: string;
  amenities: string;
  price: string;
  images: File[];
  previewUrls: string[];
  saved: boolean;
}

const emptyFacility = (): FacilityItem => ({
  id: crypto.randomUUID(),
  name: "",
  amenities: "",
  price: "",
  images: [],
  previewUrls: [],
  saved: false,
});

// ─── FacilityBuilder ─────────────────────────────────────────────────────────
// Pure presentational component — no hooks. All callbacks passed from parent.

interface FacilityBuilderProps {
  items: FacilityItem[];
  onChange: (items: FacilityItem[]) => void;
  showErrors: boolean;
  onSaveValidationFail: (message: string) => void;
}

const FacilityBuilder = ({
  items,
  onChange,
  showErrors,
  onSaveValidationFail,
}: FacilityBuilderProps) => {
  const update = (id: string, patch: Partial<FacilityItem>) =>
    onChange(items.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const addFacility = () => onChange([...items, emptyFacility()]);

  const removeFacility = (id: string) =>
    onChange(items.filter((f) => f.id !== id));

  const handleImages = async (
    id: string,
    fileList: FileList | null,
    existing: File[]
  ) => {
    if (!fileList) return;
    const available = 5 - existing.length;
    if (available <= 0) return;
    const newFiles = Array.from(fileList).slice(0, available);
    try {
      const compressed = await compressImages(newFiles);
      const merged = [...existing, ...compressed.map((c) => c.file)].slice(0, 5);
      update(id, {
        images: merged,
        previewUrls: merged.map((f) => URL.createObjectURL(f)),
      });
    } catch {
      const merged = [...existing, ...newFiles].slice(0, 5);
      update(id, {
        images: merged,
        previewUrls: merged.map((f) => URL.createObjectURL(f)),
      });
    }
  };

  const removeImage = (
    facilityId: string,
    imgIndex: number,
    existing: File[]
  ) => {
    const updated = existing.filter((_, i) => i !== imgIndex);
    update(facilityId, {
      images: updated,
      previewUrls: updated.map((f) => URL.createObjectURL(f)),
    });
  };

  const saveFacility = (facility: FacilityItem) => {
    if (!facility.name.trim()) {
      onSaveValidationFail("Please enter a facility name.");
      return;
    }
    if (!facility.amenities.trim()) {
      onSaveValidationFail("Please fill in the amenities field.");
      return;
    }
    if (facility.images.length < 2) {
      onSaveValidationFail("Please add at least 2 photos for this facility.");
      return;
    }
    update(facility.id, { saved: true });
  };

  const editFacility = (id: string) => update(id, { saved: false });

  return (
    <div className="space-y-4">
      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        Facilities (with photos)
      </Label>

      {items.map((facility) => (
        <div
          key={facility.id}
          className={cn(
            "rounded-2xl border-2 overflow-hidden transition-all",
            facility.saved
              ? "border-[#008080]/30 bg-[#008080]/5"
              : "border-slate-200 bg-white"
          )}
        >
          {facility.saved ? (
            /* ── Saved summary card ── */
            <div className="p-4 flex items-center gap-4">
              <div className="flex gap-2 shrink-0">
                {facility.previewUrls.slice(0, 3).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                    alt=""
                  />
                ))}
                {facility.previewUrls.length > 3 && (
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-500">
                    +{facility.previewUrls.length - 3}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-slate-800 truncate">
                  {facility.name}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {facility.amenities}
                </p>
                {facility.price && (
                  <p className="text-[11px] font-bold text-[#008080]">
                    KSh {facility.price}
                  </p>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => editFacility(facility.id)}
                  className="text-[10px] font-black uppercase tracking-widest text-[#008080] border border-[#008080]/30 rounded-lg px-3 py-1.5 hover:bg-[#008080]/10 transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeFacility(facility.id)}
                  className="text-[10px] font-black uppercase tracking-widest text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            /* ── Edit form ── */
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Name *
                  </Label>
                  <Input
                    value={facility.name}
                    onChange={(e) =>
                      update(facility.id, { name: e.target.value })
                    }
                    placeholder="e.g. Campsite A"
                    className={cn(
                      "rounded-xl h-10 font-bold text-sm",
                      showErrors &&
                        !facility.name.trim() &&
                        "border-red-500 bg-red-50"
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Price (KSh)
                  </Label>
                  <Input
                    type="number"
                    value={facility.price}
                    onChange={(e) =>
                      update(facility.id, { price: e.target.value })
                    }
                    placeholder="0"
                    className="rounded-xl h-10 font-bold text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Amenities *
                </Label>
                <Input
                  value={facility.amenities}
                  onChange={(e) =>
                    update(facility.id, { amenities: e.target.value })
                  }
                  placeholder="e.g. Firepit, Showers, Electricity"
                  className={cn(
                    "rounded-xl h-10 font-bold text-sm",
                    showErrors &&
                      !facility.amenities.trim() &&
                      "border-red-500 bg-red-50"
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Photos{" "}
                  <span className="text-slate-300 normal-case font-medium">
                    (min 2, max 5)
                  </span>
                  {showErrors && facility.images.length < 2 && (
                    <span className="text-red-500 ml-2">
                      — at least 2 required
                    </span>
                  )}
                </Label>
                <div
                  className={cn(
                    "flex flex-wrap gap-2 p-3 rounded-xl border-2",
                    showErrors && facility.images.length < 2
                      ? "border-red-400 bg-red-50"
                      : "border-dashed border-slate-200"
                  )}
                >
                  {facility.previewUrls.map((url, i) => (
                    <div
                      key={i}
                      className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0"
                    >
                      <img
                        src={url}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                      <button
                        type="button"
                        onClick={() =>
                          removeImage(facility.id, i, facility.images)
                        }
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 shadow"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  {facility.images.length < 5 && (
                    <Label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 shrink-0">
                      <Plus className="h-4 w-4 text-slate-400" />
                      <span className="text-[8px] font-black uppercase text-slate-400 mt-0.5">
                        Photo
                      </span>
                      <Input
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/*"
                        onChange={(e) =>
                          handleImages(facility.id, e.target.files, facility.images)
                        }
                      />
                    </Label>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  onClick={() => saveFacility(facility)}
                  className="flex-1 h-10 rounded-xl font-black uppercase text-[10px] tracking-widest text-white"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.CORAL} 0%, #e06040 100%)`,
                  }}
                >
                  Save Facility
                </Button>
                {items.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeFacility(facility.id)}
                    variant="ghost"
                    className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest text-red-400 hover:text-red-600 hover:bg-red-50 px-4"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <Button
        type="button"
        onClick={addFacility}
        variant="outline"
        className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-dashed border-2 border-slate-200 text-slate-400 hover:border-[#FF7F50] hover:text-[#FF7F50]"
      >
        <Plus className="h-4 w-4 mr-2" /> Add Facility
      </Button>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const CreateAdventure = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack("/become-host");
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const [formData, setFormData] = useState({
    registrationName: "",
    registrationNumber: "",
    locationName: "",
    place: "",
    country: "",
    description: "",
    email: "",
    phoneNumber: "",
    openingHours: "00:00",
    closingHours: "23:59",
    entranceFeeType: "free",
    adultPrice: "0",
    childPrice: "0",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const [workingDays, setWorkingDays] = useState({
    Mon: true, Tue: true, Wed: true, Thu: true,
    Fri: true, Sat: true, Sun: true,
  });

  const [generalFacilities, setGeneralFacilities] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<FacilityItem[]>([emptyFacility()]);
  const [activities, setActivities] = useState<DynamicItemWithImages[]>([]);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);

  // Stable toast callback passed down — no hooks inside FacilityBuilder
  const handleFacilityValidationFail = useCallback(
    (message: string) => {
      toast({ title: "Required", description: message, variant: "destructive" });
    },
    [toast]
  );

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("country")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.country) {
          setFormData((prev) => ({ ...prev, country: data.country }));
        }
      });
  }, [user]);

  const isFieldMissing = (value: any) => {
    if (!showErrors) return false;
    if (typeof value === "string") return !value.trim();
    if (value === null || value === undefined) return true;
    return false;
  };

  const getCurrentLocation = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setFormData((prev) => ({
          ...prev,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }));
        toast({
          title: "Coordinates captured",
          description: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
        });
      },
      () =>
        toast({
          title: "Location Error",
          description: "Could not retrieve GPS.",
          variant: "destructive",
        })
    );
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 5 - galleryImages.length);
    try {
      const compressed = await compressImages(newFiles);
      setGalleryImages((prev) =>
        [...prev, ...compressed.map((c) => c.file)].slice(0, 5)
      );
    } catch {
      setGalleryImages((prev) => [...prev, ...newFiles].slice(0, 5));
    }
  };

  const removeGalleryImage = (index: number) =>
    setGalleryImages((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!user) { navigate("/auth"); return; }
    setShowErrors(true);

    if (
      !formData.registrationName.trim() ||
      !formData.registrationNumber.trim() ||
      !formData.country ||
      !formData.locationName.trim() ||
      !formData.place.trim() ||
      !formData.latitude ||
      !formData.description.trim() ||
      galleryImages.length === 0
    ) {
      toast({
        title: "Action Required",
        description: "Please fill in all mandatory fields.",
        variant: "destructive",
      });
      return;
    }

    const unsaved = facilities.find((f) => !f.saved);
    if (unsaved) {
      toast({
        title: "Unsaved Facility",
        description: "Please save all facilities before submitting.",
        variant: "destructive",
      });
      return;
    }

    const invalid = facilities.find(
      (f) => !f.name.trim() || !f.amenities.trim() || f.images.length < 2
    );
    if (invalid) {
      toast({
        title: "Facility Incomplete",
        description: "Each facility needs a name, amenities, and at least 2 photos.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const friendlyId = generateFriendlyId(formData.registrationName);
      const { data: existing } = await supabase
        .from("adventure_places")
        .select("id")
        .eq("id", friendlyId)
        .single();
      const finalId = existing
        ? generateFriendlyId(formData.registrationName)
        : friendlyId;

      // Upload gallery
      const uploadedUrls: string[] = [];
      for (const file of galleryImages) {
        const ext = file.name.split(".").pop();
        const fileName = `${user.id}/${Math.random()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("listing-images")
          .upload(fileName, file);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage
          .from("listing-images")
          .getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      // Upload facility images
      const facilitiesForDB: object[] = [];
      for (const facility of facilities) {
        const imageUrls: string[] = [];
        for (const file of facility.images) {
          const ext = file.name.split(".").pop();
          const fileName = `${user.id}/facility-${Math.random()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("listing-images")
            .upload(fileName, file);
          if (upErr) throw upErr;
          const { data: { publicUrl } } = supabase.storage
            .from("listing-images")
            .getPublicUrl(fileName);
          imageUrls.push(publicUrl);
        }
        facilitiesForDB.push({
          name: facility.name,
          amenities: facility.amenities,
          price: facility.price ? parseFloat(facility.price) : 0,
          images: imageUrls,
        });
      }

      const selectedDays = Object.entries(workingDays)
        .filter(([, s]) => s)
        .map(([d]) => d);

      const uploadedActivities = await uploadItemImages(activities, user.id);

      const { error } = await supabase.from("adventure_places").insert([{
        id: finalId,
        name: formData.registrationName,
        registration_number: formData.registrationNumber,
        location: formData.locationName,
        place: formData.place,
        country: formData.country,
        description: formData.description,
        email: formData.email,
        phone_numbers: formData.phoneNumber ? [formData.phoneNumber] : [],
        map_link: formData.latitude
          ? `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`
          : "",
        latitude: formData.latitude,
        longitude: formData.longitude,
        opening_hours: formData.openingHours,
        closing_hours: formData.closingHours,
        days_opened: selectedDays,
        image_url: uploadedUrls[0],
        gallery_images: uploadedUrls,
        entry_fee_type: formData.entranceFeeType,
        entry_fee:
          formData.entranceFeeType === "paid"
            ? parseFloat(formData.adultPrice)
            : 0,
        child_entry_fee:
          formData.entranceFeeType === "paid"
            ? parseFloat(formData.childPrice)
            : 0,
        amenities: generalFacilities,
        facilities: facilitiesForDB,
        activities: formatItemsWithImagesForDB(uploadedActivities),
        created_by: user.id,
        approval_status: "pending",
      }]);

      if (error) throw error;

      toast({
        title: "Experience Submitted",
        description: `ID: ${finalId} — Pending admin review.`,
        duration: 5000,
      });
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

      {/* Hero */}
      <div className="relative h-[30vh] w-full overflow-hidden bg-slate-900">
        <img
          src="/images/category-campsite.webp"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          alt="Header"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F8F9FA] via-transparent to-transparent" />
        <Button
          onClick={goBack}
          className="absolute top-4 left-4 rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0 z-50"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
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
            <div className="p-2 rounded-xl bg-[#008080]/10 text-[#008080]">
              <Info className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>
              Registration
            </h2>
          </div>
          <div className="grid gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Registration Name *
              </Label>
              <Input
                value={formData.registrationName}
                onChange={(e) => setFormData({ ...formData, registrationName: e.target.value })}
                placeholder="Official Government Name"
                className={cn("rounded-xl h-12 font-bold", isFieldMissing(formData.registrationName) && "border-red-500 bg-red-50")}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Registration Number *
                </Label>
                <Input
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="e.g. BN-X12345"
                  className={cn("rounded-xl h-12 font-bold", isFieldMissing(formData.registrationNumber) && "border-red-500 bg-red-50")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Country *
                </Label>
                <div className={cn("rounded-xl", isFieldMissing(formData.country) && "border-2 border-red-500 overflow-hidden")}>
                  <CountrySelector
                    value={formData.country}
                    onChange={(value) => setFormData({ ...formData, country: value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Location */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[#FF7F50]/10 text-[#FF7F50]">
              <MapPin className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>
              Location Details
            </h2>
          </div>
          <div className="grid gap-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Location Name *
                </Label>
                <Input
                  value={formData.locationName}
                  onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
                  placeholder="Area / Forest / Beach"
                  className={cn("rounded-xl h-12 font-bold", isFieldMissing(formData.locationName) && "border-red-500 bg-red-50")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Place (City/Town) *
                </Label>
                <Input
                  value={formData.place}
                  onChange={(e) => setFormData({ ...formData, place: e.target.value })}
                  placeholder="e.g. Nairobi"
                  className={cn("rounded-xl h-12 font-bold", isFieldMissing(formData.place) && "border-red-500 bg-red-50")}
                />
              </div>
            </div>
            <div className={cn("p-4 rounded-2xl border-2 transition-all", isFieldMissing(formData.latitude) ? "border-red-500 bg-red-50" : "bg-[#F0E68C]/10 border-[#F0E68C]/30")}>
              <Button
                type="button"
                onClick={getCurrentLocation}
                className="w-full text-white rounded-2xl px-6 h-14 font-black uppercase text-[11px] tracking-widest shadow-lg active:scale-95 transition-all"
                style={{ background: formData.latitude ? COLORS.TEAL : COLORS.KHAKI_DARK }}
              >
                <Navigation className="h-5 w-5 mr-3" />
                {formData.latitude ? "✓ Location Captured" : "Tap to Auto-Capture GPS"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Contact & Description */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[#008080]/10 text-[#008080]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>
              Contact & About
            </h2>
          </div>
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Business Email
                </Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@business.com"
                  className="rounded-xl h-12 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  WhatsApp / Phone
                </Label>
                <PhoneInput
                  value={formData.phoneNumber}
                  onChange={(value) => setFormData({ ...formData, phoneNumber: value })}
                  country={formData.country}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Description *
              </Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Tell the community what makes this adventure special..."
                rows={5}
                className={cn("rounded-2xl font-bold resize-none", isFieldMissing(formData.description) && "border-red-500 bg-red-50")}
              />
            </div>
          </div>
        </Card>

        {/* Access & Pricing */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[#FF7F50]/10 text-[#FF7F50]">
              <Clock className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>
              Access & Pricing
            </h2>
          </div>
          <div className="grid gap-8">
            <OperatingHoursSection
              openingHours={formData.openingHours}
              closingHours={formData.closingHours}
              workingDays={workingDays}
              onOpeningChange={(v) => setFormData({ ...formData, openingHours: v })}
              onClosingChange={(v) => setFormData({ ...formData, closingHours: v })}
              onDaysChange={setWorkingDays}
              accentColor={COLORS.TEAL}
            />
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Entrance Fee
                </Label>
                <Select
                  value={formData.entranceFeeType}
                  onValueChange={(v) => setFormData({ ...formData, entranceFeeType: v })}
                >
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
                <>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Adult Entry (KSh)
                    </Label>
                    <Input
                      type="number"
                      value={formData.adultPrice}
                      onChange={(e) => setFormData({ ...formData, adultPrice: e.target.value })}
                      className="rounded-xl h-12 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Child Entry (KSh)
                    </Label>
                    <Input
                      type="number"
                      value={formData.childPrice}
                      onChange={(e) => setFormData({ ...formData, childPrice: e.target.value })}
                      className="rounded-xl h-12 font-bold"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Amenities, Facilities & Activities */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[#008080]/10 text-[#008080]">
              <DollarSign className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>
              Amenities, Facilities & Activities
            </h2>
          </div>
          <div className="space-y-8">
            <GeneralFacilitiesSelector
              selected={generalFacilities}
              onChange={setGeneralFacilities}
              accentColor={COLORS.TEAL}
            />
            <FacilityBuilder
              items={facilities}
              onChange={setFacilities}
              showErrors={showErrors}
              onSaveValidationFail={handleFacilityValidationFail}
            />
            <DynamicItemListWithImages
              items={activities}
              onChange={setActivities}
              label="Activities (with photos)"
              placeholder="e.g. Hiking"
              showCapacity={false}
              showPrice={false}
              accentColor="#6366f1"
              maxImages={5}
              userId={user?.id}
            />
          </div>
        </Card>

        {/* Gallery */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[#008080]/10 text-[#008080]">
              <Camera className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>
              Gallery (Max 5) *
            </h2>
          </div>
          <div className={cn(
            "grid grid-cols-2 md:grid-cols-5 gap-4 p-4 rounded-2xl",
            showErrors && galleryImages.length === 0 && "border-2 border-red-500 bg-red-50"
          )}>
            {galleryImages.map((file, index) => (
              <div key={index} className="relative aspect-square rounded-[20px] overflow-hidden border-2 border-slate-100">
                <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="Preview" />
                <button
                  type="button"
                  onClick={() => removeGalleryImage(index)}
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
                <Input
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files)}
                />
              </Label>
            )}
          </div>
        </Card>

        {/* Submit */}
        <div className="mb-8">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-6 rounded-2xl font-black uppercase tracking-widest text-sm text-white"
            style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #006666 100%)` }}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
            ) : (
              "Submit for Approval"
            )}
          </Button>
        </div>
      </main>

      <MobileBottomBar />
    </div>
  );
};

export default CreateAdventure;