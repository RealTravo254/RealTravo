// src/pages/CompleteProfile.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Eye,
  EyeOff, 
  Loader2,
  User,
  Phone,
  Globe,
  KeyRound,
  Calendar,
  Users as UsersIcon,
  Check,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { CountrySelector } from "@/components/creation/CountrySelector";

const MIN_AGE = 12;

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

// Cast, same as LoginForm.tsx does — the generated Supabase types on this
// project don't expose signInWithOtp/verifyOtp cleanly.
const clientAuth = (supabase as any).auth;

function calculateAge(dob: string) {
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function validatePassword(pwd: string) {
  if (pwd.length < 8) return "At least 8 characters.";
  if (!/[A-Z]/.test(pwd)) return "Add an uppercase letter.";
  if (!/[a-z]/.test(pwd)) return "Add a lowercase letter.";
  if (!/[0-9]/.test(pwd)) return "Add a number.";
  return null;
}

/* ────────────────────────────────────────────────────────────────
   Small field wrapper — icon chip on the left, label + input on the
   right. Local to this page so it has its own visual identity.
──────────────────────────────────────────────────────────────── */
function FieldRow({
  icon,
  label,
  required,
  hint,
  error,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <Label className="text-[11px] font-bold text-foreground/80 uppercase tracking-wide flex items-center gap-1">
          {label}
          {required ? (
            <span className="h-1 w-1 rounded-full bg-destructive" aria-hidden />
          ) : (
            <span className="text-[9px] font-medium normal-case text-muted-foreground">(optional)</span>
          )}
        </Label>
        {children}
        {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        {error && <p className="text-[11px] text-destructive font-medium">{error}</p>}
      </div>
    </div>
  );
}

type Step = "form" | "verify";

export default function CompleteProfile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryId, setCountryId] = useState<string | null>(null);
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [step, setStep] = useState<Step>("form");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setCheckingProfile(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_completed, first_name, last_name, gender, date_of_birth, phone_number, country_id, division_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.profile_completed) {
        navigate("/");
        return;
      }

      const metaFirst = (user.user_metadata?.first_name as string) || "";
      const metaLast = (user.user_metadata?.last_name as string) || "";
      const metaFull = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || "";
      const [guessFirst, ...guessRest] = metaFull.split(" ");

      setFirstName(profile?.first_name || metaFirst || guessFirst || "");
      setLastName(profile?.last_name || metaLast || guessRest.join(" ") || "");
      if (profile?.gender) setGender(profile.gender);
      if (profile?.date_of_birth) setDateOfBirth(profile.date_of_birth);
      if (profile?.phone_number) setPhoneNumber(profile.phone_number);
      if (profile?.country_id) setCountryId(profile.country_id);
      if (profile?.division_id) setDivisionId(profile.division_id);
      setCheckingProfile(false);
    };
    if (!authLoading) checkProfile();
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // How many required fields are filled — drives the progress dots.
  const requiredDone = [
    firstName.trim(),
    lastName.trim(),
    gender,
    dateOfBirth,
    password && !validatePassword(password) && password === confirmPassword,
  ].filter(Boolean).length;

  // Step 1: validate the form, then email a verification code before anything is saved.
  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};

    if (!firstName.trim()) next.firstName = "First name is required.";
    if (!lastName.trim()) next.lastName = "Surname is required.";
    if (!gender) next.gender = "Please select a gender.";

    if (!dateOfBirth) {
      next.dateOfBirth = "Date of birth is required.";
    } else {
      const age = calculateAge(dateOfBirth);
      if (age === null) next.dateOfBirth = "Enter a valid date.";
      else if (age < MIN_AGE) next.dateOfBirth = `You must be at least ${MIN_AGE} years old.`;
    }

    if (!password) {
      next.password = "Please set a password.";
    } else {
      const pwErr = validatePassword(password);
      if (pwErr) next.password = pwErr;
      else if (password !== confirmPassword) next.confirmPassword = "Passwords don't match.";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    if (!user?.email) {
      toast({ title: "No email on file", description: "We can't send a code without an email address.", variant: "destructive" });
      return;
    }

    setSendingCode(true);
    const { error } = await clientAuth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    });
    setSendingCode(false);

    if (error) {
      toast({ title: "Couldn't send code", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Code sent", description: `We emailed a verification code to ${user.email}.` });
    setOtpError(null);
    setOtpCode("");
    setStep("verify");
  };

  // Step 2: confirm the emailed code, then save everything.
  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setOtpError(null);
    setVerifying(true);

    const { error: verifyError } = await clientAuth.verifyOtp({
      email: user.email,
      token: otpCode,
      type: "magiclink",
    });
    if (verifyError) {
      setOtpError(verifyError.message || "That code isn't right. Check your email and try again.");
      setVerifying(false);
      return;
    }

    setLoading(true);
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;

      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

      const updateData: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        name: fullName,
        gender,
        date_of_birth: dateOfBirth,
        profile_completed: true,
      };
      if (phoneNumber.trim()) updateData.phone_number = phoneNumber.trim();
      if (countryId) {
        updateData.country_id = countryId;
        updateData.division_id = divisionId;
      }

      const { error } = await supabase.from("profiles").update(updateData).eq("id", user!.id);
      if (error) throw error;

      // Best-effort: some pages read a `full_name` column instead of `name`.
      // Ignore failures here in case that column doesn't exist.
      supabase.from("profiles").update({ full_name: fullName }).eq("id", user!.id).then(() => {});

      toast({ title: "You're all set!", description: "Welcome to Realtravo." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Couldn't save your profile", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  };

  if (authLoading || checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d2b4e] flex flex-col">
      {/* Brand band */}
      <div className="relative pt-10 pb-16 px-4 text-center overflow-hidden shrink-0">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #008080 0%, transparent 45%), radial-gradient(circle at 85% 15%, #008080 0%, transparent 40%)",
          }}
        />
        <div className="relative">
          <img src="/fulllogo.png" alt="Realtravo" className="h-10 mx-auto mb-3" />
          <h1 className="text-xl font-black text-white">
            {step === "form" ? "Let's finish setting you up" : "Confirm it's you"}
          </h1>
          <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto">
            {step === "form"
              ? "A few required details so we know who you are — this only takes a minute."
              : `Enter the code we emailed to ${user?.email}.`}
          </p>

          {step === "form" && (
            <div className="flex justify-center gap-1.5 mt-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < requiredDone ? "w-6 bg-[rgb(0,128,128)]" : "w-3 bg-white/15"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overlapping card */}
      <div className="flex-1 px-4 -mt-8 pb-10">
        {step === "form" ? (
          <form
            onSubmit={handleContinue}
            className="max-w-md mx-auto rounded-3xl bg-card border border-border shadow-xl p-5 sm:p-6 space-y-6"
          >
            {/* Identity */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Who you are</p>

              <FieldRow icon={<User className="h-4 w-4" />} label="Name" required error={errors.firstName || errors.lastName}>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className={`h-9 text-sm ${errors.firstName ? "border-destructive" : ""}`}
                  />
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Surname"
                    className={`h-9 text-sm ${errors.lastName ? "border-destructive" : ""}`}
                  />
                </div>
              </FieldRow>

              <FieldRow icon={<UsersIcon className="h-4 w-4" />} label="Gender" required error={errors.gender}>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className={`h-9 text-sm ${errors.gender ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow icon={<Calendar className="h-4 w-4" />} label="Date of birth" required error={errors.dateOfBirth}>
                <Input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className={`h-9 text-sm ${errors.dateOfBirth ? "border-destructive" : ""}`}
                />
              </FieldRow>
            </div>

            <div className="h-px bg-border" />

            {/* Contact & location */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Where to reach you</p>

              <FieldRow icon={<Phone className="h-4 w-4" />} label="Phone number">
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter phone number"
                  className="h-9 text-sm"
                />
              </FieldRow>

              <FieldRow icon={<Globe className="h-4 w-4" />} label="Home country" hint="You can also add this later from your profile.">
                <CountrySelector
                  countryId={countryId}
                  divisionId={divisionId}
                  onChange={({ countryId, divisionId }) => {
                    setCountryId(countryId);
                    setDivisionId(divisionId);
                  }}
                />
              </FieldRow>
            </div>

            <div className="h-px bg-border" />

            {/* Security */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Secure your account</p>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Set a password so you can also sign in with your email, even though you started with Google.
                You'll confirm it twice, and we'll email you a code before it's saved.
              </p>

              <FieldRow icon={<KeyRound className="h-4 w-4" />} label="Password" required error={errors.password}>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`h-9 text-sm pr-9 ${errors.password ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && <PasswordStrength password={password} />}
              </FieldRow>

              <FieldRow icon={<Check className="h-4 w-4" />} label="Confirm password" required error={errors.confirmPassword}>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`h-9 text-sm pr-9 ${errors.confirmPassword ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FieldRow>
            </div>

            <Button type="submit" disabled={sendingCode} className="w-full h-11 rounded-xl text-sm font-bold">
              {sendingCode ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending code…
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={handleVerifyAndSave}
            className="max-w-md mx-auto rounded-3xl bg-card border border-border shadow-xl p-5 sm:p-6 space-y-4"
          >
            <button
              type="button"
              onClick={() => setStep("form")}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Verification code</p>
                <p className="text-xs text-muted-foreground">Check your inbox — it may take a minute to arrive.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-foreground/80 uppercase tracking-wide">Code</Label>
              <Input
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(e.target.value);
                  if (otpError) setOtpError(null);
                }}
                placeholder="123456"
                maxLength={6}
                className={`h-11 text-center text-lg font-bold tracking-widest ${otpError ? "border-destructive" : ""}`}
                autoFocus
              />
              {otpError && <p className="text-[11px] text-destructive font-medium">{otpError}</p>}
            </div>

            <Button type="submit" disabled={verifying || loading || !otpCode} className="w-full h-11 rounded-xl text-sm font-bold">
              {verifying || loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming…
                </>
              ) : (
                "Confirm & finish"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}