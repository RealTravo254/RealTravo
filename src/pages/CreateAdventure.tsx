import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Mail, Navigation, Clock, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { registrationNumberSchema, descriptionSchema, approvalStatusSchema } from "@/lib/validation";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PageHeader } from "@/components/creation/PageHeader";
import { PhoneInput } from "@/components/creation/PhoneInput";
import { EmailVerification } from "@/components/creation/EmailVerification";

const CreateAdventure = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    registrationName: "",
    registrationNumber: "",
    locationName: "",
    place: "",
    localName: "",
    country: "",
    description: "",
    email: "",
    phoneNumber: "",
    locationLink: "",
    openingHours: "",
    closingHours: "",
    entranceFeeType: "free",
    childPrice: "0",
    adultPrice: "0"
  });
  
  const [workingDays, setWorkingDays] = useState({
    Mon: false,
    Tue: false,
    Wed: false,
    Thu: false,
    Fri: false,
    Sat: false,
    Sun: false
  });
  
  const [facilities, setFacilities] = useState<Array<{name: string, priceType: string, price: string, capacity: string}>>([
    {name: "", priceType: "free", price: "0", capacity: "0"}
  ]);
  
  const [activities, setActivities] = useState<Array<{name: string, priceType: string, price: string}>>([
    {name: "", priceType: "free", price: "0"}
  ]);
  
  const [amenities, setAmenities] = useState<string[]>([""]);
  
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  // Fetch user profile and set country
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('country')
          .eq('id', user.id)
          .single();
        
        if (profile?.country) {
          setFormData(prev => ({ ...prev, country: profile.country }));
        }
      }
    };
    
    fetchUserProfile();
  }, [user]);

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
          setFormData({...formData, locationLink: mapUrl});
          toast({
            title: "Location Added",
            description: "Your current location has been added to the map link.",
          });
        },
        (error) => {
          toast({
            title: "Location Error",
            description: "Unable to get your location. Please add the link manually.",
            variant: "destructive"
          });
        }
      );
    } else {
      toast({
        title: "Not Supported",
        description: "Geolocation is not supported by your browser.",
        variant: "destructive"
      });
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    
    const newFiles = Array.from(files).slice(0, 5 - galleryImages.length);
    setGalleryImages(prev => [...prev, ...newFiles].slice(0, 5));
  };

  const removeImage = (index: number) => {
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
  };

  const addFacility = () => {
    setFacilities([...facilities, {name: "", priceType: "free", price: "0", capacity: "0"}]);
  };

  const removeFacility = (index: number) => {
    if (facilities.length > 1) {
      setFacilities(facilities.filter((_, i) => i !== index));
    }
  };

  const addActivity = () => {
    setActivities([...activities, {name: "", priceType: "free", price: "0"}]);
  };

  const removeActivity = (index: number) => {
    if (activities.length > 1) {
      setActivities(activities.filter((_, i) => i !== index));
    }
  };

  const addAmenity = () => {
    setAmenities([...amenities, ""]);
  };

  const removeAmenity = (index: number) => {
    if (amenities.length > 1) {
      setAmenities(amenities.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create content.",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }

    // Validate required fields
    if (!formData.phoneNumber) {
      toast({
        title: "Phone Number Required",
        description: "Please provide a contact phone number",
        variant: "destructive"
      });
      return;
    }

    if (!formData.locationLink) {
      toast({
        title: "Location Required",
        description: "Please click the button to access your current location",
        variant: "destructive"
      });
      return;
    }

    // Verify email if provided
    if (formData.email && !emailVerified) {
      toast({
        title: "Email Verification Required",
        description: "Please verify your email address before submitting",
        variant: "destructive"
      });
      return;
    }

    // Validate registration number
    const regValidation = registrationNumberSchema.safeParse(formData.registrationNumber);
    if (!regValidation.success) {
      toast({
        title: "Invalid Registration Number",
        description: regValidation.error.issues[0].message,
        variant: "destructive"
      });
      return;
    }

    // Validate description
    if (formData.description) {
      const descValidation = descriptionSchema.safeParse(formData.description);
      if (!descValidation.success) {
        toast({
          title: "Invalid Description",
          description: descValidation.error.issues[0].message,
          variant: "destructive"
        });
        return;
      }
    }

    // Validate images
    if (galleryImages.length === 0) {
      toast({
        title: "Images Required",
        description: "Please upload at least one image (maximum 5).",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      // Upload gallery images
      const uploadedUrls: string[] = [];
      for (const file of galleryImages) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('listing-images')
          .getPublicUrl(fileName);
          
        uploadedUrls.push(publicUrl);
      }

      // Prepare working days array
      const selectedDays = Object.entries(workingDays)
        .filter(([_, isSelected]) => isSelected)
        .map(([day, _]) => day);

      // Prepare facilities array
      const facilitiesArray = facilities
        .filter(f => f.name.trim())
        .map(f => ({ 
          name: f.name.trim(), 
          price_per_day: f.priceType === "free" ? 0 : parseFloat(f.price) || 0,
          capacity: parseInt(f.capacity) || 0
        }));

      // Prepare activities array
      const activitiesArray = activities
        .filter(a => a.name.trim())
        .map(a => ({ 
          name: a.name.trim(), 
          price: a.priceType === "free" ? 0 : parseFloat(a.price) || 0 
        }));

      // Prepare amenities array
      const amenitiesArray = amenities.filter(a => a.trim()).map(a => a.trim());

      const { error } = await supabase
        .from("adventure_places")
        .insert([{
        name: formData.registrationName,
        local_name: formData.localName || null,
          registration_number: formData.registrationNumber,
          location: formData.locationName,
          place: formData.place || formData.locationName,
          country: formData.country,
          description: formData.description || null,
          email: formData.email || null,
          phone_numbers: formData.phoneNumber ? [formData.phoneNumber] : null,
          map_link: formData.locationLink || null,
          opening_hours: formData.openingHours || null,
          closing_hours: formData.closingHours || null,
          days_opened: selectedDays.length > 0 ? selectedDays : null,
          image_url: uploadedUrls[0] || "",
          gallery_images: uploadedUrls,
          entry_fee_type: formData.entranceFeeType,
          entry_fee: formData.entranceFeeType === "paid" ? 
            (parseFloat(formData.adultPrice) || 0) : 0,
          activities: activitiesArray.length > 0 ? activitiesArray : null,
          facilities: facilitiesArray.length > 0 ? facilitiesArray : null,
          amenities: amenitiesArray.length > 0 ? amenitiesArray : null,
          created_by: user.id,
          approval_status: approvalStatusSchema.parse("pending")
        }]);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your experience has been submitted for verification.",
      });

      navigate("/become-host");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-8 max-w-4xl mx-auto">
        <PageHeader 
          title="Create Campsite or Experience" 
          backgroundImage="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200"
        />
        <h1 className="md:hidden text-3xl font-bold mb-8">Create Campsite or Experience</h1>
        <p className="text-muted-foreground mb-6">
          Submit your campsite or experience for admin verification. It will be visible after approval.
        </p>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Registration Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Registration & Contact</h3>
              
              <div className="space-y-2">
                <Label htmlFor="registrationName">Registration Name (as per government documentation) *</Label>
                <Input
                  id="registrationName"
                  required
                  value={formData.registrationName}
                  onChange={(e) => setFormData({...formData, registrationName: e.target.value})}
                  placeholder="Enter registered business name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registrationNumber">Registration Number *</Label>
                <Input
                  id="registrationNumber"
                  required
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({...formData, registrationNumber: e.target.value})}
                  placeholder="Enter registration number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationName">Location Name *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="locationName"
                    required
                    className="pl-10"
                    value={formData.locationName}
                    onChange={(e) => setFormData({...formData, locationName: e.target.value})}
                    placeholder="Enter location name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="place">Place *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="place"
                    required
                    className="pl-10"
                    value={formData.place}
                    onChange={(e) => setFormData({...formData, place: e.target.value})}
                    placeholder="Enter place (e.g., Nairobi, Mombasa)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="localName">Local Name (Optional)</Label>
                <Input
                  id="localName"
                  value={formData.localName}
                  onChange={(e) => setFormData({...formData, localName: e.target.value})}
                  placeholder="Enter local/common name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <CountrySelector
                  value={formData.country}
                  onChange={(value) => setFormData({...formData, country: value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (100 words max) *</Label>
                <Textarea
                  id="description"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe your campsite or experience..."
                  rows={4}
                />
              </div>

              <EmailVerification
                email={formData.email}
                onEmailChange={(email) => setFormData({...formData, email})}
                isVerified={emailVerified}
                onVerificationChange={setEmailVerified}
              />

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <PhoneInput
                  value={formData.phoneNumber}
                  onChange={(value) => setFormData({...formData, phoneNumber: value})}
                  country={formData.country}
                  placeholder="0758800117"
                />
                <p className="text-sm text-muted-foreground">Enter number without leading zero</p>
              </div>
            </div>

            {/* Operational Details */}
            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-lg font-semibold">Operational Details</h3>

              <div className="space-y-2">
                <Label htmlFor="locationLink">Location Link *</Label>
                <div className="flex gap-2">
                  <Input
                    id="locationLink"
                    required
                    disabled
                    value={formData.locationLink}
                    placeholder="Click button to access your current location"
                    className="cursor-not-allowed"
                  />
                  <Button type="button" variant="outline" onClick={getCurrentLocation} className="shrink-0">
                    <MapPin className="h-4 w-4 mr-2" />
                    Auto-Access My Location
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Use the button to access your current location</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="openingHours">Opening Hours *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="openingHours"
                      type="time"
                      required
                      className="pl-10"
                      value={formData.openingHours}
                      onChange={(e) => setFormData({...formData, openingHours: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="closingHours">Closing Hours *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="closingHours"
                      type="time"
                      required
                      className="pl-10"
                      value={formData.closingHours}
                      onChange={(e) => setFormData({...formData, closingHours: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Working Days</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(workingDays).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setWorkingDays({...workingDays, [day]: !workingDays[day as keyof typeof workingDays]})}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        workingDays[day as keyof typeof workingDays]
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-accent'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Entrance Fee</Label>
                <Select
                  value={formData.entranceFeeType}
                  onValueChange={(value) => setFormData({...formData, entranceFeeType: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.entranceFeeType === "paid" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="childPrice">Children Price</Label>
                    <Input
                      id="childPrice"
                      type="number"
                      step="0.01"
                      value={formData.childPrice}
                      onChange={(e) => setFormData({...formData, childPrice: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adultPrice">Adult Price</Label>
                    <Input
                      id="adultPrice"
                      type="number"
                      step="0.01"
                      value={formData.adultPrice}
                      onChange={(e) => setFormData({...formData, adultPrice: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Facilities */}
            <div className="space-y-4 pt-6 border-t">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Facilities</h3>
                <Button type="button" size="sm" onClick={addFacility}>Add Facility</Button>
              </div>
              <p className="text-sm text-muted-foreground">Add facilities with Name, Price, and Capacity</p>
              {facilities.map((facility, index) => (
                <div key={index} className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        placeholder="Facility name"
                        value={facility.name}
                        onChange={(e) => {
                          const newFacilities = [...facilities];
                          newFacilities[index].name = e.target.value;
                          setFacilities(newFacilities);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Price Type</Label>
                      <Select
                        value={facility.priceType}
                        onValueChange={(value) => {
                          const newFacilities = [...facilities];
                          newFacilities[index].priceType = value;
                          setFacilities(newFacilities);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {facility.priceType === "paid" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Price per Day</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={facility.price}
                          onChange={(e) => {
                            const newFacilities = [...facilities];
                            newFacilities[index].price = e.target.value;
                            setFacilities(newFacilities);
                          }}
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Capacity</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="20"
                          value={facility.capacity}
                          onChange={(e) => {
                            const newFacilities = [...facilities];
                            newFacilities[index].capacity = e.target.value;
                            setFacilities(newFacilities);
                          }}
                        />
                        {facilities.length > 1 && (
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => removeFacility(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Activities */}
            <div className="space-y-4 pt-6 border-t">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Activities</h3>
                <Button type="button" size="sm" onClick={addActivity}>Add Activity</Button>
              </div>
              {activities.map((activity, index) => (
                <div key={index} className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Input
                      placeholder="Activity name"
                      value={activity.name}
                      onChange={(e) => {
                        const newActivities = [...activities];
                        newActivities[index].name = e.target.value;
                        setActivities(newActivities);
                      }}
                    />
                    <Select
                      value={activity.priceType}
                      onValueChange={(value) => {
                        const newActivities = [...activities];
                        newActivities[index].priceType = value;
                        setActivities(newActivities);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      {activity.priceType === "paid" && (
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={activity.price}
                          onChange={(e) => {
                            const newActivities = [...activities];
                            newActivities[index].price = e.target.value;
                            setActivities(newActivities);
                          }}
                        />
                      )}
                      {activities.length > 1 && (
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => removeActivity(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Amenities */}
            <div className="space-y-4 pt-6 border-t">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Amenities</h3>
                <Button type="button" size="sm" onClick={addAmenity}>Add Amenity</Button>
              </div>
              {amenities.map((amenity, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="e.g. Free WiFi, Parking, Restrooms"
                    value={amenity}
                    onChange={(e) => {
                      const newAmenities = [...amenities];
                      newAmenities[index] = e.target.value;
                      setAmenities(newAmenities);
                    }}
                  />
                  {amenities.length > 1 && (
                    <Button type="button" size="sm" variant="destructive" onClick={() => removeAmenity(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Image Upload */}
            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-lg font-semibold">Images (Maximum 5) *</h3>
              <Label htmlFor="gallery-images-adventure" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-accent/50 transition-colors">
                  <div className="mx-auto h-12 w-12 text-muted-foreground mb-2">📁</div>
                  <p className="text-sm font-medium">Click to upload photos</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {galleryImages.length}/5 images uploaded
                  </p>
                </div>
              </Label>
              <Input
                id="gallery-images-adventure"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleImageUpload(e.target.files)}
                disabled={galleryImages.length >= 5}
                className="hidden"
              />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {galleryImages.map((file, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="absolute top-1 right-1"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {galleryImages.length}/5 images uploaded
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading || uploading}>
              {loading ? "Submitting..." : "Submit for Approval"}
            </Button>
          </form>
        </Card>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default CreateAdventure;
