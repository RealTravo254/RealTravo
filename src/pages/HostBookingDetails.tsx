import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { 
  Mail, Phone, Calendar, Users, DollarSign, 
  ArrowLeft, ChevronDown, ChevronUp, User, 
  Ticket, Info, CheckCircle2, Download, Clock, XCircle, RefreshCw, Trash2
} from "lucide-react";
import { BookingDownloadButton } from "@/components/booking/BookingDownloadButton";
import { DownloadFormatDropdown } from "@/components/booking/DownloadFormatDropdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ManualBookingSection } from "@/components/host/ManualBookingSection";
import { ShareableBookingLink } from "@/components/host/ShareableBookingLink";
import { useToast } from "@/hooks/use-toast";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  SOFT_GRAY: "#F8F9FA"
};

interface Booking {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  total_amount: number;
  created_at: string;
  visit_date: string | null;
  slots_booked: number;
  status: string;
  payment_status: string;
  booking_type: string;
  is_guest_booking: boolean;
  booking_details: any;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
}

interface ManualEntry {
  id: string;
  item_id: string;
  item_type: string;
  guest_name: string;
  guest_contact: string;
  slots_booked: number;
  visit_date: string | null;
  entry_details: any;
  status: string;
  created_at: string;
}

const HostBookingDetails = () => {
  const { itemType: type, id: itemId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pendingEntries, setPendingEntries] = useState<ManualEntry[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemCapacity, setItemCapacity] = useState(0);
  const [itemFacilities, setItemFacilities] = useState<Array<{ name: string; price: number }>>([]);
  const [tripDate, setTripDate] = useState<string | null>(null);
  const [isFlexibleDate, setIsFlexibleDate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());

  const fetchBookings = useCallback(async () => {
    if (!user || !itemId) return;
    
    // Determine table and fetch item ownership
    let tableName = "";
    let capacityField = "";
    let selectFields = "name,created_by";
    
    if (type === "trip" || type === "event") {
      tableName = "trips";
      capacityField = "available_tickets";
      selectFields = `name,created_by,${capacityField},date,is_flexible_date,is_custom_date`;
    } else if (type === "hotel") {
      tableName = "hotels";
      capacityField = "available_rooms";
      selectFields = `name,created_by,${capacityField},facilities`;
    } else if (type === "adventure" || type === "adventure_place") {
      tableName = "adventure_places";
      capacityField = "available_slots";
      selectFields = `name,created_by,${capacityField},facilities`;
    }
    
    if (!tableName) {
      navigate("/host-bookings");
      return;
    }

    const { data: item, error: itemError } = await supabase
      .from(tableName as any)
      .select(selectFields)
      .eq("id", itemId)
      .single();
    
    if (itemError) {
      console.error("Error fetching item:", itemError);
      navigate("/host-bookings");
      return;
    }
      
    if (!item || (item as any).created_by !== user.id) {
      navigate("/host-bookings");
      return;
    }

    setItemName((item as any).name);
    setItemCapacity((item as any)[capacityField] || 0);
    
    // Extract facilities for hotels/adventures only
    if (type === 'hotel' || type === 'adventure' || type === 'adventure_place') {
      const facilitiesData = (item as any).facilities;
      if (facilitiesData && Array.isArray(facilitiesData)) {
        const parsedFacilities = facilitiesData
          .filter((f: any) => f.name && f.price > 0)
          .map((f: any) => ({ name: f.name, price: Number(f.price) }));
        setItemFacilities(parsedFacilities);
      }
    }
    
    // Extract trip date info for trips/events only
    if (type === 'trip' || type === 'event') {
      setTripDate((item as any).date || null);
      setIsFlexibleDate((item as any).is_flexible_date || (item as any).is_custom_date || false);
    }

    // Fetch confirmed/paid bookings
    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("id,user_id,guest_name,guest_email,guest_phone,total_amount,created_at,visit_date,slots_booked,status,payment_status,booking_type,is_guest_booking,booking_details")
      .eq("item_id", itemId)
      .in("payment_status", ["paid", "completed"])
      .order("created_at", { ascending: false });

    // Fetch pending entries from manual_entries table
    const { data: entriesData } = await supabase
      .from("manual_entries")
      .select("*")
      .eq("item_id", itemId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setPendingEntries(entriesData || []);

    const allBookingsToEnrich = bookingsData || [];

    if (allBookingsToEnrich.length > 0) {
      // Batch fetch profiles for non-guest bookings
      const userIds = allBookingsToEnrich
        .filter(b => !b.is_guest_booking && b.user_id)
        .map(b => b.user_id);
      
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,name,email,phone_number")
          .in("id", userIds);
        
        (profiles || []).forEach(p => {
          profilesMap[p.id] = p;
        });
      }

      const enrichBooking = (booking: any) => {
        if (!booking.is_guest_booking && booking.user_id && profilesMap[booking.user_id]) {
          const profile = profilesMap[booking.user_id];
          return {
            ...booking,
            userName: profile.name || "N/A",
            userEmail: profile.email || "N/A",
            userPhone: profile.phone_number || "N/A",
          };
        }
        return booking;
      };

      setBookings(allBookingsToEnrich.map(enrichBooking));
    } else {
      setBookings([]);
    }
    setLoading(false);
  }, [user, type, itemId, navigate]);

  const confirmEntry = async (entryId: string) => {
    const { error } = await supabase
      .from("manual_entries")
      .update({ status: "confirmed" })
      .eq("id", entryId);
    
    if (error) {
      toast({ title: "Error", description: "Failed to confirm entry", variant: "destructive" });
    } else {
      toast({ title: "Confirmed", description: "Entry has been confirmed" });
      fetchBookings();
    }
  };

  const rejectEntry = async (entryId: string) => {
    const { error } = await supabase
      .from("manual_entries")
      .update({ status: "cancelled" })
      .eq("id", entryId);
    
    if (error) {
      toast({ title: "Error", description: "Failed to reject entry", variant: "destructive" });
    } else {
      toast({ title: "Rejected", description: "Entry has been rejected" });
      fetchBookings();
    }
  };

  const deleteEntry = async (entryId: string) => {
    const { error } = await supabase
      .from("manual_entries")
      .delete()
      .eq("id", entryId);
    
    if (error) {
      toast({ title: "Error", description: "Failed to delete entry", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Entry has been removed" });
      fetchBookings();
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchBookings();
  }, [user, fetchBookings]);

  const toggleExpanded = (bookingId: string) => {
    setExpandedBookings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) newSet.delete(bookingId);
      else newSet.add(bookingId);
      return newSet;
    });
  };

  const getGuestInfo = (booking: Booking) => ({
    name: booking.is_guest_booking ? booking.guest_name : booking.userName,
    email: booking.is_guest_booking ? booking.guest_email : booking.userEmail,
    phone: booking.is_guest_booking ? booking.guest_phone : booking.userPhone,
  });

  if (loading) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      
      <main className="container px-4 max-w-4xl mx-auto py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/host-bookings")} 
          className="mb-8 hover:bg-white rounded-full font-black uppercase tracking-widest text-[10px]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Bookings
        </Button>

        <div className="mb-10 space-y-2">
          <Badge className="bg-[#FF7F50] hover:bg-[#FF7F50] border-none px-4 py-1 h-auto uppercase font-black tracking-[0.15em] text-[10px] rounded-full">
            Host Dashboard
          </Badge>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none text-[#008080]">
                {itemName}
              </h1>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Total Reservations: {bookings.length}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {itemId && type && (
                <ShareableBookingLink 
                  itemId={itemId} 
                  itemType={type} 
                  itemName={itemName} 
                />
              )}
              {bookings.length > 0 && (
                <DownloadFormatDropdown 
                  bookings={bookings} 
                  itemName={itemName} 
                />
              )}
            </div>
          </div>
        </div>

        {/* Pending Entries from Shared Form */}
        {pendingEntries.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-amber-500" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">
                Pending Entries ({pendingEntries.length})
              </h2>
            </div>
            <div className="space-y-3">
              {pendingEntries.map((entry) => (
                <div key={entry.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-800">{entry.guest_name}</p>
                      <p className="text-sm text-slate-500">{entry.guest_contact}</p>
                      {entry.visit_date && (
                        <p className="text-xs text-slate-400 mt-1">
                          Visit: {format(new Date(entry.visit_date), "MMM d, yyyy")}
                        </p>
                      )}
                      <p className="text-xs text-slate-400">
                        People: {entry.slots_booked}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => confirmEntry(entry.id)}
                        className="bg-green-600 hover:bg-green-700 text-white rounded-xl gap-1"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectEntry(entry.id)}
                        className="border-red-300 text-red-600 hover:bg-red-50 rounded-xl gap-1"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteEntry(entry.id)}
                        className="text-slate-400 hover:text-red-600 rounded-xl"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Booking Entry Section */}
        {itemId && type && itemCapacity > 0 && (
          <ManualBookingSection
            itemId={itemId}
            itemType={type as 'trip' | 'event' | 'hotel' | 'adventure' | 'adventure_place'}
            itemName={itemName}
            totalCapacity={itemCapacity}
            facilities={itemFacilities}
            tripDate={tripDate}
            isFlexibleDate={isFlexibleDate}
            onBookingCreated={fetchBookings}
          />
        )}

        {bookings.length === 0 ? (
          <div className="bg-white rounded-[28px] p-12 text-center border border-slate-100 shadow-sm">
            <Ticket className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="font-black uppercase tracking-widest text-slate-400 text-xs">No paid bookings found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => {
              const isExpanded = expandedBookings.has(booking.id);
              const guest = getGuestInfo(booking);
              const details = booking.booking_details as Record<string, any> | null;

              return (
                <div key={booking.id} className="bg-white rounded-[28px] overflow-hidden shadow-sm border border-slate-100 transition-all hover:shadow-md">
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(booking.id)}>
                    <div className="p-7">
                      <div className="flex flex-col md:flex-row justify-between gap-6">
                        
                        {/* Guest Main Info */}
                        <div className="space-y-4 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-[#008080] text-white border-none text-[9px] font-black uppercase px-3 py-0.5 rounded-full">
                              {booking.status}
                            </Badge>
                            <div className="flex items-center gap-1 text-[#857F3E] bg-[#F0E68C]/20 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3" />
                              <span className="text-[9px] font-black uppercase">Paid</span>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-800 leading-none mb-1">
                              {guest.name || 'Anonymous Guest'}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              ID: {booking.id.slice(0, 8)}... 
                              <span className="bg-slate-100 px-2 py-0.5 rounded italic lowercase">@{booking.booking_type}</span>
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <ContactItem icon={<Mail className="h-3 w-3" />} text={guest.email} />
                            <ContactItem icon={<Phone className="h-3 w-3" />} text={guest.phone} />
                            <ContactItem icon={<Calendar className="h-3 w-3" />} text={booking.visit_date ? format(new Date(booking.visit_date), 'dd MMM yyyy') : 'No Date'} />
                            <ContactItem icon={<Users className="h-3 w-3" />} text={`${booking.slots_booked} Guests`} />
                          </div>
                        </div>

                        {/* Price & Action */}
                        <div className="flex flex-col md:items-end justify-between border-t md:border-t-0 pt-4 md:pt-0 border-slate-50 gap-4">
                          <div className="text-left md:text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue</p>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-black text-[#FF7F50]">KES {booking.total_amount.toLocaleString()}</span>
                            </div>
                          </div>

                          <BookingDownloadButton
                            booking={{
                              bookingId: booking.id,
                              guestName: guest.name || 'Guest',
                              guestEmail: guest.email || '',
                              itemName: itemName,
                              bookingType: booking.booking_type,
                              visitDate: booking.visit_date || booking.created_at,
                              totalAmount: booking.total_amount,
                              slotsBooked: booking.slots_booked || 1,
                              paymentStatus: booking.payment_status,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full rounded-none border-t border-slate-50 h-12 bg-slate-50/50 hover:bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        {isExpanded ? <><ChevronUp className="h-3 w-3 mr-2" /> Hide Detail</> : <><ChevronDown className="h-3 w-3 mr-2" /> View Details</>}
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="p-8 bg-slate-50/30 border-t border-slate-50">
                        <div className="grid md:grid-cols-3 gap-8">
                          
                          {/* Booking Summary */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Info className="h-4 w-4 text-[#008080]" />
                              <h4 className="font-black text-xs uppercase tracking-widest text-[#008080]">Breakdown</h4>
                            </div>
                            <div className="space-y-2">
                              <DetailRow label="Booked On" value={format(new Date(booking.created_at), 'PPP')} />
                              {details?.adults && <DetailRow label="Adults" value={details.adults} />}
                              {details?.children > 0 && <DetailRow label="Children" value={details.children} />}
                            </div>
                          </div>

                          {/* Facilities */}
                          {details?.facilities?.length > 0 && (
                            <div className="space-y-4">
                              <h4 className="font-black text-xs uppercase tracking-widest text-[#857F3E]">Facilities</h4>
                              <div className="flex flex-wrap gap-2">
                                {details.facilities.map((f: any, idx: number) => (
                                  <Badge key={idx} variant="outline" className="bg-white border-[#F0E68C] text-[#857F3E] text-[10px] font-bold uppercase rounded-xl">
                                    {f.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Activities */}
                          {details?.activities?.length > 0 && (
                            <div className="space-y-4">
                              <h4 className="font-black text-xs uppercase tracking-widest text-[#FF7F50]">Activities</h4>
                              <div className="flex flex-wrap gap-2">
                                {details.activities.map((a: any, idx: number) => (
                                  <Badge key={idx} variant="outline" className="bg-white border-[#FF7F50]/30 text-[#FF7F50] text-[10px] font-bold uppercase rounded-xl">
                                    {a.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <MobileBottomBar />
    </div>
  );
};

// Sub-components for cleaner code
const ContactItem = ({ icon, text }: { icon: React.ReactNode, text: string | null | undefined }) => (
  <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-100/50">
    <div className="text-[#008080]">{icon}</div>
    <span className="text-[11px] font-bold truncate max-w-[150px]">{text || 'N/A'}</span>
  </div>
);

const DetailRow = ({ label, value }: { label: string, value: any }) => (
  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{label}</span>
    <span className="text-xs font-bold text-slate-700">{value}</span>
  </div>
);

export default HostBookingDetails;