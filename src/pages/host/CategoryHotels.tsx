import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Building, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Hotel {
  id: string;
  name: string;
  location: string;
  approval_status: string;
  is_hidden?: boolean;
  created_at: string;
}

const CategoryHotels = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchHotels();
  }, [user, navigate]);

  const fetchHotels = async () => {
    try {
      const { data, error } = await supabase
        .from("hotels")
        .select("id, name, location, approval_status, is_hidden, created_at")
        .eq("created_by", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHotels(data || []);
    } catch (error) {
      console.error("Error fetching hotels:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, isHidden?: boolean) => {
    if (isHidden) {
      return <Badge variant="outline">Hidden from Public View</Badge>;
    }
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      pending: { label: "Pending", variant: "secondary" },
      approved: { label: "Approved", variant: "default" },
      rejected: { label: "Rejected", variant: "destructive" },
    };
    const config = statusMap[status] || { label: status, variant: "secondary" };
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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8 max-w-4xl mx-auto mb-20 md:mb-0">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Hotels</h1>
          {hotels.length > 0 && (
            <Button onClick={() => navigate("/create-hotel")} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Hotel
            </Button>
          )}
        </div>

        {hotels.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">You haven't created any hotels yet</p>
            <button
              onClick={() => navigate("/CreateHotel")}
              className="text-primary hover:underline"
            >
              Create your first hotel
            </button>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-border">
              {hotels.map((hotel) => (
                <button
                  key={hotel.id}
                  onClick={() => navigate(`/edit-listing/hotel/${hotel.id}`)}
                  className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <p className="font-medium text-foreground">{hotel.name}</p>
                      <p className="text-sm text-muted-foreground">{hotel.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(hotel.approval_status, hotel.is_hidden)}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default CategoryHotels;
