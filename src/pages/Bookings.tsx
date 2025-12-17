import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
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
      const { data: confirmedBookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (bookingsError) throw bookingsError;

      const { data: pendingPayments, error: pendingError } = await supabase
        .from("payments" as any)
        .select("*")
        .eq("user_id", user?.id)
        .in("payment_status", ["pending", "failed"])
        .order("created_at", { ascending: false });

      if (pendingError) throw pendingError;

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

  const getStatusColor = (booking: Booking) => {
    const { payment_status, result_code } = booking;
    if (result_code) {
      switch (result_code) {
        case "0": return "bg-green-500/10 text-green-500";
        case "1": return "bg-orange-500/10 text-orange-500";
        case "1025": return "bg-red-500/10 text-red-500";
        case "1032": return "bg-red-500/10 text-red-500";
        case "1037": return "bg-yellow-500/10 text-yellow-500";
        case "1001": return "bg-orange-500/10 text-orange-500";
        case "2001": return "bg-red-500/10 text-red-500";
        default: return "bg-orange-500/10 text-orange-500";
      }
    }
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

  const getPaymentStatusLabel = (booking: Booking) => {
    const { payment_status, result_code } = booking;
    if (result_code) {
      switch (result_code) {
        case "0": return "Paid";
        case "1": return "Insufficient Funds";
        case "1025": return "Wrong PIN";
        case "1032": return "Cancelled by User";
        case "1037": return "PIN Timeout";
        case "1001": return "Subscriber Busy";
        case "2001": return "Invalid Request";
        default: return `Failed (${result_code})`;
      }
    }
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

  const canRetryPayment = (booking: Booking) => {
    if (!booking.isPending) return false;
    const { result_code, payment_status } = booking;
    if (result_code) {
      return ["1", "1025", "1032", "1037", "1001", "2001", "2"].includes(result_code);
    }
    return ["failed", "cancelled", "timeout"].includes(payment_status);
  };

  const canReschedule = (booking: Booking) => {
    if (!['paid', 'completed'].includes(booking.payment_status)) return false;
    if (booking.status === 'cancelled') return false;
    if (booking.booking_type === 'event') return false;
    return true;
  };

  const canCancel = (booking: Booking) => {
    if (!['paid', 'completed'].includes(booking.payment_status)) return false;
    if (booking.status === 'cancelled') return false;
    if (booking.visit_date) {
      const visitDate = new Date(booking.visit_date);
      const now = new Date();
      const hoursUntil = (visitDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntil < 48) return false;
    }
    return true;
  };

  const retryPayment = async (booking: Booking) => {
    if (!booking.payment_phone || !booking.pendingPaymentId) {
      toast.error("Unable to retry payment. Missing payment information.");
      return;
    }
    setRetryingPaymentId(booking.pendingPaymentId);
    try {
      const { data: pendingPayment, error: fetchError } = await supabase
        .from("payments" as any)
        .select("*")
        .eq("id", booking.pendingPaymentId)
        .single();

      if (fetchError || !pendingPayment) throw new Error("Could not find payment record");

      const payment = pendingPayment as any;
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

        toast.success("Payment request sent!");
        setTimeout(() => fetchBookings(), 3000);
      } else {
        throw new Error(data?.error || "Failed to initiate payment");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to retry payment.");
    } finally {
      setRetryingPaymentId(null);
    }
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;
    setCancellingBookingId(bookingToCancel.id);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', bookingToCancel.id);

      if (error) throw error;

      toast.success("Booking cancelled successfully");
      fetchBookings();
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel booking.");
    } finally {
      setCancellingBookingId(null);
      setShowCancelDialog(false);
      setBookingToCancel(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8">
          <p>Loading...</p>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container px-4 py-8 pb-24 md:pb-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">My Bookings</h1>
        
        {bookings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">No bookings yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline">{booking.booking_type}</Badge>
                      <Badge className={getStatusColor(booking)}>
                        {getPaymentStatusLabel(booking)}
                      </Badge>
                      {!booking.isPending && (
                        <Badge className={booking.status === 'cancelled' ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"}>
                          {booking.status}
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-xl font-semibold">
                      {booking.booking_details.trip_name || booking.booking_details.hotel_name || 'Booking'}
                    </h3>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {booking.visit_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(booking.visit_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{booking.slots_booked} Tickets</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold">KSh {booking.total_amount}</span>
                    </div>
                    
                    {canRetryPayment(booking) && (
                      <Button size="sm" onClick={() => retryPayment(booking)} disabled={retryingPaymentId === booking.pendingPaymentId}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${retryingPaymentId === booking.pendingPaymentId ? 'animate-spin' : ''}`} />
                        Retry Payment
                      </Button>
                    )}
                    
                    {canReschedule(booking) && (
                      <Button variant="outline" size="sm" onClick={() => setRescheduleBooking(booking)}>
                        <CalendarClock className="h-4 w-4 mr-2" />
                        Reschedule
                      </Button>
                    )}

                    {canCancel(booking) && (
                      <Button variant="destructive" size="sm" onClick={() => { setBookingToCancel(booking); setShowCancelDialog(true); }}>
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel
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

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelBooking} className="bg-destructive text-white">
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileBottomBar />
    </div>
  );
};

export default Bookings;