import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Mail, ArrowLeft } from "lucide-react";
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
  const [errors, setErrors] = useState<FormErrors>({});
  const [mode, setMode] = useState<LoginMode>("password");
  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const inputClass = "h-11 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/50 focus:bg-white/15";
  const labelClass = "text-sm font-medium text-white/80";
  const errorClass = "text-xs text-red-300";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = error.message.toLowerCase();
      // If email not confirmed, force the user to verify via code first
      if (msg.includes("email not confirmed") || msg.includes("not confirmed") || msg.includes("confirm")) {
        toast({
          title: "Verify your email first",
          description: "Your account isn't verified yet. We'll send you a 6-digit code to confirm.",
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
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      }
    } else {
      navigate("/");
    }

    setLoading(false);
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
          setErrors({ email: "No account found with this email. Please sign up." });
        } else {
          throw error;
        }
        return;
      }

      setMode("otp-verify");
      setOtp("");
      toast({ title: "Code sent!", description: "Check your email for the 6-digit login code." });
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
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      setErrors({ otp: error.message || "Invalid verification code" });
      toast({ title: "Verification failed", description: error.message || "Invalid code", variant: "destructive" });
    } finally {
      setOtpVerifying(false);
    }
  };

  // OTP Verify step
  if (mode === "otp-verify") {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <Mail className="h-7 w-7 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white">Check your email</h3>
          <p className="text-sm text-white/60">
            We sent a 6-digit code to <strong className="text-white">{email}</strong>
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
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {errors.otp && <p className={`${errorClass} text-center`}>{errors.otp}</p>}

          {otpVerifying && (
            <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying...
            </div>
          )}

          <div className="text-center">
            <p className="text-sm text-white/60 mb-1">Didn't receive the code?</p>
            <Button variant="link" onClick={handleSendOtp} disabled={otpSending} className="text-sm p-0 h-auto text-white hover:text-white/80">
              {otpSending ? "Sending..." : "Resend code"}
            </Button>
          </div>

          <button
            onClick={() => { setMode("otp-send"); setOtp(""); }}
            className="flex items-center justify-center gap-2 w-full text-sm text-white/50 hover:text-white transition-colors py-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>
    );
  }

  // OTP Send step
  if (mode === "otp-send") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold text-white">Login with code</h3>
          <p className="text-sm text-white/60">Enter your registered email and we'll send you a login code</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp-email" className={labelClass}>Email address</Label>
            <Input
              id="otp-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} ${errors.email ? "border-red-400" : ""}`}
              required
            />
            {errors.email && <p className={errorClass}>{errors.email}</p>}
          </div>

          <Button
            onClick={handleSendOtp}
            className="w-full h-11 rounded-xl text-sm font-semibold bg-white text-gray-900 hover:bg-white/90"
            disabled={otpSending}
          >
            {otpSending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending code...</>
            ) : (
              "Send Login Code"
            )}
          </Button>

          <button
            onClick={() => setMode("password")}
            className="flex items-center justify-center gap-2 w-full text-sm text-white/50 hover:text-white transition-colors py-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to password login
          </button>
        </div>
      </div>
    );
  }

  // Password login (default)
  return (
    <div className="space-y-5">
      {/* Login with Code button */}
      <button
        type="button"
        onClick={() => setMode("otp-send")}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        <Mail className="h-5 w-5 text-white/70" />
        Login with Code
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-transparent px-3 text-white/40 font-medium">or continue with password</span>
        </div>
      </div>

      {/* Email + Password form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className={labelClass}>Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} ${errors.email ? "border-red-400" : ""}`}
            required
          />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className={labelClass}>Password</Label>
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-xs font-medium text-white/60 hover:text-white transition-colors"
            >
              Forgot password?
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className={errorClass}>{errors.password}</p>}
        </div>

        <Button
          type="submit"
          className="w-full h-11 rounded-xl text-sm font-semibold bg-white text-gray-900 hover:bg-white/90"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-white/50">
        Don't have an account?{" "}
        <button
          type="button"
          onClick={() => onSwitchToSignup?.()}
          className="font-semibold text-white hover:text-white/80 transition-colors"
        >
          Sign up
        </button>
      </p>
    </div>
  );
};