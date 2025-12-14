import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, ShoppingCart, DollarSign } from "lucide-react";

export default function MyReferrals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalReferred: 0,
    totalBookings: 0,
    totalCommission: 0,
  });
  

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchStats = async () => {
      try {
        // Get total referred users
        const { data: referrals, error: referralsError } = await supabase
          .from("referral_tracking")
          .select("*")
          .eq("referrer_id", user.id);

        if (referralsError) throw referralsError;

        const uniqueReferred = new Set(
          referrals?.map((r) => r.referred_user_id).filter(Boolean) || []
        );

        // Get total bookings through referrals
        const { data: commissions, error: commissionsError } = await supabase
          .from("referral_commissions")
          .select("*")
          .eq("referrer_id", user.id);

        if (commissionsError) throw commissionsError;

        const totalCommission = commissions?.reduce(
          (sum, c) => sum + Number(c.commission_amount),
          0
        ) || 0;

        setStats({
          totalReferred: uniqueReferred.size,
          totalBookings: commissions?.length || 0,
          totalCommission,
        });

        setLoading(false);
      } catch (error) {
        console.error("Error fetching referral stats:", error);
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-48 mb-8" />
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
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

          <h1 className="text-3xl font-bold mb-8 text-foreground">My Referrals</h1>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Total Referred
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {stats.totalReferred}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Total Bookings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {stats.totalBookings}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Commission
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  ${stats.totalCommission.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}
