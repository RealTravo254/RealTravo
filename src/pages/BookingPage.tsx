import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBookingSubmit } from "@/hooks/useBookingSubmit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Calendar, Users, CheckCircle2, Phone, CreditCard, X, AlertTriangle, Check, ChevronRight, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePaystackPayment } from "@/hooks/usePaystackPayment";
import { cn } from "@/lib/utils";
import { useRealtimeItemAvailability } from "@/hooks/useRealtimeBookings";
import { useFacilityRangeAvailability } from "@/hooks/useDateRangeAvailability";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
};

type BookingType = 'trip' | 'event' | 'hotel' | 'adventure_place' | 'attraction';

interface Facility {
  name: string;
  price: number;
  capacity?: number;
}

interface Activity {
  name: string;
  price: number;
}

interface BookingFormData {
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

const BookingPage = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const { submitBooking } = useBookingSubmit();

  // Booking form state
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<BookingFormData>({
    visit_date: "",
    num_adults: 1,
    num_children: 0,
    selectedFacilities: [],
    selectedActivities: [],
    guest_name: "",
    guest_email: user?.email || "",
    guest_phone: "",
    mpesa_phone: "",
  });

  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [isCardPaymentLoading, setIsCardPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { 
    initiatePayment: initiateCardPayment, 
    isLoading: isPaystackLoading,
    resetPayment: resetCardPayment 
  } = usePaystackPayment({
    onSuccess: (reference) => {
      console.log('✅ Card payment succeeded:', reference);
      setPaymentSucceeded(true);
      setIsCompleted(true);
      toast({ title: "Booking confirmed!" });
      setTimeout(() => navigate(-1), 2000);
    },
    onError: (error) => {
      console.log('❌ Card payment failed:', error);
      setIsCardPaymentLoading(false);
      setPaymentError(error);
    },
  });

  const getBookingProps = () => {
    if (!item) return null;
    
    const baseProps = {
      itemId: item.id,
      itemName: item.name,
      hostId: item.created_by || "",
      totalCapacity: 0,
      slotLimitType: 'inventory' as const,
      isFlexibleDate: false,
      workingDays: [] as string[],
      skipDateSelection: false,
      fixedDate: "",
      skipFacilitiesAndActivities: false,
      facilities: [] as Facility[],
      activities: [] as Activity[],
      priceAdult: 0,
      priceChild: 0,
      entranceType: "paid",
    };
    
    if (type === "trip" || type === "event") {
      return {
        ...baseProps,
        bookingType: type,
        priceAdult: item.price || 0,
        priceChild: item.price_child || 0,
        activities: item.activities || [],
        skipFacilitiesAndActivities: true,
        skipDateSelection: !item.is_custom_date && !item.is_flexible_date,
        fixedDate: item.is_flexible_date ? "" : item.date,
        totalCapacity: item.available_tickets || 0,
        slotLimitType: (item.slot_limit_type || (item.is_flexible_date ? 'per_booking' : 'inventory')) as 'inventory' | 'per_booking',
        isFlexibleDate: item.is_flexible_date || false,
      };
    }
    
    if (type === "adventure_place" || type === "adventure") {
      return {
        ...baseProps,
        bookingType: "adventure_place",
        priceAdult: item.entry_fee || 0,
        priceChild: item.entry_fee || 0,
        entranceType: item.entry_fee_type || "paid",
        facilities: item.facilities || [],
        activities: item.activities || [],
        totalCapacity: item.available_slots || 0,
        workingDays: item.days_opened || [],
      };
    }
    
    if (type === "hotel") {
      return {
        ...baseProps,
        bookingType: "hotel",
        priceAdult: 0,
        priceChild: 0,
        entranceType: "free",
        facilities: item.facilities || [],
        activities: item.activities || [],
        totalCapacity: item.available_rooms || 0,
        workingDays: item.days_opened || [],
      };
    }
    
    return baseProps;
  };

  const props = getBookingProps();
  
  const { remainingSlots, isSoldOut } = useRealtimeItemAvailability(
    props?.slotLimitType === 'inventory' ? (props?.itemId || undefined) : undefined, 
    props?.slotLimitType === 'inventory' ? (props?.totalCapacity || 0) : 0
  );
  
  const { checkFacilityAvailability, loading: checkingFacility } = useFacilityRangeAvailability(props?.itemId || undefined);
  const [facilityAvailabilityStatus, setFacilityAvailabilityStatus] = useState<Record<string, { isAvailable: boolean; message: string | null }>>({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  useEffect(() => {
    if (id && type) fetchItem();
    window.scrollTo(0, 0);
  }, [id, type]);

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

  useEffect(() => {
    if (props?.skipDateSelection && props?.fixedDate) {
      setFormData(prev => ({ ...prev, visit_date: props.fixedDate }));
      setCurrentStep(2);
    }
  }, [props?.skipDateSelection, props?.fixedDate]);

  const fetchItem = async () => {
    if (!id || !type) return;
    
    try {
      let data = null;
      let error = null;
      
      if (type === "trip" || type === "event") {
        const result = await supabase
          .from("trips")
          .select("id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,slot_limit_type,price,price_child,available_tickets,description,activities,phone_number,email,created_by,opening_hours,closing_hours,days_opened,type")
          .eq("id", id)
          .single();
        data = result.data;
        error = result.error;
      } else if (type === "adventure_place" || type === "adventure") {
        const result = await supabase
          .from("adventure_places")
          .select("id,name,location,place,country,image_url,description,amenities,facilities,activities,phone_numbers,email,opening_hours,closing_hours,days_opened,entry_fee,entry_fee_type,available_slots,created_by")
          .eq("id", id)
          .single();
        data = result.data;
        error = result.error;
      } else if (type === "hotel") {
        const result = await supabase
          .from("hotels")
          .select("id,name,location,place,country,image_url,description,amenities,facilities,activities,phone_numbers,email,opening_hours,closing_hours,days_opened,available_rooms,created_by")
          .eq("id", id)
          .single();
        data = result.data;
        error = result.error;
      }
      
      if (error) throw error;
      setItem(data);
    } catch (error) {
      toast({ title: "Item not found", variant: "destructive" });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!props) return 0;
    let total = 0;
    
    if (props.entranceType !== 'free') {
      total += (formData.num_adults * props.priceAdult) + (formData.num_children * props.priceChild);
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

  const handleBookingSubmit = async () => {
    if (!item || !type || !props) return;
    
    const totalAmount = calculateTotal();
    
    // If total is 0, submit directly without payment
    if (totalAmount === 0) {
      setIsProcessing(true);
      try {
        const bookingType = type === "adventure_place" || type === "adventure" ? "adventure_place" : type as BookingType;
        
        await submitBooking({
          itemId: item.id,
          itemName: item.name,
          bookingType,
          totalAmount: 0,
          slotsBooked: formData.num_adults + formData.num_children,
          visitDate: formData.visit_date || item.date,
          guestName: formData.guest_name,
          guestEmail: formData.guest_email,
          guestPhone: formData.guest_phone,
          hostId: item.created_by,
          bookingDetails: { ...formData, item_name: item.name }
        });
        
        setIsCompleted(true);
        toast({ title: "Booking confirmed!" });
        setTimeout(() => navigate(-1), 2000);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    
    // Process payment for paid bookings
    const bookingData = {
      item_id: item.id,
      booking_type: type,
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
      host_id: props.hostId,
      emailData: {
        itemName: item.name,
      },
    };

    setIsCardPaymentLoading(true);
    await initiateCardPayment(
      formData.guest_email || user?.email || '',
      totalAmount,
      bookingData
    );
  };

  const areFacilityDatesValid = () => {
    return formData.selectedFacilities.every(f => {
      if (!f.startDate || !f.endDate) return false; 
      const start = new Date(f.startDate).getTime();
      const end = new Date(f.endDate).getTime();
      if (end < start) return false;
      const status = facilityAvailabilityStatus[f.name];
      if (status && !status.isAvailable) return false;
      return true;
    });
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
        setFacilityAvailabilityStatus(prevStatus => {
          const newStatus = { ...prevStatus };
          delete newStatus[name];
          return newStatus;
        });
      }
      
      return updated;
    });
  }, [checkFacilityAvailability]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FA]">
        <Loader2 className="h-10 w-10 animate-spin text-[#008080] mb-4" />
        <p className="text-sm font-black uppercase tracking-tighter animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!item || !props) return null;

  const hasFacilities = props.facilities.filter(f => f.price > 0).length > 0;
  const hasActivities = props.activities.filter(a => a.price > 0).length > 0;
  
  const baseSteps = props.skipDateSelection ? 1 : 2;
  const facilityStep = !props.skipFacilitiesAndActivities && hasFacilities ? 1 : 0;
  const activityStep = !props.skipFacilitiesAndActivities && hasActivities ? 1 : 0;
  const totalSteps = baseSteps + facilityStep + activityStep + 1;
  
  const dateStepNum = props.skipDateSelection ? 0 : 1;
  const guestsStepNum = props.skipDateSelection ? 1 : 2;
  const facilitiesStepNum = !props.skipFacilitiesAndActivities && hasFacilities ? guestsStepNum + 1 : 0;
  const activitiesStepNum = !props.skipFacilitiesAndActivities && hasActivities 
    ? (facilitiesStepNum > 0 ? facilitiesStepNum + 1 : guestsStepNum + 1) 
    : 0;
  const summaryStepNum = totalSteps;

  const handleNext = () => {
    if (currentStep === dateStepNum && !formData.visit_date && !props.skipDateSelection) return;
    if (currentStep === guestsStepNum && formData.num_adults === 0 && formData.num_children === 0) return;
    if (currentStep === facilitiesStepNum && facilitiesStepNum > 0 && formData.selectedFacilities.length > 0 && !areFacilityDatesValid()) {
      return;
    }
    setCurrentStep(Math.min(currentStep + 1, totalSteps));
  };

  const handlePrevious = () => {
    const minStep = props.skipDateSelection ? guestsStepNum : dateStepNum;
    setCurrentStep(Math.max(currentStep - 1, minStep));
  };

  const total = calculateTotal();
  const requestedSlots = formData.num_adults + formData.num_children;
  
  // Adventure places don't track slots - they are always available
  const isAdventurePlace = type === "adventure_place" || type === "adventure";
  const insufficientSlots = isAdventurePlace ? false : (
    props.slotLimitType === 'inventory' 
      ? (props.totalCapacity > 0 && requestedSlots > remainingSlots)
      : (props.totalCapacity > 0 && requestedSlots > props.totalCapacity)
  );
  const isGloballySoldOut = isAdventurePlace ? false : (props.slotLimitType === 'inventory' && isSoldOut && props.totalCapacity > 0);

  const stepTitles = [
    { num: dateStepNum, title: "When", subtitle: "Choose your date" },
    { num: guestsStepNum, title: "Who", subtitle: "Select guests" },
    { num: facilitiesStepNum, title: "Where", subtitle: "Pick facilities" },
    { num: activitiesStepNum, title: "What", subtitle: "Add activities" },
    { num: summaryStepNum, title: "Confirm", subtitle: "Review & pay" },
  ].filter(s => s.num > 0);

  if (isProcessing || isCompleted) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-gradient-to-br from-slate-50 to-white rounded-3xl shadow-2xl">
          <div className="relative">
            {isCompleted ? (
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            ) : (
              <>
                <Loader2 className="h-16 w-16 animate-spin opacity-20" style={{ color: COLORS.TEAL }} />
                <Sparkles className="h-8 w-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" style={{ color: COLORS.TEAL }} />
              </>
            )}
          </div>
          <p className="text-xl font-bold tracking-tight" style={{ color: COLORS.TEAL }}>
            {isCompleted ? "Booking Confirmed!" : "Processing Your Booking"}
          </p>
          <p className="text-sm text-slate-400">
            {isCompleted ? "Redirecting..." : "Just a moment..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="container max-w-2xl mx-auto px-4 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full bg-slate-100 hover:bg-slate-200 h-9 w-9 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-black uppercase tracking-tight truncate" style={{ color: COLORS.TEAL }}>
              Book {item.name}
            </h1>
            <p className="text-xs text-slate-500 truncate">{item.location}, {item.country}</p>
          </div>
        </div>
      </div>

      {/* Booking Form */}
      <div className="container max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24">
        <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-xl border border-slate-100 overflow-hidden">
          <div className="relative flex flex-col bg-white" 
               style={{ 
                 background: `linear-gradient(135deg, ${COLORS.TEAL}08 0%, white 50%, ${COLORS.CORAL}08 100%)`
               }}>
            
            {/* Decorative Header Bar */}
            <div className="h-1.5 sm:h-2 w-full" style={{ 
              background: `linear-gradient(90deg, ${COLORS.TEAL}, ${COLORS.CORAL})` 
            }} />

            {/* Sold Out Banner */}
            {isGloballySoldOut && (
              <div className="px-3 sm:px-6 py-3 sm:py-4 bg-red-500 text-white flex items-center gap-2 sm:gap-3">
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                <div>
                  <p className="font-bold text-sm">Fully Booked</p>
                  <p className="text-xs opacity-90">All slots reserved.</p>
                </div>
              </div>
            )}

            {/* Main Header */}
            <div className="relative px-4 sm:px-8 pt-6 sm:pt-10 pb-4 sm:pb-8 flex-shrink-0 overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-5" style={{ 
                backgroundImage: `radial-gradient(circle at 2px 2px, ${COLORS.TEAL} 1px, transparent 0)`,
                backgroundSize: '32px 32px'
              }} />
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4 sm:mb-6">
                  <div className="flex-1">
                    <h1 className="text-2xl sm:text-4xl md:text-5xl font-black mb-1 sm:mb-2 leading-none tracking-tight" 
                        style={{ 
                          color: COLORS.TEAL,
                          fontFamily: '"Space Mono", "Courier New", monospace'
                        }}>
                      Reserve
                    </h1>
                    <p className="text-sm sm:text-lg text-slate-600 font-medium max-w-md">{item.name}</p>
                  </div>
                  
                  {props.isFlexibleDate && (
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-emerald-500 text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold shadow-lg">
                      <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      Flexible
                    </div>
                  )}
                </div>
                
                {/* Step Indicator */}
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 hide-scrollbar">
                  {stepTitles.map((step, index) => (
                    <div key={step.num} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <div className={cn(
                        "px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-300 border-2",
                        currentStep === step.num 
                          ? "border-current shadow-lg scale-105"
                          : currentStep > step.num 
                          ? "border-transparent opacity-50"
                          : "border-transparent opacity-30"
                      )}
                      style={{
                        backgroundColor: currentStep >= step.num ? COLORS.TEAL : '#e2e8f0',
                        color: currentStep >= step.num ? 'white' : '#64748b'
                      }}>
                        <p className="text-xs font-black">{step.title}</p>
                      </div>
                      {index < stepTitles.length - 1 && (
                        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-slate-300" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="px-4 sm:px-8 pb-4 sm:pb-6 space-y-6 sm:space-y-8">
              
              {/* Step 1: Visit Date */}
              {currentStep === dateStepNum && !props.skipDateSelection && (
                <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg" 
                           style={{ backgroundColor: COLORS.TEAL }}>
                        <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-black" style={{ color: COLORS.TEAL }}>
                          Pick Your Date
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500">When would you like to visit?</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/80 backdrop-blur-sm border-2 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl" 
                       style={{ borderColor: `${COLORS.TEAL}40` }}>
                    <Label htmlFor="visit_date" className="text-xs sm:text-sm font-bold text-slate-700 mb-2 sm:mb-3 block">
                      Select Date
                    </Label>
                    <Input
                      id="visit_date"
                      type="date"
                      placeholder="Select your visit date"
                      value={formData.visit_date}
                      min={new Date().toISOString().split('T')[0]} 
                      onChange={(e) => {
                        const selectedDate = e.target.value;
                        if (props.workingDays.length > 0 && selectedDate) {
                          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                          const dayOfWeek = dayNames[new Date(selectedDate).getDay()];
                          const isWorkingDay = props.workingDays.some(d => 
                            d.toLowerCase().startsWith(dayOfWeek.toLowerCase()) ||
                            dayOfWeek.toLowerCase().startsWith(d.toLowerCase().substring(0, 3))
                          );
                          if (!isWorkingDay) return;
                        }
                        setFormData({ ...formData, visit_date: selectedDate });
                      }}
                      className="h-12 sm:h-14 text-base sm:text-lg font-semibold rounded-xl sm:rounded-2xl border-2 focus:ring-4 transition-all"
                      style={{ 
                        borderColor: formData.visit_date ? COLORS.TEAL : '#e2e8f0',
                        '--tw-ring-color': `${COLORS.TEAL}40` 
                      } as any}
                    />
                    {!formData.visit_date && (
                      <p className="text-xs sm:text-sm text-red-500 mt-2 sm:mt-3 font-medium flex items-center gap-1.5 sm:gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Please select a date to continue
                      </p>
                    )}
                    {props.workingDays.length > 0 && (
                      <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-slate-50 rounded-lg sm:rounded-xl">
                        <p className="text-xs font-bold text-slate-600 mb-1">Available Days</p>
                        <p className="text-xs sm:text-sm text-slate-700">{props.workingDays.join(' • ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Number of Guests */}
              {currentStep === guestsStepNum && (
                <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg" 
                         style={{ backgroundColor: COLORS.TEAL }}>
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black" style={{ color: COLORS.TEAL }}>
                        Guest Count
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500">How many people are coming?</p>
                    </div>
                  </div>

                  {/* Mobile: Row layout, Desktop: Grid */}
                  <div className="flex flex-row gap-3 sm:grid sm:grid-cols-2 sm:gap-4">
                    {/* Adults */}
                    <div className="flex-1 bg-white/80 backdrop-blur-sm border-2 p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl group hover:shadow-2xl transition-all"
                         style={{ borderColor: `${COLORS.TEAL}40` }}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 sm:mb-4">
                        <Label htmlFor="adults" className="text-sm sm:text-lg font-black mb-1 sm:mb-0" style={{ color: COLORS.TEAL }}>
                          Adults
                        </Label>
                        {props.entranceType !== 'free' && props.priceAdult > 0 && (
                          <span className="text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full" 
                                style={{ backgroundColor: `${COLORS.CORAL}20`, color: COLORS.CORAL }}>
                            KES {props.priceAdult.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <Input
                        id="adults"
                        type="number"
                        min="0"
                        placeholder="0"
                        max={props.slotLimitType === 'per_booking' ? props.totalCapacity : undefined}
                        value={formData.num_adults}
                        onChange={(e) => setFormData({ ...formData, num_adults: parseInt(e.target.value) || 0 })}
                        className="h-12 sm:h-16 text-2xl sm:text-3xl font-black text-center rounded-xl sm:rounded-2xl border-2"
                        style={{ borderColor: COLORS.TEAL }}
                      />
                      <p className="text-xs text-slate-400 mt-1.5 sm:mt-2 text-center">18+ years</p>
                    </div>

                    {/* Children */}
                    <div className="flex-1 bg-white/80 backdrop-blur-sm border-2 p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl group hover:shadow-2xl transition-all"
                         style={{ borderColor: `${COLORS.TEAL}40` }}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 sm:mb-4">
                        <Label htmlFor="children" className="text-sm sm:text-lg font-black mb-1 sm:mb-0" style={{ color: COLORS.TEAL }}>
                          Children
                        </Label>
                        {props.entranceType !== 'free' && props.priceChild > 0 && (
                          <span className="text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full" 
                                style={{ backgroundColor: `${COLORS.CORAL}20`, color: COLORS.CORAL }}>
                            KES {props.priceChild.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <Input
                        id="children"
                        type="number"
                        min="0"
                        placeholder="0"
                        max={props.slotLimitType === 'per_booking' ? props.totalCapacity : undefined}
                        value={formData.num_children}
                        onChange={(e) => setFormData({ ...formData, num_children: parseInt(e.target.value) || 0 })}
                        className="h-12 sm:h-16 text-2xl sm:text-3xl font-black text-center rounded-xl sm:rounded-2xl border-2"
                        style={{ borderColor: COLORS.TEAL }}
                      />
                      <p className="text-xs text-slate-400 mt-1.5 sm:mt-2 text-center">Under 18</p>
                    </div>
                  </div>

                  {/* Total Summary */}
                  <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl relative overflow-hidden"
                       style={{ 
                         background: `linear-gradient(135deg, ${COLORS.TEAL}15, ${COLORS.CORAL}15)`
                       }}>
                    <div className="relative z-10">
                      <p className="text-xs sm:text-sm font-bold text-slate-600 mb-1 sm:mb-2">Total Guests</p>
                      <p className="text-3xl sm:text-4xl font-black" style={{ color: COLORS.TEAL }}>
                        {formData.num_adults + formData.num_children}
                      </p>
                      {(formData.num_adults === 0 && formData.num_children === 0) && (
                        <p className="text-xs sm:text-sm text-red-600 font-medium mt-2 flex items-center gap-1.5 sm:gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          At least one guest required
                        </p>
                      )}
                      {insufficientSlots && (
                        <p className="text-xs sm:text-sm text-red-600 font-medium mt-2 flex items-center gap-1.5 sm:gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {props.slotLimitType === 'per_booking' 
                            ? `Maximum ${props.totalCapacity} guests allowed`
                            : `Only ${remainingSlots} slots available`
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Facilities */}
              {currentStep === facilitiesStepNum && facilitiesStepNum > 0 && (
                <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg" 
                         style={{ backgroundColor: COLORS.TEAL }}>
                      <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black" style={{ color: COLORS.TEAL }}>
                        Facilities
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500">Optional rentals available</p>
                    </div>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {props.facilities.filter(f => f.price > 0).map((facility, index) => {
                      const selected = formData.selectedFacilities.find(f => f.name === facility.name);
                      const isDateInvalid = selected && (
                        !selected.startDate || 
                        !selected.endDate || 
                        new Date(selected.endDate).getTime() < new Date(selected.startDate).getTime()
                      );

                      return (
                        <div key={facility.name} 
                             className="bg-white border-2 rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all"
                             style={{ 
                               borderColor: selected ? COLORS.TEAL : '#e2e8f0',
                               animationDelay: `${index * 100}ms`
                             }}>
                          <div className="p-4 sm:p-5">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 sm:gap-4 flex-1">
                                <Checkbox
                                  id={`facility-${facility.name}`}
                                  checked={!!selected}
                                  onCheckedChange={() => toggleFacility(facility)}
                                  className="mt-0.5 sm:mt-1 w-5 h-5 sm:w-6 sm:h-6 rounded-lg"
                                />
                                <div className="flex-1">
                                  <Label htmlFor={`facility-${facility.name}`} 
                                         className="text-base sm:text-lg font-bold cursor-pointer block mb-0.5 sm:mb-1"
                                         style={{ color: COLORS.TEAL }}>
                                    {facility.name}
                                  </Label>
                                </div>
                              </div>
                              <div className="text-right ml-2">
                                <p className="text-xl sm:text-2xl font-black" style={{ color: COLORS.CORAL }}>
                                  {facility.price.toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500 font-medium">KES/day</p>
                              </div>
                            </div>

                            {selected && (
                              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t-2 border-dashed" style={{ borderColor: `${COLORS.TEAL}30` }}>
                                <p className="text-xs sm:text-sm font-bold text-slate-700 mb-3 sm:mb-4">Rental Period</p>
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                  <div>
                                    <Label className="text-xs font-bold text-slate-500 mb-1.5 sm:mb-2 block">Start</Label>
                                    <Input
                                      type="date"
                                      value={selected.startDate || ""}
                                      onChange={(e) => updateFacilityDates(facility.name, 'startDate', e.target.value)}
                                      min={formData.visit_date || new Date().toISOString().split('T')[0]}
                                      className="h-10 sm:h-12 rounded-lg sm:rounded-xl border-2 text-sm"
                                      style={{ borderColor: COLORS.TEAL }}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs font-bold text-slate-500 mb-1.5 sm:mb-2 block">End</Label>
                                    <Input
                                      type="date"
                                      value={selected.endDate || ""}
                                      onChange={(e) => updateFacilityDates(facility.name, 'endDate', e.target.value)}
                                      min={selected.startDate || formData.visit_date || new Date().toISOString().split('T')[0]}
                                      className="h-10 sm:h-12 rounded-lg sm:rounded-xl border-2 text-sm"
                                      style={{ borderColor: COLORS.TEAL }}
                                    />
                                  </div>
                                </div>

                                {isDateInvalid && (
                                  <p className="text-xs sm:text-sm text-red-500 mt-2 sm:mt-3 font-medium flex items-center gap-1.5 sm:gap-2">
                                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    Please select valid dates
                                  </p>
                                )}

                                {selected.startDate && selected.endDate && !isDateInvalid && (
                                  <div className={cn(
                                    "flex items-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 p-2.5 sm:p-3 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm",
                                    facilityAvailabilityStatus[facility.name]?.isAvailable === true 
                                      ? "bg-emerald-50 text-emerald-700"
                                      : facilityAvailabilityStatus[facility.name]?.isAvailable === false
                                      ? "bg-red-50 text-red-700"
                                      : "bg-slate-50 text-slate-500"
                                  )}>
                                    {checkingAvailability ? (
                                      <><Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> Checking...</>
                                    ) : facilityAvailabilityStatus[facility.name]?.isAvailable === true ? (
                                      <><Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Available</>
                                    ) : facilityAvailabilityStatus[facility.name]?.isAvailable === false ? (
                                      <><X className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {facilityAvailabilityStatus[facility.name]?.message}</>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-center text-xs sm:text-sm text-slate-400 italic">Skip if not needed</p>
                </div>
              )}

              {/* Step 4: Activities */}
              {currentStep === activitiesStepNum && activitiesStepNum > 0 && (
                <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg" 
                         style={{ backgroundColor: COLORS.CORAL }}>
                      <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black" style={{ color: COLORS.TEAL }}>
                        Activities
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500">Enhance your experience</p>
                    </div>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {props.activities.filter(a => a.price > 0).map((activity, index) => {
                      const selected = formData.selectedActivities.find(a => a.name === activity.name);
                      return (
                        <div key={activity.name}
                             className="bg-white border-2 rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all"
                             style={{ 
                               borderColor: selected ? COLORS.CORAL : '#e2e8f0',
                               animationDelay: `${index * 100}ms`
                             }}>
                          <div className="p-4 sm:p-5">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 sm:gap-4 flex-1">
                                <Checkbox
                                  id={`activity-${activity.name}`}
                                  checked={!!selected}
                                  onCheckedChange={() => toggleActivity(activity)}
                                  className="mt-0.5 sm:mt-1 w-5 h-5 sm:w-6 sm:h-6 rounded-lg"
                                />
                                <div className="flex-1">
                                  <Label htmlFor={`activity-${activity.name}`}
                                         className="text-base sm:text-lg font-bold cursor-pointer block"
                                         style={{ color: COLORS.TEAL }}>
                                    {activity.name}
                                  </Label>
                                </div>
                              </div>
                              <div className="text-right ml-2">
                                <p className="text-xl sm:text-2xl font-black" style={{ color: COLORS.CORAL }}>
                                  {activity.price.toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500 font-medium">KES/person</p>
                              </div>
                            </div>

                            {selected && (
                              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t-2 border-dashed" style={{ borderColor: `${COLORS.CORAL}30` }}>
                                <Label className="text-xs sm:text-sm font-bold text-slate-700 mb-2 sm:mb-3 block">
                                  Number of Participants
                                </Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={selected.numberOfPeople}
                                  onChange={(e) => updateActivityPeople(activity.name, parseInt(e.target.value) || 1)}
                                  className="h-12 sm:h-14 text-xl sm:text-2xl font-black text-center rounded-xl border-2 w-28 sm:w-32"
                                  style={{ borderColor: COLORS.CORAL }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-center text-xs sm:text-sm text-slate-400 italic">Skip if not interested</p>
                </div>
              )}

              {/* Final Step: Summary & Payment */}
              {currentStep === totalSteps && (
                <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {!user && (
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg" 
                             style={{ backgroundColor: COLORS.TEAL }}>
                          <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl sm:text-2xl md:text-3xl font-black" style={{ color: COLORS.TEAL }}>
                            Your Details
                          </h2>
                          <p className="text-xs sm:text-sm text-slate-500">For booking confirmation</p>
                        </div>
                      </div>

                      <div className="bg-white/80 backdrop-blur-sm border-2 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl space-y-3 sm:space-y-4"
                           style={{ borderColor: `${COLORS.TEAL}40` }}>
                        <div>
                          <Label htmlFor="guest_name" className="text-xs sm:text-sm font-bold text-slate-700 mb-1.5 sm:mb-2 block">
                            Full Name
                          </Label>
                          <Input
                            id="guest_name"
                            placeholder="John Doe"
                            value={formData.guest_name}
                            onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                            className="h-11 sm:h-12 rounded-xl border-2 text-sm sm:text-base"
                            style={{ borderColor: COLORS.TEAL }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="guest_email" className="text-xs sm:text-sm font-bold text-slate-700 mb-1.5 sm:mb-2 block">
                            Email Address
                          </Label>
                          <Input
                            id="guest_email"
                            type="email"
                            placeholder="john@example.com"
                            value={formData.guest_email}
                            onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                            className="h-11 sm:h-12 rounded-xl border-2 text-sm sm:text-base"
                            style={{ borderColor: COLORS.TEAL }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="guest_phone" className="text-xs sm:text-sm font-bold text-slate-700 mb-1.5 sm:mb-2 block">
                            Phone (Optional)
                          </Label>
                          <Input
                            id="guest_phone"
                            type="tel"
                            placeholder="0712345678"
                            value={formData.guest_phone}
                            onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                            className="h-11 sm:h-12 rounded-xl border-2 text-sm sm:text-base"
                            style={{ borderColor: COLORS.TEAL }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Order Summary */}
                  <div className="bg-white border-2 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden"
                       style={{ borderColor: COLORS.TEAL }}>
                    <div className="p-4 sm:p-6 border-b-2" style={{ 
                      background: `linear-gradient(135deg, ${COLORS.TEAL}10, ${COLORS.CORAL}10)`,
                      borderColor: `${COLORS.TEAL}20`
                    }}>
                      <h3 className="text-xl sm:text-2xl font-black" style={{ color: COLORS.TEAL }}>
                        Booking Summary
                      </h3>
                    </div>

                    <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                      {formData.visit_date && (
                        <div className="flex justify-between items-center pb-2 sm:pb-3 border-b border-slate-100">
                          <span className="text-xs sm:text-sm text-slate-600 font-medium">Visit Date</span>
                          <span className="text-sm sm:text-base font-bold text-slate-900">
                            {new Date(formData.visit_date).toLocaleDateString('en-GB', { 
                              day: 'numeric', 
                              month: 'short', 
                              year: 'numeric' 
                            })}
                          </span>
                        </div>
                      )}

                      {formData.num_adults > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs sm:text-sm text-slate-600">
                            {formData.num_adults} Adult{formData.num_adults > 1 ? 's' : ''}
                          </span>
                          <span className="text-sm sm:text-base font-bold">
                            KES {(formData.num_adults * props.priceAdult).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {formData.num_children > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs sm:text-sm text-slate-600">
                            {formData.num_children} Child{formData.num_children > 1 ? 'ren' : ''}
                          </span>
                          <span className="text-sm sm:text-base font-bold">
                            KES {(formData.num_children * props.priceChild).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {formData.selectedFacilities.map(f => {
                        if (!f.startDate || !f.endDate) return null;
                        const days = Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (1000 * 60 * 60 * 24)) || 1;
                        return (
                          <div key={f.name} className="flex justify-between items-center">
                            <span className="text-xs sm:text-sm text-slate-600">
                              {f.name} <span className="text-xs">({days}d)</span>
                            </span>
                            <span className="text-sm sm:text-base font-bold">
                              KES {(f.price * days).toLocaleString()}
                            </span>
                          </div>
                        );
                      })}

                      {formData.selectedActivities.map(a => (
                        <div key={a.name} className="flex justify-between items-center">
                          <span className="text-xs sm:text-sm text-slate-600">
                            {a.name} <span className="text-xs">×{a.numberOfPeople}</span>
                          </span>
                          <span className="text-sm sm:text-base font-bold">
                            KES {(a.price * a.numberOfPeople).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 sm:p-6 border-t-2" style={{ 
                      background: `linear-gradient(135deg, ${COLORS.TEAL}15, ${COLORS.CORAL}15)`,
                      borderColor: `${COLORS.TEAL}30`
                    }}>
                      <div className="flex justify-between items-baseline">
                        <span className="text-base sm:text-lg font-black" style={{ color: COLORS.TEAL }}>
                          TOTAL
                        </span>
                        <span className="text-3xl sm:text-4xl font-black" style={{ color: COLORS.CORAL }}>
                          KES {total.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Badge */}
                  {total > 0 && (
                    <div className="flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl"
                         style={{ backgroundColor: `${COLORS.TEAL}10` }}>
                      <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: COLORS.TEAL }} />
                      <div>
                        <p className="text-xs sm:text-sm font-bold" style={{ color: COLORS.TEAL }}>Secure Payment via Paystack</p>
                        <p className="text-xs text-slate-500">You'll be redirected to complete payment</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fixed Footer Navigation */}
            <div className="flex-shrink-0 p-3 sm:p-6 bg-white border-t-2 border-slate-100">
              <div className="flex gap-2 sm:gap-3">
                {currentStep > (props.skipDateSelection ? guestsStepNum : dateStepNum) && (
                  <Button
                    onClick={handlePrevious}
                    variant="outline"
                    className="flex-1 h-12 sm:h-16 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base border-2 hover:scale-[0.98] transition-transform"
                    style={{ borderColor: COLORS.TEAL, color: COLORS.TEAL }}
                  >
                    ← Back
                  </Button>
                )}

                {currentStep < totalSteps ? (
                  <Button
                    onClick={handleNext}
                    disabled={
                      (currentStep === dateStepNum && !formData.visit_date && !props.skipDateSelection) ||
                      (currentStep === guestsStepNum && (formData.num_adults === 0 && formData.num_children === 0)) ||
                      (currentStep === guestsStepNum && insufficientSlots) ||
                      (currentStep === facilitiesStepNum && formData.selectedFacilities.length > 0 && !areFacilityDatesValid()) ||
                      isGloballySoldOut
                    }
                    className="flex-1 h-12 sm:h-16 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base text-white shadow-lg hover:shadow-xl hover:scale-[0.98] transition-all disabled:opacity-50"
                    style={{ backgroundColor: COLORS.TEAL }}
                  >
                    Continue →
                  </Button>
                ) : (
                  <Button
                    onClick={handleBookingSubmit}
                    disabled={
                      isPaystackLoading || 
                      isCardPaymentLoading ||
                      isGloballySoldOut ||
                      insufficientSlots ||
                      (!user && (!formData.guest_name || !formData.guest_email))
                    }
                    className="flex-1 h-12 sm:h-16 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base text-white shadow-lg hover:shadow-xl hover:scale-[0.98] transition-all disabled:opacity-50"
                    style={{ backgroundColor: COLORS.CORAL }}
                  >
                    {(isPaystackLoading || isCardPaymentLoading) ? (
                      <><Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin mr-2" /> Processing</>
                    ) : total === 0 ? (
                      "Confirm Free Booking"
                    ) : (
                      `Pay KES ${total.toLocaleString()}`
                    )}
                  </Button>
                )}
              </div>
            </div>

            <style>{`
              .hide-scrollbar::-webkit-scrollbar {
                display: none;
              }
              .hide-scrollbar {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
              @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slide-in-from-bottom-4 {
                from { transform: translateY(1rem); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
              @keyframes slide-in-from-top {
                from { transform: translateY(-1rem); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
              .animate-in {
                animation: fade-in 0.3s ease-out, slide-in-from-bottom-4 0.5s ease-out;
              }
            `}</style>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingPage;