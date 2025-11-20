import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plane, Building, Tent, Eye, Edit, Package } from "lucide-react";

const BecomeHost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [myContent, setMyContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchData = async () => {
      const { data: trips } = await supabase.from("trips").select("*").eq("created_by", user.id);
      const { data: events } = await supabase.from("events").select("*").eq("created_by", user.id);
      const { data: hotels } = await supabase.from("hotels").select("id, name, location, place, country, image_url, description, email, phone_numbers, amenities, establishment_type, map_link, gallery_images, images, approval_status, admin_notes, created_at, created_by, approved_by, approved_at, is_hidden, registration_number, facilities").eq("created_by", user.id);
      const { data: adventures } = await supabase.from("adventure_places").select("id, name, location, place, country, image_url, description, email, phone_numbers, amenities, activities, facilities, entry_fee, entry_fee_type, map_link, gallery_images, images, approval_status, admin_notes, created_at, created_by, approved_by, approved_at, is_hidden, registration_number").eq("created_by", user.id);
      const { data: accommodations } = await supabase.from("accommodations").select("*").eq("created_by", user.id);

      const allContent = [
        ...(trips?.map(t => ({ ...t, type: "trip" })) || []),
        ...(events?.map(e => ({ ...e, type: "event" })) || []),
        ...(hotels?.map(h => ({ ...h, type: "hotel" })) || []),
        ...(adventures?.map(a => ({ ...a, type: "adventure" })) || []),
        ...(accommodations?.map(a => ({ ...a, type: "accommodation" })) || [])
      ];

      setMyContent(allContent);
      setLoading(false);
    };

    fetchData();
  }, [user, navigate]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pending", variant: "secondary" },
      approved: { label: "Approved", variant: "default" },
      rejected: { label: "Rejected", variant: "destructive" },
      removed: { label: "Removed", variant: "outline" },
      banned: { label: "Banned", variant: "destructive" }
    };
    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const viewItemDetails = (item: any) => {
    navigate(`/host-item/${item.type}/${item.id}`);
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
      <main className="flex-1 container px-4 py-8 mb-20 md:mb-0">
        <h1 className="text-3xl font-bold mb-6">Become a Host</h1>

        {/* Create New Content Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/CreateTripEvent")}>
            <div className="flex flex-col items-center text-center space-y-3">
              <Plane className="h-12 w-12 text-blue-600" />
              <h3 className="font-semibold text-lg">Create Trip or Event</h3>
              <p className="text-sm text-muted-foreground">Organize trips and events for travelers</p>
              <Button className="w-full">Create Now</Button>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/CreateHotel")}>
            <div className="flex flex-col items-center text-center space-y-3">
              <Building className="h-12 w-12 text-green-600" />
              <h3 className="font-semibold text-lg">Create Hotel</h3>
              <p className="text-sm text-muted-foreground">List your hotel property</p>
              <Button className="w-full">Create Now</Button>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/CreateAccommodation")}>
            <div className="flex flex-col items-center text-center space-y-3">
              <Package className="h-12 w-12 text-purple-600" />
              <h3 className="font-semibold text-lg">Create Accommodation</h3>
              <p className="text-sm text-muted-foreground">List unique stays like tents, cabins, etc.</p>
              <Button className="w-full">Create Now</Button>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/CreateAdventure")}>
            <div className="flex flex-col items-center text-center space-y-3">
              <Tent className="h-12 w-12 text-orange-600" />
              <h3 className="font-semibold text-lg">Create Adventure Place</h3>
              <p className="text-sm text-muted-foreground">List adventure places and experiences</p>
              <Button className="w-full">Create Now</Button>
            </div>
          </Card>
        </div>

        {/* My Created Items Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-6 w-6" />
            <h2 className="text-2xl font-bold">My Created Items ({myContent.length})</h2>
          </div>

          {myContent.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">You haven't created any items yet. Start by creating your first listing above!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myContent.map((item) => (
                <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video relative">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      {getStatusBadge(item.approval_status)}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-2 line-clamp-1">{item.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.description || "No description"}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewItemDetails(item)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/edit-listing/${item.type}/${item.id}`)}
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default BecomeHost;
