import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Upload, X, Edit2, Save, Calendar, MapPin, Phone, Mail,
  DollarSign, Users, Clock, CheckCircle, Pencil, Plus, ArrowLeft,
  Image as ImageIcon, Navigation, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { approvalStatusSchema } from "@/lib/validation";
import { compressImages } from "@/lib/imageCompression";
import { FacilityActivityImageEditor } from "@/components/edit/FacilityActivityImageEditor";
import { GeneralFacilitiesSelector } from "@/components/creation/GeneralFacilitiesSelector";
import { useCurrency } from "@/contexts/CurrencyContext";

interface FacilityWithImages {
  name: string;
  price: number;
  capacity?: number;
  images?: string[];
  is_free?: boolean;
  amenities?: string[];
}

interface ActivityWithImages {
  name: string;
  price: number;
  images?: string[];
  is_free?: boolean;
}

interface Booking {
  id: string;
  guest_name_masked: string;
  guest_email_limited: string;
  guest_phone_limited: string;
  booking_type: string;
  total_amount: number;
  slots_booked: number;
  status: string;
  payment_status: string;
  created_at: string;
  booking_details: any;
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const EditListing = () => {
  const { formatPrice, usdHint } = useCurrency();
  const { itemType: type, id } = useParams<{ itemType: string; id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const goBack = useSafeBack("/my-listing");
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [approvalStatus, setApprovalStatus] = useState("");
  const [isHidden, setIsHidden] = useState(false);
  const [originalEmail, setOriginalEmail] = useState("");

  const urlParams = new URLSearchParams(window.location.search);
  const isResubmitting = urlParams.get("resubmit") === "true";

  const [editMode, setEditMode] = useState<Record<string, boolean>>({});

  // ─── CORE GATE ────────────────────────────────────────────────────────────
  // Starts false on every page load. Only flips to true when the host
  // successfully saves at least one field or photo via handleSaveField /
  // handleSaveImages. handleResubmit hard-blocks until this is true.
  const [hasMadeChanges, setHasMadeChanges] = useState(false);
  // ──────────────────────────────────────────────────────────────────────────

  // Common fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [openingHours, setOpeningHours] = useState("");
  const [closingHours, setClosingHours] = useState("");
  const [daysOpened, setDaysOpened] = useState<string[]>([]);

  // Type-specific fields
  const [date, setDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState(0);
  const [price, setPrice] = useState(0);
  const [priceChild, setPriceChild] = useState(0);
  const [entranceFeeType, setEntranceFeeType] = useState("free");
  const [entranceFee, setEntranceFee] = useState(0);
  const [entranceFeeChild, setEntranceFeeChild] = useState(0);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [generalFacilities, setGeneralFacilities] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<FacilityWithImages[]>([]);
  const [activities, setActivities] = useState<ActivityWithImages[]>([]);
  const [inclusions, setInclusions] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [newInclusion, setNewInclusion] = useState("");
  const [newExclusion, setNewExclusion] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");

  useEffect(() => {
    if (!user || !id || !type) { navigate("/"); return; }
    fetchListing();
    fetchBookings();
  }, [user, id, type]);

  // ─── TABLE HELPER ─────────────────────────────────────────────────────────
  const getTableForType = (): "hotels" | "adventure_places" | "trips" | null => {
    if (type === "hotel") return "hotels";
    if (type === "adventure") return "adventure_places";
    if (type === "trip") return "trips";
    return null;
  };

  // ─── FETCH ────────────────────────────────────────────────────────────────
  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("creator_booking_summary")
        .select("*")
        .eq("item_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBookings(data || []);
    } catch (e) {
      console.error("Error fetching bookings:", e);
    }
  };

  const fetchListing = async () => {
    try {
      const table = getTableForType();
      if (!table) {
        toast({ title: "Not Supported", description: "This listing type is not supported here.", variant: "destructive" });
        navigate("/become-host");
        return;
      }

      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", id!)
        .eq("created_by", user?.id!)
        .single();
      if (error) throw error;

      setName((data as any).name ?? "");
      setDescription((data as any).description ?? "");
      setLocation((data as any).location ?? "");
      setMapLink((data as any).map_link ?? (data as any).location_link ?? "");

      const fetchedEmail = (data as any).email ?? "";
      setEmail(fetchedEmail);
      setOriginalEmail(fetchedEmail);

      setExistingImages((data as any).gallery_images ?? (data as any).images ?? []);
      setOpeningHours((data as any).opening_hours ?? "");
      setClosingHours((data as any).closing_hours ?? "");
      setDaysOpened((data as any).days_opened ?? []);

      if (type === "trip") {
        setPhoneNumbers([(data as any).phone_number].filter(Boolean));
        setDate((data as any).date ?? "");
        setAvailableSlots((data as any).available_tickets ?? 0);
        setPrice((data as any).price ?? 0);
        setPriceChild((data as any).price_child ?? 0);
        setInclusions((data as any).inclusions ?? []);
        setExclusions((data as any).exclusions ?? []);
        setPickupLocation((data as any).pickup_location ?? "");
      } else {
        setPhoneNumbers((data as any).phone_numbers ?? []);
      }

      if (type === "hotel" || type === "adventure") {
        setFacilities((data as any).facilities ?? []);
        setActivities((data as any).activities ?? []);
      }

      if (type === "hotel") {
        setGeneralFacilities((data as any).amenities ?? []);
      }

      if (type === "adventure") {
        setEntranceFeeType((data as any).entry_fee_type ?? "free");
        setEntranceFee((data as any).entry_fee ?? 0);
        setEntranceFeeChild((data as any).child_entry_fee ?? 0);
        const raw = (data as any).amenities ?? [];
        const strings: string[] = Array.isArray(raw)
          ? raw.map((a: any) => (typeof a === "string" ? a : a.name ?? ""))
          : [];
        const { AVAILABLE_FACILITIES } = await import("@/components/creation/GeneralFacilitiesSelector");
        const facilityIds = AVAILABLE_FACILITIES.map((f) => f.id);
        setGeneralFacilities(strings.filter((a) => facilityIds.includes(a)));
        setAmenities(strings.filter((a) => !facilityIds.includes(a)));
      }

      setApprovalStatus((data as any).approval_status ?? "");
      setIsHidden((data as any).is_hidden ?? false);

      // Reset the change gate every time the listing is (re)loaded so a fresh
      // page visit always requires at least one real save before resubmitting.
      setHasMadeChanges(false);
    } catch (e) {
      console.error("Error fetching listing:", e);
      toast({ title: "Error", description: "Failed to load listing", variant: "destructive" });
      navigate("/become-host");
    } finally {
      setLoading(false);
    }
  };

  // ─── EDIT MODE ────────────────────────────────────────────────────────────
  const toggleEditMode = (field: string) =>
    setEditMode((prev) => ({ ...prev, [field]: !prev[field] }));

  // ─── IMAGES ───────────────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (existingImages.length + newImages.length + files.length > 10) {
      toast({ title: "Too many images", description: "Maximum 10 images allowed", variant: "destructive" });
      return;
    }
    try {
      const compressed = await compressImages(files);
      setNewImages((prev) => [...prev, ...compressed.map((c) => c.file)]);
    } catch {
      setNewImages((prev) => [...prev, ...files]);
    }
  };

