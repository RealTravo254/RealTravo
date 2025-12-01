// src/components/MultiStepBooking.tsx
import { useState, useEffect } from "react";
// Assuming you are using Shadcn UI components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Users, Loader2, CreditCard, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext"; // Assuming this path is correct
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
  entranceType?: string; // e.g., "paid", "free"
  isProcessing?: boolean;
  isCompleted?: boolean;
  itemName: string;
  skipDateSelection?: boolean; // Skip date selection for fixed-date items
  fixedDate?: string; // Pre-set date for fixed-date items
  skipFacilitiesAndActivities?: boolean; // Skip facilities/activities for trips and events
  checkoutRequestId?: string; // For tracking payment status
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
  payment_method: string; // "mpesa", "card"
  payment_phone: string;
  card_number: string;
  card_expiry: string;
  card_cvv: string;
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
  checkoutRequestId = "",
}: MultiStepBookingProps) => {
  // Use the custom Auth hook
  const { user } = useAuth();
  
  // State for step management and form data (start at step 2 if skipping date selection)
  const [currentStep, setCurrentStep] = useState(skipDateSelection ? 2 : 1);
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [paymentMessage, setPaymentMessage] = useState<string>("");
  const [formData, setFormData] = useState<BookingFormData>({
    visit_date: skipDateSelection ? fixedDate : "",
    num_adults: 1,
    num_children: 0,
    selectedFacilities: [],
    selectedActivities: [],
    // Pre-fill user data if available - will fetch from profiles
    guest_name: "",
    guest_email: user?.email || "",
    guest_phone: "",
    payment_method: "mpesa",
    payment_phone: "",
    card_number: "",
    card_expiry: "",
    card_cvv: "",
  });

  // Fetch user profile data for name
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setFormData(prev => ({
            ...prev,
            guest_name: profile.name || "",
            guest_email: profile.email || user.email || "",
          }));
        }
      }
    };
    
    fetchUserProfile();
  }, [user]);

  // Listen for real-time payment status updates
  useEffect(() => {
    if (!checkoutRequestId || !isProcessing) return;

    const channel = supabase
      .channel(`payment-${checkoutRequestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_payments',
          filter: `checkout_request_id=eq.${checkoutRequestId}`,
        },
        (payload: any) => {
          const newData = payload.new;
          if (newData && newData.payment_status) {
            const status = newData.payment_status;
            const resultCode = newData.result_code;
            
            if (status === 'completed' || resultCode === '0') {
              setPaymentStatus('success');
              setPaymentMessage('Payment Successful! Your booking is confirmed.');
            } else if (resultCode === '1032') {
              setPaymentStatus('cancelled');
              setPaymentMessage('Payment Cancelled. You cancelled the payment on your phone.');
            } else if (resultCode === '2001') {
              setPaymentStatus('error');
              setPaymentMessage('Unable to Process. Wrong PIN entered.');
            } else if (status === 'failed') {
              setPaymentStatus('failed');
              setPaymentMessage('Payment Failed. Please try again or contact support.');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkoutRequestId, isProcessing]);

  // Total steps including the conditional guest info step
  const totalSteps = 5;

  // Function to check if all selected facilities have valid start/end dates
  const areFacilityDatesValid = () => {
    return formData.selectedFacilities.every(f => {
      // Must have both start and end dates filled
      if (!f.startDate || !f.endDate) return false; 
      
      const start = new Date(f.startDate).getTime();
      const end = new Date(f.endDate).getTime();
      
      // End date must be >= Start date
      return end >= start;
    });
  };

  // --- Handlers for Navigation ---
  
  const handleNext = () => {
    // Basic validation checks for moving forward
    if (currentStep === 1 && !formData.visit_date && !skipDateSelection) return;
    if (currentStep === 2 && formData.num_adults === 0 && formData.num_children === 0) return;
    
    // **VALIDATION: Check facility dates on Step 3**
    if (currentStep === 3 && !skipFacilitiesAndActivities && formData.selectedFacilities.length > 0 && !areFacilityDatesValid()) {
      return;
    }
    
    // Skip facilities/activities step (Step 3) if not needed
    if (currentStep === 2 && skipFacilitiesAndActivities) {
      // If user is logged in, skip to payment (Step 5)
      if (user) {
        setCurrentStep(5);
      } else {
        // Otherwise go to guest info (Step 4)
        setCurrentStep(4);
      }
      return;
    }
    
    // Skip guest info step (Step 4) if user is logged in
    if (currentStep === 3 && user) {
      setCurrentStep(5);
    } else {
      setCurrentStep(Math.min(currentStep + 1, totalSteps));
    }
  };

  const handlePrevious = () => {
    // Handle going back from payment (Step 5)
    if (currentStep === 5) {
      if (skipFacilitiesAndActivities) {
        // If skipping facilities, go back to guest info or number of people
        setCurrentStep(user ? 2 : 4);
      } else if (user) {
        // If user logged in, skip guest info
        setCurrentStep(3);
      } else {
        setCurrentStep(4);
      }
      return;
    }
    
    // Handle going back from guest info (Step 4)
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

  // --- Handlers for Data Updates ---

  const toggleFacility = (facility: Facility) => {
    const exists = formData.selectedFacilities.find(f => f.name === facility.name);
    if (exists) {
      setFormData({
        ...formData,
        selectedFacilities: formData.selectedFacilities.filter(f => f.name !== facility.name),
      });
    } else {
      // NO DEFAULT DATE: Initialize start/end date to empty string
      setFormData({
        ...formData,
        selectedFacilities: [
          ...formData.selectedFacilities, 
          { 
            ...facility, 
            startDate: "", // Ensure no default date
            endDate: ""    // Ensure no default date
          }
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
        // Initialize with a default of 1 person
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

  // --- Calculation Logic ---

  const calculateTotal = () => {
    let total = 0;
    
    // 1. Entrance fees
    if (entranceType !== 'free') {
      total += (formData.num_adults * priceAdult) + (formData.num_children * priceChild);
    }
    
    // 2. Facilities (calculate by number of days if applicable)
    formData.selectedFacilities.forEach(f => {
      if (f.startDate && f.endDate) {
        const start = new Date(f.startDate).getTime();
        const end = new Date(f.endDate).getTime();
        
        // Only calculate if dates are valid (end >= start)
        if (end >= start) {
            const dayDifferenceMs = end - start;
            const days = Math.ceil(dayDifferenceMs / (1000 * 60 * 60 * 24));
            
            // Charge at least 1 day
            total += f.price * Math.max(days, 1);
        }
      } 
    });
    
    // 3. Activities
    formData.selectedActivities.forEach(a => {
      total += a.price * a.numberOfPeople;
    });
    
    return total;
  };

  // --- Rendering Conditional States ---

  // Loading/Processing Screen with real-time status updates
  if (isProcessing) {
    if (paymentStatus === 'success') {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <p className="text-xl font-bold text-green-600">Successful</p>
          <p className="text-sm text-muted-foreground text-center">{paymentMessage}</p>
        </div>
      );
    }
    
    if (paymentStatus === 'cancelled') {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-orange-600" />
          </div>
          <p className="text-xl font-bold text-orange-600">Cancelled</p>
          <p className="text-sm text-muted-foreground text-center">{paymentMessage}</p>
        </div>
      );
    }
    
    if (paymentStatus === 'error') {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-red-600" />
          </div>
          <p className="text-xl font-bold text-red-600">Unable to Process</p>
          <p className="text-sm text-muted-foreground text-center">{paymentMessage}</p>
        </div>
      );
    }
    
    if (paymentStatus === 'failed') {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-red-600" />
          </div>
          <p className="text-xl font-bold text-red-600">Failed</p>
          <p className="text-sm text-muted-foreground text-center">{paymentMessage}</p>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium">Processing Payment...</p>
        <p className="text-sm text-muted-foreground">Please confirm the payment on your phone</p>
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
        <p className="text-xl font-bold">Booking Confirmed! 🎉</p>
        <p className="text-sm text-muted-foreground text-center">Your booking for {itemName} has been successfully confirmed. You will receive a confirmation email shortly.</p>
      </div>
    );
  }

  // --- Main Form Rendering ---

  return (
    <div className="space-y-6 max-w-lg mx-auto p-4 sm:p-6 border rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center">Book Your Visit to {itemName}</h2>
      
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-6">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-2 flex-1 mx-1 rounded-full transition-colors duration-300 ${
              step <= currentStep ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* --- Step 1: Visit Date --- */}
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
              // Prevent selecting past dates
              min={new Date().toISOString().split('T')[0]} 
              onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
              className="mt-2"
            />
            {/* Validation Hint */}
            {!formData.visit_date && <p className="text-xs text-red-500 mt-1">Please select a date to proceed.</p>}
          </div>
        </div>
      )}

      {/* --- Step 2: Number of People --- */}
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

      {/* --- Step 3: Facilities & Activities --- */}
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
                                // Min should be the start date of the facility rental
                                min={selected.startDate || formData.visit_date || new Date().toISOString().split('T')[0]} 
                              />
                            </div>
                          </div>
                          {isDateInvalid && (
                             <p className="text-xs text-red-500 mt-2">Please select valid Start and End dates (End date must be the same or after Start date).</p>
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
              <p className="text-muted-foreground text-center p-4 bg-muted rounded-lg">No additional services available for this booking.</p>
          )}
          
          {!areFacilityDatesValid() && formData.selectedFacilities.length > 0 && (
            <div className="p-3 bg-red-100 border border-red-400 rounded-lg">
                <p className="text-sm font-medium text-red-700">Please review facility dates. All selected facilities require a valid Start and End date.</p>
            </div>
          )}

          <div className="p-4 bg-primary/10 rounded-lg">
            <p className="text-sm font-medium text-primary">Total Add-ons:</p>
            <p className="text-sm text-primary/80">
              {formData.selectedFacilities.length} Facility {formData.selectedFacilities.length !== 1 ? 'Rentals' : 'Rental'}, {formData.selectedActivities.length} Activit{formData.selectedActivities.length !== 1 ? 'ies' : 'y'}
            </p>
          </div>
        </div>
      )}

      {/* --- Step 4: Guest Information (if not logged in) --- */}
      {currentStep === 4 && !user && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Step 4: Your Contact Information</h3>
          <p className="text-sm text-muted-foreground">This info is used for booking confirmation and communication.</p>
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
            <Label htmlFor="guest_email">Email</Label>
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
            <Label htmlFor="guest_phone">Phone Number</Label>
            <Input
              id="guest_phone"
              type="tel"
              value={formData.guest_phone}
              onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
              className="mt-2"
              required
              placeholder="e.g., 10 DIGITS"
            />
          </div>
        </div>
      )}

      {/* --- Step 5: Payment --- */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Step 5: Review & Payment</h3>
          </div>
          
          {/* Booking Summary */}
          <div className="p-4 bg-primary/10 rounded-lg space-y-2 border border-primary">
            <p className="text-sm font-medium text-primary">Booking for {itemName} on {formData.visit_date}</p>
            <p className="text-sm text-primary/80">
              Guests: {formData.num_adults} Adult{formData.num_adults !== 1 ? 's' : ''}, {formData.num_children} Child{formData.num_children !== 1 ? 'ren' : ''}
            </p>
            {formData.selectedFacilities.length > 0 || formData.selectedActivities.length > 0 ? (
                <p className="text-xs text-primary/70">{formData.selectedFacilities.length} Facility(s), {formData.selectedActivities.length} Activity(s) added.</p>
            ) : null}
            <div className="border-t border-primary/30 pt-2 mt-2">
                <p className="text-xl font-bold text-primary">Total: KES {calculateTotal().toLocaleString()}</p>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-2">
            <Label>Select Payment Method</Label>
            <div className="grid grid-cols-2 gap-2"> 
              <Button
                type="button"
                variant={formData.payment_method === "mpesa" ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, payment_method: "mpesa" })}
              >
                M-Pesa
              </Button>
              <Button
                type="button"
                variant={formData.payment_method === "card" ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, payment_method: "card" })}
              >
                Card
              </Button>
            </div>
          </div>

          {/* Mobile Money Input */}
          {(formData.payment_method === "mpesa") && (
            <div>
              <Label htmlFor="payment_phone">Phone Number for Payment </Label>
              <Input
                id="payment_phone"
                type="tel"
                value={formData.payment_phone}
                onChange={(e) => setFormData({ ...formData, payment_phone: e.target.value })}
                placeholder="2547XXXXXXXX"
                className="mt-2"
                required
              />
            </div>
          )}

          {/* Card Details Input */}
          {formData.payment_method === "card" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="card_number">Card Number</Label>
                <Input
                  id="card_number"
                  value={formData.card_number}
                  onChange={(e) => setFormData({ ...formData, card_number: e.target.value })}
                  placeholder="1234 5678 9012 3456"
                  className="mt-2"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="card_expiry">Expiry (MM/YY) </Label>
                  <Input
                    id="card_expiry"
                    value={formData.card_expiry}
                    onChange={(e) => setFormData({ ...formData, card_expiry: e.target.value })}
                    placeholder="MM/YY"
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="card_cvv">CVV </Label>
                  <Input
                    id="card_cvv"
                    value={formData.card_cvv}
                    onChange={(e) => setFormData({ ...formData, card_cvv: e.target.value })}
                    placeholder="123"
                    className="mt-2"
                    required
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Navigation Buttons --- */}
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
              // Strict validation for facilities on Step 3
              (currentStep === 3 && !skipFacilitiesAndActivities && formData.selectedFacilities.length > 0 && !areFacilityDatesValid()) || 
              (currentStep === 4 && (!formData.guest_name || !formData.guest_email || !formData.guest_phone)) // Guest info validation
            }
          >
            Next
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            className="ml-auto w-40"
            disabled={isProcessing || calculateTotal() === 0 || 
                      // Payment validation
                      (formData.payment_method !== 'card' && !formData.payment_phone) ||
                      (formData.payment_method === 'card' && (!formData.card_number || !formData.card_expiry || !formData.card_cvv))
            }
          >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm Booking'}
          </Button>
        )}
      </div>
    </div>
  );
};