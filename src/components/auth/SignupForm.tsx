import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Sparkles, Mail, Loader2, ArrowLeft } from "lucide-react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { generateStrongPassword } from "@/lib/passwordUtils";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const generateUserFriendlyId = (email: string): string => {
  const username = email.split("@")[0];
  const cleanName = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s.-]/g, "")
    .replace(/[\s.]+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 20);

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${cleanName}-${code}`;
};

type FormErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
  otp?: string;
};

type SignupStep = "form" | "verify";

interface SignupFormProps {
  onSwitchToLogin?: () => void;
}

export const SignupForm = ({ onSwitchToLogin }: SignupFormProps) => {
  const [step, setStep] = useState<SignupStep>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<string>("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generatedUserId, setGeneratedUserId] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const inputClass =
    "h-11 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/50 focus:bg-white/15";
  const labelClass = "text-sm font-medium text-white/80";
  const errorClass = "text-xs text-red-300";

  const handleGoogleSignUp = async () => {
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
        title: "Google Sign-Up failed",
        description: error.message,
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const validatePassword = (
    pwd: string
  ): { valid: boolean; message?: string } => {
    if (pwd.length < 8)
      return {
        valid: false,
        message: "Password must be at least 8 characters long",
      };
    if (!/[A-Z]/.test(pwd))
      return {
        valid: false,
        message: "Must contain at least one uppercase letter",
      };
    if (!/[a-z]/.test(pwd))
      return {
        valid: false,
        message: "Must contain at least one lowercase letter",
      };
    if (!/[0-9]/.test(pwd))
      return { valid: false, message: "Must contain at least one number" };
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd))
      return {
        valid: false,
        message: "Must contain at least one special character",
      };
    return { valid: true };
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords don't match" });
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setErrors({ password: passwordValidation.message });
      return;
    }

    setLoading(true);

    try {
      const friendlyUserId = generateUserFriendlyId(email);
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", friendlyUserId)
        .single();

      const finalUserId = existingProfile
        ? generateUserFriendlyId(email + Math.random())
        : friendlyUserId;
      setGeneratedUserId(finalUserId);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, gender, friendly_id: finalUserId },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      setStep("verify");
    } catch (error: any) {
      setErrors({ email: error.message });
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (code.length !== 6) {
      setErrors({ otp: "Please enter the complete 6-digit code" });
      return;
    }

    setVerifying(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      setErrors({ otp: error.message || "Invalid verification code" });
      toast({
        title: "Verification failed",
        description: error.message || "Invalid code",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      toast({
        title: "Code resent",
        description: "Check your email for the new code.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to resend",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword();
    setPassword(newPassword);
    setConfirmPassword(newPassword);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  // OTP Verification step
  if (step === "verify") {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <Mail className="h-7 w-7 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white">Check your email</h3>
          <p className="text-sm text-white/60">
            We sent a 6-digit code to{" "}
            <strong className="text-white">{email}</strong>
          </p>
          {generatedUserId && (
            <p className="text-xs font-mono text-white bg-white/10 py-2 px-3 rounded-lg inline-block">
              Your ID: {generatedUserId}
            </p>
          )}
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

          {errors.otp && (
            <p className={`${errorClass} text-center`}>{errors.otp}</p>
          )}

          {verifying && (
            <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying...
            </div>
          )}

          <div className="text-center">
            <p className="text-sm text-white/60 mb-1">
              Didn't receive the code?
            </p>
            <Button
              variant="link"
              onClick={handleResendCode}
              disabled={resending}
              className="text-sm p-0 h-auto text-white hover:text-white/80"
            >
              {resending ? "Sending..." : "Resend code"}
            </Button>
          </div>

          <button
            onClick={() => setStep("form")}
            className="flex items-center justify-center gap-2 w-full text-sm text-white/50 hover:text-white transition-colors py-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to signup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Google Sign Up */}
      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={googleLoading}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60"
      >
        {googleLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-white/70" />
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        {googleLoading ? "Connecting..." : "Sign up with Google"}
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-transparent px-3 text-white/40 font-medium">
            or sign up with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="name" className={labelClass}>
              Full name
            </Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} ${errors.name ? "border-red-400" : ""}`}
              required
            />
            {errors.name && <p className={errorClass}>{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender" className={labelClass}>
              Gender
            </Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger
                className={`h-11 rounded-xl bg-white/10 border-white/20 text-white`}
              >
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">
                  Prefer not to say
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-email" className={labelClass}>
            Email address
          </Label>
          <Input
            id="signup-email"
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
            <Label htmlFor="signup-password" className={labelClass}>
              Password
            </Label>
            <button
              type="button"
              onClick={handleGeneratePassword}
              className="flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Generate
            </button>
          </div>
          <div className="relative">
            <Input
              id="signup-password"
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
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <PasswordStrength password={password} />
          {errors.password && <p className={errorClass}>{errors.password}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className={labelClass}>
            Confirm password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`${inputClass} pr-10 ${errors.confirmPassword ? "border-red-400" : ""}`}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className={errorClass}>{errors.confirmPassword}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-11 rounded-xl text-sm font-semibold bg-white text-gray-900 hover:bg-white/90"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </Button>

        <p className="text-center text-xs text-white/40 leading-relaxed">
          By signing up, you agree to our{" "}
          <a href="/terms" className="text-white/70 hover:text-white underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            className="text-white/70 hover:text-white underline"
          >
            Privacy Policy
          </a>
          .
        </p>
      </form>
    </div>
  );
};