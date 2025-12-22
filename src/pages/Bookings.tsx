import { useEffect, useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Users, CalendarClock, ChevronDown, ChevronUp, WifiOff, MapPin, CheckCircle2, XCircle, History } from "lucide-react";
import { RescheduleBookingDialog } from "@/components/booking/RescheduleBookingDialog";
import { BookingDownloadButton } from "@/components/booking/BookingDownloadButton";
import { toast } from "sonner";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { useOfflineBookings } from "@/hooks/useOfflineBookings";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

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
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      if (isOnline) {
        fetchBookings();
        const channel = supabase.channel('payments-updates').on('postgres_changes', {
          event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}`
        }, () => fetchBookings()).subscribe();
        return () => { supabase.removeChannel(channel); };
      } else {
        setBookings(cachedBookings as Booking[]);
        setLoading(false);
      }
    }
  }, [user, isOnline]);

  const fetchBookings = async () => {
    try {
      const { data: confirmedBookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("id,booking_type,total_amount,booking_details,payment_status,status,created_at,guest_name,guest_email,guest_phone,slots_booked,visit_date,item_id,payment_phone")
        .eq("user_id", user?.id)
        .in("payment_status", ["paid", "completed"])
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: false });
      
      if (bookingsError) throw bookingsError;
      setBookings(confirmedBookings || []);
      
      if (confirmedBookings) {
        cacheBookings(confirmedBookings.map(b => ({
          ...b, item_name: itemDetails[b.item_id]?.name
        })));
      }

      if (confirmedBookings && confirmedBookings.length > 0) {
        await fetchItemDetailsBatch(confirmedBookings);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchItemDetailsBatch = async (bookings: Booking[]) => {
    const details: Record<string, ItemDetails> = {};
    const tripIds = bookings.filter(b => b.booking_type === "trip" || b.booking_type === "event").map(b => b.item_id);
    const hotelIds = bookings.filter(b => b.booking_type === "hotel").map(b => b.item_id);
    const adventureIds = bookings.filter(b => b.booking_type === "adventure" || b.booking_type === "adventure_place").map(b => b.item_id);
    
    const [tripsData, hotelsData, adventuresData] = await Promise.all([
      tripIds.length > 0 ? supabase.from("trips").select("id,name").in("id", tripIds) : { data: [] },
      hotelIds.length > 0 ? supabase.from("hotels").select("id,name").in("id", hotelIds) : { data: [] },
      adventureIds.length > 0 ? supabase.from("adventure_places").select("id,name").in("id", adventureIds) : { data: [] }
    ]);
    
    (tripsData.data || []).forEach((t: any) => { details[t.id] = { name: t.name, type: "trip" }; });
    (hotelsData.data || []).forEach((h: any) => { details[h.id] = { name: h.name, type: "hotel" }; });
    (adventuresData.data || []).forEach((a: any) => { details[a.id] = { name: a.name, type: "adventure" }; });
    
    setItemDetails(details);
  };

  // Grouping Logic
  const groupedBookings = useMemo(() => {
    const groups: Record<string, Booking[]> = {
      Today: [],
      Yesterday: [],
      Earlier: []
    };

    bookings.forEach(booking => {
      const createdAt = parseISO(booking.created_at);
      if (isToday(createdAt)) {
        groups.Today.push(booking);
      } else if (isYesterday(createdAt)) {
        groups.Yesterday.push(booking);
      } else {
        groups.Earlier.push(booking);
      }
    });

    return groups;
  }, [bookings]);

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
      const { error } = await supabase.from('bookings').update({
        status: 'cancelled', updated_at: new Date().toISOString()
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
      newSet.has(bookingId) ? newSet.delete(bookingId) : newSet.add(bookingId);
      return newSet;
    });
  };

  const getItemName = (booking: Booking) => {
    return itemDetails[booking.item_id]?.name || booking.booking_details?.trip_name || booking.booking_details?.hotel_name || booking.booking_details?.place_name || booking.booking_details?.event_name || 'Booking';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <Header />
        <main className="container px-4 py-8 animate-pulse space-y-6">
          <div className="h-10 bg-slate-200 rounded-full w-48" />
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white rounded-[28px] border border-slate-100" />)}
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      
      <main className="container px-4 py-12 max-w-4xl mx-auto">
        <header className="mb-10">
          <Button 
            className="mb-4 bg-[#FF7F50] hover:bg-[#FF7F50] border-none px-4 py-1 h-auto uppercase font-black tracking-[0.15em] text-[10px] rounded-full shadow-lg"
          >
            Manage Trips
          </Button>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none text-slate-900 drop-shadow-sm">
            My Bookings
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Verified Reservations & History</p>
        </header>
        
        {!isOnline && (
          <div className="mb-8 p-4 rounded-2xl bg-[#F0E68C]/20 border border-[#F0E68C] flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-[#857F3E]" />
            <span className="text-xs font-black uppercase tracking-tight text-[#857F3E]">
              Offline Mode: Showing cached data
            </span>
          </div>
        )}
        
        {bookings.length === 0 ? (
          <div className="bg-white rounded-[32px] p-16 text-center border border-slate-100 shadow-sm">
            <Calendar className="h-16 w-16 text-slate-200 mx-auto mb-6" />
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-400">No active bookings</h2>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(groupedBookings).map(([groupName, groupBookings]) => {
              if (groupBookings.length === 0) return null;
              
              return (
                <div key={groupName} className="space-y-6">
                  <div className="flex items-center gap-3 px-2">
                    <History className="h-4 w-4 text-slate-400" />
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                      {groupName} Bookings
                    </h2>
                    <div className="h-px bg-slate-100 flex-1" />
                  </div>

                  <div className="space-y-6">
                    {groupBookings.map(booking => {
                      const isExpanded = expandedBookings.has(booking.id);
                      const details = booking.booking_details as Record<string, any> | null;
                      
                      return (
                        <Card key={booking.id} className="overflow-hidden bg-white rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                          <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(booking.id)}>
                            <div className="p-6 md:p-8">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-[#008080]/10 text-[#008080] border-none font-black uppercase text-[9px] tracking-widest px-3 py-1">
                                      {booking.booking_type}
                                    </Badge>
                                    <Badge className="bg-green-500/10 text-green-600 border-none font-black uppercase text-[9px] tracking-widest px-3 py-1">
                                      Confirmed
                                    </Badge>
                                    <span className="text-[9px] font-bold text-slate-300 uppercase">
                                      {format(parseISO(booking.created_at), 'HH:mm')}
                                    </span>
                                  </div>

                                  <h3 className="text-2xl font-black uppercase tracking-tight leading-tight text-slate-800">
                                    {getItemName(booking)}
                                  </h3>
                                  
                                  <div className="flex flex-wrap gap-4">
                                    {booking.visit_date && (
                                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                        <Calendar className="h-3.5 w-3.5" style={{ color: COLORS.CORAL }} />
                                        <span className="text-[10px] font-black text-slate-600 uppercase">
                                          Visit: {format(new Date(booking.visit_date), 'dd MMM yyyy')}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                      <Users className="h-3.5 w-3.5" style={{ color: COLORS.CORAL }} />
                                      <span className="text-[10px] font-black text-slate-600 uppercase">
                                        {booking.slots_booked || 1} Guests
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col items-start md:items-end gap-4">
                                  <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Paid on {format(parseISO(booking.created_at), 'MMM dd')}</p>
                                    <div className="flex items-center gap-1">
                                      <span className="text-3xl font-black" style={{ color: COLORS.RED }}>KSh {booking.total_amount.toLocaleString()}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-2">
                                    <BookingDownloadButton booking={{
                                      bookingId: booking.id,
                                      guestName: booking.guest_name || 'Guest',
                                      guestEmail: booking.guest_email || '',
                                      itemName: getItemName(booking),
                                      bookingType: booking.booking_type,
                                      visitDate: booking.visit_date || booking.created_at,
                                      totalAmount: booking.total_amount,
                                      slotsBooked: booking.slots_booked || 1,
                                      adults: details?.adults,
                                      children: details?.children,
                                      paymentStatus: booking.payment_status,
                                    }} />

                                    {canReschedule(booking) && (
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setRescheduleBooking(booking)}
                                        className="rounded-xl border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                                      >
                                        <CalendarClock className="h-3.5 w-3.5 mr-2" />
                                        Reschedule
                                      </Button>
                                    )}

                                    {canCancel(booking) && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => { setBookingToCancel(booking); setShowCancelDialog(true); }}
                                        className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest"
                                      >
                                        <XCircle className="h-3.5 w-3.5 mr-2" />
                                        Cancel
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="w-full rounded-none border-t border-slate-50 h-12 bg-slate-50/30 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  {isExpanded ? <><ChevronUp className="h-3 w-3" /> Hide Details</> : <><ChevronDown className="h-3 w-3" /> View Summary</>}
                                </div>
                              </Button>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <div className="p-8 pt-6 border-t border-slate-50 bg-[#F8F9FA]/50">
                                <div className="grid md:grid-cols-2 gap-8">
                                  <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-[#008080] uppercase tracking-widest flex items-center gap-2">
                                      <CheckCircle2 className="h-3 w-3" /> Guest Details
                                    </h4>
                                    <div className="space-y-3">
                                      <InfoRow label="Name" value={booking.guest_name} />
                                      <InfoRow label="Email" value={booking.guest_email} />
                                      <InfoRow label="Phone" value={booking.guest_phone} />
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-[#008080] uppercase tracking-widest flex items-center gap-2">
                                      <CheckCircle2 className="h-3 w-3" /> Booking Info
                                    </h4>
                                    <div className="space-y-3">
                                      <InfoRow label="Adults" value={details?.adults} />
                                      {details?.children > 0 && <InfoRow label="Children" value={details?.children} />}
                                      <InfoRow label="Booking Date" value={format(parseISO(booking.created_at), 'PPP p')} />
                                      <InfoRow label="Booking ID" value={booking.id} isMono />
                                      
                                      {/* Facilities with date ranges */}
                                      {details?.selectedFacilities && details.selectedFacilities.length > 0 && (
                                        <div className="pt-2">
                                          <span className="text-[9px] font-black text-[#857F3E] uppercase tracking-tight">Facilities</span>
                                          <div className="mt-1 space-y-1">
                                            {details.selectedFacilities.map((f: any, i: number) => (
                                              <div key={i} className="text-xs text-slate-600 bg-[#F0E68C]/20 px-2 py-1 rounded">
                                                <span className="font-bold">{f.name}</span>
                                                {f.startDate && f.endDate && (
                                                  <span className="text-slate-500 ml-1">
                                                    ({format(new Date(f.startDate), 'MMM dd')} - {format(new Date(f.endDate), 'MMM dd')})
                                                  </span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Activities with people count */}
                                      {details?.selectedActivities && details.selectedActivities.length > 0 && (
                                        <div className="pt-2">
                                          <span className="text-[9px] font-black text-[#FF7F50] uppercase tracking-tight">Activities</span>
                                          <div className="mt-1 space-y-1">
                                            {details.selectedActivities.map((a: any, i: number) => (
                                              <div key={i} className="text-xs text-slate-600 bg-[#FF7F50]/10 px-2 py-1 rounded">
                                                <span className="font-bold">{a.name}</span>
                                                {a.numberOfPeople && (
                                                  <span className="text-slate-500 ml-1">× {a.numberOfPeople} people</span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {rescheduleBooking && (
        <RescheduleBookingDialog 
          booking={rescheduleBooking} 
          open={!!rescheduleBooking} 
          onOpenChange={open => !open && setRescheduleBooking(null)} 
          onSuccess={fetchBookings} 
        />
      )}

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="rounded-[32px] border-none p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter">Cancel Reservation?</AlertDialogTitle>
            <p className="text-sm text-slate-500 leading-relaxed">
              Are you sure you want to cancel? This action cannot be undone. Cancellations within 48 hours of the visit may not be eligible for a full refund.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3">
            <AlertDialogCancel className="rounded-2xl border-slate-100 font-bold uppercase text-xs">Keep Booking</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelBooking} 
              className="rounded-2xl bg-red-500 hover:bg-red-600 font-black uppercase text-xs tracking-widest px-8"
            >
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileBottomBar />
    </div>
  );
};

const InfoRow = ({ label, value, isMono }: { label: string, value: any, isMono?: boolean }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{label}</span>
    <span className={`text-xs font-bold text-slate-700 ${isMono ? 'font-mono' : ''}`}>{value || 'N/A'}</span>
  </div>
);

export default Bookings;