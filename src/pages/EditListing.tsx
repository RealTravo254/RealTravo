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
import { Loader2, Upload, X } from "lucide-react";

interface Facility {
  name: string;
  price: number;
  capacity?: number;
}

const EditListing = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  
  // Fields for trips/events
  const [date, setDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState(0);
  const [priceChild, setPriceChild] = useState(0);
  
  // Fields for accommodations
  const [price, setPrice] = useState(0);
  const [numberOfRooms, setNumberOfRooms] = useState(1);
  const [capacity, setCapacity] = useState(2);

  useEffect(() => {
    if (!user || !id || !type) {
      navigate("/");
      return;
    }
    fetchListing();
  }, [user, id, type]);

  const fetchListing = async () => {
    try {
      let table: "hotels" | "adventure_places" | "trips" | "events" | "accommodations" = "hotels";
      if (type === "hotel") table = "hotels";
      else if (type === "adventure") table = "adventure_places";
      else if (type === "trip") table = "trips";
      else if (type === "event") table = "events";
      else if (type === "accommodation") table = "accommodations";

      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", id!)
        .eq("created_by", user?.id!)
        .single();

      if (error) throw error;

      setName(data.name as string);
      setDescription((data.description as string) || "");
      // Only hotels and adventure places have facilities - safely access with type guard
      if ('facilities' in data && data.facilities) {
        setFacilities((data.facilities as any) || []);
      }
      setExistingImages((data.gallery_images as string[]) || []);
      
      // Load trip/event specific fields
      if (type === 'trip' || type === 'event') {
        setDate((data as any).date || '');
        setAvailableSlots((data as any).available_tickets || 0);
        setPriceChild((data as any).price_child || 0);
      }
      
      // Load accommodation specific fields
      if (type === 'accommodation') {
        setPrice((data as any).price || 0);
        setNumberOfRooms((data as any).number_of_rooms || 1);
        setCapacity((data as any).capacity || 2);
      }
    } catch (error) {
      console.error("Error fetching listing:", error);
      toast({
        title: "Error",
        description: "Failed to load listing",
        variant: "destructive",
      });
      navigate("/my-content");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (existingImages.length + newImages.length + files.length > 5) {
        toast({
          title: "Too many images",
          description: "You can upload a maximum of 5 images",
          variant: "destructive",
        });
        return;
      }
      setNewImages([...newImages, ...files]);
    }
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a name",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      let uploadedImageUrls: string[] = [];

      // Upload new images
      for (const file of newImages) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user?.id}-${Date.now()}-${Math.random()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from("listing-images")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("listing-images")
          .getPublicUrl(fileName);

        uploadedImageUrls.push(publicUrl);
      }

      const allImages = [...existingImages, ...uploadedImageUrls];

      let table: "hotels" | "adventure_places" | "trips" | "events" | "accommodations" = "hotels";
      if (type === "hotel") table = "hotels";
      else if (type === "adventure") table = "adventure_places";
      else if (type === "trip") table = "trips";
      else if (type === "event") table = "events";
      else if (type === "accommodation") table = "accommodations";

      const updateData: any = {
        name,
        description,
        gallery_images: allImages,
        image_url: allImages[0] || existingImages[0],
      };

      if (type === 'hotel' || type === 'adventure') {
        updateData.facilities = facilities;
      }
      
      if (type === 'trip' || type === 'event') {
        updateData.date = date;
        updateData.available_tickets = availableSlots;
        updateData.price_child = priceChild;
      }
      
      if (type === 'accommodation') {
        updateData.price = price;
        updateData.number_of_rooms = numberOfRooms;
        updateData.capacity = capacity;
      }

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq("id", id!)
        .eq("created_by", user?.id!);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Listing updated successfully",
      });

      navigate("/my-content");
    } catch (error) {
      console.error("Error saving listing:", error);
      toast({
        title: "Error",
        description: "Failed to update listing",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
      
      <main className="container px-4 py-8 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Edit Listing</h1>
        </div>

        <div className="space-y-6">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <Label>Images ({existingImages.length + newImages.length}/5)</Label>
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
              {existingImages.length + newImages.length < 5 && (
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

          {(type === 'trip' || type === 'event') && (
            <>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <Label htmlFor="availableSlots">Available Slots/Tickets</Label>
                <Input
                  id="availableSlots"
                  type="number"
                  value={availableSlots}
                  onChange={(e) => setAvailableSlots(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>

              <div>
                <Label htmlFor="priceChild">Price for Child Ticket (KSh)</Label>
                <Input
                  id="priceChild"
                  type="number"
                  value={priceChild}
                  onChange={(e) => setPriceChild(parseFloat(e.target.value) || 0)}
                  min={0}
                />
              </div>
            </>
          )}

          {type === 'accommodation' && (
            <>
              <div>
                <Label htmlFor="price">Price per Night (KSh)</Label>
                <Input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  min={0}
                />
              </div>

              <div>
                <Label htmlFor="numberOfRooms">Number of Rooms</Label>
                <Input
                  id="numberOfRooms"
                  type="number"
                  value={numberOfRooms}
                  onChange={(e) => setNumberOfRooms(parseInt(e.target.value) || 1)}
                  min={1}
                />
              </div>

              <div>
                <Label htmlFor="capacity">Capacity (Maximum Guests)</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value) || 2)}
                  min={1}
                />
              </div>
            </>
          )}

          {(type === "hotel" || type === "adventure") && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Facilities & Pricing</Label>
                <Button size="sm" onClick={addFacility}>Add Facility</Button>
              </div>
              {facilities.map((facility, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <Input
                    placeholder="Facility name"
                    value={facility.name}
                    onChange={(e) => updateFacility(idx, "name", e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    value={facility.price}
                    onChange={(e) => updateFacility(idx, "price", parseFloat(e.target.value))}
                  />
                  {type === "hotel" && (
                    <Input
                      type="number"
                      placeholder="Capacity"
                      value={facility.capacity || 1}
                      onChange={(e) => updateFacility(idx, "capacity", parseInt(e.target.value))}
                    />
                  )}
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => removeFacility(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => navigate("/my-content")} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </div>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default EditListing;
