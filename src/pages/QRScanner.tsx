import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Camera, CheckCircle, XCircle, AlertCircle, User, Calendar, Mail, Phone, Users, WifiOff, Wifi } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useOfflineBookings } from "@/hooks/useOfflineBookings";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

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

  // Sync offline check-ins when coming online
  useEffect(() => {
    const syncOfflineCheckIns = async () => {
      if (!isOnline || !user) return;
      
      const pendingCheckIns = getPendingCheckIns();
      if (pendingCheckIns.length === 0) return;

      console.log(`Syncing ${pendingCheckIns.length} offline check-ins...`);
      
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
      toast({
        title: "Synced",
        description: `${pendingCheckIns.length} offline check-in(s) synced`,
      });
    };

    syncOfflineCheckIns();
  }, [isOnline, user]);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth < 768 || 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.matchMedia('(display-mode: standalone)').matches;
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const verifyBookingOnline = async (bookingId: string, email: string, visitDate: string) => {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (error || !booking) {
      return { valid: false, error: "Booking not found" };
    }

    if (booking.guest_email !== email) {
      return { valid: false, error: "Booking email doesn't match" };
    }

    if (booking.payment_status !== "completed" && booking.payment_status !== "paid") {
      return { valid: false, error: "Booking is not paid" };
    }

    const bookingVisitDate = booking.visit_date ? format(new Date(booking.visit_date), "yyyy-MM-dd") : null;
    if (bookingVisitDate !== visitDate) {
      return { valid: false, error: `Visit date mismatch` };
    }

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

    if (itemData && itemData.created_by !== user?.id) {
      return { valid: false, error: "This booking is not for your listing" };
    }

    return { valid: true, booking, itemName: itemData?.name };
  };

  const verifyBooking = async (qrData: string) => {
    setVerificationStatus("verifying");
    setErrorMessage("");
    setIsOfflineScan(false);

    try {
      const parsedData: BookingData = JSON.parse(qrData);
      const { bookingId, visitDate, email } = parsedData;

      if (!bookingId || !visitDate || !email) {
        throw new Error("Invalid QR code format");
      }

      let result: any;

      if (isOnline) {
        result = await verifyBookingOnline(bookingId, email, visitDate);
      } else {
        result = verifyBookingOffline(bookingId, email, visitDate);
        setIsOfflineScan(true);
        saveOfflineScan({
          bookingId,
          scannedAt: new Date().toISOString(),
          verified: result.valid,
          guestName: result.booking?.guest_name,
          visitDate,
        });
      }

      if (!result.valid) {
        setVerificationStatus("invalid");
        setErrorMessage(result.error || "Verification failed");
        return;
      }

      setVerifiedBooking(result.booking as VerifiedBooking);
      if (result.itemName) setItemName(result.itemName);
      else if (result.booking?.item_name) setItemName(result.booking.item_name);
      setVerificationStatus("valid");
      
      toast({
        title: isOnline ? "Booking Verified" : "Booking Verified (Offline)",
        description: isOnline ? "Guest check-in confirmed" : "Verified from cached data",
      });

    } catch (err) {
      setVerificationStatus("error");
      setErrorMessage("Invalid QR code. Please scan a valid booking QR code.");
    }
  };

  const handleScan = (result: any) => {
    if (result && result[0]?.rawValue && scanning) {
      setScanning(false);
      verifyBooking(result[0].rawValue);
    }
  };

  const handleError = (error: any) => {
    console.error("Scanner error:", error);
    toast({
      title: "Scanner Error",
      description: "Could not access camera. Please check permissions.",
      variant: "destructive",
    });
  };

  const confirmCheckIn = async () => {
    if (!verifiedBooking || !user) return;
    
    setIsCheckingIn(true);
    try {
      if (isOnline) {
        const { error } = await supabase
          .from("bookings")
          .update({
            checked_in: true,
            checked_in_at: new Date().toISOString(),
            checked_in_by: user.id
          })
          .eq("id", verifiedBooking.id);

        if (error) throw error;
      } else {
        // Save offline check-in for sync later
        const offlineCheckIns = JSON.parse(localStorage.getItem('offline_checkins') || '[]');
        offlineCheckIns.push({
          bookingId: verifiedBooking.id,
          checkedInAt: new Date().toISOString(),
          checkedInBy: user.id
        });
        localStorage.setItem('offline_checkins', JSON.stringify(offlineCheckIns));
      }
      
      setCheckedIn(true);
      toast({
        title: "Check-in Confirmed",
        description: `${verifiedBooking.guest_name} has been checked in successfully`,
      });
    } catch (error) {
      console.error("Check-in error:", error);
      toast({
        title: "Check-in Failed",
        description: "Could not complete check-in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  const resetScanner = () => {
    setScanning(true);
    setVerifiedBooking(null);
    setVerificationStatus("idle");
    setErrorMessage("");
    setItemName("");
    setIsOfflineScan(false);
    setCheckedIn(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isMobile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              QR Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              QR code scanner is only available on mobile devices or the installed PWA app.
            </p>
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-header text-header-foreground p-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="text-header-foreground hover:bg-header-foreground/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">Scan Booking QR</h1>
        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${isOnline ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!isOnline && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="p-3 flex items-center gap-2 text-sm">
              <WifiOff className="h-4 w-4 text-yellow-600" />
              <span>Offline mode: Verifying from {cachedHostBookings.length} cached bookings</span>
            </CardContent>
          </Card>
        )}

        {scanning && verificationStatus === "idle" && (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Point your camera at the guest's booking QR code to verify their check-in
                </p>
                <div className="rounded-lg overflow-hidden">
                  <Scanner
                    onScan={handleScan}
                    onError={handleError}
                    constraints={{ facingMode: "environment" }}
                    styles={{
                      container: { width: "100%", borderRadius: "0.5rem" },
                      video: { borderRadius: "0.5rem" }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {verificationStatus === "verifying" && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Verifying booking...</p>
            </CardContent>
          </Card>
        )}

        {verificationStatus === "valid" && verifiedBooking && (
          <Card className="border-green-500">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <CardTitle className="text-green-600">Booking Verified</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Valid Check-in
                </Badge>
                {isOfflineScan && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    Offline Verified
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground">Guest Name</p>
                    <p className="font-medium">{verifiedBooking.guest_name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{verifiedBooking.guest_email}</p>
                  </div>
                </div>

                {verifiedBooking.guest_phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium">{verifiedBooking.guest_phone}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground">Visit Date</p>
                    <p className="font-medium">
                      {verifiedBooking.visit_date
                        ? format(new Date(verifiedBooking.visit_date), "MMMM d, yyyy")
                        : "Not specified"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground">Number of People</p>
                    <p className="font-medium">{verifiedBooking.slots_booked || 1} people</p>
                  </div>
                </div>

                {itemName && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Item Booked</p>
                    <p className="font-medium">{itemName}</p>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Booking ID</p>
                  <p className="font-mono text-sm">{verifiedBooking.id}</p>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="font-semibold text-lg">KES {verifiedBooking.total_amount?.toLocaleString()}</p>
                </div>
              </div>

              {/* Check-in Button */}
              {!checkedIn && !verifiedBooking.checked_in ? (
                <Button 
                  onClick={confirmCheckIn} 
                  className="w-full mt-4 bg-green-600 hover:bg-green-700"
                  disabled={isCheckingIn}
                >
                  {isCheckingIn ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Checking In...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm Check-in
                    </>
                  )}
                </Button>
              ) : (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Guest Checked In</span>
                </div>
              )}

              <Button onClick={resetScanner} variant="outline" className="w-full mt-2">
                <Camera className="h-4 w-4 mr-2" />
                Scan Another
              </Button>
            </CardContent>
          </Card>
        )}

        {(verificationStatus === "invalid" || verificationStatus === "error") && (
          <Card className="border-destructive">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <XCircle className="h-6 w-6 text-destructive" />
                <CardTitle className="text-destructive">Verification Failed</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{errorMessage}</p>
              <Button onClick={resetScanner} className="w-full">
                <Camera className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default QRScanner;
