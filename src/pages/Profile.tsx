// src/pages/ProfileEdit.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  User,
  Calendar,
  Globe,
  Phone,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Users as UsersIcon,
} from "lucide-react";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { EditableField } from "@/components/profile/EditableField";
import { PasswordStrength } from "@/components/ui/password-strength";

const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Private",
};

const NAME_LOCK_DAYS = 30;
const COUNTRY_LOCK_DAYS = 365;

function calculateAge(dob: string) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function validatePasswordStrength(pwd: string) {
  if (pwd.length < 8) return "At least 8 characters.";
  if (!/[A-Z]/.test(pwd)) return "Add an uppercase letter.";
  if (!/[a-z]/.test(pwd)) return "Add a lowercase letter.";
  if (!/[0-9]/.test(pwd)) return "Add a number.";
  return null;
}

/** Mirrors the DB trigger's rule client-side, purely for a nicer UX. The
 *  database is still the source of truth and will reject the update if this
 *  check somehow drifts (e.g. stale client clock). */
function getLockStatus(changedAt: string | null, lockDays: number) {
  if (!changedAt) return { locked: false, message: "" };
  const changed = new Date(changedAt).getTime();
  const unlocksAt = changed + lockDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (now >= unlocksAt) return { locked: false, message: "" };
  const daysLeft = Math.ceil((unlocksAt - now) / (24 * 60 * 60 * 1000));
  const unlockDate = new Date(unlocksAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return {
    locked: true,
    message: `Can be changed again on ${unlockDate} (${daysLeft} day${daysLeft === 1 ? "" : "s"})`,
  };
}

type FieldKey = "name" | "dob" | "gender" | "country" | "phone" | "password";

interface ProfileRow {
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  country_id: string | null;
  division_id: string | null;
  phone_number: string;
  phone_verified: boolean;
  name_changed_at: string | null;
  country_changed_at: string | null;
}

// Section header used to group the fields below into "Personal",
// "Location & contact" and "Security" — this is what gives the page a
// different shape from the flat single list it used to be.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-4 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
      {children}
    </p>
  );
}

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [countryName, setCountryName] = useState<string>("");
  const [divisionName, setDivisionName] = useState<string>("");

  const [editingField, setEditingField] = useState<FieldKey | null>(null);
  const [savingField, setSavingField] = useState<FieldKey | null>(null);

  // Draft values, only used while a field is being edited.
  const [draftFirstName, setDraftFirstName] = useState("");
  const [draftLastName, setDraftLastName] = useState("");
  const [draftDob, setDraftDob] = useState("");
  const [draftGender, setDraftGender] = useState("");
  const [draftCountryId, setDraftCountryId] = useState<string | null>(null);
  const [draftDivisionId, setDraftDivisionId] = useState<string | null>(null);
  const [draftPhone, setDraftPhone] = useState("");

  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  // Password change
  const [draftPassword, setDraftPassword] = useState("");
  const [draftConfirmPassword, setDraftConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const loadProfile = async () => {
    setFetchingProfile(true);
    const { data } = await supabase
      .from("profiles")
      .select(
        "first_name, last_name, gender, date_of_birth, country_id, division_id, phone_number, phone_verified, name_changed_at, country_changed_at",
      )
      .eq("id", user!.id)
      .single();

    if (data) {
      setProfile(data as ProfileRow);

      if (data.country_id) {
        const { data: c } = await supabase
          .from("countries")
          .select("name")
          .eq("id", data.country_id)
          .single();
        setCountryName(c?.name ?? "");
      }
      if (data.division_id) {
        const { data: d } = await supabase
          .from("country_divisions")
          .select("name")
          .eq("id", data.division_id)
          .single();
        setDivisionName(d?.name ?? "");
      }
    }
    setFetchingProfile(false);
  };

  if (!profile && !fetchingProfile) return null;

  const nameLock = profile ? getLockStatus(profile.name_changed_at, NAME_LOCK_DAYS) : { locked: false, message: "" };
  const countryLock = profile
    ? getLockStatus(profile.country_changed_at, COUNTRY_LOCK_DAYS)
    : { locked: false, message: "" };

  const startEdit = (field: FieldKey) => {
    if (!profile) return;
    setEditingField(field);
    if (field === "name") {
      setDraftFirstName(profile.first_name);
      setDraftLastName(profile.last_name);
    } else if (field === "dob") {
      setDraftDob(profile.date_of_birth);
    } else if (field === "gender") {
      setDraftGender(profile.gender);
    } else if (field === "country") {
      setDraftCountryId(profile.country_id);
      setDraftDivisionId(profile.division_id);
    } else if (field === "phone") {
      setDraftPhone(profile.phone_number);
      setShowVerification(false);
      setVerificationCode("");
    } else if (field === "password") {
      setDraftPassword("");
      setDraftConfirmPassword("");
      setPasswordError(null);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setShowVerification(false);
    setPasswordError(null);
  };

  const saveField = async (field: FieldKey, updateData: Record<string, unknown>) => {
    setSavingField(field);
    try {
      const { error } = await supabase.from("profiles").update(updateData).eq("id", user!.id);
      if (error) {
        const raw = error.message || "";
        if (raw.includes("name_locked") || raw.includes("country_locked")) {
          const friendly = raw.split(":").slice(1).join(":").trim() || "This field is locked right now.";
          toast({ title: "Locked", description: friendly, variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }
      toast({ title: "Saved", description: "Your profile has been updated." });
      setEditingField(null);
      await loadProfile();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveName = () => {
    if (!draftFirstName.trim() || !draftLastName.trim()) {
      toast({ title: "Error", description: "First name and surname are required.", variant: "destructive" });
      return;
    }
    saveField("name", {
      first_name: draftFirstName.trim(),
      last_name: draftLastName.trim(),
      name: `${draftFirstName.trim()} ${draftLastName.trim()}`,
    });
  };

  const handleSaveDob = () => saveField("dob", { date_of_birth: draftDob || null });

  const handleSaveGender = () => saveField("gender", { gender: draftGender || null });

  const handleSaveCountry = () =>
    saveField("country", { country_id: draftCountryId, division_id: draftDivisionId });

  const handleSendVerificationCode = () => {
    if (!draftPhone || draftPhone === profile?.phone_number) {
      toast({ title: "Error", description: "Enter a new phone number first.", variant: "destructive" });
      return;
    }
    setSendingCode(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    toast({ title: "Verification code sent", description: `Your code is: ${code}` });
    sessionStorage.setItem("phone_verification_code", code);
    sessionStorage.setItem("phone_to_verify", draftPhone);
    setShowVerification(true);
    setSendingCode(false);
  };

  const handleVerifyAndSavePhone = async () => {
    setVerifyingCode(true);
    try {
      const storedCode = sessionStorage.getItem("phone_verification_code");
      const storedPhone = sessionStorage.getItem("phone_to_verify");
      if (verificationCode !== storedCode || draftPhone !== storedPhone) {
        throw new Error("Invalid verification code.");
      }
      await saveField("phone", { phone_number: draftPhone, phone_verified: true });
      setShowVerification(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSavePassword = async () => {
    setPasswordError(null);
    const strengthError = validatePasswordStrength(draftPassword);
    if (strengthError) {
      setPasswordError(strengthError);
      return;
    }
    if (draftPassword !== draftConfirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    setSavingField("password");
    try {
      const { error } = await supabase.auth.updateUser({ password: draftPassword });
      if (error) throw error;
      toast({ title: "Password updated", description: "Use your new password next time you sign in." });
      setEditingField(null);
      setDraftPassword("");
      setDraftConfirmPassword("");
    } catch (error: any) {
      setPasswordError(error.message || "Couldn't update your password.");
    } finally {
      setSavingField(null);
    }
  };

  const age = profile ? calculateAge(profile.date_of_birth) : null;

  return (
    <div
      className="flex flex-col min-h-screen bg-background"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Header />

      {/* Brand band — gives this page its own identity instead of a plain title row */}
      <div className="relative bg-[#0d2b4e] px-4 pt-6 pb-10 overflow-hidden shrink-0">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 25%, #008080 0%, transparent 45%), radial-gradient(circle at 90% 10%, #008080 0%, transparent 40%)",
          }}
        />
        <div className="relative max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-white shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white leading-tight">Edit profile</h1>
            <p className="text-xs text-white/60">Tap a field to update it, then save.</p>
          </div>
        </div>
      </div>

      <main className="flex-1 px-4 -mt-6 pb-12 max-w-lg mx-auto w-full space-y-5">
        {fetchingProfile ? (
          <div className="p-12 flex justify-center items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          profile && (
            <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xl divide-y divide-border/60">
              <SectionLabel>Personal</SectionLabel>

              {/* Name */}
              <EditableField
                icon={<User className="h-4 w-4" />}
                label="Name"
                display={`${profile.first_name} ${profile.last_name}`.trim() || "Not set"}
                isEditing={editingField === "name"}
                isSaving={savingField === "name"}
                locked={nameLock.locked}
                lockedMessage={nameLock.locked ? nameLock.message : undefined}
                onEdit={() => startEdit("name")}
                onSave={handleSaveName}
                onCancel={cancelEdit}
              >
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={draftFirstName}
                    onChange={(e) => setDraftFirstName(e.target.value)}
                    placeholder="First name"
                    className="h-9 text-sm"
                  />
                  <Input
                    value={draftLastName}
                    onChange={(e) => setDraftLastName(e.target.value)}
                    placeholder="Surname"
                    className="h-9 text-sm"
                  />
                </div>
              </EditableField>

              {/* Date of birth */}
              <EditableField
                icon={<Calendar className="h-4 w-4" />}
                label="Date of birth"
                display={
                  profile.date_of_birth
                    ? `${profile.date_of_birth}${age !== null ? ` · age ${age}` : ""}`
                    : "Not set"
                }
                isEditing={editingField === "dob"}
                isSaving={savingField === "dob"}
                onEdit={() => startEdit("dob")}
                onSave={handleSaveDob}
                onCancel={cancelEdit}
              >
                <Input
                  type="date"
                  value={draftDob}
                  onChange={(e) => setDraftDob(e.target.value)}
                  className="h-9 text-sm"
                />
              </EditableField>

              {/* Gender */}
              <EditableField
                icon={<UsersIcon className="h-4 w-4" />}
                label="Gender identity"
                display={profile.gender ? GENDER_LABELS[profile.gender] ?? profile.gender : "Not set"}
                isEditing={editingField === "gender"}
                isSaving={savingField === "gender"}
                onEdit={() => startEdit("gender")}
                onSave={handleSaveGender}
                onCancel={cancelEdit}
              >
                <Select value={draftGender} onValueChange={setDraftGender}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENDER_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EditableField>

              <SectionLabel>Location &amp; contact</SectionLabel>

              {/* Country / division — optional, not required */}
              <EditableField
                icon={<Globe className="h-4 w-4" />}
                label="Home country (optional)"
                display={
                  countryName
                    ? `${countryName}${divisionName ? ` · ${divisionName}` : ""}`
                    : "Not set"
                }
                isEditing={editingField === "country"}
                isSaving={savingField === "country"}
                locked={countryLock.locked}
                lockedMessage={countryLock.locked ? countryLock.message : undefined}
                onEdit={() => startEdit("country")}
                onSave={handleSaveCountry}
                onCancel={cancelEdit}
              >
                <CountrySelector
                  countryId={draftCountryId}
                  divisionId={draftDivisionId}
                  onChange={({ countryId, divisionId }) => {
                    setDraftCountryId(countryId);
                    setDraftDivisionId(divisionId);
                  }}
                />
              </EditableField>

              {/* Phone number */}
              <EditableField
                icon={<Phone className="h-4 w-4" />}
                label="Phone number (optional)"
                display={profile.phone_number || "Not set"}
                isEditing={editingField === "phone"}
                isSaving={savingField === "phone"}
                onEdit={() => startEdit("phone")}
                onSave={handleSendVerificationCode}
                onCancel={cancelEdit}
              >
                <div className="space-y-2">
                  <Input
                    type="tel"
                    value={draftPhone}
                    onChange={(e) => setDraftPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="h-9 text-sm"
                  />
                  {!showVerification ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSendVerificationCode}
                      disabled={sendingCode}
                      className="h-8 px-3 text-xs font-semibold"
                    >
                      {sendingCode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send code"}
                    </Button>
                  ) : (
                    <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-2">
                      <div className="flex items-center gap-1 text-primary text-[11px] font-semibold uppercase tracking-wide">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Enter verification code
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder="000000"
                          maxLength={6}
                          className="h-9 text-center font-semibold tracking-widest text-sm"
                        />
                        <Button
                          type="button"
                          onClick={handleVerifyAndSavePhone}
                          disabled={verifyingCode}
                          className="h-9 px-3 text-xs font-semibold shrink-0"
                        >
                          {verifyingCode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </EditableField>

              <SectionLabel>Security</SectionLabel>

              {/* Password */}
              <EditableField
                icon={<KeyRound className="h-4 w-4" />}
                label="Password"
                display="••••••••"
                isEditing={editingField === "password"}
                isSaving={savingField === "password"}
                onEdit={() => startEdit("password")}
                onSave={handleSavePassword}
                onCancel={cancelEdit}
                noBorder
              >
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={draftPassword}
                      onChange={(e) => setDraftPassword(e.target.value)}
                      placeholder="New password"
                      className="h-9 text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {draftPassword && <PasswordStrength password={draftPassword} />}
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={draftConfirmPassword}
                      onChange={(e) => setDraftConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="h-9 text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordError && <p className="text-xs text-destructive font-medium">{passwordError}</p>}
                </div>
              </EditableField>
            </div>
          )
        )}

        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/account")}
          className="w-full h-10 rounded-xl text-sm font-semibold"
        >
          Done
        </Button>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
}