import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, CheckCircle, XCircle, Clock, User } from "lucide-react";

const AdminVerification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

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
      await fetchVerifications();
    };

    checkAdminAndFetch();
  }, [user, navigate]);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("host_verifications")
        .select(`
          *,
          profiles!host_verifications_user_id_fkey (
            name,
            email
          )
        `)
        .order("submitted_at", { ascending: false });

      if (error) {
        console.error("Error fetching verifications:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to fetch verifications.",
          variant: "destructive",
        });
        setVerifications([]);
      } else {
        setVerifications(data || []);
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      setVerifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (verificationId: string) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("host_verifications")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
          rejection_reason: null,
        })
        .eq("id", verificationId);

      if (error) throw error;

      toast({
        title: "Verification Approved",
        description: "The host verification has been approved successfully.",
      });

      setSelectedVerification(null);
      await fetchVerifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve verification.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (verificationId: string) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("host_verifications")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
          rejection_reason: rejectionReason,
        })
        .eq("id", verificationId);

      if (error) throw error;

      toast({
        title: "Verification Rejected",
        description: "The host verification has been rejected.",
      });

      setSelectedVerification(null);
      setRejectionReason("");
      await fetchVerifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject verification.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { label: "Pending", variant: "secondary" as const, icon: Clock },
      approved: { label: "Approved", variant: "default" as const, icon: CheckCircle },
      rejected: { label: "Rejected", variant: "destructive" as const, icon: XCircle },
    };
    const statusConfig = config[status as keyof typeof config];
    const Icon = statusConfig.icon;
    return (
      <Badge variant={statusConfig.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {statusConfig.label}
      </Badge>
    );
  };

  const renderVerificationList = (filterStatus?: string) => {
    const filtered = filterStatus
      ? verifications.filter((v) => v.status === filterStatus)
      : verifications;

    if (filtered.length === 0) {
      return (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No verifications found.</p>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((verification) => (
          <Card key={verification.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">{verification.profiles?.name || "Unknown"}</h3>
                  <p className="text-sm text-muted-foreground">{verification.profiles?.email}</p>
                </div>
              </div>
              {getStatusBadge(verification.status)}
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-sm">
                <strong>Legal Name:</strong> {verification.legal_name}
              </p>
              <p className="text-sm">
                <strong>Document:</strong> {verification.document_type.replace("_", " ").toUpperCase()}
              </p>
              <p className="text-sm text-muted-foreground">
                Submitted: {new Date(verification.submitted_at).toLocaleDateString()}
              </p>
            </div>
            <Button
              onClick={() => setSelectedVerification(verification)}
              className="w-full"
              variant="outline"
            >
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </Card>
        ))}
      </div>
    );
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
        <h1 className="text-3xl font-bold mb-6">Host Verification Management</h1>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="pending">
              Waiting for Verification
              <Badge variant="secondary" className="ml-2">
                {verifications.filter((v) => v.status === "pending").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="approved">
              Verified Hosts
              <Badge variant="default" className="ml-2">
                {verifications.filter((v) => v.status === "approved").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected
              <Badge variant="destructive" className="ml-2">
                {verifications.filter((v) => v.status === "rejected").length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">{renderVerificationList("pending")}</TabsContent>
          <TabsContent value="approved">{renderVerificationList("approved")}</TabsContent>
          <TabsContent value="rejected">{renderVerificationList("rejected")}</TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verification Details</DialogTitle>
          </DialogHeader>

          {selectedVerification && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>User Name</Label>
                  <p className="text-sm">{selectedVerification.profiles?.name}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="text-sm">{selectedVerification.profiles?.email}</p>
                </div>
                <div>
                  <Label>Legal Name</Label>
                  <p className="text-sm">{selectedVerification.legal_name}</p>
                </div>
                <div>
                  <Label>Document Type</Label>
                  <p className="text-sm">
                    {selectedVerification.document_type.replace("_", " ").toUpperCase()}
                  </p>
                </div>
              </div>

              <div>
                <Label>Residential Address</Label>
                <p className="text-sm">{selectedVerification.residential_address}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Document Front</Label>
                  <img
                    src={selectedVerification.document_front_url}
                    alt="Document front"
                    className="w-full h-64 object-contain rounded-lg border mt-2 cursor-pointer hover:opacity-90"
                    onClick={() => window.open(selectedVerification.document_front_url, "_blank")}
                  />
                </div>
                {selectedVerification.document_back_url && (
                  <div>
                    <Label>Document Back</Label>
                    <img
                      src={selectedVerification.document_back_url}
                      alt="Document back"
                      className="w-full h-64 object-contain rounded-lg border mt-2 cursor-pointer hover:opacity-90"
                      onClick={() => window.open(selectedVerification.document_back_url, "_blank")}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label>Selfie</Label>
                <img
                  src={selectedVerification.selfie_url}
                  alt="Selfie"
                  className="w-full max-w-md h-64 object-contain rounded-lg border mt-2 cursor-pointer hover:opacity-90"
                  onClick={() => window.open(selectedVerification.selfie_url, "_blank")}
                />
              </div>

              {selectedVerification.status === "pending" && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label htmlFor="rejectionReason">Rejection Reason (if rejecting)</Label>
                    <Select value={rejectionReason} onValueChange={setRejectionReason}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select rejection reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Document does not match legal name.">
                          Document does not match legal name
                        </SelectItem>
                        <SelectItem value="Document not visible/blurry.">
                          Document not visible/blurry
                        </SelectItem>
                        <SelectItem value="Inappropriate/Invalid document.">
                          Inappropriate/Invalid document
                        </SelectItem>
                        <SelectItem value="Selfie does not match the document photo.">
                          Selfie does not match the document photo
                        </SelectItem>
                        <SelectItem value="custom">Custom Note</SelectItem>
                      </SelectContent>
                    </Select>
                    {rejectionReason === "custom" && (
                      <Textarea
                        className="mt-2"
                        placeholder="Enter custom rejection reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                      />
                    )}
                  </div>

                  <div className="flex gap-4">
                    <Button
                      onClick={() => handleApprove(selectedVerification.id)}
                      disabled={isProcessing}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleReject(selectedVerification.id)}
                      disabled={isProcessing || !rejectionReason}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {selectedVerification.status === "rejected" && (
                <div className="bg-destructive/10 p-4 rounded-md">
                  <Label>Rejection Reason</Label>
                  <p className="text-sm mt-1">{selectedVerification.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default AdminVerification;