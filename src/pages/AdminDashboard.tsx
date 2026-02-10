import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ChevronRight, 
  ClipboardList, 
  CheckCircle, 
  XCircle, 
  ShieldCheck, 
  ArrowLeft, 
  CalendarCheck,
  LayoutDashboard
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA",
  SLATE_BG: "#F1F5F9"
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [hostVerificationCount, setHostVerificationCount] = useState(0);
  const [bookingsCount, setBookingsCount] = useState(0);

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
      const [pendingTrips, pendingHotels, pendingAdventures] = await Promise.all([
        supabase.from("trips").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
        supabase.from("hotels").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
        supabase.from("adventure_places").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
      ]);

      const totalPending = (pendingTrips.count || 0) + (pendingHotels.count || 0) + (pendingAdventures.count || 0);
      setPendingCount(totalPending);

      const [approvedTrips, approvedHotels, approvedAdventures] = await Promise.all([
        supabase.from("trips").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
        supabase.from("hotels").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
        supabase.from("adventure_places").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
      ]);

      const totalApproved = (approvedTrips.count || 0) + (approvedHotels.count || 0) + (approvedAdventures.count || 0);
      setApprovedCount(totalApproved);

      const [rejectedTrips, rejectedHotels, rejectedAdventures] = await Promise.all([
        supabase.from("trips").select("id", { count: "exact", head: true }).eq("approval_status", "rejected"),
        supabase.from("hotels").select("id", { count: "exact", head: true }).eq("approval_status", "rejected"),
        supabase.from("adventure_places").select("id", { count: "exact", head: true }).eq("approval_status", "rejected"),
      ]);

      const totalRejected = (rejectedTrips.count || 0) + (rejectedHotels.count || 0) + (rejectedAdventures.count || 0);
      setRejectedCount(totalRejected);

      const { count: hostVerificationsPending } = await supabase
        .from("host_verifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      
      setHostVerificationCount(hostVerificationsPending || 0);

      const { count: totalBookings } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true });
      
      setBookingsCount(totalBookings || 0);
    } catch (error) {
      console.error("Error fetching counts:", error);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
      <div className="flex items-center gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-3.5 h-3.5 rounded-full bg-primary animate-[teal-pulse_1.4s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Loading details...</p>
    </div>
  );

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <Header className="hidden md:block" />

      <main className="flex-1 container px-4 py-8 max-w-2xl mx-auto pb-24 md:pb-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-8 rounded-full bg-white shadow-sm border border-slate-100 hover:bg-slate-50 p-2 h-10 w-10 md:w-auto md:px-4"
        >
          <ArrowLeft className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline font-black uppercase text-[10px] tracking-widest">Back</span>
        </Button>

        <div className="flex items-center gap-3 mb-2">
           <div className="p-2 rounded-xl" style={{ backgroundColor: `${COLORS.TEAL}15` }}>
              <LayoutDashboard className="h-5 w-5" style={{ color: COLORS.TEAL }} />
           </div>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">System Console</p>
        </div>
        
        <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-10" style={{ color: COLORS.TEAL }}>
          Listing Review
        </h1>

        <div className="space-y-4">
          <AdminMenuButton 
            onClick={() => navigate("/admin/pending")}
            icon={<ClipboardList className="h-5 w-5" />}
            label="Pending Approval"
            count={pendingCount}
            activeColor={COLORS.CORAL}
          />

          <AdminMenuButton 
            onClick={() => navigate("/admin/approved")}
            icon={<CheckCircle className="h-5 w-5" />}
            label="Approved Listings"
            count={approvedCount}
            activeColor={COLORS.TEAL}
          />

          <AdminMenuButton 
            onClick={() => navigate("/admin/rejected")}
            icon={<XCircle className="h-5 w-5" />}
            label="Rejected Listings"
            count={rejectedCount}
            activeColor={COLORS.RED}
          />

          <div className="pt-4 pb-2">
            <hr className="border-slate-200" />
          </div>

          <AdminMenuButton 
            onClick={() => navigate("/admin/verification")}
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Host Details Review"
            count={hostVerificationCount}
            activeColor={COLORS.KHAKI_DARK}
          />

          <AdminMenuButton 
            onClick={() => navigate("/admin/all-bookings")}
            icon={<CalendarCheck className="h-5 w-5" />}
            label="All Bookings"
            count={bookingsCount}
            activeColor="#2D3748"
          />
        </div>
      </main>
      
      <MobileBottomBar />
    </div>
  );
};

const AdminMenuButton = ({ onClick, icon, label, count, activeColor }: { 
  onClick: () => void, 
  icon: React.ReactNode, 
  label: string, 
  count: number,
  activeColor: string 
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group active:scale-[0.98]"
  >
    <div className="flex items-center gap-4">
      <div 
        className="p-3 rounded-2xl transition-colors group-hover:bg-opacity-20"
        style={{ backgroundColor: `${activeColor}15`, color: activeColor }}
      >
        {icon}
      </div>
      <div className="flex flex-col items-start">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Manage</span>
        <span className="font-black text-sm uppercase tracking-tight text-slate-800">{label}</span>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <div 
        className="px-3 py-1 rounded-full text-[10px] font-black"
        style={{ backgroundColor: `${activeColor}10`, color: activeColor, border: `1px solid ${activeColor}20` }}
      >
        {count}
      </div>
      <ChevronRight className="h-5 w-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
    </div>
  </button>
);

export default AdminDashboard;