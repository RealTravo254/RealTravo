import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ChevronRight, User, Briefcase, CreditCard, Shield, LogOut, UserCog, Users, ArrowLeft, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function Account() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchUserData = async () => {
      try {
        // Fetch profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUserName(profile.name);
        }

        // Fetch role
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (roles && roles.length > 0) {
          const roleList = roles.map(r => r.role);
          if (roleList.includes("admin")) {
            setUserRole("admin");
          } else {
            setUserRole("user");
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching user data:", error);
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user, navigate]);

  const handleLogout = async () => {
    await signOut();
  };

  const menuItems = [
    {
      icon: Briefcase,
      label: "Become a Host",
      path: "/become-host",
      show: true,
    },
    {
      icon: Briefcase,
      label: "My Host Bookings",
      path: "/host-bookings",
      show: true,
    },
    {
      icon: Users,
      label: "My Referrals",
      path: "/my-referrals",
      show: true,
    },
    {
      icon: User,
      label: "Profile Edit",
      path: "/profile/edit",
      show: true,
    },
    {
      icon: CreditCard,
      label: "My Payment",
      path: "/payment",
      show: true,
    },
    {
      icon: Receipt,
      label: "Payment History",
      path: "/payment-history",
      show: true,
    },
    {
      icon: Shield,
      label: "Admin Dashboard",
      path: "/admin",
      show: userRole === "admin",
    },
    {
      icon: UserCog,
      label: "Host Verification",
      path: "/admin/verification",
      show: userRole === "admin",
    },
    {
      icon: CreditCard,
      label: "Payment Verification",
      path: "/admin/payment-verification",
      show: userRole === "admin",
    },
    {
      icon: Shield,
      label: "Set Referral Commission",
      path: "/admin/referral-settings",
      show: userRole === "admin",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-48 mb-8" />
          <Card className="max-w-2xl mx-auto">
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
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
      <main className="flex-1 container mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold mb-2 text-foreground">Account</h1>
          <p className="text-lg text-muted-foreground mb-8">{userName}</p>

          <Card>
            <div className="divide-y divide-border">
              {menuItems.map((item) => {
                if (!item.show) return null;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <item.icon className="h-5 w-5 text-primary" />
                      <span className="font-medium text-foreground">{item.label}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                );
              })}

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-4">
                  <LogOut className="h-5 w-5 text-destructive" />
                  <span className="font-medium text-destructive">Log Out</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}
