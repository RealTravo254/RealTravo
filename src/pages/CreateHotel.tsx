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
import { useBanCheck } from "@/hooks/useBanCheck";
import {
  MapPin, Navigation, X, CheckCircle2, Plus, Camera,
  ArrowLeft, Loader2, Clock, DollarSign, Image as ImageIcon,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { CountySelector } from "@/components/creation/CountySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { compressImages } from "@/lib/imageCompression";
import { OperatingHoursSection } from "@/components/creation/OperatingHoursSection";
import { ReviewStep } from "@/components/creation/ReviewStep";
import { GeneralFacilitiesSelector } from "@/components/creation/GeneralFacilitiesSelector";
import { CreateFormStepper } from "@/components/creation/CreateFormStepper";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  SOFT_GRAY: "#F8F9FA",
};

let _idCounter = 0;
const makeId = () => `item-${Date.now()}-${++_idCounter}`;

const generateFriendlySlug = (name: string): string => {
  const cleanName = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").substring(0, 30);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${cleanName}-${code}`;
};

const safeObjectUrl = (file: File): string => {
  try { return URL.createObjectURL(file); } catch { return ""; }
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FacilityItem {
  id: string; name: string; amenities: string[]; amenityInput: string;
  price: string; capacity: string; bookingLink: string;
  images: File[]; previewUrls: string[]; saved: boolean;
}

interface ActivityItem {
  id: string; name: string; price: string;
  images: File[]; previewUrls: string[]; saved: boolean;
}

const emptyFacility = (): FacilityItem => ({
  id: makeId(), name: "", amenities: [], amenityInput: "",
  price: "", capacity: "", bookingLink: "",
  images: [], previewUrls: [], saved: false,
});

const emptyActivity = (): ActivityItem => ({
  id: makeId(), name: "", price: "", images: [], previewUrls: [], saved: false,
});

// ─── Amenity Tag Input ────────────────────────────────────────────────────────

interface AmenityTagInputProps {
  tags: string[]; input: string; onInputChange: (v: string) => void;
  onAdd: () => void; onRemove: (i: number) => void; hasError: boolean;
}

const AmenityTagInput = ({ tags, input, onInputChange, onAdd, onRemove, hasError }: AmenityTagInputProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "," || e.key === "Enter") { e.preventDefault(); onAdd(); }
    if (e.key === "Backspace" && !input && tags.length > 0) onRemove(tags.length - 1);
  };
  return (
    <div className={cn("min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-xl border-2 bg-white transition-colors",
      hasError ? "border-red-500 bg-red-50" : "border-slate-200 focus-within:border-[#008080]")}>
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 bg-[#008080]/10 text-[#008080] text-[11px] font-black rounded-lg px-2 py-0.5">
          {tag}
          <button type="button" onClick={() => onRemove(i)} className="hover:text-red-500 transition-colors"><X className="h-2.5 w-2.5" /></button>
        </span>
      ))}
      <input value={input} onChange={(e) => onInputChange(e.target.value)} onKeyDown={handleKeyDown} onBlur={onAdd}
        placeholder={tags.length === 0 ? "Type amenity, press comma or Enter..." : "Add more..."}
        className="flex-1 min-w-[120px] text-sm font-bold outline-none bg-transparent placeholder:text-slate-300 placeholder:font-normal" />
    </div>
  );
};

// ─── Facility Builder ─────────────────────────────────────────────────────────

interface FacilityBuilderProps {
  items: FacilityItem[]; onChange: (items: FacilityItem[]) => void;
  showErrors: boolean; onValidationFail: (msg: string) => void; showBookingLink: boolean;
}

