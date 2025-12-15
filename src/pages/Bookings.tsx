import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Users, MapPin, CalendarClock, RefreshCw, XCircle } from "lucide-react";
import { RescheduleBookingDialog } from "@/components/booking/RescheduleBookingDialog";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Booking {
  id: string;
  booking_type: string;
  total_amount: number;
  booking_details: any;
  payment_status: string;
  status: string;
  created_at: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  slots_booked: number | null;
  visit_date: string | null;
  item_id: string;
  isPending?: boolean;
  payment_phone?: string;
  pendingPaymentId?: string;
  result_code?: string | null;
}

const Bookings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [retryingPaymentId, setRetryingPaymentId] = useState<string | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);


  useEffect(() => {
    if (user) {
      fetchBookings();

      // Subscribe to real-time updates on payments
      const channel = supabase
        .channel('payments-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payments',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Pending payment update:', payload);
            // Refresh bookings when any change occurs
            fetchBookings();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchBookings = async () => {
    try {
      // Fetch confirmed bookings
      const { data: confirmedBookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (bookingsError) throw bookingsError;

      // Fetch pending/failed payments from payments table
      const { data: pendingPayments, error: pendingError } = await supabase
        .from("payments" as any)
        .select("*")
        .eq("user_id", user?.id)
        .in("payment_status", ["pending", "failed"])
        .order("created_at", { ascending: false });

      if (pendingError) throw pendingError;

      // Transform pending payments to booking format
      const pendingAsBookings: Booking[] = (pendingPayments || []).map((pp: any) => ({
        id: pp.id,
        booking_type: pp.booking_data?.booking_type || "unknown",
        total_amount: pp.amount,
        booking_details: pp.booking_data?.booking_details || {},
        payment_status: pp.payment_status,
        status: "pending",
        created_at: pp.created_at,
        guest_name: pp.booking_data?.guest_name || null,
        guest_email: pp.booking_data?.guest_email || null,
        guest_phone: pp.booking_data?.guest_phone || null,
        slots_booked: pp.booking_data?.slots_booked || 1,
        visit_date: pp.booking_data?.visit_date || null,
        item_id: pp.booking_data?.item_id || "",
        isPending: true,
        payment_phone: pp.phone_number,
        pendingPaymentId: pp.id,
        result_code: pp.result_code,
      }));

      // Combine and sort by date
      const allBookings = [...(confirmedBookings || []), ...pendingAsBookings].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setBookings(allBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get color based on Daraja result code or payment status
  const getStatusColor = (booking: Booking) => {
    const { payment_status, result_code } = booking;
    
    // Check result_code first (actual Daraja codes)
    if (result_code) {
      switch (result_code) {
        case "0": return "bg-green-500/10 text-green-500"; // Success
        case "1": return "bg-orange-500/10 text-orange-500"; // Insufficient funds
        case "1025": return "bg-red-500/10 text-red-500"; // Wrong PIN
        case "1032": return "bg-red-500/10 text-red-500"; // User cancelled
        case "1037": return "bg-yellow-500/10 text-yellow-500"; // Timeout
        case "1001": return "bg-orange-500/10 text-orange-500"; // Subscriber busy
        case "2001": return "bg-red-500/10 text-red-500"; // Invalid initiator
        default: return "bg-orange-500/10 text-orange-500"; // Other failures
      }
    }
    
    // Fallback to payment_status
    switch (payment_status) {
      case "confirmed": 
      case "paid":
      case "completed":
        return "bg-green-500/10 text-green-500";
      case "pending": 
        return "bg-yellow-500/10 text-yellow-500";
      default: 
        return "bg-gray-500/10 text-gray-500";
    }
  };

  // Get label based on Daraja result code
  const getPaymentStatusLabel = (booking: Booking) => {
    const { payment_status, result_code } = booking;
    
    // Check result_code first (actual Daraja codes)
    if (result_code) {
      switch (result_code) {
        case "0": return "Paid";
        case "1": return "Insufficient Funds";
        case "1025": return "Wrong PIN";
        case "1032": return "Cancelled by User";
        case "1037": return "PIN Timeout";
        case "1001": return "Subscriber Busy";
        case "2001": return "Invalid Request";
        case "2": return "Not Supported";
        default: return `Failed (${result_code})`;
      }
    }
    
    // Fallback to payment_status
    switch (payment_status) {
      case "paid":
      case "completed":
        return "Paid";
      case "pending":
        return "Awaiting Payment";
      default:
        return payment_status;
    }
  };

  // Check if payment can be retried based on result_code
  const canRetryPayment = (booking: Booking) => {
    if (!booking.isPending) return false;
    const { result_code, payment_status } = booking;
    
    // Allow retry for these Daraja result codes
    if (result_code) {
      return ["1", "1025", "1032", "1037", "1001", "2001", "2"].includes(result_code);
    }
    
    // Fallback to payment_status
    return ["failed", "cancelled", "timeout"].includes(payment_status);
  };

  // Check if booking can be rescheduled - 48hr advance for all except fixed date trips/events
  const canReschedule = (booking: Booking) => {
    // Only paid/completed bookings can be rescheduled
    if (!['paid', 'completed'].includes(booking.payment_status)) return false;
    
    // Cancelled bookings cannot be rescheduled
    if (booking.status === 'cancelled') return false;

    // Events with fixed dates cannot be rescheduled
    if (booking.booking_type === 'event') return false;

    return true;
  };

  // Check if booking can be cancelled - must be at least 48 hours before visit date
  const canCancel = (booking: Booking) => {
    // Only paid/completed bookings can be cancelled
    if (!['paid', 'completed'].includes(booking.payment_status)) return false;
    
    // Already cancelled bookings
    if (booking.status === 'cancelled') return false;

    // Check 48-hour constraint if visit_date exists
    if (booking.visit_date) {
      const visitDate = new Date(booking.visit_date);
      const now = new Date();
      const hoursUntil = (visitDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntil < 48) return false;
    }

    return true;
  };

  const getTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const retryPayment = async (booking: Booking) => {
    if (!booking.payment_phone || !booking.pendingPaymentId) {
      toast.error("Unable to retry payment. Missing payment information.");
      return;
    }

    setRetryingPaymentId(booking.pendingPaymentId);

    try {
      // Get the payment record to retrieve booking data
      const { data: pendingPayment, error: fetchError } = await supabase
        .from("payments" as any)
        .select("*")
        .eq("id", booking.pendingPaymentId)
        .single();

      if (fetchError || !pendingPayment) {
        throw new Error("Could not find payment record");
      }

      const payment = pendingPayment as any;

      // Call M-Pesa STK Push
      const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
        body: {
          phoneNumber: payment.phone_number,
          amount: payment.amount,
          accountReference: payment.account_reference,
          transactionDesc: `Retry: ${payment.transaction_desc || "Booking Payment"}`,
          bookingData: payment.booking_data,
        },
      });

      if (error) throw error;

      if (data?.success) {
        // Update payment record with new checkout request ID
        await supabase
          .from("payments" as any)
          .update({
            checkout_request_id: data.checkoutRequestId,
            merchant_request_id: data.merchantRequestId,
            payment_status: "pending",
            result_code: null,
            result_desc: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", booking.pendingPaymentId);

        toast.success("Payment request sent! Please check your phone for the M-Pesa prompt.");
        
        // Refresh bookings after a delay
        setTimeout(() => {
          fetchBookings();
        }, 3000);
      } else {
        throw new Error(data?.error || "Failed to initiate payment");
      }
    } catch (error: any) {
      console.error("Error retrying payment:", error);
      toast.error(error.message || "Failed to retry payment. Please try again.");
    } finally {
      setRetryingPaymentId(null);
    }
  };

  const openCancelDialog = (booking: Booking) => {
    setBookingToCancel(booking);
    setShowCancelDialog(true);
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;
    
    setCancellingBookingId(bookingToCancel.id);
    
    try {
      // Update booking status to cancelled
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingToCancel.id);

      if (error) throw error;

      // Get item name for notification
      const itemName = bookingToCancel.booking_details.trip_name || 
                       bookingToCancel.booking_details.event_name || 
                       bookingToCancel.booking_details.hotel_name ||
                       bookingToCancel.booking_details.place_name ||
                       'Your booking';

      // Create notification for user
      await supabase.from('notifications').insert({
        user_id: user?.id,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `Your booking for ${itemName} has been cancelled.`,
        data: {
          booking_id: bookingToCancel.id
        }
      });

      // Notify host
      let creatorId = null;
      if (bookingToCancel.booking_type === 'trip') {
        const { data } = await supabase.from('trips').select('created_by').eq('id', bookingToCancel.item_id).single();
        creatorId = data?.created_by;
      } else if (bookingToCancel.booking_type === 'hotel') {
        const { data } = await supabase.from('hotels').select('created_by').eq('id', bookingToCancel.item_id).single();
        creatorId = data?.created_by;
      } else if (bookingToCancel.booking_type === 'adventure' || bookingToCancel.booking_type === 'adventure_place') {
        const { data } = await supabase.from('adventure_places').select('created_by').eq('id', bookingToCancel.item_id).single();
        creatorId = data?.created_by;
      } else if (bookingToCancel.booking_type === 'attraction') {
        // Attractions table doesn't exist - skip
        creatorId = null;
      }

      if (creatorId) {
        await supabase.from('notifications').insert({
          user_id: creatorId,
          type: 'booking_cancelled_host',
          title: 'Booking Cancelled',
          message: `Booking #${bookingToCancel.id.substring(0, 8)} for ${itemName} has been cancelled by the user.`,
          data: {
            booking_id: bookingToCancel.id
          }
        });
      }

      toast.success("Booking cancelled successfully");
      fetchBookings();
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      toast.error(error.message || "Failed to cancel booking. Please try again.");
    } finally {
      setCancellingBookingId(null);
      setShowCancelDialog(false);
      setBookingToCancel(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header />
        <main className="container px-4 py-8">
          <p>Loading...</p>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">My Bookings</h1>
        
        {bookings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">No bookings yet</p>
            <p className="text-muted-foreground mt-2">Your upcoming trips and reservations will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline">{getTypeLabel(booking.booking_type)}</Badge>
                      {booking.isPending ? (
                        <Badge className={getStatusColor(booking)}>
                          {getPaymentStatusLabel(booking)}
                        </Badge>
                      ) : (
                        <>
                          <Badge className={booking.status === 'cancelled' ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"}>
                            {booking.status}
                          </Badge>
                          <Badge className={getStatusColor(booking)}>
                            {getPaymentStatusLabel(booking)}
                          </Badge>
                        </>
                      )}
                    </div>

                    <h3 className="text-xl font-semibold">
                      {booking.booking_details.trip_name || 
                       booking.booking_details.event_name || 
                       booking.booking_details.hotel_name ||
                       booking.booking_details.place_name ||
                       'Booking'}
                    </h3>

                    <p className="text-xs text-muted-foreground font-mono">
                      Booking ID: {booking.id}
                    </p>

                    <div className="flex flex-col gap-3 text-sm">
                      {/* Contact Information */}
                      {(booking.guest_name || booking.guest_email || booking.guest_phone) && (
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">Contact:</p>
                          {booking.guest_name && <p className="text-muted-foreground">Name: {booking.guest_name}</p>}
                          {booking.guest_email && <p className="text-muted-foreground">Email: {booking.guest_email}</p>}
                          {booking.guest_phone && <p className="text-muted-foreground">Phone: {booking.guest_phone}</p>}
                        </div>
                      )}

                      {/* Booking Details */}
                      <div className="flex flex-wrap gap-4 text-muted-foreground">
                        {booking.visit_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>Visit: {new Date(booking.visit_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {booking.booking_details.date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(booking.booking_details.date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {booking.slots_booked && (
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{booking.slots_booked} Tickets</span>
                          </div>
                        )}
                        {(booking.booking_details.adults || booking.booking_details.children) && (
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>
                              {booking.booking_details.adults ? `${booking.booking_details.adults} Adults` : ''}
                              {booking.booking_details.children ? ` • ${booking.booking_details.children} Children` : ''}
                            </span>
                          </div>
                        )}
                        {booking.booking_details.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{booking.booking_details.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Facility Information */}
                    {(booking.booking_details.facilities || booking.booking_details.selected_facilities) && (
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Facilities Booked:</p>
                        {(booking.booking_details.facilities || booking.booking_details.selected_facilities)?.map((facility: any, idx: number) => (
                          <p key={idx} className="text-sm text-muted-foreground">
                            {facility.name} {facility.capacity ? `(Capacity: ${facility.capacity})` : ''} - KSh {facility.price}
                            {facility.startDate && facility.endDate && 
                              ` from ${new Date(facility.startDate).toLocaleDateString()} to ${new Date(facility.endDate).toLocaleDateString()}`
                            }
                          </p>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Booked on {new Date(booking.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold">KSh {booking.total_amount}</span>
                    </div>
                    
                    {/* Retry Payment Button for failed/cancelled/timeout payments */}
                    {canRetryPayment(booking) && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => retryPayment(booking)}
                        disabled={retryingPaymentId === booking.pendingPaymentId}
                        className="w-fit"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${retryingPaymentId === booking.pendingPaymentId ? 'animate-spin' : ''}`} />
                        {retryingPaymentId === booking.pendingPaymentId ? 'Retrying...' : 'Retry Payment'}
                      </Button>
                    )}
                    
                    {/* Reschedule Button */}
                    {canReschedule(booking) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRescheduleBooking(booking)}
                        className="w-fit"
                      >
                        <CalendarClock className="h-4 w-4 mr-2" />
                        Reschedule
                      </Button>
                    )}

                    {/* Cancel Button */}
                    {canCancel(booking) && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openCancelDialog(booking)}
                        disabled={cancellingBookingId === booking.id}
                        className="w-fit"
                      >
                        <XCircle className={`h-4 w-4 mr-2 ${cancellingBookingId === booking.id ? 'animate-spin' : ''}`} />
                        {cancellingBookingId === booking.id ? 'Cancelling...' : 'Cancel Booking'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <RescheduleBookingDialog
        booking={rescheduleBooking!}
        open={!!rescheduleBooking}
        onOpenChange={(open) => !open && setRescheduleBooking(null)}
        onSuccess={fetchBookings}
      />

      {/* Cancel Booking Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this booking for{" "}
              <span className="font-semibold">
                {bookingToCancel?.booking_details.trip_name || 
                 bookingToCancel?.booking_details.event_name || 
                 bookingToCancel?.booking_details.hotel_name ||
                 bookingToCancel?.booking_details.place_name ||
                 'this item'}
              </span>?
              <br />
              <br />
              This action cannot be undone. Please contact support for refund inquiries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              disabled={cancellingBookingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancellingBookingId ? "Cancelling..." : "Yes, Cancel Booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default Bookings;
