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
import { Calendar, DollarSign, Users, MapPin, CalendarClock } from "lucide-react";
import { RescheduleBookingDialog } from "@/components/booking/RescheduleBookingDialog";

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

const Bookings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);

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
            <p className="text-muted-foreground mt-2">Your upcoming trips and reservations will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline">{getTypeLabel(booking.booking_type)}</Badge>
                      <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
                      <Badge className={getStatusColor(booking.payment_status)}>
                        Payment: {booking.payment_status}
                      </Badge>
                    </div>

                    <h3 className="text-xl font-semibold">
                      {booking.booking_details.trip_name || 
                       booking.booking_details.event_name || 
                       booking.booking_details.hotel_name ||
                       booking.booking_details.place_name ||
                       'Booking'}
                    </h3>

                    <p className="text-xs text-muted-foreground font-mono">
                      Booking ID: {booking.id}
                    </p>

                    <div className="flex flex-col gap-3 text-sm">
                      {/* Contact Information */}
                      {(booking.guest_name || booking.guest_email || booking.guest_phone) && (
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">Contact:</p>
                          {booking.guest_name && <p className="text-muted-foreground">Name: {booking.guest_name}</p>}
                          {booking.guest_email && <p className="text-muted-foreground">Email: {booking.guest_email}</p>}
                          {booking.guest_phone && <p className="text-muted-foreground">Phone: {booking.guest_phone}</p>}
                        </div>
                      )}

                      {/* Booking Details */}
                      <div className="flex flex-wrap gap-4 text-muted-foreground">
                        {booking.booking_details.date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(booking.booking_details.date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {booking.slots_booked && (
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{booking.slots_booked} Tickets</span>
                          </div>
                        )}
                        {(booking.booking_details.adults || booking.booking_details.children) && (
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>
                              {booking.booking_details.adults ? `${booking.booking_details.adults} Adults` : ''}
                              {booking.booking_details.children ? ` • ${booking.booking_details.children} Children` : ''}
                            </span>
                          </div>
                        )}
                        {booking.booking_details.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{booking.booking_details.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Facility Information */}
                    {(booking.booking_details.facilities || booking.booking_details.selected_facilities) && (
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Facilities Booked:</p>
                        {(booking.booking_details.facilities || booking.booking_details.selected_facilities)?.map((facility: any, idx: number) => (
                          <p key={idx} className="text-sm text-muted-foreground">
                            {facility.name} {facility.capacity ? `(Capacity: ${facility.capacity})` : ''} - KSh {facility.price}
                            {facility.startDate && facility.endDate && 
                              ` from ${new Date(facility.startDate).toLocaleDateString()} to ${new Date(facility.endDate).toLocaleDateString()}`
                            }
                          </p>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Booked on {new Date(booking.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold">KSh {booking.total_amount}</span>
                    </div>
                    
                    {booking.visit_date && booking.status !== 'cancelled' && booking.payment_status === 'paid' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRescheduleBooking(booking)}
                        className="w-fit"
                      >
                        <CalendarClock className="h-4 w-4 mr-2" />
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

      <RescheduleBookingDialog
        booking={rescheduleBooking!}
        open={!!rescheduleBooking}
        onOpenChange={(open) => !open && setRescheduleBooking(null)}
        onSuccess={fetchBookings}
      />

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default Bookings;
