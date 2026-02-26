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
  MapPin, Navigation, X, CheckCircle2, Plus, Camera,
  ArrowLeft, Loader2, Clock, DollarSign, Image as ImageIcon,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { compressImages } from "@/lib/imageCompression";
import { OperatingHoursSection } from "@/components/creation/OperatingHoursSection";
import { GeneralFacilitiesSelector } from "@/components/creation/GeneralFacilitiesSelector";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  SOFT_GRAY: "#F8F9FA",
};

let _idCounter = 0;
const makeId = () => `item-${Date.now()}-${++_idCounter}`;

/**
 * Generates a proper UUID v4 for use as the database `id` (type: uuid).
 */
const generateUUID = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Polyfill fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Generates a human-friendly slug for display/URL purposes.
 * Stored in a `slug` text column — NOT the `id` column.
 */
const generateFriendlySlug = (name: string): string => {
  const cleanName = name
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 30);
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
  id: string;
  name: string;
  amenities: string[];
  amenityInput: string;
  price: string;
  capacity: string;
  bookingLink: string;
  images: File[];
  previewUrls: string[];
  saved: boolean;
}

interface ActivityItem {
  id: string;
  name: string;
  price: string;
  images: File[];
  previewUrls: string[];
  saved: boolean;
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
  tags: string[];
  input: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  hasError: boolean;
}

const AmenityTagInput = ({ tags, input, onInputChange, onAdd, onRemove, hasError }: AmenityTagInputProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "," || e.key === "Enter") { e.preventDefault(); onAdd(); }
    if (e.key === "Backspace" && !input && tags.length > 0) onRemove(tags.length - 1);
  };
  return (
    <div className={cn(
      "min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-xl border-2 bg-white transition-colors",
      hasError ? "border-red-500 bg-red-50" : "border-slate-200 focus-within:border-[#008080]"
    )}>
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 bg-[#008080]/10 text-[#008080] text-[11px] font-black rounded-lg px-2 py-0.5">
          {tag}
          <button type="button" onClick={() => onRemove(i)} className="hover:text-red-500 transition-colors">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onAdd}
        placeholder={tags.length === 0 ? "Type amenity, press comma or Enter..." : "Add more..."}
        className="flex-1 min-w-[120px] text-sm font-bold outline-none bg-transparent placeholder:text-slate-300 placeholder:font-normal"
      />
    </div>
  );
};

// ─── Facility Builder ─────────────────────────────────────────────────────────

interface FacilityBuilderProps {
  items: FacilityItem[];
  onChange: (items: FacilityItem[]) => void;
  showErrors: boolean;
  onValidationFail: (msg: string) => void;
  showBookingLink: boolean;
}

