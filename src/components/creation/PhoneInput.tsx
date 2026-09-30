import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRY_PHONE_CODES } from "@/lib/countryHelpers";
import { ChevronDown } from "lucide-react";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  country?: string;
  placeholder?: string;
  label?: string;
  error?: string;
}

export const PhoneInput = ({
  value,
  onChange,
  country,
  placeholder = "712 345 678",
  label = "Phone number",
  error,
}: PhoneInputProps) => {
  const id = useId();
  const initialCode = (country && COUNTRY_PHONE_CODES[country]) || "+254";
  const [selectedCode, setSelectedCode] = useState(initialCode);

  // Digits only, code and leading zeros stripped
  const digits = value.replace(selectedCode, "").replace(/\D/g, "").replace(/^0+/, "");

  // Display in groups of 3 for readability (712 345 678)
  const display = digits.replace(/(\d{3})(?=\d)/g, "$1 ");

  const handlePhoneChange = (raw: string) => {
    const clean = raw.replace(/\D/g, "").replace(/^0+/, "");
    onChange(`${selectedCode}${clean}`);
  };

  const handleCodeChange = (code: string) => {
    setSelectedCode(code);
    onChange(`${code}${digits}`);
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="ml-0.5 text-sm font-medium text-slate-600">
        {label}
      </label>

      <div
        className={[
          "group flex items-stretch overflow-hidden rounded-xl border bg-white transition",
          "focus-within:border-[#008080] focus-within:ring-4 focus-within:ring-[#008080]/15",
          error ? "border-rose-400" : "border-slate-200 hover:border-slate-300",
        ].join(" ")}
      >
        {/* Country code */}
        <Select value={selectedCode} onValueChange={handleCodeChange}>
          <SelectTrigger
            aria-label="Country code"
            className="h-12 w-[92px] shrink-0 gap-1 rounded-none border-0 border-r border-slate-200 bg-[#F4F8F8] px-3.5 shadow-none transition-colors hover:bg-[#E9F2F2] focus:ring-0 focus:ring-offset-0 [&>svg]:hidden"
          >
            <SelectValue>
              <span className="text-sm font-semibold tabular-nums text-[#006666]">{selectedCode}</span>
            </SelectValue>
            <ChevronDown className="h-3.5 w-3.5 text-[#008080]/70" aria-hidden />
          </SelectTrigger>
          <SelectContent className="max-h-72 rounded-xl border-slate-200 shadow-lg">
            {Object.entries(COUNTRY_PHONE_CODES).map(([cName, code]) => (
              <SelectItem
                key={`${cName}-${code}`}
                value={code}
                className="cursor-pointer rounded-lg text-sm text-slate-700 focus:bg-[#008080]/10 focus:text-[#006666] data-[state=checked]:font-semibold"
              >
                <span>{cName}</span>
                <span className="ml-2 tabular-nums text-slate-400">{code}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Number */}
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={display}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={!!error}
          className="h-12 flex-1 rounded-none border-0 bg-transparent px-4 text-base font-medium tabular-nums tracking-wide text-slate-800 shadow-none placeholder:font-normal placeholder:text-slate-300 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      {error && <p className="ml-0.5 text-xs text-rose-600">{error}</p>}
    </div>
  );
};