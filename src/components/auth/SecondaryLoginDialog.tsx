import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Key, Loader2 } from "lucide-react";

interface SecondaryLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void; 
  onSuccess: () => void; 
  itemId: string;
  itemType: 'hotel' | 'adventure' | 'adventure_place';
  itemName: string;
}
 
export const SecondaryLoginDialog = ({ 
  open, 
  onOpenChange, 
  onSuccess, 
  itemId,
  itemType,
  itemName 
}: SecondaryLoginDialogProps) => {
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [accessPin, setAccessPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  // Shared Design System Tokens - Unified with Brand Teal Focus
  const inputClass =
    "h-11 rounded-xl bg-black/30 border-white/10 text-white placeholder:text-white/30 focus:border-[rgb(0,128,128)] focus:ring-1 focus:ring-[rgb(0,128,128)] focus:bg-black/50 transition-all duration-200 pl-10";
  const labelClass = "text-xs font-semibold uppercase tracking-wider text-slate-400";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    
    try {
      // Call edge function for server-side verification
      const { data, error } = await supabase.functions.invoke('verify-item-access', {
        body: {
          itemId,
          itemType,
          pin: accessPin,
          registrationNumber,
        },
      });

      if (error) {
        console.error('Verification error:', error);
        toast({
          title: "Verification Failed",
          description: "Unable to verify credentials. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (data?.valid === true) {
        toast({
          title: "Access Granted",
          description: "You can now manage this listing.",
        });
        onSuccess();
        onOpenChange(false);
        setRegistrationNumber("");
        setAccessPin("");
      } else {
        toast({
          title: "Access Denied",
          description: "Invalid registration number or access PIN",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-white/10 text-white max-w-md rounded-2xl backdrop-blur-md">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl font-bold text-white tracking-tight">Verify Access</DialogTitle>
          <DialogDescription className="text-sm text-slate-400 leading-relaxed">
            Enter the registration number and access PIN for <span className="text-[rgb(0,128,128)] font-semibold">"{itemName}"</span> to manage it.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="regNumber" className={labelClass}>Registration Number</Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                id="regNumber"
                type="text"
                className={inputClass}
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="Enter registration number"
                required
                disabled={isVerifying}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accessPin" className={labelClass}>Access PIN</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                id="accessPin"
                type="password"
                className={inputClass}
                value={accessPin}
                onChange={(e) => setAccessPin(e.target.value)}
                placeholder="Enter access PIN"
                required
                disabled={isVerifying}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-11 rounded-xl text-sm font-bold bg-[rgb(0,128,128)] text-white hover:bg-teal-700 transition-all duration-150 shadow-md mt-2" 
            disabled={isVerifying}
          >
            {isVerifying ? (
              <span className="flex items-center gap-2 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                Verifying Credentials...
              </span>
            ) : (
              "Verify Access"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};