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
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({ 
        title: "Validation Error", 
        description: "Passwords do not match.", 
        variant: "destructive" 
      });
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

  const inputStyle = "h-8 bg-black/20 border-white/10 text-xs rounded-md pr-8";

  return (
    <form onSubmit={handleSignup} className="space-y-1.5">
      {/* Name and Gender Grid Layer */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[9px] uppercase text-slate-500 font-bold ml-0.5">Full Name</Label>
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            className="h-8 bg-black/20 border-white/10 text-xs rounded-md" 
            required 
          />
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

      {/* Email Layer */}
      <div className="space-y-0.5">
        <Label className="text-[9px] uppercase text-slate-500 font-bold ml-0.5">Email</Label>
        <Input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          className="h-8 bg-black/20 border-white/10 text-xs rounded-md" 
          required 
        />
      </div>

      {/* Password Management Grid Layer */}
      <div className="grid grid-cols-2 gap-2">
        {/* Password field with absolute toggle icon */}
        <div className="space-y-0.5">
          <Label className="text-[9px] uppercase text-slate-500 font-bold ml-0.5">Password</Label>
          <div className="relative">
            <Input 
              type={showPassword ? "text" : "password"} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className={inputStyle} 
              required 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              )}
            </button>
          </div>
        </div>

        {/* Confirm Password field with absolute toggle icon */}
        <div className="space-y-0.5">
          <Label className="text-[9px] uppercase text-slate-500 font-bold ml-0.5">Confirm</Label>
          <div className="relative">
            <Input 
              type={showConfirmPassword ? "text" : "password"} 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              className={inputStyle} 
              required 
            />
            <button 
              type="button" 
              onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showConfirmPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Primary Signup Button */}
      <Button 
        type="submit" 
        disabled={loading} 
        className="w-full h-8 bg-[rgb(0,128,128)] text-xs font-bold uppercase mt-2 hover:bg-teal-700 shadow-md shadow-teal-950/30 transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
      </Button>

      <p className="text-[9px] text-center text-slate-600 px-2 pt-1 leading-normal">
        By joining, you agree to our Terms and Privacy policy.
      </p>
    </form>
  );
};