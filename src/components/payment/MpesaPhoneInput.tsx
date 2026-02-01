import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone } from "lucide-react";

interface MpesaPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const MpesaPhoneInput = ({
  value,
  onChange,
  disabled = false,
}: MpesaPhoneInputProps) => {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
        <Phone className="h-3 w-3" />
        M-Pesa Phone Number
      </Label>
      <Input
        type="tel"
        placeholder="e.g. 0712345678"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-12 rounded-xl border-slate-200 focus:ring-2 focus:ring-[#008080] text-base"
      />
      <p className="text-[10px] text-slate-400">
        Enter the phone number registered with M-Pesa. You will receive an STK push prompt.
      </p>
    </div>
  );
};
