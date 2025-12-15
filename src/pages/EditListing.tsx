import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { Loader2, Upload, X, Edit2, Save, Calendar, MapPin, Phone, Mail, DollarSign, Users, Clock, CheckCircle, XCircle, Pencil, Plus, Trash2, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { approvalStatusSchema } from "@/lib/validation";
import { EmailVerification } from "@/components/creation/EmailVerification";
import { compressImages } from "@/lib/imageCompression";

interface Facility {
  name: string;
  price: number;
  capacity?: number;
}

interface Activity {
  name: string;
  price: number;
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
  const { itemType: type, id } = useParams<{ itemType: string; id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [approvalStatus, setApprovalStatus] = useState("");
  const [isHidden, setIsHidden] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [originalEmail, setOriginalEmail] = useState("");
  
  // Check if user is re-submitting
  const urlParams = new URLSearchParams(window.location.search);
  const isResubmitting = urlParams.get("resubmit") === "true";
  
  // Edit states
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  
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
  const [amenities, setAmenities] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (!user || !id || !type) {
      navigate("/");
      return;
    }
    fetchListing();
    fetchBookings();
  }, [user, id, type]);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("creator_booking_summary")
        .select("*")
        .eq("item_id", id!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const fetchListing = async () => {
    try {
      let table: "hotels" | "adventure_places" | "trips" = "hotels";
      if (type === "hotel") table = "hotels";
      else if (type === "adventure") table = "adventure_places";
      else if (type === "trip") table = "trips";
      else if (type === "attraction") {
        // Attractions table doesn't exist
        toast({
          title: "Not Supported",
          description: "Attractions are not supported",
          variant: "destructive",
        });
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

      // Common fields
      setName((data as any).name as string);
      setDescription(((data as any).description as string) || "");
      
      // Location handling - attractions use location_name
      if (type === "attraction") {
        setLocation(((data as any).location_name as string) || "");
      } else {
        setLocation(((data as any).location as string) || "");
      }
      
      setMapLink(((data as any).map_link || (data as any).location_link as string) || "");
      const fetchedEmail = ((data as any).email as string) || "";
      setEmail(fetchedEmail);
      setOriginalEmail(fetchedEmail);
      // If email exists, mark as verified (existing email is already trusted)
      if (fetchedEmail) {
        setEmailVerified(true);
      }
      
      // Images handling
      if (type === "attraction") {
        setExistingImages(((data as any).photo_urls as string[]) || []);
      } else {
        setExistingImages(((data as any).gallery_images as string[]) || ((data as any).images as string[]) || []);
      }
      
      setOpeningHours(((data as any).opening_hours as string) || "");
      setClosingHours(((data as any).closing_hours as string) || "");
      setDaysOpened(((data as any).days_opened as string[]) || []);
      
      // Phone numbers
      if (type === "trip") {
        setPhoneNumbers([((data as any).phone_number as string)].filter(Boolean));
      } else if (type === "attraction") {
        setPhoneNumbers([((data as any).phone_number as string)].filter(Boolean));
      } else {
        setPhoneNumbers(((data as any).phone_numbers as string[]) || []);
      }

      // Type-specific fields
      if (type === 'trip') {
        setDate((data as any).date || '');
        setAvailableSlots((data as any).available_tickets || 0);
        setPrice((data as any).price || 0);
        setPriceChild((data as any).price_child || 0);
      }

      if (type === 'hotel' || type === 'adventure') {
        setFacilities((data as any).facilities || []);
        setActivities((data as any).activities || []);
      }

      if (type === 'hotel') {
        setAmenities(((data as any).amenities as string[]) || []);
      }

      if (type === 'adventure') {
        setEntranceFeeType((data as any).entry_fee_type || "free");
        setEntranceFee((data as any).entry_fee || 0);
        // Handle amenities - could be string[] or object array in jsonb
        const adventureAmenities = (data as any).amenities || [];
        setAmenities(Array.isArray(adventureAmenities) 
          ? adventureAmenities.map((a: any) => typeof a === 'string' ? a : a.name || '')
          : []);
      }
      
      if (type === 'attraction') {
        setEntranceFeeType((data as any).entrance_type || "free");
        setEntranceFee((data as any).price_adult || 0);
        setFacilities((data as any).facilities || []);
        setActivities((data as any).activities || []);
        // Handle amenities - could be string[] or object array in jsonb
        const attractionAmenities = (data as any).amenities || [];
        setAmenities(Array.isArray(attractionAmenities) 
          ? attractionAmenities.map((a: any) => typeof a === 'string' ? a : a.name || '')
          : []);
      }
      
      // Set approval status and hidden state
      setApprovalStatus((data as any).approval_status || "");
      setIsHidden((data as any).is_hidden || false);
      
    } catch (error) {
      console.error("Error fetching listing:", error);
      toast({
        title: "Error",
        description: "Failed to load listing",
        variant: "destructive",
      });
      navigate("/become-host");
    } finally {
      setLoading(false);
    }
  };

  const toggleEditMode = (field: string) => {
    setEditMode({ ...editMode, [field]: !editMode[field] });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (existingImages.length + newImages.length + files.length > 10) {
        toast({
          title: "Too many images",
          description: "You can upload a maximum of 10 images",
          variant: "destructive",
        });
        return;
      }
      
      try {
        // Compress images before adding
        const compressed = await compressImages(files);
        setNewImages([...newImages, ...compressed.map(c => c.file)]);
      } catch (error) {
        console.error("Error compressing images:", error);
        // Fall back to original files if compression fails
        setNewImages([...newImages, ...files]);
      }
    }
  };

  const removeExistingImage = (index: number) => {
    if (existingImages.length + newImages.length <= 1) {
      toast({
        title: "Cannot remove image",
        description: "At least one image is required",
        variant: "destructive",
      });
      return;
    }
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    if (existingImages.length + newImages.length <= 1) {
      toast({
        title: "Cannot remove image",
        description: "At least one image is required",
        variant: "destructive",
      });
      return;
    }
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const addPhoneNumber = () => {
    setPhoneNumbers([...phoneNumbers, ""]);
  };

  const updatePhoneNumber = (index: number, value: string) => {
    const updated = [...phoneNumbers];
    updated[index] = value;
    setPhoneNumbers(updated);
  };

  const removePhoneNumber = (index: number) => {
    setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index));
  };

  const addAmenity = () => {
    setAmenities([...amenities, ""]);
  };

  const updateAmenity = (index: number, value: string) => {
    const updated = [...amenities];
    updated[index] = value;
    setAmenities(updated);
  };

  const removeAmenity = (index: number) => {
    setAmenities(amenities.filter((_, i) => i !== index));
  };

  const addFacility = () => {
    setFacilities([...facilities, { name: "", price: 0, capacity: 1 }]);
  };

  const updateFacility = (index: number, field: keyof Facility, value: string | number) => {
    const updated = [...facilities];
    updated[index] = { ...updated[index], [field]: value };
    setFacilities(updated);
  };

  const removeFacility = (index: number) => {
    setFacilities(facilities.filter((_, i) => i !== index));
  };

  const addActivity = () => {
    setActivities([...activities, { name: "", price: 0 }]);
  };

  const updateActivity = (index: number, field: keyof Activity, value: string | number) => {
    const updated = [...activities];
    updated[index] = { ...updated[index], [field]: value };
    setActivities(updated);
  };

  const removeActivity = (index: number) => {
    setActivities(activities.filter((_, i) => i !== index));
  };

  const toggleDay = (day: string) => {
    if (daysOpened.includes(day)) {
      setDaysOpened(daysOpened.filter(d => d !== day));
    } else {
      setDaysOpened([...daysOpened, day]);
    }
  };

  const handleResubmit = async () => {
    setSaving(true);
    try {
      let table: "hotels" | "adventure_places" | "trips" | "attractions" = "hotels";
      if (!table) return;

      // Validate approval_status before update
      const validatedStatus = approvalStatusSchema.parse("pending");

      const { error } = await supabase
        .from(table)
        .update({ approval_status: validatedStatus })
        .eq("id", id!)
        .eq("created_by", user?.id!);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your listing has been re-submitted for approval",
      });

      navigate("/become-host");
    } catch (error) {
      console.error("Error re-submitting:", error);
      toast({
        title: "Error",
        description: "Failed to re-submit listing",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveField = async (field: string) => {
    setSaving(true);
    try {
      let table: "hotels" | "adventure_places" | "trips" = "hotels";
      if (type === "hotel") table = "hotels";
      else if (type === "adventure") table = "adventure_places";
      else if (type === "trip") table = "trips";
      else if (type === "attraction") {
        // Attractions table doesn't exist
        toast({
          title: "Not Supported",
          description: "Attractions are not supported",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      let updateData: any = {};

      // Map field to update data
      switch (field) {
        case "description":
          updateData.description = description;
          break;
        case "location":
          updateData.location = location;
          break;
        case "mapLink":
          updateData.map_link = mapLink;
          break;
        case "email":
          // Verify email if changed and not yet verified
          if (email !== originalEmail && !emailVerified) {
            toast({
              title: "Email Verification Required",
              description: "Please verify your new email address before saving",
              variant: "destructive"
            });
            setSaving(false);
            return;
          }
          updateData.email = email;
          break;
        case "phone":
          if (type === "trip" || type === "attraction") {
            updateData.phone_number = phoneNumbers[0] || "";
          } else {
            updateData.phone_numbers = phoneNumbers.filter(Boolean);
          }
          break;
        case "hours":
          updateData.opening_hours = openingHours;
          updateData.closing_hours = closingHours;
          updateData.days_opened = daysOpened;
          break;
        case "price":
          if (type === "trip") {
            updateData.price = price;
            updateData.price_child = priceChild;
          }
          break;
        case "slots":
          if (type === "trip") {
            updateData.available_tickets = availableSlots;
          }
          break;
        case "date":
          if (type === "trip") {
            updateData.date = date;
          }
          break;
        case "amenities":
          updateData.amenities = amenities.filter(Boolean);
          break;
        case "facilities":
          updateData.facilities = facilities;
          break;
        case "activities":
          updateData.activities = activities;
          break;
        case "entranceFee":
          if (type === "adventure") {
            updateData.entry_fee_type = entranceFeeType;
            updateData.entry_fee = entranceFee;
          } else if (type === "attraction") {
            updateData.entrance_type = entranceFeeType;
            updateData.price_adult = entranceFee;
          }
          break;
      }

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq("id", id!)
        .eq("created_by", user?.id!);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Changes saved successfully",
      });

      // Update original email after successful save
      if (field === "email") {
        setOriginalEmail(email);
      }

      toggleEditMode(field);
    } catch (error) {
      console.error("Error saving:", error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveImages = async () => {
    setSaving(true);
    try {
      let uploadedImageUrls: string[] = [];

      for (const file of newImages) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user?.id}-${Date.now()}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("listing-images")
          .getPublicUrl(fileName);

        uploadedImageUrls.push(publicUrl);
      }

      const allImages = [...existingImages, ...uploadedImageUrls];
      
      // Validate minimum one image
      if (allImages.length < 1) {
        toast({
          title: "Error",
          description: "At least one image is required",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      let table: "hotels" | "adventure_places" | "trips" = "hotels";
      if (type === "hotel") table = "hotels";
      else if (type === "adventure") table = "adventure_places";
      else if (type === "trip") table = "trips";
      else if (type === "attraction") {
        // Attractions table doesn't exist
        toast({
          title: "Not Supported",
          description: "Attractions are not supported",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      let updateData: any = {
        gallery_images: allImages,
        image_url: allImages[0] || existingImages[0],
        images: allImages,
      };

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq("id", id!)
        .eq("created_by", user?.id!);

      if (error) throw error;

      setNewImages([]);
      toast({
        title: "Success",
        description: "Images updated successfully",
      });

      toggleEditMode("images");
    } catch (error) {
      console.error("Error saving images:", error);
      toast({
        title: "Error",
        description: "Failed to update images",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const EditButton = ({ field, onSave }: { field: string; onSave?: () => void }) => (
    <Button
      size="icon"
      variant={editMode[field] ? "default" : "ghost"}
      onClick={() => {
        if (editMode[field] && onSave) {
          onSave();
        } else {
          toggleEditMode(field);
        }
      }}
      disabled={saving}
    >
      {editMode[field] ? (
        saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />
      ) : (
        <Edit2 className="h-4 w-4" />
      )}
    </Button>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-8 max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Edit {type === 'adventure' ? 'Experience' : type === 'trip' ? 'Tour' : type}</h1>
              <p className="text-muted-foreground">Click the edit icons to modify any detail</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={approvalStatus === 'approved' ? 'default' : approvalStatus === 'pending' ? 'secondary' : 'destructive'}>
                {approvalStatus}
              </Badge>
              {isHidden && (
                <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                  Hidden from Public View
                </Badge>
              )}
            </div>
          </div>
          
          {isResubmitting && approvalStatus === 'rejected' && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                Make your desired changes, then click the button below to re-submit your listing for approval.
              </p>
              <Button onClick={handleResubmit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Re-submit for Approval
              </Button>
            </div>
          )}
        </div>

        {/* Images Section - Full Width */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Images</h2>
            <EditButton field="images" onSave={handleSaveImages} />
          </div>
          {editMode.images ? (
            <div className="bg-card rounded-lg border p-4">
              <Label className="text-sm text-muted-foreground mb-2 block">Images ({existingImages.length + newImages.length}/10)</Label>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                {existingImages.map((img, idx) => (
                  <div key={`existing-${idx}`} className="relative aspect-square">
                    <img src={img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover rounded-lg" />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => removeExistingImage(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {newImages.map((file, idx) => (
                  <div key={`new-${idx}`} className="relative aspect-square">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover rounded-lg" />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => removeNewImage(idx)}
                    >
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

        {/* Grid Layout for Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Name */}
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Pencil className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Name</span>
            </div>
            <p className="font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground mt-1">Cannot be changed</p>
          </div>

          {/* Location */}
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Location</span>
            </div>
            <p className="font-medium truncate">{location || "Not set"}</p>
            <p className="text-xs text-muted-foreground mt-1">Cannot be changed</p>
          </div>

          {/* Map Link */}
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Map Link</span>
            </div>
            <p className="font-medium truncate text-sm">{mapLink || "Not set"}</p>
            <p className="text-xs text-muted-foreground mt-1">Cannot be changed</p>
          </div>

          {/* Contact Email */}
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Email</span>
              </div>
              <EditButton field="email" onSave={() => handleSaveField("email")} />
            </div>
            {editMode.email ? (
              <EmailVerification
                email={email}
                onEmailChange={(newEmail) => {
                  setEmail(newEmail);
                  if (newEmail !== originalEmail) {
                    setEmailVerified(false);
                  } else {
                    setEmailVerified(true);
                  }
                }}
                isVerified={emailVerified}
                onVerificationChange={setEmailVerified}
              />
            ) : (
              <p className="font-medium truncate">{email || "Not set"}</p>
            )}
          </div>

          {/* Phone Numbers */}
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Phone</span>
            </div>
            <p className="font-medium">{phoneNumbers.length > 0 ? phoneNumbers[0] : "Not set"}</p>
            {phoneNumbers.length > 1 && (
              <p className="text-xs text-muted-foreground">+{phoneNumbers.length - 1} more</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Cannot be changed</p>
          </div>

          {/* Operating Hours - Only for hotels, adventures, and attractions */}
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
                      <Badge
                        key={day}
                        variant={daysOpened.includes(day) ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleDay(day)}
                      >
                        {day.slice(0, 3)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-medium">{openingHours && closingHours ? `${openingHours} - ${closingHours}` : "Not set"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{daysOpened.length > 0 ? daysOpened.map(d => d.slice(0, 3)).join(", ") : "No days set"}</p>
                </>
              )}
            </div>
          )}

          {/* Trip-specific: Date */}
          {type === "trip" && (
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Date</span>
              </div>
              <p className="font-medium">{date ? new Date(date).toLocaleDateString() : "Not set"}</p>
              <p className="text-xs text-muted-foreground mt-1">Cannot be changed</p>
            </div>
          )}

          {/* Trip-specific: Pricing */}
          {type === "trip" && (
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Pricing</span>
                </div>
                <EditButton field="price" onSave={() => handleSaveField("price")} />
              </div>
              {editMode.price ? (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Adult (KSh)</Label>
                    <Input type="number" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} min={0} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Child (KSh)</Label>
                    <Input type="number" value={priceChild} onChange={(e) => setPriceChild(parseFloat(e.target.value) || 0)} min={0} className="h-8" />
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-medium">KSh {price}</p>
                  <p className="text-xs text-muted-foreground">Child: KSh {priceChild}</p>
                </>
              )}
            </div>
          )}

          {/* Trip-specific: Tickets */}
          {type === "trip" && (
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Tickets</span>
                </div>
                <EditButton field="slots" onSave={() => handleSaveField("slots")} />
              </div>
              {editMode.slots ? (
                <Input
                  type="number"
                  value={availableSlots}
                  onChange={(e) => setAvailableSlots(parseInt(e.target.value) || 0)}
                  min={0}
                  className="h-8"
                />
              ) : (
                <p className="font-medium">{availableSlots} tickets</p>
              )}
            </div>
          )}

          {/* Entrance Fee */}
          {(type === "adventure" || type === "attraction") && (
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Entry Fee</span>
                </div>
                <EditButton field="entranceFee" onSave={() => handleSaveField("entranceFee")} />
              </div>
              {editMode.entranceFee ? (
                <div className="space-y-2">
                  <Select value={entranceFeeType} onValueChange={setEntranceFeeType}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                  {entranceFeeType === "paid" && (
                    <Input
                      type="number"
                      placeholder="Price (KSh)"
                      value={entranceFee}
                      onChange={(e) => setEntranceFee(parseFloat(e.target.value) || 0)}
                      min={0}
                      className="h-8"
                    />
                  )}
                </div>
              ) : (
                <p className="font-medium capitalize">{entranceFeeType === "free" ? "Free" : `KSh ${entranceFee}`}</p>
              )}
            </div>
          )}
        </div>

        {/* Description - Full Width */}
        <div className="mt-6 bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Description</h2>
            <EditButton field="description" onSave={() => handleSaveField("description")} />
          </div>
          {editMode.description ? (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Enter description..."
            />
          ) : (
            <p className="text-sm text-muted-foreground">{description || "No description"}</p>
          )}
        </div>

        {/* Amenities, Facilities, Activities - Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {/* Amenities */}
          {(type === "hotel" || type === "adventure" || type === "attraction") && (
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Amenities</h3>
                <EditButton field="amenities" onSave={() => handleSaveField("amenities")} />
              </div>
              {editMode.amenities ? (
                <div className="space-y-2">
                  {amenities.map((amenity, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={amenity}
                        onChange={(e) => updateAmenity(idx, e.target.value)}
                        placeholder="Amenity"
                        className="h-8 text-sm"
                      />
                      <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => removeAmenity(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addAmenity} className="w-full">
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {amenities.length > 0 ? amenities.map((amenity, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">{amenity}</Badge>
                  )) : <p className="text-sm text-muted-foreground">None</p>}
                </div>
              )}
            </div>
          )}

          {/* Facilities */}
          {(type === "hotel" || type === "adventure" || type === "attraction") && (
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Facilities</h3>
                <EditButton field="facilities" onSave={() => handleSaveField("facilities")} />
              </div>
              {editMode.facilities ? (
                <div className="space-y-2">
                  {facilities.map((facility, idx) => (
                    <div key={idx} className="flex gap-1">
                      <Input placeholder="Name" value={facility.name} onChange={(e) => updateFacility(idx, "name", e.target.value)} className="h-8 text-sm flex-1" />
                      <Input type="number" placeholder="Price" value={facility.price} onChange={(e) => updateFacility(idx, "price", parseFloat(e.target.value) || 0)} className="h-8 text-sm w-16" />
                      {(type === "hotel" || type === "attraction") && (
                        <Input type="number" placeholder="Cap" value={facility.capacity || 1} onChange={(e) => updateFacility(idx, "capacity", parseInt(e.target.value) || 1)} className="h-8 text-sm w-14" />
                      )}
                      <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => removeFacility(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addFacility} className="w-full">
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {facilities.length > 0 ? facilities.map((facility, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{facility.name}</span>
                      <span className="text-muted-foreground">{facility.price === 0 ? "Free" : `KSh ${facility.price}`}</span>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">None</p>}
                </div>
              )}
            </div>
          )}

          {/* Activities */}
          {(type === "hotel" || type === "adventure" || type === "attraction") && (
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Activities</h3>
                <EditButton field="activities" onSave={() => handleSaveField("activities")} />
              </div>
              {editMode.activities ? (
                <div className="space-y-2">
                  {activities.map((activity, idx) => (
                    <div key={idx} className="flex gap-1">
                      <Input placeholder="Name" value={activity.name} onChange={(e) => updateActivity(idx, "name", e.target.value)} className="h-8 text-sm flex-1" />
                      <Input type="number" placeholder="Price" value={activity.price} onChange={(e) => updateActivity(idx, "price", parseFloat(e.target.value) || 0)} className="h-8 text-sm w-20" />
                      <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => removeActivity(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addActivity} className="w-full">
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {activities.length > 0 ? activities.map((activity, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{activity.name}</span>
                      <span className="text-muted-foreground">{activity.price === 0 ? "Free" : `KSh ${activity.price}`}</span>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">None</p>}
                </div>
              )}
            </div>
          )}

          {/* Bookings Card */}
          <div className="bg-card rounded-lg border p-4">
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
                    <p className="text-xs text-muted-foreground">KSh {booking.total_amount}</p>
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => navigate(`/host/bookings/${type}/${id}`)}
                >
                  See All Bookings
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default EditListing;
