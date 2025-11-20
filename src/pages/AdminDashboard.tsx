import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingListings, setPendingListings] = useState<any[]>([]);
  const [approvedListings, setApprovedListings] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [adminNotes, setAdminNotes] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      checkAdminRole();
    }
  }, [user]);

  const checkAdminRole = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .eq("role", "admin")
        .single();

      if (error || !data) {
        navigate("/");
        return;
      }

      setIsAdmin(true);
      fetchPendingListings();
      fetchApprovedListings();
      fetchAllBookings();
    } catch (error) {
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingListings = async () => {
    try {
      const [trips, events, hotels, adventures, accommodations] = await Promise.all([
        supabase.from("trips").select("*").eq("approval_status", "pending"),
        supabase.from("events").select("*").eq("approval_status", "pending"),
        supabase.from("hotels").select("*").eq("approval_status", "pending"),
        supabase.from("adventure_places").select("*").eq("approval_status", "pending"),
        supabase.from("accommodations").select("*").eq("approval_status", "pending")
      ]);

      if (trips.error) console.error("Error fetching trips:", trips.error);
      if (events.error) console.error("Error fetching events:", events.error);
      if (hotels.error) console.error("Error fetching hotels:", hotels.error);
      if (adventures.error) console.error("Error fetching adventures:", adventures.error);
      if (accommodations.error) console.error("Error fetching accommodations:", accommodations.error);

      const all = [
        ...(trips.data?.map(t => ({ ...t, type: "trip" })) || []),
        ...(events.data?.map(e => ({ ...e, type: "event" })) || []),
        ...(hotels.data?.map(h => ({ ...h, type: "hotel" })) || []),
        ...(adventures.data?.map(a => ({ ...a, type: "adventure" })) || []),
        ...(accommodations.data?.map(a => ({ ...a, type: "accommodation" })) || [])
      ];

      console.log("Pending listings:", { trips: trips.data?.length, events: events.data?.length, hotels: hotels.data?.length, adventures: adventures.data?.length });
      setPendingListings(all);
    } catch (error) {
      console.error("Error fetching pending listings:", error);
      toast.error("Failed to fetch pending listings");
    }
  };

  const fetchApprovedListings = async () => {
    try {
      const [trips, events, hotels, adventures, accommodations] = await Promise.all([
        supabase.from("trips").select("*").eq("approval_status", "approved"),
        supabase.from("events").select("*").eq("approval_status", "approved"),
        supabase.from("hotels").select("*").eq("approval_status", "approved"),
        supabase.from("adventure_places").select("*").eq("approval_status", "approved"),
        supabase.from("accommodations").select("*").eq("approval_status", "approved")
      ]);

      if (trips.error) console.error("Error fetching approved trips:", trips.error);
      if (events.error) console.error("Error fetching approved events:", events.error);
      if (hotels.error) console.error("Error fetching approved hotels:", hotels.error);
      if (adventures.error) console.error("Error fetching approved adventures:", adventures.error);
      if (accommodations.error) console.error("Error fetching approved accommodations:", accommodations.error);

      const all = [
        ...(trips.data?.map(t => ({ ...t, type: "trip" })) || []),
        ...(events.data?.map(e => ({ ...e, type: "event" })) || []),
        ...(hotels.data?.map(h => ({ ...h, type: "hotel" })) || []),
        ...(adventures.data?.map(a => ({ ...a, type: "adventure" })) || []),
        ...(accommodations.data?.map(a => ({ ...a, type: "accommodation" })) || [])
      ];

      console.log("Approved listings:", { trips: trips.data?.length, events: events.data?.length, hotels: hotels.data?.length, adventures: adventures.data?.length });
      setApprovedListings(all);
    } catch (error) {
      console.error("Error fetching approved listings:", error);
      toast.error("Failed to fetch approved listings");
    }
  };

  const fetchAllBookings = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setAllBookings(data);
    }
  };

  const handleApprove = async (itemId: string, itemType: string) => {
    const table = itemType === "trip" ? "trips" : itemType === "event" ? "events" : itemType === "hotel" ? "hotels" : "adventure_places";
    
    const { error } = await supabase
      .from(table)
      .update({ 
        approval_status: "approved",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        admin_notes: adminNotes[itemId] || null
      })
      .eq("id", itemId);

    if (!error) {
      toast.success("Listing approved successfully");
      fetchPendingListings();
      fetchApprovedListings();
    } else {
      toast.error("Failed to approve listing");
    }
  };

  const handleReject = async (itemId: string, itemType: string) => {
    const table = itemType === "trip" ? "trips" : itemType === "event" ? "events" : itemType === "hotel" ? "hotels" : "adventure_places";
    
    const { error } = await supabase
      .from(table)
      .update({ 
        approval_status: "rejected",
        admin_notes: adminNotes[itemId] || null
      })
      .eq("id", itemId);

    if (!error) {
      toast.success("Listing rejected");
      fetchPendingListings();
    } else {
      toast.error("Failed to reject listing");
    }
  };

  const handleToggleVisibility = async (itemId: string, itemType: string, currentlyHidden: boolean) => {
    const table = itemType === "trip" ? "trips" : itemType === "event" ? "events" : itemType === "hotel" ? "hotels" : "adventure_places";
    
    const { error } = await supabase
      .from(table)
      .update({ is_hidden: !currentlyHidden })
      .eq("id", itemId);

    if (!error) {
      toast.success(currentlyHidden ? "Listing is now visible" : "Listing is now hidden");
      fetchApprovedListings();
    } else {
      toast.error("Failed to update visibility");
    }
  };

  const getCategoryCount = (category: string, status: 'pending' | 'approved') => {
    const list = status === 'pending' ? pendingListings : approvedListings;
    return list.filter(item => item.type === category).length;
  };

  const getBookingCount = (category: string) => {
    return allBookings.filter(b => b.booking_type === category).length;
  };

  const renderListings = (category: string, status: 'pending' | 'approved') => {
    const items = status === 'pending' 
      ? pendingListings.filter(item => item.type === category)
      : approvedListings.filter(item => item.type === category);
    
    if (items.length === 0) {
      return <p className="text-muted-foreground">No {status} {category}s</p>;
    }

    return (
      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id} className="p-4 border-0">
            <div className="flex gap-4">
              <img
                src={item.image_url}
                alt={item.name}
                className="w-32 h-32 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="font-bold text-lg">{item.name}</h3>
                <p className="text-sm text-muted-foreground">{item.location}, {item.country}</p>
                {item.date && <p className="text-sm">Date: {new Date(item.date).toLocaleDateString()}</p>}
                {item.price && <p className="text-sm font-semibold">${item.price}</p>}
                {item.registration_number && <p className="text-sm">Registration: {item.registration_number}</p>}
                {item.email && <p className="text-sm">Email: {item.email}</p>}
                {item.phone_number && <p className="text-sm">Phone: {item.phone_number}</p>}
                {item.phone_numbers && item.phone_numbers.length > 0 && (
                  <p className="text-sm">Phone: {item.phone_numbers.join(", ")}</p>
                )}
                
                {status === 'pending' && (
                  <>
                    <Textarea
                      placeholder="Admin notes..."
                      value={adminNotes[item.id] || ""}
                      onChange={(e) => setAdminNotes({ ...adminNotes, [item.id]: e.target.value })}
                      className="mt-2"
                    />
                    <div className="flex gap-2 mt-3">
                      <Button onClick={() => navigate(`/admin/review/${item.type}/${item.id}`)} size="sm" variant="outline">
                        View Details
                      </Button>
                      <Button onClick={() => handleApprove(item.id, item.type)} size="sm">
                        Approve
                      </Button>
                      <Button onClick={() => handleReject(item.id, item.type)} variant="destructive" size="sm">
                        Reject
                      </Button>
                    </div>
                  </>
                )}

                {status === 'approved' && (
                  <div className="flex gap-2 mt-3">
                    <Button 
                      onClick={() => navigate(`/admin/review/${item.type}/${item.id}`)}
                      size="sm"
                      variant="outline"
                    >
                      View Details
                    </Button>
                    <Button 
                      onClick={() => handleToggleVisibility(item.id, item.type, item.is_hidden)}
                      size="sm"
                      variant={item.is_hidden ? "default" : "outline"}
                    >
                      {item.is_hidden ? "Publish" : "Hide"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderBookings = (category: string) => {
    const items = allBookings.filter(b => b.booking_type === category);
    
    if (items.length === 0) {
      return <p className="text-muted-foreground">No {category} bookings</p>;
    }

    return (
      <div className="grid gap-4">
        {items.map((booking) => (
          <Card key={booking.id} className="p-4 border-0">
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">Booking #{booking.id.slice(0, 8)}</p>
                <p className="text-sm">Amount: ${booking.total_amount}</p>
                <p className="text-sm">Status: {booking.status}</p>
                <p className="text-sm">Date: {new Date(booking.created_at).toLocaleDateString()}</p>
              </div>
              <Badge>{booking.payment_status}</Badge>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">Pending Approval</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="bookings">All Bookings</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            <div className="overflow-x-auto">
              <div className="flex gap-4 pb-4 min-w-max">
                <div className="min-w-[400px] flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Pending Trips</h2>
                    <Badge variant="outline" className="text-lg px-4 py-1">{getCategoryCount('trip', 'pending')}</Badge>
                  </div>
                  {renderListings('trip', 'pending')}
                </div>

                <div className="min-w-[400px] flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Pending Events</h2>
                    <Badge variant="outline" className="text-lg px-4 py-1">{getCategoryCount('event', 'pending')}</Badge>
                  </div>
                  {renderListings('event', 'pending')}
                </div>

                <div className="min-w-[400px] flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Pending Hotels</h2>
                    <Badge variant="outline" className="text-lg px-4 py-1">{getCategoryCount('hotel', 'pending')}</Badge>
                  </div>
                  {renderListings('hotel', 'pending')}
                </div>

                <div className="min-w-[400px] flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Pending Adventure Places</h2>
                    <Badge variant="outline" className="text-lg px-4 py-1">{getCategoryCount('adventure', 'pending')}</Badge>
                  </div>
                  {renderListings('adventure', 'pending')}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="approved" className="space-y-6">
            <div className="overflow-x-auto">
              <div className="flex gap-4 pb-4 min-w-max">
                <div className="min-w-[400px] flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Approved Trips</h2>
                    <Badge variant="outline" className="text-lg px-4 py-1">{getCategoryCount('trip', 'approved')}</Badge>
                  </div>
                  {renderListings('trip', 'approved')}
                </div>

                <div className="min-w-[400px] flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Approved Events</h2>
                    <Badge variant="outline" className="text-lg px-4 py-1">{getCategoryCount('event', 'approved')}</Badge>
                  </div>
                  {renderListings('event', 'approved')}
                </div>

                <div className="min-w-[400px] flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Approved Hotels</h2>
                    <Badge variant="outline" className="text-lg px-4 py-1">{getCategoryCount('hotel', 'approved')}</Badge>
                  </div>
                  {renderListings('hotel', 'approved')}
                </div>

                <div className="min-w-[400px] flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Approved Adventure Places</h2>
                    <Badge variant="outline" className="text-lg px-4 py-1">{getCategoryCount('adventure', 'approved')}</Badge>
                  </div>
                  {renderListings('adventure', 'approved')}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bookings" className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Trip Bookings</h2>
                <Badge variant="outline" className="text-lg px-4 py-1">{getBookingCount('trip')}</Badge>
              </div>
              {renderBookings('trip')}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Event Bookings</h2>
                <Badge variant="outline" className="text-lg px-4 py-1">{getBookingCount('event')}</Badge>
              </div>
              {renderBookings('event')}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Hotel Bookings</h2>
                <Badge variant="outline" className="text-lg px-4 py-1">{getBookingCount('hotel')}</Badge>
              </div>
              {renderBookings('hotel')}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Adventure Place Bookings</h2>
                <Badge variant="outline" className="text-lg px-4 py-1">{getBookingCount('adventure_place')}</Badge>
              </div>
              {renderBookings('adventure_place')}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default AdminDashboard;
