import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const MyContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [myContent, setMyContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchData = async () => {
      // Fetch user's created content with approval status
      const { data: trips } = await supabase
        .from("trips")
        .select("*, bookings(*)")
        .eq("created_by", user.id);

      const { data: events } = await supabase
        .from("events")
        .select("*, bookings(*)")
        .eq("created_by", user.id);

      const { data: hotels } = await supabase
        .from("hotels")
        .select("*, bookings(*)")
        .eq("created_by", user.id);

      const { data: adventures } = await supabase
        .from("adventure_places")
        .select("*, bookings(*)")
        .eq("created_by", user.id);

      // Combine all content with type labels
      const allContent = [
        ...(trips?.map(t => ({ ...t, type: "trip" })) || []),
        ...(events?.map(e => ({ ...e, type: "event" })) || []),
        ...(hotels?.map(h => ({ ...h, type: "hotel" })) || []),
        ...(adventures?.map(a => ({ ...a, type: "adventure" })) || [])
      ];

      setMyContent(allContent);

      // Fetch all bookings
      const allIds = allContent.map(c => c.id);
      if (allIds.length > 0) {
        const { data } = await supabase
          .from("bookings")
          .select("*")
          .in("item_id", allIds)
          .order("created_at", { ascending: false });

        setBookings(data || []);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Content & Bookings</h1>

        <Tabs defaultValue="content" className="w-full">
          <TabsList>
            <TabsTrigger value="content">My Listings</TabsTrigger>
            <TabsTrigger value="bookings">Received Bookings</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            {loading ? (
              <p>Loading...</p>
            ) : myContent.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                No content created yet
              </Card>
            ) : (
              myContent.map((item) => (
                <Card key={item.id} className="p-6">
                  <div className="flex gap-4">
                    <img 
                      src={item.image_url} 
                      alt={item.name}
                      className="w-32 h-32 object-cover rounded"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold">{item.name}</h3>
                        <Badge className="capitalize">{item.type}</Badge>
                      </div>
                      <p className="text-sm"><span className="font-medium">Location:</span> {item.location}, {item.country}</p>
                      <p className="text-sm"><span className="font-medium">Phone:</span> {item.phone_number || item.phone_numbers?.[0] || "N/A"}</p>
                      <p className="text-sm"><span className="font-medium">Email:</span> {item.email || "N/A"}</p>
                      {item.registration_number && (
                        <p className="text-sm"><span className="font-medium">Registration #:</span> {item.registration_number}</p>
                      )}
                      <p className="text-sm">
                        <span className="font-medium">Status:</span>{" "}
                        <Badge variant={
                          item.approval_status === 'approved' ? 'default' :
                          item.approval_status === 'pending' ? 'secondary' :
                          'destructive'
                        }>
                          {item.approval_status}
                        </Badge>
                      </p>
                      <p className="text-sm"><span className="font-medium">Total Bookings:</span> {item.bookings?.length || 0}</p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="bookings" className="space-y-4">
            {loading ? (
              <p>Loading...</p>
            ) : bookings.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                No bookings yet
              </Card>
            ) : (
              bookings.map((booking) => (
                <Card key={booking.id} className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Booking ID</p>
                      <p className="font-medium">{booking.id.slice(0, 8)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Guest Name</p>
                      <p className="font-medium">{booking.guest_name || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="font-medium">${booking.total_amount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Slots</p>
                      <p className="font-medium">{booking.slots_booked || 1}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-medium">{new Date(booking.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-medium capitalize">{booking.status}</p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default MyContent;
