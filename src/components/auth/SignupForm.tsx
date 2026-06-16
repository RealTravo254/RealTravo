import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export const SignupForm = ({ onSwitchToLogin }: { onSwitchToLogin: () => void }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Validation Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ 
      email, 
      password, 
      options: { data: { name, gender } } 
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Verify your email to continue." });
    }
    setLoading(false);
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
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

  const inputStyle = "h-8 bg-black/20 border-white/10 text-xs rounded-md pr-8";

  return (
    <form onSubmit={handleSignup} className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[9px] uppercase text-slate-500 font-bold ml-0.5">Full Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 bg-black/20 border-white/10 text-xs rounded-md" required />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[9px] uppercase text-slate-500 font-bold ml-0.5">Gender</Label>
          <Select onValueChange={setGender}>
            <SelectTrigger className="h-8 bg-black/20 border-white/10 text-xs rounded-md">
              <SelectValue placeholder="-" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-white">
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-0.5">
        <Label className="text-[9px] uppercase text-slate-500 font-bold ml-0.5">Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 bg-black/20 border-white/10 text-xs rounded-md" required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[9px] uppercase text-slate-500 font-bold ml-0.5">Password</Label>
          <div className="relative">
            <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyle} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-0.5">
          <Label className="text-[9px] uppercase text-slate-500 font-bold ml-0.5">Confirm</Label>
          <div className="relative">
            <Input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputStyle} required />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">
              {showConfirmPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={loading || googleLoading} className="w-full h-8 bg-[rgb(0,128,128)] text-xs font-bold uppercase mt-1">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
      </Button>

      {/* Decorative Separator Line */}
      <div className="relative flex py-0.5 items-center">
        <div className="flex-grow border-t border-white/5"></div>
        <span className="flex-shrink mx-2 text-[8px] text-slate-600 uppercase font-bold tracking-wider">Or</span>
        <div className="flex-grow border-t border-white/5"></div>
      </div>

      {/* Clean Google Signup Action */}
      <Button 
        type="button" 
        disabled={loading || googleLoading} 
        onClick={handleGoogleSignUp}
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
        SignUp with Google
      </Button>

      <p className="text-[8px] text-center text-slate-600 px-2 pt-0.5 leading-tight">
        By joining, you agree to our Terms and Privacy policy.
      </p>
    </form>
  );
};