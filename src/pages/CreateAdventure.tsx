import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBanCheck } from "@/hooks/useBanCheck";
import {
  MapPin, Navigation, Clock, X, Plus, Camera, CheckCircle2, Info, ArrowLeft, Loader2,
  DollarSign, ChevronLeft, ChevronRight, Link2, ShieldCheck, FileImage, Upload,
  Globe, Users, Sparkles, Building2, Home, TreePine, Tent, Landmark,
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
const COLORS = { TEAL: "#008080", CORAL: "#FF7F50", KHAKI: "#F0E68C", KHAKI_DARK: "#857F3E" };
let _idCounter = 0;
const makeId = () => `item-${Date.now()}-${++_idCounter}`;
const generateFriendlySlug = (name: string): string => {
  const cleanName = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").substring(0, 30);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${cleanName}-${code}`;
};
const safeObjectUrl = (file: File): string => { try { return URL.createObjectURL(file); } catch { return ""; } };

// ─── Image-only validation ────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const isImageFile = (file: File) => ALLOWED_IMAGE_TYPES.includes(file.type) || file.type.startsWith("image/");

// ─── Listing Category ──────────────────────────────────────────────────────────
// Accommodation / Airbnb is the ONLY selectable category right now. Hosting an
// Accommodation listing is the only path that allows a user to create MULTIPLE
// approved listings on their account (see database policy + BecomeHost logic).
// Hotel / Campsite / Park / Attraction are commented out — uncomment to restore
// them, but note doing so re-enables the "one listing per account" cap for those
// categories only; Accommodation remains multi-listing regardless.
const CATEGORY_OPTIONS: { value: string; label: string; icon: any }[] = [
  { value: "accommodation", label: "Accommodation / Airbnb", icon: Home },
  // { value: "hotel", label: "Hotel", icon: Building2 }, // disabled — accommodation only for now
  // { value: "park", label: "Park", icon: TreePine }, // uncomment when Park pages are ready
  // { value: "campsite", label: "Campsite", icon: Tent }, // disabled — accommodation only for now
  // { value: "attraction", label: "Attraction", icon: Landmark }, // uncomment when Attraction pages are ready
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface FacilityItem {
  id: string; name: string; amenities: string[]; amenityInput: string;
  price: string; capacity: string; images: File[]; previewUrls: string[]; saved: boolean;
}
interface ActivityItem {
  id: string; name: string; price: string;
  images: File[]; previewUrls: string[]; saved: boolean;
}
// ── Special / custom pricing tier (Student, Family, Senior, Group, etc.) ──────
interface SpecialPriceTier {
  id: string;
  label: string;
  citizenPrice: string;
  nonCitizenPrice: string;
  requirement: string;
  saved: boolean;
}
const emptyFacility = (): FacilityItem => ({ id: makeId(), name: "", amenities: [], amenityInput: "", price: "", capacity: "", images: [], previewUrls: [], saved: false });
const emptyActivity = (): ActivityItem => ({ id: makeId(), name: "", price: "", images: [], previewUrls: [], saved: false });
const emptySpecialTier = (): SpecialPriceTier => ({ id: makeId(), label: "", citizenPrice: "", nonCitizenPrice: "", requirement: "", saved: false });

const STEP_NAMES = ["Registration", "Location", "Contact & About", "Access & Pricing", "Facilities", "Gallery", "Review"];

// ─── Shared UI Atoms ──────────────────────────────────────────────────────────
const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
    {children}{required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

const StyledInput = ({ className = "", isInvalid = false, ...props }: React.ComponentProps<typeof Input> & { isInvalid?: boolean }) => (
  <Input
    className={`h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080] transition-all ${isInvalid ? "border-red-400 ring-2 ring-red-100 bg-red-50" : ""} ${className}`}
    {...props}
  />
);

const SectionCard = ({ title, subtitle, icon: Icon, children, accent = COLORS.TEAL }: {
  title?: string; subtitle?: string; icon?: any; children: React.ReactNode; accent?: string;
}) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
    {title && (
      <div className="px-8 py-5 border-b border-slate-100 flex items-center gap-3">
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}12` }}>
            <Icon className="h-4 w-4" style={{ color: accent }} />
          </div>
        )}
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    )}
    <div className="px-8 py-6">{children}</div>
  </div>
);

// ─── Category Selector (Accommodation / Airbnb only for now) ─────────────────
const CategorySelector = ({
  value, onChange, isInvalid,
}: { value: string; onChange: (v: string) => void; isInvalid?: boolean }) => (
  <div>
    <div
      className={cn(
        "grid gap-2.5 p-1 rounded-xl",
        CATEGORY_OPTIONS.length === 1 ? "grid-cols-1 max-w-xs" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
        isInvalid && "ring-2 ring-red-300"
      )}
    >
      {CATEGORY_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 h-20 rounded-xl text-[11px] font-bold border transition-all",
              isActive
                ? "text-white shadow-md border-transparent scale-[1.02]"
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            )}
            style={isActive ? { background: COLORS.TEAL } : {}}
          >
            <opt.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-400")} />
            {opt.label}
          </button>
        );
      })}
    </div>
    {isInvalid && (
      <p className="text-red-400 text-[10px] font-semibold mt-1.5">Please select Accommodation / Airbnb to continue</p>
    )}
  </div>
);

// ─── Image Gallery Grid ───────────────────────────────────────────────────────
const ImageGalleryGrid = ({
  images, previews, onRemove, onAdd, isInvalid, slots = 5,
}: {
  images: File[]; previews: string[]; onRemove: (i: number) => void;
  onAdd: (files: FileList | null) => void; isInvalid?: boolean; slots?: number;
}) => (
  <div
    className={`grid gap-3 p-4 rounded-xl border-2 border-dashed transition-all ${isInvalid ? "border-red-400 bg-red-50/30" : "border-slate-200 bg-slate-50/40"}`}
    style={{ gridTemplateColumns: `repeat(${Math.min(slots, 5)}, minmax(0, 1fr))` }}
  >
    {Array.from({ length: slots }).map((_, i) => {
      const url = previews[i];
      if (url) return (
        <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <img src={url} className="w-full h-full object-cover" alt={`Photo ${i + 1}`} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
            <button type="button" onClick={() => onRemove(i)} className="opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-1 shadow-lg transition-all scale-75 group-hover:scale-100">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">{i === 0 ? "Cover" : `#${i + 1}`}</div>
        </div>
      );
      return (
        <label key={i} className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-slate-100 ${isInvalid ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-slate-300"}`}>
          <Camera className={`h-5 w-5 mb-1 ${isInvalid ? "text-red-400" : "text-slate-300"}`} />
          <span className={`text-[9px] font-bold uppercase ${isInvalid ? "text-red-400" : "text-slate-300"}`}>{i === 0 ? "Cover" : `#${i + 1}`}</span>
          <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => onAdd(e.target.files)} />
        </label>
      );
    })}
  </div>
);

