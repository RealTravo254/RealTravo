import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Clock, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const AdminVerification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const checkAdminAndFetch = async () => {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!roleData) {
        navigate("/");
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        return;
      }

      setIsAdmin(true);
      await fetchCounts();
    };

    checkAdminAndFetch();
  }, [user, navigate]);

  const fetchCounts = async () => {
    setLoading(true);
    try {
      const { count: pending } = await supabase
        .from("host_verifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: approved } = await supabase
        .from("host_verifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved");

      const { count: rejected } = await supabase
        .from("host_verifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected");

      setPendingCount(pending || 0);
      setApprovedCount(approved || 0);
      setRejectedCount(rejected || 0);
    } catch (error) {
      console.error("Error fetching counts:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-64 mb-8" />
          <Card className="max-w-2xl mx-auto">
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </Card>
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
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold mb-2 text-foreground">Host Verification</h1>
          <p className="text-lg text-muted-foreground mb-8">Manage host verification requests</p>

          <Card>
            <div className="divide-y divide-border">
              <button
                onClick={() => navigate("/admin/verification/pending")}
                className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">Pending Verification</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{pendingCount}</Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>

              <button
                onClick={() => navigate("/admin/verification/approved")}
                className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-4">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">Verified Hosts</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default">{approvedCount}</Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>

              <button
                onClick={() => navigate("/admin/verification/rejected")}
                className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-4">
                  <XCircle className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">Rejected Verifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{rejectedCount}</Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default AdminVerification;