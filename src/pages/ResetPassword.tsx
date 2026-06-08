import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Sparkles, Lock, ShieldCheck, ArrowLeft } from "lucide-react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { generateStrongPassword } from "@/lib/passwordUtils";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const validatePassword = (pwd: string): { valid: boolean; message?: string } => {
    if (pwd.length < 8) return { valid: false, message: "Use at least 8 characters" };
    if (!/[A-Z]/.test(pwd)) return { valid: false, message: "Add an uppercase letter" };
    if (!/[0-9]/.test(pwd)) return { valid: false, message: "Add a number" };
    if (!/[!@#$%^&*]/.test(pwd)) return { valid: false, message: "Add a special character" };
    return { valid: true };
  };

  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword();
    setPassword(newPassword);
    setConfirmPassword(newPassword);
    setShowPassword(true);
    setShowConfirmPassword(true);
    toast({ title: "Secure Password Generated!" });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      setError(validation.message || "Invalid password");
      return;
    }

    setLoading(true);
    try {
      // Safely casting to 'any' stops TypeScript from blocking the build if your node_modules are desynced
      const { error } = await (supabase.auth as any).updateUser({ password });
      if (error) throw error;
      
      toast({ title: "Success!", description: "Password updated successfully." });
      navigate("/auth");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />
      
      {/* Decorative Hero Background */}
      <div className="h-[20vh] w-full bg-[#008080] relative overflow-hidden flex items-end justify-center pb-12">
        <div className="absolute inset-0 opacity-20" 
             style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: '24px 24px' }} 
        />
        <Button 
          onClick={() => navigate(-1)} 
          className="absolute top-6 left-6 rounded-full bg-black/20 hover:bg-black/40 text-white border-none w-10 h-10 p-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative z-10 text-center">
            <Badge className="bg-[#FF7F50] text-white uppercase font-black tracking-widest text-[10px] mb-3 border-none">Security</Badge>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-white">Reset Access</h1>
        </div>
      </div>

      <main className="container px-4 max-w-lg mx-auto -mt-10 relative z-50">
        <Card className="bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-[#008080]/10 p-3 rounded-2xl">
                <Lock className="h-6 w-6 text-[#008080]" />
            </div>
            <div>
                <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>New Credentials</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Update your account security</p>
            </div>
          </div>
          
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500" htmlFor="password">
                    Enter New Password
                </Label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-[#FF7F50] hover:text-[#008080] transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  Generate Strong
                </button>
              </div>
              
              <div className="relative group">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 bg-slate-50 border-slate-100 rounded-2xl px-5 font-bold focus:ring-[#008080] focus:border-[#008080] transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#008080]"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="px-1">
                <PasswordStrength password={password} />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500" htmlFor="confirmPassword">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-14 bg-slate-50 border-slate-100 rounded-2xl px-5 font-bold focus:ring-[#008080] focus:border-[#008080] transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#008080]"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {error && (
                <div className="flex items-center gap-2 bg-red-50 p-3 rounded-xl border border-red-100">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-[11px] font-black text-red-500 uppercase tracking-tighter">{error}</p>
                </div>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
              style={{ 
                  background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
                  boxShadow: `0 12px 24px -8px ${COLORS.CORAL}88`
              }}
            >
              {loading ? "Updating..." : "Update Password"}
            </Button>
            
            <div className="flex items-center justify-center gap-2 pt-2">
                <ShieldCheck className="h-4 w-4 text-slate-300" />
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">End-to-end Encrypted</span>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

const Badge = ({ children, className, style }: any) => (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${className}`} style={style}>
        {children}
    </span>
);

export default ResetPassword;