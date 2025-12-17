import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Users, CalendarClock, ChevronDown, ChevronUp, WifiOff } from "lucide-react";
import { RescheduleBookingDialog } from "@/components/booking/RescheduleBookingDialog";
import { BookingDownloadButton } from "@/components/booking/BookingDownloadButton";
import { toast } from "sonner";
import { format } from "date-fns";
import { useOfflineBookings } from "@/hooks/useOfflineBookings";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
interface ItemDetails {
  name: string;
  type: string;
}
const Bookings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { cachedBookings, cacheBookings } = useOfflineBookings();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [itemDetails, setItemDetails] = useState<Record<string, ItemDetails>>({});
  const [loading, setLoading] = useState(true);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);
  useEffect(() => {
    if (user) {
      if (isOnline) {
        fetchBookings();
        const channel = supabase.channel('payments-updates').on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `user_id=eq.${user.id}`
        }, () => fetchBookings()).subscribe();
        return () => {
          supabase.removeChannel(channel);
        };
      } else {
        // Use cached bookings when offline
        setBookings(cachedBookings as Booking[]);
        setLoading(false);
      }
    }
  }, [user, isOnline]);
  const fetchBookings = async () => {
    try {
      const { data: confirmedBookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user?.id)
        .in("payment_status", ["paid", "completed"])
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: false });
      
      if (bookingsError) throw bookingsError;
      setBookings(confirmedBookings || []);
      
      // Cache bookings for offline use
      if (confirmedBookings) {
        cacheBookings(confirmedBookings.map(b => ({
          ...b,
          item_name: itemDetails[b.item_id]?.name
        })));
      }

      const itemIds = [...new Set((confirmedBookings || []).map(b => ({
        id: b.item_id,
        type: b.booking_type
      })))];
      await fetchItemDetails(itemIds);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };
  const fetchItemDetails = async (items: {
    id: string;
    type: string;
  }[]) => {
    const details: Record<string, ItemDetails> = {};
    for (const item of items) {
      try {
        let data: any = null;
        if (item.type === "trip" || item.type === "event") {
          const {
            data: tripData
          } = await supabase.from("trips").select("name").eq("id", item.id).maybeSingle();
          data = tripData;
        } else if (item.type === "hotel") {
          const {
            data: hotelData
          } = await supabase.from("hotels").select("name").eq("id", item.id).maybeSingle();
          data = hotelData;
        } else if (item.type === "adventure" || item.type === "adventure_place") {
          const {
            data: adventureData
          } = await supabase.from("adventure_places").select("name").eq("id", item.id).maybeSingle();
          data = adventureData;
        }
        if (data) {
          details[item.id] = {
            name: data.name,
            type: item.type
          };
        }
      } catch (error) {
        console.error("Error fetching item details:", error);
      }
    }
    setItemDetails(details);
  };
  const getStatusColor = (booking: Booking) => {
    const {
      payment_status
    } = booking;
    switch (payment_status) {
      case "paid":
      case "completed":
        return "bg-green-500/10 text-green-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
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
  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;
    try {
      const {
        error
      } = await supabase.from('bookings').update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      }).eq('id', bookingToCancel.id);
      if (error) throw error;
      toast.success("Booking cancelled successfully");
      fetchBookings();
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel booking.");
    } finally {
      setShowCancelDialog(false);
      setBookingToCancel(null);
    }
  };
  const toggleExpanded = (bookingId: string) => {
    setExpandedBookings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  };
  const getItemName = (booking: Booking) => {
    return itemDetails[booking.item_id]?.name || booking.booking_details?.trip_name || booking.booking_details?.hotel_name || booking.booking_details?.place_name || booking.booking_details?.event_name || 'Booking';
  };
  if (authLoading || loading) {
    return <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48"></div>
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded"></div>)}
          </div>
        </main>
        <MobileBottomBar />
      </div>;
  }
  return <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container px-4 py-8 pb-24 md:pb-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">My Bookings</h1>
        <p className="text-muted-foreground mb-4">Your completed and confirmed bookings</p>
        
        {!isOnline && (
          <Card className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
            <div className="p-3 flex items-center gap-2 text-sm">
              <WifiOff className="h-4 w-4 text-yellow-600" />
              <span>You're offline. Showing cached bookings. Some features may be limited.</span>
            </div>
          </Card>
        )}
        
        {bookings.length === 0 ? <Card className="p-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-xl text-muted-foreground">No bookings yet</p>
            <p className="text-sm text-muted-foreground mt-2">Your confirmed bookings will appear here</p>
          </Card> : <div className="space-y-4">
            {bookings.map(booking => {
          const isExpanded = expandedBookings.has(booking.id);
          const details = booking.booking_details as Record<string, any> | null;
          return <Card key={booking.id} className="overflow-hidden">
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(booking.id)}>
                    {/* Header - Always Visible */}
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge variant="outline" className="capitalize">{booking.booking_type}</Badge>
                            <Badge className={getStatusColor(booking)}>Paid</Badge>
                            
                          </div>

                          <h3 className="text-xl font-semibold">{getItemName(booking)}</h3>
                          
                          <p className="text-xs text-muted-foreground font-mono">Booking ID: {booking.id}</p>

                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            {booking.visit_date && <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{format(new Date(booking.visit_date), 'PPP')}</span>
                              </div>}
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span>{booking.slots_booked || 1} People</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 items-end">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-primary" />
                            <span className="text-2xl font-bold">KES {booking.total_amount.toLocaleString()}</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            <BookingDownloadButton booking={{
                        bookingId: booking.id,
                        guestName: booking.guest_name || 'Guest',
                        guestEmail: booking.guest_email || '',
                        guestPhone: booking.guest_phone || undefined,
                        itemName: getItemName(booking),
                        bookingType: booking.booking_type,
                        visitDate: booking.visit_date || booking.created_at,
                        totalAmount: booking.total_amount,
                        slotsBooked: booking.slots_booked || 1,
                        adults: details?.adults,
                        children: details?.children,
                        paymentStatus: booking.payment_status,
                        facilities: details?.facilities,
                        activities: details?.activities
                      }} />

                            {canReschedule(booking) && <Button variant="outline" size="sm" onClick={() => setRescheduleBooking(booking)}>
                                <CalendarClock className="h-4 w-4 mr-2" />
                                Reschedule
                              </Button>}

                            {canCancel(booking) && <Button variant="destructive" size="sm" onClick={() => {
                        setBookingToCancel(booking);
                        setShowCancelDialog(true);
                      }}>
                                
                                Cancel
                              </Button>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Details */}
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full rounded-none border-t h-10">
                        {isExpanded ? <>
                            <ChevronUp className="h-4 w-4 mr-2" />
                            Hide Details
                          </> : <>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            View Details
                          </>}
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="p-6 pt-0 border-t bg-muted/30">
                        <div className="grid md:grid-cols-2 gap-6 mt-4">
                          {/* Guest Info */}
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm text-muted-foreground uppercase">Guest Information</h4>
                            <div className="space-y-2 text-sm">
                              <p><span className="text-muted-foreground">Name:</span> {booking.guest_name || 'N/A'}</p>
                              <p><span className="text-muted-foreground">Email:</span> {booking.guest_email || 'N/A'}</p>
                              <p><span className="text-muted-foreground">Phone:</span> {booking.guest_phone || 'N/A'}</p>
                            </div>
                          </div>

                          {/* Booking Breakdown */}
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm text-muted-foreground uppercase">Booking Breakdown</h4>
                            <div className="space-y-2 text-sm">
                              {details?.adults !== undefined && <p><span className="text-muted-foreground">Adults:</span> {details.adults}</p>}
                              {details?.children !== undefined && details.children > 0 && <p><span className="text-muted-foreground">Children:</span> {details.children}</p>}
                              <p><span className="text-muted-foreground">Total People:</span> {booking.slots_booked || 1}</p>
                            </div>
                          </div>

                          {/* Facilities */}
                          {details?.facilities && details.facilities.length > 0 && <div className="space-y-3">
                              <h4 className="font-semibold text-sm text-muted-foreground uppercase">Facilities</h4>
                              <div className="space-y-1 text-sm">
                                {details.facilities.map((f: any, idx: number) => <p key={idx}>
                                    {f.name} - {f.price === 0 ? 'Free' : `KES ${f.price}`}
                                  </p>)}
                              </div>
                            </div>}

                          {/* Activities */}
                          {details?.activities && details.activities.length > 0 && <div className="space-y-3">
                              <h4 className="font-semibold text-sm text-muted-foreground uppercase">Activities</h4>
                              <div className="space-y-1 text-sm">
                                {details.activities.map((a: any, idx: number) => <p key={idx}>
                                    {a.name} - {a.price === 0 ? 'Free' : `KES ${a.price}`}
                                    {a.numberOfPeople && ` (${a.numberOfPeople} people)`}
                                  </p>)}
                              </div>
                            </div>}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>;
        })}
          </div>}
      </main>

      <RescheduleBookingDialog booking={rescheduleBooking!} open={!!rescheduleBooking} onOpenChange={open => !open && setRescheduleBooking(null)} onSuccess={fetchBookings} />

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          
          <AlertDialogFooter>
            <AlertDialogCancel>No, Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelBooking} className="bg-destructive text-white">
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileBottomBar />
    </div>;
};
export default Bookings;