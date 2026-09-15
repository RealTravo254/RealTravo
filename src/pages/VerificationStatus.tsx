import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";

export default function VerificationStatus() {
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
      const { data } = await supabase
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

  return (
    <div
      className="flex flex-col min-h-screen bg-background"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Header />

      <main className="flex-1 px-4 pt-3 pb-12 max-w-lg mx-auto w-full space-y-4">
        {/* Navigation Bar Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-black text-foreground leading-tight">
              Verification Status
            </h1>
            <p className="text-[11px] font-medium text-muted-foreground">
              Community safety & identity checks
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Card className="rounded-xl border border-border bg-card p-5 shadow-sm">
            {!verification ? (
              /* State 1: Unverified / No Submission */
              <div className="text-center space-y-4 py-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-foreground">
                    Identity Verification Required
                  </h2>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    To start hosting experiences and receiving payouts, you'll need to verify your identity.
                  </p>
                </div>

                <Button
                  onClick={() => navigate("/host-verification")}
                  className="w-full h-10 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all active:scale-95"
                >
                  Start Verification
                </Button>
              </div>
            ) : (
              <>
                {/* State 2: Pending Review */}
                {verification.status === "pending" && (
                  <div className="text-center space-y-4 py-2">
                    <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto text-amber-500">
                      <Clock className="h-6 w-6 animate-pulse" />
                    </div>

                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-foreground">
                        Review Pending
                      </h2>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                        Our team is currently reviewing your documents. Reviews typically take 24 to 48 hours.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/40 border border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Submitted On
                      </p>
                      <p className="text-xs font-semibold text-foreground mt-0.5">
                        {new Date(verification.submitted_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => navigate("/")}
                      className="w-full h-10 rounded-xl text-xs font-bold text-muted-foreground border-border hover:bg-muted"
                    >
                      Back to Home
                    </Button>
                  </div>
                )}

                {/* State 3: Approved */}
                {verification.status === "approved" && (
                  <div className="text-center space-y-4 py-2">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-500">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>

                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        You're Verified!
                      </h2>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                        Your identity has been confirmed. You now have full access to hosting tools and payouts.
                      </p>
                    </div>

                    <Button
                      onClick={() => navigate("/become-host")}
                      className="w-full h-10 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all active:scale-95"
                    >
                      Go to Host Dashboard
                    </Button>
                  </div>
                )}

                {/* State 4: Rejected */}
                {verification.status === "rejected" && (
                  <div className="text-center space-y-4 py-2">
                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto text-destructive">
                      <XCircle className="h-6 w-6" />
                    </div>

                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-destructive">
                        Verification Failed
                      </h2>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                        We were unable to verify your identity with the provided documents.
                      </p>
                    </div>

                    {verification.rejection_reason && (
                      <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-left">
                        <p className="text-[10px] font-bold text-destructive uppercase tracking-wider mb-1">
                          Feedback
                        </p>
                        <p className="text-xs text-foreground font-medium">
                          "{verification.rejection_reason}"
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={() => navigate("/host-verification")}
                      className="w-full h-10 rounded-xl text-xs font-bold text-destructive-foreground bg-destructive hover:bg-destructive/90 transition-all active:scale-95"
                    >
                      Resubmit Documents
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        )}
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
}