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
import { Plane, Building, Tent, ChevronRight, MapPin } from "lucide-react";

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

    // Check for host referral tracking
    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get("ref");
    if (refId) {
      trackHostReferral(refId);
    }

    const checkVerificationAndFetchData = async () => {
      try {
        // Check if user has verification
        const { data: verification, error: verificationError } = await supabase
          .from("host_verifications")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (verificationError && verificationError.code !== 'PGRST116') {
          toast({
            title: "Error",
            description: "Failed to check verification status. Please try again.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // If no verification exists, redirect to verification page
        if (!verification) {
          navigate("/host-verification");
          return;
        }

        // If verification is pending, redirect to status page
        if (verification.status === "pending") {
          navigate("/verification-status");
          return;
        }

        // If verification is rejected, redirect to verification page
        if (verification.status === "rejected") {
          navigate("/host-verification");
          return;
        }

        // If approved, fetch data
        if (verification.status === "approved") {
          const { data: trips, error: tripsError } = await supabase.from("trips").select("*").eq("created_by", user.id);
          const { data: hotels, error: hotelsError } = await supabase.from("hotels").select("id, name, location, place, country, image_url, description, email, phone_numbers, amenities, establishment_type, map_link, gallery_images, images, approval_status, created_at, created_by, approved_by, approved_at, is_hidden, registration_number, facilities").eq("created_by", user.id);
          const { data: adventures, error: adventuresError } = await supabase.from("adventure_places").select("id, name, location, place, country, image_url, description, email, phone_numbers, amenities, activities, facilities, entry_fee, entry_fee_type, map_link, gallery_images, images, approval_status, created_at, created_by, approved_by, approved_at, is_hidden, registration_number").eq("created_by", user.id);
          const { data: attractions, error: attractionsError } = await supabase.from("attractions").select("id, location_name, local_name, country, description, email, phone_number, entrance_type, price_adult, price_child, photo_urls, gallery_images, approval_status, created_at, created_by, approved_by, approved_at, is_hidden, registration_number, registration_type, opening_hours, closing_hours, days_opened, location_link").eq("created_by", user.id);

          // Show specific error messages for each item type that failed
          if (tripsError) {
            toast({
              title: "Error Loading Trips",
              description: "Failed to load your trips. Please try again.",
              variant: "destructive",
            });
          }
          if (hotelsError) {
            toast({
              title: "Error Loading Hotels",
              description: "Failed to load your hotels. Please try again.",
              variant: "destructive",
            });
          }
          if (adventuresError) {
            toast({
              title: "Error Loading Experiences",
              description: "Failed to load your experiences. Please try again.",
              variant: "destructive",
            });
          }
          if (attractionsError) {
            toast({
              title: "Error Loading Attractions",
              description: "Failed to load your attractions. Please try again.",
              variant: "destructive",
            });
          }

          const allContent = [
            ...(trips?.map(t => ({ ...t, type: "trip" })) || []),
            ...(hotels?.map(h => ({ ...h, type: "hotel" })) || []),
            ...(adventures?.map(a => ({ ...a, type: "adventure" })) || []),
            ...(attractions?.map(a => ({ ...a, type: "attraction", name: a.local_name || a.location_name, location: a.location_name })) || [])
          ];

          setMyContent(allContent);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error in checkVerificationAndFetchData:", error);
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please refresh the page.",
          variant: "destructive",
        });
        setLoading(false);
      }
    };

    checkVerificationAndFetchData();
  }, [user, navigate]);

  const trackHostReferral = async (referrerId: string) => {
    try {
      const { data: existingTracking } = await supabase
        .from("referral_tracking")
        .select("*")
        .eq("referrer_id", referrerId)
        .eq("referred_user_id", user?.id)
        .eq("referral_type", "host")
        .single();

      if (!existingTracking) {
        await supabase.from("referral_tracking").insert({
          referrer_id: referrerId,
          referred_user_id: user?.id,
          referral_type: "host",
          status: "pending",
        });

        // Save to profile for future reference
        await supabase
          .from("profiles")
          .update({ referrer_id: referrerId })
          .eq("id", user?.id);
      }
    } catch (error) {
      console.error("Error tracking host referral:", error);
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

        <Card>
          <div className="divide-y divide-border">
            <button
              onClick={() => navigate("/host/category/trips")}
              className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-4">
                <Plane className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">Tours</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {myContent.filter(i => i.type === 'trip').length}
                </Badge>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>

            <button
              onClick={() => navigate("/host/category/hotels")}
              className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-4">
                <Building className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">Hotels</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {myContent.filter(i => i.type === 'hotel').length}
                </Badge>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>

            <button
              onClick={() => navigate("/host/category/attractions")}
              className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-4">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">Attractions</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {myContent.filter(i => i.type === 'attraction').length}
                </Badge>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>

            <button
              onClick={() => navigate("/host/category/experiences")}
              className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-4">
                <Tent className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">Experiences</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {myContent.filter(i => i.type === 'adventure').length}
                </Badge>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>
          </div>
        </Card>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default BecomeHost;
