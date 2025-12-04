// src/components/MultiStepBooking.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Users, Loader2, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Facility {
  name: string;
  price: number;
  capacity?: number;
}

interface Activity {
  name: string;
  price: number;
}

interface MultiStepBookingProps {
  onSubmit: (data: BookingFormData) => Promise<void>;
  facilities?: Facility[];
  activities?: Activity[];
  priceAdult?: number;
  priceChild?: number;
  entranceType?: string;
  isProcessing?: boolean;
  isCompleted?: boolean;
  itemName: string;
  skipDateSelection?: boolean;
  fixedDate?: string;
  skipFacilitiesAndActivities?: boolean;
}

export interface BookingFormData {
  visit_date: string;
  num_adults: number;
  num_children: number;
  selectedFacilities: Array<{ name: string; price: number; capacity?: number; startDate?: string; endDate?: string }>;
  selectedActivities: Array<{ name: string; price: number; numberOfPeople: number }>;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
}

export const MultiStepBooking = ({
  onSubmit,
  facilities = [],
  activities = [],
  priceAdult = 0,
  priceChild = 0,
  entranceType = "paid",
  isProcessing = false,
  isCompleted = false,
  itemName,
  skipDateSelection = false,
  fixedDate = "",
  skipFacilitiesAndActivities = false,
}: MultiStepBookingProps) => {
  const { user } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(skipDateSelection ? 2 : 1);
  const [formData, setFormData] = useState<BookingFormData>({
    visit_date: skipDateSelection ? fixedDate : "",
    num_adults: 1,
    num_children: 0,
    selectedFacilities: [],
    selectedActivities: [],
    guest_name: "",
    guest_email: user?.email || "",
    guest_phone: "",
  });

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email, phone_number')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setFormData(prev => ({
            ...prev,
            guest_name: profile.name || "",
            guest_email: profile.email || user.email || "",
            guest_phone: profile.phone_number || "",
          }));
        }
      }
    };
    
    fetchUserProfile();
  }, [user]);

  const totalSteps = 4;

  const areFacilityDatesValid = () => {
    return formData.selectedFacilities.every(f => {
      if (!f.startDate || !f.endDate) return false; 
      const start = new Date(f.startDate).getTime();
      const end = new Date(f.endDate).getTime();
      return end >= start;
    });
  };

  const handleNext = () => {
    if (currentStep === 1 && !formData.visit_date && !skipDateSelection) return;
    if (currentStep === 2 && formData.num_adults === 0 && formData.num_children === 0) return;
    
    if (currentStep === 3 && !skipFacilitiesAndActivities && formData.selectedFacilities.length > 0 && !areFacilityDatesValid()) {
      return;
    }
    
    if (currentStep === 2 && skipFacilitiesAndActivities) {
      if (user) {
        setCurrentStep(4);
      } else {
        setCurrentStep(4);
      }
      return;
    }
    
    setCurrentStep(Math.min(currentStep + 1, totalSteps));
  };

  const handlePrevious = () => {
    if (currentStep === 4 && skipFacilitiesAndActivities) {
      setCurrentStep(2);
      return;
    }
    
    const minStep = skipDateSelection ? 2 : 1;
    setCurrentStep(Math.max(currentStep - 1, minStep));
  };

  const handleSubmit = async () => {
    await onSubmit(formData);
  };

  const toggleFacility = (facility: Facility) => {
    const exists = formData.selectedFacilities.find(f => f.name === facility.name);
    if (exists) {
      setFormData({
        ...formData,
        selectedFacilities: formData.selectedFacilities.filter(f => f.name !== facility.name),
      });
    } else {
      setFormData({
        ...formData,
        selectedFacilities: [
          ...formData.selectedFacilities, 
          { ...facility, startDate: "", endDate: "" }
        ],
      });
    }
  };

  const toggleActivity = (activity: Activity) => {
    const exists = formData.selectedActivities.find(a => a.name === activity.name);
    if (exists) {
      setFormData({
        ...formData,
        selectedActivities: formData.selectedActivities.filter(a => a.name !== activity.name),
      });
    } else {
      setFormData({
        ...formData,
        selectedActivities: [...formData.selectedActivities, { ...activity, numberOfPeople: 1 }],
      });
    }
  };

  const updateActivityPeople = (name: string, count: number) => {
    setFormData({
      ...formData,
      selectedActivities: formData.selectedActivities.map(a =>
        a.name === name ? { ...a, numberOfPeople: Math.max(1, count) } : a
      ),
    });
  };

  const updateFacilityDates = (name: string, field: 'startDate' | 'endDate', value: string) => {
    setFormData({
      ...formData,
      selectedFacilities: formData.selectedFacilities.map(f =>
        f.name === name ? { ...f, [field]: value } : f
      ),
    });
  };

  const calculateTotal = () => {
    let total = 0;
    
    if (entranceType !== 'free') {
      total += (formData.num_adults * priceAdult) + (formData.num_children * priceChild);
    }
    
    formData.selectedFacilities.forEach(f => {
      if (f.startDate && f.endDate) {
        const start = new Date(f.startDate).getTime();
        const end = new Date(f.endDate).getTime();
        if (end >= start) {
          const dayDifferenceMs = end - start;
          const days = Math.ceil(dayDifferenceMs / (1000 * 60 * 60 * 24));
          total += f.price * Math.max(days, 1);
        }
      } 
    });
    
    formData.selectedActivities.forEach(a => {
      total += a.price * a.numberOfPeople;
    });
    
    return total;
  };

  // Processing Screen
  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-semibold">Saving your booking...</p>
        <p className="text-sm text-muted-foreground">Please wait</p>
      </div>
    );
  }

  // Completion Screen
  if (isCompleted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <p className="text-xl font-bold">Booking Submitted!</p>
        <p className="text-sm text-muted-foreground text-center">
          Your booking for {itemName} has been saved. Payment is pending.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto p-4 sm:p-6 border rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center">Book Your Visit to {itemName}</h2>
      
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-6">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-2 flex-1 mx-1 rounded-full transition-colors duration-300 ${
              step <= currentStep ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Visit Date */}
      {currentStep === 1 && !skipDateSelection && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Step 1: Select Visit Date</h3>
          </div>
          <div>
            <Label htmlFor="visit_date">Visit Date</Label>
            <Input
              id="visit_date"
              type="date"
              value={formData.visit_date}
              min={new Date().toISOString().split('T')[0]} 
              onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
              className="mt-2"
            />
            {!formData.visit_date && <p className="text-xs text-red-500 mt-1">Please select a date to proceed.</p>}
          </div>
        </div>
      )}

      {/* Step 2: Number of People */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Step 2: Number of Guests</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="adults">Adults (Age 18+)</Label>
              <Input
                id="adults"
                type="number"
                min="0"
                value={formData.num_adults}
                onChange={(e) => setFormData({ ...formData, num_adults: parseInt(e.target.value) || 0 })}
                className="mt-2"
              />
              {entranceType !== 'free' && priceAdult > 0 && (
                 <p className="text-xs text-muted-foreground mt-1">KES {priceAdult} each</p>
              )}
            </div>
            <div>
              <Label htmlFor="children">Children</Label>
              <Input
                id="children"
                type="number"
                min="0"
                value={formData.num_children}
                onChange={(e) => setFormData({ ...formData, num_children: parseInt(e.target.value) || 0 })}
                className="mt-2"
              />
              {entranceType !== 'free' && priceChild > 0 && (
                 <p className="text-xs text-muted-foreground mt-1">KES {priceChild} each</p>
              )}
            </div>
          </div>
          <div className="mt-4 p-4 bg-muted rounded">
            <p className="text-sm font-medium">Guest Count: {formData.num_adults + formData.num_children} total</p>
            {(formData.num_adults === 0 && formData.num_children === 0) && (
              <p className="text-xs text-red-500">You must include at least one guest.</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Facilities & Activities */}
      {currentStep === 3 && !skipFacilitiesAndActivities && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Step 3: Additional Services (Optional)</h3>
          
          {facilities.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 border-b pb-1">Facilities</h4>
              <div className="space-y-4">
                {facilities.map((facility) => {
                  const selected = formData.selectedFacilities.find(f => f.name === facility.name);
                  const isDateInvalid = selected && (
                    !selected.startDate || 
                    !selected.endDate || 
                    new Date(selected.endDate).getTime() < new Date(selected.startDate).getTime()
                  );

                  return (
                    <div key={facility.name} className="space-y-2 p-3 border rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`facility-${facility.name}`}
                            checked={!!selected}
                            onCheckedChange={() => toggleFacility(facility)}
                          />
                          <Label htmlFor={`facility-${facility.name}`} className="text-base font-medium cursor-pointer">
                            {facility.name}
                          </Label>
                        </div>
                        <span className="text-sm font-bold text-primary">KES {facility.price} / day</span>
                      </div>
                      {selected && (
                        <div className="ml-6 pt-2">
                          <p className="text-sm font-medium mb-2">Rental Period *</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Start Date</Label>
                              <Input
                                type="date"
                                placeholder="Start Date"
                                value={selected.startDate || ""}
                                onChange={(e) => updateFacilityDates(facility.name, 'startDate', e.target.value)}
                                min={formData.visit_date || new Date().toISOString().split('T')[0]}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">End Date</Label>
                              <Input
                                type="date"
                                placeholder="End Date"
                                value={selected.endDate || ""}
                                onChange={(e) => updateFacilityDates(facility.name, 'endDate', e.target.value)}
                                min={selected.startDate || formData.visit_date || new Date().toISOString().split('T')[0]} 
                              />
                            </div>
                          </div>
                          {isDateInvalid && (
                             <p className="text-xs text-red-500 mt-2">Please select valid Start and End dates.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activities.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 border-b pb-1">Activities</h4>
              <div className="space-y-4">
                {activities.map((activity) => {
                  const selected = formData.selectedActivities.find(a => a.name === activity.name);
                  return (
                    <div key={activity.name} className="space-y-2 p-3 border rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`activity-${activity.name}`}
                            checked={!!selected}
                            onCheckedChange={() => toggleActivity(activity)}
                          />
                          <Label htmlFor={`activity-${activity.name}`} className="text-base font-medium cursor-pointer">
                            {activity.name}
                          </Label>
                        </div>
                        <span className="text-sm font-bold text-primary">KES {activity.price} / person</span>
                      </div>
                      {selected && (
                        <div className="ml-6 pt-2">
                          <Label className="text-xs">Number of People</Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="Number of people"
                            value={selected.numberOfPeople}
                            onChange={(e) => updateActivityPeople(activity.name, parseInt(e.target.value) || 1)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {(facilities.length === 0 && activities.length === 0) && (
              <p className="text-muted-foreground text-center p-4 bg-muted rounded-lg">No additional services available.</p>
          )}
          
          {!areFacilityDatesValid() && formData.selectedFacilities.length > 0 && (
            <div className="p-3 bg-red-100 border border-red-400 rounded-lg">
                <p className="text-sm font-medium text-red-700">Please review facility dates.</p>
            </div>
          )}

          <div className="p-4 bg-primary/10 rounded-lg">
            <p className="text-sm font-medium text-primary">Total Add-ons:</p>
            <p className="text-sm text-primary/80">
              {formData.selectedFacilities.length} Facility(s), {formData.selectedActivities.length} Activity(s)
            </p>
          </div>
        </div>
      )}

      {/* Step 4: Contact Info & Summary */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Step 4: Contact Info & Summary</h3>
          
          {/* Contact Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="guest_name">Full Name *</Label>
              <Input
                id="guest_name"
                value={formData.guest_name}
                onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="guest_email">Email *</Label>
              <Input
                id="guest_email"
                type="email"
                value={formData.guest_email}
                onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="guest_phone">Phone Number *</Label>
              <Input
                id="guest_phone"
                type="tel"
                value={formData.guest_phone}
                onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                className="mt-2"
                required
                placeholder="e.g., 0712345678"
              />
            </div>
          </div>
          
          {/* Booking Summary */}
          <div className="p-4 bg-primary/10 rounded-lg space-y-2 border border-primary">
            <p className="text-sm font-medium text-primary">Booking for {itemName}</p>
            <p className="text-sm text-primary/80">Date: {formData.visit_date}</p>
            <p className="text-sm text-primary/80">
              Guests: {formData.num_adults} Adult(s), {formData.num_children} Child(ren)
            </p>
            {(formData.selectedFacilities.length > 0 || formData.selectedActivities.length > 0) && (
              <p className="text-xs text-primary/70">
                {formData.selectedFacilities.length} Facility(s), {formData.selectedActivities.length} Activity(s) added
              </p>
            )}
            <div className="border-t border-primary/30 pt-2 mt-2">
              <p className="text-xl font-bold text-primary">Total: KES {calculateTotal().toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Payment pending</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between gap-4 mt-6 pt-6 border-t">
        {currentStep > (skipDateSelection ? 2 : 1) && (
          <Button type="button" variant="outline" onClick={handlePrevious} className="w-24">
            Previous
          </Button>
        )}
        
        {currentStep < totalSteps ? (
          <Button
            type="button"
            onClick={handleNext}
            className={`w-24 ${currentStep === 1 || currentStep === 2 ? 'ml-auto' : ''}`}
            disabled={
              (currentStep === 1 && !formData.visit_date && !skipDateSelection) ||
              (currentStep === 2 && formData.num_adults === 0 && formData.num_children === 0) ||
              (currentStep === 3 && !skipFacilitiesAndActivities && formData.selectedFacilities.length > 0 && !areFacilityDatesValid())
            }
          >
            Next
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            className="ml-auto w-40"
            disabled={
              isProcessing || 
              !formData.guest_name || 
              !formData.guest_email || 
              !formData.guest_phone
            }
          >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Submit Booking'}
          </Button>
        )}
      </div>
    </div>
  );
};