const FacilityBuilder = ({ items, onChange, showErrors, onValidationFail, showBookingLink }: FacilityBuilderProps) => {
  const { usdHint } = useCurrency();
  const update = (id: string, patch: Partial<FacilityItem>) => onChange(items.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const addItem = () => onChange([...items, emptyFacility()]);
  const removeItem = (id: string) => onChange(items.filter((f) => f.id !== id));
  const addAmenityTag = (item: FacilityItem) => { const val = item.amenityInput.replace(/,/g, "").trim(); if (!val) return; update(item.id, { amenities: [...item.amenities, val], amenityInput: "" }); };
  const removeAmenityTag = (item: FacilityItem, idx: number) => update(item.id, { amenities: item.amenities.filter((_, i) => i !== idx) });

  const handleImages = async (id: string, fileList: FileList | null, existing: File[]) => {
    if (!fileList || fileList.length === 0) return;
    const slots = 5 - existing.length; if (slots <= 0) return;
    const incoming = Array.from(fileList).slice(0, slots);
    let merged: File[];
    try { const compressed = await compressImages(incoming); merged = [...existing, ...compressed.map((c) => c.file)].slice(0, 5); }
    catch { merged = [...existing, ...incoming].slice(0, 5); }
    update(id, { images: merged, previewUrls: merged.map(safeObjectUrl) });
  };

  const removeImage = (id: string, idx: number, existing: File[]) => {
    const updated = existing.filter((_, i) => i !== idx);
    update(id, { images: updated, previewUrls: updated.map(safeObjectUrl) });
  };

  const saveItem = (f: FacilityItem) => {
    if (!f.name.trim()) { onValidationFail("Please enter a facility name."); return; }
    if (f.amenities.length === 0) { onValidationFail("Please add at least one amenity."); return; }
    if (!f.capacity.trim()) { onValidationFail("Please enter the facility capacity."); return; }
    if (!f.price.trim()) { onValidationFail("Please enter a price."); return; }
    if (showBookingLink && !f.bookingLink.trim()) { onValidationFail("Please enter a booking link."); return; }
    if (f.images.length < 2) { onValidationFail("Please add at least 2 photos."); return; }
    update(f.id, { saved: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Facilities (with photos)</Label>
        {showBookingLink && <span className="text-[9px] font-bold text-orange-500 uppercase tracking-widest">Booking link required</span>}
      </div>
      {items.map((item) => (
        <div key={item.id} className={cn("rounded-2xl border-2 overflow-hidden transition-all", item.saved ? "border-[#FF7F50]/30 bg-[#FF7F50]/5" : "border-slate-200 bg-white")}>
          {item.saved ? (
            <div className="p-4 flex items-center gap-4">
              <div className="flex gap-2 shrink-0">
                {item.previewUrls.slice(0, 3).map((url, i) => url ? <img key={i} src={url} className="w-12 h-12 rounded-xl object-cover border border-slate-200" alt="" /> : <div key={i} className="w-12 h-12 rounded-xl bg-slate-200" />)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-slate-800 truncate">{item.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{item.amenities.join(", ")}</p>
                <div className="flex gap-3 mt-0.5">
                  {item.capacity && <p className="text-[11px] text-slate-400">Cap: {item.capacity}</p>}
                  {item.price && <p className="text-[11px] font-bold text-[#FF7F50]">KSh {item.price}</p>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => update(item.id, { saved: false })} className="text-[10px] font-black uppercase text-[#FF7F50] border border-[#FF7F50]/30 rounded-lg px-3 py-1.5">Edit</button>
                <button type="button" onClick={() => removeItem(item.id)} className="text-[10px] font-black uppercase text-red-500 border border-red-200 rounded-lg px-3 py-1.5">Remove</button>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Name *</Label>
                  <Input value={item.name} onChange={(e) => update(item.id, { name: e.target.value })} placeholder="e.g. Deluxe Room"
                    className={cn("rounded-xl h-10 font-bold text-sm", showErrors && !item.name.trim() && "border-red-500 bg-red-50")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Price (KSh) *</Label>
                  <Input type="number" value={item.price} onChange={(e) => update(item.id, { price: e.target.value })} placeholder="0"
                    className={cn("rounded-xl h-10 font-bold text-sm", showErrors && !item.price.trim() && "border-red-500 bg-red-50")} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Capacity *</Label>
                <Input type="number" min={1} value={item.capacity} onChange={(e) => update(item.id, { capacity: e.target.value.replace(/[^0-9]/g, "") })} placeholder="e.g. 2"
                  className={cn("rounded-xl h-10 font-bold text-sm", showErrors && !item.capacity.trim() && "border-red-500 bg-red-50")} />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Amenities * <span className="text-slate-300 normal-case font-normal">(comma separated)</span></Label>
                <AmenityTagInput tags={item.amenities} input={item.amenityInput} onInputChange={(v) => update(item.id, { amenityInput: v })}
                  onAdd={() => addAmenityTag(item)} onRemove={(i) => removeAmenityTag(item, i)} hasError={showErrors && item.amenities.length === 0} />
              </div>
              {showBookingLink && (
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Booking Link *</Label>
                  <Input value={item.bookingLink} onChange={(e) => update(item.id, { bookingLink: e.target.value })} placeholder="https://booking.com/room-url"
                    className={cn("rounded-xl h-10 font-bold text-sm", showErrors && showBookingLink && !item.bookingLink.trim() && "border-red-500 bg-red-50")} />
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Photos <span className="text-slate-300 normal-case font-normal">(min 2, max 5)</span></Label>
                <div className={cn("flex flex-wrap gap-2 p-3 rounded-xl border-2", showErrors && item.images.length < 2 ? "border-red-400 bg-red-50" : "border-dashed border-slate-200")}>
                  {item.previewUrls.map((url, i) => url ? (
                    <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                      <img src={url} className="w-full h-full object-cover" alt="" />
                      <button type="button" onClick={() => removeImage(item.id, i, item.images)} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 shadow"><X className="h-2.5 w-2.5" /></button>
                    </div>
                  ) : null)}
                  {item.images.length < 5 && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 shrink-0">
                      <Plus className="h-4 w-4 text-slate-400" /><span className="text-[8px] font-black uppercase text-slate-400 mt-0.5">Photo</span>
                      <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleImages(item.id, e.target.files, item.images)} />
                    </label>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" onClick={() => saveItem(item)} className="flex-1 h-10 rounded-xl font-black uppercase text-[10px] tracking-widest text-white"
                  style={{ background: `linear-gradient(135deg, ${COLORS.CORAL} 0%, #e06040 100%)` }}>Save Facility</Button>
                {items.length > 1 && <Button type="button" onClick={() => removeItem(item.id)} variant="ghost" className="h-10 px-4 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50"><X className="h-4 w-4" /></Button>}
              </div>
            </div>
          )}
        </div>
      ))}
      <Button type="button" onClick={addItem} variant="outline" className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-dashed border-2 border-slate-200 text-slate-400 hover:border-[#FF7F50] hover:text-[#FF7F50]">
        <Plus className="h-4 w-4 mr-2" /> Add Facility
      </Button>
    </div>
  );
};

// ─── Activity Builder ─────────────────────────────────────────────────────────

interface ActivityBuilderProps {
  items: ActivityItem[]; onChange: (items: ActivityItem[]) => void;
  showErrors: boolean; onValidationFail: (msg: string) => void;
}

const ActivityBuilder = ({ items, onChange, showErrors, onValidationFail }: ActivityBuilderProps) => {
  const { usdHint } = useCurrency();
  const update = (id: string, patch: Partial<ActivityItem>) => onChange(items.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const addItem = () => onChange([...items, emptyActivity()]);
  const removeItem = (id: string) => onChange(items.filter((a) => a.id !== id));

  const handleImages = async (id: string, fileList: FileList | null, existing: File[]) => {
    if (!fileList || fileList.length === 0) return;
    const slots = 5 - existing.length; if (slots <= 0) return;
    const incoming = Array.from(fileList).slice(0, slots);
    let merged: File[];
    try { const compressed = await compressImages(incoming); merged = [...existing, ...compressed.map((c) => c.file)].slice(0, 5); }
    catch { merged = [...existing, ...incoming].slice(0, 5); }
    update(id, { images: merged, previewUrls: merged.map(safeObjectUrl) });
  };

  const removeImage = (id: string, idx: number, existing: File[]) => {
    const updated = existing.filter((_, i) => i !== idx);
    update(id, { images: updated, previewUrls: updated.map(safeObjectUrl) });
  };

  const saveItem = (a: ActivityItem) => {
    if (!a.name.trim()) { onValidationFail("Please enter an activity name."); return; }
    update(a.id, { saved: true });
  };

  return (
    <div className="space-y-4">
      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activities (with photos)</Label>
      {items.map((item) => (
        <div key={item.id} className={cn("rounded-2xl border-2 overflow-hidden transition-all", item.saved ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 bg-white")}>
          {item.saved ? (
            <div className="p-4 flex items-center gap-4">
              <div className="flex gap-2 shrink-0">
                {item.previewUrls.slice(0, 3).map((url, i) => url ? <img key={i} src={url} className="w-12 h-12 rounded-xl object-cover border border-slate-200" alt="" /> : <div key={i} className="w-12 h-12 rounded-xl bg-slate-200" />)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-slate-800 truncate">{item.name}</p>
                {item.price && <p className="text-[11px] font-bold text-indigo-500">KSh {item.price}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => update(item.id, { saved: false })} className="text-[10px] font-black uppercase text-indigo-500 border border-indigo-200 rounded-lg px-3 py-1.5">Edit</button>
                <button type="button" onClick={() => removeItem(item.id)} className="text-[10px] font-black uppercase text-red-500 border border-red-200 rounded-lg px-3 py-1.5">Remove</button>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Activity Name *</Label>
                  <Input value={item.name} onChange={(e) => update(item.id, { name: e.target.value })} placeholder="e.g. Spa" className={cn("rounded-xl h-10 font-bold text-sm", showErrors && !item.name.trim() && "border-red-500 bg-red-50")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Price (KSh)</Label>
                  <Input type="number" value={item.price} onChange={(e) => update(item.id, { price: e.target.value })} placeholder="0" className="rounded-xl h-10 font-bold text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Photos <span className="text-slate-300 normal-case font-normal">(max 5)</span></Label>
                <div className="flex flex-wrap gap-2 p-3 rounded-xl border-2 border-dashed border-slate-200">
                  {item.previewUrls.map((url, i) => url ? (
                    <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                      <img src={url} className="w-full h-full object-cover" alt="" />
                      <button type="button" onClick={() => removeImage(item.id, i, item.images)} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 shadow"><X className="h-2.5 w-2.5" /></button>
                    </div>
                  ) : null)}
                  {item.images.length < 5 && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 shrink-0">
                      <Plus className="h-4 w-4 text-slate-400" /><span className="text-[8px] font-black uppercase text-slate-400 mt-0.5">Photo</span>
                      <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleImages(item.id, e.target.files, item.images)} />
                    </label>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" onClick={() => saveItem(item)} className="flex-1 h-10 rounded-xl font-black uppercase text-[10px] tracking-widest text-white" style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}>Save Activity</Button>
                {items.length > 1 && <Button type="button" onClick={() => removeItem(item.id)} variant="ghost" className="h-10 px-4 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50"><X className="h-4 w-4" /></Button>}
              </div>
            </div>
          )}
        </div>
      ))}
      <Button type="button" onClick={addItem} variant="outline" className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-dashed border-2 border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-400">
        <Plus className="h-4 w-4 mr-2" /> Add Activity
      </Button>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const STEP_NAMES = ["Registration", "Location & Contact", "Hours", "Facilities", "Photos & Description", "Review"];

const CreateHotel = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack("/become-host");
  const { toast } = useToast();
  const { user } = useAuth();
  useBanCheck();
  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    registrationName: "", registrationNumber: "", place: "", country: "",
    description: "", email: "", phoneNumber: "", establishmentType: "hotel",
    latitude: null as number | null, longitude: null as number | null,
    openingHours: "00:00", closingHours: "23:59", generalBookingLink: "",
    locationLink: "",
  });
  const [locationMode, setLocationMode] = useState<'link' | 'gps' | null>(null);

  const isAccommodationOnly = formData.establishmentType === "accommodation_only";

  const [workingDays, setWorkingDays] = useState({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: true });
  const [generalFacilities, setGeneralFacilities] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<FacilityItem[]>(() => [emptyFacility()]);
  const [activities, setActivities] = useState<ActivityItem[]>(() => [emptyActivity()]);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [traLicense, setTraLicense] = useState<File | null>(null);
  const [traLicensePreview, setTraLicensePreview] = useState<string | null>(null);

  const onValidationFail = useCallback(
    (msg: string) => toast({ title: "Required", description: msg, variant: "destructive" }),
    [toast]
  );

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("country").eq("id", user.id).single(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]).then(([profileRes, rolesRes]) => {
      if (profileRes.data?.country) setFormData((p) => ({ ...p, country: profileRes.data.country }));
      setIsAdmin(!!rolesRes.data?.some((r) => r.role === "admin"));
    });
  }, [user]);

  const errorClass = (field: string) => showErrors ? "border-red-500 bg-red-50" : "border-slate-100 bg-slate-50";

  // Step validation
  const isStep1Complete = !!formData.registrationName.trim() && (isAccommodationOnly || !!formData.registrationNumber.trim()) && !!formData.country;
  const isStep2Complete = !!formData.place.trim() && (isAccommodationOnly || (!!formData.latitude && !!formData.email.trim() && !!formData.phoneNumber.trim()));
  const isStep3Complete = true;
  const isStep4Complete = facilities.every(f => f.saved);
  const isStep5Complete = galleryImages.length >= 5 && !!formData.description.trim() && !!traLicense && (!isAccommodationOnly || !!formData.generalBookingLink.trim());

  const steps = [
    { name: STEP_NAMES[0], isComplete: isStep1Complete },
    { name: STEP_NAMES[1], isComplete: isStep2Complete },
    { name: STEP_NAMES[2], isComplete: isStep3Complete },
    { name: STEP_NAMES[3], isComplete: isStep4Complete },
    { name: STEP_NAMES[4], isComplete: isStep5Complete },
    { name: STEP_NAMES[5], isComplete: isStep1Complete && isStep2Complete && isStep4Complete && isStep5Complete },
  ];

  const validateCurrentStep = (): boolean => {
    if (currentStep === 1 && !isStep1Complete) {
      setShowErrors(true);
      toast({ title: "Complete this step", description: "Fill all required fields", variant: "destructive" });
      return false;
    }
    if (currentStep === 2 && !isStep2Complete) {
      setShowErrors(true);
      toast({ title: "Complete this step", description: "Fill location and contact details", variant: "destructive" });
      return false;
    }
    if (currentStep === 4 && facilities.some(f => !f.saved)) {
      toast({ title: "Unsaved Facility", description: "Save all facilities before continuing", variant: "destructive" });
      return false;
    }
    if (currentStep === 5 && !isStep5Complete) {
      setShowErrors(true);
      toast({ title: "Complete this step", description: "Upload photos and add description", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setShowErrors(false);
    setCurrentStep(prev => Math.min(prev + 1, 6));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    setShowErrors(false);
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const merged = [...galleryImages, ...files];
    setGalleryImages(merged);
    setGalleryPreviews((prev) => [...prev, ...files.map(safeObjectUrl)]);
  };

  const removeImage = (index: number) => {
    const updated = galleryImages.filter((_, i) => i !== index);
    setGalleryImages(updated);
    setGalleryPreviews(updated.map(safeObjectUrl));
  };

  const uploadFile = async (file: File, prefix: string): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user!.id}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("listing-images").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!user) return navigate("/auth");
    if (!isStep1Complete || !isStep2Complete || !isStep5Complete) {
      toast({ title: "Missing Details", description: "Please complete all steps.", variant: "destructive" });
      return;
    }
    if (!traLicense) {
      toast({ title: "TRA License Required", description: "Please upload your TRA license image.", variant: "destructive" });
      return;
    }
    if (facilities.some((f) => !f.saved)) {
      toast({ title: "Unsaved Facility", description: "Save all facilities first.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const friendlySlug = generateFriendlySlug(formData.registrationName);
      const compressedImages = await compressImages(galleryImages);
      const galleryUrls = await Promise.all(compressedImages.map((c) => uploadFile(c.file, "gallery")));

      const facilitiesForDB = await Promise.all(
        facilities.map(async (fac) => ({
          name: fac.name, amenities: fac.amenities,
          capacity: parseInt(fac.capacity, 10) || 0, price: parseFloat(fac.price) || 0,
          booking_link: fac.bookingLink || null,
          images: await Promise.all(fac.images.map((f) => uploadFile(f, "fac"))),
        }))
      );

      const savedActivities = activities.filter((a) => a.name.trim());
      const activitiesForDB = await Promise.all(
        savedActivities.map(async (act) => ({
          name: act.name, price: act.price ? parseFloat(act.price) || 0 : 0,
          images: await Promise.all(act.images.map((f) => uploadFile(f, "act"))),
        }))
      );

      const selectedDays = Object.entries(workingDays).filter(([, v]) => v).map(([k]) => k);

      // Upload TRA license (required)
      const traLicenseUrl = traLicense ? await uploadFile(traLicense, "tra-license") : null;

      const { error } = await supabase.from("hotels").insert([{
        id: friendlySlug, slug: friendlySlug, created_by: user.id,
        name: formData.registrationName, location: formData.place, place: formData.place,
        country: formData.country, description: formData.description,
        email: formData.email, phone_numbers: formData.phoneNumber ? [formData.phoneNumber] : [],
        establishment_type: formData.establishmentType,
        latitude: formData.latitude, longitude: formData.longitude,
        opening_hours: formData.openingHours, closing_hours: formData.closingHours,
        days_opened: selectedDays, amenities: generalFacilities,
        facilities: facilitiesForDB, activities: activitiesForDB,
        image_url: galleryUrls[0] ?? "", gallery_images: galleryUrls,
        registration_number: formData.registrationNumber || null,
        approval_status: isAccommodationOnly ? "approved" : "pending",
        general_booking_link: isAccommodationOnly ? formData.generalBookingLink : null,
        tra_license_url: traLicenseUrl,
      }]);

      if (error) throw error;
      toast({
        title: "Success!",
        description: isAccommodationOnly ? `Listing (Ref: ${friendlySlug}) is now live.` : `Listing (Ref: ${friendlySlug}) submitted for review.`,
        duration: 5000,
      });
      navigate("/become-host");
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* Hero */}
      <div className="relative w-full h-[25vh] md:h-[30vh] bg-slate-900 overflow-hidden">
        <img src="/images/category-hotels.webp" className="w-full h-full object-cover opacity-50" alt="Hotel Header" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F8F9FA] via-transparent to-transparent" />
        <div className="absolute top-4 left-4">
          <Button onClick={goBack} className="rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0"><ArrowLeft className="h-5 w-5" /></Button>
        </div>
        <div className="absolute bottom-8 left-0 w-full px-8 container mx-auto">
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
            List Your <span style={{ color: COLORS.TEAL }}>Property</span>
          </h1>
          <p className="text-white/70 text-xs font-bold mt-1">Step {currentStep} of {STEP_NAMES.length}</p>
        </div>
      </div>

      <main className="container px-4 mx-auto -mt-6 relative z-50 space-y-6">
        {/* Step Indicator */}
        <CreateFormStepper steps={steps} currentStep={currentStep} />

        {/* ═══ STEP 1: Registration ═══ */}
        {currentStep === 1 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <CheckCircle2 className="h-5 w-5" /> Registration Details
            </h2>
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Name *</Label>
                <Input className={cn("rounded-xl h-12 font-bold transition-all", showErrors && !formData.registrationName.trim() && "border-red-500 bg-red-50")}
                  value={formData.registrationName} onChange={(e) => setFormData({ ...formData, registrationName: e.target.value })} placeholder="As per official documents" />
              </div>
              {!isAccommodationOnly && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Number *</Label>
                  <Input className={cn("rounded-xl h-12 font-bold transition-all", showErrors && !formData.registrationNumber.trim() && "border-red-500 bg-red-50")}
                    value={formData.registrationNumber} onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })} placeholder="e.g. BN-12345" />
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Country *</Label>
                <div className={cn(showErrors && !formData.country && "rounded-xl ring-2 ring-red-500")}>
                  <CountrySelector value={formData.country} onChange={(v) => setFormData({ ...formData, country: v })} />
                </div>
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Property Type *</Label>
                  <Select value={formData.establishmentType} onValueChange={(v) => setFormData({ ...formData, establishmentType: v })}>
                    <SelectTrigger className="rounded-xl h-12 font-bold"><SelectValue placeholder="Select property type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hotel">Hotel (Full Service)</SelectItem>
                      <SelectItem value="accommodation_only">Accommodation Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ═══ STEP 2: Location & Contact ═══ */}
        {currentStep === 2 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${COLORS.TEAL}15` }}>
                <MapPin className="h-5 w-5" style={{ color: COLORS.TEAL }} />
              </div>
              <h2 className="text-lg font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Location & Contact</h2>
            </div>
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Country *</Label>
                  <div className={cn(showErrors && !formData.country && "rounded-xl ring-2 ring-red-500")}>
                    <CountrySelector value={formData.country} onChange={(v) => setFormData({ ...formData, country: v })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">County *</Label>
                  <div className={cn("rounded-xl", showErrors && !formData.place.trim() && "border-2 border-red-500 overflow-hidden")}>
                    <CountySelector value={formData.place} onChange={(v) => setFormData({ ...formData, place: v })} />
                  </div>
                </div>
              </div>
              {!isAccommodationOnly && (
                <>
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-400 font-bold">Choose one: paste a map link OR capture GPS</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setLocationMode('link')}
                        className={`p-3 rounded-2xl text-center font-black text-xs uppercase tracking-tight transition-all ${locationMode === 'link' ? 'bg-[#008080] text-white shadow-lg' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        Paste Link
                      </button>
                      <button type="button" onClick={() => setLocationMode('gps')}
                        className={`p-3 rounded-2xl text-center font-black text-xs uppercase tracking-tight transition-all ${locationMode === 'gps' ? 'bg-[#008080] text-white shadow-lg' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        Use GPS
                      </button>
                    </div>
                    {locationMode === 'link' && (
                      <Input value={formData.locationLink} onChange={(e) => setFormData({...formData, locationLink: e.target.value})}
                        placeholder="https://maps.google.com/..." className="rounded-xl h-12 font-bold" />
                    )}
                    {locationMode === 'gps' && (
                      <Button type="button" onClick={() => {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => setFormData({ ...formData, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                          () => toast({ title: "Location Error", description: "Unable to get location.", variant: "destructive" })
                        );
                      }} className="w-full rounded-2xl px-6 h-14 font-black uppercase text-[11px] tracking-widest text-white shadow-lg active:scale-95 transition-all"
                        style={{ background: formData.latitude ? COLORS.TEAL : COLORS.CORAL }}>
                        <Navigation className="h-5 w-5 mr-3" />
                        {formData.latitude ? "✓ Location Captured" : "Tap to Capture GPS Location"}
                      </Button>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2 bg-slate-50/80 rounded-2xl p-4">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Email *</Label>
                      <Input className={cn("rounded-xl h-12 font-bold border-none bg-white shadow-sm", showErrors && !formData.email.trim() && "border-red-500 bg-red-50")}
                        value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                    <div className="space-y-2 bg-slate-50/80 rounded-2xl p-4">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number *</Label>
                      <div className={cn(showErrors && !formData.phoneNumber.trim() && "rounded-xl ring-2 ring-red-500")}>
                        <PhoneInput value={formData.phoneNumber} onChange={(v) => setFormData({ ...formData, phoneNumber: v })} country={formData.country} />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        )}

        {/* ═══ STEP 3: Operating Hours ═══ */}
        {currentStep === 3 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <Clock className="h-5 w-5" /> Operating Hours
            </h2>
            <OperatingHoursSection
              openingHours={formData.openingHours} closingHours={formData.closingHours}
              workingDays={workingDays}
              onOpeningChange={(v) => setFormData({ ...formData, openingHours: v })}
              onClosingChange={(v) => setFormData({ ...formData, closingHours: v })}
              onDaysChange={setWorkingDays} accentColor={COLORS.TEAL}
            />
          </Card>
        )}

        {/* ═══ STEP 4: Facilities & Activities ═══ */}
        {currentStep === 4 && (
          <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
              <DollarSign className="h-5 w-5" /> Facilities & Activities
            </h2>
            <div className="space-y-8">
              <GeneralFacilitiesSelector selected={generalFacilities} onChange={setGeneralFacilities} accentColor={COLORS.TEAL} />
              <FacilityBuilder items={facilities} onChange={setFacilities} showErrors={showErrors} onValidationFail={onValidationFail} showBookingLink={isAccommodationOnly} />
              {!isAccommodationOnly && (
                <ActivityBuilder items={activities} onChange={setActivities} showErrors={showErrors} onValidationFail={onValidationFail} />
              )}
            </div>
          </Card>
        )}

        {/* ═══ STEP 5: Photos & Description ═══ */}
        {currentStep === 5 && (
          <>
            <Card className={cn("bg-white rounded-[28px] p-8 shadow-sm border-none", showErrors && galleryImages.length < 5 && "ring-2 ring-red-500")}>
              <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
                <Camera className="h-5 w-5" /> Property Photos * <span className="text-sm font-bold text-muted-foreground">(min 5)</span>
                {galleryImages.length < 5 && <span className="text-sm text-destructive">— need {5 - galleryImages.length} more</span>}
              </h2>
              <div className="space-y-6">
                <div className={cn("p-6 rounded-[24px] border-2 border-dashed transition-colors",
                  showErrors && galleryImages.length < 5 ? "border-red-500 bg-red-50" : "border-slate-200 bg-slate-50/50")}>
                  <label className="w-full">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                    <div className="w-full rounded-2xl px-6 py-4 font-black uppercase text-[11px] tracking-widest text-white shadow-lg cursor-pointer text-center"
                      style={{ background: COLORS.CORAL }}>
                      <Camera className="h-5 w-5 inline mr-2" /> Choose Photos
                    </div>
                  </label>
                </div>
                {galleryImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {galleryPreviews.map((url, index) => url ? (
                      <div key={index} className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-100">
                        <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 p-2 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null)}
                  </div>
                )}
              </div>
            </Card>

            <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
              <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
                <CheckCircle2 className="h-5 w-5" /> Property Description *
              </h2>
              <Textarea
                className={cn("rounded-[20px] min-h-[200px] font-medium resize-none", showErrors && !formData.description.trim() && "border-red-500 bg-red-50")}
                placeholder="Describe your property in 20 words or less..."
                value={formData.description}
                onChange={(e) => {
                  const words = e.target.value.trim().split(/\s+/);
                  if (e.target.value.trim() === "" || words.length <= 20) setFormData({ ...formData, description: e.target.value });
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.description.trim() ? formData.description.trim().split(/\s+/).length : 0}/20 words
              </p>
              {isAccommodationOnly && (
                <div className="space-y-2 pt-4 border-t border-slate-100 mt-6">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">General Booking Link *</Label>
                  <Input className={cn("rounded-xl h-12 font-bold", showErrors && !formData.generalBookingLink.trim() && "border-red-500 bg-red-50")}
                    value={formData.generalBookingLink}
                    onChange={(e) => setFormData({ ...formData, generalBookingLink: e.target.value })}
                    placeholder="https://booking.com/your-property" />
                </div>
              )}
            </Card>

            {/* TRA License Upload (required) */}
            <Card className={cn("bg-white rounded-[28px] p-8 shadow-sm border-none space-y-4", showErrors && !traLicense && "ring-2 ring-red-500")}>
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ color: COLORS.TEAL }}>
                <ImageIcon className="h-5 w-5" /> TRA License *
              </h2>
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
                <label className={cn("flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-dashed cursor-pointer transition-all",
                  showErrors && !traLicense ? "border-red-400 bg-red-50" : "border-slate-200 hover:border-[#008080] hover:bg-[#008080]/5")}>
                  <ImageIcon className={cn("h-8 w-8 mb-2", showErrors && !traLicense ? "text-red-400" : "text-slate-400")} />
                  <span className={cn("text-xs font-bold uppercase", showErrors && !traLicense ? "text-red-500" : "text-slate-400")}>Upload TRA License</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setTraLicense(file);
                      setTraLicensePreview(URL.createObjectURL(file));
                    }
                  }} />
                </label>
              )}
            </Card>
          </>
        )}

        {/* ═══ STEP 6: Review ═══ */}
        {currentStep === 6 && (
          <ReviewStep
            type="hotel"
            accentColor={COLORS.TEAL}
            data={{
              name: formData.registrationName, registrationName: formData.registrationName,
              registrationNumber: formData.registrationNumber,
              place: formData.place, country: formData.country, description: formData.description,
              email: formData.email, phoneNumber: formData.phoneNumber,
              openingHours: formData.openingHours, closingHours: formData.closingHours,
              workingDays: Object.entries(workingDays).filter(([, v]) => v).map(([k]) => k),
              establishmentType: formData.establishmentType,
              generalBookingLink: formData.generalBookingLink, generalFacilities,
              facilities: facilities.filter(f => f.saved).map(f => ({
                name: f.name, price: parseFloat(f.price) || 0,
                capacity: parseInt(f.capacity) || null, amenities: f.amenities,
                bookingLink: f.bookingLink, images: f.previewUrls,
              })),
              activities: activities.filter(a => a.saved && a.name.trim()).map(a => ({
                name: a.name, price: parseFloat(a.price) || 0, images: a.previewUrls,
              })),
              latitude: formData.latitude, longitude: formData.longitude,
              galleryPreviewUrls: galleryPreviews,
              traLicensePreviewUrl: traLicensePreview || undefined,
            }}
            creatorEmail={user?.email}
          />
        )}

        {/* ═══ Navigation Buttons ═══ */}
        <div className="flex gap-3 pt-2 mb-8">
          {currentStep > 1 && (
            <Button type="button" variant="outline" onClick={handlePrev}
              className="flex-1 py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest">
              <ChevronLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          )}
          {currentStep < 6 ? (
            <Button type="button" onClick={handleNext}
              className="flex-[2] py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest text-white shadow-xl active:scale-95 transition-all"
              style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #006666 100%)` }}>
              Continue <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={loading}
              className="flex-[2] py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest text-white shadow-xl active:scale-95 transition-all"
              style={{ background: `linear-gradient(135deg, ${COLORS.CORAL} 0%, #e06040 100%)` }}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> {isAccommodationOnly ? "Publish Listing" : "Submit for Review"}</>}
            </Button>
          )}
        </div>

      </main>
      <MobileBottomBar />
    </div>
  );
};

export default CreateHotel;