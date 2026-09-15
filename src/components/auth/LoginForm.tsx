import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

const DEVICE_ID_KEY = "rt_device_id";
const STALE_LOGIN_DAYS = 7;

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export const LoginForm = ({ onSwitchToSignup }: { onSwitchToSignup: () => void }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loginMethod, setLoginMethod] = useState<"password" | "code">("password");
  const [codeSent, setCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Step-up verification state (new device or stale login)
  const [needsDeviceVerification, setNeedsDeviceVerification] = useState(false);
  const [deviceVerifyCode, setDeviceVerifyCode] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const clientAuth = (supabase as any).auth;

  // Mark this device trusted + stamp last_login_at, once verification (of whatever kind) has passed
  const finalizeLogin = async (userId: string) => {
    const deviceId = getDeviceId();
    await supabase.from("user_devices").upsert(
      { user_id: userId, device_id: deviceId, trusted: true, last_seen: new Date().toISOString() },
      { onConflict: "user_id,device_id" }
    );
    await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", userId);
  };

  // After password auth succeeds: decide whether this device/timing needs an extra code
  const checkDeviceAndProceed = async (userId: string) => {
    const deviceId = getDeviceId();

    const { data: deviceRow } = await supabase
      .from("user_devices")
      .select("trusted")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("last_login_at")
      .eq("id", userId)
      .single();

    const lastLogin = profileRow?.last_login_at ? new Date(profileRow.last_login_at) : null;
    const daysSinceLogin = lastLogin ? (Date.now() - lastLogin.getTime()) / 86_400_000 : Infinity;

    const isNewDevice = !deviceRow?.trusted;
    const isStale = daysSinceLogin > STALE_LOGIN_DAYS;

    if (isNewDevice || isStale) {
      setPendingUserId(userId);
      setNeedsDeviceVerification(true);
      const { error: otpError } = await clientAuth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        toast({ title: "Error", description: otpError.message, variant: "destructive" });
      } else {
        toast({
          title: isNewDevice ? "New device detected" : "Welcome back",
          description: "We've emailed you a code — enter it to continue.",
        });
      }
      setLoading(false);
      return;
    }

    await finalizeLogin(userId);
    navigate("/");
  };

  const handleDeviceVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUserId) return;
    setLoading(true);
    const { error } = await clientAuth.verifyOtp({ email, token: deviceVerifyCode, type: "magiclink" });
    if (error) {
      toast({ title: "Verification Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    await finalizeLogin(pendingUserId);
    navigate("/");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (loginMethod === "password") {
      const { data, error } = await clientAuth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      if (data?.user) {
        await checkDeviceAndProceed(data.user.id);
      } else {
        setLoading(false);
      }
    } else {
      if (!codeSent) {
        const { error } = await clientAuth.signInWithOtp({ email });
        if (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
          setCodeSent(true);
          toast({ title: "Code Sent", description: "Check your email for your verification code." });
        }
        setLoading(false);
      } else {
        const { data, error } = await clientAuth.verifyOtp({ email, token: otpCode, type: "magiclink" });
        if (error) {
          toast({ title: "Verification Error", description: error.message, variant: "destructive" });
          setLoading(false);
          return;
        }
        // Email-code login already re-proves identity — trust this device too.
        if (data?.user) await finalizeLogin(data.user.id);
        navigate("/");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await (supabase as any).auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      }
    });
    if (error) {
      toast({ title: "OAuth Error", description: error.message, variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  const inputStyle = "h-8 bg-black/20 border-white/10 text-xs rounded-md";

  if (needsDeviceVerification) {
    return (
      <form onSubmit={handleDeviceVerify} className="space-y-2">
        <div className="flex items-center gap-1.5 text-[rgb(0,128,128)]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <Label className="text-[10px] uppercase text-slate-400 font-bold">Confirm it's you</Label>
        </div>
        <p className="text-[10px] text-slate-500 leading-tight">
          It's been a while, or this looks like a new device. Enter the code we sent to {email}.
        </p>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-slate-500">Verification Code</Label>
          <Input
            type="text"
            value={deviceVerifyCode}
            onChange={(e) => setDeviceVerifyCode(e.target.value)}
            className={inputStyle}
            placeholder="123456"
            maxLength={6}
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-8 bg-[rgb(0,128,128)] text-xs font-bold uppercase mt-1">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm & Continue"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setNeedsDeviceVerification(false);
            setPendingUserId(null);
            setDeviceVerifyCode("");
          }}
          className="w-full text-center text-[10px] text-slate-500 hover:underline"
        >
          Back to login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleLogin} className="space-y-2">
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-slate-500">Email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputStyle}
          disabled={codeSent}
          required
        />
      </div>

      {loginMethod === "password" ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase text-slate-500">Password</Label>
            <button
              type="button"
              onClick={() => navigate("/forgot-password", { state: { email } })}
              className="text-[10px] text-[rgb(0,128,128)] hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyle} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">
              {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          </div>
        </div>
      ) : (
        codeSent && (
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-slate-500">Verification Code</Label>
            <Input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className={inputStyle}
              placeholder="123456"
              required
            />
          </div>
        )
      )}

      <Button type="submit" disabled={loading || googleLoading} className="w-full h-8 bg-[rgb(0,128,128)] text-xs font-bold uppercase mt-1">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : loginMethod === "code" && !codeSent ? (
          "Send Login Code"
        ) : (
          "Authenticate"
        )}
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            setLoginMethod(loginMethod === "password" ? "code" : "password");
            setCodeSent(false);
          }}
          className="text-[10px] text-[rgb(0,128,128)] hover:underline"
        >
          {loginMethod === "password" ? "Use Code Login instead" : "Use Password instead"}
        </button>
      </div>

      <div className="relative flex py-1 items-center">
        <div className="flex-grow border-t border-white/5"></div>
        <span className="flex-shrink mx-2 text-[8px] text-slate-600 uppercase font-bold tracking-wider">Or</span>
        <div className="flex-grow border-t border-white/5"></div>
      </div>

      <Button
        type="button"
        disabled={loading || googleLoading}
        onClick={handleGoogleSignIn}
        className="w-full h-8 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"
      >
        {googleLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
        )}
        Continue with Google
      </Button>
    </form>
  );
};