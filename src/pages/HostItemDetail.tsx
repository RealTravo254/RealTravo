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
import { Edit, Eye, MapPin, Mail, Phone, Calendar, Download } from "lucide-react";
import { exportBookingsToCSV } from "@/lib/csvExport";

const HostItemDetail = () => {
  const { itemType: type, id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [item, setItem] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchItemDetails();
  }, [type, id, user]);

  const fetchItemDetails = async () => {
    try {
      if (type === "trip") {
        const { data: itemData, error: itemError } = await supabase
          .from("trips")
          .select("*")
          .eq("id", id)
          .single();
        if (itemError) throw itemError;
        if (itemData.created_by !== user.id) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to view this item",
            variant: "destructive",
          });
          navigate("/become-host");
          return;
        }
        setItem({ ...itemData, type });
      } else if (type === "hotel") {
        const { data: itemData, error: itemError } = await supabase
          .from("hotels")
          .select("*")
          .eq("id", id)
          .single();
        if (itemError) throw itemError;
        if (itemData.created_by !== user.id) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to view this item",
            variant: "destructive",
          });
          navigate("/become-host");
          return;
        }
        setItem({ ...itemData, type });
      } else if (type === "adventure") {
        const { data: itemData, error: itemError } = await supabase
          .from("adventure_places")
          .select("*")
          .eq("id", id)
          .single();
        if (itemError) throw itemError;
        if (itemData.created_by !== user.id) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to view this item",
            variant: "destructive",
          });
          navigate("/become-host");
          return;
        }
        setItem({ ...itemData, type });
      }

      // Fetch bookings
      const { data: bookingsData } = await supabase
        .from("creator_booking_summary")
        .select("*")
        .eq("item_id", id)
        .order("created_at", { ascending: false });

      setBookings(bookingsData || []);
    } catch (error) {
      console.error("Error fetching item:", error);
      toast({
        title: "Error",
        description: "Failed to load item details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

  if (!item) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8 mb-20 md:mb-0">
        <Button variant="outline" onClick={() => navigate("/become-host")} className="mb-4">
          ← Back to My Listings
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden">
              <div className="aspect-video relative">
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 right-4">
                  {getStatusBadge(item.approval_status)}
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{item.name}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{item.location}, {item.place}, {item.country}</span>
                  </div>
                </div>

                {item.description && (
                  <div>
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={() => navigate(`/edit-listing/${type}/${id}`)} className="flex-1">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Listing
                  </Button>
                  <Button variant="outline" onClick={() => {
                    const publicUrl = `/${type}/${id}`;
                    window.open(publicUrl, '_blank');
                  }} className="flex-1">
                    <Eye className="h-4 w-4 mr-2" />
                    View Public Page
                  </Button>
                </div>
              </div>
            </Card>

            {/* Admin Notes */}
            {item.admin_notes && (
              <Card className="p-6">
                <h3 className="font-semibold mb-2 text-destructive">Admin Notes</h3>
                <p className="text-muted-foreground">{item.admin_notes}</p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Contact Information</h3>
              <div className="space-y-3">
                {item.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{item.email}</span>
                  </div>
                )}
                {(item.phone_number || item.phone_numbers) && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {item.phone_number || item.phone_numbers?.[0] || "N/A"}
                    </span>
                  </div>
                )}
                {item.registration_number && (
                  <div>
                    <p className="text-sm font-medium">Registration Number</p>
                    <p className="text-sm text-muted-foreground">{item.registration_number}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Bookings Section */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Bookings</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{bookings.length}</Badge>
                  {bookings.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => exportBookingsToCSV(bookings, item.name)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      CSV
                    </Button>
                  )}
                </div>
              </div>
              
              {bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No bookings yet
                </p>
              ) : (
                <div className="space-y-3">
                  {bookings.slice(0, 5).map((booking) => (
                    <div key={booking.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                          {booking.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(booking.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">KES {booking.total_amount?.toLocaleString()}</p>
                      {booking.guest_name_masked && (
                        <p className="text-xs text-muted-foreground">{booking.guest_name_masked}</p>
                      )}
                    </div>
                  ))}
                  {bookings.length > 5 && (
                    <Button variant="outline" size="sm" className="w-full">
                      View All Bookings ({bookings.length})
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default HostItemDetail;
