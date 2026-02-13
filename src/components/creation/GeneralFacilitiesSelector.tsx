import { Label } from "@/components/ui/label";
import { Wifi, Car, UtensilsCrossed, Waves, PawPrint, Wine, Shirt, Sparkles, Ban, DollarSign, Coffee } from "lucide-react";

export interface GeneralFacility {
  id: string;
  label: string;
  icon: React.ElementType;
  variant?: "free" | "paid";
}

export const AVAILABLE_FACILITIES: GeneralFacility[] = [
  { id: "wifi_free", label: "WiFi (Free)", icon: Wifi, variant: "free" },
  { id: "wifi_paid", label: "WiFi (Paid)", icon: Wifi, variant: "paid" },
  { id: "parking_free", label: "Parking (Free)", icon: Car, variant: "free" },
  { id: "parking_paid", label: "Parking (Paid)", icon: Car, variant: "paid" },
  { id: "breakfast_free", label: "Breakfast (Free)", icon: Coffee, variant: "free" },
  { id: "breakfast_paid", label: "Breakfast (Paid)", icon: Coffee, variant: "paid" },
  { id: "car_wash", label: "Car Wash", icon: Car },
  { id: "swimming_pool", label: "Swimming Pool (Free)", icon: Waves, variant: "free" },
  { id: "balcony", label: "Balcony", icon: Sparkles },
  { id: "pet_allowed", label: "Pet Allowed", icon: PawPrint },
  { id: "no_pet", label: "No Pets", icon: Ban },
  { id: "bar_lounge", label: "Bar / Lounge", icon: Wine },
  { id: "restaurant", label: "Restaurant", icon: UtensilsCrossed },
  { id: "laundry_free", label: "Laundry (Free)", icon: Shirt, variant: "free" },
  { id: "laundry_paid", label: "Laundry (Paid)", icon: Shirt, variant: "paid" },
  { id: "spa", label: "Spa", icon: Sparkles },
];

interface GeneralFacilitiesSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  maxSelection?: number;
  accentColor?: string;
}

export const GeneralFacilitiesSelector = ({
  selected,
  onChange,
  maxSelection = 6,
  accentColor = "#008080"
}: GeneralFacilitiesSelectorProps) => {
  const toggleFacility = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else if (selected.length < maxSelection) {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          General Facilities (max {maxSelection})
        </Label>
        <span className="text-[10px] font-bold text-slate-400">{selected.length}/{maxSelection}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {AVAILABLE_FACILITIES.map((facility) => {
          const isSelected = selected.includes(facility.id);
          const Icon = facility.icon;
          return (
            <button
              key={facility.id}
              type="button"
              onClick={() => toggleFacility(facility.id)}
              disabled={!isSelected && selected.length >= maxSelection}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-transparent text-white shadow-md'
                  : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
              style={isSelected ? { backgroundColor: accentColor } : {}}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-tight leading-tight">{facility.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const getFacilityById = (id: string): GeneralFacility | undefined => {
  return AVAILABLE_FACILITIES.find(f => f.id === id);
};