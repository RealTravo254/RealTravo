import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, Sparkles, AlertTriangle, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { generateStrongPassword } from "@/lib/passwordUtils";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const ForgotPassword = () => {
  const [step, setStep] = useState<'email' | 'verify' | 'reset'>('email');
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const validatePassword = (pwd: string): { valid: boolean; message?: string } => {
    if (pwd.length < 8) return { valid: false, message: "Password must be at least 8 characters long" };
    if (!/[A-Z]/.test(pwd)) return { valid: false, message: "Add at least one uppercase letter" };
    if (!/[0-9]/.test(pwd)) return { valid: false, message: "Add at least one number" };
    if (!/[!@#$%^&*()]/.test(pwd)) return { valid: false, message: "Add one special character" };
    return { valid: true };
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCanResend(true);
    }
  }, [countdown]);

  const handleBackToAuthForm = () => {
    navigate("/auth", { state: { returnToSlideIndex: 3 } });
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      });
      if (error) throw error;
      toast({ title: "Check your inbox!", description: "A 6-digit code has been sent." });
      setStep('verify');
      setCountdown(60);
      setCanResend(false);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (code.length !== 6) return;
    setVerifying(true);
    setError("");
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw error;
      setStep('reset');
    } catch (error: any) {
      setError("Invalid or expired code");
    } finally {
      setVerifying(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Passwords don't match"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Success!", description: "Password updated successfully." });
      setTimeout(() => navigate("/auth"), 1500);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const AuthHeader = ({ icon: Icon, title, subtitle }: { icon: any, title: string, subtitle: string }) => (
    <div className="flex flex-col items-center mb-4 flex-shrink-0">
      <div className="bg-[rgb(0,128,128)]/10 p-3 rounded-full mb-3 shadow-inner">
        <Icon className="h-6 w-6 text-[rgb(0,128,128)]" />
      </div>
      <h1 className="text-xl font-extrabold text-white tracking-tight text-center">{title}</h1>
      <p className="text-xs font-medium text-slate-400 mt-1 text-center px-2 leading-relaxed">
        {subtitle}
      </p>
    </div>
  );

  return (
    /* FIXED OVERLAY WRAPPER: Force breaks out of any buggy layout components or injected global bottom tabs */
    <div 
      className="fixed inset-0 z-[9999] w-screen h-screen flex flex-col justify-center items-center overflow-hidden bg-[#070A13] text-slate-100 antialiased font-sans selection:bg-teal-500/20 px-4"
      style={{
        backgroundImage: "url('/images/category-campsite.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Absolute Dark Vignette Layer over image background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070A13]/95 via-[#070A13]/85 to-[#070A13]/95 lg:bg-gradient-to-tr lg:from-[#070A13]/95 lg:via-[#070A13]/75 lg:to-black/40 z-0" />

      {/* Top Navigation Header Controls */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4 lg:p-8">
        <button
          type="button"
          onClick={handleBackToAuthForm}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/40 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-900/80 hover:border-white/20 backdrop-blur-md transition-all duration-200 shadow-sm group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-xs font-semibold">Back to Login</span>
        </button>
        
        <div className="flex flex-col text-right">
          <span className="text-lg lg:text-xl font-black text-[rgb(0,128,128)] tracking-wide">RealTravo</span>
          <span className="text-[8px] lg:text-[9px] text-slate-500 font-mono">WWW.REALTRAVO.COM</span>
        </div>
      </div>

      {/* Main Glassmorphic Form Card Assembly */}
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="bg-slate-950/45 backdrop-blur-2xl border border-white/10 rounded-xl p-6 lg:p-8 space-y-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] transform transition-all duration-500 scale-[1.01] h-auto max-h-[80vh] flex flex-col overflow-hidden">
          
          {/* Internal Step Routing Return Link */}
          <button 
            type="button"
            onClick={() => step === 'email' ? handleBackToAuthForm() : setStep('email')}
            className="text-[10px] font-semibold text-slate-400 hover:text-[rgb(0,128,128)] flex items-center gap-1 transition-colors flex-shrink-0 w-max"
          >
            <ArrowLeft className="w-3 h-3" /> {step === 'email' ? "Back to sign in" : "Back to recovery input"}
          </button>

          {/* Secure Form Scrolling Port */}
          <div className="mt-1 text-slate-200 overflow-y-auto pr-1 overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            
            {step === 'email' && (
              <form onSubmit={handleSendCode} className="space-y-4 pt-1">
                <AuthHeader icon={Mail} title="Account Recovery" subtitle="Enter your email to receive a temporary 6-digit access token." />
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-0.5">Email Address</Label>
                  <Input 
                    type="email" 
                    className="rounded-lg border-white/10 bg-black/40 text-slate-100 placeholder:text-slate-500 h-11 focus:border-[rgb(0,128,128)] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors" 
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <PrimaryButton loading={loading} text="Send Recovery Code" disabled={!email} />
              </form>
            )}

            {step === 'verify' && (
              <div className="space-y-6 pt-1">
                <AuthHeader icon={CheckCircle2} title="Verification" subtitle={`Enter the verification token dispatched to ${email}`} />
                
                <div className="flex justify-center py-2">
                  <InputOTP maxLength={6} value={otp} onChange={(v) => { setOtp(v); if (v.length === 6) handleVerifyOtp(v); }}>
                    <InputOTPGroup className="gap-1.5">
                      {[0,1,2,3,4,5].map((i) => (
                        <InputOTPSlot 
                          key={i} 
                          index={i} 
                          className="w-10 h-12 rounded-lg border-white/10 bg-black/30 text-base font-bold text-[rgb(0,128,128)] focus:border-[rgb(0,128,128)]" 
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {verifying && (
                  <div className="flex justify-center items-center gap-2 text-[10px] font-bold text-[rgb(0,128,128)] uppercase tracking-widest animate-pulse">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying Code
                  </div>
                )}

                <div className="text-center space-y-2 pt-2">
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    Didn't receive code? {countdown > 0 ? `Wait ${countdown}s` : ""}
                  </p>
                  <Button 
                    variant="ghost" 
                    disabled={!canResend} 
                    onClick={handleSendCode}
                    className="text-[rgb(0,128,128)] hover:text-teal-400 font-bold uppercase text-[10px] tracking-widest h-auto py-0 hover:bg-transparent"
                  >
                    Resend Code
                  </Button>
                </div>
              </div>
            )}

            {step === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4 pt-1">
                <AuthHeader icon={Lock} title="New Password" subtitle="Choose a strong, unique password to secure your updated credentials." />
                
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center px-0.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">New Password</Label>
                      <button 
                        type="button" 
                        onClick={() => {
                          const p = generateStrongPassword();
                          setNewPassword(p); 
                          setConfirmPassword(p);
                        }} 
                        className="text-[9px] font-extrabold text-teal-400 hover:text-teal-300 uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="h-3 w-3"/> Auto-Generate
                      </button>
                    </div>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        className="rounded-lg border-white/10 bg-black/40 text-slate-100 h-11 pr-10 focus:border-[rgb(0,128,128)] focus:ring-0 focus-visible:ring-0 transition-colors"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="pt-1 opacity-80">
                      <PasswordStrength password={newPassword} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-0.5">Confirm Password</Label>
                    <div className="relative">
                      <Input 
                        type={showConfirmPassword ? "text" : "password"} 
                        className="rounded-lg border-white/10 bg-black/40 text-slate-100 h-11 pr-10 focus:border-[rgb(0,128,128)] focus:ring-0 focus-visible:ring-0 transition-colors"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/20 flex items-center gap-2 text-red-400 text-[10px] font-semibold uppercase tracking-tight">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
                  </div>
                )}

                <PrimaryButton loading={loading} text="Update Password" disabled={loading || newPassword !== confirmPassword || !validatePassword(newPassword).valid} />
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

const PrimaryButton = ({ text, loading, disabled }: { text: string, loading?: boolean, disabled?: boolean }) => (
  <Button 
    type="submit" 
    disabled={disabled || loading}
    className="w-full py-2.5 px-4 rounded-lg text-xs font-bold tracking-wide uppercase bg-[rgb(0,128,128)] text-white hover:bg-teal-700 active:scale-[0.99] transition-all duration-200 shadow-lg shadow-teal-950/50 border-none mt-2 flex items-center justify-center gap-2"
  >
    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : text}
  </Button>
);

export default ForgotPassword;