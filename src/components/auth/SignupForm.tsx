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
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { name, gender } } });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Verify your email to continue." });
    }
    setLoading(false);
  };

  const inputStyle = "h-8 bg-black/20 border-white/10 text-xs rounded-md";

  return (
    <form onSubmit={handleSignup} className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[9px] uppercase text-slate-500">Full Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className={inputStyle} required />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[9px] uppercase text-slate-500">Gender</Label>
          <Select onValueChange={setGender}>
            <SelectTrigger className={inputStyle}><SelectValue placeholder="-" /></SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-white"><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-0.5">
        <Label className="text-[9px] uppercase text-slate-500">Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyle} required />
      </div>
      <div className="space-y-0.5">
        <Label className="text-[9px] uppercase text-slate-500">Password</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyle} required />
      </div>
      <Button type="submit" disabled={loading} className="w-full h-8 bg-[rgb(0,128,128)] text-xs font-bold uppercase mt-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
      </Button>
      <p className="text-[9px] text-center text-slate-600 px-2 pt-1">By joining, you agree to our Terms and Privacy.</p>
    </form>
  );
};