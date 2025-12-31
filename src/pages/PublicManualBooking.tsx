import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { Loader2, CheckCircle2, MapPin, Trash2, AlertTriangle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectedFacility {
  name: string;
  price: number;
  startDate: string;
  endDate: string;
}

interface ItemDetails {
  id: string;
  name: string;
  type: string;
  image_url: string;
  location: string;
  capacity: number;
  facilities: Array<{ name: string; price: number }>;
  tripDate?: string;
  isFlexibleDate?: boolean;
}

const PublicManualBooking = () => {
  const { itemId, itemType } = useParams<{ itemId: string; itemType: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [itemDetails, setItemDetails] = useState<ItemDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingEntries, setExistingEntries] = useState<any[]>([]);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [dateRangeAvailable, setDateRangeAvailable] = useState<boolean | null>(null);
  const [checkingDateRange, setCheckingDateRange] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    guestName: '',
    guestContact: '',
    slotsBooked: 1,
    visitDate: '',
  });
  const [selectedFacilities, setSelectedFacilities] = useState<SelectedFacility[]>([]);

  const isFacilityBased = itemType === 'hotel' || itemType === 'adventure' || itemType === 'adventure_place';

  useEffect(() => {
    if (!itemId || !itemType) {
      navigate('/');
      return;
    }
    fetchItemDetails();
  }, [itemId, itemType]);

  const fetchItemDetails = async () => {
    try {
      let data: any = null;

      if (itemType === 'trip' || itemType === 'event') {
        const { data: trip } = await supabase
          .from('trips')
          .select('*')
          .eq('id', itemId)
          .single();
        if (trip) {
          data = {
            id: trip.id,
            name: trip.name,
            type: trip.type || 'trip',
            image_url: trip.image_url,
            location: trip.location,
            capacity: trip.available_tickets || 0,
            facilities: [],
            tripDate: trip.date,
            isFlexibleDate: trip.is_flexible_date,
          };
        }
      } else if (itemType === 'hotel') {
        const { data: hotel } = await supabase
          .from('hotels')
          .select('*')
          .eq('id', itemId)
          .single();
        if (hotel) {
          data = {
            id: hotel.id,
            name: hotel.name,
            type: 'hotel',
            image_url: hotel.image_url,
            location: hotel.location,
            capacity: hotel.available_rooms || 0,
            facilities: Array.isArray(hotel.facilities) ? hotel.facilities : [],
          };
        }
      } else if (itemType === 'adventure' || itemType === 'adventure_place') {
        const { data: adventure } = await supabase
          .from('adventure_places')
          .select('*')
          .eq('id', itemId)
          .single();
        if (adventure) {
          data = {
            id: adventure.id,
            name: adventure.name,
            type: 'adventure',
            image_url: adventure.image_url,
            location: adventure.location,
            capacity: adventure.available_slots || 0,
            facilities: Array.isArray(adventure.facilities) ? adventure.facilities : [],
          };
        }
      }

      if (data) {
        setItemDetails(data);
        fetchExistingEntries();
      } else {
        toast({ title: "Error", description: "Item not found", variant: "destructive" });
        navigate('/');
      }
    } catch (error) {
      console.error('Error fetching item:', error);
      toast({ title: "Error", description: "Failed to load item details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingEntries = async () => {
    // Fetch from manual_entries table
    const { data: entries } = await supabase
      .from('manual_entries')
      .select('entry_details,visit_date,slots_booked')
      .eq('item_id', itemId)
      .in('status', ['confirmed', 'pending']);
    
    // Also check bookings table for paid bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('booking_details,visit_date,slots_booked')
      .eq('item_id', itemId)
      .in('status', ['confirmed', 'pending'])
      .in('payment_status', ['paid', 'completed']);
    
    setExistingEntries([...(entries || []), ...(bookings || [])]);
  };

  const checkDateRangeAvailability = useCallback(async (startDate: string, endDate: string) => {
    if (!startDate || !endDate || !isFacilityBased || !itemDetails) return;
    
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
      
      let allAvailable = true;
      for (const dateStr of dateStrings) {
        const bookedSlots = availabilityMap.get(dateStr) || 0;
        if (bookedSlots >= itemDetails.capacity) {
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
  }, [itemId, itemDetails?.capacity, isFacilityBased]);

  const checkFacilityOverlap = (facilityName: string, startDate: string, endDate: string): string | null => {
    if (!startDate || !endDate) return null;
    
    const newStart = new Date(startDate).getTime();
    const newEnd = new Date(endDate).getTime();

    for (const entry of existingEntries) {
      const details = (entry.entry_details || entry.booking_details) as any;
      const bookedFacilities = details?.selectedFacilities || details?.facilities || [];
      
      for (const bookedFacility of bookedFacilities) {
        if (bookedFacility.name === facilityName) {
          const bookedStart = new Date(bookedFacility.startDate || entry.visit_date).getTime();
          const bookedEnd = new Date(bookedFacility.endDate || entry.visit_date).getTime();
          
          if (newStart <= bookedEnd && newEnd >= bookedStart) {
            return `${facilityName} is already booked from ${format(new Date(bookedFacility.startDate || entry.visit_date), 'MMM d')} to ${format(new Date(bookedFacility.endDate || entry.visit_date), 'MMM d, yyyy')}`;
          }
        }
      }
    }
    return null;
  };

  const checkAvailability = async (dateStr: string) => {
    if (isFacilityBased || !itemDetails) return;
    
    try {
      const { data: availability } = await supabase
        .from('item_availability_by_date')
        .select('booked_slots')
        .eq('item_id', itemId)
        .eq('visit_date', dateStr)
        .maybeSingle();

      const bookedSlots = availability?.booked_slots || 0;
      const remaining = itemDetails.capacity - bookedSlots;
      setAvailableSlots(remaining);
      
      if (remaining <= 0) {
        setConflictError(`This date is fully booked`);
      } else {
        setConflictError(null);
      }
    } catch (error) {
      console.error('Error checking availability:', error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDetails) return;

    setConflictError(null);

    // Validations
    if (!formData.guestName.trim()) {
      toast({ title: "Required", description: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!formData.guestContact.trim()) {
      toast({ title: "Required", description: "Please enter phone or email", variant: "destructive" });
      return;
    }

    if (isFacilityBased) {
      if (selectedFacilities.length === 0) {
        toast({ title: "Required", description: "Please select at least one facility", variant: "destructive" });
        return;
      }
      for (const facility of selectedFacilities) {
        if (!facility.startDate || !facility.endDate) {
          toast({ title: "Required", description: `Please set dates for ${facility.name}`, variant: "destructive" });
          return;
        }
        const overlap = checkFacilityOverlap(facility.name, facility.startDate, facility.endDate);
        if (overlap) {
          setConflictError(overlap);
          return;
        }
      }
      if (dateRangeAvailable === false) {
        toast({ title: "Unavailable", description: "Selected dates are not available", variant: "destructive" });
        return;
      }
    } else {
      if (!formData.visitDate) {
        toast({ title: "Required", description: "Please select a date", variant: "destructive" });
        return;
      }
      if (availableSlots !== null && formData.slotsBooked > availableSlots) {
        setConflictError(`Only ${availableSlots} slots available`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const entryDetails: Record<string, any> = {
        source: 'public_form',
      };

      let primaryVisitDate = formData.visitDate || null;

      if (isFacilityBased) {
        entryDetails.selectedFacilities = selectedFacilities.map(f => ({
          name: f.name,
          price: f.price,
          startDate: f.startDate,
          endDate: f.endDate,
        }));
        const earliestDate = selectedFacilities.map(f => f.startDate).filter(Boolean).sort()[0];
        primaryVisitDate = earliestDate || null;
      }

      // Insert into manual_entries table
      const { error } = await supabase.from('manual_entries').insert({
        item_id: itemId,
        item_type: itemType === 'adventure_place' ? 'adventure' : itemType,
        guest_name: formData.guestName.trim(),
        guest_contact: formData.guestContact.trim(),
        slots_booked: isFacilityBased ? selectedFacilities.length : formData.slotsBooked,
        visit_date: primaryVisitDate,
        entry_details: entryDetails,
        status: 'pending',
      });

      if (error) throw error;

      setSubmitted(true);
    } catch (error: any) {
      console.error('Error creating entry:', error);
      toast({ title: "Error", description: error.message || "Failed to submit", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">
            Entry Submitted!
          </h1>
          <p className="text-slate-500 mb-6">
            Your entry for <strong>{itemDetails?.name}</strong> has been submitted. 
            The host will confirm your reservation soon.
          </p>
          <Button
            onClick={() => {
              setSubmitted(false);
              setFormData({ guestName: '', guestContact: '', slotsBooked: 1, visitDate: '' });
              setSelectedFacilities([]);
            }}
            className="bg-[#008080] hover:bg-[#006666] text-white rounded-xl"
          >
            Submit Another Entry
          </Button>
        </div>
      </div>
    );
  }

  if (!itemDetails) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with item image */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <img 
          src={itemDetails.image_url} 
          alt={itemDetails.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/70 bg-white/20 px-2 py-1 rounded">
            {itemDetails.type}
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight mt-2">
            {itemDetails.name}
          </h1>
          <div className="flex items-center gap-2 text-white/80 text-sm mt-1">
            <MapPin className="h-4 w-4" />
            {itemDetails.location}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-lg mx-auto p-6 -mt-6">
        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 mb-1">
            Reserve Your Spot
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Fill in your details to reserve
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Guest Details */}
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Your Name *
                </Label>
                <Input
                  value={formData.guestName}
                  onChange={(e) => setFormData(prev => ({ ...prev, guestName: e.target.value }))}
                  placeholder="John Doe"
                  className="rounded-xl border-slate-200 mt-1"
                  maxLength={100}
                />
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Phone / Email *
                </Label>
                <Input
                  value={formData.guestContact}
                  onChange={(e) => setFormData(prev => ({ ...prev, guestContact: e.target.value }))}
                  placeholder="+254... or email@example.com"
                  className="rounded-xl border-slate-200 mt-1"
                  maxLength={100}
                />
              </div>
            </div>

            {/* For Trips/Events - Date & Slots */}
            {!isFacilityBased && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Visit Date *
                  </Label>
                  <Input
                    type="date"
                    value={formData.visitDate}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, visitDate: e.target.value }));
                      if (e.target.value) checkAvailability(e.target.value);
                    }}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="rounded-xl border-slate-200 mt-1"
                  />
                  {availableSlots !== null && (
                    <div className={cn(
                      "flex items-center gap-2 mt-2 text-sm",
                      availableSlots > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {availableSlots > 0 ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      {availableSlots > 0 ? `${availableSlots} slots available` : 'Fully booked'}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Number of People
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={availableSlots || itemDetails.capacity}
                    value={formData.slotsBooked}
                    onChange={(e) => setFormData(prev => ({ ...prev, slotsBooked: parseInt(e.target.value) || 1 }))}
                    className="rounded-xl border-slate-200 mt-1"
                  />
                </div>
              </div>
            )}

            {/* For Hotels/Adventures - Facility Selection */}
            {isFacilityBased && itemDetails.facilities.length > 0 && (
              <div className="space-y-4">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Select Facilities *
                </Label>
                
                {/* Available facilities */}
                <div className="flex flex-wrap gap-2">
                  {itemDetails.facilities.map((f) => {
                    const isSelected = selectedFacilities.some(sf => sf.name === f.name);
                    return (
                      <Button
                        key={f.name}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => !isSelected && addFacility(f)}
                        disabled={isSelected}
                        className={cn(
                          "rounded-xl text-xs",
                          isSelected && "bg-[#008080] text-white"
                        )}
                      >
                        {f.name} - KES {f.price.toLocaleString()}/day
                      </Button>
                    );
                  })}
                </div>

                {/* Selected facilities with dates */}
                {selectedFacilities.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {selectedFacilities.map((facility, idx) => (
                      <div key={facility.name} className="bg-slate-50 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-sm text-slate-700">{facility.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFacility(idx)}
                            className="h-8 w-8 p-0 text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-[10px] text-slate-400">Check-in</Label>
                            <Input
                              type="date"
                              value={facility.startDate}
                              onChange={(e) => updateFacility(idx, 'startDate', e.target.value)}
                              min={format(new Date(), 'yyyy-MM-dd')}
                              className="rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-slate-400">Check-out</Label>
                            <Input
                              type="date"
                              value={facility.endDate}
                              onChange={(e) => updateFacility(idx, 'endDate', e.target.value)}
                              min={facility.startDate || format(new Date(), 'yyyy-MM-dd')}
                              className="rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Availability Indicator */}
                {checkingDateRange && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking availability...
                  </div>
                )}
                {dateRangeAvailable !== null && !checkingDateRange && (
                  <div className={cn(
                    "flex items-center gap-2 text-sm",
                    dateRangeAvailable ? "text-green-600" : "text-red-600"
                  )}>
                    {dateRangeAvailable ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    {dateRangeAvailable ? 'Dates available' : 'Dates not available'}
                  </div>
                )}
              </div>
            )}

            {/* Conflict Error */}
            {conflictError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{conflictError}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || dateRangeAvailable === false || (availableSlots !== null && availableSlots <= 0)}
              className="w-full bg-[#008080] hover:bg-[#006666] text-white py-6 rounded-2xl font-black uppercase tracking-widest"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Entry'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Your entry will be pending until confirmed by the host
        </p>
      </div>
    </div>
  );
};

export default PublicManualBooking;
