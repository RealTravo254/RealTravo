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
import { User, Calendar, Globe, Phone, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountrySelector } from "@/components/creation/CountrySelector";

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [profileData, setProfileData] = useState<{
    name: string;
    gender: "male" | "female" | "other" | "prefer_not_to_say" | "";
    date_of_birth: string;
    country: string;
    phone_number: string;
  }>({
    name: "",
    gender: "",
    date_of_birth: "",
    country: "",
    phone_number: "",
  });

  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [originalPhone, setOriginalPhone] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchProfile = async () => {
      setFetchingProfile(true);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfileData({
          name: data.name || "",
          gender: data.gender || "",
          date_of_birth: data.date_of_birth || "",
          country: data.country || "",
          phone_number: data.phone_number || "",
        });
        setOriginalPhone(data.phone_number || "");
      }
      setFetchingProfile(false);
    };

    fetchProfile();
  }, [user, navigate]);

  const handleSendVerificationCode = async () => {
    if (!profileData.phone_number || profileData.phone_number === originalPhone) {
      toast({ title: "Error", description: "Please enter a new phone number.", variant: "destructive" });
      return;
    }
    setSendingCode(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    toast({ title: "Verification Code Sent", description: `Your code is: ${code}` });
    sessionStorage.setItem("phone_verification_code", code);
    sessionStorage.setItem("phone_to_verify", profileData.phone_number);
    setShowVerification(true);
    setSendingCode(false);
  };

  const handleVerifyCode = async () => {
    setVerifyingCode(true);
    try {
      const storedCode = sessionStorage.getItem("phone_verification_code");
      const storedPhone = sessionStorage.getItem("phone_to_verify");
      if (verificationCode !== storedCode || profileData.phone_number !== storedPhone) {
        throw new Error("Invalid verification code.");
      }

      const { error } = await supabase
        .from("profiles")
        .update({ phone_number: profileData.phone_number, phone_verified: true })
        .eq("id", user!.id);

      if (error) throw error;
      toast({ title: "Success!", description: "Phone number verified successfully." });
      setShowVerification(false);
      setOriginalPhone(profileData.phone_number);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileData.phone_number !== originalPhone && !showVerification) {
      toast({ title: "Action Required", description: "Verify your new phone number first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: profileData.name,
          date_of_birth: profileData.date_of_birth || null,
          country: profileData.country || null,
          gender: profileData.gender || null,
        })
        .eq("id", user!.id);

      if (error) throw error;
      toast({ title: "Profile Updated", description: "Your details have been saved." });
      navigate("/account");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen bg-background"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Header />

      <main className="flex-1 px-4 pt-3 pb-12 max-w-lg mx-auto w-full space-y-4">
        {/* Navigation Bar Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-black text-foreground leading-tight">
              Edit Profile
            </h1>
            <p className="text-[11px] font-medium text-muted-foreground">
              Update your account details and contact preferences
            </p>
          </div>
        </div>

        {fetchingProfile ? (
          <div className="p-8 flex justify-center items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60 shadow-sm">
              {/* Full Name */}
              <ProfileField icon={<User className="h-4 w-4" />} label="Full Name">
                <Input
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  placeholder="Enter full name"
                  className="border-none shadow-none p-0 h-8 font-bold text-xs text-foreground focus-visible:ring-0 placeholder:text-muted-foreground bg-transparent"
                />
              </ProfileField>

              {/* Date of Birth */}
              <ProfileField icon={<Calendar className="h-4 w-4" />} label="Date of Birth">
                <Input
                  type="date"
                  value={profileData.date_of_birth}
                  onChange={(e) => setProfileData({ ...profileData, date_of_birth: e.target.value })}
                  className="border-none shadow-none p-0 h-8 font-bold text-xs text-foreground focus-visible:ring-0 bg-transparent"
                />
              </ProfileField>

              {/* Gender */}
              <ProfileField icon={<User className="h-4 w-4" />} label="Gender Identity">
                <Select
                  value={profileData.gender}
                  onValueChange={(v: any) => setProfileData({ ...profileData, gender: v })}
                >
                  <SelectTrigger className="border-none shadow-none p-0 h-8 font-bold text-xs text-foreground focus:ring-0 bg-transparent">
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border bg-popover">
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Private</SelectItem>
                  </SelectContent>
                </Select>
              </ProfileField>

              {/* Home Country */}
              <ProfileField icon={<Globe className="h-4 w-4" />} label="Home Country">
                <div className="pt-0.5">
                  <CountrySelector
                    value={profileData.country}
                    onChange={(v) => setProfileData({ ...profileData, country: v })}
                  />
                </div>
              </ProfileField>

              {/* Phone Number */}
              <ProfileField icon={<Phone className="h-4 w-4" />} label="Phone Number" noBorder>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <Input
                      type="tel"
                      value={profileData.phone_number}
                      onChange={(e) => setProfileData({ ...profileData, phone_number: e.target.value })}
                      className="border-none shadow-none p-0 h-8 font-bold text-xs text-foreground focus-visible:ring-0 bg-transparent"
                      placeholder="Enter phone number"
                    />
                    {profileData.phone_number !== originalPhone && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSendVerificationCode}
                        disabled={sendingCode}
                        className="h-7 px-2.5 rounded-md text-[10px] font-bold text-white bg-primary hover:bg-primary/90 transition-all shrink-0"
                      >
                        {sendingCode ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                      </Button>
                    )}
                  </div>

                  {showVerification && (
                    <div className="mt-2 p-3 bg-muted/40 rounded-lg border border-border space-y-2">
                      <div className="flex items-center gap-1 text-primary">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Enter Verification Code
                        </Label>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder="000000"
                          className="bg-background rounded-md border-border text-center font-bold tracking-widest text-xs h-8"
                          maxLength={6}
                        />
                        <Button
                          type="button"
                          onClick={handleVerifyCode}
                          disabled={verifyingCode}
                          className="h-8 px-3 text-[10px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shrink-0"
                        >
                          {verifyingCode ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </ProfileField>
            </div>

            {/* Submit & Cancel Actions */}
            <div className="pt-2 flex gap-2">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 h-10 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm transition-all active:scale-95"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/account")}
                className="h-10 px-4 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted border-border"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
}

/* Helper Component for Form Row Rows */
const ProfileField = ({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  noBorder?: boolean;
}) => (
  <div className="p-3.5 flex items-start gap-3 hover:bg-muted/30 transition-colors">
    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5 block">
        {label}
      </Label>
      <div className="min-h-[28px] flex items-center">{children}</div>
    </div>
  </div>
);