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

const Bookings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { cachedBookings, cacheBookings } = useOfflineBookings();
  const [bookings, setBookings] = useState<any[]>([]);
  const [itemDetails, setItemDetails] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [rescheduleBooking, setRescheduleBooking] = useState<any | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<any | null>(null);
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const ITEMS_PER_PAGE = 20;
  const hasFetched = useRef(false);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextOffset = offset + ITEMS_PER_PAGE;
    setOffset(nextOffset);
    fetchBookings(nextOffset);
  };

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && isOnline) {
      if (bookingsCache.data && !hasFetched.current) {
        setBookings(bookingsCache.data);
        setLoading(false);
        hasFetched.current = true;
      } else {
        fetchBookings();
      }
    } else if (user && !isOnline) {
      setBookings(cachedBookings);
      setLoading(false);
    }
  }, [user, isOnline]);

  const fetchBookings = async (fetchOffset: number = 0) => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user?.id)
        .in("payment_status", ["paid", "completed"])
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: false })
        .range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1);
      
      if (error) throw error;
      if (fetchOffset === 0) {
        setBookings(data || []);
        bookingsCache.data = data;
      } else {
        setBookings(prev => [...prev, ...(data || [])]);
      }
      setHasMore((data || []).length >= ITEMS_PER_PAGE);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  const groupedBookings = useMemo(() => {
    const groups: Record<string, any[]> = { Today: [], Yesterday: [], Earlier: [] };
    bookings.forEach(b => {
      const d = parseISO(b.created_at);
      if (isToday(d)) groups.Today.push(b);
      else if (isYesterday(d)) groups.Yesterday.push(b);
      else groups.Earlier.push(b);
    });
    return groups;
  }, [bookings]);

  const toggleExpanded = (id: string) => setExpandedBookings(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  if (authLoading || loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    /* Normal flow layout - works both standalone and inside Sheet popup */
    <div className="flex flex-col min-h-screen bg-background">
      
      {/* MAIN SCROLL CONTAINER */}
      <main className="flex-1 px-4 pt-8 pb-32">
        <div className="max-w-xl mx-auto w-full">
          
          <header className="mb-8">
            <h1 className="text-2xl font-black uppercase tracking-tighter text-foreground">My Bookings</h1>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Verified Reservations</p>
            </div>
          </header>

          {!isOnline && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2">
              <WifiOff size={14} className="text-amber-600" />
              <p className="text-[10px] font-black uppercase text-amber-700">Offline: Showing cached data</p>
            </div>
          )}

          {bookings.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[10px] font-black uppercase text-muted-foreground">No bookings found</p>
            </div>
          ) : (
            <div className="space-y-10">
              {Object.entries(groupedBookings).map(([groupName, groupItems]) => groupItems.length > 0 && (
                <section key={groupName} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{groupName}</span>
                    <div className="h-px bg-border flex-1" />
                  </div>

                  <div className="space-y-3">
                    {groupItems.map((b) => {
                      const isOpen = expandedBookings.has(b.id);
                      return (
                        <div key={b.id} className="bg-card rounded-[24px] border border-border overflow-hidden">
                          {/* We use a standard div for the header to avoid CollapsibleTrigger scroll hijacking */}
                          <div 
                            onClick={() => toggleExpanded(b.id)}
                            className="p-4 flex items-center justify-between cursor-pointer active:bg-muted/50 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex gap-2 mb-1.5">
                                <Badge variant="secondary" className="text-[8px] font-black uppercase h-4 px-1.5">
                                  {b.booking_type}
                                </Badge>
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[8px] font-black uppercase h-4 px-1.5">
                                  Paid
                                </Badge>
                              </div>
                              <p className="text-sm font-bold text-foreground truncate pr-4">
                                {b.booking_details?.trip_name || b.booking_details?.hotel_name || b.booking_details?.place_name || 'Reservation'}
                              </p>
                              <p className="text-[9px] font-mono text-muted-foreground mt-1 uppercase">ID: {b.id.slice(0, 8)}</p>
                            </div>
                            
                            <div className="text-right shrink-0">
                              <p className="text-sm font-black text-foreground">KSh {b.total_amount.toLocaleString()}</p>
                              <div className="flex justify-end mt-1 text-muted-foreground">
                                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </div>
                            </div>
                          </div>

                          {/* Expansion Content */}
                          {isOpen && (
                            <div className="border-t border-border/50 bg-muted/20 p-4 space-y-5 animate-in slide-in-from-top-2 duration-200">
                              <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase">
                                <div>
                                  <p className="text-muted-foreground mb-1 tracking-widest">Guest</p>
                                  <p className="text-foreground">{b.guest_name || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground mb-1 tracking-widest">Date</p>
                                  <p className="text-foreground">
                                    {b.visit_date ? format(new Date(b.visit_date), 'dd MMM yyyy') : 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground mb-1 tracking-widest">Guests</p>
                                  <p className="text-foreground">{b.slots_booked || 1}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground mb-1 tracking-widest">Status</p>
                                  <p className="text-emerald-600">Confirmed</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 pt-2">
                                <BookingDownloadButton booking={{...b, bookingId: b.id}} />
                                
                                {b.booking_type !== 'event' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={(e) => { e.stopPropagation(); setRescheduleBooking(b); }}
                                    className="h-9 rounded-xl text-[9px] font-black uppercase border-2"
                                  >
                                    <CalendarClock size={14} className="mr-2" /> Reschedule
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {hasMore && bookings.length > 0 && (
            <div className="mt-12 mb-8 flex justify-center">
              <Button 
                onClick={loadMore} 
                disabled={loadingMore}
                variant="ghost" 
                className="text-[10px] font-black uppercase tracking-widest underline decoration-2 underline-offset-4"
              >
                {loadingMore ? "Loading..." : "Older Bookings"}
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
      {rescheduleBooking && (
        <RescheduleBookingDialog 
          booking={rescheduleBooking} 
          open={!!rescheduleBooking} 
          onOpenChange={(o) => !o && setRescheduleBooking(null)} 
          onSuccess={fetchBookings} 
        />
      )}
    </div>
  );
};

export default Bookings;