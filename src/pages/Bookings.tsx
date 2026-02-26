import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, ChevronDown, ChevronUp, WifiOff, History, Loader2, CalendarClock, XCircle } from "lucide-react";
import { RescheduleBookingDialog } from "@/components/booking/RescheduleBookingDialog";
import { BookingDownloadButton } from "@/components/booking/BookingDownloadButton";
import { toast } from "sonner";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { useOfflineBookings } from "@/hooks/useOfflineBookings";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const bookingsCache = { data: null as any[] | null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000;

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

interface ItemDetails { name: string; type: string; }

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
  const ITEMS_PER_PAGE = 20;
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('profile_completed').eq('id', user.id).single();
      if (data && !data.profile_completed) navigate('/complete-profile');
    };
    if (user) checkProfile();
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      if (isOnline) {
        if (bookingsCache.data && Date.now() - bookingsCache.timestamp < CACHE_TTL && !hasFetched.current) {
          setBookings(bookingsCache.data);
          setLoading(false);
          hasFetched.current = true;
        } else {
          fetchBookings();
        }
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

  const fetchBookings = async (fetchOffset: number = 0) => {
    try {
      const { data: confirmedBookings, error } = await supabase
        .from("bookings")
        .select("id,booking_type,total_amount,booking_details,payment_status,status,created_at,guest_name,guest_email,guest_phone,slots_booked,visit_date,item_id,payment_phone")
        .eq("user_id", user?.id)
        .in("payment_status", ["paid", "completed"])
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: false })
        .range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1);
      
      if (error) throw error;
      const newBookings = confirmedBookings || [];
      
      if (fetchOffset === 0) {
        setBookings(newBookings);
        bookingsCache.data = newBookings;
        bookingsCache.timestamp = Date.now();
      } else {
        setBookings(prev => [...prev, ...newBookings]);
      }
      
      setHasMore(newBookings.length >= ITEMS_PER_PAGE);
      setOffset(fetchOffset);
      hasFetched.current = true;
      
      if (newBookings.length > 0) {
        cacheBookings(newBookings.map(b => ({ ...b, item_name: itemDetails[b.item_id]?.name })));
        await fetchItemDetailsBatch(fetchOffset === 0 ? newBookings : [...bookings, ...newBookings]);
      }
    } catch (error) { console.error("Error fetching bookings:", error); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  const loadMore = async () => { if (loadingMore || !hasMore) return; setLoadingMore(true); await fetchBookings(offset + ITEMS_PER_PAGE); };

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

  const groupedBookings = useMemo(() => {
    const groups: Record<string, Booking[]> = { Today: [], Yesterday: [], Earlier: [] };
    bookings.forEach(booking => {
      const d = parseISO(booking.created_at);
      if (isToday(d)) groups.Today.push(booking);
      else if (isYesterday(d)) groups.Yesterday.push(booking);
      else groups.Earlier.push(booking);
    });
    return groups;
  }, [bookings]);

  const canReschedule = (b: Booking) => ['paid', 'completed'].includes(b.payment_status) && b.status !== 'cancelled' && b.booking_type !== 'event';
  const canCancel = (b: Booking) => {
    if (!['paid', 'completed'].includes(b.payment_status) || b.status === 'cancelled') return false;
    if (b.visit_date) { const h = (new Date(b.visit_date).getTime() - Date.now()) / 3600000; if (h < 48) return false; }
    return true;
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;
    try {
      const { error } = await supabase.from('bookings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', bookingToCancel.id);
      if (error) throw error;
      toast.success("Booking cancelled");
      fetchBookings();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setShowCancelDialog(false); setBookingToCancel(null); }
  };

  const toggleExpanded = (id: string) => setExpandedBookings(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const getItemName = (b: Booking) => itemDetails[b.item_id]?.name || b.booking_details?.trip_name || b.booking_details?.hotel_name || b.booking_details?.place_name || b.booking_details?.event_name || 'Booking';

  if (authLoading || loading) {
    return (
      <div className="min-h-screen w-full bg-background">
        <main className="container px-4 py-6 animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-32" />
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-card rounded-xl border border-border" />)}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background flex flex-col overflow-x-hidden">
      {/* Scrollable area with touch-pan-y for better mobile scrolling */}
      <main className="flex-1 container px-4 py-6 max-w-2xl mx-auto pb-32 md:pb-12 touch-pan-y overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-xl font-black uppercase tracking-tight text-foreground">My Bookings</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Verified Reservations</p>
        </div>

        {!isOnline && (
          <div className="mb-4 p-3 rounded-xl bg-yellow-50 border border-yellow-200 flex items-center gap-2">
            <WifiOff className="h-3.5 w-3.5 text-yellow-600" />
            <span className="text-[10px] font-bold uppercase text-yellow-700">Offline Mode • Showing cached data</span>
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center border border-dashed border-border">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">No active bookings found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedBookings).map(([groupName, groupBookings]) => {
              if (groupBookings.length === 0) return null;
              return (
                <div key={groupName} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{groupName}</span>
                    <div className="h-px bg-border flex-1" />
                  </div>
                  
                  <div className="space-y-2">
                    {groupBookings.map(booking => {
                      const isExpanded = expandedBookings.has(booking.id);
                      const details = booking.booking_details as Record<string, any> | null;
                      return (
                        <Collapsible key={booking.id} open={isExpanded} onOpenChange={() => toggleExpanded(booking.id)}>
                          <div className="bg-card rounded-2xl border border-border overflow-hidden transition-colors duration-200">
                            {/* Improved Header as a full trigger area */}
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="secondary" className="text-[8px] px-2 py-0 h-4 font-black uppercase tracking-tighter">{booking.booking_type}</Badge>
                                    <Badge variant="outline" className="text-[8px] px-2 py-0 h-4 font-black text-emerald-600 border-emerald-200 bg-emerald-50 uppercase">Paid</Badge>
                                  </div>
                                  <p className="text-sm font-bold text-foreground truncate">{getItemName(booking)}</p>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    {booking.visit_date && (
                                      <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> {format(new Date(booking.visit_date), 'dd MMM yyyy')}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                      <Users className="h-3 w-3" /> {booking.slots_booked || 1} Guests
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                  <p className="text-sm font-black text-foreground">KSh {booking.total_amount.toLocaleString()}</p>
                                  <div className="p-1 rounded-full bg-muted/50">
                                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                  </div>
                                </div>
                              </div>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <div className="px-4 pb-4 pt-2 border-t border-border/50 bg-muted/10 space-y-4">
                                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                  <div className="space-y-0.5">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Guest</p>
                                    <p className="text-[11px] font-semibold">{booking.guest_name || 'N/A'}</p>
                                  </div>
                                  <div className="space-y-0.5">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Ref ID</p>
                                    <p className="text-[11px] font-mono uppercase">{booking.id.slice(0, 8)}</p>
                                  </div>
                                  <div className="space-y-0.5">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Adults</p>
                                    <p className="text-[11px] font-semibold">{details?.adults || booking.slots_booked || 1}</p>
                                  </div>
                                  {details?.children > 0 && (
                                    <div className="space-y-0.5">
                                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Children</p>
                                      <p className="text-[11px] font-semibold">{details.children}</p>
                                    </div>
                                  )}
                                </div>

                                {details?.selectedActivities?.length > 0 && (
                                  <div>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1.5">Selected Activities</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {details.selectedActivities.map((a: any, i: number) => (
                                        <span key={i} className="text-[9px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">{a.name}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-2 pt-2">
                                  <BookingDownloadButton booking={{
                                    bookingId: booking.id, guestName: booking.guest_name || 'Guest', guestEmail: booking.guest_email || '',
                                    itemName: getItemName(booking), bookingType: booking.booking_type, visitDate: booking.visit_date || booking.created_at,
                                    totalAmount: booking.total_amount, slotsBooked: booking.slots_booked || 1, adults: details?.adults, children: details?.children, paymentStatus: booking.payment_status,
                                  }} />
                                  
                                  {canReschedule(booking) && (
                                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setRescheduleBooking(booking); }} className="h-8 text-[10px] font-bold rounded-xl border-border bg-background">
                                      <CalendarClock className="h-3 w-3 mr-1.5 text-primary" /> Reschedule
                                    </Button>
                                  )}
                                  
                                  {canCancel(booking) && (
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setBookingToCancel(booking); setShowCancelDialog(true); }} className="h-8 text-[10px] font-bold rounded-xl text-destructive hover:bg-destructive/5">
                                      <XCircle className="h-3 w-3 mr-1.5" /> Cancel
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && bookings.length > 0 && (
          <div className="flex justify-center mt-8">
            <Button onClick={loadMore} disabled={loadingMore} variant="outline" className="rounded-2xl text-[10px] font-black uppercase h-10 px-8 border-2">
              {loadingMore ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Fetching...</> : "View Older Bookings"}
            </Button>
          </div>
        )}
      </main>

      {/* Dialogs */}
      {rescheduleBooking && (
        <RescheduleBookingDialog 
          booking={rescheduleBooking} 
          open={!!rescheduleBooking} 
          onOpenChange={open => !open && setRescheduleBooking(null)} 
          onSuccess={fetchBookings} 
        />
      )}

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="max-w-[92vw] md:max-w-lg rounded-[2rem] border-none p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Cancel Reservation?</AlertDialogTitle>
            <div className="text-xs text-muted-foreground leading-relaxed">
              This action cannot be undone. Per our policy, cancellations within 48 hours of the visit date are non-refundable.
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-col gap-2">
            <AlertDialogAction onClick={handleCancelBooking} className="w-full rounded-2xl bg-destructive hover:bg-destructive/90 text-[10px] font-bold uppercase h-12 order-1 sm:order-2">Confirm Cancellation</AlertDialogAction>
            <AlertDialogCancel className="w-full rounded-2xl text-[10px] font-bold uppercase h-12 order-2 sm:order-1">Go Back</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Bookings;