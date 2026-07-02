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

// ─── Listing Category (Hotel / Campsite / Accommodation) ──────────────────────
const CATEGORY_OPTIONS: { value: string; label: string; icon: any }[] = [
  { value: "hotel", label: "Hotel", icon: Building2 },
  { value: "accommodation", label: "Accommodation", icon: Home },
  { value: "campsite", label: "Campsite", icon: Tent },
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
interface SpecialPriceTier {
  id: string; label: string; citizenPrice: string; nonCitizenPrice: string; requirement: string; saved: boolean;
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

// ─── Category Selector ────────────────────────────────────────────────────────
const CategorySelector = ({
  value, onChange, isInvalid,
}: { value: string; onChange: (v: string) => void; isInvalid?: boolean }) => (
  <div>
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 p-1 rounded-xl", isInvalid && "ring-2 ring-red-300")}>
      {CATEGORY_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 h-20 rounded-xl text-[11px] font-bold border transition-all",
              isActive ? "text-white shadow-md border-transparent scale-[1.02]" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            )}
            style={isActive ? { background: COLORS.TEAL } : {}}
          >
            <opt.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-400")} />
            {opt.label}
          </button>
        );
      })}
    </div>
    {isInvalid && <p className="text-red-400 text-[10px] font-semibold mt-1.5">Please select a category to continue</p>}
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
              <button type="button" onClick={() => onRemove} className="flex items-center gap-1.5 text-[11px] font-bold text-red-500 border border-red-200 bg-white rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">
                <X className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#008080,#00b3b3)" }} />
        </div>
      ) : (
        <label className={cn(
          "flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all py-10 px-6 group",
          isInvalid ? "border-red-300 bg-red-50/40 hover:bg-red-50" : "border-slate-200 bg-slate-50/50 hover:border-teal-400 hover:bg-teal-50/30"
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

// ─── Special Pricing Tier Builder ─────────────────────────────────────────────
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
export const ActivityBuilder = ({ items, onChange, showErrors, onValidationFail }: {
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
    if (a.images.length < 1) { onValidationFail("Please add at least 1 photo for this activity."); return; }
    update(a.id, { saved: true });
  };

  return (
    <div className="space-y-4">
      <FieldLabel>Activities (Optional)</FieldLabel>
      {items.map((item) => (
        <div key={item.id} className={cn("rounded-xl border overflow-hidden transition-all", item.saved ? "border-teal-200 bg-teal-50/20" : "border-slate-200 bg-white")}>
          {item.saved ? (
            <div className="p-4 flex items-center gap-4">
              <div className="flex gap-2 shrink-0">
                {item.previewUrls.slice(0, 2).map((url, i) => (
                  <img key={i} src={url} className="w-12 h-12 rounded-xl object-cover border border-slate-200" alt="" />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 truncate">{item.name}</p>
                {item.price && <p className="text-[11px] font-semibold text-slate-500">Price: KSh {item.price} <span className="text-blue-500">{usdHint(parseFloat(item.price))}</span></p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => update(item.id, { saved: false })} className="text-[11px] font-bold uppercase tracking-wide text-teal-600 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-50 transition-colors">Edit</button>
                <button type="button" onClick={() => removeItem(item.id)} className="text-[11px] font-bold uppercase tracking-wide text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">Remove</button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <FieldLabel required>Activity Name</FieldLabel>
                  <StyledInput value={item.name} onChange={(e) => update(item.id, { name: e.target.value })} placeholder="e.g. Guided Hiking Tour" isInvalid={showErrors && !item.name.trim()} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Price (KSh) — Optional</FieldLabel>
                  <StyledInput type="number" value={item.price} onChange={(e) => update(item.id, { price: e.target.value })} placeholder="0 (Leave blank if free)" />
                  {item.price && parseFloat(item.price) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-0.5">{usdHint(parseFloat(item.price))}</p>}
                </div>
              </div>
              <div>
                <FieldLabel required>
                  Activity Photos (min 1){showErrors && item.images.length < 1 && <span className="text-red-400 text-[10px] normal-case font-normal"> — at least 1 photo required</span>}
                </FieldLabel>
                <ImageGalleryGrid images={item.images} previews={item.previewUrls} onRemove={(i) => removeImage(item.id, i, item.images)} onAdd={(files) => handleImages(item.id, files, item.images)} isInvalid={showErrors && item.images.length < 1} slots={3} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => saveItem(item)} className="flex-1 h-10 rounded-xl text-white text-[12px] font-bold hover:opacity-90 transition-all bg-[#008080]">Save Activity</button>
                <button type="button" onClick={() => removeItem(item.id)} className="h-10 px-4 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"><X className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addItem} className="w-full h-11 rounded-xl text-[11px] font-bold uppercase tracking-wide border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#008080] hover:text-[#008080] transition-all flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> Add Activity
      </button>
    </div>
  );
};