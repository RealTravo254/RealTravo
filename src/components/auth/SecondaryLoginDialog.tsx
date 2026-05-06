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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify Access</DialogTitle>
          <DialogDescription>
            Enter the registration number and access PIN for "{itemName}" to manage it.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="regNumber">Registration Number</Label>
            <div className="relative">
              <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="regNumber"
                type="text"
                className="pl-10"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="Enter registration number"
                required
                disabled={isVerifying}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessPin">Access PIN</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="accessPin"
                type="password"
                className="pl-10"
                value={accessPin}
                onChange={(e) => setAccessPin(e.target.value)}
                placeholder="Enter access PIN"
                required
                disabled={isVerifying}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isVerifying}>
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Access"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};