import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Users, MapPin, CalendarClock, X, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Booking {
  id: string;
  booking_type: string;
  total_amount: number;
  booking_details: any;
  payment_status: string;
  status: string;
  created_at: string;
}

// Booking types that support rescheduling
const RESCHEDULABLE_TYPES = ["trip", "hotel", "event", "adventure"];

const isReschedulable = (booking: Booking) => {
  const type = booking.booking_type?.toLowerCase();
  const status = booking.status?.toLowerCase();
  // Only confirmed or pending bookings can be rescheduled
  return (
    RESCHEDULABLE_TYPES.includes(type) &&
    (status === "confirmed" || status === "pending")
  );
};

// Get minimum allowed date (tomorrow)
const getTomorrow = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
};

interface RescheduleModalProps {
  booking: Booking;
  onClose: () => void;
  onConfirm: (bookingId: string, newDate: string) => Promise<void>;
}

const RescheduleModal = ({ booking, onClose, onConfirm }: RescheduleModalProps) => {
  const [newDate, setNewDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const currentDate = booking.booking_details?.date
    ? new Date(booking.booking_details.date).toISOString().split("T")[0]
    : null;

  const bookingName =
    booking.booking_details?.trip_name ||
    booking.booking_details?.event_name ||
    booking.booking_details?.hotel_name ||
    booking.booking_details?.place_name ||
    "Booking";

  const handleConfirm = async () => {
    if (!newDate) return;
    setSaving(true);
    try {
      await onConfirm(booking.id, newDate);
      setSuccess(true);
      setTimeout(() => onClose(), 1800);
    } catch (e) {
      setSaving(false);
    }
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <CheckCircle className="h-14 w-14 text-green-500" />
            <h2 className="text-xl font-bold">Rescheduled!</h2>
            <p className="text-muted-foreground">
              Your booking has been updated to{" "}
              <span className="text-foreground font-medium">
                {new Date(newDate).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              .
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Reschedule Booking</h2>
                <p className="text-sm text-muted-foreground">{bookingName}</p>
              </div>
            </div>

            {currentDate && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Current date: </span>
                {new Date(currentDate).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Select New Date
              </label>
              <input
                type="date"
                min={getTomorrow()}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full border border-border rounded-lg px-4 py-2.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!newDate || saving}
                onClick={handleConfirm}
              >
                {saving ? "Saving..." : "Confirm Reschedule"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Rescheduling may be subject to availability and cancellation policies.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

const Bookings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [reschedulingBooking, setReschedulingBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async (bookingId: string, newDate: string) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const updatedDetails = {
      ...booking.booking_details,
      date: newDate,
      rescheduled_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("bookings")
      .update({ booking_details: updatedDetails })
      .eq("id", bookingId);

    if (error) {
      toast({
        title: "Reschedule failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }

    // Update local state
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, booking_details: updatedDetails } : b
      )
    );

    toast({
      title: "Booking rescheduled",
      description: `Your booking has been moved to ${new Date(newDate).toLocaleDateString()}.`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-500/10 text-green-500";
      case "pending": return "bg-yellow-500/10 text-yellow-500";
      case "cancelled": return "bg-red-500/10 text-red-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  const getTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header />
        <main className="container px-4 py-8">
          <p>Loading...</p>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />

      <main className="container px-4 py-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">My Bookings</h1>

        {bookings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">No bookings yet</p>
            <p className="text-muted-foreground mt-2">
              Your upcoming trips and reservations will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline">{getTypeLabel(booking.booking_type)}</Badge>
                      <Badge className={getStatusColor(booking.status)}>
                        {booking.status}
                      </Badge>
                      <Badge className={getStatusColor(booking.payment_status)}>
                        Payment: {booking.payment_status}
                      </Badge>
                      {booking.booking_details?.rescheduled_at && (
                        <Badge className="bg-blue-500/10 text-blue-500">
                          Rescheduled
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-xl font-semibold">
                      {booking.booking_details?.trip_name ||
                        booking.booking_details?.event_name ||
                        booking.booking_details?.hotel_name ||
                        booking.booking_details?.place_name ||
                        "Booking"}
                    </h3>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {booking.booking_details?.date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(booking.booking_details.date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {(booking.booking_details?.adults || booking.booking_details?.children) && (
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>
                            {booking.booking_details.adults
                              ? `${booking.booking_details.adults} Adults`
                              : ""}
                            {booking.booking_details.children
                              ? ` • ${booking.booking_details.children} Children`
                              : ""}
                          </span>
                        </div>
                      )}
                      {booking.booking_details?.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{booking.booking_details.location}</span>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Booked on {new Date(booking.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold">${booking.total_amount}</span>
                    </div>

                    {/* Reschedule button — only for eligible bookings */}
                    {isReschedulable(booking) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => setReschedulingBooking(booking)}
                      >
                        <CalendarClock className="h-4 w-4" />
                        Reschedule
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
      <MobileBottomBar />

      {/* Reschedule Modal */}
      {reschedulingBooking && (
        <RescheduleModal
          booking={reschedulingBooking}
          onClose={() => setReschedulingBooking(null)}
          onConfirm={handleReschedule}
        />
      )}
    </div>
  );
};

export default Bookings;