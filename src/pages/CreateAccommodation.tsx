import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";
import { CountrySelector } from "@/components/creation/CountrySelector";

const ACCOMMODATION_TYPES = [
  "Tent",
  "Tree House",
  "Cabin",
  "Yurt",
  "Igloo",
  "Caravan",
  "Cottage",
  "Beach Hut",
  "Others"
];

const CreateAccommodation = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    accommodationType: "",
    customType: "",
    price: "",
    numberOfRooms: "1",
    capacity: "2",
    location: "",
    place: "",
    country: "",
    description: "",
    email: "",
    phoneNumbers: [""],
    mapLink: "",
  });

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) {
      toast({
        title: "Too many images",
        description: "You can upload maximum 5 images",
        variant: "destructive",
      });
      return;
    }

    setImages([...images, ...files]);
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const handlePhoneNumberChange = (index: number, value: string) => {
    const newPhoneNumbers = [...formData.phoneNumbers];
    newPhoneNumbers[index] = value;
    setFormData({ ...formData, phoneNumbers: newPhoneNumbers });
  };

  const addPhoneNumber = () => {
    setFormData({ ...formData, phoneNumbers: [...formData.phoneNumbers, ""] });
  };

  const removePhoneNumber = (index: number) => {
    const newPhoneNumbers = formData.phoneNumbers.filter((_, i) => i !== index);
    setFormData({ ...formData, phoneNumbers: newPhoneNumbers });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    if (images.length === 0) {
      toast({
        title: "Images required",
        description: "Please upload at least one image",
        variant: "destructive",
      });
      return;
    }

    if (formData.accommodationType === "Others" && !formData.customType) {
      toast({
        title: "Custom type required",
        description: "Please specify the accommodation type",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Upload images
      const imageUrls: string[] = [];
      for (const image of images) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${session.user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(filePath, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('listing-images')
          .getPublicUrl(filePath);

        imageUrls.push(publicUrl);
      }

      // Create accommodation
      const { error } = await supabase.from('accommodations').insert({
        name: formData.name,
        accommodation_type: formData.accommodationType,
        custom_type: formData.accommodationType === "Others" ? formData.customType : null,
        price: parseFloat(formData.price),
        number_of_rooms: parseInt(formData.numberOfRooms),
        capacity: parseInt(formData.capacity),
        location: formData.location,
        place: formData.place,
        country: formData.country,
        description: formData.description,
        email: formData.email,
        phone_numbers: formData.phoneNumbers.filter(p => p.trim() !== ""),
        map_link: formData.mapLink,
        image_url: imageUrls[0],
        images: imageUrls,
        gallery_images: imageUrls,
        created_by: session.user.id,
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Accommodation created and pending approval",
      });

      navigate("/become-host");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 mt-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Create Accommodation</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name">Accommodation Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="accommodationType">Accommodation Type *</Label>
              <Select
                value={formData.accommodationType}
                onValueChange={(value) => setFormData({ ...formData, accommodationType: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOMMODATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.accommodationType === "Others" && (
              <div>
                <Label htmlFor="customType">Specify Type *</Label>
                <Input
                  id="customType"
                  value={formData.customType}
                  onChange={(e) => setFormData({ ...formData, customType: e.target.value })}
                  placeholder="Enter custom accommodation type"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="price">Price (KSh per night) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="numberOfRooms">Number of Rooms *</Label>
                <Input
                  id="numberOfRooms"
                  type="number"
                  min="1"
                  value={formData.numberOfRooms}
                  onChange={(e) => setFormData({ ...formData, numberOfRooms: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="capacity">Max Capacity (guests) *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="country">Country *</Label>
                <CountrySelector
                  value={formData.country}
                  onChange={(value) => setFormData({ ...formData, country: value })}
                />
              </div>

              <div>
                <Label htmlFor="place">Place/City *</Label>
                <Input
                  id="place"
                  value={formData.place}
                  onChange={(e) => setFormData({ ...formData, place: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location">Specific Location *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="E.g., Near City Center"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="email">Contact Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <Label>Phone Numbers</Label>
              {formData.phoneNumbers.map((phone, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    value={phone}
                    onChange={(e) => handlePhoneNumberChange(index, e.target.value)}
                    placeholder="+254..."
                  />
                  {formData.phoneNumbers.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removePhoneNumber(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addPhoneNumber}>
                Add Phone Number
              </Button>
            </div>

            <div>
              <Label htmlFor="mapLink">Map Link (Google Maps)</Label>
              <Input
                id="mapLink"
                value={formData.mapLink}
                onChange={(e) => setFormData({ ...formData, mapLink: e.target.value })}
                placeholder="https://maps.google.com/..."
              />
            </div>

            <div>
              <Label>Images * (Max 5)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-video">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {images.length < 5 && (
                  <label className="aspect-video border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-accent">
                    <div className="text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Upload Image</span>
                    </div>
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

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/become-host")}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Accommodation"}
              </Button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default CreateAccommodation;