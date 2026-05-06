import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, ArrowLeft, ShieldCheck } from "lucide-react";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

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

  if (loading) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* Decorative Header Background */}
      <div className="h-48 w-full bg-[#008080] relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="container px-4 h-full flex items-end pb-12">
           <Button 
            onClick={() => navigate(-1)} 
            className="rounded-full bg-white/20 backdrop-blur-md text-white border-none w-10 h-10 p-0 hover:bg-white/30 mb-4"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <main className="container px-4 mx-auto -mt-16 relative z-50">
        <Card className="bg-white rounded-[40px] p-8 md:p-12 shadow-2xl border-none">
          
          {!verification ? (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-slate-50 rounded-[28px] flex items-center justify-center mx-auto border border-slate-100">
                <ShieldCheck className="h-10 w-10 text-slate-300" />
              </div>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter leading-none mb-3" style={{ color: COLORS.TEAL }}>
                  Identity Status
                </h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Safety & Trust</p>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                To start hosting experiences, you'll need to verify your identity with our community team.
              </p>
              <Button 
                onClick={() => navigate("/host-verification")}
                className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none mt-4"
                style={{ 
                    background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
                    boxShadow: `0 12px 24px -8px ${COLORS.CORAL}88`
                }}
              >
                Start Verification
              </Button>
            </div>
          ) : (
            <>
              {verification.status === "pending" && (
                <div className="text-center space-y-6">
                  <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-dashed border-[#F0E68C] animate-spin-slow" />
                    <div className="absolute inset-2 bg-[#F0E68C]/20 rounded-full flex items-center justify-center">
                      <Clock className="h-10 w-10 text-[#857F3E]" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter leading-none mb-3" style={{ color: COLORS.KHAKI_DARK }}>
                      Review Pending
                    </h1>
                    <p className="text-[10px] font-black text-[#857F3E] uppercase tracking-[0.2em]">In Progress</p>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Our team is currently reviewing your documents. This usually takes 24-48 hours.
                  </p>
                  <div className="bg-[#F0E68C]/10 p-5 rounded-[24px] border border-[#F0E68C]/30 inline-block w-full">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Submitted On</p>
                    <p className="text-sm font-black text-[#857F3E] uppercase">
                        {new Date(verification.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    onClick={() => navigate("/")}
                    className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-[#008080]"
                  >
                    Back to Exploration
                  </Button>
                </div>
              )}

              {verification.status === "approved" && (
                <div className="text-center space-y-6">
                  <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto border-4 border-green-100">
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter leading-none mb-3 text-green-600">
                      You're Verified!
                    </h1>
                    <p className="text-[10px] font-black text-green-500/60 uppercase tracking-[0.2em]">Verified Host</p>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Congratulations! Your identity has been confirmed. You can now list and host amazing experiences.
                  </p>
                  <Button 
                    onClick={() => navigate("/become-host")}
                    className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
                    style={{ 
                        background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #006666 100%)`,
                        boxShadow: `0 12px 24px -8px ${COLORS.TEAL}88`
                    }}
                  >
                    Hosting Dashboard
                  </Button>
                </div>
              )}

              {verification.status === "rejected" && (
                <div className="text-center space-y-6">
                  <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto border-4 border-red-100">
                    <XCircle className="h-12 w-12 text-red-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter leading-none mb-3 text-red-600">
                      Action Required
                    </h1>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em]">Verification Failed</p>
                  </div>
                  <div className="bg-red-50/50 p-6 rounded-[28px] border border-red-100 text-left">
                    <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2">Reviewer Feedback</h4>
                    <p className="text-sm font-medium text-slate-600 italic">"{verification.rejection_reason}"</p>
                  </div>
                  <Button 
                    onClick={() => navigate("/become-host")}
                    className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
                    style={{ 
                        background: `linear-gradient(135deg, ${COLORS.RED} 0%, #CC0000 100%)`,
                        boxShadow: `0 12px 24px -8px ${COLORS.RED}88`
                    }}
                  >
                    Back to Become a Host
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default VerificationStatus;