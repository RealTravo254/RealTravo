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
  BedDouble, ChevronLeft, ChevronRight, Link2, ShieldCheck, FileImage, Upload, Star,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { compressImages } from "@/lib/imageCompression";
import { ReviewStep } from "@/components/creation/ReviewStep";
import { GeneralFacilitiesSelector } from "@/components/creation/GeneralFacilitiesSelector";
import { CreateFormStepper } from "@/components/creation/CreateFormStepper";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

/**
 * ── DB requirements for CreateHotel ──────────────────────────────────────
 * Hotels are saved to the same `adventure_places` table with category = 'hotel'.
 * Room types are stored in the existing `facilities` jsonb column.
 * Check-in / check-out times reuse `opening_hours` / `closing_hours`.
 * Run once if these columns don't exist yet:
 *
 *   alter table public.adventure_places
 *     add column if not exists division_id uuid references public.country_divisions(id),
 *     add column if not exists registration_type text not null default 'company',
 *     add column if not exists star_rating int,
 *     add column if not exists cancellation_policy text;
 * ────────────────────────────────────────────────────────────────────────── */

// ─── Constants & helpers ──────────────────────────────────────────────────────
const COLORS = { TEAL: "#008080", CORAL: "#FF7F50", KHAKI: "#F0E68C", KHAKI_DARK: "#857F3E" };
let _idCounter = 0;
const makeId = () => `room-${Date.now()}-${++_idCounter}`;
const generateFriendlySlug = (name: string): string => {
  const clean = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").substring(0, 30);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${clean}-${code}`;
};
const safeObjectUrl = (file: File): string => { try { return URL.createObjectURL(file); } catch { return ""; } };
const isImageFile = (file: File) => file.type.startsWith("image/");
const namesClash = (a: string, b: string) => !!a.trim() && !!b.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();

const STEP_NAMES = ["Registration", "Location", "Contact & About", "Stay Details", "Rooms", "Gallery", "Review"];
const CHECK_TIMES = ["00:00","01:00","02:00","03:00","04:00","05:00","06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00"];
const BED_TYPES = ["Single", "Double", "Queen", "King", "Twin", "Bunk"];

interface RoomItem {
  id: string; name: string; bedType: string; price: string; capacity: string; quantity: string;
  amenities: string[]; amenityInput: string; images: File[]; previewUrls: string[]; saved: boolean;
}
interface DivisionOption { id: string; name: string }

const emptyRoom = (): RoomItem => ({
  id: makeId(), name: "", bedType: "Double", price: "", capacity: "", quantity: "1",
  amenities: [], amenityInput: "", images: [], previewUrls: [], saved: false,
});

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
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

const CompressingBanner = ({ label = "Compressing photos…" }: { label?: string }) => (
  <div className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-xl">
    <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
    <p className="text-teal-700 text-xs font-semibold">{label}</p>
  </div>
);

// ─── Star rating picker ───────────────────────────────────────────────────────
const StarRatingPicker = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex items-center gap-1.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" onClick={() => onChange(value === n ? 0 : n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}
        className="p-1 rounded-lg hover:bg-slate-50 transition-colors">
        <Star className="h-6 w-6 transition-colors" style={n <= value ? { color: COLORS.CORAL, fill: COLORS.CORAL } : { color: "#cbd5e1" }} />
      </button>
    ))}
    <span className="ml-2 text-[11px] text-slate-400 font-medium">{value ? `${value}-star` : "Unrated"}</span>
  </div>
);

// ─── Image grid ───────────────────────────────────────────────────────────────
const ImageGalleryGrid = ({ previews, onRemove, onAdd, isInvalid, slots = 5 }: {
  previews: string[]; onRemove: (i: number) => void; onAdd: (files: FileList | null) => void; isInvalid?: boolean; slots?: number;
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
          <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
        </label>
      );
    })}
  </div>
);

