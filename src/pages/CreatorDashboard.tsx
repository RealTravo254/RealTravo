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
import { Calendar, Users, Mail, Phone } from "lucide-react";

const CreatorDashboard = () => {
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
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userEmail = currentUser?.email;

      const { data: trips } = await supabase.from("trips").select("*").eq("created_by", user.id);
      const { data: hotels } = await supabase.from("hotels").select("*").eq("created_by", user.id);
      const { data: adventures } = await supabase.from("adventure_places").select("*").eq("created_by", user.id);
      
      const { data: hotelsAsAdmin } = await supabase.from("hotels").select("*").contains("allowed_admin_emails", userEmail ? [userEmail] : []);
      const { data: adventuresAsAdmin } = await supabase.from("adventure_places").select("*").contains("allowed_admin_emails", userEmail ? [userEmail] : []);

      const allContent = [
        ...(trips?.map(t => ({ ...t, type: "trip" })) || []),
        ...(hotels?.map(h => ({ ...h, type: "hotel" })) || []),
        ...(adventures?.map(a => ({ ...a, type: "adventure_place" })) || []),
        ...(hotelsAsAdmin?.filter(h => h.created_by !== user.id).map(h => ({ ...h, type: "hotel" })) || []),
        ...(adventuresAsAdmin?.filter(a => a.created_by !== user.id).map(a => ({ ...a, type: "adventure_place" })) || [])
      ];

      setMyContent(allContent);

      const allIds = allContent.map(c => c.id);
      if (allIds.length > 0) {
        const { data } = await supabase
          .from("creator_booking_summary")
          .select("*")
          .in("item_id", allIds)
          .eq("payment_status", "paid")
          .order("created_at", { ascending: false });
        setBookings(data || []);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [user, navigate]);

  const getBookingsByType = (type: string) => {
    return bookings.filter(b => b.booking_type === type);
  };

  const renderBookings = (type: string, title: string) => {
    const items = getBookingsByType(type);
    
    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No confirmed {title.toLowerCase()} yet
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {items.map((booking) => {
          const details = booking.booking_details as any;
          return (
            <Card key={booking.id} className="p-4 md:p-6 hover:shadow-lg transition-shadow">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{details?.hotel_name || details?.place_name || details?.trip_name || "Booking"}</h3>
                    <p className="text-sm text-muted-foreground">Booking ID: {booking.id.slice(0, 8)}</p>
                  </div>
                  <Badge variant="default">${booking.total_amount}</Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-4 pt-3 border-t">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-medium">Guest:</span>
                      <span>{booking.guest_name_masked || "Registered User"}</span>
                    </div>
                    
                    {booking.guest_email_limited && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-primary" />
                        <span>{booking.guest_email_limited}</span>
                      </div>
                    )}
                    
                    {booking.guest_phone_limited && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-primary" />
                        <span>{booking.guest_phone_limited}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-medium">Booked:</span>
                      <span>{new Date(booking.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    {details?.adults !== undefined && (
                      <div className="text-sm">
                        <span className="font-medium">Guests:</span> {details.adults} Adult(s), {details.children || 0} Child(ren)
                      </div>
                    )}
                    
                    {details?.date && (
                      <div className="text-sm">
                        <span className="font-medium">Visit Date:</span> {new Date(details.date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                {details?.activities && details.activities.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-1">Selected Activities:</p>
                    <div className="flex flex-wrap gap-2">
                      {details.activities.map((activity: any, idx: number) => (
                        <Badge key={idx} variant="secondary">{activity.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {details?.facilities && details.facilities.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-1">Selected Facilities:</p>
                    <div className="flex flex-wrap gap-2">
                      {details.facilities.map((facility: any, idx: number) => (
                        <Badge key={idx} variant="secondary">{facility.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {details?.trip_note && (
                  <div className="pt-2 border-t">
                    <p className="text-sm"><span className="font-medium">Note:</span> {details.trip_note}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Badge variant="outline">{booking.payment_method}</Badge>
                  <Badge variant={booking.payment_status === 'completed' ? 'default' : 'secondary'}>
                    {booking.payment_status}
                  </Badge>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Creator Dashboard</h1>
        <p className="text-muted-foreground mb-8">View all confirmed bookings for your listings</p>

        <Tabs defaultValue="trips" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trips">Trips</TabsTrigger>
            <TabsTrigger value="hotels">Hotels</TabsTrigger>
            <TabsTrigger value="campsites">Campsites</TabsTrigger>
          </TabsList>

          <TabsContent value="trips" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Trip Bookings</h2>
              <Badge variant="outline" className="text-lg px-4 py-1">
                {getBookingsByType('trip').length}
              </Badge>
            </div>
            {renderBookings('trip', 'Trip Bookings')}
          </TabsContent>

          <TabsContent value="hotels" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Hotel Bookings</h2>
              <Badge variant="outline" className="text-lg px-4 py-1">
                {getBookingsByType('hotel').length}
              </Badge>
            </div>
            {renderBookings('hotel', 'Hotel Bookings')}
          </TabsContent>

          <TabsContent value="campsites" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Campsite & Experience Bookings</h2>
              <Badge variant="outline" className="text-lg px-4 py-1">
                {getBookingsByType('adventure_place').length}
              </Badge>
            </div>
            {renderBookings('adventure_place', 'Campsite & Experience Bookings')}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default CreatorDashboard;
