import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Building, Plane, Tent, Bell, ChevronRight } from "lucide-react";

interface HostedItem {
  id: string;
  name: string;
  type: string;
  image_url: string;
  newBookingsCount: number;
}

const HostBookings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hostedItems, setHostedItems] = useState<HostedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchHostedItems = async () => {
      // Fetch user's created items
      const { data: trips } = await supabase
        .from("trips")
        .select("id, name, image_url")
        .eq("created_by", user.id);

      const { data: hotels } = await supabase
        .from("hotels")
        .select("id, name, image_url")
        .eq("created_by", user.id);

      const { data: adventures } = await supabase
        .from("adventure_places")
        .select("id, name, image_url")
        .eq("created_by", user.id);

      // Get booking counts for each item
      const allItems: HostedItem[] = [];

      if (trips) {
        for (const trip of trips) {
          const { count } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("item_id", trip.id)
            .eq("booking_type", "trip")
            .eq("payment_status", "paid");

          allItems.push({
            id: trip.id,
            name: trip.name,
            type: "trip",
            image_url: trip.image_url,
            newBookingsCount: count || 0,
          });
        }
      }

      if (hotels) {
        for (const hotel of hotels) {
          const { count } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("item_id", hotel.id)
            .eq("booking_type", "hotel")
            .eq("payment_status", "paid");

          allItems.push({
            id: hotel.id,
            name: hotel.name,
            type: "hotel",
            image_url: hotel.image_url,
            newBookingsCount: count || 0,
          });
        }
      }

      if (adventures) {
        for (const adventure of adventures) {
          const { count } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("item_id", adventure.id)
            .eq("booking_type", "adventure")
            .eq("payment_status", "paid");

          allItems.push({
            id: adventure.id,
            name: adventure.name,
            type: "adventure",
            image_url: adventure.image_url,
            newBookingsCount: count || 0,
          });
        }
      }

      setHostedItems(allItems);
      setLoading(false);
    };

    fetchHostedItems();
  }, [user, navigate]);

  const getIcon = (type: string) => {
    switch (type) {
      case "trip":
        return <Plane className="h-6 w-6" />;
      case "hotel":
        return <Building className="h-6 w-6" />;
      case "adventure":
        return <Tent className="h-6 w-6" />;
      default:
        return null;
    }
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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">My Host Bookings</h1>
              <p className="text-lg text-muted-foreground">Your hosted items</p>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {hostedItems.length} Items
            </Badge>
          </div>

          {hostedItems.length === 0 ? (
            <Card>
              <div className="p-8 text-center">
                <p className="text-muted-foreground">You are not hosting any items yet.</p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-border">
                {hostedItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/host-bookings/${item.type}/${item.id}`)}
                    className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {getIcon(item.type)}
                      <span className="font-medium text-foreground">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.newBookingsCount > 0 && (
                        <Badge className="bg-red-600 text-white flex items-center gap-1">
                          <Bell className="h-3 w-3" />
                          {item.newBookingsCount} New
                        </Badge>
                      )}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default HostBookings;
