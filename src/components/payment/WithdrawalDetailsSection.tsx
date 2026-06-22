import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Smartphone, Building2, Save, Loader2, CheckCircle, Pencil } from "lucide-react";
import { KENYA_BANKS } from "@/components/referral/WithdrawalDialog";

interface WithdrawalDetailsSectionProps {
  userId: string;
}

export const WithdrawalDetailsSection = ({ userId }: WithdrawalDetailsSectionProps) => {
  const [mpesaNumber, setMpesaNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankDisplayName, setBankDisplayName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasSavedDetails, setHasSavedDetails] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      const [bankRes, profileRes] = await Promise.all([
        supabase.from("bank_details")
          .select("bank_name, account_number, account_holder_name")
          .eq("user_id", userId).maybeSingle(),
        supabase.from("profiles")
          .select("phone_number").eq("id", userId).single(),
      ]);

      if (bankRes.data) {
        const savedValue = bankRes.data.bank_name || "";
        const match = KENYA_BANKS.find(
          (b) => b.code === savedValue || b.name === savedValue
        );
        setBankCode(match?.code || savedValue);
        setBankDisplayName(match?.name || savedValue);
        setAccountNumber(bankRes.data.account_number || "");
        setAccountName(bankRes.data.account_holder_name || "");
        if (savedValue || bankRes.data.account_number) setHasSavedDetails(true);
      }

      if (profileRes.data?.phone_number) {
        setMpesaNumber(profileRes.data.phone_number);
        setHasSavedDetails(true);
      }

      setLoaded(true);
    };
    if (userId) fetchDetails();
  }, [userId]);

  const handleBankSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = KENYA_BANKS.find((b) => b.code === e.target.value);
    if (selected) { setBankCode(selected.code); setBankDisplayName(selected.name); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (bankCode || accountNumber || accountName) {
        const { data: existing } = await supabase
          .from("bank_details").select("id").eq("user_id", userId).maybeSingle();

        if (existing) {
          await supabase.from("bank_details").update({
            bank_name: bankCode,
            account_number: accountNumber,
            account_holder_name: accountName,
            last_updated: new Date().toISOString(),
          }).eq("user_id", userId);
        } else {
          await supabase.from("bank_details").insert({
            user_id: userId,
            bank_name: bankCode,
            account_number: accountNumber,
            account_holder_name: accountName,
          });
        }
      }

      if (mpesaNumber) {
        await supabase.from("profiles").update({ phone_number: mpesaNumber }).eq("id", userId);
      }

      setHasSavedDetails(true);
      setIsEditing(false);
      toast.success("Withdrawal details saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save details");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  if (hasSavedDetails && !isEditing) {
    return (
      <div className="bg-card rounded-xl p-4 border border-border mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-foreground">Withdrawal Details</h2>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Your saved payout information</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}
            className="rounded-lg text-[9px] font-bold uppercase h-7 px-3">
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </div>

        <div className="space-y-2">
          {mpesaNumber && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="p-1.5 rounded-md bg-primary/10"><Smartphone className="h-3.5 w-3.5 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">M-Pesa</p>
                <p className="text-sm font-bold text-foreground">{mpesaNumber}</p>
              </div>
              <CheckCircle className="h-4 w-4 text-primary shrink-0" />
            </div>
          )}
          {bankCode && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="p-1.5 rounded-md bg-primary/10"><Building2 className="h-3.5 w-3.5 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Bank Account</p>
                <p className="text-sm font-bold text-foreground truncate">{bankDisplayName || bankCode}</p>
                <p className="text-xs text-muted-foreground">{accountNumber} · {accountName}</p>
              </div>
              <CheckCircle className="h-4 w-4 text-primary shrink-0" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-4 border border-border mb-4">
      <h2 className="text-sm font-black uppercase tracking-tight text-foreground mb-0.5">Withdrawal Details</h2>
      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
        Set your M-Pesa &amp; bank info for payouts
      </p>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Smartphone className="h-3 w-3" /> M-Pesa Number
          </Label>
          <Input
            type="tel"
            value={mpesaNumber}
            onChange={(e) => setMpesaNumber(e.target.value)}
            placeholder="e.g. 0712345678"
            className="rounded-lg h-10 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Building2 className="h-3 w-3" /> Bank Name
          </Label>
          <div className="rounded-lg border border-input h-10 px-3 flex items-center bg-background">
            <select
              value={bankCode}
              onChange={handleBankSelect}
              className="w-full h-full bg-transparent text-sm font-medium text-foreground outline-none cursor-pointer"
            >
              <option value="">Select your bank…</option>
              {KENYA_BANKS.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
          </div>
          {bankCode && (
            <p className="text-[9px] text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-emerald-500" />
              Code: <span className="font-bold">{bankCode}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Account No.</Label>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Account number"
              className="rounded-lg h-10 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Account Name</Label>
            <Input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Holder name"
              className="rounded-lg h-10 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          {hasSavedDetails && (
            <Button variant="outline" onClick={() => setIsEditing(false)} size="sm"
              className="rounded-lg text-[9px] font-bold uppercase h-8 px-4 flex-1">
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} size="sm"
            className="rounded-lg text-[9px] font-bold uppercase h-8 px-4 flex-1">
            {saving
              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving…</>
              : <><Save className="h-3 w-3 mr-1" /> Save Details</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
};