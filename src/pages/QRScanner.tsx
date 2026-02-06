import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Camera, CheckCircle, XCircle, AlertCircle, 
  User, Calendar, Mail, Phone, Users, WifiOff, Wifi, 
  ChevronRight, QrCode, ShieldCheck
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useOfflineBookings } from "@/hooks/useOfflineBookings";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

interface BookingData {
  bookingId: string;
  visitDate: string;
  email: string;
}

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
}

const QRScanner = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const { verifyBookingOffline, saveOfflineScan, cachedHostBookings, getPendingCheckIns, clearSyncedCheckIns } = useOfflineBookings();
  const [isMobile, setIsMobile] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [verifiedBooking, setVerifiedBooking] = useState<VerifiedBooking | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "verifying" | "valid" | "invalid" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [itemName, setItemName] = useState("");
  const [isOfflineScan, setIsOfflineScan] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    const syncOfflineCheckIns = async () => {
      if (!isOnline || !user) return;
      const pendingCheckIns = getPendingCheckIns();
      if (pendingCheckIns.length === 0) return;

      for (const checkIn of pendingCheckIns) {
        try {
          await supabase
            .from("bookings")
            .update({
              checked_in: true,
              checked_in_at: checkIn.checkedInAt,
              checked_in_by: checkIn.checkedInBy
            })
            .eq("id", checkIn.bookingId);
        } catch (error) {
          console.error("Failed to sync check-in:", error);
        }
      }
      clearSyncedCheckIns();
      toast({ title: "Synced", description: `${pendingCheckIns.length} offline check-in(s) synced` });
    };
    syncOfflineCheckIns();
  }, [isOnline, user]);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth < 768 || 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const verifyBookingOnline = async (bookingId: string, email: string, visitDate: string) => {
    const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
    if (error || !booking) return { valid: false, error: "Booking not found" };
    if (booking.guest_email !== email) return { valid: false, error: "Booking email doesn't match" };
    if (booking.payment_status !== "completed" && booking.payment_status !== "paid") return { valid: false, error: "Booking is not paid" };

    const bookingVisitDate = booking.visit_date ? format(new Date(booking.visit_date), "yyyy-MM-dd") : null;
    if (bookingVisitDate !== visitDate) return { valid: false, error: `Visit date mismatch` };

    let itemData: { created_by: string | null; name: string } | null = null;
    const bookingType = booking.booking_type;

    if (bookingType === "trip" || bookingType === "event") {
      const { data } = await supabase.from("trips").select("created_by, name").eq("id", booking.item_id).single();
      itemData = data;
    } else if (bookingType === "hotel") {
      const { data } = await supabase.from("hotels").select("created_by, name").eq("id", booking.item_id).single();
      itemData = data;
    } else if (bookingType === "adventure_place" || bookingType === "campsite" || bookingType === "experience") {
      const { data } = await supabase.from("adventure_places").select("created_by, name").eq("id", booking.item_id).single();
      itemData = data;
    }

    if (itemData && itemData.created_by !== user?.id) return { valid: false, error: "This booking is not for your listing" };
    return { valid: true, booking, itemName: itemData?.name };
  };

  const verifyBooking = async (qrData: string) => {
    setVerificationStatus("verifying");
    setErrorMessage("");
    setIsOfflineScan(false);

    try {
      const parsedData: BookingData = JSON.parse(qrData);
      const { bookingId, visitDate, email } = parsedData;
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

      // Check if already checked in - prevent double entry
      if (result.booking?.checked_in) {
        setVerifiedBooking(result.booking as VerifiedBooking);
        if (result.itemName) setItemName(result.itemName);
        else if (result.booking?.item_name) setItemName(result.booking.item_name);
        setCheckedIn(true); // Show checked-in state immediately
        setVerificationStatus("valid");
        return;
      }

      setVerifiedBooking(result.booking as VerifiedBooking);
      if (result.itemName) setItemName(result.itemName);
      else if (result.booking?.item_name) setItemName(result.booking.item_name);
      setVerificationStatus("valid");
    } catch (err) {
      setVerificationStatus("error");
      setErrorMessage("Invalid QR code format.");
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
        await supabase.from("bookings").update({ checked_in: true, checked_in_at: new Date().toISOString(), checked_in_by: user.id }).eq("id", verifiedBooking.id);
      } else {
        const offlineCheckIns = JSON.parse(localStorage.getItem('offline_checkins') || '[]');
        offlineCheckIns.push({ bookingId: verifiedBooking.id, checkedInAt: new Date().toISOString(), checkedInBy: user.id });
        localStorage.setItem('offline_checkins', JSON.stringify(offlineCheckIns));
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
  };

  if (authLoading) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-10">
      {/* Dynamic Header */}
      <div className="bg-white px-6 pt-12 pb-6 rounded-b-[40px] shadow-sm border-b border-slate-100 flex items-center justify-between">
        <Button onClick={() => navigate(-1)} className="rounded-full bg-slate-100 text-slate-900 border-none w-10 h-10 p-0 hover:bg-slate-200">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
            <h1 className="text-xl font-black uppercase tracking-tighter" style={{ color: COLORS.TEAL }}>Verify Guest</h1>
            <div className="flex items-center justify-center gap-1.5 mt-1">
                {isOnline ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-2 py-0 text-[10px] font-black uppercase">
                        <Wifi className="h-3 w-3 mr-1" /> Online
                    </Badge>
                ) : (
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-2 py-0 text-[10px] font-black uppercase">
                        <WifiOff className="h-3 w-3 mr-1" /> Offline
                    </Badge>
                )}
            </div>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <main className="container px-6 -mt-4 relative z-50 space-y-6">
        {/* Offline Warning Card */}
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
               {/* Decorative Background Icon */}
               <ShieldCheck className="absolute -right-8 -top-8 h-32 w-32 text-green-50 opacity-50" />
               
               <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <Badge className="bg-green-500 hover:bg-green-500 text-white border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-2">
                            Verified Valid
                        </Badge>
                        <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">{verifiedBooking.guest_name}</h2>
                    </div>
                    {isOfflineScan && (
                        <div className="bg-[#F0E68C] px-2 py-1 rounded-lg text-[9px] font-black uppercase">Offline</div>
                    )}
                </div>

                <div className="space-y-5 border-y border-slate-50 py-6 mb-6">
                    <InfoRow icon={<Calendar className="h-4 w-4" />} label="Visit Date" value={format(new Date(verifiedBooking.visit_date), "dd MMM yyyy")} />
                    <InfoRow icon={<Users className="h-4 w-4" />} label="Group Size" value={`${verifiedBooking.slots_booked || 1} People`} />
                    <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={verifiedBooking.guest_email} />
                    {itemName && <InfoRow icon={<ChevronRight className="h-4 w-4" />} label="Item" value={itemName} />}
                </div>

                <div className="flex justify-between items-end mb-8">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Paid</p>
                        <span className="text-2xl font-black" style={{ color: COLORS.RED }}>KSh {verifiedBooking.total_amount?.toLocaleString() ?? 'N/A'}</span>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Booking ID</p>
                        <span className="text-[11px] font-mono font-bold text-slate-500 uppercase">{verifiedBooking.id.slice(0,8)}</span>
                    </div>
                </div>

                {!checkedIn && !verifiedBooking.checked_in ? (
                    <Button 
                        onClick={confirmCheckIn}
                        disabled={isCheckingIn}
                        className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
                        style={{ 
                            background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #006666 100%)`,
                            boxShadow: `0 12px 24px -8px ${COLORS.TEAL}88`
                        }}
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
            <Button 
                onClick={resetScanner}
                className="w-full py-6 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest"
            >
                Try Again
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

// Helper Component for Info Rows
const InfoRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
    <div className="flex items-center justify-between group">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-50 text-slate-400 group-hover:text-[#008080] transition-colors">
                {icon}
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        </div>
        <span className="text-xs font-black text-slate-700 uppercase tracking-tight text-right">{value}</span>
    </div>
);

export default QRScanner;