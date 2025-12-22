import { useState } from "react";
import { ManualBookingForm } from "./ManualBookingForm";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, PlusCircle, ClipboardList } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ManualBookingSectionProps {
  itemId: string;
  itemType: 'trip' | 'event' | 'hotel' | 'adventure' | 'adventure_place';
  itemName: string;
  totalCapacity: number;
  facilities?: Array<{ name: string; price: number }>;
  onBookingCreated: () => void;
}

export const ManualBookingSection = ({
  itemId,
  itemType,
  itemName,
  totalCapacity,
  facilities = [],
  onBookingCreated
}: ManualBookingSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-[28px] overflow-hidden shadow-sm border border-slate-100 mb-8">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-6 h-auto rounded-none hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#008080]/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-[#008080]" />
              </div>
              <div className="text-left">
                <p className="font-black text-sm uppercase tracking-tight text-slate-800">
                  Manual Entry
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Add offline bookings to sync inventory
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-[#008080]" />
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-6 pt-0 border-t border-slate-50">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <p className="text-xs font-bold text-amber-800">
                <strong>Important:</strong> Use this form to record walk-in guests or phone bookings. 
                This will update the online availability immediately to prevent double-booking.
              </p>
            </div>
            <ManualBookingForm
              itemId={itemId}
              itemType={itemType}
              itemName={itemName}
              totalCapacity={totalCapacity}
              facilities={facilities}
              onBookingCreated={onBookingCreated}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
