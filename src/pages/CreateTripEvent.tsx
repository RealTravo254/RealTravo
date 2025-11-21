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
import { Calendar, MapPin, DollarSign, Users, Upload, Navigation } from "lucide-react";
import { getCountryPhoneCode } from "@/lib/countryHelpers";
import { CountrySelector } from "@/components/creation/CountrySelector";

const CreateTripEvent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [phonePrefix, setPhonePrefix] = useState("+254");
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    place: "",
    country: "",
    date: "",
    price: "",
    price_child: "",
    available_tickets: "",
    email: "",
    phone_number: "",
    map_link: ""
  });
  
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Fetch user profile and set country/phone prefix
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('country')
          .eq('id', user.id)
          .single();
        
        if (profile?.country) {
          const prefix = getCountryPhoneCode(profile.country);
          setFormData(prev => ({ ...prev, country: profile.country }));
          setPhonePrefix(prefix);
        }
      }
    };
    
    fetchUserProfile();
  }, [user]);

  // Auto-fill location with geolocation
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
          setFormData(prev => ({ ...prev, map_link: mapUrl }));
        },
        () => {} // Silent fail
      );
    }
  }, []);

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    
    const newFiles = Array.from(files).slice(0, 5 - galleryImages.length);
    setGalleryImages(prev => [...prev, ...newFiles].slice(0, 5));
  };

  const removeImage = (index: number) => {
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
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

      const table = "trips";
      const insertData: any = {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        place: formData.place,
        country: formData.country,
        date: formData.date,
        image_url: uploadedUrls[0] || "",
        gallery_images: uploadedUrls,
        price: parseFloat(formData.price),
        price_child: parseFloat(formData.price_child) || 0,
        available_tickets: parseInt(formData.available_tickets) || 0,
        email: formData.email || null,
        phone_number: formData.phone_number || null,
        map_link: formData.map_link || null,
        created_by: user.id
      };

      const { error } = await supabase
        .from(table)
        .insert([insertData]);

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Your trip has been submitted for approval.`,
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
        <h1 className="text-3xl font-bold mb-8">Create Trip</h1>
        
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Enter name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <CountrySelector
                  value={formData.country}
                  onChange={(value) => {
                    const prefix = getCountryPhoneCode(value);
                    setPhonePrefix(prefix);
                    setFormData({...formData, country: value});
                  }}
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
                <Label htmlFor="date">Date *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="date"
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="pl-10"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price (Adult) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    required
                    className="pl-10"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_child">Price (Child)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="price_child"
                    type="number"
                    step="0.01"
                    className="pl-10"
                    value={formData.price_child}
                    onChange={(e) => setFormData({...formData, price_child: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="available_tickets">Available Tickets</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="available_tickets"
                    type="number"
                    className="pl-10"
                    value={formData.available_tickets}
                    onChange={(e) => setFormData({...formData, available_tickets: e.target.value})}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Contact Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="contact@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number">Contact Phone</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                  placeholder={`${phonePrefix}...`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe your trip or event..."
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="map_link">Map Location Link</Label>
              <div className="flex gap-2">
                <Input
                  id="map_link"
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
              <Button type="submit" disabled={loading || uploading || galleryImages.length === 0} className="flex-1">
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

export default CreateTripEvent;
