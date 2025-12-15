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
import { Plane, Building, Tent, Plus, ArrowLeft } from "lucide-react";

// Define the specified Teal color
const TEAL_COLOR = "#008080";
const TEAL_HOVER_COLOR = "#005555"; // A darker shade of teal for hover

const BecomeHost = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
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
        const {
          data: verification,
          error: verificationError
        } = await supabase.from("host_verifications").select("*").eq("user_id", user.id).single();
        if (verificationError && verificationError.code !== 'PGRST116') {
          toast({
            title: "Error",
            description: "Failed to check verification status. Please try again.",
            variant: "destructive"
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
          const {
            data: trips,
            error: tripsError
          } = await supabase.from("trips").select("*").eq("created_by", user.id);
          const {
            data: hotels,
            error: hotelsError
          } = await supabase.from("hotels").select("id, name, location, place, country, image_url, description, email, phone_numbers, amenities, establishment_type, map_link, gallery_images, images, approval_status, created_at, created_by, approved_by, approved_at, is_hidden, registration_number, facilities").eq("created_by", user.id);
          const {
            data: adventures,
            error: adventuresError
          } = await supabase.from("adventure_places").select("id, name, location, place, country, image_url, description, email, phone_numbers, amenities, activities, facilities, entry_fee, entry_fee_type, map_link, gallery_images, images, approval_status, created_at, created_by, approved_by, approved_at, is_hidden, registration_number").eq("created_by", user.id);

          // Show specific error messages for each item type that failed
          if (tripsError) {
            toast({
              title: "Error Loading Trips",
              description: "Failed to load your trips. Please try again.",
              variant: "destructive"
            });
          }
          if (hotelsError) {
            toast({
              title: "Error Loading Hotels",
              description: "Failed to load your hotels. Please try again.",
              variant: "destructive"
            });
          }
          if (adventuresError) {
            toast({
              title: "Error Loading Experiences",
              description: "Failed to load your experiences. Please try again.",
              variant: "destructive"
            });
          }
          const allContent = [...(trips?.map(t => ({
            ...t,
            type: "trip"
          })) || []), ...(hotels?.map(h => ({
            ...h,
            type: "hotel"
          })) || []), ...(adventures?.map(a => ({
            ...a,
            type: "adventure"
          })) || [])];
          setMyContent(allContent);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error in checkVerificationAndFetchData:", error);
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please refresh the page.",
          variant: "destructive"
        });
        setLoading(false);
      }
    };
    checkVerificationAndFetchData();
  }, [user, navigate]);
  const trackHostReferral = async (referrerId: string) => {
    try {
      const {
        data: existingTracking
      } = await supabase.from("referral_tracking").select("*").eq("referrer_id", referrerId).eq("referred_user_id", user?.id).eq("referral_type", "host").single();
      if (!existingTracking) {
        await supabase.from("referral_tracking").insert({
          referrer_id: referrerId,
          referred_user_id: user?.id,
          referral_type: "host",
          status: "pending",
          item_id: null,
          item_type: null
        });

        // Save to profile for future reference
        await supabase.from("profiles").update({
          referrer_id: referrerId
        }).eq("id", user?.id);
      }
    } catch (error) {
      console.error("Error tracking host referral:", error);
    }
  };
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
    }> = {
      pending: {
        label: "Pending",
        variant: "secondary"
      },
      approved: {
        label: "Approved",
        variant: "default"
      },
      rejected: {
        label: "Rejected",
        variant: "destructive"
      },
      removed: {
        label: "Removed",
        variant: "outline"
      },
      banned: {
        label: "Banned",
        variant: "destructive"
      }
    };
    const config = statusMap[status] || {
      label: status,
      variant: "outline"
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
  const viewItemDetails = (item: any) => {
    navigate(`/host/item/${item.type}/${item.id}`);
  };
  if (loading) {
    return <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8">
          <p className="text-center">Loading...</p>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>;
  }
  return <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8 mb-20 md:mb-0">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/account")} className="hover:bg-accent">
            <ArrowLeft className="h-5 w-5" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Become a Host</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tours Card */}
          <div className="relative h-40 rounded-lg overflow-hidden group shadow-lg hover:shadow-xl transition-all">
            <button onClick={() => navigate("/host/trips")} className="absolute inset-0 w-full h-full" style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}>
              <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-all" />
              <div className="relative h-full flex flex-col items-center justify-center text-white p-6">
                <Plane className="h-10 w-10 mb-3" />
                <span className="text-xl font-bold mb-2">Trip,events and sports</span>
                <Badge variant="secondary" className="bg-white/90 text-foreground">
                  {myContent.filter(i => i.type === 'trip').length} Created
                </Badge>
              </div>
            </button>
            <Button onClick={e => {
            e.stopPropagation();
            navigate("/create-trip");
          }} size="sm" className="absolute top-2 right-2 z-10 text-white" style={{
            backgroundColor: TEAL_COLOR,
            borderColor: TEAL_COLOR
          }} onMouseEnter={e => e.currentTarget.style.backgroundColor = TEAL_HOVER_COLOR} onMouseLeave={e => e.currentTarget.style.backgroundColor = TEAL_COLOR}>
              <Plus className="h-4 w-4 mr-1" />
              Add Tour
            </Button>
          </div>

          {/* Hotels Card */}
          <div className="relative h-40 rounded-lg overflow-hidden group shadow-lg hover:shadow-xl transition-all">
            <button onClick={() => navigate("/host/hotels")} className="absolute inset-0 w-full h-full" style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}>
              <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-all" />
              <div className="relative h-full flex flex-col items-center justify-center text-white p-6">
                <Building className="h-10 w-10 mb-3" />
                <span className="text-xl font-bold mb-2">Hotels & accommodation</span>
                <Badge variant="secondary" className="bg-white/90 text-foreground">
                  {myContent.filter(i => i.type === 'hotel').length} Created
                </Badge>
              </div>
            </button>
            <Button onClick={e => {
            e.stopPropagation();
            navigate("/create-hotel");
          }} size="sm" className="absolute top-2 right-2 z-10 text-white" style={{
            backgroundColor: TEAL_COLOR,
            borderColor: TEAL_COLOR
          }} onMouseEnter={e => e.currentTarget.style.backgroundColor = TEAL_HOVER_COLOR} onMouseLeave={e => e.currentTarget.style.backgroundColor = TEAL_COLOR}>
              <Plus className="h-4 w-4 mr-1" />
              Add Hotel
            </Button>
          </div>

          {/* Attractions Card */}
          

          {/* Experiences Card */}
          <div className="relative h-40 rounded-lg overflow-hidden group shadow-lg hover:shadow-xl transition-all">
            <button onClick={() => navigate("/host/experiences")} className="absolute inset-0 w-full h-full" style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}>
              <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-all" />
              <div className="relative h-full flex flex-col items-center justify-center text-white p-6">
                <Tent className="h-10 w-10 mb-3" />
                <span className="text-xl font-bold mb-2">Experiences</span>
                <Badge variant="secondary" className="bg-white/90 text-foreground">
                  {myContent.filter(i => i.type === 'adventure').length} Created
                </Badge>
              </div>
            </button>
            <Button onClick={e => {
            e.stopPropagation();
            navigate("/create-adventure");
          }} size="sm" className="absolute top-2 right-2 z-10 text-white" style={{
            backgroundColor: TEAL_COLOR,
            borderColor: TEAL_COLOR
          }} onMouseEnter={e => e.currentTarget.style.backgroundColor = TEAL_HOVER_COLOR} onMouseLeave={e => e.currentTarget.style.backgroundColor = TEAL_COLOR}>
              <Plus className="h-4 w-4 mr-1" />
              Add Experience
            </Button>
          </div>
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>;
};
export default BecomeHost;