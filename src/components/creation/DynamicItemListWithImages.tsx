import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Image as ImageIcon, X, Camera } from "lucide-react";
import { FacilityAmenitiesInput } from "./FacilityAmenitiesInput";
import { compressImages } from "@/lib/imageCompression";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DynamicItemWithImages {
  name: string;
  priceType: "free" | "paid";
  price: string;
  capacity?: string;
  images?: string[];
  tempImages?: File[];
  bookingLink?: string;
  amenities?: string[];
}

interface DynamicItemListWithImagesProps {
  items: DynamicItemWithImages[];
  onChange: (items: DynamicItemWithImages[]) => void;
  label: string;
  placeholder?: string;
  showCapacity?: boolean;
  showPrice?: boolean;
  showBookingLink?: boolean;
  showAmenities?: boolean;
  accentColor?: string;
  maxImages?: number;
  userId?: string;
}

export const DynamicItemListWithImages = ({
  items,
  onChange,
  label,
  placeholder = "Item name",
  showCapacity = false,
  showPrice = true,
  showBookingLink = false,
  showAmenities = false,
  accentColor = "#008080",
  maxImages = 5,
}: DynamicItemListWithImagesProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newItem, setNewItem] = useState<DynamicItemWithImages>({
    name: "",
    priceType: "free",
    price: "0",
    capacity: "",
    images: [],
    tempImages: [],
    bookingLink: "",
    amenities: []
  });
  const [, setNewAmenity] = useState("");

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const currentImageCount = (newItem.images?.length || 0) + (newItem.tempImages?.length || 0);
    const remaining = maxImages - currentImageCount;
    
    if (remaining <= 0) {
      toast({
        title: "Maximum images reached",
        description: `You can only add ${maxImages} images per item`,
        variant: "destructive"
      });
      return;
    }

    const filesToAdd = files.slice(0, remaining);
    
    try {
      const compressed = await compressImages(filesToAdd);
      setNewItem(prev => ({
        ...prev,
        tempImages: [...(prev.tempImages || []), ...compressed.map(c => c.file)]
      }));
    } catch {
      setNewItem(prev => ({
        ...prev,
        tempImages: [...(prev.tempImages || []), ...filesToAdd]
      }));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeTempImage = (index: number) => {
    setNewItem(prev => ({
      ...prev,
      tempImages: prev.tempImages?.filter((_, i) => i !== index) || []
    }));
  };

  const isItemValid = () => {
    if (!newItem.name.trim()) return false;
    // Name is required; if showCapacity, capacity must be filled; if paid, price must be filled
    if (showCapacity && (!newItem.capacity || parseInt(newItem.capacity) <= 0)) return false;
    if (showPrice && newItem.priceType === "paid" && (!newItem.price || parseFloat(newItem.price) <= 0)) return false;
    return true;
  };

  const addItem = () => {
    if (!isItemValid()) {
      if (newItem.name.trim()) {
        toast({
          title: "Incomplete Item",
          description: `Please fill all required fields (name${showCapacity ? ', capacity' : ''}${showPrice && newItem.priceType === 'paid' ? ', price' : ''}) before adding.`,
          variant: "destructive"
        });
      }
      return;
    }
    onChange([...items, { ...newItem }]);
    setNewItem({ 
      name: "", 
      priceType: "free", 
      price: "0", 
      capacity: "",
      images: [],
      tempImages: [],
      bookingLink: "",
      amenities: []
    });
    setNewAmenity("");
  };

  // Auto-save: when user blurs any field, auto-add if all required fields are filled
  const handleAutoSave = () => {
    if (newItem.name.trim() && isItemValid()) {
      onChange([...items, { ...newItem }]);
      setNewItem({ 
        name: "", 
        priceType: "free", 
        price: "0", 
        capacity: "",
        images: [],
        tempImages: [],
        bookingLink: "",
        amenities: []
      });
      setNewAmenity("");
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const removeItemImage = (itemIndex: number, imageIndex: number, isTemp: boolean) => {
    const updatedItems = [...items];
    if (isTemp) {
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        tempImages: updatedItems[itemIndex].tempImages?.filter((_, i) => i !== imageIndex) || []
      };
    } else {
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        images: updatedItems[itemIndex].images?.filter((_, i) => i !== imageIndex) || []
      };
    }
    onChange(updatedItems);
  };

  const handleAddImageToExistingItem = async (itemIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const item = items[itemIndex];
    const currentCount = (item.images?.length || 0) + (item.tempImages?.length || 0);
    const remaining = maxImages - currentCount;

    if (remaining <= 0) {
      toast({
        title: "Maximum images reached",
        description: `You can only add ${maxImages} images per item`,
        variant: "destructive"
      });
      return;
    }

    const filesToAdd = files.slice(0, remaining);
    
    try {
      const compressed = await compressImages(filesToAdd);
      const updatedItems = [...items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        tempImages: [...(updatedItems[itemIndex].tempImages || []), ...compressed.map(c => c.file)]
      };
      onChange(updatedItems);
    } catch {
      const updatedItems = [...items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        tempImages: [...(updatedItems[itemIndex].tempImages || []), ...filesToAdd]
      };
      onChange(updatedItems);
    }

    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</Label>
      
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, index) => {
            const imageCount = (item.images?.length || 0) + (item.tempImages?.length || 0);

            return (
              <div 
                key={index} 
                className="p-4 rounded-xl bg-muted/50 border border-border space-y-3"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <span className="font-bold text-sm">{item.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {showPrice && (
                        <span 
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            item.priceType === "free" 
                              ? "bg-emerald-500/20 text-emerald-600" 
                              : "bg-amber-500/20 text-amber-600"
                          }`}
                        >
                          {item.priceType === "free" ? "Free" : `KSh ${item.price}`}
                        </span>
                      )}
                      {showCapacity && item.capacity && (
                        <span className="text-[10px] font-bold text-muted-foreground">
                          Cap: {item.capacity}
                        </span>
                      )}
                      {showBookingLink && item.bookingLink && (
                        <span className="text-[10px] font-bold text-blue-500 truncate max-w-[200px]">
                          🔗 {item.bookingLink}
                        </span>
                      )}
                    </div>
                    {showAmenities && item.amenities && item.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.amenities.map((a, ai) => (
                          <span key={ai} className="text-[9px] bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 p-1 h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.images?.map((url, imgIndex) => (
                    <div key={`existing-${imgIndex}`} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeItemImage(index, imgIndex, false)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {item.tempImages?.map((file, imgIndex) => (
                    <div key={`temp-${imgIndex}`} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                      <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="text-[8px] text-white font-bold">NEW</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItemImage(index, imgIndex, true)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  
                  {imageCount < maxImages && (
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-muted-foreground transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleAddImageToExistingItem(index, e)}
                      />
                      <Camera className="h-5 w-5 text-muted-foreground" />
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{imageCount}/{maxImages} photos</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 rounded-2xl border-2 border-dashed border-border bg-muted/30 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            onBlur={handleAutoSave}
            placeholder={placeholder}
            className="rounded-xl border-border bg-background h-11 font-bold text-sm"
          />
          {showPrice && (
            <Select 
              value={newItem.priceType} 
              onValueChange={(v: "free" | "paid") => setNewItem({ ...newItem, priceType: v })}
            >
              <SelectTrigger className="rounded-xl border-border bg-background h-11 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background rounded-xl">
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {showPrice && newItem.priceType === "paid" && (
            <Input
              type="number"
              value={newItem.price}
              onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
              onBlur={handleAutoSave}
              placeholder="Price (KSh) *"
              className="rounded-xl border-border bg-background h-11 font-bold text-sm"
            />
          )}
          {showCapacity && (
            <Input
              type="number"
              value={newItem.capacity}
              onChange={(e) => setNewItem({ ...newItem, capacity: e.target.value })}
              onBlur={handleAutoSave}
              placeholder="Capacity *"
              className="rounded-xl border-border bg-background h-11 font-bold text-sm"
            />
          )}
        </div>

        {showBookingLink && (
          <Input
            value={newItem.bookingLink}
            onChange={(e) => setNewItem({ ...newItem, bookingLink: e.target.value })}
            placeholder="External booking URL (https://...)"
            className="rounded-xl border-border bg-background h-11 font-bold text-sm"
          />
        )}

        {showAmenities && (
          <FacilityAmenitiesInput
            amenities={newItem.amenities || []}
            onChange={(amenities) => setNewItem({ ...newItem, amenities })}
          />
        )}

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Photos (max {maxImages})
          </Label>
          <div className="flex flex-wrap gap-2">
            {newItem.tempImages?.map((file, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeTempImage(idx)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            
            {(newItem.tempImages?.length || 0) < maxImages && (
              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-muted-foreground transition-colors bg-background">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-[8px] text-muted-foreground mt-0.5">Add</span>
              </label>
            )}
          </div>
        </div>

        <Button
          type="button"
          onClick={addItem}
          disabled={!isItemValid()}
          className="w-full rounded-xl h-11 font-black uppercase text-[10px] tracking-widest text-white"
          style={{ backgroundColor: accentColor }}
        >
          <Plus className="h-4 w-4 mr-2" /> Add {label.replace(/s$/, '')}
        </Button>
      </div>
    </div>
  );
};

export const uploadItemImages = async (
  items: DynamicItemWithImages[],
  userId: string,
  bucket: string = 'listing-images'
): Promise<DynamicItemWithImages[]> => {
  const uploadedItems: DynamicItemWithImages[] = [];

  for (const item of items) {
    const uploadedUrls: string[] = [...(item.images || [])];
    
    if (item.tempImages && item.tempImages.length > 0) {
      for (const file of item.tempImages) {
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const { error } = await supabase.storage.from(bucket).upload(fileName, file);
        
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
          uploadedUrls.push(publicUrl);
        }
      }
    }

    uploadedItems.push({
      ...item,
      images: uploadedUrls,
      tempImages: []
    });
  }

  return uploadedItems;
};

export const formatItemsWithImagesForDB = (items: DynamicItemWithImages[]) => {
  return items.filter(item => item.name.trim()).map(item => ({
    name: item.name,
    price: item.priceType === "paid" ? parseFloat(item.price) || 0 : 0,
    is_free: item.priceType === "free",
    capacity: item.capacity ? parseInt(item.capacity) : null,
    images: item.images || [],
    amenities: item.amenities || [],
    ...(item.bookingLink ? { bookingLink: item.bookingLink } : {})
  }));
};
