import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2, Smartphone, Building2, AlertCircle, CheckCircle, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COLORS = { TEAL: "#008080", CORAL: "#FF7F50" };

export const KENYA_BANKS = [
  { name: "Kenya Commercial Bank (KCB)", code: "068" },
  { name: "Equity Bank", code: "049" },
  { name: "Co-operative Bank of Kenya", code: "011" },
  { name: "ABSA Bank Kenya", code: "003" },
  { name: "Standard Chartered Bank Kenya", code: "004" },
  { name: "Stanbic Bank Kenya", code: "031" },
  { name: "Diamond Trust Bank", code: "063" },
  { name: "NCBA Bank", code: "007" },
  { name: "I&M Bank", code: "057" },
  { name: "Family Bank", code: "070" },
  { name: "National Bank of Kenya", code: "012" },
  { name: "Prime Bank", code: "010" },
  { name: "Bank of Africa Kenya", code: "019" },
  { name: "HFC Ltd", code: "008" },
  { name: "Citibank N.A. Kenya", code: "016" },
  { name: "Bank of Baroda Kenya", code: "006" },
  { name: "Bank of India", code: "005" },
  { name: "Sidian Bank", code: "066" },
  { name: "Victoria Commercial Bank", code: "054" },
  { name: "Guardian Bank", code: "053" },
  { name: "Gulf African Bank", code: "072" },
  { name: "First Community Bank", code: "074" },
  { name: "Credit Bank", code: "025" },
  { name: "Consolidated Bank", code: "023" },
  { name: "African Banking Corporation", code: "035" },
  { name: "Access Bank Kenya", code: "084" },
  { name: "UBA Kenya", code: "085" },
  { name: "DIB Bank Kenya", code: "078" },
  { name: "SBM Bank Kenya", code: "076" },
  { name: "Mayfair CIB Bank", code: "065" },
];

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
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [withdrawing, setWithdrawing] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false);

  useEffect(() => {
    if (!userId || detailsLoaded || !open) return;
    const load = async () => {
      const [bankRes, profileRes] = await Promise.all([
        supabase.from("bank_details")
          .select("bank_name, account_number, account_holder_name")
          .eq("user_id", userId).maybeSingle(),
        supabase.from("profiles")
          .select("phone_number").eq("id", userId).single(),
      ]);

      if (bankRes.data) {
        const savedBankName = bankRes.data.bank_name || "";
        const match = KENYA_BANKS.find(
          (b) => b.name === savedBankName || b.code === savedBankName
        );
        setBankName(match?.name || savedBankName);
        setBankCode(match?.code || "");
        setAccountNumber(bankRes.data.account_number || "");
        setAccountName(bankRes.data.account_holder_name || "");
      }
      if (profileRes.data?.phone_number) {
        setMpesaNumber(profileRes.data.phone_number);
      }
      setDetailsLoaded(true);
    };
    load();
  }, [userId, detailsLoaded, open]);

  const resetForm = () => {
    setWithdrawAmount("");
    setDetailsLoaded(false);
  };

  const handleBankSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = KENYA_BANKS.find((b) => b.code === e.target.value);
    if (selected) {
      setBankCode(selected.code);
      setBankName(selected.name);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);

    if (isNaN(amount) || amount <= 0) { toast.error("Please enter a valid amount"); return; }
    if (amount > availableBalance) { toast.error(`Maximum withdrawable: KES ${availableBalance.toLocaleString()}`); return; }
    if (amount < 100) { toast.error("Minimum withdrawal is KES 100"); return; }

    if (withdrawMethod === "mpesa") {
      if (!mpesaNumber || mpesaNumber.replace(/\D/g, "").length < 9) {
        toast.error("Please enter a valid M-Pesa phone number"); return;
      }
    } else {
      if (!bankCode) { toast.error("Please select your bank"); return; }
      if (!accountNumber.trim()) { toast.error("Please enter your account number"); return; }
      if (!accountName.trim()) { toast.error("Please enter the account holder name"); return; }
    }

    setWithdrawing(true);
    try {
      const requestBody: Record<string, any> = {
        action: "withdraw",
        user_id: userId,
        amount,
        payout_type: "combined",
        payment_method: withdrawMethod,
      };

      // Only include the relevant fields — send null explicitly so the edge
      // function receives them and can safely guard against undefined
      if (withdrawMethod === "mpesa") {
        requestBody.mpesa_number = mpesaNumber.trim();
        requestBody.bank_code = null;
        requestBody.account_number = null;
        requestBody.account_name = null;
      } else {
        requestBody.mpesa_number = null;
        requestBody.bank_code = bankCode;
        requestBody.account_number = accountNumber.trim();
        requestBody.account_name = accountName.trim();
      }

      const { data, error } = await supabase.functions.invoke("process-payouts", {
        body: requestBody,
      });

      if (error) {
        const body = typeof (error as any).context?.json === "function"
          ? await (error as any).context.json().catch(() => null)
          : null;
        throw new Error(body?.error || (error as any).message || "Withdrawal failed");
      }
      if (!data?.success) throw new Error(data?.error || "Withdrawal failed");

      // Safe notification insert — no .catch() on Supabase client
      try {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "withdrawal_success",
          title: "Withdrawal Successful",
          message: `Your withdrawal of KES ${amount.toLocaleString()} to ${withdrawMethod === "mpesa" ? "M-Pesa" : bankName} has been initiated.`,
          data: { amount, method: withdrawMethod, reference: data.reference },
        });
      } catch (_) { /* notification failure is non-critical */ }

      toast.success(`Withdrawal of KES ${amount.toLocaleString()} initiated!`);
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Withdrawal error:", err);

      // Safe failure notification — no .catch() on Supabase client
      try {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "withdrawal_failed",
          title: "Withdrawal Failed",
          message: err.message || "Your withdrawal could not be processed.",
          data: { amount, method: withdrawMethod, reason: err.message },
        });
      } catch (_) { /* notification failure is non-critical */ }

      toast.error(err.message || "Failed to process withdrawal");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md rounded-3xl max-h-[90vh] overflow-y-auto"
        style={{ zIndex: 200 }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Withdraw Funds</DialogTitle>
          <DialogDescription>
            Choose your preferred withdrawal method and enter the details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* Balance pill */}
          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg,#008080,#005f5f)" }}>
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-0.5">Available Balance</p>
            <p className="text-3xl font-black text-white">KES {availableBalance.toLocaleString()}</p>
          </div>

          {availableBalance <= 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs font-medium text-amber-700">No funds available to withdraw</p>
            </div>
          )}

          {/* Method toggle */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Withdrawal Method
            </Label>
            <RadioGroup
              value={withdrawMethod}
              onValueChange={(v) => setWithdrawMethod(v as "mpesa" | "bank")}
              className="grid grid-cols-2 gap-3"
            >
              {(["mpesa", "bank"] as const).map((method) => {
                const active = withdrawMethod === method;
                const Icon = method === "mpesa" ? Smartphone : Building2;
                const label = method === "mpesa" ? "M-Pesa" : "Bank";
                return (
                  <div
                    key={method}
                    onClick={() => setWithdrawMethod(method)}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      active ? "border-[#008080] bg-[#008080]/5" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <RadioGroupItem value={method} id={method} className="sr-only" />
                    <Icon className="h-6 w-6" style={{ color: active ? COLORS.TEAL : "#94a3b8" }} />
                    <span className={`text-xs font-black uppercase tracking-widest ${active ? "text-[#008080]" : "text-slate-500"}`}>{label}</span>
                    {active && <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-[#008080]" />}
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* M-Pesa fields */}
          {withdrawMethod === "mpesa" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                M-Pesa Phone Number
              </Label>
              <Input
                type="tel"
                value={mpesaNumber}
                onChange={(e) => setMpesaNumber(e.target.value)}
                placeholder="e.g. 0712345678"
                className="rounded-xl h-11"
              />
              <p className="text-[10px] text-slate-400">Enter your M-Pesa registered number (07xxxxxxxx or 254xxxxxxxxx)</p>
            </div>
          )}

          {/* Bank fields */}
          {withdrawMethod === "bank" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bank Name</Label>
                <div className={`rounded-xl border h-11 px-3 flex items-center bg-white transition-all focus-within:ring-2 focus-within:ring-[#008080]/20 focus-within:border-[#008080] ${!bankCode && "border-slate-200"}`}>
                  <select
                    value={bankCode}
                    onChange={handleBankSelect}
                    className="w-full h-full bg-transparent text-sm font-medium text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="">Select your bank…</option>
                    {KENYA_BANKS.map((b) => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </div>
                {bankCode && (
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                    Bank code: <span className="font-bold text-slate-600">{bankCode}</span> (auto-resolved)
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Account Number</Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Enter your bank account number"
                  className="rounded-xl h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Account Holder Name</Label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Name exactly as on bank account"
                  className="rounded-xl h-11"
                />
              </div>

              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 px-3 py-2.5 rounded-xl">
                <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[10px] text-blue-600 leading-relaxed">
                  Account name must match exactly what is registered with your bank. Mismatches will cause the transfer to be rejected by Paystack.
                </p>
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Withdrawal Amount (KES)
              </Label>
              <button
                type="button"
                onClick={() => setWithdrawAmount(String(Math.floor(availableBalance)))}
                className="text-[10px] font-bold text-[#008080] hover:underline"
              >
                Withdraw all
              </button>
            </div>
            <Input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Enter amount"
              className="rounded-xl h-11"
              min={100}
              max={availableBalance}
            />
            <p className="text-[10px] text-slate-400">Minimum: KES 100</p>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleWithdraw}
            disabled={withdrawing || !withdrawAmount || availableBalance <= 0}
            className="rounded-xl flex-1 font-black uppercase tracking-wide"
            style={{ backgroundColor: COLORS.TEAL }}
          >
            {withdrawing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…</>
            ) : (
              "Confirm Withdrawal"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};