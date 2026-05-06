import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Loader2, Sparkles, UserCircle2, ChevronRight } from "lucide-react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { generateStrongPassword } from "@/lib/passwordUtils";

type Step = "loading" | "profile" | "password" | "done";

type FormErrors = {
  firstName?: string;
  lastName?: string;
  gender?: string;
  password?: string;
  confirmPassword?: string;
};

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

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("loading");
  const [userId, setUserId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [googleName, setGoogleName] = useState<string>("");

  // Profile step
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password step
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [skippingPassword, setSkippingPassword] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});

  const inputClass =
    "h-11 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/50 focus:bg-white/15";
  const labelClass = "text-sm font-medium text-white/80";
  const errorClass = "text-xs text-red-300";

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Exchange the code/fragment for a session
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
          toast({
            title: "Authentication failed",
            description: "Could not complete sign-in. Please try again.",
            variant: "destructive",
          });
          navigate("/auth");
          return;
        }

        const user = sessionData.session.user;
        setUserId(user.id);
        setUserEmail(user.email || "");

        // Pre-fill name from Google metadata if available
        const googleFullName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          "";
        if (googleFullName) {
          const parts = googleFullName.trim().split(" ");
          setFirstName(parts[0] || "");
          setLastName(parts.slice(1).join(" ") || "");
          setGoogleName(googleFullName);
        }

        // Check if this user already has a profile with a name set
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, gender")
          .eq("id", user.id)
          .single();

        if (profile?.name && profile.name.trim().length > 0) {
          // Existing user with complete profile → go home
          navigate("/");
          return;
        }

        // New user → show profile completion
        setStep("profile");
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Something went wrong",
          variant: "destructive",
        });
        navigate("/auth");
      }
    };

    handleCallback();
  }, [navigate, toast]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!firstName.trim()) {
      setErrors({ firstName: "First name is required" });
      return;
    }
    if (!lastName.trim()) {
      setErrors({ lastName: "Last name is required" });
      return;
    }
    if (!gender) {
      setErrors({ gender: "Please select your gender" });
      return;
    }

    setSavingProfile(true);

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const friendlyId = generateUserFriendlyId(userEmail);

      // Upsert the profile
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        name: fullName,
        gender,
        friendly_id: friendlyId,
      });

      if (error) throw error;

      // Also update auth metadata
      await supabase.auth.updateUser({
        data: { name: fullName, gender, friendly_id: friendlyId },
      });

      setStep("password");
    } catch (err: any) {
      toast({
        title: "Failed to save profile",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
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

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords don't match" });
      return;
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      setErrors({ password: validation.message });
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({
        title: "Password set!",
        description: "You can now also login with your email and password.",
      });
      navigate("/");
    } catch (err: any) {
      toast({
        title: "Failed to set password",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSkipPassword = async () => {
    setSkippingPassword(true);
    // Brief delay for UX
    setTimeout(() => {
      navigate("/");
    }, 400);
  };

  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword();
    setPassword(newPassword);
    setConfirmPassword(newPassword);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        </div>
      </div>
    );
  }

  // ── SHARED WRAPPER ───────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center relative"
      style={{
        backgroundImage: "url('/images/category-campsite.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black/60 z-0" />

      <div className="relative z-10 w-full max-w-[420px] px-4 py-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/fulllogo.png"
            alt="Realtravo"
            className="h-8 brightness-0 invert"
          />
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-xl space-y-6">

          {/* ── PROFILE STEP ─────────────────────────────────────────── */}
          {step === "profile" && (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                  <UserCircle2 className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  Complete your profile
                </h2>
                <p className="text-sm text-white/60">
                  Just a few details to get you started
                </p>
                {googleName && (
                  <p className="text-xs text-white/40">
                    Signed in as{" "}
                    <span className="text-white/70">{userEmail}</span>
                  </p>
                )}
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className={labelClass}>First name</Label>
                    <Input
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={`${inputClass} ${errors.firstName ? "border-red-400" : ""}`}
                    />
                    {errors.firstName && (
                      <p className={errorClass}>{errors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClass}>Last name</Label>
                    <Input
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={`${inputClass} ${errors.lastName ? "border-red-400" : ""}`}
                    />
                    {errors.lastName && (
                      <p className={errorClass}>{errors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className={labelClass}>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger
                      className={`h-11 rounded-xl bg-white/10 border-white/20 text-white ${errors.gender ? "border-red-400" : ""}`}
                    >
                      <SelectValue placeholder="Select gender" />
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
                  {errors.gender && (
                    <p className={errorClass}>{errors.gender}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl text-sm font-semibold bg-white text-gray-900 hover:bg-white/90"
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}

          {/* ── PASSWORD STEP ────────────────────────────────────────── */}
          {step === "password" && (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  Set a password?
                </h2>
                <p className="text-sm text-white/60">
                  Optional — you can always log in with Google. A password lets
                  you also sign in with email.
                </p>
              </div>

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className={labelClass}>Password</Label>
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
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-10 ${errors.password ? "border-red-400" : ""}`}
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
                  {errors.password && (
                    <p className={errorClass}>{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className={labelClass}>Confirm password</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`${inputClass} pr-10 ${errors.confirmPassword ? "border-red-400" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
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
                  disabled={savingPassword}
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Setting password...
                    </>
                  ) : (
                    "Set Password & Continue"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={handleSkipPassword}
                  disabled={skippingPassword}
                  className="flex items-center justify-center gap-2 w-full text-sm text-white/50 hover:text-white transition-colors py-2 disabled:opacity-40"
                >
                  {skippingPassword ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Skip for now, log me in
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;