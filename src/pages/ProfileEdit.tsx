import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronRight, User, Calendar, Globe, Phone } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CountrySelector } from "@/components/creation/CountrySelector";

const ProfileEdit = () => {
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
    phone_number: ""
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
          phone_number: data.phone_number || ""
        });
        setOriginalPhone(data.phone_number || "");
      }
      setFetchingProfile(false);
    };

    fetchProfile();
  }, [user, navigate]);

  const handleSendVerificationCode = async () => {
    if (!profileData.phone_number || profileData.phone_number === originalPhone) {
      toast({
        title: "Error",
        description: "Please enter a new phone number.",
        variant: "destructive"
      });
      return;
    }

    setSendingCode(true);
    try {
      // Generate a random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // In a real app, you would send this via SMS API
      // For now, we'll just show it in a toast (demo purposes)
      toast({
        title: "Verification Code Sent",
        description: `Your code is: ${code} (Demo: In production, this would be sent via SMS)`,
      });

      // Store the code temporarily (in production, store it server-side)
      sessionStorage.setItem("phone_verification_code", code);
      sessionStorage.setItem("phone_to_verify", profileData.phone_number);
      
      setShowVerification(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to send verification code.",
        variant: "destructive"
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    setVerifyingCode(true);
    try {
      const storedCode = sessionStorage.getItem("phone_verification_code");
      const storedPhone = sessionStorage.getItem("phone_to_verify");

      if (verificationCode !== storedCode || profileData.phone_number !== storedPhone) {
        throw new Error("Invalid verification code.");
      }

      // Update phone number and set it as verified
      const { error } = await supabase
        .from("profiles")
        .update({ 
          phone_number: profileData.phone_number,
          phone_verified: true 
        })
        .eq("id", user!.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Phone number verified and updated.",
      });

      // Clean up
      sessionStorage.removeItem("phone_verification_code");
      sessionStorage.removeItem("phone_to_verify");
      setShowVerification(false);
      setVerificationCode("");
      setOriginalPhone(profileData.phone_number);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if phone number changed but not verified
    if (profileData.phone_number !== originalPhone && !showVerification) {
      toast({
        title: "Phone Verification Required",
        description: "Please verify your new phone number before saving.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const updateData: any = {
        name: profileData.name,
        date_of_birth: profileData.date_of_birth || null,
        country: profileData.country || null,
      };
      
      if (profileData.gender) {
        updateData.gender = profileData.gender;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user!.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your profile has been updated.",
      });

      navigate("/profile");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Edit Profile</h1>

        <Card className="overflow-hidden">
          {fetchingProfile ? (
            <div className="p-6 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center justify-between py-4">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="h-5 w-5 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="divide-y">
                {/* Name Field */}
                <div className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="name" className="text-sm text-muted-foreground cursor-pointer">
                        Name
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                        required
                        className="border-0 shadow-none p-0 h-8 focus-visible:ring-0 font-medium"
                        placeholder="Tap to add name"
                      />
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>

                {/* Date of Birth Field */}
                <div className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="dob" className="text-sm text-muted-foreground cursor-pointer">
                        Date of Birth
                      </Label>
                      <Input
                        id="dob"
                        type="date"
                        value={profileData.date_of_birth}
                        onChange={(e) => setProfileData({ ...profileData, date_of_birth: e.target.value })}
                        className="border-0 shadow-none p-0 h-8 focus-visible:ring-0 font-medium"
                      />
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>

                {/* Gender Field */}
                <div className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="gender" className="text-sm text-muted-foreground">
                        Gender
                      </Label>
                      <Select
                        value={profileData.gender}
                        onValueChange={(value: any) =>
                          setProfileData({ ...profileData, gender: value })
                        }
                      >
                        <SelectTrigger 
                          id="gender" 
                          className="border-0 shadow-none p-0 h-8 focus:ring-0 font-medium w-full"
                        >
                          <SelectValue placeholder="Tap to select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Country Field */}
                <div className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-sm text-muted-foreground">
                        Country
                      </Label>
                      <CountrySelector
                        value={profileData.country}
                        onChange={(value) => setProfileData({ ...profileData, country: value })}
                      />
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Phone Number Field */}
                <div className="p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="phone" className="text-sm text-muted-foreground">
                        Phone Number
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="phone"
                          type="tel"
                          value={profileData.phone_number}
                          onChange={(e) => setProfileData({ ...profileData, phone_number: e.target.value })}
                          className="border-0 shadow-none p-0 h-8 focus-visible:ring-0 font-medium"
                          placeholder="Enter phone number"
                        />
                        {profileData.phone_number !== originalPhone && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSendVerificationCode}
                            disabled={sendingCode}
                          >
                            {sendingCode ? "Sending..." : "Verify"}
                          </Button>
                        )}
                      </div>
                      
                      {showVerification && (
                        <div className="space-y-2 pt-2">
                          <Label htmlFor="code" className="text-sm text-muted-foreground">
                            Verification Code
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id="code"
                              type="text"
                              value={verificationCode}
                              onChange={(e) => setVerificationCode(e.target.value)}
                              placeholder="Enter 6-digit code"
                              maxLength={6}
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleVerifyCode}
                              disabled={verifyingCode || verificationCode.length !== 6}
                            >
                              {verifyingCode ? "Verifying..." : "Confirm"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="p-6 flex gap-4">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/profile")}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default ProfileEdit;