  const removeExistingImage = (index: number) => {
    if (existingImages.length + newImages.length <= 1) {
      toast({ title: "Cannot remove", description: "At least one image is required", variant: "destructive" });
      return;
    }
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    if (existingImages.length + newImages.length <= 1) {
      toast({ title: "Cannot remove", description: "At least one image is required", variant: "destructive" });
      return;
    }
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveImages = async () => {
    setSaving(true);
    try {
      const uploaded: string[] = [];
      for (const file of newImages) {
        const ext = file.name.split(".").pop();
        const fileName = `${user?.id}-${Date.now()}-${Math.random()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from("listing-images")
          .getPublicUrl(fileName);
        uploaded.push(publicUrl);
      }

      const allImages = [...existingImages, ...uploaded];
      if (allImages.length < 1) {
        toast({ title: "Error", description: "At least one image is required", variant: "destructive" });
        return;
      }

      const table = getTableForType();
      if (!table) return;

      const { error } = await supabase
        .from(table)
        .update({ gallery_images: allImages, image_url: allImages[0], images: allImages })
        .eq("id", id!)
        .eq("created_by", user?.id!);
      if (error) throw error;

      setNewImages([]);
      // ✅ Mark that the host has saved a real change
      setHasMadeChanges(true);
      toast({ title: "Success", description: "Images updated successfully" });
      toggleEditMode("images");
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to update images", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── SAVE FIELD ───────────────────────────────────────────────────────────
  const handleSaveField = async (field: string) => {
    setSaving(true);
    try {
      const table = getTableForType();
      if (!table) {
        toast({ title: "Not Supported", description: "This listing type cannot be edited here.", variant: "destructive" });
        return;
      }

      let updateData: any = {};

      switch (field) {
        case "name":            updateData.name = name; break;
        case "description":     updateData.description = description; break;
        case "location":        updateData.location = location; break;
        case "mapLink":         updateData.map_link = mapLink; break;
        case "email":           updateData.email = email; break;
        case "phone":
          if (type === "trip") updateData.phone_number = phoneNumbers[0] ?? "";
          else updateData.phone_numbers = phoneNumbers.filter(Boolean);
          break;
        case "hours":
          updateData.opening_hours = openingHours;
          updateData.closing_hours = closingHours;
          updateData.days_opened = daysOpened;
          break;
        case "price":
          if (type === "trip") { updateData.price = price; updateData.price_child = priceChild; }
          break;
        case "slots":
          if (type === "trip") updateData.available_tickets = availableSlots;
          break;
        case "date":
          if (type === "trip") updateData.date = date;
          break;
        case "pickupLocation":
          if (type === "trip") updateData.pickup_location = pickupLocation;
          break;
        case "amenities":
        case "generalFacilities":
          updateData.amenities = [...generalFacilities, ...amenities.filter(Boolean)];
          break;
        case "facilities":      updateData.facilities = facilities; break;
        case "activities":      updateData.activities = activities; break;
        case "inclusions":
          if (type === "trip") updateData.inclusions = inclusions.filter(Boolean);
          break;
        case "exclusions":
          if (type === "trip") updateData.exclusions = exclusions.filter(Boolean);
          break;
        case "entranceFee":
          if (type === "adventure") {
            updateData.entry_fee_type = entranceFeeType;
            updateData.entry_fee = entranceFee;
            updateData.child_entry_fee = entranceFeeChild;
          }
          break;
      }

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq("id", id!)
        .eq("created_by", user?.id!);
      if (error) throw error;

      // ✅ Gate unlocked — host has saved at least one real change
      setHasMadeChanges(true);
      if (field === "email") setOriginalEmail(email);
      toast({ title: "Saved", description: "Changes saved successfully" });
      toggleEditMode(field);
    } catch (e) {
      console.error("Error saving:", e);
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── RESUBMIT ─────────────────────────────────────────────────────────────
  // Hard gate: no saved edit → no resubmission. Period.
  const handleResubmit = async () => {
    if (!hasMadeChanges) {
      toast({
        title: "No Changes Saved",
        description: "You must edit and save at least one field or photo before resubmitting.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const table = getTableForType();
      if (!table) {
        toast({ title: "Not Supported", description: "This listing type can't be re-submitted here.", variant: "destructive" });
        return;
      }

      const validatedStatus = approvalStatusSchema.parse("pending");
      const { error } = await supabase
        .from(table)
        .update({ approval_status: validatedStatus, approved_by: null, approved_at: null })
        .eq("id", id!)
        .eq("created_by", user?.id!);
      if (error) throw error;

      setApprovalStatus("pending");
      // Reset so the gate closes again in case the user stays on the page
      setHasMadeChanges(false);
      toast({ title: "Resubmitted", description: "Your listing has been sent for review" });
      navigate("/become-host");
    } catch (e) {
      console.error("Error resubmitting:", e);
      toast({ title: "Error", description: "Failed to resubmit listing", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  const addPhoneNumber = () => setPhoneNumbers((p) => [...p, ""]);
  const updatePhoneNumber = (i: number, v: string) => setPhoneNumbers((p) => { const u = [...p]; u[i] = v; return u; });
  const removePhoneNumber = (i: number) => setPhoneNumbers((p) => p.filter((_, idx) => idx !== i));
  const addFacility = () => setFacilities((p) => [...p, { name: "", price: 0, capacity: 1, images: [] }]);
  const removeFacility = (i: number) => setFacilities((p) => p.filter((_, idx) => idx !== i));
  const addActivity = () => setActivities((p) => [...p, { name: "", price: 0, images: [] }]);
  const removeActivity = (i: number) => setActivities((p) => p.filter((_, idx) => idx !== i));
  const toggleDay = (day: string) =>
    setDaysOpened((p) => p.includes(day) ? p.filter((d) => d !== day) : [...p, day]);

  // ─── EDIT BUTTON ──────────────────────────────────────────────────────────
  const EditButton = ({ field, onSave }: { field: string; onSave?: () => void }) => (
    <Button
      size="icon"
      variant={editMode[field] ? "default" : "ghost"}
      onClick={() => { if (editMode[field] && onSave) onSave(); else toggleEditMode(field); }}
      disabled={saving}
    >
      {editMode[field]
        ? (saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />)
        : <Edit2 className="h-4 w-4" />}
    </Button>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
      </div>
    );
  }

  const isRejected = approvalStatus === "rejected";

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20 md:pb-0">
      <Header />

      <main className="container px-4 py-8 mx-auto">
        <Button variant="ghost" onClick={goBack} className="mb-4 text-[#008080] hover:bg-[#008080]/10">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[10px] font-black text-[#FF7F50] uppercase tracking-[0.2em] mb-1">
                Manage Your Listing
              </p>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-[#008080]">
                Edit {type === "adventure" ? "Experience" : type === "trip" ? "Tour" : type}
              </h1>
              <p className="text-slate-500 text-sm">Click the edit icons to modify any detail</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={
                  approvalStatus === "approved" ? "default"
                  : approvalStatus === "pending" ? "secondary"
                  : "destructive"
                }
                className={approvalStatus === "approved" ? "bg-[#008080]" : ""}
              >
                {approvalStatus}
              </Badge>
              {isHidden && (
                <Badge variant="outline" className="bg-[#F0E68C]/20 text-[#857F3E] border-[#F0E68C]">
                  Hidden from Public View
                </Badge>
              )}
            </div>
          </div>

          {/* ── Resubmit Banner (rejected listings only) ── */}
          {isResubmitting && isRejected && (
            <div className="mt-4 p-4 bg-[#008080]/10 border border-[#008080]/30 rounded-xl space-y-3">
              {/* Step indicator */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {hasMadeChanges ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-[#008080] flex items-center justify-center">
                      <span className="text-[10px] font-black text-[#008080]">1</span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#008080]">
                    {hasMadeChanges ? "✓ Changes saved — ready to resubmit" : "Edit & save at least one field below"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {hasMadeChanges
                      ? "Your edits have been saved to the listing."
                      : "Click any pencil icon, make your change, then click the save icon. Only saved edits count."}
                  </p>
                </div>
              </div>

              {!hasMadeChanges && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700 font-medium">
                    Resubmission is locked until you save at least one edit above.
                  </p>
                </div>
              )}

              <Button
                onClick={handleResubmit}
                disabled={saving || !hasMadeChanges}
                className={`w-full sm:w-auto transition-all ${
                  hasMadeChanges
                    ? "bg-[#008080] hover:bg-[#006666] text-white"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {hasMadeChanges ? "Re-submit for Approval" : "Re-submit (save an edit first)"}
              </Button>
            </div>
          )}
        </div>

        {/* ── Images ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Images</h2>
            <EditButton field="images" onSave={handleSaveImages} />
          </div>
          {editMode.images ? (
            <div className="bg-card rounded-lg border p-4">
              <Label className="text-sm text-muted-foreground mb-2 block">
                Images ({existingImages.length + newImages.length}/10)
              </Label>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                {existingImages.map((img, idx) => (
                  <div key={`e-${idx}`} className="relative aspect-square">
                    <img src={img} alt="" loading="lazy" className="w-full h-full object-cover rounded-lg" />
                    <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6" onClick={() => removeExistingImage(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {newImages.map((file, idx) => (
                  <div key={`n-${idx}`} className="relative aspect-square">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover rounded-lg" />
                    <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6" onClick={() => removeNewImage(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {existingImages.length + newImages.length < 10 && (
                  <label className="border-2 border-dashed rounded-lg flex items-center justify-center aspect-square cursor-pointer hover:bg-secondary/50 transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
              {existingImages.slice(0, 6).map((img, idx) => (
                <div key={idx} className="aspect-square">
                  <img src={img} alt="" className="w-full h-full object-cover rounded-lg" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Field Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Name */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-[#FF7F50]" />
                <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Name</span>
              </div>
              <EditButton field="name" onSave={() => handleSaveField("name")} />
            </div>
            {editMode.name
              ? <Input value={name} onChange={(e) => setName(e.target.value)} className="border-[#008080]/30 focus:border-[#008080]" />
              : <p className="font-bold text-[#008080] truncate">{name}</p>}
          </div>

          {/* Location */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#FF7F50]" />
                <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Location</span>
              </div>
              <EditButton field="location" onSave={() => handleSaveField("location")} />
            </div>
            {editMode.location
              ? <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Enter location" className="border-[#008080]/30 focus:border-[#008080]" />
              : <p className="font-bold text-[#008080] truncate">{location || "Not set"}</p>}
          </div>

          {/* Pickup Location — trips only */}
          {type === "trip" && (
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-[#FF7F50]" />
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Pickup Location</span>
                </div>
                <EditButton field="pickupLocation" onSave={() => handleSaveField("pickupLocation")} />
              </div>
              {editMode.pickupLocation ? (
                <div>
                  <Input
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    placeholder="e.g. Nairobi CBD, Globe Cinema Roundabout"
                    className="border-[#008080]/30 focus:border-[#008080]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Where guests will be picked up</p>
                </div>
              ) : (
                <p className="font-bold text-[#008080] truncate">{pickupLocation || "Not set"}</p>
              )}
            </div>
          )}

          {/* Map Link */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#FF7F50]" />
                <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Map Link</span>
              </div>
              <EditButton field="mapLink" onSave={() => handleSaveField("mapLink")} />
            </div>
            {editMode.mapLink
              ? <Input value={mapLink} onChange={(e) => setMapLink(e.target.value)} placeholder="Google Maps link" className="border-[#008080]/30 focus:border-[#008080]" />
              : <p className="font-bold text-[#008080] truncate text-sm">{mapLink || "Not set"}</p>}
          </div>

          {/* Email */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#FF7F50]" />
                <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Email</span>
              </div>
              <EditButton field="email" onSave={() => handleSaveField("email")} />
            </div>
            {editMode.email
              ? <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Contact email" className="border-[#008080]/30 focus:border-[#008080]" />
              : <p className="font-bold text-[#008080] truncate">{email || "Not set"}</p>}
          </div>

          {/* Phone */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#FF7F50]" />
                <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Phone</span>
              </div>
              <EditButton field="phone" onSave={() => handleSaveField("phone")} />
            </div>
            {editMode.phone ? (
              <div className="space-y-2">
                {phoneNumbers.map((phone, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input value={phone} onChange={(e) => updatePhoneNumber(idx, e.target.value)} placeholder="Phone number" className="border-[#008080]/30 focus:border-[#008080] h-8" />
                    {phoneNumbers.length > 1 && (
                      <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => removePhoneNumber(idx)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {phoneNumbers.length < 3 && (
                  <Button size="sm" variant="outline" onClick={addPhoneNumber} className="w-full text-[#008080] border-[#008080]/30">
                    <Plus className="h-3 w-3 mr-1" /> Add Phone
                  </Button>
                )}
              </div>
            ) : (
              <>
                <p className="font-bold text-[#008080]">{phoneNumbers[0] || "Not set"}</p>
                {phoneNumbers.length > 1 && <p className="text-xs text-slate-400">+{phoneNumbers.length - 1} more</p>}
              </>
            )}
          </div>

          {/* Operating Hours — not for trips */}
          {type !== "trip" && (
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Hours</span>
                </div>
                <EditButton field="hours" onSave={() => handleSaveField("hours")} />
              </div>
              {editMode.hours ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Open</Label>
                      <Input type="time" value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Close</Label>
                      <Input type="time" value={closingHours} onChange={(e) => setClosingHours(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <Badge key={day} variant={daysOpened.includes(day) ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggleDay(day)}>
                        {day.slice(0, 3)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-medium">{openingHours && closingHours ? `${openingHours} - ${closingHours}` : "Not set"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{daysOpened.length > 0 ? daysOpened.map((d) => d.slice(0, 3)).join(", ") : "No days set"}</p>
                </>
              )}
            </div>
          )}

          {/* Trip: Date */}
          {type === "trip" && (
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#FF7F50]" />
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Date</span>
                </div>
                <EditButton field="date" onSave={() => handleSaveField("date")} />
              </div>
              {editMode.date
                ? <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-[#008080]/30 focus:border-[#008080] h-8" />
                : <p className="font-bold text-[#008080]">{date ? new Date(date).toLocaleDateString() : "Not set"}</p>}
            </div>
          )}

          {/* Trip: Pricing */}
          {type === "trip" && (
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-[#FF7F50]" />
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Pricing</span>
                </div>
                <EditButton field="price" onSave={() => handleSaveField("price")} />
              </div>
              {editMode.price ? (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-slate-500">Adult (KSh)</Label>
                    <Input type="number" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} min={0} className="h-8 border-[#008080]/30" />
                    {price > 0 && <p className="text-[9px] text-blue-500 font-bold mt-0.5">{usdHint(price)}</p>}
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Child (KSh)</Label>
                    <Input type="number" value={priceChild} onChange={(e) => setPriceChild(parseFloat(e.target.value) || 0)} min={0} className="h-8 border-[#008080]/30" />
                    {priceChild > 0 && <p className="text-[9px] text-blue-500 font-bold mt-0.5">{usdHint(priceChild)}</p>}
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-bold text-[#FF0000]">{formatPrice(price)}</p>
                  <p className="text-xs text-slate-500">Child: {formatPrice(priceChild)}</p>
                </>
              )}
            </div>
          )}

          {/* Trip: Tickets */}
          {type === "trip" && (
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#FF7F50]" />
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Tickets</span>
                </div>
                <EditButton field="slots" onSave={() => handleSaveField("slots")} />
              </div>
              {editMode.slots
                ? <Input type="number" value={availableSlots} onChange={(e) => setAvailableSlots(parseInt(e.target.value) || 0)} min={0} className="h-8 border-[#008080]/30" />
                : <p className="font-bold text-[#008080]">{availableSlots} tickets</p>}
            </div>
          )}

          {/* Entrance Fee — adventure only */}
          {type === "adventure" && (
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-[#FF7F50]" />
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Entry Fee</span>
                </div>
                <EditButton field="entranceFee" onSave={() => handleSaveField("entranceFee")} />
              </div>
              {editMode.entranceFee ? (
                <div className="space-y-2">
                  <Select value={entranceFeeType} onValueChange={setEntranceFeeType}>
                    <SelectTrigger className="h-8 border-[#008080]/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                  {entranceFeeType === "paid" && (
                    <>
                      <div>
                        <Label className="text-xs text-slate-500">Adult (KSh)</Label>
                        <Input type="number" value={entranceFee} onChange={(e) => setEntranceFee(parseFloat(e.target.value) || 0)} min={0} className="h-8 border-[#008080]/30" />
                        {entranceFee > 0 && <p className="text-[9px] text-blue-500 font-bold mt-0.5">{usdHint(entranceFee)}</p>}
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Child (KSh)</Label>
                        <Input type="number" value={entranceFeeChild} onChange={(e) => setEntranceFeeChild(parseFloat(e.target.value) || 0)} min={0} className="h-8 border-[#008080]/30" />
                        {entranceFeeChild > 0 && <p className="text-[9px] text-blue-500 font-bold mt-0.5">{usdHint(entranceFeeChild)}</p>}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <p className="font-bold text-[#008080] capitalize">{entranceFeeType === "free" ? "Free" : `Adult: ${formatPrice(entranceFee)}`}</p>
                  {entranceFeeType === "paid" && <p className="text-xs text-slate-500">Child: {formatPrice(entranceFeeChild)}</p>}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Description ── */}
        <div className="mt-6 bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Description</h2>
            <EditButton field="description" onSave={() => handleSaveField("description")} />
          </div>
          {editMode.description
            ? <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Enter description..." />
            : <p className="text-sm text-muted-foreground">{description || "No description"}</p>}
        </div>

        {/* ── Inclusions & Exclusions ── */}
        {type === "trip" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* Inclusions */}
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Inclusions</span>
                </div>
                <EditButton field="inclusions" onSave={() => handleSaveField("inclusions")} />
              </div>
              {editMode.inclusions ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={newInclusion}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.endsWith(",") || val.endsWith(".")) {
                          const item = val.slice(0, -1).trim();
                          if (item) { setInclusions((p) => [...p, item]); setNewInclusion(""); }
                        } else setNewInclusion(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newInclusion.trim()) { setInclusions((p) => [...p, newInclusion.trim()]); setNewInclusion(""); }
                        }
                      }}
                      placeholder="Type & press Enter or comma"
                      className="border-[#008080]/30 focus:border-[#008080] h-8"
                    />
                    <Button size="sm" onClick={() => { if (newInclusion.trim()) { setInclusions((p) => [...p, newInclusion.trim()]); setNewInclusion(""); } }} className="bg-[#008080] h-8">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {inclusions.map((item, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                        ✓ {item}
                        <button onClick={() => setInclusions((p) => p.filter((_, idx) => idx !== i))} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {inclusions.length > 0
                    ? inclusions.map((item, i) => <Badge key={i} variant="secondary" className="text-xs bg-emerald-50 text-emerald-700">✓ {item}</Badge>)
                    : <p className="text-sm text-muted-foreground">None</p>}
                </div>
              )}
            </div>

            {/* Exclusions */}
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Exclusions</span>
                </div>
                <EditButton field="exclusions" onSave={() => handleSaveField("exclusions")} />
              </div>
              {editMode.exclusions ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={newExclusion}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.endsWith(",") || val.endsWith(".")) {
                          const item = val.slice(0, -1).trim();
                          if (item) { setExclusions((p) => [...p, item]); setNewExclusion(""); }
                        } else setNewExclusion(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newExclusion.trim()) { setExclusions((p) => [...p, newExclusion.trim()]); setNewExclusion(""); }
                        }
                      }}
                      placeholder="Type & press Enter or comma"
                      className="border-[#008080]/30 focus:border-[#008080] h-8"
                    />
                    <Button size="sm" onClick={() => { if (newExclusion.trim()) { setExclusions((p) => [...p, newExclusion.trim()]); setNewExclusion(""); } }} className="bg-slate-600 h-8">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {exclusions.map((item, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold border border-red-200">
                        ✗ {item}
                        <button onClick={() => setExclusions((p) => p.filter((_, idx) => idx !== i))} className="hover:text-red-800"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {exclusions.length > 0
                    ? exclusions.map((item, i) => <Badge key={i} variant="secondary" className="text-xs bg-red-50 text-red-600">✗ {item}</Badge>)
                    : <p className="text-sm text-muted-foreground">None</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Facilities & Activities ── */}
        {(type === "hotel" || type === "adventure") && (
          <div className="grid grid-cols-1 gap-4 mt-6">
            {/* General Facilities */}
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">General Facilities (Icons)</h3>
                <EditButton field="generalFacilities" onSave={() => handleSaveField("generalFacilities")} />
              </div>
              {editMode.generalFacilities ? (
                <GeneralFacilitiesSelector selected={generalFacilities} onChange={setGeneralFacilities} maxSelection={6} accentColor="#008080" />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {generalFacilities.length > 0
                    ? generalFacilities.map((fid, idx) => <Badge key={idx} variant="secondary" className="text-xs">{fid.replace(/_/g, " ")}</Badge>)
                    : <p className="text-sm text-muted-foreground">None</p>}
                </div>
              )}
            </div>

            {/* Facilities & Images */}
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-[#FF7F50]" />
                  <h3 className="font-medium">Facilities & Images</h3>
                </div>
                <EditButton field="facilities" onSave={() => handleSaveField("facilities")} />
              </div>
              {editMode.facilities ? (
                <FacilityActivityImageEditor
                  type="facility"
                  items={facilities}
                  onChange={(items) => setFacilities(items as FacilityWithImages[])}
                  userId={user?.id || ""}
                  onSave={() => handleSaveField("facilities")}
                  isSaving={saving}
                  accentColor="#008080"
                />
              ) : (
                <div className="space-y-3">
                  {facilities.length > 0 ? facilities.map((f, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-sm">{f.name}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{f.price === 0 ? "Free" : formatPrice(f.price)}</span>
                      </div>
                      {f.images && f.images.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto">
                          {f.images.map((img, i) => (
                            <div key={i} className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden">
                              <img src={img} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                      {f.capacity && <p className="text-[10px] text-muted-foreground mt-1">Capacity: {f.capacity}</p>}
                    </div>
                  )) : <p className="text-sm text-muted-foreground">None</p>}
                </div>
              )}
            </div>

            {/* Activities & Images */}
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-[#008080]" />
                  <h3 className="font-medium">Activities & Images</h3>
                </div>
                <EditButton field="activities" onSave={() => handleSaveField("activities")} />
              </div>
              {editMode.activities ? (
                <FacilityActivityImageEditor
                  type="activity"
                  items={activities}
                  onChange={(items) => setActivities(items as ActivityWithImages[])}
                  userId={user?.id || ""}
                  onSave={() => handleSaveField("activities")}
                  isSaving={saving}
                  accentColor="#FF7F50"
                />
              ) : (
                <div className="space-y-3">
                  {activities.length > 0 ? activities.map((a, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-sm">{a.name}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">{a.price === 0 ? "Free" : formatPrice(a.price)}</span>
                      </div>
                      {a.images && a.images.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto">
                          {a.images.map((img, i) => (
                            <div key={i} className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden">
                              <img src={img} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )) : <p className="text-sm text-muted-foreground">None</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Bookings ── */}
        <div className="mt-6 bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Bookings ({bookings.length})</h3>
          </div>
          {bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No bookings yet</p>
          ) : (
            <div className="space-y-2">
              {bookings.slice(0, 3).map((booking) => (
                <div key={booking.id} className="border rounded p-2 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium truncate">{booking.guest_name_masked}</span>
                    <Badge variant={booking.payment_status === "completed" ? "default" : "secondary"} className="text-xs">
                      {booking.payment_status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatPrice(booking.total_amount)}</p>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(`/host/bookings/${type}/${id}`)}>
                See All Bookings
              </Button>
            </div>
          )}
        </div>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default EditListing;