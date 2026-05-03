import { useEffect, useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Receipt, Calendar, Users, Loader2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { BookingDownloadButton } from "@/components/booking/BookingDownloadButton";

const ITEMS_PER_PAGE = 20;

interface Booking {
  id: string; booking_type: string; total_amount: number; booking_details: any;
  payment_status: string; status: string; created_at: string;
  guest_name: string | null; guest_email: string | null; guest_phone: string | null;
  slots_booked: number | null; visit_date: string | null; item_id: string;
}
interface ItemDetails { name: string; type: string; }

export default function PaymentHistory() {
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [itemDetails, setItemDetails] = useState<Record<string, ItemDetails>>({});
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => { if (!user) { navigate("/auth"); return; } fetchBookings(0); }, [user, navigate]);

  const fetchBookings = async (fetchOffset: number) => {
    fetchOffset === 0 ? setLoading(true) : setLoadingMore(true);
    try {
      const { data, error } = await supabase.from("bookings")
        .select("id,booking_type,total_amount,booking_details,payment_status,status,created_at,guest_name,guest_email,guest_phone,slots_booked,visit_date,item_id")
        .eq("user_id", user?.id).in("payment_status", ["paid", "completed"])
        .order("created_at", { ascending: false }).range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1);
      if (error) throw error;
      const valid = data || [];
      fetchOffset === 0 ? setBookings(valid) : setBookings(prev => [...prev, ...valid]);
      setOffset(fetchOffset + ITEMS_PER_PAGE);
      setHasMore(valid.length >= ITEMS_PER_PAGE);
      if (valid.length > 0) await fetchItemDetailsBatch(valid);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  const fetchItemDetailsBatch = async (bks: Booking[]) => {
    const details: Record<string, ItemDetails> = { ...itemDetails };
    const tripIds = bks.filter(b => ["trip", "event"].includes(b.booking_type)).map(b => b.item_id);
    const hotelIds = bks.filter(b => b.booking_type === "hotel").map(b => b.item_id);
    const advIds = bks.filter(b => ["adventure", "adventure_place"].includes(b.booking_type)).map(b => b.item_id);
    const [t, h, a] = await Promise.all([
      tripIds.length ? supabase.from("trips").select("id,name").in("id", tripIds) : { data: [] },
      hotelIds.length ? supabase.from("hotels").select("id,name").in("id", hotelIds) : { data: [] },
      advIds.length ? supabase.from("adventure_places").select("id,name").in("id", advIds) : { data: [] }
    ]);
    (t.data || []).forEach((x: any) => { details[x.id] = { name: x.name, type: "trip" }; });
    (h.data || []).forEach((x: any) => { details[x.id] = { name: x.name, type: "hotel" }; });
    (a.data || []).forEach((x: any) => { details[x.id] = { name: x.name, type: "adventure" }; });
    setItemDetails(details);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-2">
        {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="container px-4 py-4 mx-auto">
        <Button onClick={() => navigate("/payment")} variant="ghost" size="sm" className="mb-3 rounded-lg text-[9px] font-bold uppercase tracking-widest px-3 h-7">
          <ArrowLeft className="mr-1 h-3 w-3" /> Payment
        </Button>
        <div className="mb-4">
          <h1 className="text-lg font-black uppercase tracking-tight text-foreground">Payment History</h1>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Transaction Records</p>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-card rounded-xl p-8 text-center border border-border">
            <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-xs font-bold text-muted-foreground uppercase">No records found</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              {bookings.map(b => (
                <div key={b.id} className="bg-card rounded-xl border border-border px-3 py-2 flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                    <Ticket className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{itemDetails[b.item_id]?.name || b.booking_details?.trip_name || 'Booking'}</p>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5">{b.booking_type}</Badge>
                      {b.visit_date && <span>{format(new Date(b.visit_date), 'dd MMM')}</span>}
                      {b.slots_booked && <span>{b.slots_booked} pax</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-destructive">{formatPrice(b.total_amount)}</p>
                    <div className="flex items-center gap-1 justify-end">
                      <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                      <span className="text-[8px] text-green-600 font-bold">Paid</span>
                    </div>
                  </div>
                  <BookingDownloadButton booking={{
                    bookingId: b.id,
                    guestName: b.guest_name || 'Guest',
                    guestEmail: b.guest_email || '',
                    guestPhone: b.guest_phone || undefined,
                    itemName: itemDetails[b.item_id]?.name || 'Booking',
                    bookingType: b.booking_type,
                    visitDate: b.visit_date || b.created_at,
                    totalAmount: b.total_amount,
                    slotsBooked: b.slots_booked || 1,
                    paymentStatus: b.payment_status,
                  }} />
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-4">
                <Button onClick={() => fetchBookings(offset)} disabled={loadingMore} size="sm" className="rounded-lg text-[9px] font-bold h-8 px-6">
                  {loadingMore ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading...</> : "Load More"}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
