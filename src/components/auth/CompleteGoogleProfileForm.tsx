import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Loader2, AlertCircle, Globe } from "lucide-react";
import { CountrySelector } from "@/components/creation/CountrySelector";

const MIN_SIGNUP_AGE = 12;

function calculateAge(dob: string) {
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// Small inline error line, meant to sit directly under the field it refers to.
const FieldError = ({ message }: { message: string }) => (
  <p className="flex items-center gap-1 text-[10px] text-red-600 mt-1">
    <AlertCircle className="w-3 h-3 shrink-0" />
    {message}
  </p>
);

interface CompleteGoogleProfileFormProps {
  userId: string;
  // Google gives us an email + sometimes a name/avatar already — prefill from it.
  defaultFirstName?: string;
  defaultLastName?: string;
  // Called once the profile is saved and the password is set — parent should
  // treat the user as fully onboarded from here (close modal / route to app).
  onComplete: () => void;
}

export const CompleteGoogleProfileForm = ({
  userId,
  defaultFirstName = "",
  defaultLastName = "",
  onComplete,
}: CompleteGoogleProfileFormProps) => {
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  const [gender, setGender] = useState("");
  const [countryId, setCountryId] = useState<string | null>(null);
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [dobError, setDobError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const { toast } = useToast();

  const inputStyle = "h-9 bg-white border border-slate-300 text-black text-xs rounded-md placeholder:text-slate-400 focus-visible:ring-[rgb(0,128,128)]";
  const pwInputStyle = "h-9 bg-white border border-slate-300 text-black text-xs rounded-md pr-8 placeholder:text-slate-400 focus-visible:ring-[rgb(0,128,128)]";
  const labelStyle = "text-[10px] uppercase text-slate-600 font-bold ml-0.5";
  // z-[400] beats CompleteProfileGate's z-[300] overlay so the dropdown
  // panel renders above the popup instead of underneath it.
  const selectContentStyle = "z-[400] bg-white border border-slate-200 text-black max-h-60";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDobError(null);
    setPasswordError(null);

    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: "Validation Error", description: "Please enter your first name and surname.", variant: "destructive" });
      return;
    }
    if (!gender) {
      toast({ title: "Validation Error", description: "Please select your gender.", variant: "destructive" });
      return;
    }
    if (!countryId) {
      toast({ title: "Validation Error", description: "Please select your country.", variant: "destructive" });
      return;
    }
    if (!dateOfBirth) {
      setDobError("Please enter your date of birth.");
      return;
    }

    const age = calculateAge(dateOfBirth);
    if (age === null) {
      setDobError("Please enter a valid date of birth.");
      return;
    }
    if (age < MIN_SIGNUP_AGE) {
      setDobError(`You must be at least ${MIN_SIGNUP_AGE} years old to use this app.`);
      return;
    }

    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setLoading(true);

    // Set a password on the account so this Google user can also log in with
    // email + password later — Google sign-in alone leaves no password set.
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      setPasswordError(pwError.message || "Could not set password. Please try again.");
      setLoading(false);
      return;
    }

    // Save the rest of the profile. Upsert (not update) so this still works
    // even if no `profiles` row exists yet for this user. Adjust column
    // names to match your schema if `profiles` differs.
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`,
          gender,
          country_id: countryId,
          division_id: divisionId,
          date_of_birth: dateOfBirth,
          profile_completed: true,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      toast({ title: "Error", description: profileError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    toast({ title: "You're all set", description: "Your profile is complete." });
    setLoading(false);
    onComplete();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5">
      <div className="space-y-1 mb-1">
        <p className="text-xs font-semibold text-slate-900">Finish setting up your account</p>
        <p className="text-[10px] text-slate-500 leading-tight">
          A few last details, then you're in — no code needed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className={labelStyle}>First Name</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputStyle} required />
        </div>
        <div className="space-y-0.5">
          <Label className={labelStyle}>Surname</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputStyle} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className={labelStyle}>Gender</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger className={inputStyle}>
              <SelectValue placeholder="-" />
            </SelectTrigger>
            <SelectContent className={selectContentStyle}>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-0.5">
          <Label className={`${labelStyle} flex items-center gap-1`}>
            <Globe className="h-2.5 w-2.5" />
            Country
          </Label>
          {/*
            Same CountrySelector + country_id/division_id used by SignupForm
            and the /complete-profile page, instead of a disconnected
            free-text list — keeps this write consistent with the rest of
            the app's schema (and with any country-lock logic in the DB).
          */}
          <CountrySelector
            countryId={countryId}
            divisionId={divisionId}
            onChange={({ countryId, divisionId }) => {
              setCountryId(countryId);
              setDivisionId(divisionId);
            }}
          />
        </div>
      </div>

      <div className="space-y-0.5">
        <Label className={labelStyle}>Date of Birth</Label>
        <Input
          type="date"
          value={dateOfBirth}
          onChange={(e) => {
            setDateOfBirth(e.target.value);
            if (dobError) setDobError(null);
          }}
          max={new Date().toISOString().split("T")[0]}
          className={inputStyle}
          required
          aria-invalid={!!dobError}
        />
        {dobError && <FieldError message={dobError} />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className={labelStyle}>Set Password</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              className={pwInputStyle}
              autoComplete="new-password"
              required
              aria-invalid={!!passwordError}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">
              {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          </div>
        </div>
        <div className="space-y-0.5">
          <Label className={labelStyle}>Confirm</Label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              className={pwInputStyle}
              autoComplete="new-password"
              required
              aria-invalid={!!passwordError}
            />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">
              {showConfirmPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
      {passwordError && <FieldError message={passwordError} />}

      <Button type="submit" disabled={loading} className="w-full h-9 bg-[rgb(0,128,128)] hover:bg-[rgb(0,110,110)] text-white text-xs font-bold uppercase mt-1">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Finish Sign Up"}
      </Button>
    </form>
  );
};