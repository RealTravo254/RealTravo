import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Users, MapPin } from "lucide-react";

interface Booking {
  id: string;
  booking_type: string;
  total_amount: number;
  booking_details: any;
  payment_status: string;
  status: string;
  created_at: string;
}

const Bookings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {booking.booking_details.date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(booking.booking_details.date).toLocaleDateString()}</span>
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

                    <p className="text-xs text-muted-foreground">
                      Booked on {new Date(booking.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">${booking.total_amount}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default Bookings;