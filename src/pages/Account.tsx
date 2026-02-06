import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { 
  ChevronRight, User, Briefcase, CreditCard, Shield, 
  LogOut, UserCog, Users, ArrowLeft, Receipt, 
  CalendarCheck, Crown, Settings 
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// Constant Theme Colors matching EventDetail
const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

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
        // Fetch profile and roles in parallel
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("name").eq("id", user.id).single(),
          supabase.from("user_roles").select("role").eq("user_id", user.id)
        ]);
        
        if (profileRes.data) setUserName(profileRes.data.name);

        if (rolesRes.data && rolesRes.data.length > 0) {
          const roleList = rolesRes.data.map(r => r.role);
          setUserRole(roleList.includes("admin") ? "admin" : "user");
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
    { section: "Host Tools", items: [
      { icon: Briefcase, label: "Become a Host", path: "/become-host", show: true },
      { icon: CalendarCheck, label: "My Host Bookings", path: "/host-bookings", show: true },
    ]},
    { section: "Personal", items: [
      { icon: User, label: "Edit Profile", path: "/profile/edit", show: true },
      { icon: Users, label: "My Referrals", path: "/my-referrals", show: true },
      { icon: CreditCard, label: "Payment Methods", path: "/payment", show: true },
      { icon: Receipt, label: "Payment History", path: "/payment-history", show: true },
    ]},
    { section: "Admin Control", items: [
      { icon: Shield, label: "Admin Dashboard", path: "/admin", show: userRole === "admin" },
      { icon: UserCog, label: "Host Verification", path: "/admin/verification", show: userRole === "admin" },
      { icon: CreditCard, label: "Payment Verification", path: "/admin/payment-verification", show: userRole === "admin" },
      { icon: Settings, label: "Referral Settings", path: "/admin/referral-settings", show: userRole === "admin" },
      { icon: CalendarCheck, label: "All Bookings", path: "/admin/all-bookings", show: userRole === "admin" },
      { icon: Users, label: "Accounts Overview", path: "/admin/accounts", show: userRole === "admin" },
    ]}
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-32 w-full rounded-[28px] mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-[20px]" />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <Header className="hidden md:block" />

      <main className="flex-1 container max-w-2xl mx-auto px-4 py-8 pb-32">
        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Button 
            onClick={() => navigate(-1)} 
            className="rounded-full bg-white shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-50 h-10 w-10 p-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-black uppercase tracking-tighter" style={{ color: COLORS.TEAL }}>
            My Account
          </h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* User Profile Card */}
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Crown size={80} style={{ color: COLORS.TEAL }} />
          </div>
          
          <div className="relative z-10 flex items-center gap-5">
            <div 
              className="h-20 w-20 rounded-[24px] flex items-center justify-center shadow-inner"
              style={{ backgroundColor: `${COLORS.TEAL}15` }}
            >
              <span className="text-3xl font-black" style={{ color: COLORS.TEAL }}>
                {userName?.charAt(0) || "U"}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black text-[#FF7F50] uppercase tracking-[0.2em] mb-1">
                Welcome back
              </p>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800">
                {userName || "Explorer"}
              </h2>
              {userRole === "admin" && (
                <span className="inline-block mt-2 px-3 py-1 bg-[#008080] text-white text-[9px] font-black uppercase tracking-widest rounded-full">
                  Administrator
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Menu Sections */}
        <div className="space-y-8">
          {menuItems.map((section, idx) => {
            const visibleItems = section.items.filter(item => item.show);
            if (visibleItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-3">
                <h3 className="ml-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  {section.section}
                </h3>
                <div className="bg-white rounded-[28px] overflow-hidden shadow-sm border border-slate-100 divide-y divide-slate-50">
                  {visibleItems.map((item) => (
                    <button 
                      key={item.path} 
                      onClick={() => navigate(item.path)} 
                      className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-[#F0E68C]/10 group-hover:bg-[#008080] transition-colors">
                          <item.icon className="h-5 w-5 text-[#857F3E] group-hover:text-white" style={{
                            // Only apply default teal if not hovering (CSS handles hover)
                          }} /> 
                        </div>
                        <span className="text-[13px] font-black uppercase tracking-tight text-slate-700">
                          {item.label}
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#008080] transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Logout Button */}
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center justify-between p-6 bg-white rounded-[28px] border border-red-50 shadow-sm hover:bg-red-50/50 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-red-50 group-hover:bg-red-500 transition-colors">
                <LogOut className="h-5 w-5 text-red-500 group-hover:text-white" />
              </div>
              <span className="text-[13px] font-black uppercase tracking-tight text-red-500">
                Log Out
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-red-200 group-hover:text-red-500" />
          </button>
        </div>
      </main>

      <Footer className="hidden md:block" />
      <MobileBottomBar />
    </div>
  );
}