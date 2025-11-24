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
import { Loader2, Upload, X, Edit2, Save, Calendar, MapPin, Phone, Mail, DollarSign, Users, Clock, CheckCircle, XCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

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
  const { type, id } = useParams<{ type: string; id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [approvalStatus, setApprovalStatus] = useState("");
  const [isHidden, setIsHidden] = useState(false);
  
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
      let table: "hotels" | "adventure_places" | "trips" | "attractions" = "hotels";
      if (type === "hotel") table = "hotels";
      else if (type === "adventure") table = "adventure_places";
      else if (type === "trip") table = "trips";
      else if (type === "attraction") table = "attractions";

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
      setEmail(((data as any).email as string) || "");
      
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
      }
      
      if (type === 'attraction') {
        setEntranceFeeType((data as any).entrance_type || "free");
        setEntranceFee((data as any).price_adult || 0);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setNewImages([...newImages, ...files]);
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
      if (type === "hotel") table = "hotels";
      else if (type === "adventure") table = "adventure_places";
      else if (type === "trip") table = "trips";
      else if (type === "attraction") table = "attractions";

      const { error } = await supabase
        .from(table)
        .update({ approval_status: "pending" })
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
      let table: "hotels" | "adventure_places" | "trips" | "attractions" = "hotels";
      if (type === "hotel") table = "hotels";
      else if (type === "adventure") table = "adventure_places";
      else if (type === "trip") table = "trips";
      else if (type === "attraction") table = "attractions";

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
          updateData.email = email;
          break;
        case "phone":
          if (type === "trip") {
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

      let table: "hotels" | "adventure_places" | "trips" | "attractions" = "hotels";
      if (type === "hotel") table = "hotels";
      else if (type === "adventure") table = "adventure_places";
      else if (type === "trip") table = "trips";
      else if (type === "attraction") table = "attractions";

      const updateData: any = {
        gallery_images: allImages,
        image_url: allImages[0] || existingImages[0],
      };

      if (type === "attraction") {
        updateData.photo_urls = allImages;
      } else {
        updateData.images = allImages;
      }

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

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Images Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Images</CardTitle>
                  <EditButton field="images" onSave={handleSaveImages} />
                </div>
              </CardHeader>
              <CardContent>
                {editMode.images ? (
                  <div>
                    <Label>Images ({existingImages.length + newImages.length}/10)</Label>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      {existingImages.map((img, idx) => (
                        <div key={`existing-${idx}`} className="relative">
                          <img src={img} alt="" className="w-full h-24 object-cover rounded" />
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => removeExistingImage(idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {newImages.map((file, idx) => (
                        <div key={`new-${idx}`} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt=""
                            className="w-full h-24 object-cover rounded"
                          />
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => removeNewImage(idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {existingImages.length + newImages.length < 10 && (
                        <label className="border-2 border-dashed rounded flex items-center justify-center h-24 cursor-pointer hover:bg-secondary">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {existingImages.slice(0, 6).map((img, idx) => (
                      <img key={idx} src={img} alt="" className="w-full h-24 object-cover rounded" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Name & Description */}
            <Card>
              <CardHeader>
                <CardTitle>Name</CardTitle>
              </CardHeader>
              <CardContent>
                <Input value={name} disabled className="bg-muted cursor-not-allowed" />
                <p className="text-xs text-muted-foreground mt-1">Name cannot be changed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Description</CardTitle>
                  <EditButton field="description" onSave={() => handleSaveField("description")} />
                </div>
              </CardHeader>
              <CardContent>
                {editMode.description ? (
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                ) : (
                  <p className="text-sm">{description || "No description"}</p>
                )}
              </CardContent>
            </Card>

            {/* Location & Map */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input value={location} disabled className="bg-muted cursor-not-allowed" />
                <p className="text-xs text-muted-foreground mt-1">Location cannot be changed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Map Link</CardTitle>
              </CardHeader>
              <CardContent>
                <Input value={mapLink} disabled className="bg-muted cursor-not-allowed" />
                <p className="text-xs text-muted-foreground mt-1">Map link cannot be changed</p>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contact Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input value={email || "No email"} disabled className="bg-muted cursor-not-allowed" />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Phone Numbers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {phoneNumbers.length > 0 ? (
                    phoneNumbers.map((phone, idx) => (
                      <Input key={idx} value={phone} disabled className="bg-muted cursor-not-allowed mb-2" />
                    ))
                  ) : (
                    <Input value="No phone number" disabled className="bg-muted cursor-not-allowed" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Phone numbers cannot be changed</p>
              </CardContent>
            </Card>

            {/* Operating Hours - Only for hotels, adventures, and attractions */}
            {type !== "trip" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Operating Hours
                  </CardTitle>
                  <EditButton field="hours" onSave={() => handleSaveField("hours")} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {editMode.hours ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Opening Time</Label>
                        <Input
                          type="time"
                          value={openingHours}
                          onChange={(e) => setOpeningHours(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Closing Time</Label>
                        <Input
                          type="time"
                          value={closingHours}
                          onChange={(e) => setClosingHours(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Working Days</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <div key={day} className="flex items-center space-x-2">
                            <Checkbox
                              id={day}
                              checked={daysOpened.includes(day)}
                              onCheckedChange={() => toggleDay(day)}
                            />
                            <label htmlFor={day} className="text-sm cursor-pointer">
                              {day}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm">
                      {openingHours && closingHours
                        ? `${openingHours} - ${closingHours}`
                        : "No hours set"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {daysOpened.length > 0 ? daysOpened.join(", ") : "No days set"}
                    </p>
                </>
                 )}
              </CardContent>
            </Card>
            )}

            {/* Trip-specific fields */}
            {type === "trip" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Date
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Input 
                      type="date" 
                      value={date} 
                      disabled 
                      className="bg-muted cursor-not-allowed" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">Date cannot be changed</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Pricing
                      </CardTitle>
                      <EditButton field="price" onSave={() => handleSaveField("price")} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {editMode.price ? (
                      <>
                        <div>
                          <Label>Adult Price (KSh)</Label>
                          <Input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                            min={0}
                          />
                        </div>
                        <div>
                          <Label>Child Price (KSh)</Label>
                          <Input
                            type="number"
                            value={priceChild}
                            onChange={(e) => setPriceChild(parseFloat(e.target.value) || 0)}
                            min={0}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm">Adult: KSh {price}</p>
                        <p className="text-sm">Child: KSh {priceChild}</p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Available Tickets
                      </CardTitle>
                      <EditButton field="slots" onSave={() => handleSaveField("slots")} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {editMode.slots ? (
                      <Input
                        type="number"
                        value={availableSlots}
                        onChange={(e) => setAvailableSlots(parseInt(e.target.value) || 0)}
                        min={0}
                      />
                    ) : (
                      <p className="text-sm">{availableSlots} tickets</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {/* Hotel amenities */}
            {type === "hotel" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Amenities</CardTitle>
                    <EditButton field="amenities" onSave={() => handleSaveField("amenities")} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editMode.amenities ? (
                    <>
                      {amenities.map((amenity, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            value={amenity}
                            onChange={(e) => updateAmenity(idx, e.target.value)}
                            placeholder="Amenity name"
                          />
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => removeAmenity(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" onClick={addAmenity}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Amenity
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {amenities.map((amenity, idx) => (
                        <Badge key={idx} variant="secondary">{amenity}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Facilities */}
            {(type === "hotel" || type === "adventure") && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Facilities & Rooms</CardTitle>
                    <EditButton field="facilities" onSave={() => handleSaveField("facilities")} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editMode.facilities ? (
                    <>
                      {facilities.map((facility, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            placeholder="Facility name"
                            value={facility.name}
                            onChange={(e) => updateFacility(idx, "name", e.target.value)}
                          />
                          <Input
                            type="number"
                            placeholder="Price"
                            value={facility.price}
                            onChange={(e) => updateFacility(idx, "price", parseFloat(e.target.value) || 0)}
                          />
                          {type === "hotel" && (
                            <Input
                              type="number"
                              placeholder="Capacity"
                              value={facility.capacity || 1}
                              onChange={(e) => updateFacility(idx, "capacity", parseInt(e.target.value) || 1)}
                            />
                          )}
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => removeFacility(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" onClick={addFacility}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Facility
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      {facilities.map((facility, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 border rounded">
                          <span className="text-sm">{facility.name}</span>
                          <div className="flex gap-2 text-sm text-muted-foreground">
                            <span>KSh {facility.price}</span>
                            {type === "hotel" && <span>• {facility.capacity} guests</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Activities */}
            {(type === "hotel" || type === "adventure") && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Activities</CardTitle>
                    <EditButton field="activities" onSave={() => handleSaveField("activities")} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editMode.activities ? (
                    <>
                      {activities.map((activity, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            placeholder="Activity name"
                            value={activity.name}
                            onChange={(e) => updateActivity(idx, "name", e.target.value)}
                          />
                          <Input
                            type="number"
                            placeholder="Price"
                            value={activity.price}
                            onChange={(e) => updateActivity(idx, "price", parseFloat(e.target.value) || 0)}
                          />
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => removeActivity(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" onClick={addActivity}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Activity
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      {activities.map((activity, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 border rounded">
                          <span className="text-sm">{activity.name}</span>
                          <span className="text-sm text-muted-foreground">KSh {activity.price}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Entrance Fee */}
            {(type === "adventure" || type === "attraction") && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Entrance Fee
                    </CardTitle>
                    <EditButton field="entranceFee" onSave={() => handleSaveField("entranceFee")} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editMode.entranceFee ? (
                    <>
                      <div>
                        <Label>Type</Label>
                        <Select value={entranceFeeType} onValueChange={setEntranceFeeType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {entranceFeeType === "paid" && (
                        <div>
                          <Label>Price (KSh)</Label>
                          <Input
                            type="number"
                            value={entranceFee}
                            onChange={(e) => setEntranceFee(parseFloat(e.target.value) || 0)}
                            min={0}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm capitalize">
                      {entranceFeeType === "free" ? "Free" : `Paid - KSh ${entranceFee}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Bookings */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bookings ({bookings.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No bookings yet</p>
                ) : (
                  <>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {bookings.slice(0, 3).map((booking) => (
                        <div key={booking.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium">{booking.guest_name_masked}</p>
                              <p className="text-xs text-muted-foreground">{booking.guest_email_limited}</p>
                            </div>
                            <Badge variant={booking.payment_status === "completed" ? "default" : "secondary"}>
                              {booking.payment_status}
                            </Badge>
                          </div>
                          <Separator />
                          <div className="text-xs space-y-1">
                            <p>Amount: KSh {booking.total_amount}</p>
                            <p>Slots: {booking.slots_booked}</p>
                            <p>Date: {new Date(booking.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate(`/host/bookings/${type}/${id}`)}
                    >
                      See All Bookings
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default EditListing;
