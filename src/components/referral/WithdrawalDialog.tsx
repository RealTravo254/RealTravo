import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Smartphone, Building2, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  RED: "#FF0000",
};

interface WithdrawalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBalance: number;
  userId: string;
  onSuccess?: () => void;
}

export const WithdrawalDialog = ({
  open,
  onOpenChange,
  availableBalance,
  userId,
  onSuccess,
}: WithdrawalDialogProps) => {
  const [withdrawMethod, setWithdrawMethod] = useState<"mpesa" | "bank">("mpesa");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [mpesaNumber, setMpesaNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false);

  // Pre-fill from saved withdrawal details
  useEffect(() => {
    if (!userId || detailsLoaded) return;
    const loadDetails = async () => {
      const [bankRes, profileRes] = await Promise.all([
        supabase.from("bank_details").select("bank_name, account_number, account_holder_name").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("phone_number").eq("id", userId).single(),
      ]);
      if (bankRes.data) {
        setBankCode(bankRes.data.bank_name || "");
        setAccountNumber(bankRes.data.account_number || "");
        setAccountName(bankRes.data.account_holder_name || "");
      }
      if (profileRes.data?.phone_number) {
        setMpesaNumber(profileRes.data.phone_number);
      }
      setDetailsLoaded(true);
    };
    loadDetails();
  }, [userId, detailsLoaded]);

  const resetForm = () => {
    setWithdrawAmount("");
    setWithdrawMethod("mpesa");
  };

  const formatMpesaNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "254" + cleaned.slice(1);
    } else if (cleaned.startsWith("+254")) {
      cleaned = cleaned.slice(1);
    } else if (!cleaned.startsWith("254")) {
      cleaned = "254" + cleaned;
    }
    return cleaned;
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amount > availableBalance) {
      toast.error(`Maximum withdrawable amount is KES ${availableBalance.toLocaleString()}`);
      return;
    }

    if (withdrawMethod === "mpesa") {
      if (!mpesaNumber || mpesaNumber.length < 9) {
        toast.error("Please enter a valid M-Pesa phone number");
        return;
      }
    } else {
      if (!bankCode || !accountNumber || !accountName) {
        toast.error("Please fill in all bank details");
        return;
      }
    }

    setWithdrawing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-payouts', {
        body: {
          action: 'withdraw',
          user_id: userId,
          amount: amount,
          payout_type: 'combined',
          payment_method: withdrawMethod,
          mpesa_number: withdrawMethod === "mpesa" ? formatMpesaNumber(mpesaNumber) : undefined,
          bank_code: withdrawMethod === "bank" ? bankCode : undefined,
          account_number: withdrawMethod === "bank" ? accountNumber : undefined,
          account_name: withdrawMethod === "bank" ? accountName : undefined,
        },
      });

      // supabase.functions.invoke sets error for non-2xx, but data may contain success:false on 2xx
      if (error) {
        // Try to extract message from the FunctionsHttpError response body
        const errorBody = typeof error === 'object' && 'context' in error ? await (error as any).context?.json?.().catch(() => null) : null;
        throw new Error(errorBody?.error || error?.message || 'Withdrawal failed');
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Withdrawal failed');
      }

      // Create success notification
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'withdrawal_success',
        title: 'Withdrawal Successful',
        message: `Your withdrawal of KES ${amount.toLocaleString()} to ${withdrawMethod === "mpesa" ? "M-Pesa" : "Bank"} has been initiated.`,
        data: { amount, method: withdrawMethod, reference: data.reference },
      });

      toast.success("Withdrawal initiated successfully!");
      resetForm();
      onOpenChange(false);
      onSuccess?.();

    } catch (error: any) {
      console.error("Withdrawal error:", error);
      
      // Create failure notification
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'withdrawal_failed',
        title: 'Withdrawal Failed',
        message: error.message || 'Your withdrawal request could not be processed.',
        data: { amount: parseFloat(withdrawAmount), method: withdrawMethod, reason: error.message },
      });

      toast.error(error.message || "Failed to process withdrawal");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Withdraw Funds</DialogTitle>
          <DialogDescription>
            Choose your preferred withdrawal method and enter the details below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Available Balance */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Available Balance</p>
            <p className="text-2xl font-black" style={{ color: COLORS.RED }}>
              KES {availableBalance.toLocaleString()}
            </p>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Withdrawal Method
            </Label>
            <RadioGroup 
              value={withdrawMethod} 
              onValueChange={(val) => setWithdrawMethod(val as "mpesa" | "bank")}
              className="grid grid-cols-2 gap-3"
            >
              <div className={`relative flex items-center justify-center gap-2 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                withdrawMethod === "mpesa" ? "border-[#008080] bg-[#008080]/5" : "border-slate-200 hover:border-slate-300"
              }`}>
                <RadioGroupItem value="mpesa" id="mpesa" className="sr-only" />
                <label htmlFor="mpesa" className="flex flex-col items-center gap-2 cursor-pointer">
                  <Smartphone className="h-6 w-6" style={{ color: withdrawMethod === "mpesa" ? COLORS.TEAL : "#94a3b8" }} />
                  <span className={`text-xs font-black uppercase tracking-widest ${
                    withdrawMethod === "mpesa" ? "text-[#008080]" : "text-slate-500"
                  }`}>M-Pesa</span>
                </label>
                {withdrawMethod === "mpesa" && (
                  <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-[#008080]" />
                )}
              </div>

              <div className={`relative flex items-center justify-center gap-2 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                withdrawMethod === "bank" ? "border-[#008080] bg-[#008080]/5" : "border-slate-200 hover:border-slate-300"
              }`}>
                <RadioGroupItem value="bank" id="bank" className="sr-only" />
                <label htmlFor="bank" className="flex flex-col items-center gap-2 cursor-pointer">
                  <Building2 className="h-6 w-6" style={{ color: withdrawMethod === "bank" ? COLORS.TEAL : "#94a3b8" }} />
                  <span className={`text-xs font-black uppercase tracking-widest ${
                    withdrawMethod === "bank" ? "text-[#008080]" : "text-slate-500"
                  }`}>Bank</span>
                </label>
                {withdrawMethod === "bank" && (
                  <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-[#008080]" />
                )}
              </div>
            </RadioGroup>
          </div>

          {/* M-Pesa Fields */}
          {withdrawMethod === "mpesa" && (
            <div className="space-y-3">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                M-Pesa Phone Number
              </Label>
              <Input
                type="tel"
                value={mpesaNumber}
                onChange={(e) => setMpesaNumber(e.target.value)}
                placeholder="e.g. 0712345678"
                className="rounded-xl h-12"
              />
              <p className="text-[10px] text-slate-400">
                Enter your M-Pesa registered phone number
              </p>
            </div>
          )}

          {/* Bank Fields */}
          {withdrawMethod === "bank" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Bank Code
                </Label>
                <Input
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  placeholder="e.g. Equity, KCB, Coop Bank"
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Account Number
                </Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Enter account number"
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Account Holder Name
                </Label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Enter account holder name"
                  className="rounded-xl h-12"
                />
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Withdrawal Amount (KES)
            </Label>
            <Input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Enter amount"
              className="rounded-xl h-12"
              max={availableBalance}
            />
          </div>

          {availableBalance <= 0 && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-3 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p className="text-xs font-medium">You don't have any funds available to withdraw</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleWithdraw}
            disabled={withdrawing || !withdrawAmount || availableBalance <= 0}
            className="rounded-xl"
            style={{ backgroundColor: COLORS.TEAL }}
          >
            {withdrawing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm Withdrawal'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