// ─── TRA Licence Upload ───────────────────────────────────────────────────────
const TraLicenceUpload = ({
  file, preview, onAdd, onRemove, onReject, isInvalid,
}: {
  file: File | null; preview: string; onAdd: (f: File) => void; onRemove: () => void;
  onReject: (reason: string) => void; isInvalid?: boolean;
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    e.target.value = "";
    if (!isImageFile(picked)) {
      onReject(
        picked.type.startsWith("video/")
          ? "Videos are not supported. Please upload a JPG or PNG image of your TRA licence."
          : picked.type === "application/pdf"
          ? "PDFs are not supported. Please upload a JPG or PNG photo of your TRA licence."
          : "Only JPG and PNG images are accepted for the TRA licence."
      );
      return;
    }
    onAdd(picked);
  };

  return (
    <div className="mt-6 pt-6 border-t border-slate-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#008080,#005f5f)" }}>
          <ShieldCheck className="h-[18px] w-[18px] text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-slate-800 tracking-tight">TRA Licence</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Upload a clear photo of your Tax Registration Authority licence</p>
        </div>
        <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-full">Required</span>
      </div>

      {preview ? (
        <div className={`relative rounded-2xl overflow-hidden border-2 transition-all ${isInvalid ? "border-red-300" : "border-teal-200"}`} style={{ background: "linear-gradient(135deg,#f0fdfa,#e6fffa)" }}>
          <div className="flex items-center gap-4 p-4">
            <div className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-teal-200 shadow-md">
              <img src={preview} alt="TRA Licence" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                <span className="text-sm font-black text-teal-700">Licence Uploaded</span>
              </div>
              <p className="text-[11px] text-teal-600 truncate font-medium">{file?.name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{file ? `${(file.size / 1024).toFixed(0)} KB` : ""}</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700 border border-teal-300 bg-white rounded-lg px-3 py-1.5 cursor-pointer hover:bg-teal-50 transition-colors">
                <Upload className="h-3 w-3" /> Replace
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
              <button type="button" onClick={onRemove} className="flex items-center gap-1.5 text-[11px] font-bold text-red-500 border border-red-200 bg-white rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">
                <X className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#008080,#00b3b3)" }} />
        </div>
      ) : (
        <label className={cn(
          "flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all py-10 px-6 group",
          isInvalid
            ? "border-red-300 bg-red-50/40 hover:bg-red-50"
            : "border-slate-200 bg-slate-50/50 hover:border-teal-400 hover:bg-teal-50/30"
        )}>
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all", isInvalid ? "bg-red-100" : "bg-slate-100 group-hover:bg-teal-100")}>
            <FileImage className={cn("h-6 w-6 transition-colors", isInvalid ? "text-red-400" : "text-slate-400 group-hover:text-teal-600")} />
          </div>
          <div className="text-center">
            <p className={cn("text-sm font-bold mb-0.5", isInvalid ? "text-red-500" : "text-slate-600 group-hover:text-teal-700")}>
              {isInvalid ? "TRA Licence is required" : "Upload TRA Licence"}
            </p>
            <p className="text-[11px] text-slate-400">JPG or PNG only · Max 5 MB</p>
          </div>
          <div className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all", isInvalid ? "bg-red-500 text-white" : "bg-[#008080] text-white group-hover:bg-[#005f5f]")}>
            <Upload className="h-3.5 w-3.5" /> Choose Image
          </div>
          <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
        </label>
      )}

      <div className="mt-3 flex items-start gap-2 px-1">
        <Info className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Only JPG and PNG images are accepted. Your licence is used for identity verification only and will not be publicly visible.
        </p>
      </div>
    </div>
  );
};

// ─── Amenity Tag Input ────────────────────────────────────────────────────────
const AmenityTagInput = ({ tags, input, onInputChange, onAdd, onRemove, hasError }: {
  tags: string[]; input: string; onInputChange: (v: string) => void;
  onAdd: () => void; onRemove: (i: number) => void; hasError: boolean;
}) => (
  <div className={cn(
    "min-h-[44px] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-xl border bg-white transition-all",
    hasError ? "border-red-400 ring-2 ring-red-100" : "border-slate-200 focus-within:ring-2 focus-within:ring-[#008080]/20 focus-within:border-[#008080]"
  )}>
    {tags.map((tag, i) => (
      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold" style={{ background: `${COLORS.TEAL}10`, color: COLORS.TEAL }}>
        {tag}
        <button type="button" onClick={() => onRemove(i)} className="hover:text-red-500 transition-colors"><X className="h-2.5 w-2.5" /></button>
      </span>
    ))}
    <input
      value={input}
      onChange={(e) => onInputChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "," || e.key === "Enter" || e.key === ".") { e.preventDefault(); onAdd(); }
        if (e.key === "Backspace" && !input && tags.length > 0) onRemove(tags.length - 1);
      }}
      onBlur={onAdd}
      placeholder={tags.length === 0 ? "Type amenity, press comma..." : "Add more..."}
      className="flex-1 min-w-[120px] text-sm font-medium outline-none bg-transparent placeholder:text-slate-300 placeholder:font-normal"
    />
  </div>
);

