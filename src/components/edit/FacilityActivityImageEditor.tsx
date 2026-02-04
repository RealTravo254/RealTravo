import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Camera, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { compressImages } from "@/lib/imageCompression";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FacilityWithImages {
  name: string;
  price: number;
  capacity?: number;
  images?: string[];
  is_free?: boolean;
}

interface ActivityWithImages {
  name: string;
  price: number;
  images?: string[];
  is_free?: boolean;
}

interface FacilityActivityImageEditorProps {
  type: "facility" | "activity";
  items: (FacilityWithImages | ActivityWithImages)[];
  onChange: (items: (FacilityWithImages | ActivityWithImages)[]) => void;
  userId: string;
  onSave: () => Promise<void>;
  isSaving?: boolean;
  accentColor?: string;
}

export const FacilityActivityImageEditor = ({
  type,
  items,
  onChange,
  userId,
  onSave,
  isSaving = false,
  accentColor = "#008080"
}: FacilityActivityImageEditorProps) => {
  const { toast } = useToast();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleImageUpload = async (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const item = items[index];
    const currentImages = item.images || [];
    
    if (currentImages.length >= 5) {
      toast({
        title: "Maximum images reached",
        description: "Each item can have up to 5 images",
        variant: "destructive"
      });
      return;
    }

    const filesToAdd = Array.from(files).slice(0, 5 - currentImages.length);
    setUploadingIndex(index);

    try {
      const compressed = await compressImages(filesToAdd);
      const uploadedUrls: string[] = [...currentImages];

      for (const file of compressed) {
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const { error } = await supabase.storage
          .from('listing-images')
          .upload(fileName, file.file);

        if (!error) {
          const { data: { publicUrl } } = supabase.storage
            .from('listing-images')
            .getPublicUrl(fileName);
          uploadedUrls.push(publicUrl);
        }
      }

      const updatedItems = [...items];
      updatedItems[index] = { ...updatedItems[index], images: uploadedUrls };
      onChange(updatedItems);

      toast({ title: "Images uploaded", description: `${compressed.length} image(s) added` });
    } catch (error) {
      toast({ title: "Upload failed", description: "Could not upload images", variant: "destructive" });
    } finally {
      setUploadingIndex(null);
      if (fileInputRefs.current[index]) {
        fileInputRefs.current[index]!.value = "";
      }
    }
  };

  const removeImage = (itemIndex: number, imageIndex: number) => {
    const updatedItems = [...items];
    const currentImages = updatedItems[itemIndex].images || [];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      images: currentImages.filter((_, i) => i !== imageIndex)
    };
    onChange(updatedItems);
  };

  const updateItemField = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    onChange(updatedItems);
  };

  const addItem = () => {
    const newItem: FacilityWithImages | ActivityWithImages = type === "facility" 
      ? { name: "", price: 0, capacity: 1, images: [] }
      : { name: "", price: 0, images: [] };
    onChange([...items, newItem]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-3">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {type === "facility" ? "Facilities" : "Activities"} ({items.length})
        </Label>
      </div>

      {items.length > 0 && (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div 
              key={index} 
              className="p-4 rounded-xl bg-muted/50 border border-border space-y-3"
            >
              {/* Item name and price row */}
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <Input
                    value={item.name}
                    onChange={(e) => updateItemField(index, "name", e.target.value)}
                    placeholder={type === "facility" ? "Facility name" : "Activity name"}
                    className="h-9 text-sm font-bold"
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={item.price}
                      onChange={(e) => updateItemField(index, "price", parseFloat(e.target.value) || 0)}
                      placeholder="Price"
                      className="h-8 text-sm w-24"
                    />
                    {type === "facility" && (
                      <Input
                        type="number"
                        value={(item as FacilityWithImages).capacity || 1}
                        onChange={(e) => updateItemField(index, "capacity", parseInt(e.target.value) || 1)}
                        placeholder="Capacity"
                        className="h-8 text-sm w-20"
                      />
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeItem(index)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Images section */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Photos ({item.images?.length || 0}/5)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {item.images?.map((url, imgIndex) => (
                    <div key={imgIndex} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index, imgIndex)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {(item.images?.length || 0) < 5 && (
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-muted-foreground transition-colors bg-background">
                      <input
                        ref={el => fileInputRefs.current[index] = el}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleImageUpload(index, e.target.files)}
                        disabled={uploadingIndex === index}
                      />
                      {uploadingIndex === index ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <Camera className="h-5 w-5 text-muted-foreground" />
                      )}
                    </label>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={addItem}
          className="flex-1 rounded-xl h-10"
        >
          <Plus className="h-4 w-4 mr-2" /> Add {type === "facility" ? "Facility" : "Activity"}
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded-xl h-10 text-white"
          style={{ backgroundColor: accentColor }}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
};
