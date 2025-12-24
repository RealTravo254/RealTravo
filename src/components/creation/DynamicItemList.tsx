import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Trash2 } from "lucide-react";

export interface DynamicItem {
  name: string;
  priceType: "free" | "paid";
  price: string;
  capacity?: string;
}

interface DynamicItemListProps {
  items: DynamicItem[];
  onChange: (items: DynamicItem[]) => void;
  label: string;
  placeholder?: string;
  showCapacity?: boolean;
  accentColor?: string;
}

export const DynamicItemList = ({
  items,
  onChange,
  label,
  placeholder = "Item name",
  showCapacity = false,
  accentColor = "#008080"
}: DynamicItemListProps) => {
  const [newItem, setNewItem] = useState<DynamicItem>({
    name: "",
    priceType: "free",
    price: "0",
    capacity: ""
  });

  const addItem = () => {
    if (!newItem.name.trim()) return;
    onChange([...items, { ...newItem }]);
    setNewItem({ name: "", priceType: "free", price: "0", capacity: "" });
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</Label>
      
      {/* Added items list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div 
              key={index} 
              className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100"
            >
              <div className="flex-1">
                <span className="font-bold text-sm">{item.name}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span 
                    className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                    style={{ 
                      backgroundColor: item.priceType === "free" ? "#10b98120" : "#f59e0b20",
                      color: item.priceType === "free" ? "#10b981" : "#f59e0b"
                    }}
                  >
                    {item.priceType === "free" ? "Free" : `KSh ${item.price}`}
                  </span>
                  {showCapacity && item.capacity && (
                    <span className="text-[10px] font-bold text-slate-400">
                      Cap: {item.capacity}
                    </span>
                  )}
                </div>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                onClick={() => removeItem(index)}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 p-1 h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new item form */}
      <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            placeholder={placeholder}
            className="rounded-xl border-slate-100 bg-white h-11 font-bold text-sm"
          />
          <Select 
            value={newItem.priceType} 
            onValueChange={(v: "free" | "paid") => setNewItem({ ...newItem, priceType: v })}
          >
            <SelectTrigger className="rounded-xl border-slate-100 bg-white h-11 font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white rounded-xl">
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {newItem.priceType === "paid" && (
            <Input
              type="number"
              value={newItem.price}
              onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
              placeholder="Price (KSh)"
              className="rounded-xl border-slate-100 bg-white h-11 font-bold text-sm"
            />
          )}
          {showCapacity && (
            <Input
              type="number"
              value={newItem.capacity}
              onChange={(e) => setNewItem({ ...newItem, capacity: e.target.value })}
              placeholder="Capacity (optional)"
              className="rounded-xl border-slate-100 bg-white h-11 font-bold text-sm"
            />
          )}
        </div>

        <Button
          type="button"
          onClick={addItem}
          disabled={!newItem.name.trim()}
          className="w-full rounded-xl h-11 font-black uppercase text-[10px] tracking-widest text-white"
          style={{ backgroundColor: accentColor }}
        >
          <Plus className="h-4 w-4 mr-2" /> Add {label.replace(/s$/, '')}
        </Button>
      </div>
    </div>
  );
};
