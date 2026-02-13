import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface FacilityAmenitiesInputProps {
  amenities: string[];
  onChange: (amenities: string[]) => void;
}

export const FacilityAmenitiesInput = ({ amenities, onChange }: FacilityAmenitiesInputProps) => {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addAmenities(inputValue);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addAmenities(inputValue);
    }
  };

  const addAmenities = (value: string) => {
    const newAmenities = value
      .split(",")
      .map(a => a.trim())
      .filter(a => a.length > 0 && !amenities.includes(a));
    
    if (newAmenities.length > 0) {
      onChange([...amenities, ...newAmenities]);
    }
    setInputValue("");
  };

  const removeAmenity = (index: number) => {
    onChange(amenities.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        Amenities (separate with comma)
      </Label>
      {amenities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {amenities.map((a, i) => (
            <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-700 px-2 py-1 rounded-full font-bold flex items-center gap-1">
              {a}
              <button type="button" onClick={() => removeAmenity(i)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="e.g. WiFi, TV, AC, Hot water"
        className="rounded-xl border-border bg-background h-9 font-bold text-sm"
      />
      <p className="text-[9px] text-muted-foreground">Press Enter or use commas to add multiple</p>
    </div>
  );
};