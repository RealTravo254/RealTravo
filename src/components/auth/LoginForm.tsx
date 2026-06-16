import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button"; 
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export const LoginForm = ({ onSwitchToSignup }: { onSwitchToSignup: () => void }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
    } else { navigate("/"); }
  };

  const inputStyle = "h-8 bg-black/20 border-white/10 text-xs rounded-md";

  return (
    <form onSubmit={handleLogin} className="space-y-2">
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-slate-500">Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyle} required />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center"><Label className="text-[10px] uppercase text-slate-500">Password</Label></div>
        <div className="relative">
          <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyle} required />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"><Eye className="w-3 h-3" /></button>
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full h-8 bg-[rgb(0,128,128)] text-xs font-bold uppercase mt-1">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authenticate"}
      </Button>
      <button type="button" onClick={() => navigate("/forgot-password")} className="w-full text-[10px] text-slate-500 hover:text-white pt-1">Forgot password?</button>
    </form>
  );
};