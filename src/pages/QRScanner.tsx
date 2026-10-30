import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, CheckCircle, XCircle, AlertCircle,
  Calendar, Mail, Phone, Users, WifiOff, Wifi,
  ChevronRight, QrCode, ShieldCheck, UserCheck, ChevronDown, ChevronUp, Ticket, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useOfflineBookings } from "@/hooks/useOfflineBookings";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getBookingLines, fmtMoney, dateOnly, getItemName } from "@/lib/bookingPdf";

const COLORS = { TEAL: "#008080", RED: "#FF0000", KHAKI: "#F0E68C", KHAKI_DARK: "#857F3E" };

interface VerifiedBooking {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  visit_date: string;
  total_amount: number;
  slots_booked: number;
  booking_type: string;
  item_id: string;
  payment_status: string;
  status: string;
  booking_details: any;
  item_name?: string;
  checked_in?: boolean;
  checked_in_at?: string;
  created_at?: string;
}

interface CheckedInGuest {
  id: string;
  guest_name: string;
  guest_email: string;
  visit_date: string;
  slots_booked: number;
  checked_in_at: string;
  total_amount: number;
  item_name?: string;
}

// ── QR parsing ───────────────────────────────────────────────────────────────
// New format: JSON {bookingId, visitDate, email}  (Bookings page, PDF, emails)
// Old PDFs:   "REALTRAVO|<id>|..."  and old emails: bare <uuid>  → verified by booking id only
const parseQr = (raw: string): { bookingId: string; visitDate: string; email: string; legacy: boolean } => {
  const text = raw.trim();
  if (text.startsWith("{")) {
    const p = JSON.parse(text);
    if (!p.bookingId) throw new Error("no id");
    return { bookingId: p.bookingId, visitDate: dateOnly(p.visitDate), email: p.email || "", legacy: false };
  }
  // bare booking id (older confirmation emails encoded just the UUID)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text))
    return { bookingId: text, visitDate: "", email: "", legacy: true };
  const parts = text.split("|");
  if (parts[0] === "REALTRAVO" && parts[1]) return { bookingId: parts[1], visitDate: "", email: "", legacy: true };
  throw new Error("unknown format");
};

