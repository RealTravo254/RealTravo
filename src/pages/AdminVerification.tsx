import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Clock, CheckCircle, XCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

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
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12">
          <Skeleton className="h-12 w-64 mb-8 rounded-2xl" />
          <div className="space-y-4 mx-auto">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-[28px]" />
            ))}
          </div>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col pb-24">
      <Header className="hidden md:block" />

      <main className="flex-1 container mx-auto px-4 pt-8 md:pt-12">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-6 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-50 px-6 font-black uppercase text-[10px] tracking-widest"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#008080] hover:bg-[#008080] border-none px-3 py-1 uppercase font-black tracking-widest text-[9px] rounded-full text-white">
                Admin Control
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight text-slate-900">
              Host Verification
            </h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
              Security & Compliance Dashboard
            </p>
          </div>
        </div>

        <div className="grid gap-4 mx-auto">
          {/* Pending Requests */}
          <VerificationCard
            label="Pending Approval"
            count={pendingCount}
            icon={<Clock className="h-6 w-6" />}
            color={COLORS.CORAL}
            onClick={() => navigate("/admin/verification/list/pending")}
            description="Needs immediate review"
          />

          {/* Approved Hosts */}
          <VerificationCard
            label="Verified Hosts"
            count={approvedCount}
            icon={<ShieldCheck className="h-6 w-6" />}
            color={COLORS.TEAL}
            onClick={() => navigate("/admin/verification/list/approved")}
            description="Access granted to platform"
          />

          {/* Rejected Requests */}
          <VerificationCard
            label="Rejected Files"
            count={rejectedCount}
            icon={<XCircle className="h-6 w-6" />}
            color={COLORS.RED}
            onClick={() => navigate("/admin/verification/list/rejected")}
            description="Declined applications"
          />
        </div>

        <div className="mt-12 p-8 rounded-[32px] bg-white border border-slate-100 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: COLORS.TEAL }}>Admin Note</h2>
          <p className="text-slate-500 text-xs leading-relaxed font-medium">
            Verifying hosts ensures the safety of our community. Please cross-reference all government ID documents with the provided profile information before granting access.
          </p>
        </div>
      </main>

      <MobileBottomBar />
    </div>
  );
};

// Sub-component for the menu items
const VerificationCard = ({ label, count, icon, color, onClick, description }: any) => (
  <button
    onClick={onClick}
    className="group relative w-full flex items-center justify-between p-6 bg-white rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300 text-left overflow-hidden"
  >
    <div className="flex items-center gap-5">
      <div 
        className="p-4 rounded-2xl transition-colors duration-300"
        style={{ backgroundColor: `${color}15`, color: color }}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 leading-none mb-1">
          {label}
        </h3>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {description}
        </p>
      </div>
    </div>
    
    <div className="flex items-center gap-4">
      <span className="text-3xl font-black italic tracking-tighter" style={{ color: color }}>
        {count}
      </span>
      <div className="h-10 w-10 rounded-full flex items-center justify-center bg-slate-50 group-hover:bg-slate-900 group-hover:text-white transition-colors">
        <ChevronRight className="h-5 w-5" />
      </div>
    </div>

    {/* Subtle progress underline */}
    <div 
      className="absolute bottom-0 left-0 h-1 transition-all duration-500 w-0 group-hover:w-full"
      style={{ backgroundColor: color }}
    />
  </button>
);

export default AdminVerification;