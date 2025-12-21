// src/components/MultiStepBooking.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Users, Loader2, CheckCircle2, Phone, CreditCard, X, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PaymentStatusDialog } from "./PaymentStatusDialog";
import { useMpesaPayment } from "@/hooks/useMpesaPayment";
import { cn } from "@/lib/utils";
import { useRealtimeItemAvailability } from "@/hooks/useRealtimeBookings";

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
    onCancel?: () => void;
    primaryColor?: string;
    accentColor?: string;
    totalCapacity?: number;
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
    onCancel,
    primaryColor = "#008080",
    accentColor = "#FF7F50",
    totalCapacity = 0,
}: MultiStepBookingProps) => {
    const { user } = useAuth();
    
    // Real-time availability check - prevents booking if sold out during booking flow
    const { remainingSlots, isSoldOut } = useRealtimeItemAvailability(
        itemId || undefined, 
        totalCapacity
    );
    
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
            return end >= start;
        });
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
        if (currentStep === 1 && !formData.visit_date && !skipDateSelection) return;
        if (currentStep === 2 && formData.num_adults === 0 && formData.num_children === 0) return;
        
        if (currentStep === 3 && !skipFacilitiesAndActivities && formData.selectedFacilities.length > 0 && !areFacilityDatesValid()) {
            return;
        }
        
        if (currentStep === 2 && skipFacilitiesAndActivities) {
            setCurrentStep(totalSteps);
            return;
        }
        
        setCurrentStep(Math.min(currentStep + 1, totalSteps));
    };

    const handlePrevious = () => {
        if (skipFacilitiesAndActivities && currentStep === totalSteps) {
            setCurrentStep(2);
            return;
        }
        
        const minStep = skipDateSelection ? 2 : 1;
        setCurrentStep(Math.max(currentStep - 1, minStep));
    };

    const handleSubmit = async () => {
        const totalAmount = calculateTotal();
        
        if (totalAmount === 0) {
            await onSubmit(formData);
            if (onPaymentSuccess) onPaymentSuccess();
            return;
        }
        
        if (paymentMethod === 'card') {
            alert("Card payment selected. Integration required.");
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

    // Check if requested slots exceed remaining
    const requestedSlots = formData.num_adults + formData.num_children;
    const insufficientSlots = totalCapacity > 0 && requestedSlots > remainingSlots;

    return (
        <div className="flex flex-col max-h-[90vh] bg-gradient-to-br from-white via-white to-slate-50 rounded-[32px] overflow-hidden shadow-2xl border border-slate-100">
            {/* Sold Out Banner - Shows real-time if item becomes sold out during booking */}
            {isSoldOut && totalCapacity > 0 && (
                <div className="flex-shrink-0 px-6 py-3 bg-red-50 border-b border-red-200 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-red-700">This item is now fully booked</p>
                        <p className="text-xs text-red-600">All slots have been reserved. Please try another date or item.</p>
                    </div>
                </div>
            )}

            {/* Fixed Header */}
            <div className="flex-shrink-0 p-6 pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: primaryColor }}>
                        Book Your Visit
                    </h2>
                    {onCancel && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onCancel}
                            className="rounded-full h-8 w-8 hover:bg-slate-100"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                <p className="text-sm text-slate-500 font-medium">{itemName}</p>
                
                {/* Progress Indicator */}
                <div className="flex items-center gap-2 mt-4">
                    {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                        <div
                            key={step}
                            className="h-1.5 flex-1 rounded-full transition-all duration-300"
                            style={{ 
                                backgroundColor: step <= currentStep ? primaryColor : '#e2e8f0'
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Step 1: Visit Date */}
                {currentStep === 1 && !skipDateSelection && (
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
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <Label htmlFor="visit_date" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">Visit Date</Label>
                            <Input
                                id="visit_date"
                                type="date"
                                value={formData.visit_date}
                                min={new Date().toISOString().split('T')[0]} 
                                onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                                className="border-none bg-white rounded-xl h-12 font-medium"
                            />
                            {!formData.visit_date && <p className="text-xs text-red-500 mt-2 font-medium">Please select a date to proceed.</p>}
                        </div>
                    </div>
                )}

                {/* Step 2: Number of People */}
                {currentStep === 2 && (
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
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <Label htmlFor="adults" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">Adults (18+)</Label>
                                <Input
                                    id="adults"
                                    type="number"
                                    min="0"
                                    value={formData.num_adults}
                                    onChange={(e) => setFormData({ ...formData, num_adults: parseInt(e.target.value) || 0 })}
                                    className="border-none bg-white rounded-xl h-12 font-bold text-lg"
                                />
                                {entranceType !== 'free' && priceAdult > 0 && (
                                    <p className="text-xs font-bold mt-2" style={{ color: accentColor }}>KES {priceAdult.toLocaleString()} each</p>
                                )}
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <Label htmlFor="children" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">Children</Label>
                                <Input
                                    id="children"
                                    type="number"
                                    min="0"
                                    value={formData.num_children}
                                    onChange={(e) => setFormData({ ...formData, num_children: parseInt(e.target.value) || 0 })}
                                    className="border-none bg-white rounded-xl h-12 font-bold text-lg"
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
                        </div>
                    </div>
                )}

                {/* Step 3: Facilities & Activities */}
                {currentStep === 3 && !skipFacilitiesAndActivities && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl" style={{ backgroundColor: `${accentColor}15` }}>
                                <CheckCircle2 className="h-5 w-5" style={{ color: accentColor }} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: primaryColor }}>Additional Services</h3>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Optional add-ons</p>
                            </div>
                        </div>
                        
                        {/* Filter facilities with price > 0 */}
                        {facilities.filter(f => f.price > 0).length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Facilities</h4>
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
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Filter activities with price > 0 */}
                        {activities.filter(a => a.price > 0).length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Activities</h4>
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
                            </div>
                        )}
                        
                        {(facilities.filter(f => f.price > 0).length === 0 && activities.filter(a => a.price > 0).length === 0) && (
                            <div className="p-6 rounded-2xl bg-slate-50 text-center">
                                <p className="text-slate-500 font-medium">No additional services available.</p>
                            </div>
                        )}
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
                                <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div>
                                        <Label htmlFor="guest_name" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">Full Name</Label>
                                        <Input
                                            id="guest_name"
                                            value={formData.guest_name}
                                            onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                                            className="border-none bg-white rounded-xl h-12"
                                            placeholder="Enter your full name"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="guest_email" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">Email</Label>
                                        <Input
                                            id="guest_email"
                                            type="email"
                                            value={formData.guest_email}
                                            onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                                            className="border-none bg-white rounded-xl h-12"
                                            placeholder="Enter your email"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="guest_phone" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">Phone (Optional)</Label>
                                        <Input
                                            id="guest_phone"
                                            type="tel"
                                            value={formData.guest_phone}
                                            onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                                            className="border-none bg-white rounded-xl h-12"
                                            placeholder="e.g., 0712345678"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Booking Summary */}
                        <div className="p-5 rounded-2xl border-2" style={{ borderColor: `${primaryColor}30`, backgroundColor: `${primaryColor}08` }}>
                            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: primaryColor }}>Booking Summary</p>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Date</span>
                                    <span className="font-bold">{formData.visit_date || 'Flexible'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Guests</span>
                                    <span className="font-bold">{formData.num_adults} Adult(s), {formData.num_children} Child(ren)</span>
                                </div>
                                {formData.selectedFacilities.length > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Facilities</span>
                                        <span className="font-bold">{formData.selectedFacilities.length} selected</span>
                                    </div>
                                )}
                                {formData.selectedActivities.length > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Activities</span>
                                        <span className="font-bold">{formData.selectedActivities.length} selected</span>
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 pt-4 border-t" style={{ borderColor: `${primaryColor}30` }}>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-black uppercase" style={{ color: primaryColor }}>Total Amount</span>
                                    <span className="text-2xl font-black" style={{ color: accentColor }}>KES {total.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Method Selection */}
                        {total > 0 && (
                            <div className="space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Payment Method</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        onClick={() => setPaymentMethod('mpesa')}
                                        variant={paymentMethod === 'mpesa' ? 'default' : 'outline'}
                                        className={cn(
                                            "h-14 rounded-2xl font-black uppercase tracking-tight text-sm",
                                            paymentMethod === 'mpesa' ? "text-white border-none" : "border-slate-200"
                                        )}
                                        style={{ 
                                            backgroundColor: paymentMethod === 'mpesa' ? primaryColor : undefined,
                                        }}
                                    >
                                        <Phone className="mr-2 h-4 w-4" /> M-Pesa
                                    </Button>
                                    <Button
                                        onClick={() => setPaymentMethod('card')}
                                        variant={paymentMethod === 'card' ? 'default' : 'outline'}
                                        className={cn(
                                            "h-14 rounded-2xl font-black uppercase tracking-tight text-sm",
                                            paymentMethod === 'card' ? "text-white border-none" : "border-slate-200"
                                        )}
                                        style={{ 
                                            backgroundColor: paymentMethod === 'card' ? primaryColor : undefined,
                                        }}
                                        disabled
                                    >
                                        <CreditCard className="mr-2 h-4 w-4" /> Card
                                    </Button>
                                </div>

                                {isMpesaSelected && (
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                        <Label htmlFor="mpesa_phone_final" className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">M-Pesa Phone Number</Label>
                                        <Input
                                            id="mpesa_phone_final"
                                            type="tel"
                                            value={formData.mpesa_phone}
                                            onChange={(e) => setFormData({ ...formData, mpesa_phone: e.target.value })}
                                            placeholder="e.g., 0712345678"
                                            className="border-none bg-white rounded-xl h-12"
                                        />
                                        <p className="text-xs text-slate-400 mt-2">You'll receive an M-Pesa prompt on this number</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Fixed Footer */}
            <div className="flex-shrink-0 p-6 pt-4 border-t border-slate-100 bg-white">
                <div className="flex gap-3">
                    {currentStep > (skipDateSelection ? 2 : 1) && (
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={handlePrevious} 
                            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-tight border-slate-200"
                        >
                            Back
                        </Button>
                    )}
                    
                    {currentStep < totalSteps ? (
                        <Button
                            type="button"
                            onClick={handleNext}
                            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-[0.15em] text-white border-none"
                            style={{ backgroundColor: primaryColor }}
                            disabled={
                                (currentStep === 1 && !formData.visit_date && !skipDateSelection) ||
                                (currentStep === 2 && formData.num_adults === 0 && formData.num_children === 0) ||
                                (currentStep === 3 && !skipFacilitiesAndActivities && formData.selectedFacilities.length > 0 && !areFacilityDatesValid())
                            }
                        >
                            Continue
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-[0.15em] text-white border-none shadow-xl"
                            style={{ 
                                background: `linear-gradient(135deg, ${accentColor}CC 0%, ${accentColor} 100%)`,
                                boxShadow: `0 8px 20px -6px ${accentColor}88`
                            }}
                            disabled={
                                isProcessing || 
                                isPaymentInProgress ||
                                !formData.guest_name || 
                                !formData.guest_email ||
                                (isMpesaSelected && !formData.mpesa_phone) ||
                                isSoldOut ||
                                insufficientSlots
                            }
                        >
                            {isSoldOut ? (
                                'Fully Booked'
                            ) : insufficientSlots ? (
                                `Only ${remainingSlots} slots left`
                            ) : isProcessing || isPaymentInProgress ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : total > 0 ? (
                                paymentMethod === 'mpesa' ? 'Pay with M-Pesa' : 'Pay with Card'
                            ) : (
                                'Confirm Booking'
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Payment Status Dialog */}
            <PaymentStatusDialog
                open={paymentStatus !== 'idle' || paymentSucceeded}
                status={paymentSucceeded ? 'success' : paymentStatus}
                errorMessage={errorMessage}
                onClose={() => {
                    const wasSuccessful = paymentSucceeded || paymentStatus === 'success';
                    resetPayment();
                    setPaymentSucceeded(false);
                    
                    if (wasSuccessful && onPaymentSuccess) {
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