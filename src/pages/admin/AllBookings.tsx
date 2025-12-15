import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Mail, Phone, User, Search, ArrowLeft, MapPin, Clock } from "lucide-react";

interface Booking {
  id: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  total_amount: number;
  slots_booked: number | null;
  booking_type: string;
  item_id: string;
  visit_date: string | null;
  created_at: string;
  booking_details: any;
}

interface ItemDetails {
  name: string;
  type: string;
}

const AllBookings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [itemDetails, setItemDetails] = useState<Record<string, ItemDetails>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = bookings.filter(booking => 
        booking.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.guest_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.guest_email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredBookings(filtered);
      
      // Auto-select if exact match found
      const exactMatch = bookings.find(b => b.id.toLowerCase() === searchQuery.toLowerCase());
      if (exactMatch) {
        setSelectedBooking(exactMatch);
      }
    } else {
      setFilteredBookings(bookings);
      setSelectedBooking(null);
    }
  }, [searchQuery, bookings]);

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
    fetchAllBookings();
  };

  const fetchAllBookings = async () => {
    try {
      const { data: bookingsData, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookings(bookingsData || []);
      setFilteredBookings(bookingsData || []);

      // Fetch item details for all bookings
      const itemIds = [...new Set(bookingsData?.map(b => ({ id: b.item_id, type: b.booking_type })) || [])];
      await fetchItemDetails(itemIds);
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

  const fetchItemDetails = async (items: { id: string; type: string }[]) => {
    const details: Record<string, ItemDetails> = {};

    for (const item of items) {
      try {
        let data: any = null;
        if (item.type === "trip" || item.type === "event") {
          const { data: tripData } = await supabase
            .from("trips")
            .select("name")
            .eq("id", item.id)
            .single();
          data = tripData;
        } else if (item.type === "hotel") {
          const { data: hotelData } = await supabase
            .from("hotels")
            .select("name")
            .eq("id", item.id)
            .single();
          data = hotelData;
        } else if (item.type === "adventure" || item.type === "adventure_place") {
          const { data: adventureData } = await supabase
            .from("adventure_places")
            .select("name")
            .eq("id", item.id)
            .single();
          data = adventureData;
        } else if (item.type === "attraction") {
          // Attractions table doesn't exist - skip
          data = null;
        }

        if (data) {
          details[item.id] = { name: data.name, type: item.type };
        }
      } catch (error) {
        console.error("Error fetching item details:", error);
      }
    }

    setItemDetails(details);
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
      completed: { variant: "default" },
      failed: { variant: "destructive" }
    };
    const config = statusMap[status || "pending"] || { variant: "outline" };
    return <Badge variant={config.variant}>{status || "pending"}</Badge>;
  };

  const getBookingTypeBadge = (type: string) => {
    const typeLabels: Record<string, string> = {
      trip: "Trip",
      event: "Event",
      hotel: "Hotel",
      adventure: "Adventure",
      adventure_place: "Adventure",
      attraction: "Attraction"
    };
    return <Badge variant="outline">{typeLabels[type] || type}</Badge>;
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8 mb-20 md:mb-0 max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Admin
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">All Bookings</h1>
          <p className="text-muted-foreground">Total bookings: {bookings.length}</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Booking ID, Name, or Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Selected Booking Detail View */}
        {selectedBooking && (
          <Card className="p-6 mb-6 border-primary">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Booking Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedBooking(null)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Booking Info */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Booking ID</p>
                  <p className="font-mono text-sm">{selectedBooking.id}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex gap-2 mt-1">
                    {getStatusBadge(selectedBooking.status)}
                    {getPaymentStatusBadge(selectedBooking.payment_status || "pending")}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Item Booked</p>
                  <p className="font-medium">
                    {itemDetails[selectedBooking.item_id]?.name || "Unknown Item"}
                  </p>
                  {getBookingTypeBadge(selectedBooking.booking_type)}
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Booking Date</p>
                    <p>{new Date(selectedBooking.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {selectedBooking.visit_date && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Visit Date</p>
                      <p>{new Date(selectedBooking.visit_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold text-primary">KES {selectedBooking.total_amount}</p>
                </div>

                {selectedBooking.slots_booked && (
                  <div>
                    <p className="text-sm text-muted-foreground">Slots Booked</p>
                    <p className="font-medium">{selectedBooking.slots_booked}</p>
                  </div>
                )}

                {selectedBooking.payment_method && (
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="capitalize">{selectedBooking.payment_method}</p>
                  </div>
                )}
              </div>

              {/* Guest Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Guest Information</h3>

                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedBooking.guest_name || "Not provided"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    {selectedBooking.guest_email ? (
                      <a href={`mailto:${selectedBooking.guest_email}`} className="font-medium text-primary hover:underline">
                        {selectedBooking.guest_email}
                      </a>
                    ) : (
                      <p>Not provided</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone Number</p>
                    {selectedBooking.guest_phone ? (
                      <a href={`tel:${selectedBooking.guest_phone}`} className="font-medium text-primary hover:underline">
                        {selectedBooking.guest_phone}
                      </a>
                    ) : (
                      <p>Not provided</p>
                    )}
                  </div>
                </div>

                {selectedBooking.booking_details && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Additional Details</p>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                      {JSON.stringify(selectedBooking.booking_details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? "No bookings found matching your search." : "No bookings found."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredBookings.map((booking) => (
              <Card 
                key={booking.id} 
                className={`p-4 cursor-pointer hover:bg-accent/50 transition-colors ${selectedBooking?.id === booking.id ? 'border-primary' : ''}`}
                onClick={() => setSelectedBooking(booking)}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-semibold">{booking.guest_name || "Unknown Guest"}</p>
                      <p className="text-xs text-muted-foreground font-mono">ID: {booking.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {getBookingTypeBadge(booking.booking_type)}
                    {getStatusBadge(booking.status)}
                    {getPaymentStatusBadge(booking.payment_status || "pending")}
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-primary">KES {booking.total_amount}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(booking.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {itemDetails[booking.item_id]?.name || "Loading..."}
                  </span>
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

export default AllBookings;