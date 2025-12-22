import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CalendarIcon, Loader2, AlertTriangle, CheckCircle2, UserPlus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";

interface Facility {
  name: string;
  price: number;
  startDate: string;
  endDate: string;
  customPrice: number;
}

interface ManualBookingFormProps {
  itemId: string;
  itemType: 'trip' | 'event' | 'hotel' | 'adventure' | 'adventure_place';
  itemName: string;
  totalCapacity: number;
  facilities?: Array<{ name: string; price: number }>;
  onBookingCreated: () => void;
}

export const ManualBookingForm = ({
  itemId,
  itemType,
  itemName,
  totalCapacity,
  facilities = [],
  onBookingCreated
}: ManualBookingFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<number | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Form state for slots-based bookings (trips/events)
  const [formData, setFormData] = useState({
    guestName: '',
    guestContact: '',
    slotsBooked: 1,
    visitDate: undefined as Date | undefined,
  });

  // Form state for facility-based bookings (hotels/adventures)
  const [selectedFacilities, setSelectedFacilities] = useState<Facility[]>([]);
  const [customFacility, setCustomFacility] = useState({ name: '', price: 0, startDate: '', endDate: '' });

  const isFacilityBased = itemType === 'hotel' || itemType === 'adventure' || itemType === 'adventure_place';
  const isDateBased = isFacilityBased;

  // Calculate total from selected facilities
  const calculateFacilityTotal = () => {
    return selectedFacilities.reduce((total, f) => {
      if (f.startDate && f.endDate) {
        const start = new Date(f.startDate).getTime();
        const end = new Date(f.endDate).getTime();
        if (end >= start) {
          const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
          return total + (f.customPrice * days);
        }
      }
      return total;
    }, 0);
  };

  const checkAvailability = async (date: Date) => {
    if (!isFacilityBased) {
      setCheckingAvailability(true);
      setConflictError(null);
      
      try {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        const { data: availability } = await supabase
          .from('item_availability_by_date')
          .select('booked_slots')
          .eq('item_id', itemId)
          .eq('visit_date', dateStr)
          .maybeSingle();

        const bookedSlots = availability?.booked_slots || 0;
        const remaining = totalCapacity - bookedSlots;
        
        setAvailableSlots(remaining);
        
        if (remaining <= 0) {
          setConflictError(`This date is fully booked (${bookedSlots}/${totalCapacity} slots taken)`);
        }
      } catch (error) {
        console.error('Error checking availability:', error);
      } finally {
        setCheckingAvailability(false);
      }
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setFormData(prev => ({ ...prev, visitDate: date }));
    if (date) {
      checkAvailability(date);
    } else {
      setAvailableSlots(null);
      setConflictError(null);
    }
  };

  const addFacilityFromPredefined = (facilityTemplate: { name: string; price: number }) => {
    const exists = selectedFacilities.find(f => f.name === facilityTemplate.name);
    if (!exists) {
      setSelectedFacilities(prev => [...prev, {
        name: facilityTemplate.name,
        price: facilityTemplate.price,
        startDate: '',
        endDate: '',
        customPrice: facilityTemplate.price, // Default to the predefined price
      }]);
    }
  };

  const addCustomFacility = () => {
    if (customFacility.name && customFacility.startDate && customFacility.endDate) {
      setSelectedFacilities(prev => [...prev, {
        name: customFacility.name,
        price: customFacility.price,
        startDate: customFacility.startDate,
        endDate: customFacility.endDate,
        customPrice: customFacility.price,
      }]);
      setCustomFacility({ name: '', price: 0, startDate: '', endDate: '' });
    }
  };

  const updateFacility = (index: number, field: keyof Facility, value: string | number) => {
    setSelectedFacilities(prev => prev.map((f, i) => 
      i === index ? { ...f, [field]: value } : f
    ));
  };

  const removeFacility = (index: number) => {
    setSelectedFacilities(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    // Validate based on booking type
    if (isFacilityBased) {
      if (!formData.guestName.trim()) {
        toast({ title: "Validation Error", description: "Guest name is required", variant: "destructive" });
        return;
      }
      if (!formData.guestContact.trim()) {
        toast({ title: "Validation Error", description: "Contact is required", variant: "destructive" });
        return;
      }
      if (selectedFacilities.length === 0) {
        toast({ title: "Validation Error", description: "Select at least one facility", variant: "destructive" });
        return;
      }
      // Validate all facilities have dates
      const invalidFacility = selectedFacilities.find(f => !f.startDate || !f.endDate);
      if (invalidFacility) {
        toast({ title: "Validation Error", description: `Please set dates for ${invalidFacility.name}`, variant: "destructive" });
        return;
      }
    } else {
      // Standard validation for trips/events
      if (!formData.guestName.trim() || !formData.guestContact.trim() || !formData.visitDate) {
        toast({ title: "Validation Error", description: "Please fill all required fields", variant: "destructive" });
        return;
      }
      if (availableSlots !== null && formData.slotsBooked > availableSlots) {
        setConflictError(`Only ${availableSlots} slots available. Reduce the number of slots.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const dateStr = formData.visitDate ? format(formData.visitDate, 'yyyy-MM-dd') : null;
      
      // For non-facility based, re-check availability
      if (!isFacilityBased && dateStr) {
        const { data: latestAvailability } = await supabase
          .from('item_availability_by_date')
          .select('booked_slots')
          .eq('item_id', itemId)
          .eq('visit_date', dateStr)
          .maybeSingle();

        const currentBooked = latestAvailability?.booked_slots || 0;
        const currentAvailable = totalCapacity - currentBooked;
        
        if (formData.slotsBooked > currentAvailable) {
          setConflictError(`Conflict Alert: Only ${currentAvailable} slots are now available.`);
          setIsSubmitting(false);
          return;
        }
      }

      // Build booking details
      const bookingDetails: Record<string, any> = {
        source: 'manual_entry',
        entered_by: 'host',
        notes: 'Manually entered offline booking',
      };

      let totalAmount = 0;
      let primaryVisitDate = dateStr;

      if (isFacilityBased) {
        // Add facility details with their specific dates
        bookingDetails.selectedFacilities = selectedFacilities.map(f => ({
          name: f.name,
          price: f.customPrice,
          startDate: f.startDate,
          endDate: f.endDate,
        }));
        totalAmount = calculateFacilityTotal();
        
        // Use the earliest facility start date as visit_date
        const earliestDate = selectedFacilities
          .map(f => f.startDate)
          .filter(Boolean)
          .sort()[0];
        primaryVisitDate = earliestDate || null;
      }

      // Insert manual booking
      // Note: total_amount is set for record keeping but payment_method='manual_entry' 
      // ensures it won't be counted in account balance (handled by existing triggers)
      const { error } = await supabase.from('bookings').insert({
        item_id: itemId,
        booking_type: itemType === 'adventure_place' ? 'adventure' : itemType,
        guest_name: formData.guestName.trim(),
        guest_email: formData.guestContact.includes('@') ? formData.guestContact.trim() : null,
        guest_phone: !formData.guestContact.includes('@') ? formData.guestContact.trim() : null,
        slots_booked: isFacilityBased ? selectedFacilities.length : formData.slotsBooked,
        visit_date: primaryVisitDate,
        total_amount: totalAmount, // Store for record keeping (no balance update for manual_entry)
        status: 'confirmed',
        payment_status: 'paid',
        payment_method: 'manual_entry', // This ensures no account balance increment
        is_guest_booking: true,
        booking_details: bookingDetails
      });

      if (error) {
        if (error.message.includes('Sold out') || error.message.includes('capacity')) {
          setConflictError('Conflict Alert: ' + error.message);
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Booking Added",
        description: `Manual booking for ${formData.guestName} has been recorded.`
      });

      // Reset form
      setFormData({ guestName: '', guestContact: '', slotsBooked: 1, visitDate: undefined });
      setSelectedFacilities([]);
      setAvailableSlots(null);
      onBookingCreated();
    } catch (error: any) {
      console.error('Error creating manual booking:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create booking",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Guest Name */}
        <div className="space-y-2">
          <Label htmlFor="guestName" className="text-xs font-black uppercase tracking-widest text-slate-500">
            Guest Name *
          </Label>
          <Input
            id="guestName"
            value={formData.guestName}
            onChange={(e) => setFormData(prev => ({ ...prev, guestName: e.target.value }))}
            placeholder="John Doe"
            className="rounded-xl border-slate-200"
            maxLength={100}
          />
        </div>

        {/* Contact (Phone/Email) */}
        <div className="space-y-2">
          <Label htmlFor="guestContact" className="text-xs font-black uppercase tracking-widest text-slate-500">
            Phone / Email *
          </Label>
          <Input
            id="guestContact"
            value={formData.guestContact}
            onChange={(e) => setFormData(prev => ({ ...prev, guestContact: e.target.value }))}
            placeholder="+254... or email@example.com"
            className="rounded-xl border-slate-200"
            maxLength={100}
          />
        </div>
      </div>

      {/* Facility-based booking (Hotels/Adventures) */}
      {isFacilityBased ? (
        <div className="space-y-4">
          <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
            Facilities / Rooms *
          </Label>

          {/* Predefined Facilities */}
          {facilities.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Select from available facilities:</p>
              <div className="flex flex-wrap gap-2">
                {facilities.filter(f => f.price > 0).map((f) => {
                  const isSelected = selectedFacilities.some(sf => sf.name === f.name);
                  return (
                    <Button
                      key={f.name}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => isSelected ? null : addFacilityFromPredefined(f)}
                      className={cn(
                        "rounded-xl text-xs",
                        isSelected && "bg-[#008080] hover:bg-[#008080]"
                      )}
                      disabled={isSelected}
                    >
                      {f.name} (KES {f.price.toLocaleString()}/day)
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Facilities with Date Ranges and Custom Pricing */}
          {selectedFacilities.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Selected facilities:</p>
              {selectedFacilities.map((facility, index) => (
                <div key={index} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-700">{facility.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFacility(index)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Start Date *</Label>
                      <Input
                        type="date"
                        value={facility.startDate}
                        onChange={(e) => updateFacility(index, 'startDate', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="mt-1 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">End Date *</Label>
                      <Input
                        type="date"
                        value={facility.endDate}
                        onChange={(e) => updateFacility(index, 'endDate', e.target.value)}
                        min={facility.startDate || new Date().toISOString().split('T')[0]}
                        className="mt-1 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Price/Day (KES)</Label>
                      <Input
                        type="number"
                        value={facility.customPrice}
                        onChange={(e) => updateFacility(index, 'customPrice', parseFloat(e.target.value) || 0)}
                        min={0}
                        className="mt-1 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Custom Facility */}
          <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Or add a custom facility:</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="Facility name"
                value={customFacility.name}
                onChange={(e) => setCustomFacility(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-xl"
              />
              <Input
                type="date"
                value={customFacility.startDate}
                onChange={(e) => setCustomFacility(prev => ({ ...prev, startDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                className="rounded-xl"
              />
              <Input
                type="date"
                value={customFacility.endDate}
                onChange={(e) => setCustomFacility(prev => ({ ...prev, endDate: e.target.value }))}
                min={customFacility.startDate || new Date().toISOString().split('T')[0]}
                className="rounded-xl"
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Price/day"
                  value={customFacility.price || ''}
                  onChange={(e) => setCustomFacility(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  min={0}
                  className="rounded-xl flex-1"
                />
                <Button
                  type="button"
                  onClick={addCustomFacility}
                  disabled={!customFacility.name || !customFacility.startDate || !customFacility.endDate}
                  className="rounded-xl bg-[#008080] hover:bg-[#006666]"
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Total Amount Display */}
          {selectedFacilities.length > 0 && (
            <div className="p-4 rounded-xl bg-[#008080]/10 border border-[#008080]/20">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-widest text-[#008080]">Total Amount</span>
                <span className="text-xl font-black text-[#008080]">KES {calculateFacilityTotal().toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">This amount is for record keeping only. Manual bookings don't update account balance.</p>
            </div>
          )}
        </div>
      ) : (
        /* Slots-based booking (Trips/Events) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Visit Date */}
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
              {isDateBased ? 'Visit Date *' : 'Event Date *'}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal rounded-xl border-slate-200",
                    !formData.visitDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.visitDate ? format(formData.visitDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.visitDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Slots/Guests */}
          <div className="space-y-2">
            <Label htmlFor="slotsBooked" className="text-xs font-black uppercase tracking-widest text-slate-500">
              Guests/Slots *
            </Label>
            <Input
              id="slotsBooked"
              type="number"
              min={1}
              max={totalCapacity}
              value={formData.slotsBooked}
              onChange={(e) => setFormData(prev => ({ ...prev, slotsBooked: Math.max(1, parseInt(e.target.value) || 1) }))}
              className="rounded-xl border-slate-200"
            />
          </div>
        </div>
      )}

      {/* Availability Status (for slots-based only) */}
      {!isFacilityBased && formData.visitDate && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-xl text-sm font-bold",
          checkingAvailability ? "bg-slate-100 text-slate-500" :
          conflictError ? "bg-red-50 text-red-700 border border-red-200" :
          availableSlots !== null && availableSlots > 0 ? "bg-green-50 text-green-700 border border-green-200" :
          "bg-slate-100"
        )}>
          {checkingAvailability ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Checking availability...</>
          ) : conflictError ? (
            <><AlertTriangle className="h-4 w-4" /> {conflictError}</>
          ) : availableSlots !== null && availableSlots > 0 ? (
            <><CheckCircle2 className="h-4 w-4" /> {availableSlots} of {totalCapacity} slots available</>
          ) : null}
        </div>
      )}

      {/* Conflict Error for Facility-based */}
      {isFacilityBased && conflictError && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-bold bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle className="h-4 w-4" /> {conflictError}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting || checkingAvailability || (conflictError !== null && !isFacilityBased && availableSlots === 0)}
        className="w-full rounded-xl py-6 font-black uppercase tracking-widest text-xs"
        style={{ background: '#008080' }}
      >
        {isSubmitting ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Adding Booking...</>
        ) : (
          <><UserPlus className="h-4 w-4 mr-2" /> Add Manual Booking</>
        )}
      </Button>
    </form>
  );
};
