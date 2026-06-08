import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom"; 
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Sparkles, Mail, Loader2, ArrowLeft, Calendar } from "lucide-react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { generateStrongPassword } from "@/lib/passwordUtils";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const generateUserFriendlyId = (email: string): string => {
  const username = email.split("@")[0];
  const cleanName = username
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s.-]/g, "")
    .replace(/[\s.]+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 20);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${cleanName}-${code}`;
};

const isOver18 = (dob: string): boolean => {
  if (!dob) return false;
  const birth = new Date(dob);
  const today = new Date();
  const age18 = new Date(birth.getFullYear() + 18, birth.getMonth(), birth.getDate());
  return today >= age18;
};

const maxDobDate = (): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split("T")[0];
};

type FormErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
  date_of_birth?: string;
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
  const [dateOfBirth, setDateOfBirth] = useState("");
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
    "h-11 rounded-xl bg-black/30 border-white/10 text-white placeholder:text-white/30 focus:border-white/30 focus:bg-black/50 transition-all duration-200";
  const labelClass = "text-xs font-semibold uppercase tracking-wider text-slate-400";
  const errorClass = "text-xs font-medium text-red-300 mt-1";

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Google Sign-Up failed", description: error.message, variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  const validatePassword = (pwd: string): { valid: boolean; message?: string } => {
    if (pwd.length < 8) return { valid: false, message: "Password must be at least 8 characters long" };
    if (!/[A-Z]/.test(pwd)) return { valid: false, message: "Must contain at least one uppercase letter" };
    if (!/[a-z]/.test(pwd)) return { valid: false, message: "Must contain at least one lowercase letter" };
    if (!/[0-9]/.test(pwd)) return { valid: false, message: "Must contain at least one number" };
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd))
      return { valid: false, message: "Must contain at least one special character" };
    return { valid: true };
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: FormErrors = {};

    if (!dateOfBirth) {
      newErrors.date_of_birth = "Date of birth is required";
    } else if (!isOver18(dateOfBirth)) {
      newErrors.date_of_birth = "You must be 18 years or older to sign up";
    }

    if (password !== confirmPassword) newErrors.confirmPassword = "Passwords don't match";

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) newErrors.password = pwCheck.message;

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setLoading(true);

    try {
      const friendlyUserId = generateUserFriendlyId(email);
      const { data: existing } = await supabase.from("profiles").select("id").eq("id", friendlyUserId).single();
      const finalId = existing ? generateUserFriendlyId(email + Math.random()) : friendlyUserId;
      setGeneratedUserId(finalId);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, gender, date_of_birth: dateOfBirth, friendly_id: finalId },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;

      await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      setStep("verify");
    } catch (error: any) {
      setErrors({ email: error.message });
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (code.length !== 6) { setErrors({ otp: "Please enter the complete 6-digit code" }); return; }
    setVerifying(true);
    setErrors({});
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      setErrors({ otp: error.message || "Invalid verification code" });
      toast({ title: "Verification failed", description: error.message || "Invalid code", variant: "destructive" });
    } finally { setVerifying(false); }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) throw error;
      toast({ title: "Code resent", description: "Check your email for the new code." });
    } catch (error: any) {
      toast({ title: "Failed to resend", description: error.message, variant: "destructive" });
    } finally { setResending(false); }
  };

  const handleGeneratePassword = () => {
    const pw = generateStrongPassword();
    setPassword(pw);
    setConfirmPassword(pw);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  if (step === "verify") {
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
          {generatedUserId && (
            <p className="text-xs font-mono text-slate-300 bg-black/40 border border-white/5 py-1.5 px-3 rounded-lg inline-block">
              User Key: {generatedUserId}
            </p>
          )}
        </div>

        <div className="space-y-5">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={(value) => {
              setOtp(value);
              if (value.length === 6) setTimeout(() => handleVerifyOtp(value), 100);
            }}>
              <InputOTPGroup>
                {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="bg-black/20 text-white border-white/10" />)}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {errors.otp && <p className={`${errorClass} text-center`}>{errors.otp}</p>}

          {verifying && (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-white" />Encrypting entry...
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-slate-500 mb-0.5">Missed the communication?</p>
            <Button variant="link" onClick={handleResendCode} disabled={resending}
              className="text-sm p-0 h-auto text-white underline decoration-white/20 hover:decoration-white transition-all">
              {resending ? "Re-issuing packet..." : "Resend code"}
            </Button>
          </div>

          <button onClick={() => setStep("form")}
            className="flex items-center justify-center gap-2 w-full text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-white transition-colors py-2">
            <ArrowLeft className="w-3.5 h-3.5" />Return to Form Configuration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* OAuth Actions */}
      <button type="button" onClick={handleGoogleSignUp} disabled={googleLoading}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/[0.08] hover:border-white/20 focus:outline-none disabled:opacity-50">
        {googleLoading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : (
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        <span>Sign up with Google</span>
      </button>

      {/* Break Grid Layout */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
        <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
          <span className="bg-transparent px-3 text-slate-500">Secure Direct Credentials</span>
        </div>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        {/* Name Grid Tuple */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name" className={labelClass}>Full name</Label>
            <Input id="name" placeholder="John Doe" value={name}
              onChange={e => setName(e.target.value)}
              className={`${inputClass} ${errors.name ? "border-red-400" : ""}`} required />
            {errors.name && <p className={errorClass}>{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender" className={labelClass}>Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="h-11 rounded-xl bg-black/30 border-white/10 text-white focus:bg-black/50">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-slate-200">
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Chrono Element */}
        <div className="space-y-1.5">
          <Label htmlFor="dob" className={labelClass}>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              Date of Birth <span className="text-slate-500 font-normal lowercase">(Threshold 18+)</span>
            </span>
          </Label>
          <Input
            id="dob"
            type="date"
            value={dateOfBirth}
            onChange={e => setDateOfBirth(e.target.value)}
            max={maxDobDate()}
            className={`${inputClass} ${errors.date_of_birth ? "border-red-400" : ""}`}
            required
          />
          {errors.date_of_birth && <p className={errorClass}>{errors.date_of_birth}</p>}
          {dateOfBirth && !errors.date_of_birth && isOver18(dateOfBirth) && (
            <p className="text-[11px] text-emerald-400 font-medium tracking-wide flex items-center gap-1 mt-1">
              ✓ Access verified (Age clearance set)
            </p>
          )}
        </div>

        {/* Network Vector Endpoint */}
        <div className="space-y-1.5">
          <Label htmlFor="signup-email" className={labelClass}>Email address</Label>
          <Input id="signup-email" type="email" placeholder="identity@domain.com" value={email}
            onChange={e => setEmail(e.target.value)}
            className={`${inputClass} ${errors.email ? "border-red-400" : ""}`} required />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>

        {/* Secret Phrase Vectors */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="signup-password" className={labelClass}>Password</Label>
            <button type="button" onClick={handleGeneratePassword}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors">
              <Sparkles className="h-3 w-3 text-indigo-400" />Generate Secure
            </button>
          </div>
          <div className="relative">
            <Input id="signup-password" type={showPassword ? "text" : "password"} placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              className={`${inputClass} pr-10 ${errors.password ? "border-red-400" : ""}`} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="pt-1">
            <PasswordStrength password={password} />
          </div>
          {errors.password && <p className={errorClass}>{errors.password}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className={labelClass}>Confirm token password</Label>
          <div className="relative">
            <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="••••••••"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className={`${inputClass} pr-10 ${errors.confirmPassword ? "border-red-400" : ""}`} required />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className={errorClass}>{errors.confirmPassword}</p>}
        </div>

        {/* Submission Executable */}
        <Button type="submit"
          className="w-full h-11 rounded-xl text-sm font-bold bg-white text-slate-950 hover:bg-slate-100 transition-all duration-150 shadow-md mt-2"
          disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2 justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
              Provisioning Profile...
            </span>
          ) : "Create Account Instance"}
        </Button>

        {/* Regulatory Footer Metadata */}
        <p className="text-center text-[11px] text-slate-500 leading-relaxed pt-2">
          By triggering confirmation, you pledge adherence to our legal guidelines via our{" "}
          <a href="/terms" className="text-slate-400 hover:text-white underline transition-colors">Terms of Service</a>{" "}
          and standard processing layers highlighted in the{" "}
          <a href="/privacy" className="text-slate-400 hover:text-white underline transition-colors">Privacy Policy</a>.
        </p>
      </form>
    </div>
  );
};