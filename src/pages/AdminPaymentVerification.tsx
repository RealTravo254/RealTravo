import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, XCircle, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BankDetail {
  id: string;
  user_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  verification_status: string;
  rejection_reason: string | null;
  created_at: string;
  last_updated: string;
  user_email?: string;
  user_name?: string;
}

export default function AdminPaymentVerification() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    checkAdminAndFetchData();
  }, [user, navigate]);

  const checkAdminAndFetchData = async () => {
    if (!user) return;

    try {
      // Check if user is admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAdmin = roles?.some(r => r.role === "admin");
      
      if (!isAdmin) {
        navigate("/");
        return;
      }

      await fetchBankDetails();
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate("/");
    }
  };

  const fetchBankDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("bank_details")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user emails and names for each bank detail
      const detailsWithUserInfo = await Promise.all(
        (data || []).map(async (detail) => {
          const { data: userData } = await supabase.auth.admin.getUserById(detail.user_id);
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", detail.user_id)
            .maybeSingle();
          
          return {
            ...detail,
            user_email: userData?.user?.email || "Unknown",
            user_name: profile?.name || "Unknown",
          };
        })
      );

      setBankDetails(detailsWithUserInfo);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching bank details:", error);
      setLoading(false);
    }
  };

  const handleVerify = async (id: string) => {
    if (!user) return;

    setProcessing(id);
    try {
      const { error } = await supabase
        .from("bank_details")
        .update({
          verification_status: "verified",
          verified_at: new Date().toISOString(),
          verified_by: user.id,
          rejection_reason: null,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Bank details verified successfully",
      });

      await fetchBankDetails();
    } catch (error) {
      console.error("Error verifying bank details:", error);
      toast({
        title: "Error",
        description: "Failed to verify bank details",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setProcessing(id);
    try {
      const { error } = await supabase
        .from("bank_details")
        .update({
          verification_status: "rejected",
          rejection_reason: rejectionReason,
          verified_by: user.id,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Bank details rejected",
      });

      setRejectionReason("");
      setSelectedItem(null);
      await fetchBankDetails();
    } catch (error) {
      console.error("Error rejecting bank details:", error);
      toast({
        title: "Error",
        description: "Failed to reject bank details",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  const filterByStatus = (status: string) => {
    return bankDetails.filter(detail => detail.verification_status === status);
  };

  const renderBankDetailCard = (detail: BankDetail) => (
    <Card key={detail.id} className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{detail.account_holder_name}</CardTitle>
          {getStatusBadge(detail.verification_status)}
        </div>
        <div className="space-y-1 mt-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Name:</span> {detail.user_name}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Email:</span> {detail.user_email}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">Bank Name</Label>
            <p className="font-medium">{detail.bank_name}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Account Number</Label>
            <p className="font-medium">{detail.account_number}</p>
          </div>
        </div>

        <div>
          <Label className="text-muted-foreground">Submitted</Label>
          <p className="text-sm">{new Date(detail.created_at).toLocaleString()}</p>
        </div>

        {detail.rejection_reason && (
          <div className="p-3 bg-destructive/10 border border-destructive rounded-lg">
            <Label className="text-destructive">Rejection Reason</Label>
            <p className="text-sm text-destructive/80">{detail.rejection_reason}</p>
          </div>
        )}

        {detail.verification_status === "pending" && (
          <div className="space-y-3">
            {selectedItem === detail.id && (
              <div>
                <Label htmlFor="rejectionReason">Rejection Reason</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={3}
                />
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={() => handleVerify(detail.id)}
                disabled={processing === detail.id}
                className="flex-1"
              >
                {processing === detail.id ? "Processing..." : "Verify"}
              </Button>
              {selectedItem === detail.id ? (
                <>
                  <Button
                    onClick={() => handleReject(detail.id)}
                    disabled={processing === detail.id}
                    variant="destructive"
                    className="flex-1"
                  >
                    Confirm Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedItem(null);
                      setRejectionReason("");
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setSelectedItem(detail.id)}
                  variant="destructive"
                  className="flex-1"
                >
                  Reject
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="max-w-4xl mx-auto space-y-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
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
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/account")}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Account
          </Button>

          <h1 className="text-3xl font-bold mb-8 text-foreground">
            Payment Verification
          </h1>

          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">
                Pending ({filterByStatus("pending").length})
              </TabsTrigger>
              <TabsTrigger value="verified">
                Verified ({filterByStatus("verified").length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({filterByStatus("rejected").length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-6">
              {filterByStatus("pending").length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No pending verifications</p>
                  </CardContent>
                </Card>
              ) : (
                filterByStatus("pending").map(renderBankDetailCard)
              )}
            </TabsContent>

            <TabsContent value="verified" className="mt-6">
              {filterByStatus("verified").length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No verified bank details</p>
                  </CardContent>
                </Card>
              ) : (
                filterByStatus("verified").map(renderBankDetailCard)
              )}
            </TabsContent>

            <TabsContent value="rejected" className="mt-6">
              {filterByStatus("rejected").length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No rejected bank details</p>
                  </CardContent>
                </Card>
              ) : (
                filterByStatus("rejected").map(renderBankDetailCard)
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}
