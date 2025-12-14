import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

const VerificationStatus = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [verification, setVerification] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchVerification = async () => {
      const { data, error } = await supabase
        .from("host_verifications")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setVerification(data);
      }
      setLoading(false);
    };

    fetchVerification();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8 mb-20 md:mb-0">
          <p className="text-center">Loading...</p>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  if (!verification) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8 mb-20 md:mb-0">
          <Card className="max-w-2xl mx-auto p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">No Verification Found</h1>
            <p className="text-muted-foreground mb-6">
              You haven't submitted a verification request yet.
            </p>
            <Button onClick={() => navigate("/host-verification")}>
              Start Verification
            </Button>
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
      <main className="flex-1 container px-4 py-8 mb-20 md:mb-0">
        <Card className="max-w-2xl mx-auto p-8">
          {verification.status === "pending" && (
            <div className="text-center">
              <Clock className="h-16 w-16 text-primary mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-4">Verification Pending</h1>
              <p className="text-muted-foreground mb-6">
                Your identity verification is currently under review. We will notify you of the result soon.
              </p>
              <div className="bg-muted p-4 rounded-md mb-6">
                <p className="text-sm">
                  <strong>Submitted:</strong> {new Date(verification.submitted_at).toLocaleDateString()}
                </p>
              </div>
              <Button onClick={() => navigate("/")}>Return to Home</Button>
            </div>
          )}

          {verification.status === "approved" && (
            <div className="text-center">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-4">Verification Approved!</h1>
              <p className="text-muted-foreground mb-6">
                Congratulations! Your identity has been approved. You now have full access to our hosting features.
              </p>
              <Button onClick={() => navigate("/become-host")}>
                Go to Hosting Dashboard
              </Button>
            </div>
          )}

          {verification.status === "rejected" && (
            <div className="text-center">
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-4 text-destructive">Verification Failed</h1>
              <div className="bg-destructive/10 p-4 rounded-md mb-6">
                <p className="font-semibold mb-2">Rejection Reason:</p>
                <p className="text-muted-foreground">{verification.rejection_reason}</p>
              </div>
              <Button onClick={() => navigate("/host-verification")} className="w-full">
                Start Verification Process Again
              </Button>
            </div>
          )}
        </Card>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default VerificationStatus;