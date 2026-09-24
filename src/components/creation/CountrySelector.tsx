// src/components/creation/CountrySelector.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export interface Country {
  id: string;
  name: string;
  iso_code: string | null;
}

export interface CountryDivision {
  id: string;
  country_id: string;
  name: string;
}

interface CountrySelectorProps {
  countryId: string | null;
  divisionId: string | null;
  onChange: (value: { countryId: string | null; divisionId: string | null }) => void;
  disabled?: boolean;
}

// z-[300] beats the auth modal's backdrop (z-[200], see AuthModal) so both
// dropdown panels below render above the popup instead of being clipped
// underneath it. This matches the same treatment SignupForm already uses
// for its own <SelectContent> (selectContentStyle) — kept as one constant
// here so both selects in this component stay in sync with it.
const SELECT_CONTENT_STYLE = "z-[300] bg-white border border-slate-200 text-black";

/**
 * Country + division (state/province/county) picker, both lists loaded from
 * the `countries` and `country_divisions` tables so the options always
 * reflect what's in the database rather than a hardcoded list.
 */
export function CountrySelector({ countryId, divisionId, onChange, disabled }: CountrySelectorProps) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [divisions, setDivisions] = useState<CountryDivision[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  useEffect(() => {
    const loadCountries = async () => {
      setLoadingCountries(true);
      const { data } = await supabase
        .from("countries")
        .select("id, name, iso_code")
        .order("name", { ascending: true });
      setCountries(data ?? []);
      setLoadingCountries(false);
    };
    loadCountries();
  }, []);

  useEffect(() => {
    if (!countryId) {
      setDivisions([]);
      return;
    }
    const loadDivisions = async () => {
      setLoadingDivisions(true);
      const { data } = await supabase
        .from("country_divisions")
        .select("id, country_id, name")
        .eq("country_id", countryId)
        .order("name", { ascending: true });
      setDivisions(data ?? []);
      setLoadingDivisions(false);
    };
    loadDivisions();
  }, [countryId]);

  return (
    <div className="space-y-2">
      <Select
        value={countryId ?? undefined}
        disabled={disabled || loadingCountries}
        onValueChange={(value) => onChange({ countryId: value, divisionId: null })}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={loadingCountries ? "Loading countries…" : "Select country"} />
        </SelectTrigger>
        <SelectContent className={SELECT_CONTENT_STYLE}>
          {countries.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {countryId && (
        <Select
          value={divisionId ?? undefined}
          disabled={disabled || loadingDivisions || divisions.length === 0}
          onValueChange={(value) => onChange({ countryId, divisionId: value })}
        >
          <SelectTrigger className="h-9 text-sm">
            {loadingDivisions ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </span>
            ) : (
              <SelectValue
                placeholder={divisions.length === 0 ? "No regions listed" : "Select region / county"}
              />
            )}
          </SelectTrigger>
          <SelectContent className={SELECT_CONTENT_STYLE}>
            {divisions.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}