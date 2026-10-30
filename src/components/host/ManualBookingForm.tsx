import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { CalendarIcon, Loader2, AlertTriangle, CheckCircle2, UserPlus, Trash2, Lock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvailabilityIndicator } from "@/components/booking/AvailabilityIndicator";

interface SelectedFacility {
  name: string;
  price: number;
  startDate: string;
  endDate: string;
}

interface SelectedActivity {
  name: string;
  price: number;
  numberOfPeople: number;
}

interface ManualBookingFormProps {
  itemId: string;
  itemType: 'trip' | 'event' | 'hotel' | 'adventure' | 'adventure_place';
  itemName: string;
  totalCapacity: number;
  facilities?: Array<{ name: string; price: number }>;
  activities?: Array<{ name: string; price: number }>;
  tripDate?: string | null;
  isFlexibleDate?: boolean;
  onBookingCreated: () => void;
}

export const ManualBookingForm = ({
  itemId,
  itemType,
  itemName,
  totalCapacity,
  facilities = [],
  activities = [],
  tripDate,
  isFlexibleDate = false,
  onBookingCreated
}: ManualBookingFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<number | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [existingEntries, setExistingEntries] = useState<any[]>([]);
  
  // Date range availability state for hotels/adventures
  const [dateRangeAvailable, setDateRangeAvailable] = useState<boolean | null>(null);
  const [checkingDateRange, setCheckingDateRange] = useState(false);

  // Form state for slots-based bookings (trips/events)
  const [formData, setFormData] = useState({
    guestName: '',
    guestContact: '',
    slotsBooked: 1,
    visitDate: undefined as Date | undefined,
  });

  // Form state for facility-based bookings (hotels/adventures)
  const [selectedFacilities, setSelectedFacilities] = useState<SelectedFacility[]>([]);
  
  // Activities state - default to true (checked)
  const [includeActivities, setIncludeActivities] = useState(true);
  const [selectedActivities, setSelectedActivities] = useState<SelectedActivity[]>([]);

  const isFacilityBased = itemType === 'hotel' || itemType === 'adventure' || itemType === 'adventure_place';
  const isTrip = itemType === 'trip' || itemType === 'event';
  const hasFixedDate = isTrip && tripDate && !isFlexibleDate;

  // Set the fixed date for trips with fixed dates
  useEffect(() => {
    if (hasFixedDate && tripDate) {
      setFormData(prev => ({ ...prev, visitDate: new Date(tripDate) }));
      checkAvailability(new Date(tripDate));
    }
  }, [hasFixedDate, tripDate]);

  // Fetch existing bookings AND manual_entries for overlap check
  useEffect(() => {
    fetchExistingData();
  }, [itemId]);

  const fetchExistingData = async () => {
    // Fetch from bookings table
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('booking_details,visit_date')
      .eq('item_id', itemId)
      .in('status', ['confirmed', 'pending'])
      .in('payment_status', ['paid', 'completed', 'pending']);
    
    // Fetch from manual_entries table
    const { data: entriesData } = await supabase
      .from('manual_entries')
      .select('entry_details,visit_date,status')
      .eq('item_id', itemId)
      .in('status', ['pending', 'confirmed']);
    
    setExistingBookings(bookingsData || []);
    setExistingEntries(entriesData || []);
  };

  // Check date range availability when facility dates change
  const checkDateRangeAvailability = useCallback(async (startDate: string, endDate: string) => {
    if (!startDate || !endDate || !isFacilityBased) return;
    
    setCheckingDateRange(true);
    setDateRangeAvailable(null);
    
    try {
      const dates = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate),
      });
      const dateStrings = dates.map(d => format(d, 'yyyy-MM-dd'));
      
      const { data: availability } = await supabase
        .from('item_availability_by_date')
        .select('visit_date, booked_slots')
        .eq('item_id', itemId)
        .in('visit_date', dateStrings);
      
      const availabilityMap = new Map(
        (availability || []).map(a => [a.visit_date, a.booked_slots])
      );
      
      // Check if any date is fully booked
      let allAvailable = true;
      for (const dateStr of dateStrings) {
        const bookedSlots = availabilityMap.get(dateStr) || 0;
        if (bookedSlots >= totalCapacity) {
          allAvailable = false;
          break;
        }
      }
      
      setDateRangeAvailable(allAvailable);
    } catch (error) {
      console.error('Error checking date range:', error);
      setDateRangeAvailable(null);
    } finally {
      setCheckingDateRange(false);
    }
  }, [itemId, totalCapacity, isFacilityBased]);

  // Calculate total from selected facilities
  const calculateFacilityTotal = () => {
    return selectedFacilities.reduce((total, f) => {
      if (f.startDate && f.endDate) {
        const start = new Date(f.startDate).getTime();
        const end = new Date(f.endDate).getTime();
        if (end >= start) {
          const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
          return total + (f.price * days);
        }
      }
      return total;
    }, 0);
  };

  // Calculate activity total
  const calculateActivityTotal = () => {
    return selectedActivities.reduce((sum, a) => sum + (a.price * a.numberOfPeople), 0);
  };

  // Combined total
  const calculateTotal = () => {
    return calculateFacilityTotal() + calculateActivityTotal();
  };

  // Check if facility has date overlap with existing bookings AND manual entries
  const checkFacilityOverlap = (facilityName: string, startDate: string, endDate: string): string | null => {
    if (!startDate || !endDate) return null;
    
    const newStart = new Date(startDate).getTime();
    const newEnd = new Date(endDate).getTime();

    // Check bookings table
    for (const booking of existingBookings) {
      const details = booking.booking_details as any;
      const bookedFacilities = details?.selectedFacilities || details?.facilities || [];
      
      for (const bookedFacility of bookedFacilities) {
        if (bookedFacility.name === facilityName) {
          const bookedStart = new Date(bookedFacility.startDate || booking.visit_date).getTime();
          const bookedEnd = new Date(bookedFacility.endDate || booking.visit_date).getTime();
          
          if (newStart <= bookedEnd && newEnd >= bookedStart) {
            return `${facilityName} is already booked from ${format(new Date(bookedFacility.startDate || booking.visit_date), 'MMM d')} to ${format(new Date(bookedFacility.endDate || booking.visit_date), 'MMM d, yyyy')} (online booking)`;
          }
        }
      }
    }

    // Check manual_entries table
    for (const entry of existingEntries) {
      const details = entry.entry_details as any;
      const entryFacilities = details?.selectedFacilities || [];
      
      for (const entryFacility of entryFacilities) {
        if (entryFacility.name === facilityName) {
          const entryStart = new Date(entryFacility.startDate || entry.visit_date).getTime();
          const entryEnd = new Date(entryFacility.endDate || entry.visit_date).getTime();
          
          if (newStart <= entryEnd && newEnd >= entryStart) {
            return `${facilityName} is already booked from ${format(new Date(entryFacility.startDate || entry.visit_date), 'MMM d')} to ${format(new Date(entryFacility.endDate || entry.visit_date), 'MMM d, yyyy')} (manual entry)`;
          }
        }
      }
    }
    
    return null;
  };

  const checkAvailability = async (date: Date) => {
    if (!isFacilityBased) {
      setCheckingAvailability(true);
      setConflictError(null);
      
      try {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Check item_availability_by_date (aggregated from bookings)
        const { data: availability } = await supabase
          .from('item_availability_by_date')
          .select('booked_slots')
          .eq('item_id', itemId)
          .eq('visit_date', dateStr)
          .maybeSingle();

        // Also count manual entries for this date
        const { count: manualCount } = await supabase
          .from('manual_entries')
          .select('*', { count: 'exact', head: true })
          .eq('item_id', itemId)
          .eq('visit_date', dateStr)
          .in('status', ['pending', 'confirmed']);

        const bookedSlots = (availability?.booked_slots || 0) + (manualCount || 0);
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
    if (hasFixedDate) return;
    setFormData(prev => ({ ...prev, visitDate: date }));
    if (date) {
      checkAvailability(date);
    } else {
      setAvailableSlots(null);
      setConflictError(null);
    }
  };

  const addFacility = (facilityTemplate: { name: string; price: number }) => {
    const exists = selectedFacilities.find(f => f.name === facilityTemplate.name);
    if (!exists) {
      setSelectedFacilities(prev => [...prev, {
        name: facilityTemplate.name,
        price: facilityTemplate.price,
        startDate: '',
        endDate: '',
      }]);
    }
  };

  const updateFacility = (index: number, field: keyof SelectedFacility, value: string | number) => {
    setSelectedFacilities(prev => {
      const updated = prev.map((f, i) => i === index ? { ...f, [field]: value } : f);
      const facility = updated[index];
      if (field === 'startDate' || field === 'endDate') {
        setConflictError(null);
        setDateRangeAvailable(null);
        if (facility.startDate && facility.endDate) {
          const overlap = checkFacilityOverlap(facility.name, facility.startDate, facility.endDate);
          if (overlap) {
            setConflictError(overlap);
            setDateRangeAvailable(false);
          } else {
            checkDateRangeAvailability(facility.startDate, facility.endDate);
          }
        }
      }
      return updated;
    });
  };

  const removeFacility = (index: number) => {
    setSelectedFacilities(prev => prev.filter((_, i) => i !== index));
    setConflictError(null);
  };

  // Activity management
  const addActivity = (activity: { name: string; price: number }) => {
    const exists = selectedActivities.find(a => a.name === activity.name);
    if (!exists) {
      setSelectedActivities(prev => [...prev, {
        name: activity.name,
        price: activity.price,
        numberOfPeople: formData.slotsBooked || 1,
      }]);
    }
  };

  const updateActivity = (index: number, numberOfPeople: number) => {
    setSelectedActivities(prev => prev.map((a, i) => 
      i === index ? { ...a, numberOfPeople: Math.max(1, numberOfPeople) } : a
    ));
  };

  const removeActivity = (index: number) => {
    setSelectedActivities(prev => prev.filter((_, i) => i !== index));
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
      // Validate all facilities have dates and check for overlaps
      for (const facility of selectedFacilities) {
        if (!facility.startDate || !facility.endDate) {
          toast({ title: "Validation Error", description: `Please set dates for ${facility.name}`, variant: "destructive" });
          return;
        }
        const overlap = checkFacilityOverlap(facility.name, facility.startDate, facility.endDate);
        if (overlap) {
          setConflictError(overlap);
          toast({ title: "Booking Conflict", description: overlap, variant: "destructive" });
          return;
        }
      }
      
      if (dateRangeAvailable === false) {
        toast({ title: "Dates Unavailable", description: "The selected date range is not available.", variant: "destructive" });
        return;
      }
    } else {
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
      
      // Re-check availability for slots-based
      if (!isFacilityBased && dateStr) {
        const { data: latestAvailability } = await supabase
          .from('item_availability_by_date')
          .select('booked_slots')
          .eq('item_id', itemId)
          .eq('visit_date', dateStr)
          .maybeSingle();

        const { count: manualCount } = await supabase
          .from('manual_entries')
          .select('*', { count: 'exact', head: true })
          .eq('item_id', itemId)
          .eq('visit_date', dateStr)
          .in('status', ['pending', 'confirmed']);

        const currentBooked = (latestAvailability?.booked_slots || 0) + (manualCount || 0);
        const currentAvailable = totalCapacity - currentBooked;
        
        if (formData.slotsBooked > currentAvailable) {
          setConflictError(`Conflict Alert: Only ${currentAvailable} slots are now available.`);
          setIsSubmitting(false);
          return;
        }
      }

      // Build entry details
      const entryDetails: Record<string, any> = {
        source: 'manual_entry',
        entered_by: 'host',
        notes: 'Manually entered offline booking',
      };

      let totalAmount = 0;
      let primaryVisitDate = dateStr;

      if (isFacilityBased) {
        entryDetails.selectedFacilities = selectedFacilities.map(f => ({
          name: f.name,
          price: f.price,
          startDate: f.startDate,
          endDate: f.endDate,
        }));
        totalAmount = calculateFacilityTotal();
        
        const earliestDate = selectedFacilities
          .map(f => f.startDate)
          .filter(Boolean)
          .sort()[0];
        primaryVisitDate = earliestDate || null;
      }

      // Include activities if checkbox is checked and activities are selected
      if (includeActivities && selectedActivities.length > 0) {
        entryDetails.selectedActivities = selectedActivities.map(a => ({
          name: a.name,
          price: a.price,
          numberOfPeople: a.numberOfPeople,
          visitDate: primaryVisitDate,
        }));
        totalAmount += calculateActivityTotal();
      }

      entryDetails.totalAmount = totalAmount;

      // Map item_type for database constraint
      const dbItemType = itemType === 'adventure_place' ? 'adventure' : itemType;

      // INSERT INTO manual_entries TABLE (bypasses payment constraints)
      const { error } = await supabase.from('manual_entries').insert({
        item_id: itemId,
        item_type: dbItemType,
        guest_name: formData.guestName.trim(),
        guest_contact: formData.guestContact.trim(),
        slots_booked: isFacilityBased ? selectedFacilities.length : formData.slotsBooked,
        visit_date: primaryVisitDate,
        entry_details: entryDetails,
        status: 'confirmed', // Auto-confirm manual host entries
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
        title: "Entry Added",
        description: `Manual entry for ${formData.guestName} has been recorded.`
      });

      // Reset form
      setFormData({ guestName: '', guestContact: '', slotsBooked: 1, visitDate: hasFixedDate && tripDate ? new Date(tripDate) : undefined });
      setSelectedFacilities([]);
      setSelectedActivities([]);
      setAvailableSlots(null);
      fetchExistingData();
      onBookingCreated();
    } catch (error: any) {
      console.error('Error creating manual entry:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create entry",
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
            Select Facilities / Rooms *
          </Label>

          {facilities.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Available facilities (click to add):</p>
              <div className="flex flex-wrap gap-2">
                {facilities.map((f) => {
                  const isSelected = selectedFacilities.some(sf => sf.name === f.name);
                  return (
                    <Button
                      key={f.name}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => !isSelected && addFacility(f)}
                      className={cn(
                        "rounded-xl text-xs",
                        isSelected && "bg-[#008080] hover:bg-[#008080] cursor-not-allowed"
                      )}
                      disabled={isSelected}
                    >
                      {f.name} (KES {f.price.toLocaleString()}/day)
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              No facilities configured for this listing.
            </div>
          )}

          {/* Selected Facilities with Date Ranges */}
          {selectedFacilities.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Selected facilities:</p>
              {selectedFacilities.map((facility, index) => {
                // Calculate duration in days
                const durationDays = facility.startDate && facility.endDate
                  ? Math.max(1, Math.ceil((new Date(facility.endDate).getTime() - new Date(facility.startDate).getTime()) / (1000 * 60 * 60 * 24)))
                  : 0;
                const facilitySubtotal = durationDays * facility.price;

                return (
                  <div key={index} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-sm text-slate-700">{facility.name}</span>
                        <span className="ml-2 text-xs text-[#008080] font-bold">KES {facility.price.toLocaleString()}/day</span>
                      </div>
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    </div>

                    {/* Duration Display */}
                    {durationDays > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#008080]/10 border border-[#008080]/20">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-[#008080]" />
                          <span className="text-xs font-bold text-[#008080]">
                            {durationDays} {durationDays === 1 ? 'Day' : 'Days'} Booked
                          </span>
                        </div>
                        <span className="text-sm font-black text-[#008080]">
                          KES {facilitySubtotal.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {selectedFacilities.some(f => f.startDate && f.endDate) && (
                <AvailabilityIndicator
                  isAvailable={dateRangeAvailable}
                  loading={checkingDateRange}
                  itemName={itemName}
                  errorMessage={dateRangeAvailable === false ? 'Some dates in the selected range are fully booked.' : null}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        /* Slots-based booking (Trips/Events) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Visit Date */}
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              {itemType === 'event' ? 'Event Date' : 'Trip Date'} *
              {hasFixedDate && <Lock className="h-3 w-3 text-slate-400" />}
            </Label>
            {hasFixedDate ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 border border-slate-200">
                <CalendarIcon className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">
                  {tripDate ? format(new Date(tripDate), 'PPP') : 'No date set'}
                </span>
                <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase">Fixed Date</span>
              </div>
            ) : (
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
            )}
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

      {/* Activities Section */}
      {activities.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <Checkbox 
              id="includeActivities" 
              checked={includeActivities}
              onCheckedChange={(checked) => setIncludeActivities(checked === true)}
            />
            <Label htmlFor="includeActivities" className="text-xs font-black uppercase tracking-widest text-slate-500 cursor-pointer">
              Include Activities
            </Label>
          </div>

          {includeActivities && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Available activities (click to add):</p>
              <div className="flex flex-wrap gap-2">
                {activities.map((activity) => {
                  const isSelected = selectedActivities.some(a => a.name === activity.name);
                  return (
                    <Button
                      key={activity.name}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => !isSelected && addActivity(activity)}
                      className={cn(
                        "rounded-xl text-xs",
                        isSelected && "bg-[#FF7F50] hover:bg-[#FF7F50] cursor-not-allowed"
                      )}
                      disabled={isSelected}
                    >
                      {activity.name} (KES {activity.price.toLocaleString()}/person)
                    </Button>
                  );
                })}
              </div>

              {selectedActivities.length > 0 && (
                <div className="space-y-2">
                  {selectedActivities.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-200">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-700">{activity.name}</span>
                        <span className="text-xs text-orange-600">KES {activity.price}/person</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={activity.numberOfPeople}
                          onChange={(e) => updateActivity(index, parseInt(e.target.value) || 1)}
                          className="w-16 h-8 text-center rounded-lg text-xs"
                        />
                        <span className="text-xs text-slate-500">people</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeActivity(index)}
                          className="h-8 w-8 p-0 text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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

      {/* Total Amount Display */}
      {(selectedFacilities.length > 0 || selectedActivities.length > 0) && (
        <div className="p-4 rounded-xl bg-[#008080]/10 border border-[#008080]/20">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-widest text-[#008080]">Total Amount</span>
            <span className="text-xl font-black text-[#008080]">KES {calculateTotal().toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">For record keeping only. Manual entries bypass payment processing.</p>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting || checkingAvailability || (!isFacilityBased && conflictError !== null && availableSlots === 0) || (isFacilityBased && facilities.length === 0)}
        className="w-full rounded-xl py-6 font-black uppercase tracking-widest text-xs"
        style={{ background: '#008080' }}
      >
        {isSubmitting ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Adding Entry...</>
        ) : (
          <><UserPlus className="h-4 w-4 mr-2" /> Add Manual Entry</>
        )}
      </Button>
    </form>
  );
};
