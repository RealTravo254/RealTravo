import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Mail, Phone, Calendar, User, Eye, Clock, ArrowLeft, DollarSign, Copy, Share2 } from "lucide-react";
import { approvalStatusSchema } from "@/lib/validation";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

// Define the custom colors
const TEAL_COLOR = "#008080";
const ORANGE_COLOR = "#FF9800";
const RED_COLOR = "#EF4444";

const AdminReviewDetail = () => {
  const { itemType: type, id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [item, setItem] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [current, setCurrent] = useState(0);

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

      if (type === "trip" || type === "event") {
        tableName = "trips";
        const { data, error } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        itemData = data;
      } else if (type === "hotel") {
        tableName = "hotels";
        const { data, error } = await supabase.from("hotels").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        itemData = data;
      } else if (type === "adventure" || type === "adventure_place") {
        tableName = "adventure_places";
        const { data, error } = await supabase.from("adventure_places").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        itemData = data;
      } else if (type === "attraction") {
        // Attractions table doesn't exist - redirect
        toast({
          title: "Not Found",
          description: "Attractions are not supported",
          variant: "destructive",
        });
        navigate("/admin");
        return;
      }

      if (!itemData) {
        toast({
          title: "Not Found",
          description: "Item not found or you don't have permission to view it",
          variant: "destructive",
        });
        navigate("/admin");
        return;
      }
      
      setItem({ ...itemData, type, tableName });

      // Fetch creator profile
      if (itemData.created_by) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", itemData.created_by)
          .maybeSingle();

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
      const validatedStatus = approvalStatusSchema.parse(status);
      
      const updateData: any = {
        approval_status: validatedStatus,
        approved_by: validatedStatus === "approved" ? user?.id : null,
        approved_at: validatedStatus === "approved" ? new Date().toISOString() : null,
        is_hidden: validatedStatus === "approved" ? false : item.is_hidden
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

  const getItemTypeBadge = () => {
    const typeLabels: Record<string, string> = {
      trip: "TRIP",
      event: "EVENT",
      hotel: "HOTEL",
      adventure: "CAMPSITE",
      adventure_place: "CAMPSITE",
      attraction: "ATTRACTION"
    };
    return typeLabels[type || ""] || type?.toUpperCase() || "ITEM";
  };

  const openInMaps = () => {
    if (item?.map_link || item?.location_link) {
      window.open(item.map_link || item.location_link, '_blank');
    } else {
      const query = encodeURIComponent(`${item?.name || item?.location_name}, ${item?.location || item?.location_name}, ${item?.country}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header />
        <div className="container px-4 py-6 max-w-6xl mx-auto">
          <div className="h-64 md:h-96 bg-muted animate-pulse rounded-lg" />
        </div>
        <MobileBottomBar />
      </div>
    );
  }

  if (!item) return null;

  // Collect all available images
  const displayImages = [
    ...(item.gallery_images || []),
    ...(item.images || []),
    ...(item.photo_urls || []),
    ...(item.image_url ? [item.image_url] : [])
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-6 max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
          {/* --- Image Carousel Section --- */}
          <div className="w-full relative">
            <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground z-20 text-xs font-bold px-3 py-1">
              {getItemTypeBadge()}
            </Badge>
            <div className="absolute top-4 right-4 z-20">
              {getStatusBadge(item.approval_status)}
            </div>
            
            {displayImages.length > 0 ? (
              <Carousel
                opts={{ loop: true }}
                plugins={[Autoplay({ delay: 3000 })]}
                className="w-full rounded-2xl overflow-hidden"
                setApi={(api) => {
                  if (api) {
                    api.on("select", () => setCurrent(api.selectedScrollSnap()));
                  }
                }}
              >
                <CarouselContent>
                  {displayImages.map((img: string, idx: number) => (
                    <CarouselItem key={idx}>
                      <img 
                        src={img} 
                        alt={`${item.name || item.location_name} ${idx + 1}`} 
                        loading="lazy" 
                        decoding="async" 
                        className="w-full h-64 md:h-96 object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder.svg';
                        }}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>

                {displayImages.length > 1 && (
                  <>
                    <CarouselPrevious className="left-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                    <CarouselNext className="right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                  </>
                )}
              </Carousel>
            ) : (
              <div className="w-full h-64 md:h-96 bg-muted rounded-2xl flex items-center justify-center">
                <p className="text-muted-foreground">No images available</p>
              </div>
            )}
            
            {/* Description overlay */}
            {item.description && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white p-4 z-10 rounded-b-2xl shadow-lg transform translate-y-2">
                <h2 className="text-lg font-semibold mb-2">About This {getItemTypeBadge().toLowerCase()}</h2>
                <p className="text-sm line-clamp-3">{item.description}</p>
              </div>
            )}
          </div>

          {/* --- Detail Section (Right Column) --- */}
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{item.name || item.location_name}</h1>
              {item.local_name && (
                <p className="text-lg text-muted-foreground mb-2">"{item.local_name}"</p>
              )}
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MapPin className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                <span>{item.location || item.location_name}, {item.country}</span>
              </div>
              {item.place && (
                <p className="text-sm text-muted-foreground mb-4">Place: {item.place}</p>
              )}
            </div>

            {/* Price/Fee Card */}
            <div className="space-y-3 p-4 border bg-card rounded-lg">
              {(item.price || item.entry_fee || item.price_adult) && (
                <div className="border-b pb-3">
                  <p className="text-sm text-muted-foreground mb-1">
                    {item.price ? "Price (Per Adult)" : item.entry_fee ? "Entry Fee" : "Adult Price"}
                  </p>
                  <p className="text-2xl font-bold" style={{ color: RED_COLOR }}>
                    KSh {item.price || item.entry_fee || item.price_adult || 0}
                  </p>
                  {(item.price_child > 0 || item.price_child) && (
                    <p className="text-sm text-muted-foreground">Child: KSh {item.price_child}</p>
                  )}
                </div>
              )}

              {/* Date for trips/events */}
              {item.date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" style={{ color: TEAL_COLOR }} />
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-semibold">{item.is_flexible_date ? "Flexible" : new Date(item.date).toLocaleDateString()}</p>
                  </div>
                </div>
              )}

              {item.available_tickets && (
                <p className="text-sm text-muted-foreground">Available Tickets: {item.available_tickets}</p>
              )}

              {item.registration_number && (
                <div>
                  <p className="text-sm text-muted-foreground">Registration Number</p>
                  <p className="font-medium">{item.registration_number}</p>
                </div>
              )}
            </div>

            {/* Operating Hours */}
            {(item.opening_hours || item.closing_hours || (item.days_opened && item.days_opened.length > 0)) && (
              <div className="p-4 border bg-card rounded-lg" style={{ borderColor: TEAL_COLOR }}>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" style={{ color: TEAL_COLOR }} />
                  <div>
                    <p className="text-sm text-muted-foreground">Working Hours & Days</p>
                    <p className="font-semibold">
                      {(item.opening_hours || item.closing_hours) 
                        ? `${item.opening_hours || 'N/A'} - ${item.closing_hours || 'N/A'}`
                        : 'Not specified'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium">Working Days:</span>{' '}
                      {item.days_opened && item.days_opened.length > 0 
                        ? item.days_opened.join(', ')
                        : 'Not specified'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Action Buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={() => updateApprovalStatus("approved")}
                disabled={item.approval_status === "approved"}
                className="flex-1"
                style={{ backgroundColor: TEAL_COLOR }}
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
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={openInMaps} 
                className="flex-1 h-9"
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
              >
                <MapPin className="h-4 w-4 md:mr-2" style={{ color: TEAL_COLOR }} />
                <span className="hidden md:inline">Map</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const publicUrl = `/${type}/${id}`;
                  window.open(publicUrl, '_blank');
                }}
                className="flex-1 h-9"
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
              >
                <Eye className="h-4 w-4 md:mr-2" style={{ color: TEAL_COLOR }} />
                <span className="hidden md:inline">View Public</span>
              </Button>
            </div>

            {/* Visibility Toggle for Approved Items */}
            {item.approval_status === "approved" && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Public Visibility</p>
                    <p className="text-xs text-muted-foreground">
                      {item.is_hidden ? "Hidden from public" : "Visible to public"}
                    </p>
                  </div>
                  <Button 
                    size="sm"
                    variant={item.is_hidden ? "default" : "outline"}
                    onClick={async () => {
                      const { error } = await supabase
                        .from(item.tableName)
                        .update({ is_hidden: !item.is_hidden })
                        .eq("id", id);
                      
                      if (!error) {
                        toast({
                          title: "Success",
                          description: item.is_hidden ? "Item is now visible" : "Item is now hidden",
                        });
                        fetchItemDetails();
                      }
                    }}
                  >
                    {item.is_hidden ? "Publish" : "Hide"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- Amenities Section --- */}
        {item.amenities && item.amenities.length > 0 && (
          <div className="mt-6 p-6 border bg-card rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {item.amenities.map((amenity: string, idx: number) => (
                <div 
                  key={idx} 
                  className="px-4 py-2 text-white rounded-full text-sm"
                  style={{ backgroundColor: RED_COLOR }}
                >
                  {amenity}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Facilities Section --- */}
        {item.facilities && item.facilities.length > 0 && (
          <div className="mt-6 p-6 border bg-card rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Facilities</h2>
            <div className="flex flex-wrap gap-2">
              {item.facilities.map((facility: any, idx: number) => (
                <div 
                  key={idx} 
                  className="px-4 py-2 text-white rounded-full text-sm flex items-center gap-2"
                  style={{ backgroundColor: TEAL_COLOR }}
                >
                  <span className="font-medium">{facility.name}</span>
                  <span className="text-xs opacity-90">
                    {facility.price === 0 ? 'Free' : `KSh ${facility.price || facility.price_per_day}`}
                  </span>
                  {facility.capacity && <span className="text-xs opacity-80">• Cap: {facility.capacity}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Activities Section --- */}
        {item.activities && item.activities.length > 0 && (
          <div className="mt-6 p-6 border bg-card rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Activities</h2>
            <div className="flex flex-wrap gap-2">
              {item.activities.map((activity: any, idx: number) => (
                <div 
                  key={idx} 
                  className="px-4 py-2 text-white rounded-full text-sm flex items-center gap-2"
                  style={{ backgroundColor: ORANGE_COLOR }}
                >
                  <span className="font-medium">{activity.name}</span>
                  <span className="text-xs opacity-90">
                    {activity.price === 0 ? 'Free' : `KSh ${activity.price}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Contact Information Section --- */}
        {(item.email || item.phone_number || item.phone_numbers?.length > 0) && (
          <div className="mt-6 p-6 border bg-card rounded-lg">
            <h2 className="text-xl font-semibold mb-3">Contact Information</h2>
            <div className="space-y-2">
              {(item.phone_number || item.phone_numbers?.[0]) && (
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                  <a 
                    href={`tel:${item.phone_number || item.phone_numbers?.[0]}`} 
                    className="hover:underline" 
                    style={{ color: TEAL_COLOR }}
                  >
                    {item.phone_number || item.phone_numbers?.[0]}
                  </a>
                </p>
              )}
              {item.email && (
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                  <a href={`mailto:${item.email}`} className="hover:underline" style={{ color: TEAL_COLOR }}>
                    {item.email}
                  </a>
                </p>
              )}
            </div>
          </div>
        )}

        {/* --- Creator Details Section --- */}
        <div className="mt-6 p-6 border bg-card rounded-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5" style={{ color: TEAL_COLOR }} />
            Creator Details
          </h2>
          {creator ? (
            <div className="grid gap-3 md:grid-cols-2">
              {creator?.name && (
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{creator.name}</p>
                </div>
              )}
              {creator?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${creator.email}`} className="text-sm hover:underline" style={{ color: TEAL_COLOR }}>
                    {creator.email}
                  </a>
                </div>
              )}
              {creator?.phone_number && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${creator.phone_number}`} className="text-sm hover:underline" style={{ color: TEAL_COLOR }}>
                    {creator.phone_number}
                  </a>
                </div>
              )}
              {creator?.country && (
                <div>
                  <p className="text-sm text-muted-foreground">Country</p>
                  <p className="font-medium">{creator.country}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {item.created_by ? `Creator profile not found (ID: ${item.created_by.substring(0, 8)}...)` : "No creator information available"}
            </p>
          )}
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default AdminReviewDetail;
