import { useEffect, useState, useCallback, useMemo } from "react";
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
  Ticket, Info, CheckCircle2, Download, Clock, XCircle, RefreshCw, Trash2,
  Search, Eye
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
  host_confirmed: boolean | null;
  host_confirmed_at: string | null;
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
  const [confirmedBookings, setConfirmedBookings] = useState<Booking[]>([]);
  const [unconfirmedBookings, setUnconfirmedBookings] = useState<Booking[]>([]);
  const [pendingEntries, setPendingEntries] = useState<ManualEntry[]>([]);
  const [confirmedEntries, setConfirmedEntries] = useState<ManualEntry[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemCapacity, setItemCapacity] = useState(0);
  const [itemFacilities, setItemFacilities] = useState<Array<{ name: string; price: number }>>([]);
  const [itemActivities, setItemActivities] = useState<Array<{ name: string; price: number }>>([]);
  const [tripDate, setTripDate] = useState<string | null>(null);
  const [isFlexibleDate, setIsFlexibleDate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  
  // Pagination state
  const ITEMS_PER_PAGE = 20;
  const [confirmedOffset, setConfirmedOffset] = useState(0);
  const [unconfirmedOffset, setUnconfirmedOffset] = useState(0);
  const [hasMoreConfirmed, setHasMoreConfirmed] = useState(true);
  const [hasMoreUnconfirmed, setHasMoreUnconfirmed] = useState(true);

  const fetchBookings = useCallback(async () => {
    if (!user || !itemId) return;
    
    // Determine table and fetch item ownership
    let tableName = "";
    let capacityField = "";
    let selectFields = "name,created_by";
    
    if (type === "trip" || type === "event") {
      tableName = "trips";
      capacityField = "available_tickets";
      selectFields = `name,created_by,${capacityField},date,is_flexible_date,is_custom_date,activities`;
    } else if (type === "hotel") {
      tableName = "hotels";
      capacityField = "available_rooms";
      selectFields = `name,created_by,${capacityField},facilities,activities`;
    } else if (type === "adventure" || type === "adventure_place") {
      tableName = "adventure_places";
      capacityField = "available_slots";
      selectFields = `name,created_by,${capacityField},facilities,activities`;
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

    // Extract activities for all item types
    const activitiesData = (item as any).activities;
    if (activitiesData && Array.isArray(activitiesData)) {
      const parsedActivities = activitiesData
        .filter((a: any) => a.name && a.price > 0)
        .map((a: any) => ({ name: a.name, price: Number(a.price) }));
      setItemActivities(parsedActivities);
    }
    
    // Extract trip date info for trips/events only
    if (type === 'trip' || type === 'event') {
      setTripDate((item as any).date || null);
      setIsFlexibleDate((item as any).is_flexible_date || (item as any).is_custom_date || false);
    }

    // Fetch confirmed/paid bookings - split by host_confirmed
    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("id,user_id,guest_name,guest_email,guest_phone,total_amount,created_at,visit_date,slots_booked,status,payment_status,booking_type,is_guest_booking,booking_details,host_confirmed,host_confirmed_at")
      .eq("item_id", itemId)
      .in("payment_status", ["paid", "completed"])
      .order("created_at", { ascending: false })
      .limit(ITEMS_PER_PAGE);

    // Fetch pending entries from manual_entries table
    const { data: entriesData } = await supabase
      .from("manual_entries")
      .select("*")
      .eq("item_id", itemId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    // Fetch confirmed entries from manual_entries table (from public forms)
    const { data: confirmedEntriesData } = await supabase
      .from("manual_entries")
      .select("*")
      .eq("item_id", itemId)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false });

    setPendingEntries(entriesData || []);
    setConfirmedEntries(confirmedEntriesData || []);

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

      const enrichedBookings = allBookingsToEnrich.map(enrichBooking);
      
      // Split into confirmed and unconfirmed by host
      const confirmed = enrichedBookings.filter(b => b.host_confirmed === true);
      const unconfirmed = enrichedBookings.filter(b => !b.host_confirmed);
      
      setConfirmedBookings(confirmed);
      setUnconfirmedBookings(unconfirmed);
      setHasMoreConfirmed(enrichedBookings.length >= ITEMS_PER_PAGE);
      setHasMoreUnconfirmed(enrichedBookings.length >= ITEMS_PER_PAGE);
    } else {
      setConfirmedBookings([]);
      setUnconfirmedBookings([]);
    }
    setLoading(false);
  }, [user, type, itemId, navigate]);

  // Host confirms they've seen a booking
  const confirmBooking = async (bookingId: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ host_confirmed: true, host_confirmed_at: new Date().toISOString() })
      .eq("id", bookingId);
    
    if (error) {
      toast({ title: "Error", description: "Failed to confirm booking", variant: "destructive" });
    } else {
      toast({ title: "Confirmed", description: "Booking marked as seen" });
      fetchBookings();
    }
  };

  // Load more confirmed bookings
  const loadMoreConfirmed = async () => {
    const newOffset = confirmedOffset + ITEMS_PER_PAGE;
    const { data } = await supabase
      .from("bookings")
      .select("id,user_id,guest_name,guest_email,guest_phone,total_amount,created_at,visit_date,slots_booked,status,payment_status,booking_type,is_guest_booking,booking_details,host_confirmed,host_confirmed_at")
      .eq("item_id", itemId)
      .eq("host_confirmed", true)
      .in("payment_status", ["paid", "completed"])
      .order("created_at", { ascending: false })
      .range(newOffset, newOffset + ITEMS_PER_PAGE - 1);
    
    if (data && data.length > 0) {
      setConfirmedBookings(prev => [...prev, ...data]);
      setConfirmedOffset(newOffset);
      setHasMoreConfirmed(data.length >= ITEMS_PER_PAGE);
    } else {
      setHasMoreConfirmed(false);
    }
  };

  // Load more unconfirmed bookings
  const loadMoreUnconfirmed = async () => {
    const newOffset = unconfirmedOffset + ITEMS_PER_PAGE;
    const { data } = await supabase
      .from("bookings")
      .select("id,user_id,guest_name,guest_email,guest_phone,total_amount,created_at,visit_date,slots_booked,status,payment_status,booking_type,is_guest_booking,booking_details,host_confirmed,host_confirmed_at")
      .eq("item_id", itemId)
      .or("host_confirmed.is.null,host_confirmed.eq.false")
      .in("payment_status", ["paid", "completed"])
      .order("created_at", { ascending: false })
      .range(newOffset, newOffset + ITEMS_PER_PAGE - 1);
    
    if (data && data.length > 0) {
      setUnconfirmedBookings(prev => [...prev, ...data]);
      setUnconfirmedOffset(newOffset);
      setHasMoreUnconfirmed(data.length >= ITEMS_PER_PAGE);
    } else {
      setHasMoreUnconfirmed(false);
    }
  };

  // Filter bookings by search
  const filteredConfirmedBookings = useMemo(() => {
    if (!searchQuery.trim()) return confirmedBookings;
    const query = searchQuery.toLowerCase();
    return confirmedBookings.filter(b => 
      b.id.toLowerCase().includes(query) ||
      b.guest_name?.toLowerCase().includes(query) ||
      (b as any).userName?.toLowerCase().includes(query)
    );
  }, [confirmedBookings, searchQuery]);

  const filteredUnconfirmedBookings = useMemo(() => {
    if (!searchQuery.trim()) return unconfirmedBookings;
    const query = searchQuery.toLowerCase();
    return unconfirmedBookings.filter(b => 
      b.id.toLowerCase().includes(query) ||
      b.guest_name?.toLowerCase().includes(query) ||
      (b as any).userName?.toLowerCase().includes(query)
    );
  }, [unconfirmedBookings, searchQuery]);

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
                Total Reservations: {confirmedBookings.length + unconfirmedBookings.length}
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
              {(confirmedBookings.length + unconfirmedBookings.length) > 0 && (
                <DownloadFormatDropdown 
                  bookings={[...confirmedBookings, ...unconfirmedBookings]} 
                  itemName={itemName} 
                />
              )}
            </div>
          </div>
          
          {/* Search Bar for Host Bookings */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by ID or guest name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 rounded-2xl border-slate-200 focus:border-[#008080] bg-white"
            />
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

        {/* Confirmed Manual Entries Section */}
        {confirmedEntries.length > 0 && (
          <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
                  Confirmed Entries ({confirmedEntries.length})
                </h2>
                <p className="text-xs text-slate-500">Reservations from public booking form</p>
              </div>
            </div>
            <div className="space-y-3">
              {confirmedEntries.map((entry) => {
                const details = entry.entry_details as Record<string, any> | null;
                const selectedActivities = details?.selectedActivities || [];
                const selectedFacilities = details?.selectedFacilities || [];
                
                return (
                  <div key={entry.id} className="bg-green-50 rounded-2xl p-4 border border-green-100">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800">{entry.guest_name}</p>
                        <p className="text-sm text-slate-500">{entry.guest_contact}</p>
                        {entry.visit_date && (
                          <p className="text-xs text-slate-600 mt-1">
                            Visit: {format(new Date(entry.visit_date), "MMM d, yyyy")}
                          </p>
                        )}
                        <p className="text-xs text-slate-500">
                          People: {entry.slots_booked}
                        </p>
                        
                        {/* Display selected facilities */}
                        {selectedFacilities.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Facilities:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedFacilities.map((f: any, i: number) => (
                                <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                  {f.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Display selected activities */}
                        {selectedActivities.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Activities:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedActivities.map((a: any, i: number) => (
                                <span key={i} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                  {a.name} ({a.numberOfPeople} people)
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {details?.totalAmount > 0 && (
                          <p className="text-sm font-bold text-green-700 mt-2">
                            Total: KES {details.totalAmount.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 items-start">
                        <Badge className="bg-green-600 text-white text-[9px]">Confirmed</Badge>
                        {/* Delete disabled for confirmed entries - shown as disabled button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled
                          className="text-slate-300 cursor-not-allowed rounded-xl"
                          title="Confirmed entries cannot be deleted"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
            activities={itemActivities}
            tripDate={tripDate}
            isFlexibleDate={isFlexibleDate}
            onBookingCreated={fetchBookings}
          />
        )}

        {/* UNCONFIRMED BOOKINGS - Host hasn't confirmed seeing these yet */}
        {filteredUnconfirmedBookings.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-amber-50">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
                  New Bookings ({filteredUnconfirmedBookings.length})
                </h2>
                <p className="text-xs text-slate-500">Confirm you've seen these bookings</p>
              </div>
            </div>
            <div className="space-y-4">
              {filteredUnconfirmedBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  itemName={itemName}
                  isExpanded={expandedBookings.has(booking.id)}
                  onToggleExpand={() => toggleExpanded(booking.id)}
                  getGuestInfo={getGuestInfo}
                  onConfirm={() => confirmBooking(booking.id)}
                  showConfirmButton={true}
                />
              ))}
            </div>
            {hasMoreUnconfirmed && !searchQuery && (
              <Button 
                onClick={loadMoreUnconfirmed}
                variant="outline" 
                className="w-full mt-4 rounded-2xl h-12 font-black uppercase tracking-widest text-[10px]"
              >
                Load Next 20
              </Button>
            )}
          </div>
        )}

        {/* CONFIRMED BOOKINGS - Host has seen these */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-green-50">
              <Eye className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
                Confirmed Bookings ({filteredConfirmedBookings.length})
              </h2>
              <p className="text-xs text-slate-500">Bookings you've marked as seen</p>
            </div>
          </div>

          {filteredConfirmedBookings.length === 0 && filteredUnconfirmedBookings.length === 0 ? (
            <div className="bg-white rounded-[28px] p-12 text-center border border-slate-100 shadow-sm">
              <Ticket className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-slate-400 text-xs">No paid bookings found</p>
            </div>
          ) : filteredConfirmedBookings.length === 0 ? (
            <div className="bg-white rounded-[28px] p-8 text-center border border-slate-100 shadow-sm">
              <p className="font-bold text-slate-400 text-sm">No confirmed bookings yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredConfirmedBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  itemName={itemName}
                  isExpanded={expandedBookings.has(booking.id)}
                  onToggleExpand={() => toggleExpanded(booking.id)}
                  getGuestInfo={getGuestInfo}
                  showConfirmButton={false}
                />
              ))}
            </div>
          )}
          {hasMoreConfirmed && filteredConfirmedBookings.length >= ITEMS_PER_PAGE && !searchQuery && (
            <Button 
              onClick={loadMoreConfirmed}
              variant="outline" 
              className="w-full mt-4 rounded-2xl h-12 font-black uppercase tracking-widest text-[10px]"
            >
              Load Next 20
            </Button>
          )}
        </div>
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

const BookingCard = ({ booking, itemName, isExpanded, onToggleExpand, getGuestInfo, onConfirm, showConfirmButton }: {
  booking: any; itemName: string; isExpanded: boolean; onToggleExpand: () => void;
  getGuestInfo: (b: any) => { name: string | null; email: string | null; phone: string | null };
  onConfirm?: () => void; showConfirmButton: boolean;
}) => {
  const guest = getGuestInfo(booking);
  const details = booking.booking_details as Record<string, any> | null;

  return (
    <div className={`bg-white rounded-[28px] overflow-hidden shadow-sm border transition-all hover:shadow-md ${showConfirmButton ? 'border-amber-200' : 'border-slate-100'}`}>
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <div className="p-6">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-[#008080] text-white border-none text-[9px] font-black uppercase px-3 py-0.5 rounded-full">
                  {booking.status}
                </Badge>
                <div className="flex items-center gap-1 text-[#857F3E] bg-[#F0E68C]/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="text-[9px] font-black uppercase">Paid</span>
                </div>
                {showConfirmButton && (
                  <Badge className="bg-amber-100 text-amber-700 border-none text-[9px] font-black uppercase">New</Badge>
                )}
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 leading-none mb-1">
                  {guest.name || 'Anonymous Guest'}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  ID: {booking.id.slice(0, 8)}...
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ContactItem icon={<Mail className="h-3 w-3" />} text={guest.email} />
                <ContactItem icon={<Phone className="h-3 w-3" />} text={guest.phone} />
                <ContactItem icon={<Calendar className="h-3 w-3" />} text={booking.visit_date ? format(new Date(booking.visit_date), 'dd MMM yyyy') : 'No Date'} />
                <ContactItem icon={<Users className="h-3 w-3" />} text={`${booking.slots_booked} Guests`} />
              </div>
            </div>
            <div className="flex flex-col md:items-end gap-3">
              <div className="text-left md:text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue</p>
                <span className="text-2xl font-black text-[#FF7F50]">KES {booking.total_amount.toLocaleString()}</span>
              </div>
              {showConfirmButton && onConfirm && (
                <Button onClick={onConfirm} size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-xl gap-1 text-[10px] font-black uppercase">
                  <Eye className="h-3 w-3" /> Mark as Seen
                </Button>
              )}
              <BookingDownloadButton
                booking={{
                  bookingId: booking.id, guestName: guest.name || 'Guest', guestEmail: guest.email || '',
                  itemName, bookingType: booking.booking_type, visitDate: booking.visit_date || booking.created_at,
                  totalAmount: booking.total_amount, slotsBooked: booking.slots_booked || 1, paymentStatus: booking.payment_status,
                }}
              />
            </div>
          </div>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full rounded-none border-t border-slate-50 h-10 bg-slate-50/50 hover:bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            {isExpanded ? <><ChevronUp className="h-3 w-3 mr-2" /> Hide</> : <><ChevronDown className="h-3 w-3 mr-2" /> Details</>}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-6 bg-slate-50/30 border-t border-slate-50">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="font-black text-xs uppercase tracking-widest text-[#008080]">Breakdown</h4>
                <DetailRow label="Booked On" value={format(new Date(booking.created_at), 'PPP')} />
                {details?.adults && <DetailRow label="Adults" value={details.adults} />}
                {details?.children > 0 && <DetailRow label="Children" value={details.children} />}
              </div>
              {details?.facilities?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-black text-xs uppercase tracking-widest text-[#857F3E]">Facilities</h4>
                  <div className="flex flex-wrap gap-1">{details.facilities.map((f: any, i: number) => (
                    <Badge key={i} variant="outline" className="bg-white border-[#F0E68C] text-[#857F3E] text-[9px] rounded-xl">{f.name}</Badge>
                  ))}</div>
                </div>
              )}
              {details?.activities?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-black text-xs uppercase tracking-widest text-[#FF7F50]">Activities</h4>
                  <div className="flex flex-wrap gap-1">{details.activities.map((a: any, i: number) => (
                    <Badge key={i} variant="outline" className="bg-white border-[#FF7F50]/30 text-[#FF7F50] text-[9px] rounded-xl">{a.name}</Badge>
                  ))}</div>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default HostBookingDetails;