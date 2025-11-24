import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Mail, Phone, Calendar, User, Eye, Clock, DollarSign } from "lucide-react";

const AdminReviewDetail = () => {
  const { type, id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [item, setItem] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const rejectionReasons = [
    "No visible items",
    "Details don't match",
    "Inappropriate details",
    "Document not visible",
    "False information",
  ];

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
      let tableName = "";

      if (type === "trip") {
        tableName = "trips";
        const { data, error } = await supabase.from("trips").select("*").eq("id", id).single();
        if (error) throw error;
        itemData = data;
      } else if (type === "hotel") {
        tableName = "hotels";
        const { data, error } = await supabase.from("hotels").select("*").eq("id", id).single();
        if (error) throw error;
        itemData = data;
      } else if (type === "adventure") {
        tableName = "adventure_places";
        const { data, error } = await supabase.from("adventure_places").select("*").eq("id", id).single();
        if (error) throw error;
        itemData = data;
      } else if (type === "attraction") {
        tableName = "attractions";
        const { data, error } = await supabase.from("attractions").select("*").eq("id", id).single();
        if (error) throw error;
        itemData = data;
      }

      if (!itemData) throw new Error("Item not found");
      
      setItem({ ...itemData, type, tableName });

      // Fetch creator profile
      if (itemData.created_by) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", itemData.created_by)
          .single();

        setCreator(profileData);
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
      if (status === "rejected" && !rejectionReason) {
        toast({
          title: "Rejection Reason Required",
          description: "Please select a reason for rejection",
          variant: "destructive",
        });
        return;
      }

      const updateData: any = {
        approval_status: status,
        approved_by: status === "approved" ? user?.id : null,
        approved_at: status === "approved" ? new Date().toISOString() : null
      };


      const tableName = item.tableName;
      const { error } = await supabase.from(tableName).update(updateData).eq("id", id);
      if (error) throw error;

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

  const displayImages = item.gallery_images?.length > 0 
    ? item.gallery_images 
    : item.images?.length > 0 
    ? item.images 
    : item.photo_urls?.length > 0
    ? item.photo_urls
    : [item.image_url];

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
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold mb-2">{item.name}</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{item.location || item.location_name}, {item.place || ""} {item.country}</span>
                    </div>
                  </div>
                  {getStatusBadge(item.approval_status)}
                </div>

                {item.description && (
                  <div>
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                )}

                {/* Details Grid */}
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
                  {(item.price || item.entry_fee) && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Price</p>
                        <p className="font-medium">${item.price || item.entry_fee}</p>
                      </div>
                    </div>
                  )}
                  {item.price_adult && (
                    <div>
                      <p className="text-xs text-muted-foreground">Adult Price</p>
                      <p className="font-medium">${item.price_adult}</p>
                    </div>
                  )}
                  {item.price_child && (
                    <div>
                      <p className="text-xs text-muted-foreground">Child Price</p>
                      <p className="font-medium">${item.price_child}</p>
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
                  {item.opening_hours && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Opening Hours</p>
                        <p className="font-medium">{item.opening_hours}</p>
                      </div>
                    </div>
                  )}
                  {item.closing_hours && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Closing Hours</p>
                        <p className="font-medium">{item.closing_hours}</p>
                      </div>
                    </div>
                  )}
                  {item.entrance_type && (
                    <div>
                      <p className="text-xs text-muted-foreground">Entrance</p>
                      <p className="font-medium capitalize">{item.entrance_type}</p>
                    </div>
                  )}
                  {item.entry_fee_type && (
                    <div>
                      <p className="text-xs text-muted-foreground">Entry Fee</p>
                      <p className="font-medium capitalize">{item.entry_fee_type}</p>
                    </div>
                  )}
                  {item.establishment_type && (
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="font-medium capitalize">{item.establishment_type}</p>
                    </div>
                  )}
                </div>

                {/* Facilities */}
                {item.facilities && item.facilities.length > 0 && (
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-2">Facilities</h3>
                    <div className="grid gap-2">
                      {item.facilities.map((facility: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-accent rounded">
                          <span>{facility.name}</span>
                          <span className="font-medium">${facility.price || facility.price_per_day}/day - Cap: {facility.capacity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activities */}
                {item.activities && item.activities.length > 0 && (
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-2">Activities</h3>
                    <div className="grid gap-2">
                      {item.activities.map((activity: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-accent rounded">
                          <span>{activity.name}</span>
                          <span className="font-medium">${activity.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amenities */}
                {item.amenities && item.amenities.length > 0 && (
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-2">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {item.amenities.map((amenity: string, idx: number) => (
                        <Badge key={idx} variant="outline">{amenity}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rejection Section - Only show for pending items */}
                {item.approval_status === "pending" && (
                  <div className="pt-4 border-t space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Rejection Reason (if rejecting)</label>
                      <Select value={rejectionReason} onValueChange={setRejectionReason}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason for rejection" />
                        </SelectTrigger>
                        <SelectContent>
                          {rejectionReasons.map((reason) => (
                            <SelectItem key={reason} value={reason}>
                              {reason}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}


                {/* Visibility control for approved items */}
                {item.approval_status === "approved" && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                      <div>
                        <p className="font-medium">Public Visibility</p>
                        <p className="text-sm text-muted-foreground">
                          {item.is_hidden ? "This item is hidden from public" : "This item is visible to public"}
                        </p>
                      </div>
                      <Button 
                        variant={item.is_hidden ? "default" : "outline"}
                        onClick={async () => {
                          const { error } = await supabase
                            .from(item.tableName)
                            .update({ is_hidden: !item.is_hidden })
                            .eq("id", id);
                          
                          if (!error) {
                            toast({
                              title: "Success",
                              description: item.is_hidden ? "Item is now visible to public" : "Item is now hidden from public",
                            });
                            fetchItemDetails();
                          } else {
                            toast({
                              title: "Error",
                              description: "Failed to update visibility",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        {item.is_hidden ? "Publish" : "Hide"}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t">
                  <Button 
                    onClick={() => updateApprovalStatus("approved")}
                    disabled={item.approval_status === "approved"}
                    className="flex-1"
                  >
                    {item.approval_status === "approved" ? "Approved" : "Approve"}
                  </Button>
                  {item.approval_status !== "approved" && (
                    <Button 
                      variant="destructive"
                      onClick={() => updateApprovalStatus("rejected")}
                      disabled={item.approval_status === "rejected"}
                      className="flex-1"
                    >
                      {item.approval_status === "rejected" ? "Rejected" : "Reject"}
                    </Button>
                  )}
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
                {creator?.country && (
                  <div>
                    <p className="text-sm font-medium">Country</p>
                    <p className="text-sm text-muted-foreground">{creator.country}</p>
                  </div>
                )}
                {creator?.gender && (
                  <div>
                    <p className="text-sm font-medium">Gender</p>
                    <p className="text-sm text-muted-foreground capitalize">{creator.gender}</p>
                  </div>
                )}
                {creator?.date_of_birth && (
                  <div>
                    <p className="text-sm font-medium">Date of Birth</p>
                    <p className="text-sm text-muted-foreground">{new Date(creator.date_of_birth).toLocaleDateString()}</p>
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
                {item.location_link && (
                  <a 
                    href={item.location_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    View on Map
                  </a>
                )}
                {item.map_link && (
                  <a 
                    href={item.map_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    View on Map
                  </a>
                )}
              </div>
            </Card>
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
                    <p className="text-xs text-center text-muted-foreground">
                      +{bookings.length - 5} more bookings
                    </p>
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
