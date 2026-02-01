// src/components/MultiStepBooking.tsx
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Users, Loader2, CheckCircle2, Phone, CreditCard, X, AlertTriangle, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PaymentStatusDialog } from "./PaymentStatusDialog";
import { useMpesaPayment } from "@/hooks/useMpesaPayment";
import { usePaystackPayment } from "@/hooks/usePaystackPayment";
import { cn } from "@/lib/utils";
import { useRealtimeItemAvailability } from "@/hooks/useRealtimeBookings";
import { useFacilityRangeAvailability } from "@/hooks/useDateRangeAvailability";

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
    onPaymentSuccess?: () => void;
    primaryColor?: string;
    accentColor?: string;
    totalCapacity?: number;
    // NEW: slotLimitType determines if capacity is inventory-based or per-booking limit
    slotLimitType?: 'inventory' | 'per_booking';
    // NEW: isFlexibleDate indicates if this is a flexible date trip
    isFlexibleDate?: boolean;
    // NEW: workingDays for date validation
    workingDays?: string[];
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
    onPaymentSuccess,
    primaryColor = "#008080",
    accentColor = "#FF7F50",
    totalCapacity = 0,
    slotLimitType = 'inventory',
    isFlexibleDate = false,
    workingDays = [],
}: MultiStepBookingProps) => {
    const { user } = useAuth();
    
    // Real-time availability check - prevents booking if sold out during booking flow
    // For per_booking limit type (flexible trips), we don't check global availability
    const { remainingSlots, isSoldOut } = useRealtimeItemAvailability(
        slotLimitType === 'inventory' ? (itemId || undefined) : undefined, 
        slotLimitType === 'inventory' ? totalCapacity : 0
    );
    
    // Facility availability checking
    const { checkFacilityAvailability, loading: checkingFacility } = useFacilityRangeAvailability(itemId || undefined);
    const [facilityAvailabilityStatus, setFacilityAvailabilityStatus] = useState<Record<string, { isAvailable: boolean; message: string | null }>>({});
    const [checkingAvailability, setCheckingAvailability] = useState(false);

    // Separate facilities and activities into sequential steps to reduce cognitive load
    const hasFacilities = facilities.filter(f => f.price > 0).length > 0;
    const hasActivities = activities.filter(a => a.price > 0).length > 0;
    
    // Calculate total steps:
    // Step 1: Date selection (unless skipped)
    // Step 2: Number of guests
    // Step 3: Facilities (if has facilities and not skipping)
    // Step 4: Activities (if has activities and not skipping)
    // Final step: Summary/Payment (adds +1 if guest user for contact details)
    const baseSteps = skipDateSelection ? 1 : 2; // guests step is always there
    const facilityStep = !skipFacilitiesAndActivities && hasFacilities ? 1 : 0;
    const activityStep = !skipFacilitiesAndActivities && hasActivities ? 1 : 0;
    const guestInfoStep = !user ? 1 : 0; // guest users need contact details
    const totalSteps = baseSteps + facilityStep + activityStep + 1; // +1 for summary/payment
    
    // Calculate which step number corresponds to what
    const dateStepNum = skipDateSelection ? 0 : 1;
    const guestsStepNum = skipDateSelection ? 1 : 2;
    const facilitiesStepNum = !skipFacilitiesAndActivities && hasFacilities ? guestsStepNum + 1 : 0;
    const activitiesStepNum = !skipFacilitiesAndActivities && hasActivities 
        ? (facilitiesStepNum > 0 ? facilitiesStepNum + 1 : guestsStepNum + 1) 
        : 0;
    const summaryStepNum = totalSteps;
    
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

    const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card'>('mpesa');
    const [paymentSucceeded, setPaymentSucceeded] = useState(false);

    const { paymentStatus, errorMessage, initiatePayment, resetPayment, isPaymentInProgress } = useMpesaPayment({
        onSuccess: (bookingId) => {
            console.log('✅ Payment succeeded for booking:', bookingId);
            setPaymentSucceeded(true);
            
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
            if (end < start) return false;
            // Check if facility is available
            const status = facilityAvailabilityStatus[f.name];
            if (status && !status.isAvailable) return false;
            return true;
        });
    };
    
    // Check if any facility has availability conflict
    const hasAvailabilityConflict = () => {
        return Object.values(facilityAvailabilityStatus).some(status => !status.isAvailable);
    };

    // Check if booking has any items (prevent zero booking)
    const hasBookingItems = () => {
        const totalGuests = formData.num_adults + formData.num_children;
        if (totalGuests > 0) return true;
        if (formData.selectedFacilities.length > 0) return true;
        if (formData.selectedActivities.length > 0) return true;
        return false;
    };

    const handleNext = () => {
        // Date step validation
        if (currentStep === dateStepNum && !formData.visit_date && !skipDateSelection) return;
        // Guests step validation
        if (currentStep === guestsStepNum && formData.num_adults === 0 && formData.num_children === 0) return;
        
        // Facilities step validation
        if (currentStep === facilitiesStepNum && facilitiesStepNum > 0 && formData.selectedFacilities.length > 0 && !areFacilityDatesValid()) {
            return;
        }
        
        setCurrentStep(Math.min(currentStep + 1, totalSteps));
    };

    const handlePrevious = () => {
        const minStep = skipDateSelection ? guestsStepNum : dateStepNum;
        setCurrentStep(Math.max(currentStep - 1, minStep));
    };

    const handleSubmit = async () => {
        const totalAmount = calculateTotal();
        
        if (totalAmount === 0) {
            await onSubmit(formData);
            if (onPaymentSuccess) onPaymentSuccess();
            return;
        }
        
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
            payment_method: paymentMethod,
            payment_phone: formData.mpesa_phone,
            host_id: hostId,
            emailData: {
                itemName,
            },
        };

        if (paymentMethod === 'mpesa') {
            await initiatePayment(formData.mpesa_phone, totalAmount, bookingData);
        } else if (paymentMethod === 'card') {
            // Use Paystack for card payments
            const { initiatePayment: initiateCardPayment } = usePaystackPayment({
                onSuccess: (reference) => {
                    console.log('✅ Card payment succeeded:', reference);
                    setPaymentSucceeded(true);
                    if (onPaymentSuccess) {
                        onPaymentSuccess();
                    }
                },
                onError: (error) => {
                    console.log('❌ Card payment failed:', error);
                }
            });
            
            await initiateCardPayment(
                formData.guest_email || user?.email || '',
                totalAmount,
                bookingData
            );
        }
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

    const updateFacilityDates = useCallback((name: string, field: 'startDate' | 'endDate', value: string) => {
        setFormData(prev => {
            const updated = {
                ...prev,
                selectedFacilities: prev.selectedFacilities.map(f =>
                    f.name === name ? { ...f, [field]: value } : f
                ),
            };
            
            // Check availability after updating dates
            const facility = updated.selectedFacilities.find(f => f.name === name);
            if (facility?.startDate && facility?.endDate) {
                setCheckingAvailability(true);
                const result = checkFacilityAvailability(name, facility.startDate, facility.endDate);
                setFacilityAvailabilityStatus(prevStatus => ({
                    ...prevStatus,
                    [name]: { isAvailable: result.isAvailable, message: result.conflictMessage }
                }));
                setCheckingAvailability(false);
            } else {
                // Clear status if dates incomplete
                setFacilityAvailabilityStatus(prevStatus => {
                    const newStatus = { ...prevStatus };
                    delete newStatus[name];
                    return newStatus;
                });
            }
            
            return updated;
        });
    }, [checkFacilityAvailability]);

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

    if (isProcessing) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[300px]">
                <Loader2 className="h-12 w-12 animate-spin" style={{ color: primaryColor }} />
                <p className="text-lg font-semibold">Saving your booking...</p>
                <p className="text-sm text-muted-foreground">Please wait</p>
            </div>
        );
    }

    const isMpesaSelected = calculateTotal() > 0 && paymentMethod === 'mpesa';
    const isCardSelected = calculateTotal() > 0 && paymentMethod === 'card';
    
    const total = calculateTotal();

    // Check if requested slots exceed remaining - only for inventory-based items
    const requestedSlots = formData.num_adults + formData.num_children;
    // For per_booking limit type (flexible trips), check against per-booking limit instead of global remaining
    const insufficientSlots = slotLimitType === 'inventory' 
        ? (totalCapacity > 0 && requestedSlots > remainingSlots)
        : (totalCapacity > 0 && requestedSlots > totalCapacity); // Per-booking limit check

    // For inventory-based: sold out globally. For per-booking: never globally sold out
    const isGloballySoldOut = slotLimitType === 'inventory' && isSoldOut && totalCapacity > 0;

    return (
        <div className="flex flex-col bg-gradient-to-br from-white via-white to-slate-50 rounded-[32px] overflow-y-auto overscroll-contain touch-pan-y max-h-[90vh] shadow-2xl border border-slate-100">
            {/* Sold Out Banner - Shows real-time if item becomes sold out during booking */}
            {isGloballySoldOut && (
                <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-red-700">This item is now fully booked</p>
                        <p className="text-xs text-red-600">All slots have been reserved. Please try another date or item.</p>
                    </div>
                </div>
            )}

            {/* Header - scrolls with content */}
            <div className="p-6 pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: primaryColor }}>
                        Book Your Visit
                    </h2>
                </div>
                <p className="text-sm text-slate-500 font-medium">{itemName}</p>
                
                {/* Flexible Date Indicator */}
                {isFlexibleDate && (
                    <div className="mt-2 inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                        <Calendar className="h-3 w-3" />
                        Flexible Date Trip
                    </div>
                )}
                
                {/* Progress Indicator - Page dots */}
                <div className="flex items-center justify-center gap-2 mt-4">
                    {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                        <div
                            key={step}
                            className={cn(
                                "h-2 rounded-full transition-all duration-300",
                                step === currentStep ? "w-6" : "w-2"
                            )}
                            style={{ 
                                backgroundColor: step <= currentStep ? primaryColor : '#e2e8f0'
                            }}
                        />
                    ))}
                </div>
                <p className="text-xs text-center text-slate-400 mt-2 font-medium">Step {currentStep} of {totalSteps}</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
                {/* Step 1: Visit Date */}
                {currentStep === dateStepNum && !skipDateSelection && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl" style={{ backgroundColor: `${primaryColor}15` }}>
                                <Calendar className="h-5 w-5" style={{ color: primaryColor }} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: primaryColor }}>Select Visit Date</h3>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Choose your preferred date</p>
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl border-2 border-[#008080]">
                            <Label htmlFor="visit_date" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">Visit Date</Label>
                            <Input
                                id="visit_date"
                                type="date"
                                value={formData.visit_date}
                                min={new Date().toISOString().split('T')[0]} 
                                onChange={(e) => {
                                    const selectedDate = e.target.value;
                                    // Validate working days if provided
                                    if (workingDays.length > 0 && selectedDate) {
                                        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                        const dayOfWeek = dayNames[new Date(selectedDate).getDay()];
                                        const isWorkingDay = workingDays.some(d => 
                                            d.toLowerCase().startsWith(dayOfWeek.toLowerCase()) ||
                                            dayOfWeek.toLowerCase().startsWith(d.toLowerCase().substring(0, 3))
                                        );
                                        if (!isWorkingDay) {
                                            return; // Don't update if not a working day
                                        }
                                    }
                                    setFormData({ ...formData, visit_date: selectedDate });
                                }}
                                className="border-none bg-white rounded-xl h-12 font-medium focus:ring-[#008080] focus:ring-2"
                            />
                            {!formData.visit_date && <p className="text-xs text-red-500 mt-2 font-medium">Please select a date to proceed.</p>}
                            {workingDays.length > 0 && (
                                <p className="text-xs text-slate-400 mt-2 font-medium">
                                    Open on: {workingDays.join(', ')}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 2: Number of People */}
                {currentStep === guestsStepNum && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl" style={{ backgroundColor: `${primaryColor}15` }}>
                                <Users className="h-5 w-5" style={{ color: primaryColor }} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: primaryColor }}>Number of Guests</h3>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">How many people are attending?</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl border-2 border-[#008080]">
                                <Label htmlFor="adults" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">Adults (18+)</Label>
                                <Input
                                    id="adults"
                                    type="number"
                                    min="0"
                                    max={slotLimitType === 'per_booking' ? totalCapacity : undefined}
                                    value={formData.num_adults}
                                    onChange={(e) => setFormData({ ...formData, num_adults: parseInt(e.target.value) || 0 })}
                                    className="border-none bg-white rounded-xl h-12 font-bold text-lg focus:ring-[#008080] focus:ring-2"
                                />
                                {entranceType !== 'free' && priceAdult > 0 && (
                                    <p className="text-xs font-bold mt-2" style={{ color: accentColor }}>KES {priceAdult.toLocaleString()} each</p>
                                )}
                            </div>
                            <div className="p-4 rounded-2xl border-2 border-[#008080]">
                                <Label htmlFor="children" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">Children</Label>
                                <Input
                                    id="children"
                                    type="number"
                                    min="0"
                                    max={slotLimitType === 'per_booking' ? totalCapacity : undefined}
                                    value={formData.num_children}
                                    onChange={(e) => setFormData({ ...formData, num_children: parseInt(e.target.value) || 0 })}
                                    className="border-none bg-white rounded-xl h-12 font-bold text-lg focus:ring-[#008080] focus:ring-2"
                                />
                                {entranceType !== 'free' && priceChild > 0 && (
                                    <p className="text-xs font-bold mt-2" style={{ color: accentColor }}>KES {priceChild.toLocaleString()} each</p>
                                )}
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl border-2 border-dashed" style={{ borderColor: `${primaryColor}30`, backgroundColor: `${primaryColor}08` }}>
                            <p className="text-sm font-black uppercase tracking-tight" style={{ color: primaryColor }}>
                                Total Guests: {formData.num_adults + formData.num_children}
                            </p>
                            {(formData.num_adults === 0 && formData.num_children === 0) && (
                                <p className="text-xs text-red-500 font-medium mt-1">You must include at least one guest.</p>
                            )}
                            {insufficientSlots && (
                                <p className="text-xs text-red-500 font-medium mt-1">
                                    {slotLimitType === 'per_booking' 
                                        ? `Maximum ${totalCapacity} guests per booking allowed.`
                                        : `Only ${remainingSlots} slots remaining. Please reduce your group size.`
                                    }
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 3: Facilities (Separate step) */}
                {currentStep === facilitiesStepNum && facilitiesStepNum > 0 && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl" style={{ backgroundColor: `${primaryColor}15` }}>
                                <CheckCircle2 className="h-5 w-5" style={{ color: primaryColor }} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: primaryColor }}>Select Facilities</h3>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Choose facility rentals (optional)</p>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            {facilities.filter(f => f.price > 0).map((facility) => {
                                const selected = formData.selectedFacilities.find(f => f.name === facility.name);
                                const isDateInvalid = selected && (
                                    !selected.startDate || 
                                    !selected.endDate || 
                                    new Date(selected.endDate).getTime() < new Date(selected.startDate).getTime()
                                );

                                return (
                                    <div key={facility.name} className="p-4 rounded-2xl border border-slate-100 bg-white">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    id={`facility-${facility.name}`}
                                                    checked={!!selected}
                                                    onCheckedChange={() => toggleFacility(facility)}
                                                    className="rounded-lg"
                                                />
                                                <Label htmlFor={`facility-${facility.name}`} className="text-sm font-black uppercase tracking-tight cursor-pointer">
                                                    {facility.name}
                                                </Label>
                                            </div>
                                            <span className="text-xs font-black px-3 py-1 rounded-full" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                                                KES {facility.price.toLocaleString()}/day
                                            </span>
                                        </div>
                                        {selected && (
                                            <div className="mt-4 pt-4 border-t border-slate-100">
                                                <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Rental Period</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Start Date</Label>
                                                        <Input
                                                            type="date"
                                                            value={selected.startDate || ""}
                                                            onChange={(e) => updateFacilityDates(facility.name, 'startDate', e.target.value)}
                                                            min={formData.visit_date || new Date().toISOString().split('T')[0]}
                                                            className="mt-1 rounded-xl h-10 text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">End Date</Label>
                                                        <Input
                                                            type="date"
                                                            value={selected.endDate || ""}
                                                            onChange={(e) => updateFacilityDates(facility.name, 'endDate', e.target.value)}
                                                            min={selected.startDate || formData.visit_date || new Date().toISOString().split('T')[0]} 
                                                            className="mt-1 rounded-xl h-10 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                                {isDateInvalid && (
                                                    <p className="text-xs text-red-500 mt-2 font-medium">Please select valid dates.</p>
                                                )}
                                                {/* Availability Status Indicator */}
                                                {selected.startDate && selected.endDate && !isDateInvalid && (
                                                    <div className={cn(
                                                        "flex items-center gap-2 mt-3 p-2 rounded-lg text-sm font-medium",
                                                        facilityAvailabilityStatus[facility.name]?.isAvailable === true 
                                                            ? "bg-green-50 text-green-700"
                                                            : facilityAvailabilityStatus[facility.name]?.isAvailable === false
                                                            ? "bg-red-50 text-red-700"
                                                            : "bg-slate-50 text-slate-500"
                                                    )}>
                                                        {checkingAvailability ? (
                                                            <>
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                Checking availability...
                                                            </>
                                                        ) : facilityAvailabilityStatus[facility.name]?.isAvailable === true ? (
                                                            <>
                                                                <Check className="h-4 w-4" />
                                                                Facility Available
                                                            </>
                                                        ) : facilityAvailabilityStatus[facility.name]?.isAvailable === false ? (
                                                            <>
                                                                <X className="h-4 w-4" />
                                                                {facilityAvailabilityStatus[facility.name]?.message || 'Dates not available'}
                                                            </>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        <p className="text-xs text-slate-400 text-center">You can skip this step if you don't need any facilities</p>
                    </div>
                )}

                {/* Step 4: Activities (Separate step) */}
                {currentStep === activitiesStepNum && activitiesStepNum > 0 && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl" style={{ backgroundColor: `${accentColor}15` }}>
                                <CheckCircle2 className="h-5 w-5" style={{ color: accentColor }} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: primaryColor }}>Select Activities</h3>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Choose activities to participate in (optional)</p>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            {activities.filter(a => a.price > 0).map((activity) => {
                                const selected = formData.selectedActivities.find(a => a.name === activity.name);
                                return (
                                    <div key={activity.name} className="p-4 rounded-2xl border border-slate-100 bg-white">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    id={`activity-${activity.name}`}
                                                    checked={!!selected}
                                                    onCheckedChange={() => toggleActivity(activity)}
                                                    className="rounded-lg"
                                                />
                                                <Label htmlFor={`activity-${activity.name}`} className="text-sm font-black uppercase tracking-tight cursor-pointer">
                                                    {activity.name}
                                                </Label>
                                            </div>
                                            <span className="text-xs font-black px-3 py-1 rounded-full" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                                                KES {activity.price.toLocaleString()}/person
                                            </span>
                                        </div>
                                        {selected && (
                                            <div className="mt-4 pt-4 border-t border-slate-100">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Number of People</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={selected.numberOfPeople}
                                                    onChange={(e) => updateActivityPeople(activity.name, parseInt(e.target.value) || 1)}
                                                    className="mt-1 rounded-xl h-10 text-sm w-24"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        <p className="text-xs text-slate-400 text-center">You can skip this step if you don't want any activities</p>
                    </div>
                )}

                {/* Step 4: Summary */}
                {currentStep === totalSteps && (
                    <div className="space-y-6">
                        {!user && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-xl" style={{ backgroundColor: `${primaryColor}15` }}>
                                        <Users className="h-5 w-5" style={{ color: primaryColor }} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: primaryColor }}>Contact Details</h3>
                                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">We'll send your booking confirmation here</p>
                                    </div>
                                </div>
                                <div className="space-y-4 p-4 rounded-2xl border-2 border-[#008080]">
                                    <div>
                                        <Label htmlFor="guest_name" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">Full Name</Label>
                                        <Input
                                            id="guest_name"
                                            placeholder="Your full name"
                                            value={formData.guest_name}
                                            onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                                            className="border-none bg-white rounded-xl h-12"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="guest_email" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">Email Address</Label>
                                        <Input
                                            id="guest_email"
                                            type="email"
                                            placeholder="your@email.com"
                                            value={formData.guest_email}
                                            onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                                            className="border-none bg-white rounded-xl h-12"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="guest_phone" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">Phone Number (Optional)</Label>
                                        <Input
                                            id="guest_phone"
                                            type="tel"
                                            placeholder="e.g. 0712345678"
                                            value={formData.guest_phone}
                                            onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                                            className="border-none bg-white rounded-xl h-12"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Order Summary */}
                        <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50 space-y-3">
                            <h3 className="text-sm font-black uppercase tracking-wider mb-4" style={{ color: primaryColor }}>Booking Summary</h3>
                            
                            {formData.visit_date && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Visit Date</span>
                                    <span className="font-bold">{new Date(formData.visit_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                            )}
                            
                            {formData.num_adults > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">{formData.num_adults} Adult{formData.num_adults > 1 ? 's' : ''}</span>
                                    <span className="font-bold">KES {(formData.num_adults * priceAdult).toLocaleString()}</span>
                                </div>
                            )}
                            
                            {formData.num_children > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">{formData.num_children} Child{formData.num_children > 1 ? 'ren' : ''}</span>
                                    <span className="font-bold">KES {(formData.num_children * priceChild).toLocaleString()}</span>
                                </div>
                            )}
                            
                            {formData.selectedFacilities.map(f => {
                                if (!f.startDate || !f.endDate) return null;
                                const days = Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (1000 * 60 * 60 * 24)) || 1;
                                return (
                                    <div key={f.name} className="flex justify-between text-sm">
                                        <span className="text-slate-500">{f.name} ({days} day{days > 1 ? 's' : ''})</span>
                                        <span className="font-bold">KES {(f.price * days).toLocaleString()}</span>
                                    </div>
                                );
                            })}
                            
                            {formData.selectedActivities.map(a => (
                                <div key={a.name} className="flex justify-between text-sm">
                                    <span className="text-slate-500">{a.name} ({a.numberOfPeople})</span>
                                    <span className="font-bold">KES {(a.price * a.numberOfPeople).toLocaleString()}</span>
                                </div>
                            ))}
                            
                            <div className="border-t pt-3 mt-3">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-sm font-black uppercase" style={{ color: primaryColor }}>Total</span>
                                    <span className="text-2xl font-black" style={{ color: accentColor }}>KES {total.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Method Selection */}
                        {total > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: primaryColor }}>Payment Method</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setPaymentMethod('mpesa')}
                                        className={cn(
                                            "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                                            paymentMethod === 'mpesa' 
                                                ? "border-[#008080] bg-[#008080]/5" 
                                                : "border-slate-200 hover:border-slate-300"
                                        )}
                                    >
                                        <Phone className="h-6 w-6" style={{ color: paymentMethod === 'mpesa' ? primaryColor : '#94a3b8' }} />
                                        <span className={cn("text-sm font-bold", paymentMethod === 'mpesa' ? "text-[#008080]" : "text-slate-500")}>M-Pesa</span>
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('card')}
                                        className={cn(
                                            "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                                            paymentMethod === 'card' 
                                                ? "border-[#008080] bg-[#008080]/5" 
                                                : "border-slate-200 hover:border-slate-300"
                                        )}
                                    >
                                        <CreditCard className="h-6 w-6" style={{ color: paymentMethod === 'card' ? primaryColor : '#94a3b8' }} />
                                        <span className={cn("text-sm font-bold", paymentMethod === 'card' ? "text-[#008080]" : "text-slate-500")}>Card</span>
                                    </button>
                                </div>

                                {isMpesaSelected && (
                                    <div className="p-4 rounded-2xl border-2 border-[#008080]">
                                        <Label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">M-Pesa Phone Number</Label>
                                        <Input
                                            type="tel"
                                            placeholder="e.g. 0712345678"
                                            value={formData.mpesa_phone}
                                            onChange={(e) => setFormData({ ...formData, mpesa_phone: e.target.value })}
                                            className="border-none bg-white rounded-xl h-12"
                                        />
                                        <p className="text-xs text-slate-400 mt-2">You will receive an STK push to complete payment</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer with Navigation */}
            <div className="p-6 pt-4 border-t border-slate-100 bg-white sticky bottom-0">
                <div className="flex gap-3">
                    {currentStep > (skipDateSelection ? guestsStepNum : dateStepNum) && (
                        <Button
                            onClick={handlePrevious}
                            variant="outline"
                            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-wider border-2"
                        >
                            Back
                        </Button>
                    )}
                    
                    {currentStep < totalSteps ? (
                        <Button
                            onClick={handleNext}
                            disabled={
                                (currentStep === dateStepNum && !formData.visit_date && !skipDateSelection) ||
                                (currentStep === guestsStepNum && (formData.num_adults === 0 && formData.num_children === 0)) ||
                                (currentStep === guestsStepNum && insufficientSlots) ||
                                (currentStep === facilitiesStepNum && formData.selectedFacilities.length > 0 && !areFacilityDatesValid()) ||
                                isGloballySoldOut
                            }
                            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-wider text-white"
                            style={{ backgroundColor: primaryColor }}
                        >
                            Continue
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            disabled={
                                isPaymentInProgress || 
                                isGloballySoldOut ||
                                insufficientSlots ||
                                (total > 0 && paymentMethod === 'mpesa' && !formData.mpesa_phone) ||
                                (!user && (!formData.guest_name || !formData.guest_email))
                            }
                            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-wider text-white"
                            style={{ backgroundColor: accentColor }}
                        >
                            {isPaymentInProgress ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : total === 0 ? (
                                "Confirm Booking"
                            ) : (
                                `Pay KES ${total.toLocaleString()}`
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Payment Status Dialog */}
            <PaymentStatusDialog
                open={paymentStatus !== 'idle'}
                status={paymentStatus}
                errorMessage={errorMessage || undefined}
                onClose={resetPayment}
            />
        </div>
    );
};