// ─── Business licence upload ──────────────────────────────────────────────────
const LicenceUpload = ({ file, preview, onAdd, onRemove, onReject, isInvalid, isCompressing }: {
  file: File | null; preview: string; onAdd: (f: File) => void; onRemove: () => void;
  onReject: (reason: string) => void; isInvalid?: boolean; isCompressing?: boolean;
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    e.target.value = "";
    if (!isImageFile(picked)) {
      onReject(picked.type === "application/pdf"
        ? "PDFs are not supported. Please upload a JPG or PNG photo of your licence."
        : "Only JPG and PNG images are accepted for the licence.");
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

      {isCompressing && <CompressingBanner label="Compressing licence image…" />}

      {preview ? (
        <div className={`rounded-2xl overflow-hidden border-2 ${isInvalid ? "border-red-300" : "border-teal-200"}`} style={{ background: "linear-gradient(135deg,#f0fdfa,#e6fffa)" }}>
          <div className="flex items-center gap-4 p-4">
            <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-teal-200 shadow-md">
              <img src={preview} alt="Licence" className="w-full h-full object-cover" />
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
                <input type="file" className="hidden" accept="image/*" onChange={handleChange} />
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
          isInvalid ? "border-red-300 bg-red-50/40 hover:bg-red-50" : "border-slate-200 bg-slate-50/50 hover:border-teal-400 hover:bg-teal-50/30"
        )}>
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all", isInvalid ? "bg-red-100" : "bg-slate-100 group-hover:bg-teal-100")}>
            <FileImage className={cn("h-6 w-6", isInvalid ? "text-red-400" : "text-slate-400 group-hover:text-teal-600")} />
          </div>
          <div className="text-center">
            <p className={cn("text-sm font-bold mb-0.5", isInvalid ? "text-red-500" : "text-slate-600 group-hover:text-teal-700")}>
              {isInvalid ? "TRA Licence is required" : "Upload TRA Licence"}
            </p>
            <p className="text-[11px] text-slate-400">JPG or PNG only</p>
          </div>
          <div className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold", isInvalid ? "bg-red-500 text-white" : "bg-[#008080] text-white group-hover:bg-[#005f5f]")}>
            <Upload className="h-3.5 w-3.5" /> Choose Image
          </div>
          <input type="file" className="hidden" accept="image/*" onChange={handleChange} />
        </label>
      )}

      <div className="mt-3 flex items-start gap-2 px-1">
        <Info className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
        <p className="text-[10px] text-slate-400 leading-relaxed">Your licence is used for verification only and will not be publicly visible.</p>
      </div>
    </div>
  );
};

// ─── Amenity tag input ────────────────────────────────────────────────────────
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
        if (e.key === "," || e.key === "Enter") { e.preventDefault(); onAdd(); }
        if (e.key === "Backspace" && !input && tags.length > 0) onRemove(tags.length - 1);
      }}
      onBlur={onAdd}
      placeholder={tags.length === 0 ? "e.g. Wi-Fi, en-suite bathroom, press comma..." : "Add more..."}
      className="flex-1 min-w-[120px] text-sm font-medium outline-none bg-transparent placeholder:text-slate-300 placeholder:font-normal"
    />
  </div>
);