// ─── Special Pricing Tier Builder (Student, Family, Senior, Group, etc.) ──────
const SpecialPriceBuilder = ({ items, onChange, showErrors, onValidationFail }: {
  items: SpecialPriceTier[]; onChange: (items: SpecialPriceTier[]) => void;
  showErrors: boolean; onValidationFail: (msg: string) => void;
}) => {
  const { usdHint } = useCurrency();
  const update = (id: string, patch: Partial<SpecialPriceTier>) => onChange(items.map((t) => t.id === id ? { ...t, ...patch } : t));
  const addItem = () => onChange([...items, emptySpecialTier()]);
  const removeItem = (id: string) => onChange(items.filter((t) => t.id !== id));

  const saveItem = (t: SpecialPriceTier) => {
    if (!t.label.trim()) { onValidationFail("Please enter a name for this special price (e.g. Student, Family)."); return; }
    if (!t.citizenPrice.trim() || parseFloat(t.citizenPrice) <= 0) { onValidationFail("Please enter a citizen price greater than 0."); return; }
    update(t.id, { saved: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5" style={{ color: COLORS.CORAL }} />
        <FieldLabel>Special Entry Prices (Student, Family, Senior, Group...)</FieldLabel>
      </div>
      <p className="text-[11px] text-slate-400 -mt-3">Optional. Create custom pricing categories with their own requirements (e.g. "Student — valid ID required").</p>

      {items.map((item) => (
        <div key={item.id} className={cn("rounded-xl border overflow-hidden transition-all", item.saved ? "border-purple-200 bg-purple-50/30" : "border-slate-200 bg-white")}>
          {item.saved ? (
            <div className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 truncate">{item.label}</p>
                <div className="flex gap-3 mt-0.5 flex-wrap">
                  <p className="text-[11px] font-semibold text-purple-600">
                    Citizen: KSh {item.citizenPrice} <span className="text-blue-500">{usdHint(parseFloat(item.citizenPrice) || 0)}</span>
                  </p>
                  {item.nonCitizenPrice && parseFloat(item.nonCitizenPrice) > 0 && (
                    <p className="text-[11px] font-semibold text-amber-600">
                      Non-Citizen: KSh {item.nonCitizenPrice} <span className="text-blue-500">{usdHint(parseFloat(item.nonCitizenPrice) || 0)}</span>
                    </p>
                  )}
                </div>
                {item.requirement.trim() && <p className="text-[10px] text-slate-500 mt-1 italic">Requires: {item.requirement}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => update(item.id, { saved: false })} className="text-[11px] font-bold uppercase tracking-wide text-purple-500 border border-purple-200 rounded-lg px-3 py-1.5 hover:bg-purple-50 transition-colors">Edit</button>
                <button type="button" onClick={() => removeItem(item.id)} className="text-[11px] font-bold uppercase tracking-wide text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">Remove</button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <FieldLabel required>Category Name</FieldLabel>
                  <StyledInput value={item.label} onChange={(e) => update(item.id, { label: e.target.value })} placeholder="e.g. Student, Family Pack" isInvalid={showErrors && !item.label.trim()} />
                </div>
                <div className="space-y-1">
                  <FieldLabel required>Citizen Price (KSh)</FieldLabel>
                  <StyledInput type="number" value={item.citizenPrice} onChange={(e) => update(item.id, { citizenPrice: e.target.value })} placeholder="0" isInvalid={showErrors && (!item.citizenPrice.trim() || parseFloat(item.citizenPrice) <= 0)} />
                  {item.citizenPrice && parseFloat(item.citizenPrice) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-0.5">{usdHint(parseFloat(item.citizenPrice))}</p>}
                </div>
                <div className="space-y-1">
                  <FieldLabel>Non-Citizen Price (KSh)</FieldLabel>
                  <StyledInput type="number" value={item.nonCitizenPrice} onChange={(e) => update(item.id, { nonCitizenPrice: e.target.value })} placeholder="Optional" />
                  {item.nonCitizenPrice && parseFloat(item.nonCitizenPrice) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-0.5">{usdHint(parseFloat(item.nonCitizenPrice))}</p>}
                </div>
              </div>
              <div className="space-y-1">
                <FieldLabel>Requirement (shown to visitors)</FieldLabel>
                <StyledInput value={item.requirement} onChange={(e) => update(item.id, { requirement: e.target.value })} placeholder="e.g. Valid student ID required at entry" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => saveItem(item)} className="flex-1 h-10 rounded-xl text-white text-[12px] font-bold hover:opacity-90 transition-all" style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}>Save Special Price</button>
                {items.length > 0 && (
                  <button type="button" onClick={() => removeItem(item.id)} className="h-10 px-4 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"><X className="h-4 w-4" /></button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addItem} className="w-full h-11 rounded-xl text-[11px] font-bold uppercase tracking-wide border-2 border-dashed border-slate-200 text-slate-400 hover:border-purple-400 hover:text-purple-400 transition-all flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> Add Special Price
      </button>
    </div>
  );
};

// ─── Facility Builder ─────────────────────────────────────────────────────────
const FacilityBuilder = ({ items, onChange, showErrors, onValidationFail }: {
  items: FacilityItem[]; onChange: (items: FacilityItem[]) => void;
  showErrors: boolean; onValidationFail: (msg: string) => void;
}) => {
  const { usdHint } = useCurrency();
  const update = (id: string, patch: Partial<FacilityItem>) => onChange(items.map((f) => f.id === id ? { ...f, ...patch } : f));
  const addItem = () => onChange([...items, emptyFacility()]);
  const removeItem = (id: string) => onChange(items.filter((f) => f.id !== id));
  const addAmenityTag = (item: FacilityItem) => {
    const val = item.amenityInput.replace(/,/g, "").trim();
    if (!val) return;
    update(item.id, { amenities: [...item.amenities, val], amenityInput: "" });
  };
  const removeAmenityTag = (item: FacilityItem, idx: number) => update(item.id, { amenities: item.amenities.filter((_, i) => i !== idx) });

  const handleImages = async (id: string, fileList: FileList | null, existing: File[]) => {
    if (!fileList || fileList.length === 0) return;
    const slots = 5 - existing.length;
    if (slots <= 0) return;
    const incoming = Array.from(fileList).slice(0, slots);
    const rejected = incoming.filter((f) => !isImageFile(f));
    if (rejected.length > 0) { onValidationFail("Only image files (JPG, PNG) are accepted."); return; }
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
    if (f.images.length < 2) { onValidationFail("Please add at least 2 photos for this facility."); return; }
    update(f.id, { saved: true });
  };

  return (
    <div className="space-y-4">
      <FieldLabel>Facilities (with photos)</FieldLabel>
      {items.map((item) => (
        <div key={item.id} className={cn("rounded-xl border overflow-hidden transition-all", item.saved ? "border-[#FF7F50]/30 bg-[#FF7F50]/5" : "border-slate-200 bg-white")}>
          {item.saved ? (
            <div className="p-4 flex items-center gap-4">
              <div className="flex gap-2 shrink-0">
                {item.previewUrls.slice(0, 3).map((url, i) => url
                  ? <img key={i} src={url} className="w-12 h-12 rounded-xl object-cover border border-slate-200" alt="" />
                  : <div key={i} className="w-12 h-12 rounded-xl bg-slate-200" />
                )}
                {item.previewUrls.length > 3 && (
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">+{item.previewUrls.length - 3}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 truncate">{item.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{item.amenities.join(", ")}</p>
                <div className="flex gap-3 mt-0.5">
                  {item.capacity && <p className="text-[11px] text-slate-400">Capacity: {item.capacity}</p>}
                  {item.price && <p className="text-[11px] font-semibold" style={{ color: COLORS.CORAL }}>KSh {item.price} <span className="text-blue-500">{usdHint(parseFloat(item.price))}</span></p>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => update(item.id, { saved: false })} className="text-[11px] font-bold uppercase tracking-wide border rounded-lg px-3 py-1.5 hover:bg-orange-50 transition-colors" style={{ color: COLORS.CORAL, borderColor: `${COLORS.CORAL}40` }}>Edit</button>
                <button type="button" onClick={() => removeItem(item.id)} className="text-[11px] font-bold uppercase tracking-wide text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">Remove</button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <FieldLabel required>Name</FieldLabel>
                  <StyledInput value={item.name} onChange={(e) => update(item.id, { name: e.target.value })} placeholder="e.g. Campsite A" isInvalid={showErrors && !item.name.trim()} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Price (KSh)</FieldLabel>
                  <StyledInput type="number" value={item.price} onChange={(e) => update(item.id, { price: e.target.value })} placeholder="0" />
                  {item.price && parseFloat(item.price) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-0.5">{usdHint(parseFloat(item.price))}</p>}
                </div>
                <div className="space-y-1">
                  <FieldLabel required>Capacity</FieldLabel>
                  <StyledInput type="number" min={1} value={item.capacity} onChange={(e) => update(item.id, { capacity: e.target.value.replace(/[^0-9]/g, "") })} placeholder="e.g. 20" isInvalid={showErrors && !item.capacity.trim()} />
                </div>
              </div>
              <div className="space-y-1">
                <FieldLabel required>
                  Amenities{showErrors && item.amenities.length === 0 && <span className="text-red-400 text-[10px] normal-case font-normal"> — at least one required</span>}
                </FieldLabel>
                <AmenityTagInput tags={item.amenities} input={item.amenityInput} onInputChange={(v) => update(item.id, { amenityInput: v })} onAdd={() => addAmenityTag(item)} onRemove={(i) => removeAmenityTag(item, i)} hasError={showErrors && item.amenities.length === 0} />
              </div>
              <div>
                <FieldLabel required>
                  Photos (min 2, max 5){showErrors && item.images.length < 2 && <span className="text-red-400 text-[10px] normal-case font-normal"> — at least 2 required</span>}
                </FieldLabel>
                <ImageGalleryGrid images={item.images} previews={item.previewUrls} onRemove={(i) => removeImage(item.id, i, item.images)} onAdd={(files) => handleImages(item.id, files, item.images)} isInvalid={showErrors && item.images.length < 2} slots={5} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => saveItem(item)} className="flex-1 h-10 rounded-xl text-white text-[12px] font-bold hover:opacity-90 transition-all" style={{ background: `linear-gradient(135deg, ${COLORS.CORAL}, #e06040)` }}>Save Facility</button>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(item.id)} className="h-10 px-4 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"><X className="h-4 w-4" /></button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addItem} className="w-full h-11 rounded-xl text-[11px] font-bold uppercase tracking-wide border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#FF7F50] hover:text-[#FF7F50] transition-all flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> Add Facility
      </button>
    </div>
  );
};

// ─── Activity Builder ─────────────────────────────────────────────────────────
const ActivityBuilder = ({ items, onChange, showErrors, onValidationFail }: {
  items: ActivityItem[]; onChange: (items: ActivityItem[]) => void;
  showErrors: boolean; onValidationFail: (msg: string) => void;
}) => {
  const { usdHint } = useCurrency();
  const update = (id: string, patch: Partial<ActivityItem>) => onChange(items.map((a) => a.id === id ? { ...a, ...patch } : a));
  const addItem = () => onChange([...items, emptyActivity()]);
  const removeItem = (id: string) => onChange(items.filter((a) => a.id !== id));

  const handleImages = async (id: string, fileList: FileList | null, existing: File[]) => {
    if (!fileList || fileList.length === 0) return;
    const slots = 5 - existing.length;
    if (slots <= 0) return;
    const incoming = Array.from(fileList).slice(0, slots);
    const rejected = incoming.filter((f) => !isImageFile(f));
    if (rejected.length > 0) { onValidationFail("Only image files (JPG, PNG) are accepted."); return; }
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
    if (a.images.length === 0) { onValidationFail("Please upload at least 1 photo for this activity."); return; }
    update(a.id, { saved: true });
  };

  return (
    <div className="space-y-4">
      <FieldLabel>Activities (with photos)</FieldLabel>
      {items.map((item) => (
        <div key={item.id} className={cn("rounded-xl border overflow-hidden transition-all", item.saved ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 bg-white")}>
          {item.saved ? (
            <div className="p-4 flex items-center gap-4">
              <div className="flex gap-2 shrink-0">
                {item.previewUrls.length > 0
                  ? item.previewUrls.slice(0, 3).map((url, i) => url ? <img key={i} src={url} className="w-12 h-12 rounded-xl object-cover border border-slate-200" alt="" /> : null)
                  : <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center"><Camera className="h-5 w-5 text-slate-300" /></div>
                }
                {item.previewUrls.length > 3 && (
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-500">+{item.previewUrls.length - 3}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 truncate">{item.name}</p>
                {item.price && <p className="text-[11px] font-semibold text-indigo-500">KSh {item.price} <span className="text-blue-500">{usdHint(parseFloat(item.price))}</span></p>}
                <p className="text-[10px] text-slate-400 mt-0.5">{item.previewUrls.length > 0 ? `${item.previewUrls.length} photo${item.previewUrls.length > 1 ? "s" : ""}` : "No photos"}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => update(item.id, { saved: false })} className="text-[11px] font-bold uppercase tracking-wide text-indigo-500 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors">Edit</button>
                <button type="button" onClick={() => removeItem(item.id)} className="text-[11px] font-bold uppercase tracking-wide text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">Remove</button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <FieldLabel required>Activity Name</FieldLabel>
                  <StyledInput value={item.name} onChange={(e) => update(item.id, { name: e.target.value })} placeholder="e.g. Hiking" isInvalid={showErrors && !item.name.trim()} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Price (KSh)</FieldLabel>
                  <StyledInput type="number" value={item.price} onChange={(e) => update(item.id, { price: e.target.value })} placeholder="0 = Free" />
                  {item.price && parseFloat(item.price) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-0.5">{usdHint(parseFloat(item.price))}</p>}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <FieldLabel required>
                    Photos (min 1, max 5)
                    {showErrors && item.images.length === 0 && <span className="text-red-400 text-[10px] normal-case font-normal"> — at least 1 required</span>}
                  </FieldLabel>
                  {item.images.length > 0 && (
                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">{item.images.length}/5 uploaded</span>
                  )}
                </div>
                {item.previewUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {item.previewUrls.map((url, i) => (
                      <div key={i} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                        <img src={url} className="w-full h-full object-cover" alt={`Activity ${i + 1}`} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <button type="button" onClick={() => removeImage(item.id, i, item.images)} className="opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-1 transition-all scale-75 group-hover:scale-100"><X className="h-2.5 w-2.5" /></button>
                        </div>
                        <div className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-[8px] font-bold px-1 py-0.5 rounded">#{i + 1}</div>
                      </div>
                    ))}
                    {item.images.length < 5 && (
                      <label className="w-16 h-16 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                        <Plus className="h-4 w-4 text-indigo-400" />
                        <span className="text-[8px] font-bold text-indigo-400 uppercase mt-0.5">Add</span>
                        <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleImages(item.id, e.target.files, item.images)} />
                      </label>
                    )}
                  </div>
                )}
                {item.previewUrls.length === 0 && (
                  <label className={cn(
                    "flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed cursor-pointer transition-all py-7 px-4 group",
                    showErrors && item.images.length === 0
                      ? "border-red-300 bg-red-50/40 hover:border-red-400 hover:bg-red-50"
                      : "border-indigo-200 bg-indigo-50/30 hover:border-indigo-400 hover:bg-indigo-50/50"
                  )}>
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center transition-colors", showErrors && item.images.length === 0 ? "bg-red-100 group-hover:bg-red-200" : "bg-indigo-100 group-hover:bg-indigo-200")}>
                      <Camera className={cn("h-5 w-5", showErrors && item.images.length === 0 ? "text-red-400" : "text-indigo-500")} />
                    </div>
                    <div className="text-center">
                      <p className={cn("text-sm font-bold", showErrors && item.images.length === 0 ? "text-red-500" : "text-indigo-600")}>
                        {showErrors && item.images.length === 0 ? "At least 1 photo is required" : "Upload Activity Photos"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">JPG or PNG · 1 to 5 images</p>
                    </div>
                    <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleImages(item.id, e.target.files, item.images)} />
                  </label>
                )}
                {item.images.length >= 5 && (
                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Maximum 5 photos reached
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => saveItem(item)} className="flex-1 h-10 rounded-xl text-white text-[12px] font-bold hover:opacity-90 transition-all" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>Save Activity</button>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(item.id)} className="h-10 px-4 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"><X className="h-4 w-4" /></button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addItem} className="w-full h-11 rounded-xl text-[11px] font-bold uppercase tracking-wide border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-400 transition-all flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> Add Activity
      </button>
    </div>
  );
};

// ─── Step Sidebar ─────────────────────────────────────────────────────────────
const StepSidebar = ({ steps, currentStep, onStepClick }: { steps: any[]; currentStep: number; onStepClick?: (i: number) => void; }) => (
  <aside className="hidden lg:flex flex-col w-72 shrink-0 sticky top-24 self-start">
    <div className="rounded-2xl overflow-hidden mb-6 relative h-44">
      <img src="/images/category-campsite.webp" className="w-full h-full object-cover" alt="" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute bottom-4 left-5 right-5">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS.KHAKI }}>Accommodation / Airbnb</span>
        <h2 className="text-white text-xl font-black uppercase tracking-tight leading-tight mt-0.5">Create Listing</h2>
      </div>
    </div>
    <nav className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Your progress</p>
      </div>
      <ul className="p-3 space-y-1">
        {steps.map((step, i) => {
          const num = i + 1;
          const isActive = currentStep === num;
          const isDone = step.isComplete && currentStep > num;
          const isPast = currentStep > num;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => isPast && onStepClick?.(num)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${isActive ? "bg-[#008080] text-white shadow-md" : isPast ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${isActive ? "bg-white text-[#008080]" : isDone ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : num}
                </div>
                <div className="min-w-0">
                  <p className={`text-[12px] font-bold truncate ${isActive ? "text-white" : isDone ? "text-emerald-700" : "text-slate-500"}`}>{step.name}</p>
                  {isActive && <p className="text-[10px] text-white/70 mt-0.5">Current step</p>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
    <div className="mt-4 bg-slate-50 rounded-2xl p-5 border border-slate-100">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Need help?</p>
      <p className="text-xs text-slate-400 leading-relaxed">Fill each step carefully. Your listing will be reviewed before going live.</p>
    </div>
  </aside>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const CreateAdventure = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack("/become-host");
  const { toast } = useToast();
  const { user } = useAuth();
  const { usdHint } = useCurrency();
  useBanCheck();

  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // ── Listing Category — defaults to (and, for now, is locked to) Accommodation
  // since it's the only option in CATEGORY_OPTIONS. Kept as free-form state so
  // re-enabling other categories later is a one-line change.
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0]?.value ?? "accommodation");

  const [formData, setFormData] = useState({
    registrationName: "", registrationNumber: "", locationName: "", place: "",
    country: "", description: "", email: "", phoneNumber: "",
    openingHours: "00:00", closingHours: "23:59",
    entranceFeeType: "free", adultPrice: "0", childPrice: "0",
    // ── Non-citizen pricing (optional, mirrors adult/child) ──
    hasNonCitizenPricing: false,
    nonCitizenAdultPrice: "0", nonCitizenChildPrice: "0",
    latitude: null as number | null, longitude: null as number | null,
    locationLink: "",
  });

  const [traLicenceFile, setTraLicenceFile] = useState<File | null>(null);
  const [traLicencePreview, setTraLicencePreview] = useState<string>("");
  const [locationMode, setLocationMode] = useState<"link" | "gps" | null>(null);
  const [workingDays, setWorkingDays] = useState({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: true });
  const [generalFacilities, setGeneralFacilities] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<FacilityItem[]>(() => [emptyFacility()]);
  const [activities, setActivities] = useState<ActivityItem[]>(() => [emptyActivity()]);
  // ── Special / custom pricing tiers ──
  const [specialPrices, setSpecialPrices] = useState<SpecialPriceTier[]>([]);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

  const onValidationFail = useCallback((msg: string) => toast({ title: "Required", description: msg, variant: "destructive" }), [toast]);

  // ── Auth guard + profile pre-fill ────────────────────────────────────────
  useEffect(() => {
    // Gatekeeper: redirect unauthenticated users to login
    if (!user) {
      toast({
        title: "Login Required",
        description: "You must be logged in to host a listing.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    // Pre-fill country from profile only
    supabase
      .from("profiles")
      .select("country")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.country) {
          setFormData((p) => ({ ...p, country: data.country }));
        }
      });
  }, [user, navigate, toast]);

  // ── TRA Licence handlers ──────────────────────────────────────────────────
  const handleTraLicenceAdd = (file: File) => {
    setTraLicenceFile(file);
    setTraLicencePreview(safeObjectUrl(file));
  };
  const handleTraLicenceRemove = () => {
    setTraLicenceFile(null);
    setTraLicencePreview("");
  };
  const handleTraLicenceReject = (reason: string) => {
    toast({ title: "File type not supported", description: reason, variant: "destructive" });
  };

  const isStep1Complete = !!category && !!formData.registrationName.trim() && !!formData.registrationNumber.trim() && !!formData.country && !!traLicenceFile;
  const isStep2Complete = !!formData.locationName.trim() && !!formData.place.trim() && (!!formData.latitude || !!formData.locationLink.trim());
  const isStep3Complete = !!formData.description.trim();
  const isStep4Complete = true;
  const isStep5Complete = facilities.every((f) => f.saved);
  const isStep6Complete = galleryImages.length >= 5;

  const steps = [
    { name: STEP_NAMES[0], isComplete: isStep1Complete },
    { name: STEP_NAMES[1], isComplete: isStep2Complete },
    { name: STEP_NAMES[2], isComplete: isStep3Complete },
    { name: STEP_NAMES[3], isComplete: isStep4Complete },
    { name: STEP_NAMES[4], isComplete: isStep5Complete },
    { name: STEP_NAMES[5], isComplete: isStep6Complete },
    { name: STEP_NAMES[6], isComplete: isStep1Complete && isStep2Complete && isStep3Complete && isStep6Complete },
  ];

  const isMissing = (v: any) => {
    if (!showErrors) return false;
    if (typeof v === "string") return !v.trim();
    return v === null || v === undefined;
  };

  const validateCurrentStep = (): boolean => {
    if (currentStep === 1) {
      if (!category) {
        setShowErrors(true);
        toast({ title: "Select a Category", description: "Please choose Accommodation / Airbnb to continue.", variant: "destructive" });
        return false;
      }
      if (!formData.registrationName.trim() || !formData.registrationNumber.trim() || !formData.country) {
        setShowErrors(true);
        toast({ title: "Complete this step", description: "Fill all required fields", variant: "destructive" });
        return false;
      }
      if (!traLicenceFile) {
        setShowErrors(true);
        toast({ title: "TRA Licence Required", description: "Please upload a JPG or PNG photo of your TRA licence to continue.", variant: "destructive" });
        return false;
      }
    } else if (currentStep === 2) {
      if (!formData.locationName.trim() || !formData.place.trim() || (!formData.latitude && !formData.locationLink.trim())) {
        setShowErrors(true);
        toast({ title: "Complete this step", description: "Fill location and provide a link or GPS", variant: "destructive" });
        return false;
      }
    } else if (currentStep === 3) {
      if (!formData.description.trim()) {
        setShowErrors(true);
        toast({ title: "Complete this step", description: "Description is required", variant: "destructive" });
        return false;
      }
    } else if (currentStep === 5) {
      if (facilities.some((f) => !f.saved)) {
        toast({ title: "Unsaved Facility", description: "Please save all facilities", variant: "destructive" });
        return false;
      }
      if (specialPrices.some((t) => !t.saved)) {
        toast({ title: "Unsaved Special Price", description: "Please save or remove all special pricing tiers", variant: "destructive" });
        return false;
      }
    } else if (currentStep === 6) {
      if (galleryImages.length < 5) {
        setShowErrors(true);
        toast({ title: "Photos Required", description: `Upload ${5 - galleryImages.length} more photos`, variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    setFacilities((prev) =>
      prev.map((f) => {
        if (f.saved) return f;
        let next = { ...f };
        if (f.amenityInput.trim()) {
          const val = f.amenityInput.replace(/,/g, "").trim();
          next = { ...next, amenities: [...next.amenities, val], amenityInput: "" };
        }
        if (next.name.trim() && next.amenities.length > 0 && next.capacity.trim() && next.images.length >= 2)
          next.saved = true;
        return next;
      })
    );
    setActivities((prev) =>
      prev.map((a) => {
        if (a.saved) return a;
        if (a.name.trim() && a.images.length >= 1) return { ...a, saved: true };
        return a;
      })
    );
    setSpecialPrices((prev) =>
      prev.map((t) => {
        if (t.saved) return t;
        if (t.label.trim() && t.citizenPrice.trim() && parseFloat(t.citizenPrice) > 0) return { ...t, saved: true };
        return t;
      })
    );
    if (!validateCurrentStep()) return;
    setShowErrors(false);
    setCurrentStep((prev) => Math.min(prev + 1, 7));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrev = () => {
    setShowErrors(false);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getCurrentLocation = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setFormData((p) => ({ ...p, latitude: coords.latitude, longitude: coords.longitude }));
        toast({ title: "Location captured", description: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` });
      },
      () => toast({ title: "GPS Error", description: "Could not get location.", variant: "destructive" })
    );
  };

  const handleGalleryUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const slots = 5 - galleryImages.length;
    if (slots <= 0) return;
    const incoming = Array.from(files).slice(0, slots);
    const rejected = incoming.filter((f) => !isImageFile(f));
    if (rejected.length > 0) {
      toast({ title: "File type not supported", description: "Only JPG and PNG images are accepted.", variant: "destructive" });
      return;
    }
    let merged: File[];
    try { const compressed = await compressImages(incoming); merged = [...galleryImages, ...compressed.map((c) => c.file)].slice(0, 5); }
    catch { merged = [...galleryImages, ...incoming].slice(0, 5); }
    setGalleryImages(merged);
    setGalleryPreviews(merged.map(safeObjectUrl));
  };

  const removeGalleryImage = (idx: number) => {
    const updated = galleryImages.filter((_, i) => i !== idx);
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

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) { navigate("/login"); return; }
    setShowErrors(true);
    if (
      !category ||
      !formData.registrationName.trim() || !formData.registrationNumber.trim() || !formData.country ||
      !formData.locationName.trim() || !formData.place.trim() ||
      !formData.description.trim() || galleryImages.length < 5 || !traLicenceFile
    ) {
      toast({ title: "Action Required", description: "Please select a category and complete all steps including TRA licence upload.", variant: "destructive" });
      return;
    }
    if (facilities.some((f) => !f.saved)) {
      toast({ title: "Unsaved Facility", description: "Please save all facilities.", variant: "destructive" });
      return;
    }
    if (specialPrices.some((t) => !t.saved)) {
      toast({ title: "Unsaved Special Price", description: "Please save or remove all special pricing tiers.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const friendlySlug = generateFriendlySlug(formData.registrationName);
      const traLicenceUrl = traLicenceFile ? await uploadFile(traLicenceFile, "tra-licence") : "";
      const galleryUrls = await Promise.all(galleryImages.map((f) => uploadFile(f, "gallery")));
      const facilitiesForDB = await Promise.all(
        facilities.map(async (fac) => ({
          name: fac.name, amenities: fac.amenities,
          capacity: fac.capacity ? parseInt(fac.capacity, 10) || 0 : 0,
          price: fac.price ? parseFloat(fac.price) || 0 : 0,
          images: await Promise.all(fac.images.map((f) => uploadFile(f, "fac"))),
        }))
      );
      const savedActivities = activities.filter((a) => a.name.trim());
      const activitiesForDB = await Promise.all(
        savedActivities.map(async (act) => ({
          name: act.name,
          price: act.price ? parseFloat(act.price) || 0 : 0,
          images: await Promise.all(act.images.map((f) => uploadFile(f, "act"))),
        }))
      );
      const selectedDays = Object.entries(workingDays).filter(([, v]) => v).map(([k]) => k);

      // ── Special pricing tiers payload (only saved/complete ones) ──
      const specialPricesForDB = specialPrices
        .filter((t) => t.saved && t.label.trim())
        .map((t) => ({
          id: t.id,
          label: t.label.trim(),
          citizen_price: parseFloat(t.citizenPrice) || 0,
          non_citizen_price: t.nonCitizenPrice ? (parseFloat(t.nonCitizenPrice) || 0) : 0,
          requirement: t.requirement.trim(),
        }));

      // NOTE: the database enforces the multi-listing rule (see
      // adventure_places_policy.sql) — this insert will be rejected by a
      // trigger if it violates the "one listing unless Accommodation" rule,
      // so the try/catch below surfaces that as a normal submission error.
      const { error } = await supabase.from("adventure_places").insert([{
        id: friendlySlug, slug: friendlySlug, name: formData.registrationName,
        // ── Listing category (accommodation only, for now) ──
        category,
        registration_number: formData.registrationNumber,
        tra_license_url: traLicenceUrl,
        location: formData.locationName, place: formData.place, country: formData.country,
        description: formData.description, email: formData.email,
        phone_numbers: formData.phoneNumber ? [formData.phoneNumber] : [],
        map_link: formData.latitude
          ? `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`
          : (formData.locationLink || ""),
        latitude: formData.latitude, longitude: formData.longitude,
        opening_hours: formData.openingHours, closing_hours: formData.closingHours, days_opened: selectedDays,
        image_url: galleryUrls[0] ?? "", gallery_images: galleryUrls,
        entry_fee_type: formData.entranceFeeType,
        entry_fee: formData.entranceFeeType === "paid" ? parseFloat(formData.adultPrice) || 0 : 0,
        child_entry_fee: formData.entranceFeeType === "paid" ? parseFloat(formData.childPrice) || 0 : 0,
        // ── Non-citizen pricing ──
        has_non_citizen_pricing: formData.entranceFeeType === "paid" && formData.hasNonCitizenPricing,
        non_citizen_entry_fee: formData.entranceFeeType === "paid" && formData.hasNonCitizenPricing ? (parseFloat(formData.nonCitizenAdultPrice) || 0) : 0,
        non_citizen_child_entry_fee: formData.entranceFeeType === "paid" && formData.hasNonCitizenPricing ? (parseFloat(formData.nonCitizenChildPrice) || 0) : 0,
        // ── Special pricing tiers ──
        special_entry_prices: specialPricesForDB,
        amenities: generalFacilities, facilities: facilitiesForDB, activities: activitiesForDB,
        created_by: user.id,
        approval_status: "pending",
      }]);
      if (error) throw error;

      // Write hosting_category so BecomeHost/MyListing can detect this user
      await supabase.from("host_verifications").upsert(
        { user_id: user.id, hosting_category: "adventure", status: "pending" },
        { onConflict: "user_id" }
      );

      toast({ title: "Listing Submitted", description: `Ref: ${friendlySlug} — Pending admin review.`, duration: 5000 });
      navigate("/become-host");
    } catch (err: any) {
      toast({ title: "Submission Error", description: err?.message ?? "Something went wrong.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const locationModeOptions: { mode: "link" | "gps"; label: string; icon: React.ElementType }[] = [
    { mode: "link", label: "Paste Map Link", icon: Link2 },
    { mode: "gps",  label: "Use My GPS",     icon: Navigation },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />

      {/* Mobile Hero */}
      <div className="lg:hidden relative h-36 overflow-hidden bg-slate-900">
        <img src="/images/category-campsite.webp" className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-5">
          <Button onClick={goBack} className="absolute top-4 left-4 rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">
            Create <span style={{ color: COLORS.KHAKI }}>Listing</span>
          </h1>
          <p className="text-white/60 text-xs font-semibold mt-0.5">Step {currentStep} of {STEP_NAMES.length}</p>
        </div>
      </div>

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6 lg:py-10">
        <div className="flex gap-8 items-start">
          <StepSidebar steps={steps} currentStep={currentStep} onStepClick={(n) => { setShowErrors(false); setCurrentStep(n); }} />

          <div className="flex-1 min-w-0 space-y-5">
            {/* Desktop title */}
            <div className="hidden lg:flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm">
                  <ArrowLeft className="h-4 w-4 text-slate-600" />
                </button>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">{STEP_NAMES[currentStep - 1]}</h1>
                  <p className="text-sm text-slate-400 font-medium mt-0.5">Step {currentStep} of {STEP_NAMES.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${((currentStep - 1) / (STEP_NAMES.length - 1)) * 100}%`, background: COLORS.TEAL }} />
                </div>
                <span className="text-xs font-bold text-slate-400">{Math.round(((currentStep - 1) / (STEP_NAMES.length - 1)) * 100)}%</span>
              </div>
            </div>

            {/* Mobile stepper */}
            <div className="lg:hidden"><CreateFormStepper steps={steps} currentStep={currentStep} /></div>

            {/* ══ STEP 1 ══ */}
            {currentStep === 1 && (
              <SectionCard title="Registration Details" subtitle="Official government registration information" icon={Info}>
                <div className="grid gap-5">
                  {/* ── Listing category — first field shown to the user ── */}
                  <div>
                    <FieldLabel required>Listing Category</FieldLabel>
                    <CategorySelector value={category} onChange={setCategory} isInvalid={showErrors && !category} />
                  </div>
                  <div>
                    <FieldLabel required>Registration Name</FieldLabel>
                    <StyledInput value={formData.registrationName} onChange={(e) => setFormData({ ...formData, registrationName: e.target.value })} placeholder="Official Government Name" isInvalid={isMissing(formData.registrationName)} />
                  </div>
                  <div className="grid lg:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel required>Registration Number</FieldLabel>
                      <StyledInput value={formData.registrationNumber} onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })} placeholder="e.g. BN-X12345" isInvalid={isMissing(formData.registrationNumber)} />
                    </div>
                    <div>
                      <FieldLabel required>Country</FieldLabel>
                      <div className={cn("rounded-xl", isMissing(formData.country) && "ring-2 ring-red-300")}>
                        <CountrySelector value={formData.country} onChange={(v) => setFormData({ ...formData, country: v, place: v === "Other" ? "" : formData.place })} />
                      </div>
                    </div>
                  </div>
                  <TraLicenceUpload
                    file={traLicenceFile} preview={traLicencePreview}
                    onAdd={handleTraLicenceAdd} onRemove={handleTraLicenceRemove}
                    onReject={handleTraLicenceReject} isInvalid={showErrors && !traLicenceFile}
                  />
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 2 ══ */}
            {currentStep === 2 && (
              <SectionCard title="Location Details" subtitle="Where is your listing located?" icon={MapPin}>
                <div className="grid gap-5">
                  <div className="grid lg:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel required>Location Name</FieldLabel>
                      <StyledInput value={formData.locationName} onChange={(e) => setFormData({ ...formData, locationName: e.target.value })} placeholder="Area / Estate / Neighbourhood" isInvalid={isMissing(formData.locationName)} />
                    </div>
                    <div>
                      <FieldLabel required>{formData.country === "Other" ? "Region / City" : "County"}</FieldLabel>
                      <div className={cn("rounded-xl", isMissing(formData.place) && "ring-2 ring-red-300")}>
                        {formData.country === "Other"
                          ? <StyledInput value={formData.place} onChange={(e) => setFormData({ ...formData, place: e.target.value })} placeholder="e.g. Dar es Salaam" isInvalid={isMissing(formData.place)} />
                          : <CountySelector value={formData.place} onChange={(v) => setFormData({ ...formData, place: v })} />
                        }
                      </div>
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>Map Location</FieldLabel>
                    <p className="text-[11px] text-slate-400 mb-3">Paste a map link or capture your GPS coordinates</p>
                    <div className="flex gap-3 mb-4">
                      {locationModeOptions.map(({ mode, label, icon: Icon }) => (
                        <button key={mode} type="button" onClick={() => setLocationMode(mode)}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all ${locationMode === mode ? "text-white shadow-md" : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                          style={locationMode === mode ? { background: COLORS.TEAL } : {}}>
                          <Icon className="h-3.5 w-3.5" /> {label}
                        </button>
                      ))}
                    </div>
                    {locationMode === "link" && (
                      <StyledInput value={formData.locationLink} onChange={(e) => setFormData({ ...formData, locationLink: e.target.value })} placeholder="https://maps.google.com/..." />
                    )}
                    {locationMode === "gps" && (
                      <button type="button" onClick={getCurrentLocation}
                        className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-white text-sm font-bold transition-all active:scale-[0.98] shadow-md hover:opacity-90"
                        style={{ background: formData.latitude ? "#16a34a" : COLORS.KHAKI_DARK }}>
                        {formData.latitude
                          ? <><CheckCircle2 className="h-4 w-4" /> Location Captured — {formData.latitude.toFixed(4)}, {formData.longitude?.toFixed(4)}</>
                          : <><Navigation className="h-4 w-4" /> Tap to Capture GPS Location</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 3 ══ */}
            {currentStep === 3 && (
              <SectionCard title="Contact & About" subtitle="How visitors can reach you and your description" icon={CheckCircle2}>
                <div className="space-y-5">
                  <div className="grid lg:grid-cols-2 gap-5">
                    <div>
                      <FieldLabel>Business Email</FieldLabel>
                      <StyledInput type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="contact@business.com" />
                    </div>
                    <div>
                      <PhoneInput
                        value={formData.phoneNumber}
                        onChange={(v) => setFormData({ ...formData, phoneNumber: v })}
                        country={formData.country}
                        placeholder="712 345 678"
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>Description (max 20 words)</FieldLabel>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => {
                        const words = e.target.value.trim().split(/\s+/);
                        if (e.target.value.trim() === "" || words.length <= 20)
                          setFormData({ ...formData, description: e.target.value });
                      }}
                      placeholder="Describe your listing in 20 words or less..."
                      rows={4}
                      className={cn("rounded-xl border text-sm font-medium resize-none transition-all", isMissing(formData.description) ? "border-red-400 ring-2 ring-red-100 bg-red-50" : "border-slate-200 focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080]")}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">{formData.description.trim() ? formData.description.trim().split(/\s+/).length : 0}/20 words</p>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 4 ══ */}
            {currentStep === 4 && (
              <SectionCard title="Access & Pricing" subtitle="Operating hours and entrance fees" icon={Clock}>
                <div className="space-y-8">
                  <OperatingHoursSection
                    openingHours={formData.openingHours} closingHours={formData.closingHours}
                    workingDays={workingDays}
                    onOpeningChange={(v) => setFormData({ ...formData, openingHours: v })}
                    onClosingChange={(v) => setFormData({ ...formData, closingHours: v })}
                    onDaysChange={setWorkingDays} accentColor={COLORS.TEAL}
                  />
                  <div className="grid lg:grid-cols-3 gap-4">
                    <div>
                      <FieldLabel>Entrance Fee</FieldLabel>
                      <Select value={formData.entranceFeeType} onValueChange={(v) => setFormData({ ...formData, entranceFeeType: v })}>
                        <SelectTrigger className="rounded-xl h-11 font-semibold border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white rounded-xl">
                          <SelectItem value="free">Free Access</SelectItem>
                          <SelectItem value="paid">Paid Admission</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.entranceFeeType === "paid" && (
                      <>
                        <div>
                          <FieldLabel>Citizen — Adult Entry (KSh)</FieldLabel>
                          <StyledInput type="number" value={formData.adultPrice} onChange={(e) => setFormData({ ...formData, adultPrice: e.target.value })} />
                          {parseFloat(formData.adultPrice) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-1">{usdHint(parseFloat(formData.adultPrice))}</p>}
                        </div>
                        <div>
                          <FieldLabel>Citizen — Child Entry (KSh)</FieldLabel>
                          <StyledInput type="number" min="0" value={formData.childPrice} onChange={(e) => setFormData({ ...formData, childPrice: e.target.value })} />
                          {parseFloat(formData.childPrice) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-1">{usdHint(parseFloat(formData.childPrice))}</p>}
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── Non-Citizen Pricing ── */}
                  {formData.entranceFeeType === "paid" && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                            <Globe className="h-4 w-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800">Non-Citizen Pricing</p>
                            <p className="text-[11px] text-slate-500">Charge a different rate for international / non-citizen visitors</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, hasNonCitizenPricing: !formData.hasNonCitizenPricing })}
                          className={cn(
                            "relative w-11 h-6 rounded-full transition-all shrink-0",
                            formData.hasNonCitizenPricing ? "bg-amber-500" : "bg-slate-300"
                          )}
                        >
                          <span className={cn(
                            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                            formData.hasNonCitizenPricing && "translate-x-5"
                          )} />
                        </button>
                      </div>
                      {formData.hasNonCitizenPricing && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <FieldLabel>Non-Citizen — Adult Entry (KSh)</FieldLabel>
                            <StyledInput type="number" value={formData.nonCitizenAdultPrice} onChange={(e) => setFormData({ ...formData, nonCitizenAdultPrice: e.target.value })} placeholder="0" />
                            {parseFloat(formData.nonCitizenAdultPrice) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-1">{usdHint(parseFloat(formData.nonCitizenAdultPrice))}</p>}
                          </div>
                          <div>
                            <FieldLabel>Non-Citizen — Child Entry (KSh)</FieldLabel>
                            <StyledInput type="number" value={formData.nonCitizenChildPrice} onChange={(e) => setFormData({ ...formData, nonCitizenChildPrice: e.target.value })} placeholder="0" />
                            {parseFloat(formData.nonCitizenChildPrice) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-1">{usdHint(parseFloat(formData.nonCitizenChildPrice))}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 5 ══ */}
            {currentStep === 5 && (
              <SectionCard title="Amenities, Facilities & Activities" subtitle="What can guests enjoy at your listing?" icon={DollarSign}>
                <div className="space-y-8">
                  <GeneralFacilitiesSelector selected={generalFacilities} onChange={setGeneralFacilities} accentColor={COLORS.TEAL} />
                  <FacilityBuilder items={facilities} onChange={setFacilities} showErrors={showErrors} onValidationFail={onValidationFail} />
                  <ActivityBuilder items={activities} onChange={setActivities} showErrors={showErrors} onValidationFail={onValidationFail} />
                  <SpecialPriceBuilder items={specialPrices} onChange={setSpecialPrices} showErrors={showErrors} onValidationFail={onValidationFail} />
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 6 ══ */}
            {currentStep === 6 && (
              <SectionCard
                title={`Photo Gallery — ${galleryImages.length}/5 uploaded`}
                subtitle={galleryImages.length < 5 ? `You need ${5 - galleryImages.length} more photos to continue` : "All 5 photos ready ✓"}
                icon={Camera}
              >
                {galleryImages.length < 5 && showErrors && (
                  <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                    <span className="text-red-500">⚠</span>
                    <p className="text-red-600 text-xs font-semibold">Upload at least {5 - galleryImages.length} more photos</p>
                  </div>
                )}
                <ImageGalleryGrid images={galleryImages} previews={galleryPreviews} onRemove={removeGalleryImage} onAdd={handleGalleryUpload} isInvalid={showErrors && galleryImages.length < 5} slots={5} />
                <p className="text-[10px] text-slate-400 mt-3 font-medium">JPG or PNG only. First photo becomes your cover image.</p>
              </SectionCard>
            )}

            {/* ══ STEP 7 ══ */}
            {currentStep === 7 && (
              <ReviewStep
                type="adventure"
                accentColor={COLORS.TEAL}
                data={{
                  category,
                  name: formData.registrationName, registrationName: formData.registrationName,
                  registrationNumber: formData.registrationNumber,
                  locationName: formData.locationName, place: formData.place, country: formData.country,
                  description: formData.description, email: formData.email, phoneNumber: formData.phoneNumber,
                  openingHours: formData.openingHours, closingHours: formData.closingHours,
                  workingDays: Object.entries(workingDays).filter(([, v]) => v).map(([k]) => k),
                  entranceFeeType: formData.entranceFeeType, adultPrice: formData.adultPrice, childPrice: formData.childPrice,
                  // ── Non-citizen pricing passed to review ──
                  hasNonCitizenPricing: formData.hasNonCitizenPricing,
                  nonCitizenAdultPrice: formData.nonCitizenAdultPrice, nonCitizenChildPrice: formData.nonCitizenChildPrice,
                  latitude: formData.latitude, longitude: formData.longitude, generalFacilities,
                  facilities: facilities.filter((f) => f.saved).map((f) => ({ name: f.name, price: parseFloat(f.price) || 0, capacity: parseInt(f.capacity) || null, amenities: f.amenities, images: f.previewUrls })),
                  activities: activities.filter((a) => a.saved && a.name.trim()).map((a) => ({ name: a.name, price: parseFloat(a.price) || 0, images: a.previewUrls })),
                  // ── Special pricing tiers passed to review ──
                  specialPrices: specialPrices.filter((t) => t.saved && t.label.trim()).map((t) => ({
                    label: t.label,
                    citizenPrice: parseFloat(t.citizenPrice) || 0,
                    nonCitizenPrice: t.nonCitizenPrice ? (parseFloat(t.nonCitizenPrice) || 0) : 0,
                    requirement: t.requirement,
                  })),
                  galleryPreviewUrls: galleryPreviews,
                }}
                creatorEmail={user?.email}
              />
            )}

            {/* ── Navigation ── */}
            <div className="flex gap-3 pt-2">
              {currentStep > 1 && (
                <button type="button" onClick={handlePrev} className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
              )}
              {currentStep < 7 ? (
                <button type="button" onClick={handleNext} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-bold shadow-lg hover:opacity-90 transition-all active:scale-[0.99]" style={{ background: `linear-gradient(135deg, ${COLORS.TEAL}, #005f5f)` }}>
                  Continue to {STEP_NAMES[currentStep]} <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-bold shadow-lg hover:opacity-90 transition-all active:scale-[0.99] disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${COLORS.CORAL}, #e06040)` }}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : <><CheckCircle2 className="h-4 w-4" /> Submit for Approval</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default CreateAdventure;