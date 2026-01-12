import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, Mail, Phone, User, Search, 
  ArrowLeft, Clock, Users, DollarSign, 
  ChevronRight, Ticket, Briefcase, Hotel,
  MapPin, CheckCircle2, ShieldCheck
} from "lucide-react";
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

const AllBookings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [itemDetails, setItemDetails] = useState<Record<string, any>>({});
  const [hostInfo, setHostInfo] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const [hasSearched, setHasSearched] = useState(false);

  // Search handler - only fetch when user performs search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setBookings([]);
      setFilteredBookings([]);
      setHasSearched(false);
      return;
    }
    
    setLoading(true);
    setHasSearched(true);
    try {
      const searchPattern = `%${searchQuery}%`;
      const { data: bookingsData, error } = await supabase
        .from("bookings")
        .select("*")
        .in("payment_status", ["paid", "completed"])
        .or(`id.ilike.${searchPattern},guest_name.ilike.${searchPattern},guest_email.ilike.${searchPattern},guest_phone.ilike.${searchPattern}`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setBookings(bookingsData || []);
      setFilteredBookings(bookingsData || []);
      const itemIds = [...new Set(bookingsData?.map(b => ({ id: b.item_id, type: b.booking_type })) || [])];
      await fetchItemDetails(itemIds);
      
      // Auto-select exact match if found
      const exactMatch = bookingsData?.find(b => b.id.toLowerCase() === searchQuery.toLowerCase());
      if (exactMatch) setSelectedBooking(exactMatch);
    } catch (error) {
      toast({ title: "Error searching bookings", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const checkAdminStatus = async () => {
    if (!user) { navigate("/auth"); return; }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const hasAdminRole = roles?.some(r => r.role === "admin");
    if (!hasAdminRole) {
      toast({ title: "Access Denied", variant: "destructive" });
      navigate("/");
      return;
    }
    setIsAdmin(true);
    setLoading(false); // Don't fetch all - empty by default
  };

  const fetchItemDetails = async (items: { id: string; type: string }[]) => {
    const details: Record<string, any> = {};
    const hostIds: Set<string> = new Set();
    for (const item of items) {
      try {
        let table = item.type === "hotel" ? "hotels" : (item.type === "adventure" || item.type === "adventure_place") ? "adventure_places" : "trips";
        const { data } = await supabase.from(table as any).select("name, created_by").eq("id", item.id).single();
        if (data) {
          details[item.id] = { name: (data as any).name, type: item.type, hostId: (data as any).created_by };
          if ((data as any).created_by) hostIds.add((data as any).created_by);
        }
      } catch (e) {}
    }
    setItemDetails(details);
    if (hostIds.size > 0) await fetchHostProfiles(Array.from(hostIds));
  };

  const fetchHostProfiles = async (hostIds: string[]) => {
    const hosts: Record<string, any> = {};
    for (const hostId of hostIds) {
      const { data } = await supabase.from("profiles").select("name, email, phone_number").eq("id", hostId).single();
      if (data) hosts[hostId] = data;
    }
    setHostInfo(hosts);
  };

  if (loading || !isAdmin) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* Hero Admin Header */}
      <div className="bg-[#008080] pt-12 pb-20 px-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="max-w-6xl mx-auto relative z-10">
          <Button 
            onClick={() => navigate("/admin")} 
            className="bg-white/10 hover:bg-white/20 border-none text-white rounded-full mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
          </Button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <Badge className="bg-[#FF7F50] hover:bg-[#FF7F50] border-none px-3 py-1 uppercase font-black tracking-widest text-[10px] rounded-full mb-3">
                Admin Control
              </Badge>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white leading-none">
                All Bookings
              </h1>
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mt-2">
                {hasSearched ? `Found ${bookings.length} records` : "Search to view records"}
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="relative w-full md:w-96 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  placeholder="SEARCH ID, NAME, EMAIL OR PHONE..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-2xl pl-11 h-14 font-bold text-sm tracking-tight focus:bg-white/20 transition-all"
                />
              </div>
              <Button 
                type="submit" 
                className="h-14 px-6 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-black uppercase tracking-widest text-[10px] border-none"
              >
                Search
              </Button>
            </form>
          </div>
        </div>
      </div>

      <main className="container px-4 max-w-6xl mx-auto -mt-10 relative z-50">
        <div className="grid lg:grid-cols-[1fr,1.5fr] gap-6">
          
          {/* List Section */}
          <div className="space-y-3">
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-t-[24px] border border-slate-100 border-b-none">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Log</span>
            </div>
            <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {filteredBookings.map((booking) => (
                <Card 
                  key={booking.id} 
                  onClick={() => setSelectedBooking(booking)}
                  className={`p-5 cursor-pointer rounded-2xl transition-all duration-300 border-none shadow-sm hover:shadow-md ${
                    selectedBooking?.id === booking.id ? 'ring-2 ring-[#008080] bg-white' : 'bg-white/60 hover:bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-[#F0E68C]/20 rounded-lg">
                        <User className="h-4 w-4 text-[#857F3E]" />
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase tracking-tight text-slate-800 leading-none">
                          {booking.guest_name || "Guest"}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                          ID: {booking.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[9px] font-black uppercase">
                      {booking.payment_status}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <p className="text-[11px] font-bold text-slate-500 uppercase truncate max-w-[150px]">
                      {itemDetails[booking.item_id]?.name || "Loading..."}
                    </p>
                    <p className="text-md font-black text-[#008080]">
                      KES {booking.total_amount.toLocaleString()}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Details Section */}
          <div className="lg:sticky lg:top-24 h-fit">
            {selectedBooking ? (
              <Card className="bg-white rounded-[32px] p-8 shadow-2xl border-none overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8">
                    <Ticket className="h-24 w-24 text-slate-50 absolute -right-4 -top-4 rotate-12" />
                </div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <p className="text-[10px] font-black text-[#FF7F50] uppercase tracking-[0.2em] mb-1">Confirmed Booking</p>
                      <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800">
                        Details & Guest Info
                      </h2>
                    </div>
                    <BookingDownloadButton 
                       booking={{
                          bookingId: selectedBooking.id,
                          guestName: selectedBooking.guest_name || 'Guest',
                          guestEmail: selectedBooking.guest_email || '',
                          guestPhone: selectedBooking.guest_phone || undefined,
                          itemName: itemDetails[selectedBooking.item_id]?.name || 'Booking',
                          bookingType: selectedBooking.booking_type,
                          visitDate: selectedBooking.visit_date || selectedBooking.created_at,
                          totalAmount: selectedBooking.total_amount,
                          slotsBooked: selectedBooking.slots_booked || 1,
                          paymentStatus: selectedBooking.payment_status || 'paid',
                       }}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 mb-8">
                    {/* Column 1: Item & Status */}
                    <div className="space-y-6">
                        <InfoBlock 
                            label="Service" 
                            value={itemDetails[selectedBooking.item_id]?.name || "N/A"} 
                            sub={selectedBooking.booking_type}
                            icon={<Briefcase className="h-4 w-4" />}
                        />
                        <InfoBlock 
                            label="Transaction Date" 
                            value={new Date(selectedBooking.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'})}
                            icon={<Calendar className="h-4 w-4" />}
                        />
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Payment</p>
                             <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-[#FF0000]">KES {selectedBooking.total_amount}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Paid</span>
                             </div>
                        </div>
                    </div>

                    {/* Column 2: Guest Details */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Guest Identity</h3>
                        <ContactLink icon={<User />} label="Name" text={selectedBooking.guest_name} />
                        <ContactLink icon={<Mail />} label="Email" text={selectedBooking.guest_email} href={`mailto:${selectedBooking.guest_email}`} />
                        <ContactLink icon={<Phone />} label="Phone" text={selectedBooking.guest_phone} href={`tel:${selectedBooking.guest_phone}`} />
                        
                        <div className="pt-4 mt-4 border-t border-slate-100">
                             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Host Profile</h3>
                             {(() => {
                                const host = hostInfo[itemDetails[selectedBooking.item_id]?.hostId];
                                return host ? (
                                    <div className="flex items-center gap-3 bg-[#008080]/5 p-3 rounded-xl">
                                        <div className="h-8 w-8 rounded-lg bg-[#008080] flex items-center justify-center text-white text-[10px] font-black">
                                            {host.name?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{host.name}</p>
                                            <p className="text-[9px] font-bold text-[#008080] uppercase tracking-tighter">{host.email}</p>
                                        </div>
                                    </div>
                                ) : <p className="text-[10px] font-bold text-slate-400 uppercase">Provider Info Unavailable</p>;
                             })()}
                        </div>
                    </div>
                  </div>

                  {selectedBooking.booking_details && (
                    <div className="bg-[#F8F9FA] rounded-2xl p-5 border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                           <ShieldCheck className="h-3 w-3" /> System Meta Data
                        </p>
                        <pre className="text-[10px] font-mono text-slate-500 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {JSON.stringify(selectedBooking.booking_details, null, 2)}
                        </pre>
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <div className="h-[400px] border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center text-center p-8 bg-white/40">
                <Search className="h-12 w-12 text-slate-200 mb-4" />
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-400">
                  {hasSearched ? "No Booking Selected" : "Search to Begin"}
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
                  {hasSearched 
                    ? "Select a transaction from the list to view full internal details" 
                    : "Enter a booking ID, name, email or phone number to search"}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <MobileBottomBar />
    </div>
  );
};

/* Helper Components for the Admin UI */

const InfoBlock = ({ label, value, sub, icon }: { label: string, value: string, sub?: string, icon: React.ReactNode }) => (
    <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
            {icon} {label}
        </p>
        <p className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">{value}</p>
        {sub && <p className="text-[9px] font-bold text-[#008080] uppercase tracking-widest mt-1">{sub}</p>}
    </div>
);

const ContactLink = ({ icon, label, text, href }: { icon: any, label: string, text: string, href?: string }) => (
    <div className="flex items-center gap-3 group">
        <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#FF7F50]/10 group-hover:text-[#FF7F50] transition-colors">
            {cloneElement(icon, { className: "h-4 w-4" })}
        </div>
        <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">{label}</span>
            {href ? (
                <a href={href} className="text-[11px] font-bold text-slate-600 hover:text-[#008080] transition-colors underline decoration-slate-200 underline-offset-4">
                    {text || "N/A"}
                </a>
            ) : (
                <span className="text-[11px] font-bold text-slate-600">{text || "N/A"}</span>
            )}
        </div>
    </div>
);

import { cloneElement } from "react";

export default AllBookings;