const FacilityBuilder = ({
  items, onChange, showErrors, onValidationFail, showBookingLink,
}: FacilityBuilderProps) => {
  const update = (id: string, patch: Partial<FacilityItem>) =>
    onChange(items.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const addItem = () => onChange([...items, emptyFacility()]);
  const removeItem = (id: string) => onChange(items.filter((f) => f.id !== id));

  const addAmenityTag = (item: FacilityItem) => {
    const val = item.amenityInput.replace(/,/g, "").trim();
    if (!val) return;
    update(item.id, { amenities: [...item.amenities, val], amenityInput: "" });
  };

  const removeAmenityTag = (item: FacilityItem, idx: number) =>
    update(item.id, { amenities: item.amenities.filter((_, i) => i !== idx) });

  const handleImages = async (id: string, fileList: FileList | null, existing: File[]) => {
    if (!fileList || fileList.length === 0) return;
    const slots = 5 - existing.length;
    if (slots <= 0) return;
    const incoming = Array.from(fileList).slice(0, slots);
    let merged: File[];
    try {
      const compressed = await compressImages(incoming);
      merged = [...existing, ...compressed.map((c) => c.file)].slice(0, 5);
    } catch {
      merged = [...existing, ...incoming].slice(0, 5);
    }
    update(id, { images: merged, previewUrls: merged.map(safeObjectUrl) });
  };

  const removeImage = (id: string, idx: number, existing: File[]) => {
    const updated = existing.filter((_, i) => i !== idx);
    update(id, { images: updated, previewUrls: updated.map(safeObjectUrl) });
  };

  const saveItem = (f: FacilityItem) => {
    if (!f.name.trim())            { onValidationFail("Please enter a facility name."); return; }
    if (f.amenities.length === 0)  { onValidationFail("Please add at least one amenity."); return; }
    if (!f.capacity.trim())        { onValidationFail("Please enter the facility capacity."); return; }
    if (!f.price.trim())           { onValidationFail("Please enter a price for this facility."); return; }
    if (showBookingLink && !f.bookingLink.trim()) { onValidationFail("Please enter a booking link for this facility."); return; }
    if (f.images.length < 2)       { onValidationFail("Please add at least 2 photos for this facility."); return; }
    update(f.id, { saved: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Facilities (with photos)
        </Label>
        {showBookingLink && (
          <span className="text-[9px] font-bold text-orange-500 uppercase tracking-widest">
            Booking link required per facility
          </span>
        )}
      </div>

      {items.map((item) => (
        <div key={item.id} className={cn(
          "rounded-2xl border-2 overflow-hidden transition-all",
          item.saved ? "border-[#FF7F50]/30 bg-[#FF7F50]/5" : "border-slate-200 bg-white"
        )}>
          {item.saved ? (
            <div className="p-4 flex items-center gap-4">
              <div className="flex gap-2 shrink-0">
                {item.previewUrls.slice(0, 3).map((url, i) =>
                  url ? <img key={i} src={url} className="w-12 h-12 rounded-xl object-cover border border-slate-200" alt="" />
                      : <div key={i} className="w-12 h-12 rounded-xl bg-slate-200" />
                )}
                {item.previewUrls.length > 3 && (
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-500">
                    +{item.previewUrls.length - 3}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-slate-800 truncate">{item.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{item.amenities.join(", ")}</p>
                <div className="flex gap-3 mt-0.5">
                  {item.capacity && <p className="text-[11px] text-slate-400">Capacity: {item.capacity}</p>}
                  {item.price && <p className="text-[11px] font-bold text-[#FF7F50]">KSh {item.price}</p>}
                </div>
                {showBookingLink && item.bookingLink && (
                  <p className="text-[10px] text-[#008080] truncate mt-0.5">{item.bookingLink}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => update(item.id, { saved: false })}
                  className="text-[10px] font-black uppercase tracking-widest text-[#FF7F50] border border-[#FF7F50]/30 rounded-lg px-3 py-1.5 hover:bg-[#FF7F50]/10 transition-colors">
                  Edit
                </button>
                <button type="button" onClick={() => removeItem(item.id)}
                  className="text-[10px] font-black uppercase tracking-widest text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Name *</Label>
                  <Input value={item.name} onChange={(e) => update(item.id, { name: e.target.value })}
                    placeholder="e.g. Deluxe Room"
                    className={cn("rounded-xl h-10 font-bold text-sm", showErrors && !item.name.trim() && "border-red-500 bg-red-50")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Price (KSh) *</Label>
                  <Input type="number" value={item.price} onChange={(e) => update(item.id, { price: e.target.value })}
                    placeholder="0"
                    className={cn("rounded-xl h-10 font-bold text-sm", showErrors && !item.price.trim() && "border-red-500 bg-red-50")} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Capacity * <span className="text-slate-300 normal-case font-normal">(number of people)</span>
                </Label>
                <Input
                  type="number" min={1}
                  value={item.capacity}
                  onChange={(e) => update(item.id, { capacity: e.target.value.replace(/[^0-9]/g, "") })}
                  placeholder="e.g. 2"
                  className={cn("rounded-xl h-10 font-bold text-sm", showErrors && !item.capacity.trim() && "border-red-500 bg-red-50")} />
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Amenities * <span className="text-slate-300 normal-case font-normal">(separate with commas)</span>
                  {showErrors && item.amenities.length === 0 && (
                    <span className="text-red-500 ml-2">— at least one required</span>
                  )}
                </Label>
                <AmenityTagInput
                  tags={item.amenities}
                  input={item.amenityInput}
                  onInputChange={(v) => update(item.id, { amenityInput: v })}
                  onAdd={() => addAmenityTag(item)}
                  onRemove={(i) => removeAmenityTag(item, i)}
                  hasError={showErrors && item.amenities.length === 0}
                />
              </div>

              {showBookingLink && (
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Booking Link *
                  </Label>
                  <Input
                    value={item.bookingLink}
                    onChange={(e) => update(item.id, { bookingLink: e.target.value })}
                    placeholder="https://booking.com/room-url"
                    className={cn("rounded-xl h-10 font-bold text-sm", showErrors && showBookingLink && !item.bookingLink.trim() && "border-red-500 bg-red-50")}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Photos <span className="text-slate-300 normal-case font-normal">(min 2, max 5)</span>
                  {showErrors && item.images.length < 2 && (
                    <span className="text-red-500 ml-2">— at least 2 required</span>
                  )}
                </Label>
                <div className={cn(
                  "flex flex-wrap gap-2 p-3 rounded-xl border-2",
                  showErrors && item.images.length < 2 ? "border-red-400 bg-red-50" : "border-dashed border-slate-200"
                )}>
                  {item.previewUrls.map((url, i) =>
                    url ? (
                      <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                        <img src={url} className="w-full h-full object-cover" alt="" />
                        <button type="button" onClick={() => removeImage(item.id, i, item.images)}
                          className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 shadow">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ) : null
                  )}
                  {item.images.length < 5 && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 shrink-0">
                      <Plus className="h-4 w-4 text-slate-400" />
                      <span className="text-[8px] font-black uppercase text-slate-400 mt-0.5">Photo</span>
                      <input type="file" multiple className="hidden" accept="image/*"
                        onChange={(e) => handleImages(item.id, e.target.files, item.images)} />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="button" onClick={() => saveItem(item)}
                  className="flex-1 h-10 rounded-xl font-black uppercase text-[10px] tracking-widest text-white"
                  style={{ background: `linear-gradient(135deg, ${COLORS.CORAL} 0%, #e06040 100%)` }}>
                  Save Facility
                </Button>
                {items.length > 1 && (
                  <Button type="button" onClick={() => removeItem(item.id)} variant="ghost"
                    className="h-10 px-4 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <Button type="button" onClick={addItem} variant="outline"
        className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-dashed border-2 border-slate-200 text-slate-400 hover:border-[#FF7F50] hover:text-[#FF7F50]">
        <Plus className="h-4 w-4 mr-2" /> Add Facility
      </Button>
    </div>
  );
};

// ─── Activity Builder ─────────────────────────────────────────────────────────

interface ActivityBuilderProps {
  items: ActivityItem[];
  onChange: (items: ActivityItem[]) => void;
  showErrors: boolean;
  onValidationFail: (msg: string) => void;
}

const ActivityBuilder = ({ items, onChange, showErrors, onValidationFail }: ActivityBuilderProps) => {
  const update = (id: string, patch: Partial<ActivityItem>) =>
    onChange(items.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const addItem = () => onChange([...items, emptyActivity()]);
  const removeItem = (id: string) => onChange(items.filter((a) => a.id !== id));

  const handleImages = async (id: string, fileList: FileList | null, existing: File[]) => {
    if (!fileList || fileList.length === 0) return;
    const slots = 5 - existing.length;
    if (slots <= 0) return;
    const incoming = Array.from(fileList).slice(0, slots);
    let merged: File[];
    try {
      const compressed = await compressImages(incoming);
      merged = [...existing, ...compressed.map((c) => c.file)].slice(0, 5);
    } catch {
      merged = [...existing, ...incoming].slice(0, 5);
    }
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
      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        Activities (with photos)
      </Label>

      {items.map((item) => (
        <div key={item.id} className={cn(
          "rounded-2xl border-2 overflow-hidden transition-all",
          item.saved ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 bg-white"
        )}>
          {item.saved ? (
            <div className="p-4 flex items-center gap-4">
              <div className="flex gap-2 shrink-0">
                {item.previewUrls.slice(0, 3).map((url, i) =>
                  url ? <img key={i} src={url} className="w-12 h-12 rounded-xl object-cover border border-slate-200" alt="" />
                      : <div key={i} className="w-12 h-12 rounded-xl bg-slate-200" />
                )}
                {item.previewUrls.length > 3 && (
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-500">
                    +{item.previewUrls.length - 3}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-slate-800 truncate">{item.name}</p>
                {item.price && <p className="text-[11px] font-bold text-indigo-500">KSh {item.price}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => update(item.id, { saved: false })}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-500 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors">
                  Edit
                </button>
                <button type="button" onClick={() => removeItem(item.id)}
                  className="text-[10px] font-black uppercase tracking-widest text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Activity Name *</Label>
                  <Input value={item.name} onChange={(e) => update(item.id, { name: e.target.value })}
                    placeholder="e.g. Swimming"
                    className={cn("rounded-xl h-10 font-bold text-sm", showErrors && !item.name.trim() && "border-red-500 bg-red-50")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Price (KSh)</Label>
                  <Input type="number" value={item.price} onChange={(e) => update(item.id, { price: e.target.value })}
                    placeholder="0" className="rounded-xl h-10 font-bold text-sm" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Photos <span className="text-slate-300 normal-case font-normal">(max 5)</span>
                </Label>
                <div className="flex flex-wrap gap-2 p-3 rounded-xl border-2 border-dashed border-slate-200">
                  {item.previewUrls.map((url, i) =>
                    url ? (
                      <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                        <img src={url} className="w-full h-full object-cover" alt="" />
                        <button type="button" onClick={() => removeImage(item.id, i, item.images)}
                          className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 shadow">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ) : null
                  )}
                  {item.images.length < 5 && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 shrink-0">
                      <Plus className="h-4 w-4 text-slate-400" />
                      <span className="text-[8px] font-black uppercase text-slate-400 mt-0.5">Photo</span>
                      <input type="file" multiple className="hidden" accept="image/*"
                        onChange={(e) => handleImages(item.id, e.target.files, item.images)} />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="button" onClick={() => saveItem(item)}
                  className="flex-1 h-10 rounded-xl font-black uppercase text-[10px] tracking-widest text-white"
                  style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}>
                  Save Activity
                </Button>
                {items.length > 1 && (
                  <Button type="button" onClick={() => removeItem(item.id)} variant="ghost"
                    className="h-10 px-4 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <Button type="button" onClick={addItem} variant="outline"
        className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-dashed border-2 border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-400">
        <Plus className="h-4 w-4 mr-2" /> Add Activity
      </Button>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const CreateHotel = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack("/become-host");
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [formData, setFormData] = useState({
    registrationName: "", registrationNumber: "", place: "", country: "",
    description: "", email: "", phoneNumber: "", establishmentType: "hotel",
    latitude: null as number | null, longitude: null as number | null,
    openingHours: "8:00 AM", closingHours: "5:00 PM", generalBookingLink: "",
  });

  const isAccommodationOnly = formData.establishmentType === "accommodation_only";

  const [workingDays, setWorkingDays] = useState({
    Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: true,
  });

  const [generalFacilities, setGeneralFacilities] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<FacilityItem[]>(() => [emptyFacility()]);
  const [activities, setActivities] = useState<ActivityItem[]>(() => [emptyActivity()]);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

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

  const errorClass = (field: string) =>
    errors[field] ? "border-red-500 bg-red-50 focus:ring-red-500" : "border-slate-100 bg-slate-50";

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const merged = [...galleryImages, ...files];
    setGalleryImages(merged);
    setGalleryPreviews((prev) => [...prev, ...files.map(safeObjectUrl)]);
    if (merged.length > 0) setErrors((p) => ({ ...p, galleryImages: false }));
  };

  const removeImage = (index: number) => {
    const updated = galleryImages.filter((_, i) => i !== index);
    setGalleryImages(updated);
    setGalleryPreviews(updated.map(safeObjectUrl));
  };

  const validateAll = (): boolean => {
    const e: Record<string, boolean> = {};
    if (!formData.registrationName.trim()) e.registrationName = true;
    if (!isAccommodationOnly && !formData.registrationNumber.trim()) e.registrationNumber = true;
    if (!formData.country) e.country = true;
    if (!formData.place.trim()) e.place = true;
    if (!isAccommodationOnly) {
      if (!formData.latitude) e.latitude = true;
      if (!formData.email.trim()) e.email = true;
      if (!formData.phoneNumber.trim()) e.phoneNumber = true;
    }
    if (!formData.openingHours) e.openingHours = true;
    if (!formData.closingHours) e.closingHours = true;
    if (!Object.values(workingDays).some((v) => v)) e.workingDays = true;
    if (galleryImages.length === 0) e.galleryImages = true;
    if (!formData.description.trim()) e.description = true;
    if (isAccommodationOnly && !formData.generalBookingLink.trim()) e.generalBookingLink = true;

    setErrors(e);
    setShowErrors(true);

    if (Object.keys(e).length > 0) {
      toast({ title: "Missing Details", description: "Please fill all required fields highlighted in red.", variant: "destructive" });
      setTimeout(() => {
        const firstError = document.querySelector("[data-error='true']");
        firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return false;
    }
    return true;
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
    if (!validateAll()) return;

    if (facilities.some((f) => !f.saved)) {
      toast({ title: "Unsaved Facility", description: "Please save all facilities before submitting.", variant: "destructive" });
      return;
    }
    if (facilities.some((f) => !f.name.trim() || f.amenities.length === 0 || !f.capacity.trim() || !f.price.trim() || f.images.length < 2 || (isAccommodationOnly && !f.bookingLink.trim()))) {
      toast({ title: "Facility Incomplete", description: "Each facility needs name, amenities, capacity, price, photos" + (isAccommodationOnly ? ", and booking link." : "."), variant: "destructive" });
      return;
    }
    if (activities.some((a) => a.name.trim() && !a.saved)) {
      toast({ title: "Unsaved Activity", description: "Please save all activities before submitting.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // ✅ FIX: Generate a proper UUID v4 for the `id` column (type: uuid).
      // The friendly slug is stored in a separate `slug` text column.
      const dbId = generateUUID();
      const friendlySlug = generateFriendlySlug(formData.registrationName);

      // Upload gallery
      const compressedImages = await compressImages(galleryImages);
      const galleryUrls = await Promise.all(compressedImages.map((c) => uploadFile(c.file, "gallery")));

      // Upload facilities
      const facilitiesForDB = await Promise.all(
        facilities.map(async (fac) => ({
          name: fac.name,
          amenities: fac.amenities,
          capacity: parseInt(fac.capacity, 10) || 0,
          price: parseFloat(fac.price) || 0,
          booking_link: fac.bookingLink || null,
          images: await Promise.all(fac.images.map((f) => uploadFile(f, "fac"))),
        }))
      );

      // Upload activities
      const savedActivities = activities.filter((a) => a.name.trim());
      const activitiesForDB = await Promise.all(
        savedActivities.map(async (act) => ({
          name: act.name,
          price: act.price ? parseFloat(act.price) || 0 : 0,
          images: await Promise.all(act.images.map((f) => uploadFile(f, "act"))),
        }))
      );

      const selectedDays = Object.entries(workingDays).filter(([, v]) => v).map(([k]) => k);

      const { error } = await supabase.from("hotels").insert([{
        id: dbId,                          // ✅ valid UUID v4
        slug: friendlySlug,                // ✅ human-readable reference (needs `slug text` column)
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
        amenities: generalFacilities,
        facilities: facilitiesForDB,
        activities: activitiesForDB,
        image_url: galleryUrls[0] ?? "",
        gallery_images: galleryUrls,
        registration_number: formData.registrationNumber || null,
        approval_status: isAccommodationOnly ? "approved" : "pending",
        general_booking_link: isAccommodationOnly ? formData.generalBookingLink : null,
      }]);

      if (error) throw error;

      toast({
        title: "Success!",
        description: isAccommodationOnly
          ? `Your accommodation listing (Ref: ${friendlySlug}) is now live.`
          : `Your hotel listing (Ref: ${friendlySlug}) has been submitted for review.`,
        duration: 5000,
      });
      navigate("/become-host");
    } catch (err: any) {
      console.error("Submission error:", err);
      toast({ title: "Submission Failed", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* Hero */}
      <div className="relative w-full h-[25vh] md:h-[35vh] bg-slate-900 overflow-hidden">
        <img src="/images/category-hotels.webp" className="w-full h-full object-cover opacity-50" alt="Hotel Header" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F8F9FA] via-transparent to-transparent" />
        <div className="absolute top-4 left-4">
          <Button onClick={goBack} className="rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="absolute bottom-8 left-0 w-full px-8 container mx-auto">
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
            List Your <span style={{ color: COLORS.TEAL }}>Property</span>
          </h1>
        </div>
      </div>

      <main className="container px-4 max-w-4xl mx-auto -mt-6 relative z-50 space-y-6">

        {/* Registration Details */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none"
          data-error={errors.registrationName || errors.registrationNumber ? "true" : undefined}>
          <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
            <CheckCircle2 className="h-5 w-5" /> Registration Details
          </h2>
          <div className="grid gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Name *</Label>
              <Input
                className={`rounded-xl h-12 font-bold transition-all ${errorClass("registrationName")}`}
                value={formData.registrationName}
                onChange={(e) => setFormData({ ...formData, registrationName: e.target.value })}
                placeholder="As per official documents"
              />
            </div>
            {!isAccommodationOnly && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Number *</Label>
                <Input
                  className={`rounded-xl h-12 font-bold transition-all ${errorClass("registrationNumber")}`}
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="e.g. BN-12345"
                />
              </div>
            )}
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

        {/* Location & Contact */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none"
          data-error={errors.country || errors.place || errors.latitude || errors.email || errors.phoneNumber ? "true" : undefined}>
          <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
            <MapPin className="h-5 w-5" /> Location & Contact
          </h2>
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Country *</Label>
                <div className={errors.country ? "rounded-xl ring-2 ring-red-500" : ""}>
                  <CountrySelector value={formData.country} onChange={(v) => setFormData({ ...formData, country: v })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">City / Place *</Label>
                <Input className={`rounded-xl h-12 font-bold ${errorClass("place")}`}
                  value={formData.place} onChange={(e) => setFormData({ ...formData, place: e.target.value })} />
              </div>
            </div>
            {!isAccommodationOnly && (
              <>
                <div className={cn("p-4 rounded-[24px] border-2 transition-colors",
                  errors.latitude ? "border-red-500 bg-red-50" : "border-dashed border-slate-200 bg-slate-50/50")}>
                  <Button type="button" onClick={() => {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setFormData({ ...formData, latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                        setErrors((p) => ({ ...p, latitude: false }));
                      },
                      () => toast({ title: "Location Error", description: "Unable to get location.", variant: "destructive" })
                    );
                  }} className="w-full rounded-2xl px-6 h-14 font-black uppercase text-[11px] tracking-widest text-white shadow-lg active:scale-95 transition-all"
                    style={{ background: formData.latitude ? COLORS.TEAL : COLORS.CORAL }}>
                    <Navigation className="h-5 w-5 mr-3" />
                    {formData.latitude ? "✓ Location Captured" : "Tap to Capture GPS Location"}
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Email *</Label>
                    <Input className={`rounded-xl h-12 font-bold ${errorClass("email")}`}
                      value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number *</Label>
                    <div className={errors.phoneNumber ? "rounded-xl ring-2 ring-red-500" : ""}>
                      <PhoneInput value={formData.phoneNumber} onChange={(v) => setFormData({ ...formData, phoneNumber: v })} country={formData.country} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Operating Hours */}
        <Card className={cn("bg-white rounded-[28px] p-8 shadow-sm border-none",
          (errors.workingDays || errors.openingHours) && "ring-2 ring-red-500")}
          data-error={errors.workingDays || errors.openingHours ? "true" : undefined}>
          <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
            <Clock className="h-5 w-5" /> Operating Hours *
          </h2>
          <OperatingHoursSection
            openingHours={formData.openingHours} closingHours={formData.closingHours}
            workingDays={workingDays}
            onOpeningChange={(v) => setFormData({ ...formData, openingHours: v })}
            onClosingChange={(v) => setFormData({ ...formData, closingHours: v })}
            onDaysChange={setWorkingDays} accentColor={COLORS.TEAL}
          />
        </Card>

        {/* Facilities & Activities */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none">
          <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
            <DollarSign className="h-5 w-5" /> Facilities & Activities
          </h2>
          <div className="space-y-8">
            <GeneralFacilitiesSelector selected={generalFacilities} onChange={setGeneralFacilities} accentColor={COLORS.TEAL} />

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">
                Each facility must have name, capacity, price, amenities, and at least 2 photos.
                {isAccommodationOnly && " A booking link is required per facility."}
              </p>
              <FacilityBuilder
                items={facilities}
                onChange={setFacilities}
                showErrors={showErrors}
                onValidationFail={onValidationFail}
                showBookingLink={isAccommodationOnly}
              />
            </div>

            {!isAccommodationOnly && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <ActivityBuilder
                  items={activities}
                  onChange={setActivities}
                  showErrors={showErrors}
                  onValidationFail={onValidationFail}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Gallery Images */}
        <Card className={cn("bg-white rounded-[28px] p-8 shadow-sm border-none", errors.galleryImages && "ring-2 ring-red-500")}
          data-error={errors.galleryImages ? "true" : undefined}>
          <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
            <Camera className="h-5 w-5" /> Property Photos *
          </h2>
          <div className="space-y-6">
            <div className={cn("p-6 rounded-[24px] border-2 border-dashed transition-colors",
              errors.galleryImages ? "border-red-500 bg-red-50" : "border-slate-200 bg-slate-50/50")}>
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full" style={{ backgroundColor: `${COLORS.TEAL}15` }}>
                  <ImageIcon className="h-8 w-8" style={{ color: COLORS.TEAL }} />
                </div>
                <label className="w-full">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  <div className="w-full rounded-2xl px-6 py-4 font-black uppercase text-[11px] tracking-widest text-white shadow-lg cursor-pointer text-center"
                    style={{ background: COLORS.CORAL }}>
                    <Camera className="h-5 w-5 inline mr-2" /> Choose Photos
                  </div>
                </label>
              </div>
            </div>
            {galleryImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {galleryPreviews.map((url, index) =>
                  url ? (
                    <div key={index} className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-100">
                      <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-2 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Description */}
        <Card className="bg-white rounded-[28px] p-8 shadow-sm border-none"
          data-error={errors.description || errors.generalBookingLink ? "true" : undefined}>
          <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: COLORS.TEAL }}>
            <CheckCircle2 className="h-5 w-5" /> Property Description *
          </h2>
          <Textarea
            className={cn("rounded-[20px] min-h-[200px] font-medium resize-none", errorClass("description"))}
            placeholder="Describe your property..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          {isAccommodationOnly && (
            <div className="space-y-2 pt-4 border-t border-slate-100 mt-6">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                General Booking Link *
                <span className="text-red-500 ml-1 normal-case font-normal text-[9px]">(required for accommodation listings)</span>
              </Label>
              <Input
                className={cn("rounded-xl h-12 font-bold", errors.generalBookingLink && "border-red-500 bg-red-50")}
                value={formData.generalBookingLink}
                onChange={(e) => {
                  setFormData({ ...formData, generalBookingLink: e.target.value });
                  if (e.target.value.trim()) setErrors((p) => ({ ...p, generalBookingLink: false }));
                }}
                placeholder="https://booking.com/your-property"
              />
              {errors.generalBookingLink && (
                <p className="text-[11px] text-red-500 font-bold">A booking URL is required to publish this listing.</p>
              )}
            </div>
          )}
        </Card>

        {/* Submit */}
        <div className="mb-8">
          <Button onClick={handleSubmit}
            className="w-full py-6 rounded-2xl font-black uppercase text-sm text-white"
            style={{ background: COLORS.TEAL }}
            disabled={loading}>
            {loading
              ? <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Submitting...</>
              : <><CheckCircle2 className="h-4 w-4 mr-2" />{isAccommodationOnly ? "Publish Listing" : "Submit for Review"}</>
            }
          </Button>
        </div>

      </main>
      <MobileBottomBar />
    </div>
  );
};

export default CreateHotel;