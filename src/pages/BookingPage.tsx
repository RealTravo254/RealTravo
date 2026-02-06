import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { usePaystackPopup } from "@/hooks/usePaystackPopup";
import { useAuth } from "@/contexts/AuthContext";
import { getReferralTrackingId } from "@/lib/referralUtils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PaymentSuccessDialog } from "@/components/booking/PaymentSuccessDialog";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
};

type BookingType = 'trip' | 'event' | 'hotel' | 'adventure_place' | 'attraction';

const BookingPage = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [searchParams] = useSearchParams();
  
  // Payment success dialog state
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [completedBookingData, setCompletedBookingData] = useState<any>(null);
  
  const { initiatePayment, isLoading: isPaymentLoading } = usePaystackPopup({
    onSuccess: (reference, bookingData) => {
      console.log('Payment success callback:', reference, bookingData);
      setIsProcessing(false);
      setIsCompleted(true);
      setPaymentReference(reference);
      setCompletedBookingData(bookingData);
      setShowSuccessDialog(true);
    },
    onError: (error) => {
      toast({ title: "Payment Error", description: error, variant: "destructive" });
      setIsProcessing(false);
    },
    onClose: () => {
      setIsProcessing(false);
    },
  });

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
        totalAmount = (formData.num_adults * item.price) + (formData.num_children * (item.price_child || 0));
      } else if (type === "adventure_place" || type === "adventure") {
        // In facility-only mode, don't charge entry fee
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
        // Hotels are always facility-based (rooms)
        formData.selectedActivities?.forEach(a => totalAmount += a.price * a.numberOfPeople);
        formData.selectedFacilities?.forEach(f => {
          if (f.startDate && f.endDate) {
            const days = Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (1000 * 60 * 60 * 24));
            totalAmount += f.price * Math.max(days, 1);
          }
        });
      }

      // Calculate slots booked - for facility-only mode, use facility count
      const slotsBooked = isFacilityOnly 
        ? formData.selectedFacilities?.length || 1
        : formData.num_adults + formData.num_children;

      // Get visit date - for facility bookings, use the first facility's start date
      let visitDate = formData.visit_date || item.date;
      if (isFacilityOnly && formData.selectedFacilities?.length && formData.selectedFacilities[0].startDate) {
        visitDate = formData.selectedFacilities[0].startDate;
      }
      
      // Prepare booking data for Paystack
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
      
      // Initiate Paystack payment - opens popup
      await initiatePayment(formData.guest_email, totalAmount, bookingData);
      
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
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

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full bg-slate-100 hover:bg-slate-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black uppercase tracking-tight truncate" style={{ color: COLORS.TEAL }}>
              Book {item.name}
            </h1>
            <p className="text-xs text-slate-500 truncate">{item.location}, {item.country}</p>
          </div>
        </div>
      </div>

      {/* Full Page Booking Form */}
      <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
        <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 overflow-hidden">
          <MultiStepBooking {...getMultiStepProps()} />
        </div>
      </div>

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
