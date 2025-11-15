import { useState } from "react";
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
import { MapPin, Mail, Phone, Navigation } from "lucide-react";
import { accessPinSchema, registrationNumberSchema, adminEmailsSchema } from "@/lib/validation";

const CreateHotel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    place: "",
    country: "",
    email: "",
    phone_numbers: "",
    map_link: "",
    registrationNumber: "",
    accessPin: "",
    establishmentType: "hotel",
    amenities: "",
    allowedAdminEmails: ""
  });
  
  const [facilities, setFacilities] = useState<Array<{name: string, price: string, capacity: string}>>([
    {name: "", price: "", capacity: ""}
  ]);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    
    const newFiles = Array.from(files).slice(0, 5 - galleryImages.length);
    setGalleryImages(prev => [...prev, ...newFiles].slice(0, 5));
  };

  const removeImage = (index: number) => {
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
  };

  const addFacility = () => {
    setFacilities([...facilities, {name: "", price: "", capacity: ""}]);
  };

  const removeFacility = (index: number) => {
    if (facilities.length > 1) {
      setFacilities(facilities.filter((_, i) => i !== index));
    }
  };

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
          setFormData({...formData, map_link: mapUrl});
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

    // Validate access PIN
    const pinValidation = accessPinSchema.safeParse(formData.accessPin);
    if (!pinValidation.success) {
      toast({
        title: "Invalid Access PIN",
        description: pinValidation.error.issues[0].message,
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

    // Validate admin emails if provided
    if (formData.allowedAdminEmails.trim()) {
      const emailsValidation = adminEmailsSchema.safeParse(formData.allowedAdminEmails);
      if (!emailsValidation.success) {
        toast({
          title: "Invalid Administrator Emails",
          description: emailsValidation.error.issues[0].message,
          variant: "destructive"
        });
        return;
      }
    }

    // Validate at least one facility
    const validFacilities = facilities.filter(f => f.name && f.price && f.capacity);
    if (validFacilities.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one facility with name, price, and capacity",
        variant: "destructive",
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
          .from('user-content-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('user-content-images')
          .getPublicUrl(fileName);
          
        uploadedUrls.push(publicUrl);
      }

      const phoneArray = formData.phone_numbers
        .split(',')
        .map(p => p.trim())
        .filter(p => p);

      const amenitiesArray = formData.amenities
        .split(',')
        .map(a => a.trim())
        .filter(a => a);

      const facilitiesArray = validFacilities.map(f => ({ 
        name: f.name.trim(), 
        price: parseFloat(f.price),
        capacity: parseInt(f.capacity)
      }));

      const allowedAdminsArray = formData.allowedAdminEmails
        .split(',')
        .map(e => e.trim())
        .filter(e => e && e.includes('@'));

      const { error } = await supabase
        .from("hotels")
        .insert([{
          name: formData.name,
          description: formData.description,
          location: formData.location,
          place: formData.place,
          country: formData.country,
          image_url: uploadedUrls[0] || "",
          gallery_images: uploadedUrls,
          map_link: formData.map_link || null,
          registration_number: formData.registrationNumber,
          access_pin: formData.accessPin,
          establishment_type: formData.establishmentType,
          allowed_admin_emails: allowedAdminsArray.length > 0 ? allowedAdminsArray : null,
          email: formData.email || null,
          phone_numbers: phoneArray.length > 0 ? phoneArray : null,
          facilities: facilitiesArray,
          amenities: amenitiesArray.length > 0 ? amenitiesArray : null,
          created_by: user.id
        }]);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your hotel has been submitted for verification.",
      });

      navigate("/profile");
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
        <h1 className="text-3xl font-bold mb-8">Create Hotel & Accommodation</h1>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Hotel Name *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Enter hotel name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Input
                  id="country"
                  required
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                  placeholder="Enter country"
                />
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
                    placeholder="Enter place"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location Details *</Label>
                <Input
                  id="location"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="Enter location details"
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
                <Label htmlFor="accessPin">Access PIN *</Label>
                <Input
                  id="accessPin"
                  type="password"
                  required
                  value={formData.accessPin}
                  onChange={(e) => setFormData({...formData, accessPin: e.target.value})}
                  placeholder="Enter secure access PIN"
                />
                <p className="text-sm text-muted-foreground">This PIN will be required to manage this listing</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="establishmentType">Type of Establishment *</Label>
                <select
                  id="establishmentType"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.establishmentType}
                  onChange={(e) => setFormData({...formData, establishmentType: e.target.value})}
                >
                  <option value="hotel">Hotel</option>
                  <option value="accommodation">Accommodation</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="allowedAdminEmails">Allowed Administrator Emails</Label>
                <Input
                  id="allowedAdminEmails"
                  type="text"
                  value={formData.allowedAdminEmails}
                  onChange={(e) => setFormData({...formData, allowedAdminEmails: e.target.value})}
                  placeholder="admin1@example.com, admin2@example.com"
                />
                <p className="text-sm text-muted-foreground">Comma-separated email addresses of users who can manage this listing</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Contact Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-10"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="contact@hotel.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_numbers">Contact Phones</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone_numbers"
                    className="pl-10"
                    value={formData.phone_numbers}
                    onChange={(e) => setFormData({...formData, phone_numbers: e.target.value})}
                    placeholder="+123456789, +987654321"
                  />
                </div>
                <p className="text-sm text-muted-foreground">Separate multiple numbers with commas</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="map_link">Map Location Link</Label>
                <div className="flex gap-2">
                  <Input
                    id="map_link"
                    type="url"
                    value={formData.map_link}
                    onChange={(e) => setFormData({...formData, map_link: e.target.value})}
                    placeholder="https://maps.google.com/..."
                  />
                  <Button type="button" variant="outline" onClick={getCurrentLocation}>
                    <Navigation className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Add Google Maps link or use your current location</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe your hotel and accommodation..."
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amenities">Amenities</Label>
              <Input
                id="amenities"
                value={formData.amenities}
                onChange={(e) => setFormData({...formData, amenities: e.target.value})}
                placeholder="Free WiFi, Air Conditioning, Bathroom, etc."
              />
              <p className="text-sm text-muted-foreground">Separate multiple amenities with commas</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Facilities (Room Types) - Minimum 1 required *</Label>
                <Button type="button" onClick={addFacility} variant="outline" size="sm">
                  Add Facility
                </Button>
              </div>
              
              {facilities.map((facility, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <Input
                    placeholder="Room type (e.g., Deluxe Suite)"
                    value={facility.name}
                    onChange={(e) => {
                      const newFacilities = [...facilities];
                      newFacilities[index].name = e.target.value;
                      setFacilities(newFacilities);
                    }}
                    required
                  />
                  <Input
                    type="number"
                    placeholder="Price/day"
                    value={facility.price}
                    onChange={(e) => {
                      const newFacilities = [...facilities];
                      newFacilities[index].price = e.target.value;
                      setFacilities(newFacilities);
                    }}
                    required
                  />
                  <Input
                    type="number"
                    placeholder="Capacity"
                    value={facility.capacity}
                    onChange={(e) => {
                      const newFacilities = [...facilities];
                      newFacilities[index].capacity = e.target.value;
                      setFacilities(newFacilities);
                    }}
                    required
                  />
                  {facilities.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => removeFacility(index)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Gallery Images (Max 5) *</Label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleImageUpload(e.target.files)}
                disabled={galleryImages.length >= 5}
              />
              <p className="text-sm text-muted-foreground">
                {galleryImages.length}/5 images selected
              </p>
              {galleryImages.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {galleryImages.map((file, index) => (
                    <div key={index} className="relative">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt={`Preview ${index + 1}`}
                        className="w-full h-20 object-cover rounded"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="absolute top-0 right-0 h-6 w-6 p-0"
                        onClick={() => removeImage(index)}
                      >×</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {uploading ? "Uploading Images..." : loading ? "Submitting..." : "Submit for Approval"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default CreateHotel;
