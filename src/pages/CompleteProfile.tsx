// src/pages/CompleteProfile.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, User, Phone, Globe, KeyRound } from "lucide-react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { CountrySelector } from "@/components/creation/CountrySelector";

export default function CompleteProfile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryId, setCountryId] = useState<string | null>(null);
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        .select("profile_completed, name, phone_number, country_id, division_id")
        .eq("id", user.id)
        .single();

      if (profile?.profile_completed) {
        navigate("/");
        return;
      }
      if (user.user_metadata?.full_name || user.user_metadata?.name) {
        setName(user.user_metadata?.full_name || user.user_metadata?.name || "");
      } else if (profile?.name) {
        setName(profile.name);
      }
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

  const validatePassword = (pwd: string) => {
    if (!pwd) return { valid: true }; // Optional
    if (pwd.length < 8) return { valid: false, message: "Password must be at least 8 characters" };
    if (!/[A-Z]/.test(pwd)) return { valid: false, message: "Must contain uppercase letter" };
    if (!/[a-z]/.test(pwd)) return { valid: false, message: "Must contain lowercase letter" };
    if (!/[0-9]/.test(pwd)) return { valid: false, message: "Must contain a number" };
    return { valid: true };
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!name.trim()) {
      setErrors({ name: "Name is required" });
      return;
    }

    if (password) {
      const pv = validatePassword(password);
      if (!pv.valid) {
        setErrors({ password: pv.message! });
        return;
      }
      if (password !== confirmPassword) {
        setErrors({ confirmPassword: "Passwords don't match" });
        return;
      }
    }

    setLoading(true);
    try {
      if (password) {
        const { error: pwError } = await supabase.auth.updateUser({ password });
        if (pwError) throw pwError;
      }

      const updateData: {
        name: string;
        profile_completed: boolean;
        phone_number?: string;
        country_id?: string | null;
        division_id?: string | null;
      } = {
        name: name.trim(),
        profile_completed: true,
      };
      if (phoneNumber.trim()) updateData.phone_number = phoneNumber.trim();
      if (countryId) {
        updateData.country_id = countryId;
        updateData.division_id = divisionId;
      }

      const { error } = await supabase.from("profiles").update(updateData).eq("id", user!.id);
      if (error) throw error;

      toast({ title: "Profile completed!", description: "Welcome to Realtravo!" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    const updateName = name.trim() || user?.user_metadata?.full_name || user?.user_metadata?.name || "User";
    await supabase
      .from("profiles")
      .update({ profile_completed: true, name: updateName })
      .eq("id", user!.id);
    navigate("/");
  };

  if (authLoading || checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/fulllogo.png" alt="Realtravo" className="h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground">Complete your profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A few details to get you set up. You can update most of these later.
          </p>
        </div>

        <form onSubmit={handleProfileSubmit}>
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm mb-4">
            {/* Name */}
            <div className="p-4 flex items-start gap-3 border-b border-border/60">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Full name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className={`h-9 text-sm ${errors.name ? "border-destructive" : ""}`}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                <p className="text-[11px] text-muted-foreground">
                  Once saved, your name can only be changed again after 30 days.
                </p>
              </div>
            </div>

            {/* Phone */}
            <div className="p-4 flex items-start gap-3 border-b border-border/60">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Phone className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Phone number (optional)
                </Label>
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter phone number"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Country / division */}
            <div className="p-4 flex items-start gap-3 border-b border-border/60">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Globe className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Home country (optional)
                </Label>
                <CountrySelector
                  countryId={countryId}
                  divisionId={divisionId}
                  onChange={({ countryId, divisionId }) => {
                    setCountryId(countryId);
                    setDivisionId(divisionId);
                  }}
                />
                <p className="text-[11px] text-muted-foreground">
                  Once saved, your country can only be changed again after 365 days.
                </p>
              </div>
            </div>

            {/* Password */}
            <div className="p-4 flex items-start gap-3" >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Password (optional — for email login)
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave empty to use Google only"
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
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}

                {password && (
                  <div className="pt-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Confirm password
                    </Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`h-9 text-sm mt-1.5 ${errors.confirmPassword ? "border-destructive" : ""}`}
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-destructive mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleSkip} className="flex-1 h-10 rounded-xl text-sm font-semibold">
              Skip for now
            </Button>
            <Button type="submit" className="flex-1 h-10 rounded-xl text-sm font-semibold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Complete"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}