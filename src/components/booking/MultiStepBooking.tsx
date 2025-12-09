// src/components/MultiStepBooking.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Users, Loader2, CheckCircle2, Phone, CreditCard } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PaymentStatusDialog } from "./PaymentStatusDialog";
import { useMpesaPayment } from "@/hooks/useMpesaPayment";
import { cn } from "@/lib/utils"; // Assuming you have a cn utility

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
    itemId?: string;
    bookingType?: string;
    hostId?: string;
    onPaymentSuccess?: () => void; // This function should close the main popup
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
    mpesa_phone: string;
}

// Custom Teal color
const TEAL_COLOR = "#008080";

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
    itemId = "",
    bookingType = "",
    hostId = "",
    onPaymentSuccess, // This prop should be used to close the main dialog
}: MultiStepBookingProps) => {
    const { user } = useAuth();
    
    // Both logged-in users and guests see facilities step
    // Logged-in users: 4 steps (Date, Guests, Facilities, Summary)
    // Guests: 4 steps (Date, Guests, Facilities, Contact+Summary)
    const totalSteps = skipFacilitiesAndActivities ? (user ? 3 : 4) : 4;
    
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
        mpesa_phone: "",
    });

    // NEW STATE: Payment Method
    const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card'>('mpesa');

    // Track if payment succeeded for dialog close handling - persists even after reset
    const [paymentSucceeded, setPaymentSucceeded] = useState(false);

    // M-Pesa payment integration
    const { paymentStatus, errorMessage, initiatePayment, resetPayment, isPaymentInProgress } = useMpesaPayment({
        onSuccess: (bookingId) => {
            // Mark payment as succeeded so we can handle dialog close properly
            console.log('✅ Payment succeeded for booking:', bookingId);
            setPaymentSucceeded(true);
            
            // Auto-close after showing success message for 2 seconds
            setTimeout(() => {
                resetPayment();
                setPaymentSucceeded(false);
                if (onPaymentSuccess) {
                    onPaymentSuccess();
                }
            }, 2000);
        },
        onError: (error) => {
            console.log('❌ Payment failed:', error);
            setPaymentSucceeded(false);
        },
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
        
        // Validate facility dates in step 3 for all users
        if (currentStep === 3 && !skipFacilitiesAndActivities && formData.selectedFacilities.length > 0 && !areFacilityDatesValid()) {
            return;
        }
        
        // When skipping facilities, go directly to summary step
        if (currentStep === 2 && skipFacilitiesAndActivities) {
            setCurrentStep(totalSteps);
            return;
        }
        
        setCurrentStep(Math.min(currentStep + 1, totalSteps));
    };

    const handlePrevious = () => {
        // Handle going back when skipping facilities
        if (skipFacilitiesAndActivities && currentStep === totalSteps) {
            setCurrentStep(2);
            return;
        }
        
        const minStep = skipDateSelection ? 2 : 1;
        setCurrentStep(Math.max(currentStep - 1, minStep));
    };

    const handleSubmit = async () => {
        const totalAmount = calculateTotal();
        
        // If total is 0, it's a free booking - skip payment
        if (totalAmount === 0) {
            await onSubmit(formData);
            if (onPaymentSuccess) onPaymentSuccess(); // Complete free booking and close popup
            return;
        }
        
        if (paymentMethod === 'card') {
            // NOTE: In a real application, 'card' submission would trigger a payment gateway redirect (e.g., Stripe, PayPal).
            // For this example, we'll simulate a simple form submission for card.
            alert("Card payment selected. Integration required.");
            // For now, we will stop here to only focus on M-Pesa.
            return;
        }


        // Initiate M-Pesa payment
        const bookingData = {
            item_id: itemId,
            booking_type: bookingType,
            total_amount: totalAmount,
            booking_details: {
                adults: formData.num_adults,
                children: formData.num_children,
                selectedFacilities: formData.selectedFacilities,
                selectedActivities: formData.selectedActivities,
            },
            user_id: user?.id || null,
            is_guest_booking: !user,
            guest_name: formData.guest_name,
            guest_email: formData.guest_email,
            guest_phone: formData.guest_phone || undefined,
            visit_date: formData.visit_date,
            slots_booked: formData.num_adults + formData.num_children,
            payment_method: 'mpesa',
            payment_phone: formData.mpesa_phone,
            host_id: hostId,
            emailData: {
                itemName,
            },
        };

        await initiatePayment(formData.mpesa_phone, totalAmount, bookingData);
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
                <Loader2 className="h-12 w-12 animate-spin text-primary" style={{ color: TEAL_COLOR }} />
                <p className="text-lg font-semibold">Saving your booking...</p>
                <p className="text-sm text-muted-foreground">Please wait</p>
            </div>
        );
    }

    // Completion Screen (Only shown if isCompleted is true, typically used for free bookings or after payment success/failure state is handled)
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

    const isMpesaSelected = calculateTotal() > 0 && paymentMethod === 'mpesa';
    const isCardSelected = calculateTotal() > 0 && paymentMethod === 'card';
    
    const total = calculateTotal();

    return (
        <div className="space-y-6 max-w-lg mx-auto p-4 sm:p-6 border rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-center">Book Your Visit to {itemName}</h2>
            
            {/* Progress Indicator */}
            <div className="flex items-center justify-between mb-6">
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                    <div
                        key={step}
                        className={`h-2 flex-1 mx-1 rounded-full transition-colors duration-300 ${
                            step <= currentStep ? 'bg-primary' : 'bg-muted'
                        }`}
                        style={{ backgroundColor: step <= currentStep ? TEAL_COLOR : undefined }}
                    />
                ))}
            </div>

            {/* Step 1: Visit Date */}
            {currentStep === 1 && !skipDateSelection && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="h-5 w-5" style={{ color: TEAL_COLOR }} />
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
                        <Users className="h-5 w-5" style={{ color: TEAL_COLOR }} />
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

            {/* Step 3: Facilities & Activities (for all users) */}
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
                                                <span className="text-sm font-bold" style={{ color: TEAL_COLOR }}>KES {facility.price} / day</span>
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
                                                <span className="text-sm font-bold" style={{ color: TEAL_COLOR }}>KES {activity.price} / person</span>
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

                    <div className="p-4 rounded-lg" style={{ backgroundColor: `${TEAL_COLOR}1A` }}>
                        <p className="text-sm font-medium" style={{ color: TEAL_COLOR }}>Total Add-ons:</p>
                        <p className="text-sm" style={{ color: TEAL_COLOR }}>
                            {formData.selectedFacilities.length} Facility(s), {formData.selectedActivities.length} Activity(s)
                        </p>
                    </div>
                </div>
            )}

            {/* Step 4: Summary (or Step 3 if skipping facilities) */}
            {currentStep === totalSteps ? (
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold">
                        Step {totalSteps}: Review & Submit
                    </h3>
                    
                    {!user && (
                        <div className="space-y-4">
                            {/* Contact Information (Guest only) */}
                            <div className="space-y-4 border p-4 rounded-lg">
                                <h4 className="font-medium">Contact Details</h4>
                                <div>
                                    <Label htmlFor="guest_name">Full Name *</Label>
                                    <Input
                                        id="guest_name"
                                        value={formData.guest_name}
                                        onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                                        className="mt-2"
                                        required
                                        placeholder="Enter your full name"
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
                                        placeholder="Enter your email"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="guest_phone">Phone Number (Optional)</Label>
                                    <Input
                                        id="guest_phone"
                                        type="tel"
                                        value={formData.guest_phone}
                                        onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                                        className="mt-2"
                                        placeholder="e.g., 0712345678"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Optional - We may use this to contact you about your booking</p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Booking Summary */}
                    <div className="p-4 rounded-lg space-y-2 border" style={{ backgroundColor: `${TEAL_COLOR}1A`, borderColor: TEAL_COLOR }}>
                        <p className="text-sm font-medium" style={{ color: TEAL_COLOR }}>Booking for {itemName}</p>
                        <p className="text-sm" style={{ color: TEAL_COLOR }}>Date: {formData.visit_date}</p>
                        <p className="text-sm" style={{ color: TEAL_COLOR }}>
                            Guests: {formData.num_adults} Adult(s), {formData.num_children} Child(ren)
                        </p>
                        {(formData.selectedFacilities.length > 0 || formData.selectedActivities.length > 0) && (
                            <p className="text-xs opacity-80" style={{ color: TEAL_COLOR }}>
                                {formData.selectedFacilities.length} Facility(s), {formData.selectedActivities.length} Activity(s) added
                            </p>
                        )}
                        <div className="border-t pt-2 mt-2" style={{ borderColor: `${TEAL_COLOR}80` }}>
                            <p className="text-xl font-bold" style={{ color: TEAL_COLOR }}>Total: KES {total.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Payment Method Selection */}
                    {total > 0 && (
                        <div className="space-y-3 pt-3 border-t">
                            <h4 className="font-semibold">Select Payment Method *</h4>
                            <div className="flex gap-4">
                                <Button
                                    onClick={() => setPaymentMethod('mpesa')}
                                    variant={paymentMethod === 'mpesa' ? 'default' : 'outline'}
                                    className={cn("flex-1 text-base h-12", paymentMethod === 'mpesa' ? "text-white" : "border-gray-300")}
                                    style={{ backgroundColor: paymentMethod === 'mpesa' ? TEAL_COLOR : undefined, borderColor: paymentMethod === 'mpesa' ? TEAL_COLOR : undefined }}
                                >
                                    <Phone className="mr-2 h-5 w-5" /> M-Pesa
                                </Button>
                                <Button
                                    onClick={() => setPaymentMethod('card')}
                                    variant={paymentMethod === 'card' ? 'default' : 'outline'}
                                    className={cn("flex-1 text-base h-12", paymentMethod === 'card' ? "text-white" : "border-gray-300")}
                                    style={{ backgroundColor: paymentMethod === 'card' ? TEAL_COLOR : undefined, borderColor: paymentMethod === 'card' ? TEAL_COLOR : undefined }}
                                    disabled // Card payment is not yet implemented
                                >
                                    <CreditCard className="mr-2 h-5 w-5" /> Card
                                </Button>
                            </div>

                            {isMpesaSelected && (
                                <div className="space-y-2 pt-2">
                                    <Label htmlFor="mpesa_phone_final">M-Pesa Phone Number *</Label>
                                    <Input
                                        id="mpesa_phone_final"
                                        type="tel"
                                        value={formData.mpesa_phone}
                                        onChange={(e) => setFormData({ ...formData, mpesa_phone: e.target.value })}
                                        placeholder="e.g., 0712345678"
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-muted-foreground">Enter the phone number to receive M-Pesa payment prompt</p>
                                </div>
                            )}
                            {isCardSelected && (
                                <p className="text-sm text-yellow-600">Card payment selected. You will be redirected to the payment gateway on submission.</p>
                            )}
                        </div>
                    )}
                </div>
            ) : null}


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
                        style={{ backgroundColor: TEAL_COLOR }}
                        disabled={
                            (currentStep === 1 && !formData.visit_date && !skipDateSelection) ||
                            (currentStep === 2 && formData.num_adults === 0 && formData.num_children === 0) ||
                            (currentStep === 3 && !skipFacilitiesAndActivities && !user && formData.selectedFacilities.length > 0 && !areFacilityDatesValid())
                        }
                    >
                        Next
                    </Button>
                ) : (
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        className="ml-auto w-40"
                        style={{ backgroundColor: TEAL_COLOR }}
                        disabled={
                            isProcessing || 
                            isPaymentInProgress ||
                            !formData.guest_name || 
                            !formData.guest_email ||
                            (isMpesaSelected && !formData.mpesa_phone)
                        }
                    >
                        {isProcessing || isPaymentInProgress ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : total > 0 ? (
                            paymentMethod === 'mpesa' ? 'Pay with M-Pesa' : 'Proceed to Card Payment'
                        ) : (
                            'Confirm Booking'
                        )}
                    </Button>
                )}
            </div>

            {/* Payment Status Dialog */}
            <PaymentStatusDialog
                open={paymentStatus !== 'idle' || paymentSucceeded}
                status={paymentSucceeded ? 'success' : paymentStatus}
                errorMessage={errorMessage}
                onClose={() => {
                    // Check if payment succeeded before resetting
                    const wasSuccessful = paymentSucceeded || paymentStatus === 'success';
                    console.log('Dialog closing - wasSuccessful:', wasSuccessful, 'paymentSucceeded:', paymentSucceeded, 'paymentStatus:', paymentStatus);
                    
                    // Reset states
                    resetPayment();
                    setPaymentSucceeded(false);
                    
                    // If payment was successful, call the parent's close function
                    if (wasSuccessful && onPaymentSuccess) {
                        console.log('Calling onPaymentSuccess callback');
                        onPaymentSuccess(); 
                    }
                }}
                onRetry={() => {
                    setPaymentSucceeded(false);
                    resetPayment();
                }}
            />
        </div>
    );
};