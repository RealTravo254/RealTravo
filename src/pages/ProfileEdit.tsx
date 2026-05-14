import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  User, Calendar, Globe, ArrowLeft, Camera,
  Lock, Eye, EyeOff, Pencil, Check, X, ShieldCheck,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { PasswordStrength } from "@/components/ui/password-strength";

const T = "#008080";
const CORAL = "#FF7F50";
const CORAL_L = "#FF9E7A";

// ── Per-field edit state ──────────────────────────────────────────────────────
type FieldKey = "name" | "date_of_birth" | "gender" | "country" | "password";

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [fetching, setFetching] = useState(true);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [uploadingPic, setUploadingPic] = useState(false);

  // Saved (display) values
  const [saved, setSaved] = useState({
    name: "", gender: "", date_of_birth: "", country: "",
  });
  // Draft values while editing a field
  const [draft, setDraft] = useState({ ...saved });

  // Which field is currently being edited
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [saving, setSaving] = useState(false);

  // Password section
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        const vals = {
          name: data.name || "",
          gender: data.gender || "",
          date_of_birth: data.date_of_birth || "",
          country: data.country || "",
        };
        setSaved(vals);
        setDraft(vals);
        setProfilePicUrl(data.profile_picture_url || null);
      }
      setFetching(false);
    })();
  }, [user, navigate]);

  // ── Profile picture ─────────────────────────────────────────────────────────
  const handlePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPic(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("profile-photos").getPublicUrl(path);
      await supabase.from("profiles").update({ profile_picture_url: publicUrl }).eq("id", user.id);
      setProfilePicUrl(publicUrl);
      toast({ title: "Photo updated!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setUploadingPic(false); }
  };

  // ── Per-field save ──────────────────────────────────────────────────────────
  const startEdit = (field: FieldKey) => {
    setDraft({ ...saved });
    setEditing(field);
  };

  const cancelEdit = () => { setDraft({ ...saved }); setEditing(null); };

  const saveField = async (field: FieldKey) => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (field === "name")          payload.name = draft.name;
      if (field === "date_of_birth") payload.date_of_birth = draft.date_of_birth || null;
      if (field === "gender")        payload.gender = draft.gender || null;
      if (field === "country")       payload.country = draft.country || null;

      const { error } = await supabase.from("profiles").update(payload).eq("id", user!.id);
      if (error) throw error;

      setSaved({ ...saved, ...payload });
      setEditing(null);
      toast({ title: "Saved!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ── Password ────────────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (newPw.length < 8) {
      toast({ title: "Error", description: "Minimum 8 characters", variant: "destructive" }); return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "Error", description: "Passwords don't match", variant: "destructive" }); return;
    }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast({ title: "Password updated!" });
      setNewPw(""); setConfirmPw(""); setEditing(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setChangingPw(false); }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const genderLabel = (g: string) =>
    ({ male: "Male", female: "Female", other: "Other", prefer_not_to_say: "Private" }[g] || "—");

  const formatDob = (d: string) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  if (fetching) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-28">
      <Header />

      {/* ── FIX: removed max-w-2xl so this container matches the Header's container width on large screens ── */}
      <main className="container px-4 py-8 mx-auto">

        {/* Back + title */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Account</p>
            <h1 className="text-2xl font-black uppercase tracking-tight" style={{ color: T }}>Profile & Security</h1>
          </div>
        </div>

        {/* ── Avatar ── */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-3">
            <div className="h-24 w-24 rounded-full overflow-hidden border-4 shadow-md" style={{ borderColor: `${T}30` }}>
              {profilePicUrl
                ? <img src={profilePicUrl} alt="Avatar" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                : <div className="h-full w-full bg-slate-100 flex items-center justify-center"><User className="h-10 w-10 text-slate-400" /></div>
              }
            </div>
            <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full flex items-center justify-center text-white cursor-pointer shadow-lg transition-colors hover:opacity-90" style={{ backgroundColor: T }}>
              {uploadingPic
                ? <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera className="h-3.5 w-3.5" />
              }
              <input type="file" accept="image/*" className="hidden" onChange={handlePicUpload} disabled={uploadingPic} />
            </label>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tap camera to change photo</p>
        </div>

        {/* ── Fields card ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-6">

          {/* Full Name */}
          <FieldRow
            icon={<User className="h-5 w-5" />}
            label="Full Name"
            isEditing={editing === "name"}
            onEdit={() => startEdit("name")}
            onCancel={cancelEdit}
            onSave={() => saveField("name")}
            saving={saving}
            displayValue={saved.name || "—"}
          >
            <Input
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="Enter your name"
              className="bg-slate-50 border-none rounded-xl h-11 px-4 font-bold focus-visible:ring-1 focus-visible:ring-[#008080]"
            />
          </FieldRow>

          {/* Date of Birth */}
          <FieldRow
            icon={<Calendar className="h-5 w-5" />}
            label="Date of Birth"
            isEditing={editing === "date_of_birth"}
            onEdit={() => startEdit("date_of_birth")}
            onCancel={cancelEdit}
            onSave={() => saveField("date_of_birth")}
            saving={saving}
            displayValue={formatDob(saved.date_of_birth)}
          >
            <Input
              type="date"
              value={draft.date_of_birth}
              onChange={e => setDraft({ ...draft, date_of_birth: e.target.value })}
              className="bg-slate-50 border-none rounded-xl h-11 px-4 font-bold focus-visible:ring-1 focus-visible:ring-[#008080]"
            />
          </FieldRow>

          {/* Gender */}
          <FieldRow
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Gender"
            isEditing={editing === "gender"}
            onEdit={() => startEdit("gender")}
            onCancel={cancelEdit}
            onSave={() => saveField("gender")}
            saving={saving}
            displayValue={genderLabel(saved.gender)}
          >
            <Select value={draft.gender} onValueChange={v => setDraft({ ...draft, gender: v })}>
              <SelectTrigger className="bg-slate-50 border-none rounded-xl h-11 px-4 font-bold focus:ring-1 focus:ring-[#008080]">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">Private</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Country — no border on last */}
          <FieldRow
            icon={<Globe className="h-5 w-5" />}
            label="Country"
            isEditing={editing === "country"}
            onEdit={() => startEdit("country")}
            onCancel={cancelEdit}
            onSave={() => saveField("country")}
            saving={saving}
            displayValue={saved.country || "—"}
            noBorder
          >
            <div className="bg-slate-50 rounded-xl px-3 py-1">
              <CountrySelector value={draft.country} onChange={v => setDraft({ ...draft, country: v })} />
            </div>
          </FieldRow>
        </div>

        {/* ── Password card ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${T}15` }}>
                <Lock className="h-5 w-5" style={{ color: T }} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security</p>
                <p className="font-black text-slate-800 text-sm">Change Password</p>
              </div>
            </div>
            {editing !== "password" && (
              <EditButton onClick={() => setEditing("password")} />
            )}
          </div>

          {editing === "password" && (
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-400">Leave blank if you don't want to change your password.</p>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="New password"
                  className="bg-slate-50 border-none rounded-xl h-11 px-4 pr-12 font-bold focus-visible:ring-1 focus-visible:ring-[#008080]"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPw && <PasswordStrength password={newPw} />}
              {newPw && (
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Confirm new password"
                  className="bg-slate-50 border-none rounded-xl h-11 px-4 font-bold focus-visible:ring-1 focus-visible:ring-[#008080]"
                />
              )}
              <div className="flex gap-3 pt-1">
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPw || !newPw}
                  className="flex-1 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest text-white border-none"
                  style={{ backgroundColor: T }}
                >
                  {changingPw ? "Updating..." : "Update Password"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setEditing(null); setNewPw(""); setConfirmPw(""); }}
                  className="h-11 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <MobileBottomBar />
    </div>
  );
};

// ── FieldRow component ────────────────────────────────────────────────────────
interface FieldRowProps {
  icon: React.ReactNode;
  label: string;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  displayValue: string;
  children: React.ReactNode;
  noBorder?: boolean;
}

const EditButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="h-8 px-3 rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-colors hover:opacity-80"
    style={{ backgroundColor: "#008080" + "15", color: "#008080" }}
  >
    <Pencil className="h-3 w-3" />
    Edit
  </button>
);

const FieldRow = ({
  icon, label, isEditing, onEdit, onCancel, onSave, saving,
  displayValue, children, noBorder = false,
}: FieldRowProps) => (
  <div className={`p-5 ${!noBorder ? "border-b border-slate-50" : ""}`}>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#00808015" }}>
          <span style={{ color: "#008080" }}>{icon}</span>
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      </div>
      {!isEditing && <EditButton onClick={onEdit} />}
      {isEditing && (
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="h-8 px-3 rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: "#FF7F50" }}
          >
            <Check className="h-3 w-3" />
            {saving ? "..." : "Save"}
          </button>
          <button
            onClick={onCancel}
            className="h-8 w-8 rounded-xl flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>

    {!isEditing
      ? <p className="font-bold text-slate-800 pl-12">{displayValue}</p>
      : <div className="pl-12">{children}</div>
    }
  </div>
);

export default ProfileEdit;