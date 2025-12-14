import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Mail, Phone, User } from "lucide-react";

const AdminBookings = () => {
  const { type, id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasAdminRole = roles?.some(r => r.role === "admin");
    if (!hasAdminRole) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setIsAdmin(true);
    fetchBookings();
  };

  const fetchBookings = async () => {
    try {
      let itemData: any = null;

      if (type === "trip") {
        const { data } = await supabase.from("trips").select("id, name, image_url").eq("id", id).single();
        itemData = data;
      } else if (type === "hotel") {
        const { data } = await supabase.from("hotels").select("id, name, image_url").eq("id", id).single();
        itemData = data;
      } else if (type === "adventure") {
        const { data } = await supabase.from("adventure_places").select("id, name, image_url").eq("id", id).single();
        itemData = data;
      }

      setItem(itemData);

      const { data: bookingsData, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("item_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookings(bookingsData || []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast({
        title: "Error",
        description: "Failed to load bookings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { variant: "secondary" },
      confirmed: { variant: "default" },
      cancelled: { variant: "destructive" },
      completed: { variant: "outline" }
    };
    const config = statusMap[status] || { variant: "outline" };
    return <Badge variant={config.variant}>{status}</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { variant: "secondary" },
      paid: { variant: "default" },
      failed: { variant: "destructive" }
    };
    const config = statusMap[status || "pending"] || { variant: "outline" };
    return <Badge variant={config.variant}>{status || "pending"}</Badge>;
  };

  if (loading || !isAdmin) {
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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8 mb-20 md:mb-0">
        <Button variant="outline" onClick={() => navigate(`/admin/review/${type}/${id}`)} className="mb-4">
          ← Back to Review
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Bookings for {item?.name}</h1>
          <p className="text-muted-foreground">Total bookings: {bookings.length}</p>
        </div>

        {bookings.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No bookings found for this item.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">
                        {booking.guest_name || "Unknown"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Booking ID: {booking.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {getStatusBadge(booking.status)}
                    {getPaymentStatusBadge(booking.payment_status)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Booking Date</p>
                      <p className="text-sm">{new Date(booking.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {booking.guest_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <a href={`mailto:${booking.guest_email}`} className="text-sm hover:underline">
                          {booking.guest_email}
                        </a>
                      </div>
                    </div>
                  )}

                  {booking.guest_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <a href={`tel:${booking.guest_phone}`} className="text-sm hover:underline">
                          {booking.guest_phone}
                        </a>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                    <p className="text-lg font-bold">${booking.total_amount}</p>
                  </div>

                  {booking.slots_booked && (
                    <div>
                      <p className="text-xs text-muted-foreground">Slots Booked</p>
                      <p className="text-sm font-medium">{booking.slots_booked}</p>
                    </div>
                  )}

                  {booking.payment_method && (
                    <div>
                      <p className="text-xs text-muted-foreground">Payment Method</p>
                      <p className="text-sm capitalize">{booking.payment_method}</p>
                    </div>
                  )}
                </div>

                {booking.booking_details && (
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Booking Details</p>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32">
                      {JSON.stringify(booking.booking_details, null, 2)}
                    </pre>
                  </div>
                )}
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

export default AdminBookings;