// ─── Room builder ─────────────────────────────────────────────────────────────
const RoomBuilder = ({ items, onChange, showErrors, onValidationFail }: {
  items: RoomItem[]; onChange: (items: RoomItem[]) => void; showErrors: boolean; onValidationFail: (msg: string) => void;
}) => {
  const { usdHint } = useCurrency();
  const [compressingIds, setCompressingIds] = useState<Set<string>>(new Set());
  const update = (id: string, patch: Partial<RoomItem>) => onChange(items.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addItem = () => onChange([...items, emptyRoom()]);
  const removeItem = (id: string) => onChange(items.filter((r) => r.id !== id));

  const addAmenityTag = (item: RoomItem) => {
    const val = item.amenityInput.replace(/,/g, "").trim();
    if (!val) return;
    update(item.id, { amenities: [...item.amenities, val], amenityInput: "" });
  };
  const removeAmenityTag = (item: RoomItem, idx: number) => update(item.id, { amenities: item.amenities.filter((_, i) => i !== idx) });

  const setCompressing = (id: string, value: boolean) =>
    setCompressingIds((prev) => { const next = new Set(prev); value ? next.add(id) : next.delete(id); return next; });

  const handleImages = async (id: string, fileList: FileList | null, existing: File[]) => {
    if (!fileList || fileList.length === 0) return;
    const slots = 5 - existing.length;
    if (slots <= 0) return;
    const incoming = Array.from(fileList).slice(0, slots);
    if (incoming.some((f) => !isImageFile(f))) { onValidationFail("Only image files (JPG, PNG) are accepted."); return; }
    setCompressing(id, true);
    let merged: File[];
    try { const c = await compressImages(incoming); merged = [...existing, ...c.map((x) => x.file)].slice(0, 5); }
    catch { merged = [...existing, ...incoming].slice(0, 5); }
    finally { setCompressing(id, false); }
    update(id, { images: merged, previewUrls: merged.map(safeObjectUrl) });
  };

  const removeImage = (id: string, idx: number, existing: File[]) => {
    const updated = existing.filter((_, i) => i !== idx);
    update(id, { images: updated, previewUrls: updated.map(safeObjectUrl) });
  };

  const saveItem = (r: RoomItem) => {
    if (!r.name.trim()) { onValidationFail("Please enter a room type name (e.g. Deluxe Double)."); return; }
    if (!r.price.trim() || parseFloat(r.price) <= 0) { onValidationFail("Please enter a price per night greater than 0."); return; }
    if (!r.capacity.trim()) { onValidationFail("Please enter how many guests the room sleeps."); return; }
    if (!r.quantity.trim() || parseInt(r.quantity, 10) < 1) { onValidationFail("Please enter how many rooms of this type you have."); return; }
    if (r.amenities.length === 0) { onValidationFail("Please add at least one room amenity."); return; }
    if (r.images.length < 2) { onValidationFail("Please add at least 2 photos for this room type."); return; }
    update(r.id, { saved: true });
  };

  return (
    <div className="space-y-4">
      <FieldLabel>Room types (with photos)</FieldLabel>
      {items.map((item) => (
        <div key={item.id} className={cn("rounded-xl border overflow-hidden transition-all", item.saved ? "border-[#FF7F50]/30 bg-[#FF7F50]/5" : "border-slate-200 bg-white")}>
          {item.saved ? (
            <div className="p-4 flex items-center gap-4">
              <div className="flex gap-2 shrink-0">
                {item.previewUrls.slice(0, 3).map((url, i) => url
                  ? <img key={i} src={url} className="w-12 h-12 rounded-xl object-cover border border-slate-200" alt="" />
                  : <div key={i} className="w-12 h-12 rounded-xl bg-slate-200" />)}
                {item.previewUrls.length > 3 && (
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">+{item.previewUrls.length - 3}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 truncate">{item.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{item.bedType} bed · sleeps {item.capacity} · {item.quantity} room{item.quantity === "1" ? "" : "s"}</p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: COLORS.CORAL }}>
                  KSh {item.price} / night <span className="text-blue-500">{usdHint(parseFloat(item.price) || 0)}</span>
                </p>
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
                  <FieldLabel required>Room type</FieldLabel>
                  <StyledInput value={item.name} onChange={(e) => update(item.id, { name: e.target.value })} placeholder="e.g. Deluxe Double" isInvalid={showErrors && !item.name.trim()} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Bed type</FieldLabel>
                  <Select value={item.bedType} onValueChange={(v) => update(item.id, { bedType: v })}>
                    <SelectTrigger className="rounded-xl h-11 font-semibold border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white rounded-xl">
                      {BED_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <FieldLabel required>Price / night (KSh)</FieldLabel>
                  <StyledInput type="number" min={0} value={item.price} onChange={(e) => update(item.id, { price: e.target.value })} placeholder="0" isInvalid={showErrors && (!item.price.trim() || parseFloat(item.price) <= 0)} />
                  {parseFloat(item.price) > 0 && <p className="text-[9px] text-blue-500 font-semibold mt-0.5">{usdHint(parseFloat(item.price))}</p>}
                </div>
                <div className="space-y-1">
                  <FieldLabel required>Sleeps (guests)</FieldLabel>
                  <StyledInput type="number" min={1} value={item.capacity} onChange={(e) => update(item.id, { capacity: e.target.value.replace(/[^0-9]/g, "") })} placeholder="e.g. 2" isInvalid={showErrors && !item.capacity.trim()} />
                </div>
                <div className="space-y-1">
                  <FieldLabel required>Rooms available</FieldLabel>
                  <StyledInput type="number" min={1} value={item.quantity} onChange={(e) => update(item.id, { quantity: e.target.value.replace(/[^0-9]/g, "") })} placeholder="e.g. 10" isInvalid={showErrors && (!item.quantity.trim() || parseInt(item.quantity, 10) < 1)} />
                </div>
              </div>
              <div className="space-y-1">
                <FieldLabel required>
                  Room amenities{showErrors && item.amenities.length === 0 && <span className="text-red-400 text-[10px] normal-case font-normal"> — at least one required</span>}
                </FieldLabel>
                <AmenityTagInput tags={item.amenities} input={item.amenityInput} onInputChange={(v) => update(item.id, { amenityInput: v })} onAdd={() => addAmenityTag(item)} onRemove={(i) => removeAmenityTag(item, i)} hasError={showErrors && item.amenities.length === 0} />
              </div>
              <div>
                <FieldLabel required>
                  Photos (min 2, max 5){showErrors && item.images.length < 2 && <span className="text-red-400 text-[10px] normal-case font-normal"> — at least 2 required</span>}
                </FieldLabel>
                {compressingIds.has(item.id) && <CompressingBanner />}
                <ImageGalleryGrid previews={item.previewUrls} onRemove={(i) => removeImage(item.id, i, item.images)} onAdd={(files) => handleImages(item.id, files, item.images)} isInvalid={showErrors && item.images.length < 2} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => saveItem(item)} className="flex-1 h-10 rounded-xl text-white text-[12px] font-bold hover:opacity-90 transition-all" style={{ background: `linear-gradient(135deg, ${COLORS.CORAL}, #e06040)` }}>Save Room Type</button>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(item.id)} className="h-10 px-4 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"><X className="h-4 w-4" /></button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addItem} className="w-full h-11 rounded-xl text-[11px] font-bold uppercase tracking-wide border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#FF7F50] hover:text-[#FF7F50] transition-all flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> Add Room Type
      </button>
    </div>
  );
};

// ─── Step sidebar ─────────────────────────────────────────────────────────────
const StepSidebar = ({ steps, currentStep, onStepClick }: { steps: { name: string; isComplete: boolean }[]; currentStep: number; onStepClick?: (i: number) => void }) => (
  <aside className="hidden lg:flex flex-col w-72 shrink-0 sticky top-24 self-start">
    <div className="rounded-2xl overflow-hidden mb-6 relative h-44">
      <img src="/images/category-hotel.webp" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/images/category-campsite.webp"; }} className="w-full h-full object-cover" alt="" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute bottom-4 left-5 right-5">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS.KHAKI }}>Hotel & Stay</span>
        <h2 className="text-white text-xl font-black uppercase tracking-tight leading-tight mt-0.5">Create Hotel</h2>
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
          const isPast = currentStep > num;
          const isDone = step.isComplete && isPast;
          return (
            <li key={i}>
              <button type="button" onClick={() => isPast && onStepClick?.(num)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${isActive ? "bg-[#008080] text-white shadow-md" : isPast ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"}`}>
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
      <p className="text-xs text-slate-400 leading-relaxed">Fill each step carefully. Your hotel will be reviewed before going live.</p>
    </div>
  </aside>
);

// ─── Main component ───────────────────────────────────────────────────────────
const CreateHotel = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack("/become-host");
  const { toast } = useToast();
  const { user } = useAuth();
  useBanCheck();

  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    registrationName: "", registrationNumber: "", locationName: "", place: "",
    country: "", description: "", email: "", phoneNumber: "",
    checkInTime: "14:00", checkOutTime: "11:00", cancellationPolicy: "",
    starRating: 0,
    latitude: null as number | null, longitude: null as number | null, locationLink: "",
  });

  const [traLicenceFile, setTraLicenceFile] = useState<File | null>(null);
  const [traLicencePreview, setTraLicencePreview] = useState("");
  const [isCompressingLicence, setIsCompressingLicence] = useState(false);
  const [locationMode, setLocationMode] = useState<"link" | "gps" | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [generalFacilities, setGeneralFacilities] = useState<string[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>(() => [emptyRoom()]);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [isCompressingGallery, setIsCompressingGallery] = useState(false);

  const [availableDivisions, setAvailableDivisions] = useState<DivisionOption[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  const onValidationFail = useCallback((msg: string) => toast({ title: "Required", description: msg, variant: "destructive" }), [toast]);

  // ── Auth guard + country pre-fill ──
  useEffect(() => {
    if (!user) {
      toast({ title: "Login Required", description: "You must be logged in to host a listing.", variant: "destructive" });
      navigate("/login");
      return;
    }
    supabase.from("profiles").select("country").eq("id", user.id).single().then(({ data }) => {
      if (data?.country) setFormData((p) => ({ ...p, country: data.country }));
    });
  }, [user, navigate, toast]);

  // ── Load divisions when country changes ──
  useEffect(() => {
    let cancelled = false;
    setSelectedDivisionId(null);
    if (!formData.country || formData.country === "Other") { setAvailableDivisions([]); return; }

    setLoadingDivisions(true);
    (async () => {
      const { data: countryRow } = await supabase.from("countries").select("id").ilike("name", formData.country).maybeSingle();
      if (cancelled) return;
      if (!countryRow) { setAvailableDivisions([]); setLoadingDivisions(false); return; }
      const { data: rows } = await supabase.from("country_divisions").select("id, name").eq("country_id", countryRow.id).order("name", { ascending: true });
      if (cancelled) return;
      setAvailableDivisions(rows || []);
      setLoadingDivisions(false);
    })();
    return () => { cancelled = true; };
  }, [formData.country]);

  // Keep `place` in sync with the chosen division (other parts of the app read `place`)
  useEffect(() => {
    if (!selectedDivisionId) return;
    const d = availableDivisions.find((x) => x.id === selectedDivisionId);
    if (d) setFormData((p) => ({ ...p, place: d.name }));
  }, [selectedDivisionId, availableDivisions]);

  // ── Licence handlers ──
  const handleLicenceAdd = async (file: File) => {
    setIsCompressingLicence(true);
    try {
      const [c] = await compressImages([file]);
      setTraLicenceFile(c.file); setTraLicencePreview(safeObjectUrl(c.file));
    } catch {
      setTraLicenceFile(file); setTraLicencePreview(safeObjectUrl(file));
    } finally { setIsCompressingLicence(false); }
  };
  const handleLicenceRemove = () => { setTraLicenceFile(null); setTraLicencePreview(""); };
  const handleLicenceReject = (reason: string) => toast({ title: "File type not supported", description: reason, variant: "destructive" });

  const getRegistrationNumberError = (): string | null => {
    if (!formData.registrationNumber.trim()) return "Please enter your business registration number.";
    if (namesClash(formData.registrationName, formData.registrationNumber)) return "Your registration number can't be the same as your hotel name.";
    return null;
  };

  const isStep1Complete = !!formData.registrationName.trim() && !getRegistrationNumberError() && !!formData.country && !!traLicenceFile;
  const isStep2Complete = !!formData.locationName.trim() && (!!formData.latitude || !!formData.locationLink.trim());
  const isStep3Complete = !!formData.description.trim();
  const isStep4Complete = true;
  const isStep5Complete = rooms.length > 0 && rooms.every((r) => r.saved);
  const isStep6Complete = galleryImages.length >= 5;

  const steps = [
    { name: STEP_NAMES[0], isComplete: isStep1Complete },
    { name: STEP_NAMES[1], isComplete: isStep2Complete },
    { name: STEP_NAMES[2], isComplete: isStep3Complete },
    { name: STEP_NAMES[3], isComplete: isStep4Complete },
    { name: STEP_NAMES[4], isComplete: isStep5Complete },
    { name: STEP_NAMES[5], isComplete: isStep6Complete },
    { name: STEP_NAMES[6], isComplete: isStep1Complete && isStep2Complete && isStep3Complete && isStep5Complete && isStep6Complete },
  ];

  const isMissing = (v: any) => {
    if (!showErrors) return false;
    if (typeof v === "string") return !v.trim();
    return v === null || v === undefined;
  };

  const validateCurrentStep = (): boolean => {
    const fail = (title: string, description: string) => {
      setShowErrors(true);
      toast({ title, description, variant: "destructive" });
      return false;
    };
    if (currentStep === 1) {
      if (!formData.registrationName.trim() || !formData.country) return fail("Complete this step", "Fill all required fields");
      const regError = getRegistrationNumberError();
      if (regError) return fail("Registration Number Required", regError);
      if (!traLicenceFile) return fail("TRA Licence Required", "Please upload a JPG or PNG photo of your TRA licence to continue.");
    } else if (currentStep === 2) {
      if (!formData.locationName.trim() || (!formData.latitude && !formData.locationLink.trim()))
        return fail("Complete this step", "Fill location and provide a link or GPS");
    } else if (currentStep === 3) {
      if (!formData.description.trim()) return fail("Complete this step", "Description is required");
    } else if (currentStep === 5) {
      if (rooms.length === 0) return fail("Add a room type", "Add at least one room type to continue");
      if (rooms.some((r) => !r.saved)) return fail("Unsaved Room", "Please save all room types");
    } else if (currentStep === 6) {
      if (galleryImages.length < 5) return fail("Photos Required", `Upload ${5 - galleryImages.length} more photos`);
    }
    return true;
  };

  const handleNext = () => {
    // Auto-save rooms that are complete but weren't explicitly saved
    setRooms((prev) => prev.map((r) => {
      if (r.saved) return r;
      let next = { ...r };
      if (r.amenityInput.trim()) {
        next = { ...next, amenities: [...next.amenities, r.amenityInput.replace(/,/g, "").trim()], amenityInput: "" };
      }
      if (next.name.trim() && parseFloat(next.price) > 0 && next.capacity.trim() && parseInt(next.quantity, 10) >= 1 && next.amenities.length > 0 && next.images.length >= 2) next.saved = true;
      return next;
    }));
    // NOTE: validateCurrentStep reads the pre-update `rooms` state, so on step 5 an auto-saved
    // room may need a second click. Hosts are guided to press "Save Room Type" first.
    if (!validateCurrentStep()) return;
    setShowErrors(false);
    setCurrentStep((p) => Math.min(p + 1, 7));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrev = () => {
    setShowErrors(false);
    setCurrentStep((p) => Math.max(p - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getCurrentLocation = () => {
    if (!("geolocation" in navigator)) return;
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setFormData((p) => ({ ...p, latitude: coords.latitude, longitude: coords.longitude }));
        toast({ title: "Location captured", description: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` });
        setIsGettingLocation(false);
      },
      () => {
        toast({ title: "GPS Error", description: "Could not get location.", variant: "destructive" });
        setIsGettingLocation(false);
      }
    );
  };

  const handleGalleryUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const slots = 5 - galleryImages.length;
    if (slots <= 0) return;
    const incoming = Array.from(files).slice(0, slots);
    if (incoming.some((f) => !isImageFile(f))) {
      toast({ title: "File type not supported", description: "Only JPG and PNG images are accepted.", variant: "destructive" });
      return;
    }
    setIsCompressingGallery(true);
    let merged: File[];
    try { const c = await compressImages(incoming); merged = [...galleryImages, ...c.map((x) => x.file)].slice(0, 5); }
    catch { merged = [...galleryImages, ...incoming].slice(0, 5); }
    finally { setIsCompressingGallery(false); }
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

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) { navigate("/login"); return; }
    setShowErrors(true);
    if (!isStep1Complete || !isStep2Complete || !isStep3Complete || galleryImages.length < 5) {
      toast({ title: "Action Required", description: "Please complete all steps including licence upload and 5 gallery photos.", variant: "destructive" });
      return;
    }
    if (rooms.length === 0 || rooms.some((r) => !r.saved)) {
      toast({ title: "Rooms Required", description: "Please add and save at least one room type.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const friendlySlug = generateFriendlySlug(formData.registrationName);
      const licenceUrl = traLicenceFile ? await uploadFile(traLicenceFile, "tra-licence") : "";
      const galleryUrls = await Promise.all(galleryImages.map((f) => uploadFile(f, "gallery")));
      const roomsForDB = await Promise.all(
        rooms.map(async (r) => ({
          name: r.name,
          bed_type: r.bedType,
          amenities: r.amenities,
          capacity: parseInt(r.capacity, 10) || 0,
          quantity: parseInt(r.quantity, 10) || 1,
          price: parseFloat(r.price) || 0,
          images: await Promise.all(r.images.map((f) => uploadFile(f, "room"))),
        }))
      );

      // Hotel account rule (one hotel per account) is enforced by the DB trigger;
      // any violation surfaces through the catch below.
      const { error } = await supabase.from("adventure_places").insert([{
        id: friendlySlug, slug: friendlySlug, name: formData.registrationName,
        category: "hotel",
        registration_number: formData.registrationNumber,
        registration_type: "company",
        tra_license_url: licenceUrl,
        location: formData.locationName, place: formData.place, country: formData.country,
        division_id: selectedDivisionId,
        description: formData.description, email: formData.email,
        phone_numbers: formData.phoneNumber ? [formData.phoneNumber] : [],
        map_link: formData.latitude
          ? `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`
          : (formData.locationLink || ""),
        latitude: formData.latitude, longitude: formData.longitude,
        // Check-in / check-out reuse the opening/closing columns; hotels are open every day
        opening_hours: formData.checkInTime, closing_hours: formData.checkOutTime,
        days_opened: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        image_url: galleryUrls[0] ?? "", gallery_images: galleryUrls,
        // Hotels have no entrance fee — pricing lives on each room type
        entry_fee_type: "free", entry_fee: 0, child_entry_fee: 0,
        has_non_citizen_pricing: false, non_citizen_entry_fee: 0, non_citizen_child_entry_fee: 0,
        special_entry_prices: [],
        star_rating: formData.starRating || null,
        cancellation_policy: formData.cancellationPolicy.trim() || null,
        amenities: generalFacilities, facilities: roomsForDB, activities: [],
        created_by: user.id,
        approval_status: "pending",
      }]);
      if (error) throw error;

      await supabase.from("host_verifications").upsert(
        { user_id: user.id, hosting_category: "adventure", status: "pending" },
        { onConflict: "user_id" }
      );

      toast({ title: "Hotel Submitted", description: `Ref: ${friendlySlug} — Pending admin review.`, duration: 5000 });
      navigate("/become-host");
    } catch (err: any) {
      toast({ title: "Submission Error", description: err?.message ?? "Something went wrong.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const locationModeOptions: { mode: "link" | "gps"; label: string; icon: React.ElementType }[] = [
    { mode: "link", label: "Paste Map Link", icon: Link2 },
    { mode: "gps", label: "Use My GPS", icon: Navigation },
  ];

  const wordCount = formData.description.trim() ? formData.description.trim().split(/\s+/).length : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />

      {/* Mobile hero */}
      <div className="lg:hidden relative h-36 overflow-hidden bg-slate-900">
        <img src="/images/category-hotel.webp" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/images/category-campsite.webp"; }} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-5">
          <Button onClick={goBack} className="absolute top-4 left-4 rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">
            Create <span style={{ color: COLORS.KHAKI }}>Hotel</span>
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
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((currentStep - 1) / (STEP_NAMES.length - 1)) * 100}%`, background: COLORS.TEAL }} />
                </div>
                <span className="text-xs font-bold text-slate-400">{Math.round(((currentStep - 1) / (STEP_NAMES.length - 1)) * 100)}%</span>
              </div>
            </div>

            <div className="lg:hidden"><CreateFormStepper steps={steps} currentStep={currentStep} /></div>

            {/* ══ STEP 1 — Registration ══ */}
            {currentStep === 1 && (
              <SectionCard title="Registration Details" subtitle="Official business registration information" icon={Info}>
                <div className="grid gap-5">
                  <div>
                    <FieldLabel required>Hotel / Business Name</FieldLabel>
                    <StyledInput
                      value={formData.registrationName}
                      onChange={(e) => setFormData({ ...formData, registrationName: e.target.value })}
                      placeholder="Official registered name"
                      isInvalid={isMissing(formData.registrationName) || (showErrors && namesClash(formData.registrationName, formData.registrationNumber))}
                    />
                  </div>
                  <div className="grid lg:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel required>Business Registration Number</FieldLabel>
                      <StyledInput
                        value={formData.registrationNumber}
                        onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                        placeholder="e.g. BN-X12345"
                        isInvalid={showErrors && !!getRegistrationNumberError()}
                      />
                      {showErrors && getRegistrationNumberError() && (
                        <p className="text-red-400 text-[10px] font-semibold mt-1">{getRegistrationNumberError()}</p>
                      )}
                    </div>
                    <div>
                      <FieldLabel required>Country</FieldLabel>
                      <div className={cn("rounded-xl", isMissing(formData.country) && "ring-2 ring-red-300")}>
                        <CountrySelector value={formData.country} onChange={(v) => setFormData({ ...formData, country: v, place: v === "Other" ? "" : formData.place })} />
                      </div>
                    </div>
                  </div>

                  {(availableDivisions.length > 0 || loadingDivisions) && (
                    <div>
                      <FieldLabel>Division / Region (optional)</FieldLabel>
                      <Select value={selectedDivisionId ?? undefined} onValueChange={setSelectedDivisionId} disabled={loadingDivisions}>
                        <SelectTrigger className="h-11 rounded-xl border-slate-200 text-sm font-medium">
                          <SelectValue placeholder={loadingDivisions ? "Loading divisions…" : "Select a division"} />
                        </SelectTrigger>
                        <SelectContent className="bg-white rounded-xl">
                          {availableDivisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-slate-400 mt-1">Helps guests find this hotel when browsing by region on the home page.</p>
                    </div>
                  )}

                  <LicenceUpload
                    file={traLicenceFile} preview={traLicencePreview}
                    onAdd={handleLicenceAdd} onRemove={handleLicenceRemove} onReject={handleLicenceReject}
                    isInvalid={showErrors && !traLicenceFile} isCompressing={isCompressingLicence}
                  />
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 2 — Location ══ */}
            {currentStep === 2 && (
              <SectionCard title="Location Details" subtitle="Where is your hotel located?" icon={MapPin}>
                <div className="grid gap-5">
                  <div>
                    <FieldLabel required>Location Name</FieldLabel>
                    <StyledInput value={formData.locationName} onChange={(e) => setFormData({ ...formData, locationName: e.target.value })} placeholder="Town / Area / Estate" isInvalid={isMissing(formData.locationName)} />
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
                      <button type="button" onClick={getCurrentLocation} disabled={isGettingLocation}
                        className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-white text-sm font-bold transition-all active:scale-[0.98] shadow-md hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
                        style={{ background: formData.latitude ? "#16a34a" : COLORS.KHAKI_DARK }}>
                        {isGettingLocation
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Getting Location...</>
                          : formData.latitude
                          ? <><CheckCircle2 className="h-4 w-4" /> Location Captured — {formData.latitude.toFixed(4)}, {formData.longitude?.toFixed(4)}</>
                          : <><Navigation className="h-4 w-4" /> Tap to Capture GPS Location</>}
                      </button>
                    )}
                  </div>
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 3 — Contact & About ══ */}
            {currentStep === 3 && (
              <SectionCard title="Contact & About" subtitle="How guests can reach you and a short description" icon={CheckCircle2}>
                <div className="space-y-5">
                  <div className="grid lg:grid-cols-2 gap-5">
                    <div>
                      <FieldLabel>Business Email</FieldLabel>
                      <StyledInput type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="reservations@hotel.com" />
                    </div>
                    <div>
                      <PhoneInput value={formData.phoneNumber} onChange={(v) => setFormData({ ...formData, phoneNumber: v })} country={formData.country} placeholder="712 345 678" />
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>Description (max 20 words)</FieldLabel>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => {
                        const words = e.target.value.trim().split(/\s+/);
                        if (e.target.value.trim() === "" || words.length <= 20) setFormData({ ...formData, description: e.target.value });
                      }}
                      placeholder="Describe your hotel in 20 words or less..."
                      rows={4}
                      className={cn("rounded-xl border text-sm font-medium resize-none transition-all", isMissing(formData.description) ? "border-red-400 ring-2 ring-red-100 bg-red-50" : "border-slate-200 focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080]")}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">{wordCount}/20 words</p>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 4 — Stay Details ══ */}
            {currentStep === 4 && (
              <SectionCard title="Stay Details" subtitle="Star rating, check-in times, policy and hotel amenities" icon={Clock}>
                <div className="space-y-8">
                  <div>
                    <FieldLabel>Star rating (optional)</FieldLabel>
                    <StarRatingPicker value={formData.starRating} onChange={(v) => setFormData({ ...formData, starRating: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div>
                      <FieldLabel>Check-in from</FieldLabel>
                      <Select value={formData.checkInTime} onValueChange={(v) => setFormData({ ...formData, checkInTime: v })}>
                        <SelectTrigger className="rounded-xl h-11 font-semibold border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white rounded-xl max-h-64">
                          {CHECK_TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>Check-out by</FieldLabel>
                      <Select value={formData.checkOutTime} onValueChange={(v) => setFormData({ ...formData, checkOutTime: v })}>
                        <SelectTrigger className="rounded-xl h-11 font-semibold border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white rounded-xl max-h-64">
                          {CHECK_TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Cancellation policy (optional)</FieldLabel>
                    <Textarea
                      value={formData.cancellationPolicy}
                      onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                      placeholder="e.g. Free cancellation up to 48 hours before check-in."
                      rows={3}
                      className="rounded-xl border border-slate-200 text-sm font-medium resize-none focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080]"
                    />
                  </div>
                  <GeneralFacilitiesSelector selected={generalFacilities} onChange={setGeneralFacilities} accentColor={COLORS.TEAL} />
                </div>
              </SectionCard>
            )}

            {/* ══ STEP 5 — Rooms ══ */}
            {currentStep === 5 && (
              <SectionCard title="Rooms" subtitle="Add each room type with its nightly price and photos" icon={BedDouble}>
                <RoomBuilder items={rooms} onChange={setRooms} showErrors={showErrors} onValidationFail={onValidationFail} />
              </SectionCard>
            )}

            {/* ══ STEP 6 — Gallery ══ */}
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
                {isCompressingGallery && <CompressingBanner />}
                <ImageGalleryGrid previews={galleryPreviews} onRemove={removeGalleryImage} onAdd={handleGalleryUpload} isInvalid={showErrors && galleryImages.length < 5} />
                <p className="text-[10px] text-slate-400 mt-3 font-medium">JPG or PNG only. First photo becomes your cover image.</p>
              </SectionCard>
            )}

            {/* ══ STEP 7 — Review ══ */}
            {currentStep === 7 && (
              <ReviewStep
                type="adventure"
                accentColor={COLORS.TEAL}
                data={{
                  category: "hotel",
                  name: formData.registrationName, registrationName: formData.registrationName,
                  registrationNumber: formData.registrationNumber,
                  locationName: formData.locationName, place: formData.place, country: formData.country,
                  description: formData.description, email: formData.email, phoneNumber: formData.phoneNumber,
                  openingHours: formData.checkInTime, closingHours: formData.checkOutTime,
                  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                  entranceFeeType: "free", adultPrice: "0", childPrice: "0",
                  hasNonCitizenPricing: false, nonCitizenAdultPrice: "0", nonCitizenChildPrice: "0",
                  latitude: formData.latitude, longitude: formData.longitude, generalFacilities,
                  facilities: rooms.filter((r) => r.saved).map((r) => ({
                    name: r.name, price: parseFloat(r.price) || 0, capacity: parseInt(r.capacity, 10) || null,
                    amenities: r.amenities, images: r.previewUrls,
                  })),
                  activities: [],
                  specialPrices: [],
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

export default CreateHotel;