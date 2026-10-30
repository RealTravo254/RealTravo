import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  User,
  Calendar,
  Globe,
  Phone,
  Loader2,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Users as UsersIcon,
  ChevronRight,
  Mail,
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

// Casts: the generated Supabase types on this project don't expose
// signInWithOtp/verifyOtp cleanly, and don't include some of the newer
// profile columns (name_changed_at, country_changed_at) or tables.
const clientAuth = (supabase as any).auth;
const db = supabase as any;

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
type CodeField = Exclude<FieldKey, "phone" | "password">;
// Password has its own three-stage flow: confirm the current password first,
// then enter+confirm a new one, then confirm the emailed code.
type PasswordStage = "current" | "new" | "code";

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

const EMPTY_PROFILE: ProfileRow = {
  first_name: "",
  last_name: "",
  gender: "",
  date_of_birth: "",
  country_id: null,
  division_id: null,
  phone_number: "",
  phone_verified: false,
  name_changed_at: null,
  country_changed_at: null,
};

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-foreground leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
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

  const [editingField, setEditingField] = useState<Exclude<FieldKey, "password"> | null>(null);
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

  // Generic "confirm with an emailed code" step, shared by name / dob /
  // gender / country. `pendingPayload` is what gets written once the code
  // is confirmed; `pendingField` says which field is currently in this step.
  const [pendingField, setPendingField] = useState<CodeField | null>(null);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [fieldOtp, setFieldOtp] = useState("");
  const [fieldOtpError, setFieldOtpError] = useState<string | null>(null);
  const [sendingFieldCode, setSendingFieldCode] = useState(false);

  /* ── Password — its own popup, separate from the inline field list ── */
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordStage, setPasswordStage] = useState<PasswordStage>("current");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [verifyingCurrentPassword, setVerifyingCurrentPassword] = useState(false);
  const [draftPassword, setDraftPassword] = useState("");
  const [draftConfirmPassword, setDraftConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordOtp, setPasswordOtp] = useState("");
  const [sendingPasswordCode, setSendingPasswordCode] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Depend on the user's id, not the whole object — the object changes
  // identity on token refresh / OTP sign-in and would reload the page.
  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadProfile(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, navigate]);

  // showSpinner is only true for the very first load, so saving a field
  // doesn't blank the form and remount every input.
  const loadProfile = async (showSpinner = false) => {
    if (!user) return;
    if (showSpinner) setFetchingProfile(true);

    try {
      // select("*") so a missing column can never cause a 400 error
      const { data, error } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();

      if (error) {
        console.error("Profile load error:", error);
        toast({ title: "Couldn't load profile", description: error.message, variant: "destructive" });
      }

      if (data) {
        // Fall back to splitting the legacy `name` column if first/last
        // name columns are missing or empty.
        const nameParts = String(data.name ?? "").trim().split(" ");
        const row: ProfileRow = {
          first_name: data.first_name ?? nameParts[0] ?? "",
          last_name: data.last_name ?? nameParts.slice(1).join(" ") ?? "",
          gender: data.gender ?? "",
          date_of_birth: data.date_of_birth ?? "",
          country_id: data.country_id ?? null,
          division_id: data.division_id ?? null,
          phone_number: data.phone_number ?? "",
          phone_verified: !!data.phone_verified,
          name_changed_at: data.name_changed_at ?? null,
          country_changed_at: data.country_changed_at ?? null,
        };
        setProfile(row);

        if (row.country_id) {
          const { data: c } = await db.from("countries").select("name").eq("id", row.country_id).maybeSingle();
          setCountryName(c?.name ?? "");
        } else {
          setCountryName("");
        }
        if (row.division_id) {
          const { data: d } = await db
            .from("country_divisions")
            .select("name")
            .eq("id", row.division_id)
            .maybeSingle();
          setDivisionName(d?.name ?? "");
        } else {
          setDivisionName("");
        }
      } else if (!error) {
        // Query succeeded but no profile row exists yet — show an empty
        // form instead of a blank/error page so the user can fill it in.
        setProfile((prev) => prev ?? EMPTY_PROFILE);
      }
    } catch (err: any) {
      console.error("Profile load crashed:", err);
      toast({
        title: "Couldn't load profile",
        description: err?.message ?? "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      // Always stop the spinner, even if something above threw.
      setFetchingProfile(false);
    }
  };

  const nameLock = profile ? getLockStatus(profile.name_changed_at, NAME_LOCK_DAYS) : { locked: false, message: "" };
  const countryLock = profile
    ? getLockStatus(profile.country_changed_at, COUNTRY_LOCK_DAYS)
    : { locked: false, message: "" };

  const startEdit = (field: Exclude<FieldKey, "password">) => {
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
    }
    setPendingField(null);
    setPendingPayload(null);
    setFieldOtp("");
    setFieldOtpError(null);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setShowVerification(false);
    setPendingField(null);
    setPendingPayload(null);
    setFieldOtpError(null);
  };

  const saveField = async (field: FieldKey, updateData: Record<string, unknown>) => {
    setSavingField(field);
    try {
      const { error } = await db.from("profiles").update(updateData).eq("id", user!.id);
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
      setPendingField(null);
      setPendingPayload(null);
      await loadProfile(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingField(null);
    }
  };

  /* ── Generic emailed-code confirmation, used by name / dob / gender / country ── */

  const requestFieldCode = async (field: CodeField, payload: Record<string, unknown>) => {
    if (!user?.email) {
      toast({ title: "Error", description: "No email on file — we can't send a code.", variant: "destructive" });
      return;
    }
    setSendingFieldCode(true);
    const { error } = await clientAuth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    });
    setSendingFieldCode(false);
    if (error) {
      toast({ title: "Couldn't send code", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Code sent", description: `We emailed a verification code to ${user.email}.` });
    setPendingField(field);
    setPendingPayload(payload);
    setFieldOtp("");
    setFieldOtpError(null);
  };

  const confirmFieldCode = async () => {
    if (!user?.email || !pendingField || !pendingPayload) return;
    if (!fieldOtp) {
      setFieldOtpError("Enter the code we emailed you.");
      return;
    }
    setSavingField(pendingField);
    const { error } = await clientAuth.verifyOtp({
      email: user.email,
      token: fieldOtp,
      type: "email",
    });
    if (error) {
      setFieldOtpError(error.message || "That code isn't right. Check your email and try again.");
      setSavingField(null);
      return;
    }
    await saveField(pendingField, pendingPayload);
  };

  const handleSaveName = () => {
    if (!draftFirstName.trim() || !draftLastName.trim()) {
      toast({ title: "Error", description: "First name and surname are required.", variant: "destructive" });
      return;
    }
    requestFieldCode("name", {
      first_name: draftFirstName.trim(),
      last_name: draftLastName.trim(),
      name: `${draftFirstName.trim()} ${draftLastName.trim()}`,
    });
  };

  const handleSaveDob = () => requestFieldCode("dob", { date_of_birth: draftDob || null });

  const handleSaveGender = () => requestFieldCode("gender", { gender: draftGender || null });

  const handleSaveCountry = () =>
    requestFieldCode("country", { country_id: draftCountryId, division_id: draftDivisionId });

  // Each EditableField only exposes one onSave — this decides whether that
  // tap should send the code, or (once we're waiting on one) confirm it.
  const makeOnSave = (field: CodeField, send: () => void) => () => {
    if (pendingField === field) return confirmFieldCode();
    send();
  };

  /* ── Phone ── */

  const handleSendVerificationCode = () => {
    if (!draftPhone || draftPhone === profile?.phone_number) {
      toast({ title: "Error", description: "Enter a new phone number first.", variant: "destructive" });
      return;
    }
    setSendingCode(true);
    // NOTE: this is a placeholder. A real SMS provider should send the code
    // from the server — never generate or reveal it in the browser.
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
      if (!storedCode || verificationCode !== storedCode || draftPhone !== storedPhone) {
        throw new Error("Invalid verification code.");
      }
      await saveField("phone", { phone_number: draftPhone, phone_verified: true });
      sessionStorage.removeItem("phone_verification_code");
      sessionStorage.removeItem("phone_to_verify");
      setShowVerification(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setVerifyingCode(false);
    }
  };

  /* ── Password popup: current password → new password (x2) → emailed code ── */

  const openPasswordDialog = () => {
    setCurrentPassword("");
    setDraftPassword("");
    setDraftConfirmPassword("");
    setPasswordOtp("");
    setPasswordError(null);
    setPasswordStage("current");
    setPasswordDialogOpen(true);
  };

  const closePasswordDialog = () => {
    setPasswordDialogOpen(false);
    setCurrentPassword("");
    setDraftPassword("");
    setDraftConfirmPassword("");
    setPasswordOtp("");
    setPasswordError(null);
    setPasswordStage("current");
  };

  const handleVerifyCurrentPassword = async () => {
    if (!user?.email) return;
    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }
    setPasswordError(null);
    setVerifyingCurrentPassword(true);
    const { error } = await clientAuth.signInWithPassword({ email: user.email, password: currentPassword });
    setVerifyingCurrentPassword(false);
    if (error) {
      setPasswordError("That's not your current password.");
      return;
    }
    setPasswordStage("new");
  };

  const handleSendPasswordCode = async () => {
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
    if (draftPassword === currentPassword) {
      setPasswordError("Choose a password different from your current one.");
      return;
    }
    if (!user?.email) {
      setPasswordError("No email on file — we can't send a code.");
      return;
    }
    setSendingPasswordCode(true);
    const { error } = await clientAuth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    });
    setSendingPasswordCode(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    toast({ title: "Code sent", description: `We emailed a verification code to ${user.email}.` });
    setPasswordOtp("");
    setPasswordStage("code");
  };

  const handleConfirmPasswordCode = async () => {
    if (!user?.email) return;
    setPasswordError(null);

    if (!passwordOtp) {
      setPasswordError("Enter the code we emailed you.");
      return;
    }

    setSavingPassword(true);
    try {
      const { error: verifyError } = await clientAuth.verifyOtp({
        email: user.email,
        token: passwordOtp,
        type: "email",
      });
      if (verifyError) {
        setPasswordError(verifyError.message || "That code isn't right. Check your email and try again.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: draftPassword });
      if (error) throw error;

      toast({ title: "Password updated", description: "Use your new password next time you sign in." });
      closePasswordDialog();
    } catch (error: any) {
      setPasswordError(error.message || "Couldn't update your password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handlePasswordDialogPrimaryAction = () => {
    if (passwordStage === "current") handleVerifyCurrentPassword();
    else if (passwordStage === "new") handleSendPasswordCode();
    else handleConfirmPasswordCode();
  };

  const passwordDialogBusy = verifyingCurrentPassword || sendingPasswordCode || savingPassword;

  const passwordDialogPrimaryLabel =
    passwordStage === "current" ? "Continue" : passwordStage === "new" ? "Send code" : "Confirm & save";

  const age = profile ? calculateAge(profile.date_of_birth) : null;

  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "";
  const initials =
    profile
      ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase() || "U"
      : "U";

  // The "enter the emailed code" step, used by name / dob / gender / country.
  // IMPORTANT: this is a plain render function, NOT a component. Defining it
  // as a component inside render made React remount the input on every
  // keystroke, which dropped focus after each character typed.
  const renderFieldCodeStep = (field: CodeField) =>
    pendingField === field ? (
      <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-2 mt-2">
        <div className="flex items-center gap-1 text-primary text-[11px] font-semibold uppercase tracking-wide">
          <ShieldCheck className="h-3.5 w-3.5" />
          Enter the code we emailed you
        </div>
        <Input
          value={fieldOtp}
          onChange={(e) => {
            setFieldOtp(e.target.value);
            if (fieldOtpError) setFieldOtpError(null);
          }}
          placeholder="000000"
          maxLength={6}
          inputMode="numeric"
          className="h-9 text-center font-semibold tracking-widest text-sm"
        />
        {fieldOtpError && <p className="text-xs text-destructive font-medium">{fieldOtpError}</p>}
        <button
          type="button"
          onClick={() => {
            setPendingField(null);
            setPendingPayload(null);
            setFieldOtpError(null);
          }}
          className="text-[11px] text-muted-foreground hover:underline"
        >
          Back
        </button>
      </div>
    ) : null;

  // How much of the profile is filled in — shown in the summary panel.
  const completeness = profile
    ? Math.round(
        ([
          profile.first_name && profile.last_name,
          profile.date_of_birth,
          profile.gender,
          profile.country_id,
          profile.phone_number,
        ].filter(Boolean).length /
          5) *
          100,
      )
    : 0;

  const cardCls =
    "rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md overflow-hidden";

  const doneButton = (
    <Button
      type="button"
      variant="outline"
      onClick={() => navigate("/account")}
      className="w-full h-11 rounded-2xl text-sm font-semibold"
    >
      Done
    </Button>
  );

  return (
    <div
      className="flex flex-col min-h-screen w-full bg-gradient-to-b from-primary/5 via-background to-background"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Header />

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-10 2xl:px-16 pt-24 md:pt-28 pb-28 lg:pb-12">
        {fetchingProfile ? (
          <div className="min-h-[50vh] flex justify-center items-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : !profile ? (
          <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center space-y-3 shadow-xl">
            <p className="text-sm font-semibold text-foreground">We couldn't load your profile.</p>
            <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
            <Button type="button" size="sm" onClick={() => loadProfile(true)}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid w-full gap-6 lg:gap-8 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
            {/* ── Left: summary panel (sticks while the fields scroll on desktop) ── */}
            <aside className="space-y-4 lg:sticky lg:top-28">
              <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-6 sm:p-8 shadow-xl">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute -bottom-24 -left-12 h-52 w-52 rounded-full bg-black/10" />

                <div className="relative flex flex-row lg:flex-col items-center lg:items-start gap-5">
                  <div className="h-20 w-20 lg:h-28 lg:w-28 rounded-3xl bg-white/20 ring-4 ring-white/25 flex items-center justify-center text-3xl lg:text-5xl font-extrabold shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 w-full space-y-2">
                    <p className="text-2xl lg:text-3xl font-extrabold leading-tight break-words">
                      {fullName || "Your name"}
                    </p>
                    {user?.email && (
                      <p className="flex items-center gap-1.5 text-sm opacity-85 min-w-0">
                        <Mail className="h-4 w-4 shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {age !== null && (
                        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">Age {age}</span>
                      )}
                      {countryName && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                          <Globe className="h-3 w-3" />
                          {countryName}
                        </span>
                      )}
                      {profile.phone_verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                          <ShieldCheck className="h-3 w-3" />
                          Phone verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="relative mt-6 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Profile completeness</span>
                    <span>{completeness}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-500"
                      style={{ width: `${completeness}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="hidden lg:block rounded-2xl border border-border bg-card/70 p-4 text-xs text-muted-foreground leading-relaxed">
                Name, date of birth, gender and home country are confirmed with a code sent to your email. Your name
                can be changed once every {NAME_LOCK_DAYS} days and your home country once a year.
              </div>

              <div className="hidden lg:block">{doneButton}</div>
            </aside>

            {/* ── Right: editable fields, filling the remaining width ── */}
            <div className="min-w-0 space-y-8">
              <section className="space-y-3">
                <SectionHeader icon={<User className="h-4 w-4" />} title="Personal" subtitle="Who you are" />
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3 items-start">
                  {/* Name */}
                  <div className={cardCls}>
                    <EditableField
                      icon={<User className="h-4 w-4" />}
                      label="Name"
                      display={fullName || "Not set"}
                      isEditing={editingField === "name"}
                      isSaving={savingField === "name" || sendingFieldCode}
                      locked={nameLock.locked}
                      lockedMessage={nameLock.locked ? nameLock.message : undefined}
                      onEdit={() => startEdit("name")}
                      onSave={makeOnSave("name", handleSaveName)}
                      onCancel={cancelEdit}
                      noBorder
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={draftFirstName}
                          onChange={(e) => setDraftFirstName(e.target.value)}
                          placeholder="First name"
                          className="h-9 text-sm"
                          disabled={pendingField === "name"}
                        />
                        <Input
                          value={draftLastName}
                          onChange={(e) => setDraftLastName(e.target.value)}
                          placeholder="Surname"
                          className="h-9 text-sm"
                          disabled={pendingField === "name"}
                        />
                      </div>
                      {renderFieldCodeStep("name")}
                    </EditableField>
                  </div>

                  {/* Date of birth */}
                  <div className={cardCls}>
                    <EditableField
                      icon={<Calendar className="h-4 w-4" />}
                      label="Date of birth"
                      display={
                        profile.date_of_birth
                          ? `${profile.date_of_birth}${age !== null ? ` · age ${age}` : ""}`
                          : "Not set"
                      }
                      isEditing={editingField === "dob"}
                      isSaving={savingField === "dob" || sendingFieldCode}
                      onEdit={() => startEdit("dob")}
                      onSave={makeOnSave("dob", handleSaveDob)}
                      onCancel={cancelEdit}
                      noBorder
                    >
                      <Input
                        type="date"
                        value={draftDob}
                        onChange={(e) => setDraftDob(e.target.value)}
                        className="h-9 text-sm"
                        disabled={pendingField === "dob"}
                      />
                      {renderFieldCodeStep("dob")}
                    </EditableField>
                  </div>

                  {/* Gender */}
                  <div className={cardCls}>
                    <EditableField
                      icon={<UsersIcon className="h-4 w-4" />}
                      label="Gender identity"
                      display={profile.gender ? GENDER_LABELS[profile.gender] ?? profile.gender : "Not set"}
                      isEditing={editingField === "gender"}
                      isSaving={savingField === "gender" || sendingFieldCode}
                      onEdit={() => startEdit("gender")}
                      onSave={makeOnSave("gender", handleSaveGender)}
                      onCancel={cancelEdit}
                      noBorder
                    >
                      <Select
                        value={draftGender}
                        onValueChange={setDraftGender}
                        disabled={pendingField === "gender"}
                      >
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
                      {renderFieldCodeStep("gender")}
                    </EditableField>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <SectionHeader
                  icon={<Globe className="h-4 w-4" />}
                  title="Location & contact"
                  subtitle="Where you are and how to reach you"
                />
                <div className="grid gap-4 md:grid-cols-2 items-start">
                  {/* Country / division — optional */}
                  <div className={`${cardCls} ${editingField === "country" ? "md:col-span-2" : ""}`}>
                    <EditableField
                      icon={<Globe className="h-4 w-4" />}
                      label="Home country (optional)"
                      display={
                        countryName ? `${countryName}${divisionName ? ` · ${divisionName}` : ""}` : "Not set"
                      }
                      isEditing={editingField === "country"}
                      isSaving={savingField === "country" || sendingFieldCode}
                      locked={countryLock.locked}
                      lockedMessage={countryLock.locked ? countryLock.message : undefined}
                      onEdit={() => startEdit("country")}
                      onSave={makeOnSave("country", handleSaveCountry)}
                      onCancel={cancelEdit}
                      noBorder
                    >
                      <div className={pendingField === "country" ? "pointer-events-none opacity-60" : ""}>
                        <CountrySelector
                          countryId={draftCountryId}
                          divisionId={draftDivisionId}
                          onChange={({ countryId, divisionId }) => {
                            setDraftCountryId(countryId);
                            setDraftDivisionId(divisionId);
                          }}
                        />
                      </div>
                      {renderFieldCodeStep("country")}
                    </EditableField>
                  </div>

                  {/* Phone number — its own (SMS-style) code */}
                  <div className={`${cardCls} ${editingField === "phone" ? "md:col-span-2" : ""}`}>
                    <EditableField
                      icon={<Phone className="h-4 w-4" />}
                      label="Phone number (optional)"
                      display={profile.phone_number || "Not set"}
                      isEditing={editingField === "phone"}
                      isSaving={savingField === "phone" || verifyingCode}
                      onEdit={() => startEdit("phone")}
                      onSave={showVerification ? handleVerifyAndSavePhone : handleSendVerificationCode}
                      onCancel={cancelEdit}
                      noBorder
                    >
                      <div className="space-y-2">
                        <Input
                          type="tel"
                          value={draftPhone}
                          onChange={(e) => setDraftPhone(e.target.value)}
                          placeholder="Enter phone number"
                          className="h-9 text-sm"
                          disabled={showVerification}
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
                                inputMode="numeric"
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
                            <button
                              type="button"
                              onClick={() => {
                                setShowVerification(false);
                                setVerificationCode("");
                              }}
                              className="text-[11px] text-muted-foreground hover:underline"
                            >
                              Change number
                            </button>
                          </div>
                        )}
                      </div>
                    </EditableField>
                  </div>
                </div>
              </section>

              {/* Security — password is a popup rather than an inline field */}
              <section className="space-y-3">
                <SectionHeader
                  icon={<KeyRound className="h-4 w-4" />}
                  title="Security"
                  subtitle="Keep your account protected"
                />
                <div className={cardCls}>
                  <button
                    type="button"
                    onClick={openPasswordDialog}
                    className="w-full flex items-center gap-4 p-4 sm:p-5 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Password</p>
                      <p className="text-xs text-muted-foreground">••••••••  ·  Confirmed with an emailed code</p>
                    </div>
                    <span className="text-xs font-semibold text-primary shrink-0">Change</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </div>
              </section>

              <div className="lg:hidden">{doneButton}</div>
            </div>
          </div>
        )}
      </main>

      <MobileBottomBar />

      {/* Password change popup */}
      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => (open ? setPasswordDialogOpen(true) : closePasswordDialog())}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Change your password
            </DialogTitle>
            <DialogDescription>
              {passwordStage === "current" && "Confirm your current password to continue."}
              {passwordStage === "new" && "Enter and confirm your new password."}
              {passwordStage === "code" && `Enter the code we emailed to ${user?.email}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {passwordStage === "current" && (
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="h-9 text-sm pr-9"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}

            {passwordStage === "new" && (
              <>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={draftPassword}
                    onChange={(e) => setDraftPassword(e.target.value)}
                    placeholder="New password"
                    className="h-9 text-sm pr-9"
                    autoFocus
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
              </>
            )}

            {passwordStage === "code" && (
              <Input
                value={passwordOtp}
                onChange={(e) => setPasswordOtp(e.target.value)}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                className="h-11 text-center text-lg font-bold tracking-widest"
                autoFocus
              />
            )}

            {passwordError && <p className="text-xs text-destructive font-medium">{passwordError}</p>}
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-between">
            {passwordStage === "current" ? (
              <Button type="button" variant="outline" onClick={closePasswordDialog} className="flex-1">
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPasswordError(null);
                  setPasswordStage(passwordStage === "code" ? "new" : "current");
                }}
                className="flex-1"
              >
                Back
              </Button>
            )}
            <Button
              type="button"
              onClick={handlePasswordDialogPrimaryAction}
              disabled={passwordDialogBusy}
              className="flex-1"
            >
              {passwordDialogBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : passwordDialogPrimaryLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 