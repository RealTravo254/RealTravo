import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Receipt, Calendar, Users, CreditCard, Ticket, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { BookingDownloadButton } from "@/components/booking/BookingDownloadButton";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const ITEMS_PER_PAGE = 20;

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

interface ItemDetails {
  name: string;
  type: string;
}

export default function PaymentHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [itemDetails, setItemDetails] = useState<Record<string, ItemDetails>>({});
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchBookings(0);
  }, [user, navigate]);

  const fetchBookings = async (fetchOffset: number) => {
    if (fetchOffset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("id,booking_type,total_amount,booking_details,payment_status,status,created_at,guest_name,guest_email,guest_phone,slots_booked,visit_date,item_id")
        .eq("user_id", user?.id)
        .in("payment_status", ["paid", "completed"])
        .order("created_at", { ascending: false })
        .range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1);

      if (error) throw error;

      const now = new Date();
      const validBookings = (data || []).filter(booking => {
        if (booking.booking_type === 'trip' || booking.booking_type === 'event') {
          if (booking.visit_date) {
            const visitDate = new Date(booking.visit_date);
            if (visitDate < now) {
              const details = booking.booking_details as Record<string, any> | null;
              const isFlexible = details?.is_flexible_date || details?.is_custom_date;
              return isFlexible;
            }
          }
        }
        return true;
      });

      if (fetchOffset === 0) {
        setBookings(validBookings);
      } else {
        setBookings(prev => [...prev, ...validBookings]);
      }
      
      setOffset(fetchOffset + ITEMS_PER_PAGE);
      setHasMore((data || []).length >= ITEMS_PER_PAGE);
      
      // Batch fetch item details
      if (validBookings.length > 0) {
        await fetchItemDetailsBatch(validBookings);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchItemDetailsBatch = async (bookingsData: Booking[]) => {
    const details: Record<string, ItemDetails> = { ...itemDetails };
    
    // Group by type
    const tripIds = bookingsData.filter(b => b.booking_type === "trip" || b.booking_type === "event").map(b => b.item_id);
    const hotelIds = bookingsData.filter(b => b.booking_type === "hotel").map(b => b.item_id);
    const adventureIds = bookingsData.filter(b => b.booking_type === "adventure" || b.booking_type === "adventure_place").map(b => b.item_id);
    
    // Fetch all in parallel
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

  const loadMore = () => {
    if (hasMore && !loadingMore) {
      fetchBookings(offset);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
        <div className="flex items-center gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-3.5 h-3.5 rounded-full bg-primary animate-[teal-pulse_1.4s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Loading details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />
      
      <main className="container px-4 max-w-4xl mx-auto pt-8 md:pt-12">
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          className="mb-6 rounded-full bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-all px-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
        </Button>

        <div className="mb-10">
          <Badge className="bg-[#FF7F50] hover:bg-[#FF7F50] border-none px-4 py-1.5 h-auto uppercase font-black tracking-[0.15em] text-[10px] rounded-full shadow-lg mb-4 text-white">
            Wallet & Bookings
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none text-slate-900 mb-3">
            Payment History
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Verified Community Transactions
          </p>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white rounded-[28px] p-16 text-center border border-slate-100 shadow-sm">
            <div className="bg-slate-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
               <Receipt className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight mb-2" style={{ color: COLORS.TEAL }}>No Records Found</h3>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-tight">Your paid bookings will appear here</p>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {bookings.map((booking) => (
                <Card key={booking.id} className="bg-white rounded-[28px] p-6 md:p-8 shadow-sm border border-slate-100 overflow-hidden relative group transition-all hover:shadow-md">
                  <div className="absolute top-0 right-0 p-4">
                     <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Paid</span>
                     </div>
                  </div>

                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                         <div className="bg-[#008080]/10 p-2 rounded-xl">
                            <Ticket className="h-4 w-4 text-[#008080]" />
                         </div>
                         <span className="text-[10px] font-black text-[#008080] uppercase tracking-[0.2em]">
                           {booking.booking_type} Reference
                         </span>
                      </div>

                      <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight leading-tight text-slate-800 mb-1">
                          {itemDetails[booking.item_id]?.name || booking.booking_details?.trip_name || 'Confirmed Booking'}
                        </h3>
                        <p className="text-[10px] font-mono text-slate-400 font-bold">Ref: #{booking.id.slice(0,8).toUpperCase()}</p>
                      </div>

                      <div className="flex flex-wrap gap-4">
                        {booking.visit_date && (
                          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                            <Calendar className="h-4 w-4 text-[#FF7F50]" />
                            <span className="text-[11px] font-black text-slate-600 uppercase">
                              {format(new Date(booking.visit_date), 'dd MMM yyyy')}
                            </span>
                          </div>
                        )}
                        {booking.slots_booked && (
                          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                            <Users className="h-4 w-4 text-[#FF7F50]" />
                            <span className="text-[11px] font-black text-slate-600 uppercase">
                              {booking.slots_booked} Pax
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-start md:items-end justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
                      <div className="text-left md:text-right mb-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Transaction</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black" style={{ color: COLORS.RED }}>KES {booking.total_amount.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div className="w-full">
                          <BookingDownloadButton
                              booking={{
                              bookingId: booking.id,
                              guestName: booking.guest_name || 'Guest',
                              guestEmail: booking.guest_email || '',
                              guestPhone: booking.guest_phone || undefined,
                              itemName: itemDetails[booking.item_id]?.name || booking.booking_details?.trip_name || 'Booking',
                              bookingType: booking.booking_type,
                              visitDate: booking.visit_date || booking.created_at,
                              totalAmount: booking.total_amount,
                              slotsBooked: booking.slots_booked || 1,
                              adults: booking.booking_details?.adults,
                              children: booking.booking_details?.children,
                              paymentStatus: booking.payment_status,
                              facilities: booking.booking_details?.facilities,
                              activities: booking.booking_details?.activities,
                              }}
                          />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            
            {hasMore && (
              <div className="flex justify-center mt-10">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-12 px-8"
                  style={{ background: COLORS.TEAL }}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      <MobileBottomBar />
    </div>
  );
}