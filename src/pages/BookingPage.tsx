import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { usePaystackPopup } from "@/hooks/usePaystackPopup";
import { useAuth } from "@/contexts/AuthContext";
import { getReferralTrackingId } from "@/lib/referralUtils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CreditCard } from "lucide-react";
import { PaymentSuccessDialog } from "@/components/booking/PaymentSuccessDialog";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
};

type BookingType = 'trip' | 'event' | 'hotel' | 'adventure_place' | 'attraction';

const BookingPage = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const goBack = useSafeBack();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [searchParams] = useSearchParams();
  
  // Payment success dialog state
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [completedBookingData, setCompletedBookingData] = useState<any>(null);
  
  const { initiatePayment, launchPaystack, isLoading: isPaymentLoading, showPaystackContainer } = usePaystackPopup({
    onSuccess: (reference, bookingData) => {
      console.log('Payment success callback:', reference, bookingData);
      setPaymentReference(reference);
      setCompletedBookingData(bookingData);
      setIsVerifying(false);
      setIsCompleted(true);
      setIsProcessing(false);
      setShowSuccessDialog(true);
    },
    onVerifying: () => {
      setIsVerifying(true);
    },
    onError: (error) => {
      toast({ title: "Payment Error", description: error, variant: "destructive" });
      setIsProcessing(false);
      setIsVerifying(false);
    },
    onClose: () => {
      setIsProcessing(false);
      setIsVerifying(false);
    },
  });

  // Launch Paystack into the container once it's ready
  useEffect(() => {
    if (showPaystackContainer) {
      const timer = setTimeout(() => {
        launchPaystack('paystack-checkout-container');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showPaystackContainer, launchPaystack]);

  useEffect(() => {
    if (id && type) fetchItem();
    window.scrollTo(0, 0);
  }, [id, type]);

  const fetchItem = async () => {
    if (!id || !type) return;
    
    try {
      let data = null;
      let error = null;
      
      if (type === "trip" || type === "event") {
        const result = await supabase
          .from("trips")
          .select("id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,slot_limit_type,price,price_child,available_tickets,description,activities,phone_number,email,created_by,opening_hours,closing_hours,days_opened,type,approval_status,is_hidden,ticket_types,allow_children")
          .eq("id", id)
          .maybeSingle();
        data = result.data;
        error = result.error;
      } else if (type === "adventure_place" || type === "adventure") {
        const result = await supabase
          .from("adventure_places")
          .select("id,name,location,place,country,image_url,description,amenities,facilities,activities,phone_numbers,email,opening_hours,closing_hours,days_opened,approval_status,is_hidden,entry_fee,entry_fee_type,available_slots,created_by")
          .eq("id", id)
          .maybeSingle();
        data = result.data;
        error = result.error;
      } else if (type === "hotel") {
        const result = await supabase
          .from("hotels")
          .select("id,name,location,place,country,image_url,description,amenities,facilities,activities,phone_numbers,email,opening_hours,closing_hours,days_opened,approval_status,is_hidden,available_rooms,created_by,establishment_type,general_booking_link")
          .eq("id", id)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }
      
      if (error) {
        console.error("Booking fetchItem error:", error);
        toast({ title: "Item not found", description: "Could not load booking details.", variant: "destructive" });
        navigate(-1);
        return;
      }
      
      if (!data) {
        toast({ title: "Item not found", description: "The item you're trying to book doesn't exist.", variant: "destructive" });
        navigate(-1);
        return;
      }
      
      // Block booking if item is hidden or not approved
      if (data.is_hidden || (data.approval_status && data.approval_status !== 'approved')) {
        toast({ title: "Unavailable", description: "This item is not currently available for booking.", variant: "destructive" });
        navigate('/');
        return;
      }
      
      setItem(data);
    } catch (error) {
      console.error("Booking fetchItem catch:", error);
      toast({ title: "Item not found", variant: "destructive" });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const getBookingType = (): BookingType => {
    if (type === "trip") return "trip";
    if (type === "event") return "event";
    if (type === "adventure_place" || type === "adventure") return "adventure_place";
    if (type === "hotel") return "hotel";
    return "attraction";
  };

  const handleBookingSubmit = async (formData: BookingFormData) => {
    if (!item || !type) return;
    setIsProcessing(true);
    
    try {
      let totalAmount = 0;
      const bookingType = getBookingType();
      const isFacilityOnly = searchParams.get("skipToFacility") === "true";
      
      if (type === "trip" || type === "event") {
        if (formData.ticketSelections && formData.ticketSelections.length > 0) {
          formData.ticketSelections.forEach(t => totalAmount += t.price * t.quantity);
        } else {
          totalAmount = (formData.num_adults * item.price) + (formData.num_children * (item.price_child || 0));
        }
      } else if (type === "adventure_place" || type === "adventure") {
        if (!isFacilityOnly) {
          const entryFee = item.entry_fee || 0;
          totalAmount = (formData.num_adults + formData.num_children) * entryFee;
        }
        formData.selectedActivities?.forEach(a => totalAmount += a.price * a.numberOfPeople);
        formData.selectedFacilities?.forEach(f => {
          if (f.startDate && f.endDate) {
            const days = Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (1000 * 60 * 60 * 24));
            totalAmount += f.price * Math.max(days, 1);
          }
        });
      } else if (type === "hotel") {
        formData.selectedActivities?.forEach(a => totalAmount += a.price * a.numberOfPeople);
        formData.selectedFacilities?.forEach(f => {
          if (f.startDate && f.endDate) {
            const days = Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (1000 * 60 * 60 * 24));
            totalAmount += f.price * Math.max(days, 1);
          }
        });
      }

      const slotsBooked = isFacilityOnly 
        ? formData.selectedFacilities?.length || 1
        : formData.num_adults + formData.num_children;

      let visitDate = formData.visit_date || item.date;
      if (isFacilityOnly && formData.selectedFacilities?.length && formData.selectedFacilities[0].startDate) {
        visitDate = formData.selectedFacilities[0].startDate;
      }
      
      const bookingData = {
        item_id: item.id,
        booking_type: bookingType,
        total_amount: totalAmount,
        booking_details: { 
          ...formData, 
          item_name: item.name,
          is_facility_only: isFacilityOnly,
          adults: formData.num_adults,
          children: formData.num_children,
          facilities: formData.selectedFacilities,
          activities: formData.selectedActivities,
        },
        user_id: user?.id || null,
        is_guest_booking: !user,
        guest_name: formData.guest_name,
        guest_email: formData.guest_email,
        guest_phone: formData.guest_phone || "",
        visit_date: visitDate,
        slots_booked: slotsBooked,
        host_id: item.created_by,
        referral_tracking_id: getReferralTrackingId(),
        emailData: {
          itemName: item.name,
        },
      };
      
      await initiatePayment(formData.guest_email, totalAmount, bookingData);
      
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  // Handle back from Paystack checkout — cancel and return to form
  const handlePaystackBack = () => {
    setIsProcessing(false);
    setIsVerifying(false);
    // Force page reload to reset Paystack state cleanly
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FA]">
        <Loader2 className="h-10 w-10 animate-spin text-[#008080] mb-4" />
        <p className="text-sm font-black uppercase tracking-tighter animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!item) return null;

  const getMultiStepProps = () => {
    const baseProps = {
      onSubmit: handleBookingSubmit,
      isProcessing: isProcessing || isPaymentLoading,
      isCompleted,
      itemName: item.name,
      itemId: item.id,
      hostId: item.created_by || "",
      onPaymentSuccess: () => {
        setIsCompleted(true);
      },
      primaryColor: COLORS.TEAL,
      accentColor: COLORS.CORAL,
    };
    
    if (type === "trip" || type === "event") {
      const parsedTicketTypes = Array.isArray(item.ticket_types) 
        ? (item.ticket_types as any[]).map((t: any) => ({ name: t.name, price: Number(t.price) }))
        : [];
      return {
        ...baseProps,
        bookingType: type,
        priceAdult: item.price,
        priceChild: item.price_child,
        activities: item.activities || [],
        skipFacilitiesAndActivities: true,
        skipDateSelection: !item.is_custom_date && !item.is_flexible_date,
        fixedDate: item.is_flexible_date ? "" : item.date,
        totalCapacity: item.available_tickets || 0,
        slotLimitType: item.slot_limit_type || (item.is_flexible_date ? 'per_booking' : 'inventory'),
        isFlexibleDate: item.is_flexible_date || false,
        ticketTypes: parsedTicketTypes,
        allowChildren: item.allow_children !== false,
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
        skipDateSelection: true,
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

  return (
    <div className="min-h-screen bg-[#F8F9FA]">

      {/* ── Standard header: form view & verifying ── */}
      {!isCompleted && !showPaystackContainer && (
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
          <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (isProcessing || isVerifying) {
                  setIsProcessing(false);
                  setIsVerifying(false);
                } else {
                  goBack();
                }
              }}
              className="rounded-full bg-slate-100 hover:bg-slate-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-black uppercase tracking-tight truncate" style={{ color: COLORS.TEAL }}>
                {isVerifying ? "Checkout" : `Book ${item.name}`}
              </h1>
              <p className="text-xs text-slate-500 truncate">
                {isVerifying ? "Processing payment..." : `${item.location}, ${item.country}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Paystack header: back to checkout ── */}
      {showPaystackContainer && !isCompleted && (
        <div className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
          <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePaystackBack}
              className="rounded-full bg-slate-100 hover:bg-slate-200 shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-black uppercase tracking-tight truncate" style={{ color: COLORS.TEAL }}>
                Back to Checkout
              </h1>
              <p className="text-xs text-slate-500 truncate">
                Complete payment for {item.name}
              </p>
            </div>
            {/* Secure badge */}
            <div className="flex items-center gap-1.5 shrink-0 bg-teal-50 text-teal-700 text-[11px] font-bold px-3 py-1.5 rounded-full">
              <CreditCard className="h-3.5 w-3.5" />
              Secure Pay
            </div>
          </div>
        </div>
      )}

      {/* Verifying / Processing Payment Screen */}
      {isVerifying && !isCompleted && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-pulse">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground mb-2 text-center">
            Processing Your Booking
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Please wait while we verify your payment and confirm your booking...
          </p>
          <div className="mt-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* Paystack Inline Checkout Container */}
      {showPaystackContainer && !isCompleted && !isVerifying && (
        <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
          <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-black uppercase tracking-tight mb-1" style={{ color: COLORS.TEAL }}>
                Complete Payment
              </h2>
              <p className="text-xs text-slate-500">Enter your payment details below to complete your booking</p>
            </div>
            <div 
              id="paystack-checkout-container" 
              className="w-full min-h-[400px]"
            />
          </div>
        </div>
      )}

      {/* Full Page Booking Form */}
      {!isCompleted && !isVerifying && !showPaystackContainer && (
        <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
          <div className="bg-white rounded-[32px] shadow-xl border border-slate-100">
            <MultiStepBooking {...getMultiStepProps()} />
          </div>
        </div>
      )}

      {/* Payment Success Dialog */}
      <PaymentSuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        bookingData={completedBookingData}
        reference={paymentReference}
      />
    </div>
  );
};

export default BookingPage;