const QRScanner = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const goBack = useSafeBack("/become-host");
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const { verifyBookingOffline, saveOfflineScan, cachedHostBookings, getPendingCheckIns, clearSyncedCheckIns } = useOfflineBookings();
  const [scanning, setScanning] = useState(true);
  const [verifiedBooking, setVerifiedBooking] = useState<VerifiedBooking | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "verifying" | "valid" | "invalid" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [itemName, setItemName] = useState("");
  const [isOfflineScan, setIsOfflineScan] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [arrivedGuests, setArrivedGuests] = useState<CheckedInGuest[]>([]);
  const [showArrived, setShowArrived] = useState(false);
  const [loadingArrived, setLoadingArrived] = useState(false);

  useEffect(() => {
    const syncOfflineCheckIns = async () => {
      if (!isOnline || !user) return;
      const pendingCheckIns = getPendingCheckIns();
      if (pendingCheckIns.length === 0) return;
      for (const checkIn of pendingCheckIns) {
        try {
          await supabase.from("bookings")
            .update({ checked_in: true, checked_in_at: checkIn.checkedInAt, checked_in_by: checkIn.checkedInBy })
            .eq("id", checkIn.bookingId);
        } catch (error) { console.error("Failed to sync check-in:", error); }
      }
      clearSyncedCheckIns();
      toast({ title: "Synced", description: `${pendingCheckIns.length} offline check-in(s) synced` });
    };
    syncOfflineCheckIns();
  }, [isOnline, user]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // ── Arrived guests ─────────────────────────────────────────────────────────
  const ARRIVED_PER_PAGE = 20;
  const [arrivedOffset, setArrivedOffset] = useState(0);
  const [hasMoreArrived, setHasMoreArrived] = useState(true);

  const fetchArrivedGuests = useCallback(async (loadMore = false) => {
    if (!user || !isOnline) return;
    setLoadingArrived(true);
    try {
      const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
        supabase.from("trips").select("id, name").eq("created_by", user.id),
        supabase.from("hotels").select("id, name").eq("created_by", user.id),
        supabase.from("adventure_places").select("id, name").eq("created_by", user.id),
      ]);

      const itemIds: string[] = [];
      const itemNameMap: Record<string, string> = {};
      [tripsRes, hotelsRes, adventuresRes].forEach((res) =>
        res.data?.forEach((item: any) => { itemIds.push(item.id); itemNameMap[item.id] = item.name; })
      );

      if (itemIds.length === 0) { setArrivedGuests([]); return; }

      const today = format(new Date(), "yyyy-MM-dd");
      const offset = loadMore ? arrivedOffset + ARRIVED_PER_PAGE : 0;
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("id, guest_name, guest_email, visit_date, slots_booked, checked_in_at, total_amount, item_id")
        .in("item_id", itemIds)
        .eq("checked_in", true)
        .eq("visit_date", today)
        .order("checked_in_at", { ascending: false })
        .range(offset, offset + ARRIVED_PER_PAGE - 1);
      if (error) throw error;

      const guests: CheckedInGuest[] = (bookings || []).map((b: any) => ({ ...b, item_name: itemNameMap[b.item_id] || "Unknown" }));
      if (loadMore) { setArrivedGuests((prev) => [...prev, ...guests]); setArrivedOffset(offset); }
      else { setArrivedGuests(guests); setArrivedOffset(0); }
      setHasMoreArrived(guests.length >= ARRIVED_PER_PAGE);
    } catch (error) {
      console.error("Error fetching arrived guests:", error);
    } finally {
      setLoadingArrived(false);
    }
  }, [user, isOnline, arrivedOffset]);

  useEffect(() => { if (user && isOnline) fetchArrivedGuests(); }, [user, isOnline]);
  useEffect(() => { if (checkedIn && isOnline) fetchArrivedGuests(); }, [checkedIn, isOnline]);

  // ── Verification ───────────────────────────────────────────────────────────
  const verifyBookingOnline = async (bookingId: string, email: string, visitDate: string) => {
    const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
    if (error || !booking) return { valid: false, error: "Booking not found" };

    // email / date are only checked when the QR carries them (legacy PDF QRs carry just the id)
    if (email && (booking.guest_email || "").toLowerCase() !== email.toLowerCase())
      return { valid: false, error: "Booking email doesn't match" };
    if (booking.payment_status !== "completed" && booking.payment_status !== "paid")
      return { valid: false, error: "Booking is not paid" };
    if (visitDate && dateOnly(booking.visit_date) !== visitDate)
      return { valid: false, error: `Visit date mismatch (booked for ${dateOnly(booking.visit_date) || "—"})` };

    // Which table holds the listing: trips/events -> trips; hotels may be in hotels (old) or adventure_places (new)
    const tables = booking.booking_type === "trip" || booking.booking_type === "event"
      ? ["trips"]
      : booking.booking_type === "hotel" ? ["hotels", "adventure_places"] : ["adventure_places"];
    let itemData: any = null;
    for (const t of tables) {
      const { data } = await (supabase as any).from(t).select("created_by, name").eq("id", booking.item_id).maybeSingle();
      if (data) { itemData = data; break; }
    }
    // Strict: the listing must exist AND belong to the host scanning
    if (!itemData) return { valid: false, error: "Listing for this booking was not found" };
    if (itemData.created_by !== user?.id) return { valid: false, error: "This booking is not for your listing" };
    return { valid: true, booking, itemName: itemData?.name || getItemName(booking.booking_details) };
  };

  const verifyBooking = async (qrData: string) => {
    setVerificationStatus("verifying");
    setErrorMessage("");
    setIsOfflineScan(false);

    let parsed;
    try { parsed = parseQr(qrData); }
    catch { setVerificationStatus("error"); setErrorMessage("Invalid QR code format."); return; }

    try {
      const { bookingId, visitDate, email } = parsed;
      let result: any;

      if (isOnline) {
        result = await verifyBookingOnline(bookingId, email, visitDate);
      } else {
        result = verifyBookingOffline(bookingId, email, visitDate);
        setIsOfflineScan(true);
        saveOfflineScan({ bookingId, scannedAt: new Date().toISOString(), verified: result.valid, guestName: result.booking?.guest_name, visitDate });
      }

      if (!result.valid) {
        setVerificationStatus("invalid");
        setErrorMessage(result.error || "Verification failed");
        return;
      }

      setVerifiedBooking(result.booking as VerifiedBooking);
      setItemName(result.itemName || result.booking?.item_name || getItemName(result.booking?.booking_details));

      if (result.booking?.checked_in) {
        setCheckedIn(true);
        toast({
          title: "Already Checked In",
          description: `This guest was already checked in at ${result.booking.checked_in_at ? format(new Date(result.booking.checked_in_at), "HH:mm") : "earlier"}`,
          variant: "destructive",
        });
      }
      setVerificationStatus("valid");
    } catch (err) {
      setVerificationStatus("error");
      setErrorMessage("Could not verify this booking. Please try again.");
    }
  };

  const handleScan = (result: any) => {
    if (result && result[0]?.rawValue && scanning) {
      setScanning(false);
      verifyBooking(result[0].rawValue);
    }
  };

  const confirmCheckIn = async () => {
    if (!verifiedBooking || !user) return;
    setIsCheckingIn(true);
    try {
      if (isOnline) {
        const { error } = await supabase.from("bookings")
          .update({ checked_in: true, checked_in_at: new Date().toISOString(), checked_in_by: user.id })
          .eq("id", verifiedBooking.id);
        if (error) throw error;
      } else {
        const offlineCheckIns = JSON.parse(localStorage.getItem("offline_checkins") || "[]");
        offlineCheckIns.push({ bookingId: verifiedBooking.id, checkedInAt: new Date().toISOString(), checkedInBy: user.id });
        localStorage.setItem("offline_checkins", JSON.stringify(offlineCheckIns));
      }
      setCheckedIn(true);
      toast({ title: "Check-in Confirmed" });
    } catch (error) {
      toast({ title: "Check-in Failed", variant: "destructive" });
    } finally {
      setIsCheckingIn(false);
    }
  };

  const resetScanner = () => {
    setScanning(true);
    setVerifiedBooking(null);
    setVerificationStatus("idle");
    setCheckedIn(false);
    setItemName("");
  };

  if (authLoading) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;

  const d = verifiedBooking?.booking_details || {};
  const lines = verifiedBooking ? getBookingLines(d) : [];
  const sections = Array.from(new Set(lines.map((l) => l.section)));
  const isCustom = !!(d.inquiry_id || d.is_custom_booking);
  const adults = d.adults ?? d.num_adults;
  const children = d.children ?? d.num_children;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-10">
      <div className="bg-white px-6 pt-12 pb-6 rounded-b-[40px] shadow-sm border-b border-slate-100 flex items-center justify-between">
        <Button onClick={goBack} className="rounded-full bg-slate-100 text-slate-900 border-none w-10 h-10 p-0 hover:bg-slate-200">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <h1 className="text-xl font-black uppercase tracking-tighter" style={{ color: COLORS.TEAL }}>Verify Guest</h1>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            {isOnline ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-2 py-0 text-[10px] font-black uppercase"><Wifi className="h-3 w-3 mr-1" /> Online</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-2 py-0 text-[10px] font-black uppercase"><WifiOff className="h-3 w-3 mr-1" /> Offline</Badge>
            )}
          </div>
        </div>
        <div className="w-10" />
      </div>

      <main className="container px-6 -mt-4 relative z-50 space-y-6">
        {!isOnline && (
          <div className="bg-[#F0E68C]/20 border border-[#F0E68C] p-4 rounded-2xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[#857F3E]" />
            <p className="text-[11px] font-bold text-[#857F3E] uppercase tracking-wide">
              Offline Mode: Verifying from {cachedHostBookings.length} cached bookings
            </p>
          </div>
        )}

        {scanning && verificationStatus === "idle" && (
          <div className="space-y-6">
            <div className="bg-white rounded-[32px] p-2 shadow-2xl border border-slate-100 overflow-hidden relative">
              <div className="absolute inset-0 z-10 pointer-events-none border-[12px] border-white/50 rounded-[32px]"></div>
              <Scanner
                onScan={handleScan}
                onError={(err) => console.error(err)}
                constraints={{ facingMode: "environment" }}
                styles={{ container: { width: "100%", aspectRatio: "1/1", borderRadius: "28px" } }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="w-48 h-48 border-2 border-dashed border-white/80 rounded-3xl opacity-50"></div>
              </div>
            </div>

            <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-100 text-center">
              <QrCode className="h-8 w-8 mx-auto mb-3 text-slate-300" />
              <h2 className="text-sm font-black uppercase tracking-widest mb-1" style={{ color: COLORS.TEAL }}>Align QR Code</h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase leading-relaxed">
                Place the guest's booking QR code within the frame to verify automatically.
              </p>
            </div>
          </div>
        )}

        {verificationStatus === "verifying" && (
          <div className="bg-white rounded-[32px] p-12 shadow-sm border border-slate-100 text-center">
            <div className="h-16 w-16 border-4 border-[#008080]/20 border-t-[#008080] rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-lg font-black uppercase tracking-widest" style={{ color: COLORS.TEAL }}>Verifying...</h2>
          </div>
        )}

        {verificationStatus === "valid" && verifiedBooking && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100 relative overflow-hidden">
              <ShieldCheck className="absolute -right-8 -top-8 h-32 w-32 text-green-50 opacity-50" />

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <Badge className="bg-green-500 hover:bg-green-500 text-white border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest">Verified Valid</Badge>
                      {isCustom && (
                        <Badge className="bg-[#C1552F] hover:bg-[#C1552F] text-white border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                          <Sparkles className="h-3 w-3 mr-1" /> Custom booking
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">{verifiedBooking.guest_name}</h2>
                  </div>
                  {isOfflineScan && <div className="bg-[#F0E68C] px-2 py-1 rounded-lg text-[9px] font-black uppercase">Offline</div>}
                </div>

                {/* Guest + visit */}
                <div className="space-y-5 border-y border-slate-50 py-6 mb-6">
                  {itemName && <InfoRow icon={<ChevronRight className="h-4 w-4" />} label="Booked item" value={itemName} />}
                  <InfoRow icon={<Calendar className="h-4 w-4" />} label="Visit Date" value={verifiedBooking.visit_date ? format(new Date(verifiedBooking.visit_date), "dd MMM yyyy") : "—"} />
                  <InfoRow icon={<Users className="h-4 w-4" />} label="Group Size" value={`${verifiedBooking.slots_booked || 1} People`} />
                  {(adults || children) && (
                    <InfoRow icon={<Users className="h-4 w-4" />} label="Adults / Children" value={`${adults || 0} / ${children || 0}`} />
                  )}
                  <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={verifiedBooking.guest_email} />
                  {verifiedBooking.guest_phone && <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={verifiedBooking.guest_phone} />}
                  {d.rescheduled_at && <InfoRow icon={<Calendar className="h-4 w-4" />} label="Rescheduled" value={format(new Date(d.rescheduled_at), "dd MMM yyyy")} />}
                </div>

                {/* Every section of the booking: entry tickets, tickets, activities, facilities */}
                {sections.length > 0 && (
                  <div className="space-y-5 mb-6">
                    {sections.map((s) => (
                      <div key={s}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Ticket className="h-3 w-3" /> {s}
                        </p>
                        <div className="space-y-2">
                          {lines.filter((l) => l.section === s).map((l, i) => (
                            <div key={i} className="bg-slate-50 rounded-2xl px-4 py-3">
                              <div className="flex justify-between gap-3">
                                <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{l.label}</span>
                                <span className="text-xs font-black text-[#008080] whitespace-nowrap">{fmtMoney(l.amount)}</span>
                              </div>
                              {l.sub && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{l.sub}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-end mb-8">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Paid</p>
                    <span className="text-2xl font-black" style={{ color: COLORS.RED }}>{fmtMoney(verifiedBooking.total_amount ?? 0)}</span>
                    <p className="text-[10px] font-bold text-green-600 uppercase mt-1">{verifiedBooking.payment_status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Booking ID</p>
                    <span className="text-[11px] font-mono font-bold text-slate-500 uppercase">{verifiedBooking.id.slice(0, 8)}</span>
                  </div>
                </div>

                {!checkedIn && !verifiedBooking.checked_in ? (
                  <Button
                    onClick={confirmCheckIn}
                    disabled={isCheckingIn}
                    className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
                    style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #006666 100%)`, boxShadow: `0 12px 24px -8px ${COLORS.TEAL}88` }}
                  >
                    {isCheckingIn ? "Checking In..." : "Confirm Arrival"}
                  </Button>
                ) : (
                  <div className="w-full py-6 rounded-2xl bg-green-50 border-2 border-green-200 flex items-center justify-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    <span className="text-sm font-black text-green-700 uppercase tracking-widest">Guest Checked In</span>
                  </div>
                )}

                <Button onClick={resetScanner} variant="ghost" className="w-full mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Scan Next Guest
                </Button>
              </div>
            </div>
          </div>
        )}

        {(verificationStatus === "invalid" || verificationStatus === "error") && (
          <div className="bg-white rounded-[32px] p-8 shadow-2xl border-t-4 border-t-red-500 text-center">
            <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 mb-2">Verification Failed</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-8 leading-relaxed">
              {errorMessage || "The QR code scanned is either invalid, expired, or doesn't belong to your listings."}
            </p>
            <Button onClick={resetScanner} className="w-full py-6 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest">Try Again</Button>
          </div>
        )}

        {/* Arrived Guests */}
        <div className="mt-6">
          <button
            onClick={() => setShowArrived(!showArrived)}
            className="w-full bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 flex items-center justify-between group hover:border-[#008080]/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-50 group-hover:bg-green-100 transition-colors"><UserCheck className="h-5 w-5 text-green-600" /></div>
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">Arrived Today</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{arrivedGuests.length} guest{arrivedGuests.length !== 1 ? "s" : ""} checked in</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[10px] font-black">{arrivedGuests.length}</Badge>
              {showArrived ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </div>
          </button>

          {showArrived && (
            <div className="mt-4 space-y-3">
              {loadingArrived ? (
                <div className="bg-white rounded-[20px] p-6 text-center">
                  <div className="h-8 w-8 border-2 border-[#008080]/20 border-t-[#008080] rounded-full animate-spin mx-auto" />
                </div>
              ) : arrivedGuests.length === 0 ? (
                <div className="bg-white rounded-[20px] p-8 text-center border border-slate-100">
                  <UserCheck className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">No guests checked in yet</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3 pr-2">
                    {arrivedGuests.map((guest) => (
                      <div key={guest.id} className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-tight text-slate-800">{guest.guest_name || "Guest"}</h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{guest.guest_email}</p>
                            <p className="text-[9px] font-mono text-slate-400 mt-0.5">ID: {guest.id.slice(0, 8)}</p>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-lg">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span className="text-[9px] font-black text-green-700 uppercase">Arrived</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Guests</p>
                            <p className="text-sm font-black text-slate-700">{guest.slots_booked || 1}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Amount</p>
                            <p className="text-sm font-black text-[#008080]">KSh {guest.total_amount?.toLocaleString() ?? "0"}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Time</p>
                            <p className="text-sm font-black text-slate-700">{guest.checked_in_at ? format(new Date(guest.checked_in_at), "HH:mm") : "-"}</p>
                          </div>
                        </div>
                        {guest.item_name && (
                          <div className="mt-3 pt-3 border-t border-slate-50">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{guest.item_name}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    {hasMoreArrived && (
                      <Button onClick={() => fetchArrivedGuests(true)} variant="outline" className="w-full rounded-2xl h-10 font-black uppercase tracking-widest text-[10px]" disabled={loadingArrived}>
                        {loadingArrived ? "Loading..." : "Load More Guests"}
                      </Button>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center justify-between group gap-3">
    <div className="flex items-center gap-3 flex-shrink-0">
      <div className="p-2 rounded-xl bg-slate-50 text-slate-400 group-hover:text-[#008080] transition-colors">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
    <span className="text-xs font-black text-slate-700 uppercase tracking-tight text-right break-words min-w-0">{value}</span>
  </div>
);

export default QRScanner;
 