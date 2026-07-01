import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRY_PHONE_CODES } from "@/lib/countryHelpers";
import { Phone } from "lucide-react";

const COLORS = {
  TEAL: "#008080",
  SOFT_GRAY: "#F8F9FA",
};

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  country?: string;
  placeholder?: string;
}

export const PhoneInput = ({ value, onChange, country, placeholder = "712 345 678" }: PhoneInputProps) => {
  const countryCode = country ? COUNTRY_PHONE_CODES[country] || "+254" : "+254";
  const [selectedCode, setSelectedCode] = useState(countryCode);

  // Extract phone number without code
  const phoneNumber = value.replace(selectedCode, "").replace(/^0+/, "");

  const handlePhoneChange = (phoneValue: string) => {
    const cleanPhone = phoneValue.replace(/^0+/, "").replace(/\D/g, "");
    onChange(`${selectedCode}${cleanPhone}`);
  };

  const handleCodeChange = (code: string) => {
    setSelectedCode(code);
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    onChange(`${code}${cleanPhone}`);
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
        Phone Number
      </label>

      <div className="flex gap-0 rounded-[20px] bg-white border border-slate-100 p-1 shadow-sm hover:border-[#008080]/30 transition-all focus-within:ring-2 focus-within:ring-[#008080]/10">
        <Select value={selectedCode} onValueChange={handleCodeChange}>
          <SelectTrigger
            className="w-24 h-12 border-none bg-slate-50 rounded-l-[16px] focus:ring-0 shadow-none"
          >
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-[#008080]" />
              <SelectValue className="text-xs font-black" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
            {Object.entries(COUNTRY_PHONE_CODES).map(([cName, code]) => (
              <SelectItem
                key={`${cName}-${code}`}
                value={code}
                className="text-xs font-bold uppercase tracking-tight focus:bg-[#008080] focus:text-white"
              >
                {cName} ({code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="tel"
          value={phoneNumber}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-12 border-none focus-visible:ring-0 text-sm font-black text-slate-700 placeholder:text-slate-300 placeholder:font-normal uppercase tracking-wider"
        />
      </div>
    </div>
  );
};