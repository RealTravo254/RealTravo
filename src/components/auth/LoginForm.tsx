import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button"; 
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Mail, ArrowLeft, ShieldCheck } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type FormErrors = {
  email?: string;
  password?: string;
  otp?: string;
};

type LoginMode = "password" | "otp-send" | "otp-verify";

interface LoginFormProps {
  onSwitchToSignup?: () => void;
}

export const LoginForm = ({ onSwitchToSignup }: LoginFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [mode, setMode] = useState<LoginMode>("password");
  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const returnTo = (location.state as any)?.returnTo || "/";

  // Shared Design System Tokens
  const inputClass =
    "h-11 rounded-xl bg-black/30 border-white/10 text-white placeholder:text-white/30 focus:border-white/30 focus:bg-black/50 transition-all duration-200";
  const labelClass = "text-xs font-semibold uppercase tracking-wider text-slate-400";
  const errorClass = "text-xs font-medium text-red-300 mt-1";

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Google Sign-In failed",
        description: error.message,
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("email not confirmed") ||
          msg.includes("not confirmed") ||
          msg.includes("confirm")
        ) {
          toast({
            title: "Verify your email first",
            description: "Your account isn't verified yet. Requesting a 6-digit confirmation packet.",
          });
          setMode("otp-send");
          setLoading(false);
          await handleSendOtp();
          return;
        }
        
        if (msg.includes("email")) {
          setErrors({ email: error.message });
        } else if (msg.includes("password")) {
          setErrors({ password: error.message });
        } else {
          toast({
            title: "Login failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        navigate(returnTo);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email.trim()) {
      setErrors({ email: "Please enter your email address" });
      return;
    }
    setOtpSending(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      if (error) {
        if (
          error.message.toLowerCase().includes("user") ||
          error.message.toLowerCase().includes("not found") ||
          error.message.toLowerCase().includes("signup")
        ) {
          toast({
            title: "No account found",
            description: "This email isn't registered. Please create an account first.",
            variant: "destructive",
          });
          setErrors({
            email: "No account found with this email. Please sign up.",
          });
        } else {
          throw error;
        }
        return;
      }

      setMode("otp-verify");
      setOtp("");
      toast({
        title: "Code sent!",
        description: "Check your email for the 6-digit verification sequence.",
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (code.length !== 6) {
      setErrors({ otp: "Please enter the complete 6-digit code" });
      return;
    }

    setOtpVerifying(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) throw error;
      navigate(returnTo);
    } catch (error: any) {
      setErrors({ otp: error.message || "Invalid verification code" });
      toast({
        title: "Verification failed",
        description: error.message || "Invalid code",
        variant: "destructive",
      });
    } finally {
      setOtpVerifying(false);
    }
  };

  /* ================= MODE: OTP VERIFY ================= */
  if (mode === "otp-verify") {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-md">
            <Mail className="h-6 w-6 text-slate-200" />
          </div>
          <h3 className="text-xl font-bold text-white">Check your mail</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            We sent a secure code verification packet to <span className="text-white font-semibold">{email}</span>
          </p>
        </div>

        <div className="space-y-5">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => {
                setOtp(value);
                if (value.length === 6) {
                  setTimeout(() => handleVerifyOtp(value), 100);
                }
              }}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="bg-black/20 text-white border-white/10" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {errors.otp && (
            <p className={`${errorClass} text-center`}>{errors.otp}</p>
          )}

          {otpVerifying && (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              Validating session token...
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-slate-500 mb-0.5">Missed the communication?</p>
            <Button
              variant="link"
              onClick={handleSendOtp}
              disabled={otpSending}
              className="text-sm p-0 h-auto text-white underline decoration-white/20 hover:decoration-white transition-all"
            >
              {otpSending ? "Re-issuing packet..." : "Resend code"}
            </Button>
          </div>

          <button
            onClick={() => {
              setMode("otp-send");
              setOtp("");
            }}
            className="flex items-center justify-center gap-2 w-full text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-white transition-colors py-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Request Layer
          </button>
        </div>
      </div>
    );
  }

  /* ================= MODE: OTP SEND ================= */
  if (mode === "otp-send") {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-white">Passwordless Entry</h3>
          <p className="text-sm text-slate-400">
            Provide your email to receive a dynamic session passphrase code.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="otp-email" className={labelClass}>
              Email address
            </Label>
            <Input
              id="otp-email"
              type="email"
              placeholder="identity@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} ${errors.email ? "border-red-400" : ""}`}
              required
            />
            {errors.email && <p className={errorClass}>{errors.email}</p>}
          </div>

          <Button
            onClick={handleSendOtp}
            className="w-full h-11 rounded-xl text-sm font-bold bg-white text-slate-950 hover:bg-slate-100 transition-all duration-150 shadow-md"
            disabled={otpSending}
          >
            {otpSending ? (
              <span className="flex items-center gap-2 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                Dispatching Packet...
              </span>
            ) : (
              "Request Authorization Code"
            )}
          </Button>

          <button
            onClick={() => setMode("password")}
            className="flex items-center justify-center gap-2 w-full text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-white transition-colors py-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to direct credentials
          </button>
        </div>
      </div>
    );
  }

  /* ================= MODE: PASSWORD (DEFAULT) ================= */
  return (
    <div className="space-y-5 animate-fade-in">
      {/* OAuth Action Container */}
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/[0.08] hover:border-white/20 focus:outline-none disabled:opacity-50"
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span>Sign in with Google</span>
        </button>

        <button
          type="button"
          onClick={() => setMode("otp-send")}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/[0.08] hover:border-white/20 focus:outline-none"
        >
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          <span>Authenticate with Secure Code</span>
        </button>
      </div>

      {/* Break Grid Layout Line */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/5" />
        </div>
        <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
          <span className="bg-transparent px-3 text-slate-500">Secure Direct Credentials</span>
        </div>
      </div>

      {/* Traditional Form Stack */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className={labelClass}>
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="identity@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} ${errors.email ? "border-red-400" : ""}`}
            required
          />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className={labelClass}>
              Password
            </Label>
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-[11px] font-semibold text-slate-500 hover:text-white transition-colors"
            >
              Forgot secret phrase?
            </button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-10 ${errors.password ? "border-red-400" : ""}`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className={errorClass}>{errors.password}</p>}
        </div>

        <Button
          type="submit"
          className="w-full h-11 rounded-xl text-sm font-bold bg-white text-slate-950 hover:bg-slate-100 transition-all duration-150 shadow-md mt-2"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2 justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
              Verifying Instance...
            </span>
          ) : (
            "Authenticate Session"
          )}
        </Button>
      </form>

      {/* Interactive Switcher */}
      <p className="text-center text-xs text-slate-400 font-medium pt-2">
        New Explorer?{" "}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="text-white underline decoration-white/20 hover:decoration-white font-bold transition-all ml-0.5"
        >
          Create an entry instance
        </button>
      </p>
    </div>
  );
};