import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Mail, Phone, Calendar, User, Eye, Edit } from "lucide-react";

const AdminReviewDetail = () => {
  const { type, id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [item, setItem] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [adminNotes, setAdminNotes] = useState("");
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
    fetchItemDetails();
  };

  const fetchItemDetails = async () => {
    try {
      let itemData: any = null;

      if (type === "trip") {
        const { data, error } = await supabase.from("trips").select("*").eq("id", id).single();
        if (error) throw error;
        itemData = data;
      } else if (type === "event") {
        const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
        if (error) throw error;
        itemData = data;
      } else if (type === "hotel") {
        const { data, error } = await supabase.from("hotels").select("*").eq("id", id).single();
        if (error) throw error;
        itemData = data;
      } else if (type === "adventure") {
        const { data, error } = await supabase.from("adventure_places").select("*").eq("id", id).single();
        if (error) throw error;
        itemData = data;
      } else if (type === "accommodation") {
        const { data, error } = await supabase.from("accommodations").select("*").eq("id", id).single();
        if (error) throw error;
        itemData = data;
      }

      if (!itemData) throw new Error("Item not found");
      
      setItem({ ...itemData, type });

      // Fetch creator profile
      if (itemData.created_by) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", itemData.created_by)
          .single();

        // Note: admin.getUserById requires service role, so we'll skip it
        setCreator({
          ...profileData
        });
      }

      // Fetch bookings
      const { data: bookingsData } = await supabase
        .from("bookings")
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

  const updateApprovalStatus = async (status: string) => {
    try {
      const updateData = {
        approval_status: status,
        approved_by: status === "approved" ? user?.id : null,
        approved_at: status === "approved" ? new Date().toISOString() : null
      };

      if (type === "trip") {
        const { error } = await supabase.from("trips").update(updateData).eq("id", id);
        if (error) throw error;
      } else if (type === "event") {
        const { error } = await supabase.from("events").update(updateData).eq("id", id);
        if (error) throw error;
      } else if (type === "hotel") {
        const { error } = await supabase.from("hotels").update(updateData).eq("id", id);
        if (error) throw error;
      } else if (type === "adventure") {
        const { error } = await supabase.from("adventure_places").update(updateData).eq("id", id);
        if (error) throw error;
      } else if (type === "accommodation") {
        const { error } = await supabase.from("accommodations").update(updateData).eq("id", id);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Item ${status} successfully`,
      });

      navigate("/admin");
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const saveAdminNotes = async () => {
    try {
      if (type === "trip") {
        const { error } = await supabase.from("trips").update({ admin_notes: adminNotes }).eq("id", id);
        if (error) throw error;
      } else if (type === "event") {
        const { error } = await supabase.from("events").update({ admin_notes: adminNotes }).eq("id", id);
        if (error) throw error;
      } else if (type === "hotel") {
        const { error } = await supabase.from("hotels").update({ admin_notes: adminNotes }).eq("id", id);
        if (error) throw error;
      } else if (type === "adventure") {
        const { error } = await supabase.from("adventure_places").update({ admin_notes: adminNotes }).eq("id", id);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Admin notes saved successfully",
      });
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pending", variant: "secondary" },
      approved: { label: "Approved", variant: "default" },
      rejected: { label: "Rejected", variant: "destructive" }
    };
    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  if (!item) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8 mb-20 md:mb-0">
        <Button variant="outline" onClick={() => navigate("/admin")} className="mb-4">
          ← Back to Admin Dashboard
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

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  {item.date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="font-medium">{new Date(item.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  )}
                  {item.price && (
                    <div>
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="font-medium">${item.price}</p>
                    </div>
                  )}
                  {item.registration_number && (
                    <div>
                      <p className="text-xs text-muted-foreground">Registration Number</p>
                      <p className="font-medium">{item.registration_number}</p>
                    </div>
                  )}
                  {item.available_tickets && (
                    <div>
                      <p className="text-xs text-muted-foreground">Available Tickets</p>
                      <p className="font-medium">{item.available_tickets}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button 
                    onClick={() => updateApprovalStatus("approved")}
                    disabled={item.approval_status === "approved"}
                    className="flex-1"
                  >
                    Approve
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => updateApprovalStatus("rejected")}
                    disabled={item.approval_status === "rejected"}
                    className="flex-1"
                  >
                    Reject
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      const publicUrl = `/${type}/${id}`;
                      window.open(publicUrl, '_blank');
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Public
                  </Button>
                </div>
              </div>
            </Card>

            {/* Action Buttons */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Actions</h3>
              <div className="space-y-3">
                <Button
                  onClick={() => updateApprovalStatus("approved")}
                  className="w-full"
                  disabled={item.approval_status === "approved"}
                >
                  Approve Listing
                </Button>
                <Button
                  onClick={() => updateApprovalStatus("rejected")}
                  variant="destructive"
                  className="w-full"
                  disabled={item.approval_status === "rejected"}
                >
                  Reject Listing
                </Button>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Creator Details */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Creator Details
              </h3>
              <div className="space-y-3">
                {creator?.name && (
                  <div>
                    <p className="text-sm font-medium">Name</p>
                    <p className="text-sm text-muted-foreground">{creator.name}</p>
                  </div>
                )}
                {creator?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${creator.email}`} className="text-sm hover:underline">
                      {creator.email}
                    </a>
                  </div>
                )}
                {creator?.phone_number && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${creator.phone_number}`} className="text-sm hover:underline">
                      {creator.phone_number}
                    </a>
                  </div>
                )}
                {creator?.gender && (
                  <div>
                    <p className="text-sm font-medium">Gender</p>
                    <p className="text-sm text-muted-foreground capitalize">{creator.gender}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Contact Information */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Listing Contact Info</h3>
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
              </div>
            </Card>

            {/* Bookings Section */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Bookings</h3>
                <Badge variant="secondary">{bookings.length}</Badge>
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
                      <p className="text-sm font-medium">${booking.total_amount}</p>
                      {booking.guest_name && (
                        <p className="text-xs text-muted-foreground">{booking.guest_name}</p>
                      )}
                      {booking.guest_email && (
                        <p className="text-xs text-muted-foreground">{booking.guest_email}</p>
                      )}
                    </div>
                  ))}
                  {bookings.length > 5 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate(`/admin/bookings/${type}/${id}`)}
                    >
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

export default AdminReviewDetail;
