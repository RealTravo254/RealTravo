import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardPlus } from "lucide-react";
import { ManualBookingForm } from "@/components/host/ManualBookingForm";
import type { ListingItem } from "@/components/ListingGrid";

interface ManualBookingDialogProps {
  items: ListingItem[];
  defaultItemId?: string;
  triggerClassName?: string;
  onBookingCreated?: () => void;
}

const typeLabel: Record<string, string> = {
  trip: "Trip",
  event: "Event",
  hotel: "Hotel",
  adventure: "Adventure",
  adventure_place: "Adventure place",
};

export const ManualBookingDialog = ({
  items,
  defaultItemId,
  triggerClassName,
  onBookingCreated,
}: ManualBookingDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(defaultItemId || items[0]?.id || "");

  // keep selection valid if the list or default changes
  useEffect(() => {
    if (defaultItemId) setSelectedId(defaultItemId);
    else if (!items.some((i) => i.id === selectedId)) setSelectedId(items[0]?.id || "");
  }, [defaultItemId, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => items.find((i) => i.id === selectedId), [items, selectedId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          className={`gap-2 rounded-xl text-xs bg-[#008080] hover:bg-[#006666] ${triggerClassName ?? ""}`}
        >
          <ClipboardPlus className="h-4 w-4" />
          Manual Booking
        </Button>
      </DialogTrigger>

      <DialogContent className="rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-black uppercase tracking-tight">
            Add Manual Booking
          </DialogTitle>
          <DialogDescription>
            Record an offline booking. Choose the item first, then fill in the guest details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Item *
            </Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select the item to book" />
              </SelectTrigger>
              <SelectContent>
                {items.length === 0 && (
                  <div className="p-3 text-sm text-slate-500">No listings yet.</div>
                )}
                {items.map((item) => (
                  <SelectItem key={`${item.type}-${item.id}`} value={item.id}>
                    {item.name} · {typeLabel[item.type] ?? item.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected ? (
            // key forces a fresh form (and fresh availability fetch) per item
            <ManualBookingForm
              key={selected.id}
              itemId={selected.id}
              itemType={selected.type}
              itemName={selected.name}
              totalCapacity={selected.totalCapacity}
              facilities={selected.facilities}
              activities={selected.activities}
              tripDate={selected.tripDate}
              isFlexibleDate={selected.isFlexibleDate}
              onBookingCreated={() => {
                onBookingCreated?.();
                setOpen(false);
              }}
            />
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
              Select an item above to open its booking form.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};