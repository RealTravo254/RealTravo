import { cloneElement, useEffect, useState } from "react";
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
  Calendar, Phone, User, Search,
  ArrowLeft, DollarSign,
  Ticket, Briefcase,
  CheckCircle2, ShieldCheck, Hash,
  Clock, Users, CreditCard,
  Loader2,
} from "lucide-react";
import { BookingDownloadButton } from "@/components/booking/BookingDownloadButton";
import { useCurrency } from "@/contexts/CurrencyContext";

const TEAL = "#008080";
const CORAL = "#FF7F50";

interface ItemRef { id: string; type: string }
interface ItemDetail { name: string; type: string; hostId: string }
interface HostProfile { name: string; phone_number: string }

const AllBookings = () => {
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin]                 = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [searching, setSearching]             = useState(false);
  const [hasSearched, setHasSearched]         = useState(false);
  const [searchQuery, setSearchQuery]         = useState("");
  const [bookings, setBookings]               = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [itemDetails, setItemDetails]         = useState<Record<string, ItemDetail>>({});
  const [hostInfo, setHostInfo]               = useState<Record<string, HostProfile>>({});

  useEffect(() => {
    (async () => {
      if (!user) { navigate("/auth"); return; }
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id);
      if (!roles?.some((r: any) => r.role === "admin")) {
        toast({ title: "Access Denied", variant: "destructive" });
        navigate("/");
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    })();
  }, [user]);

  const fetchItemDetails = async (items: ItemRef[]) => {
    const details: Record<string, ItemDetail> = {};
    const hostIds = new Set<string>();

    for (const item of items) {
      try {
        const table =
          item.type === "hotel" ? "hotels"
          : item.type === "adventure" || item.type === "adventure_place"
            ? "adventure_places"
            : "trips";
        const { data } = await supabase
          .from(table as any).select("name, created_by").eq("id", item.id).single();
        if (data) {
          const d = data as any;
          details[item.id] = { name: d.name, type: item.type, hostId: d.created_by };
          if (d.created_by) hostIds.add(d.created_by);
        }
      } catch (_) {}
    }
    setItemDetails(details);

    const hosts: Record<string, HostProfile> = {};
    for (const hid of hostIds) {
      const { data } = await supabase
        .from("profiles").select("name, phone_number").eq("id", hid).single();
      if (data) hosts[hid] = data as HostProfile;
    }
    setHostInfo(hosts);
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setBookings([]);
      setHasSearched(false);
      return;
    }
    setSearching(true);
    setHasSearched(true);
    setSelectedBooking(null);

    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .ilike("id", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      const rows = data ?? [];
      setBookings(rows);

      const refMap = new Map<string, ItemRef>();
      rows.forEach((b) => {
        const key = `${b.item_id}::${b.booking_type}`;
        if (!refMap.has(key)) {
          refMap.set(key, { id: String(b.item_id), type: String(b.booking_type) });
        }
      });
      await fetchItemDetails(Array.from(refMap.values()));

      const exact = rows.find((b: any) => b.id.toLowerCase() === q.toLowerCase());
      if (exact) setSelectedBooking(exact);
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  if (loading || !isAdmin) return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-[#008080] animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      <div className="bg-[#008080] pt-12 pb-20 px-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="container mx-auto px-4 relative z-10">
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
                {hasSearched
                  ? `${bookings.length} result${bookings.length !== 1 ? "s" : ""} found`
                  : "Search by Booking ID"}
              </p>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
              className="w-full md:w-[460px] flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  placeholder="Enter Booking ID…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-2xl pl-11 h-14 font-bold text-sm focus:bg-white/20 transition-all"
                />
              </div>
              <Button
                type="submit"
                disabled={searching}
                className="h-14 px-6 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-black uppercase tracking-widest text-[10px] border-none"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </form>
          </div>
        </div>
      </div>

      <main className="container px-4 mx-auto -mt-10 relative z-50">
        <div className="grid lg:grid-cols-[1fr,1.6fr] gap-6">

          <div>
            <div className="bg-white/80 backdrop-blur-md px-5 py-3 rounded-t-[20px] border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                {searching ? "Searching…" : `Transaction Log · ${bookings.length} records`}
              </span>
            </div>

            <div className="max-h-[72vh] overflow-y-auto space-y-2 pr-1 pb-2">
              {searching && (
                <div className="flex items-center justify-center py-16 bg-white/60 rounded-b-[20px]">
                  <Loader2 className="h-7 w-7 animate-spin text-[#008080]" />
                </div>
              )}

              {!searching && hasSearched && bookings.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 bg-white/60 rounded-b-[20px] text-center px-6">
                  <Search className="h-10 w-10 text-slate-200 mb-3" />
                  <p className="text-sm font-black text-slate-400 uppercase tracking-tight">No results</p>
                  <p className="text-[10px] text-slate-400 mt-1">Try a different Booking ID</p>
                </div>
              )}

              {!searching && !hasSearched && (
                <div className="flex flex-col items-center justify-center py-16 bg-white/60 rounded-b-[20px] text-center px-6">
                  <Hash className="h-10 w-10 text-slate-200 mb-3" />
                  <p className="text-sm font-black text-slate-400 uppercase tracking-tight">Search to begin</p>
                  <p className="text-[10px] text-slate-400 mt-1">Enter a Booking ID above</p>
                </div>
              )}

              {!searching && bookings.map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBooking(b)}
                  className={`w-full text-left px-5 py-4 transition-all duration-200 border
                    ${selectedBooking?.id === b.id
                      ? "bg-white ring-2 ring-[#008080] border-transparent shadow-md"
                      : "bg-white/70 border-slate-100 hover:bg-white hover:shadow-sm"
                    }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-[#008080]/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-[#008080]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-black uppercase tracking-tight text-slate-800 truncate">
                          {b.guest_name || "Guest"}
                        </p>
                        <p className="text-[9px] font-mono text-slate-400 mt-0.5 truncate">
                          #{b.id.slice(0, 12)}…
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-[9px] font-black uppercase border-none flex-shrink-0 ${
                      b.payment_status === "paid" || b.payment_status === "completed"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {b.payment_status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pl-10">
                    <p className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[160px]">
                      {itemDetails[b.item_id]?.name || "—"}
                    </p>
                    <p className="text-[13px] font-black text-[#008080]">
                      {formatPrice(b.total_amount)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:sticky lg:top-24 h-fit">
            {selectedBooking ? (
              <DetailPanel
                booking={selectedBooking}
                itemDetail={itemDetails[selectedBooking.item_id]}
                host={hostInfo[itemDetails[selectedBooking.item_id]?.hostId]}
                formatPrice={formatPrice}
              />
            ) : (
              <div className="h-[420px] border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center text-center p-8 bg-white/40">
                <Ticket className="h-12 w-12 text-slate-200 mb-4" />
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-400">
                  {hasSearched ? "Select a booking" : "Search to begin"}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                  {hasSearched
                    ? "Click any record on the left to view full details"
                    : "Use the search bar above to find bookings"}
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

const DetailPanel = ({
  booking, itemDetail, host, formatPrice,
}: {
  booking: any;
  itemDetail?: ItemDetail;
  host?: HostProfile;
  formatPrice: (v: number) => string;
}) => (
  <Card className="bg-white rounded-[32px] p-8 shadow-2xl border-none overflow-hidden relative">
    <Ticket className="h-28 w-28 text-slate-50 absolute -right-6 -top-6 rotate-12 pointer-events-none" />

    <div className="relative z-10 space-y-7">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-black text-[#FF7F50] uppercase tracking-[0.2em] mb-1">Confirmed Booking</p>
          <h2 className="text-xl font-black uppercase tracking-tighter text-slate-800 leading-tight">
            {itemDetail?.name || "Booking Details"}
          </h2>
          <p className="text-[10px] font-mono text-slate-400 mt-1 break-all">ID: {booking.id}</p>
        </div>
        <BookingDownloadButton
          booking={{
            bookingId: booking.id,
            guestName: booking.guest_name || "Guest",
            guestEmail: booking.guest_email || "",
            guestPhone: booking.guest_phone || undefined,
            itemName: itemDetail?.name || "Booking",
            bookingType: booking.booking_type,
            visitDate: booking.visit_date || booking.created_at,
            totalAmount: booking.total_amount,
            slotsBooked: booking.slots_booked || 1,
            paymentStatus: booking.payment_status || "paid",
          }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatChip icon={<DollarSign className="h-4 w-4" />} label="Total Paid" value={formatPrice(booking.total_amount)} accent="#dc2626" />
        <StatChip icon={<Users className="h-4 w-4" />} label="Slots" value={String(booking.slots_booked ?? 1)} accent={TEAL} />
        <StatChip
          icon={<Calendar className="h-4 w-4" />}
          label="Visit Date"
          value={booking.visit_date
            ? new Date(booking.visit_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : "Flexible"}
          accent={CORAL}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <SectionLabel>Guest Details</SectionLabel>
          <InfoRow icon={<User />} label="Name" value={booking.guest_name || "N/A"} />
          <InfoRow icon={<Phone />} label="Phone" value={booking.guest_phone || "N/A"} href={booking.guest_phone ? `tel:${booking.guest_phone}` : undefined} />
        </div>

        <div className="space-y-4">
          <SectionLabel>Booking Info</SectionLabel>
          <InfoRow icon={<Briefcase />} label="Service Type" value={booking.booking_type?.toUpperCase() || "N/A"} />
          <InfoRow icon={<CreditCard />} label="Payment Method" value={booking.payment_method || "N/A"} />
          <InfoRow icon={<Clock />} label="Booked On" value={new Date(booking.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} />
          <InfoRow
            icon={<CheckCircle2 />}
            label="Payment Status"
            value={booking.payment_status?.toUpperCase() || "N/A"}
            accent={booking.payment_status === "paid" || booking.payment_status === "completed" ? "#16a34a" : "#f59e0b"}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Host Profile</SectionLabel>
        {host ? (
          <div className="flex items-center gap-3 bg-[#008080]/5 px-4 py-3 rounded-2xl border border-[#008080]/10 mt-2">
            <div className="h-9 w-9 rounded-xl bg-[#008080] flex items-center justify-center text-white text-sm font-black flex-shrink-0">
              {host.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-black text-slate-800 uppercase tracking-tight">{host.name}</p>
              <p className="text-[10px] font-bold text-[#008080]">{host.phone_number || "No phone"}</p>
            </div>
          </div>
        ) : (
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Host info unavailable</p>
        )}
      </div>

      {booking.booking_details && (
        <div className="bg-[#F8F9FA] rounded-2xl p-5 border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <ShieldCheck className="h-3 w-3" /> System Metadata
          </p>
          <pre className="text-[10px] font-mono text-slate-500 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48">
            {JSON.stringify(booking.booking_details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  </Card>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">
    {children}
  </p>
);

const StatChip = ({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) => (
  <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center gap-1">
    <span style={{ color: accent }}>{icon}</span>
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    <p className="text-[13px] font-black leading-tight" style={{ color: accent }}>{value}</p>
  </div>
);

const InfoRow = ({
  icon, label, value, href, accent,
}: {
  icon: React.ReactElement;
  label: string;
  value: string;
  href?: string;
  accent?: string;
}) => (
  <div className="flex items-center gap-3 group">
    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0 group-hover:bg-[#FF7F50]/10 group-hover:text-[#FF7F50] transition-colors">
      {cloneElement(icon, { className: "h-4 w-4" })}
    </div>
    <div>
      <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">{label}</p>
      {href ? (
        <a href={href} className="text-[12px] font-bold text-slate-700 hover:text-[#008080] transition-colors underline decoration-slate-200 underline-offset-4">
          {value}
        </a>
      ) : (
        <p className="text-[12px] font-bold leading-tight" style={accent ? { color: accent } : { color: "#334155" }}>
          {value}
        </p>
      )}
    </div>
  </div>
);

export default AllBookings;