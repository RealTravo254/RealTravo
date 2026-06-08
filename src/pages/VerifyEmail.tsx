import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Clock, ArrowLeft, CheckCircle2 } from "lucide-react";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Accessing verifyOtp directly from the auth namespace explicitly
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email'
      });

      if (error) throw error;

      toast({
        title: "Verified!",
        description: "Your experience begins now.",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      // Accessing signInWithOtp directly from the auth namespace explicitly
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      });

      if (error) throw error;

      toast({
        title: "Code resent!",
        description: "Check your inbox for the new 6-digit key.",
      });
      
      setCountdown(60);
      setCanResend(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-[#008080] z-0 opacity-10" 
           style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 0% 100%)' }} />

      <main className="container relative z-10 px-4 pt-12 max-w-md mx-auto">
        <Button 
          onClick={() => navigate(-1)} 
          variant="ghost" 
          className="mb-8 text-[#008080] font-black uppercase tracking-widest text-[10px] hover:bg-white/50"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <Card className="p-8 rounded-[32px] border-none shadow-2xl bg-white overflow-hidden">
          <div className="flex flex-col items-center mb-8">
            <div 
              className="w-20 h-20 rounded-[24px] flex items-center justify-center mb-6 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #006666 100%)` }}
            >
              <Mail className="w-10 h-10 text-white" />
            </div>
            
            <Badge className="bg-[#FF7F50] hover:bg-[#FF7F50] border-none px-4 py-1.5 h-auto uppercase font-black tracking-[0.15em] text-[10px] rounded-full shadow-md mb-4">
              Security Check
            </Badge>

            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none text-center mb-3" style={{ color: COLORS.TEAL }}>
              Verify Access
            </h1>
            
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest text-center leading-relaxed">
              6-digit code sent to<br/>
              <span className="text-slate-800 lowercase font-black text-xs">{email}</span>
            </p>
          </div>
          
          <form onSubmit={handleVerify} className="space-y-8">
            <div className="space-y-3">
              <Label 
                htmlFor="code" 
                className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
              >
                Verification Code
              </Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                required
                className="h-20 text-center text-4xl font-black tracking-[0.3em] rounded-2xl border-2 border-slate-100 focus:border-[#008080] focus:ring-0 transition-all bg-slate-50 text-[#008080]"
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading || code.length !== 6}
              className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
              style={{ 
                background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
                boxShadow: `0 12px 24px -8px ${COLORS.CORAL}88`
              }}
            >
              {loading ? "Authenticating..." : "Confirm Code"}
            </Button>

            <div className="pt-4 space-y-4">
              <div className="flex items-center justify-center gap-3 bg-slate-50 py-4 rounded-2xl border border-slate-100">
                {!canResend ? (
                  <>
                    <Clock className="h-4 w-4" style={{ color: COLORS.CORAL }} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      New code in {countdown}s
                    </span>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resending}
                    className="flex items-center gap-2 group"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-500 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-[#857F3E] uppercase tracking-widest hover:text-[#008080]">
                      {resending ? "Sending..." : "Request New Code"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </Card>
      </main>

      <MobileBottomBar />
    </div>
  );
};

const Badge = ({ children, className, style }: any) => (
  <div className={`inline-block ${className}`} style={style}>
    {children}
  </div>
);

export default VerifyEmail;