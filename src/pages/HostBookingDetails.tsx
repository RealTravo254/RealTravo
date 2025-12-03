import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Mail, Phone, Calendar, Users, DollarSign } from "lucide-react";

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
  is_guest_booking: boolean;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
}

const HostBookingDetails = () => {
  const { itemType: type, id: itemId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [itemName, setItemName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchBookings = async () => {
      // Verify ownership
      let ownershipQuery;
      if (type === "trip") {
        ownershipQuery = supabase.from("trips").select("name, created_by").eq("id", itemId).single();
      } else if (type === "hotel") {
        ownershipQuery = supabase.from("hotels").select("name, created_by").eq("id", itemId).single();
      } else if (type === "adventure") {
        ownershipQuery = supabase.from("adventure_places").select("name, created_by").eq("id", itemId).single();
      }

      if (!ownershipQuery) {
        navigate("/host-bookings");
        return;
      }

      const { data: item } = await ownershipQuery;
      if (!item || item.created_by !== user.id) {
        navigate("/host-bookings");
        return;
      }

      setItemName(item.name);

      // Fetch paid bookings only (hosts can only see confirmed paid bookings)
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("*")
        .eq("item_id", itemId)
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false });

      if (bookingsData) {
        // Fetch user details for non-guest bookings
        const enrichedBookings = await Promise.all(
          bookingsData.map(async (booking) => {
            if (!booking.is_guest_booking && booking.user_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("name, email, phone_number")
                .eq("id", booking.user_id)
                .single();

              return {
                ...booking,
                userName: profile?.name || "N/A",
                userEmail: profile?.email || "N/A",
                userPhone: profile?.phone_number || "N/A",
              };
            }
            return booking;
          })
        );

        setBookings(enrichedBookings);
      }

      setLoading(false);
    };

    fetchBookings();
  }, [user, type, itemId, navigate]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any }> = {
      pending: { label: "Pending", variant: "secondary" },
      confirmed: { label: "Confirmed", variant: "default" },
      cancelled: { label: "Cancelled", variant: "destructive" },
      completed: { label: "Completed", variant: "outline" },
    };
    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8">
          <p className="text-center">Loading...</p>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      <Header />
      <main className="flex-1 container px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Bookings for {itemName}</h1>
          <p className="text-muted-foreground">Total Bookings: {bookings.length}</p>
        </div>

        {bookings.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No bookings yet.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">
                      {booking.is_guest_booking ? booking.guest_name : booking.userName}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {booking.is_guest_booking ? "Guest Booking" : "Registered User"}
                    </p>
                  </div>
                  {getStatusBadge(booking.status)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">
                        {booking.is_guest_booking ? booking.guest_email : booking.userEmail}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">
                        {booking.is_guest_booking ? booking.guest_phone : booking.userPhone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="font-medium">KSh {booking.total_amount}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Booked On</p>
                      <p className="font-medium">
                        {format(new Date(booking.created_at), "PPP")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Number of People</p>
                      <p className="font-medium">{booking.slots_booked}</p>
                    </div>
                  </div>

                  {booking.visit_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Visit Date</p>
                        <p className="font-medium">
                          {format(new Date(booking.visit_date), "PPP")}
                        </p>
                      </div>
                    </div>
                  )}
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

export default HostBookingDetails;
