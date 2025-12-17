import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar"; 
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Users, MapPin, CalendarClock, XCircle } from "lucide-react";
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
}

const Bookings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
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
    }
  }, [user]);

  const fetchBookings = async () => {
    try {
      // Fetch only bookings where payment is confirmed/paid/completed
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user?.id)
        .in("payment_status", ["paid", "completed", "confirmed"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const canReschedule = (booking: Booking) => {
    if (booking.status === 'cancelled') return false;
    if (booking.booking_type === 'event') return false;
    return true;
  };

  const canCancel = (booking: Booking) => {
    if (booking.status === 'cancelled') return false;
    if (booking.visit_date) {
      const visitDate = new Date(booking.visit_date);
      const now = new Date();
      const hoursUntil = (visitDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntil < 48) return false;
    }
    return true;
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
          <p>Loading your paid bookings...</p>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container px-4 py-8 pb-24 md:pb-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">My Bookings</h1>
        <p className="text-muted-foreground mb-8">View your confirmed and completed trips</p>
        
        {bookings.length === 0 ? (
          <div className="text-center py-16 border rounded-lg bg-card">
            <p className="text-xl text-muted-foreground">No confirmed bookings found</p>
            <p className="text-sm text-muted-foreground mt-2">Only bookings with successful payments appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline" className="capitalize">{booking.booking_type}</Badge>
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                        Paid
                      </Badge>
                      {booking.status === 'cancelled' && (
                        <Badge variant="destructive">Cancelled</Badge>
                      )}
                    </div>

                    <h3 className="text-xl font-semibold">
                      {booking.booking_details.trip_name || booking.booking_details.hotel_name || booking.booking_details.event_name || 'Booking'}
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
                        <span>{booking.slots_booked || 1} Person(s)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold">KSh {booking.total_amount.toLocaleString()}</span>
                    </div>
                    
                    {canReschedule(booking) && (
                      <Button variant="outline" size="sm" onClick={() => setRescheduleBooking(booking)}>
                        <CalendarClock className="h-4 w-4 mr-2" />
                        Reschedule
                      </Button>
                    )}

                    {canCancel(booking) && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { setBookingToCancel(booking); setShowCancelDialog(true); }}>
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
            <AlertDialogTitle>Cancel Confirmed Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this booking? This action is permanent. 
              Refunds are subject to our cancellation policy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelBooking} className="bg-destructive text-white">
              Confirm Cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileBottomBar />
    </div>
  );
};

export default Bookings;