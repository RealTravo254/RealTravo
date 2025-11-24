import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, ClipboardList, CheckCircle, XCircle, ShieldCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [hostVerificationCount, setHostVerificationCount] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    checkAdminRole();
  }, [user, navigate]);

  const checkAdminRole = async () => {
    try {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id);

      if (error) {
        console.error("Error checking admin role:", error);
        navigate("/");
        return;
      }

      const hasAdminRole = roles?.some(r => r.role === "admin");
      
      if (!hasAdminRole) {
        navigate("/");
        return;
      }

      setIsAdmin(true);
      await fetchCounts();
      setLoading(false);
    } catch (error) {
      console.error("Error in checkAdminRole:", error);
      navigate("/");
    }
  };

  const fetchCounts = async () => {
    try {
      const [pendingTrips, pendingHotels, pendingAdventures, pendingAttractions] = await Promise.all([
        supabase.from("trips").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
        supabase.from("hotels").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
        supabase.from("adventure_places").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
        supabase.from("attractions").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
      ]);

      const totalPending = (pendingTrips.count || 0) + (pendingHotels.count || 0) + 
                          (pendingAdventures.count || 0) + (pendingAttractions.count || 0);
      setPendingCount(totalPending);

      const [approvedTrips, approvedHotels, approvedAdventures, approvedAttractions] = await Promise.all([
        supabase.from("trips").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
        supabase.from("hotels").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
        supabase.from("adventure_places").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
        supabase.from("attractions").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
      ]);

      const totalApproved = (approvedTrips.count || 0) + (approvedHotels.count || 0) + 
                           (approvedAdventures.count || 0) + (approvedAttractions.count || 0);
      setApprovedCount(totalApproved);

      const [rejectedTrips, rejectedHotels, rejectedAdventures, rejectedAttractions] = await Promise.all([
        supabase.from("trips").select("id", { count: "exact", head: true }).eq("approval_status", "rejected"),
        supabase.from("hotels").select("id", { count: "exact", head: true }).eq("approval_status", "rejected"),
        supabase.from("adventure_places").select("id", { count: "exact", head: true }).eq("approval_status", "rejected"),
        supabase.from("attractions").select("id", { count: "exact", head: true }).eq("approval_status", "rejected"),
      ]);

      const totalRejected = (rejectedTrips.count || 0) + (rejectedHotels.count || 0) + 
                           (rejectedAdventures.count || 0) + (rejectedAttractions.count || 0);
      setRejectedCount(totalRejected);

      // Fetch host verifications pending count
      const { count: hostVerificationsPending } = await supabase
        .from("host_verifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      
      setHostVerificationCount(hostVerificationsPending || 0);
    } catch (error) {
      console.error("Error fetching counts:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8 max-w-4xl mx-auto mb-20 md:mb-0">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        <Card>
          <div className="divide-y divide-border">
            <button
              onClick={() => navigate("/admin/pending-approval")}
              className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-4">
                <ClipboardList className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">Pending Approval</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{pendingCount}</Badge>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>

            <button
              onClick={() => navigate("/admin/approved")}
              className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-4">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">{approvedCount}</Badge>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>

            <button
              onClick={() => navigate("/admin/rejected")}
              className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-4">
                <XCircle className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">Rejected</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive">{rejectedCount}</Badge>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>

            <button
              onClick={() => navigate("/admin/verification")}
              className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-4">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">Host Verifications</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{hostVerificationCount}</Badge>
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

export default AdminDashboard;
