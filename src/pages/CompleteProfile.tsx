import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Eye, EyeOff, Loader2, Mail, CheckCircle } from "lucide-react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { PhoneInput } from "@/components/profile/PhoneInput";

type Step = 'profile' | 'verify' | 'complete';

export default function CompleteProfile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('profile');
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setCheckingProfile(false);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_completed, name')
        .eq('id', user.id)
        .single();

      if (profile?.profile_completed) {
        navigate('/');
        return;
      }
      if (user.user_metadata?.full_name || user.user_metadata?.name) {
        setName(user.user_metadata?.full_name || user.user_metadata?.name || '');
      } else if (profile?.name) {
        setName(profile.name);
      }
      setCheckingProfile(false);
    };
    if (!authLoading) checkProfile();
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return { valid: false, message: "Password must be at least 8 characters" };
    if (!/[A-Z]/.test(pwd)) return { valid: false, message: "Must contain uppercase letter" };
    if (!/[a-z]/.test(pwd)) return { valid: false, message: "Must contain lowercase letter" };
    if (!/[0-9]/.test(pwd)) return { valid: false, message: "Must contain a number" };
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) return { valid: false, message: "Must contain special character" };
    return { valid: true };
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!name.trim()) { setErrors({ name: "Name is required" }); return; }
    if (!phoneNumber.trim()) { setErrors({ phone: "Phone number is required" }); return; }
    if (!password) { setErrors({ password: "Password is required" }); return; }
    const pv = validatePassword(password);
    if (!pv.valid) { setErrors({ password: pv.message! }); return; }
    if (password !== confirmPassword) { setErrors({ confirmPassword: "Passwords don't match" }); return; }

    setLoading(true);
    try {
      await supabase.auth.updateUser({ password });
      await supabase.from('profiles').update({ name: name.trim(), phone_number: phoneNumber.trim() }).eq('id', user!.id);
      await supabase.auth.signInWithOtp({ email: user!.email!, options: { shouldCreateUser: false } });
      toast({ title: "Verification code sent!", description: `Check ${user!.email}` });
      setStep('verify');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const c = code || otp;
    if (c.length !== 6) { setErrors({ otp: "Enter 6-digit code" }); return; }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: user!.email!, token: c, type: 'email' });
      if (error) throw error;
      await supabase.from('profiles').update({ profile_completed: true, phone_verified: true }).eq('id', user!.id);
      setStep('complete');
      toast({ title: "Profile completed!" });
      setTimeout(() => navigate('/'), 2000);
    } catch (error: any) {
      setErrors({ otp: error.message || "Invalid code" });
    } finally {
      setVerifying(false);
    }
  };

  const handleSkip = async () => {
    await supabase.from('profiles').update({ profile_completed: true }).eq('id', user!.id);
    navigate('/');
  };

  if (authLoading || checkingProfile) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/fulllogo.png" alt="Realtravo" className="h-12 mx-auto mb-4" />
          <CardTitle>{step === 'complete' ? 'Welcome!' : 'Complete Your Profile'}</CardTitle>
          <CardDescription>
            {step === 'profile' && "A few more details to get started"}
            {step === 'verify' && `Verify: ${user?.email}`}
            {step === 'complete' && "You're all set!"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className={errors.name ? "border-destructive" : ""} />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>
              <PhoneInput value={phoneNumber} onChange={setPhoneNumber} country="Kenya" label="Phone Number" />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
              <div className="space-y-2">
                <Label>Set Password</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={errors.password ? "border-destructive" : ""} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrength password={password} />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={errors.confirmPassword ? "border-destructive" : ""} />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Continue"}
              </Button>
            </form>
          )}
          {step === 'verify' && (
            <div className="space-y-6 text-center">
              <Mail className="h-12 w-12 text-primary mx-auto" />
              <InputOTP maxLength={6} value={otp} onChange={(v) => { setOtp(v); if (v.length === 6) handleVerifyOtp(v); }}>
                <InputOTPGroup className="mx-auto">
                  {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
              {errors.otp && <p className="text-sm text-destructive">{errors.otp}</p>}
              {verifying && <Loader2 className="h-4 w-4 animate-spin mx-auto" />}
              <Button variant="link" onClick={async () => { setResending(true); await supabase.auth.signInWithOtp({ email: user!.email!, options: { shouldCreateUser: false } }); setResending(false); }} disabled={resending}>
                {resending ? "Sending..." : "Resend code"}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('profile')} className="flex-1">Back</Button>
                <Button variant="ghost" onClick={handleSkip} className="flex-1">Skip</Button>
              </div>
            </div>
          )}
          {step === 'complete' && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
