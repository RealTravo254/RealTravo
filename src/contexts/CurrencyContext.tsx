import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type Currency = "KES" | "USD";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rate: number;
  convertPrice: (kesAmount: number) => number;
  formatPrice: (kesAmount: number) => string;
  usdHint: (kesAmount: number) => string;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const FALLBACK_RATE = 129;
const CACHE_KEY = "realtravo_currency";
const RATE_CACHE_KEY = "realtravo_exchange_rate";
const RATE_CACHE_DURATION = 1800000;

const fetchExchangeRate = async (): Promise<number> => {
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (res.ok) {
      const data = await res.json();
      if (data.rates?.KES) return data.rates.KES;
    }
  } catch {}

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (res.ok) {
      const data = await res.json();
      if (data.rates?.KES) return data.rates.KES;
    }
  } catch {}

  return FALLBACK_RATE;
};

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState<Currency>(() => {
    return (localStorage.getItem(CACHE_KEY) as Currency) || "KES";
  });
  const [rate, setRate] = useState(() => {
    const cached = localStorage.getItem(RATE_CACHE_KEY);
    if (cached) {
      try {
        const { rate: r } = JSON.parse(cached);
        return r || FALLBACK_RATE;
      } catch {}
    }
    return FALLBACK_RATE;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadRate = async () => {
      const cached = localStorage.getItem(RATE_CACHE_KEY);
      if (cached) {
        try {
          const { rate: cachedRate, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < RATE_CACHE_DURATION) {
            setRate(cachedRate);
            return;
          }
        } catch {}
      }

      setLoading(true);
      try {
        const liveRate = await fetchExchangeRate();
        setRate(liveRate);
        localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate: liveRate, timestamp: Date.now() }));
      } finally {
        setLoading(false);
      }
    };
    loadRate();
  }, []);

  useEffect(() => {
    const detectCurrency = async () => {
      if (!user) return;
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) return;

      const { data } = await supabase
        .from("profiles")
        .select("country")
        .eq("id", user.id)
        .single();

      if (data?.country && data.country !== "Kenya") {
        setCurrencyState("USD");
        localStorage.setItem(CACHE_KEY, "USD");
      }
    };
    detectCurrency();
  }, [user]);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem(CACHE_KEY, c);
  }, []);

  const convertPrice = useCallback((kesAmount: number) => {
    if (currency === "KES") return Math.ceil(kesAmount);
    return Math.ceil((kesAmount / rate) * 100) / 100;
  }, [currency, rate]);

  const formatPrice = useCallback((kesAmount: number) => {
    if (currency === "KES") return `KSh ${Math.ceil(kesAmount).toLocaleString()}`;
    const usd = Math.ceil((kesAmount / rate) * 100) / 100;
    return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }, [currency, rate]);

  const usdHint = useCallback((kesAmount: number) => {
    if (!kesAmount || kesAmount <= 0) return "";
    const usd = Math.ceil((kesAmount / rate) * 100) / 100;
    return `≈ $${usd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }, [rate]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rate, convertPrice, formatPrice, usdHint, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    return {
      currency: "KES" as Currency,
      setCurrency: () => {},
      rate: FALLBACK_RATE,
      convertPrice: (kesAmount: number) => Math.ceil(kesAmount),
      formatPrice: (kesAmount: number) => `KSh ${Math.ceil(kesAmount).toLocaleString()}`,
      usdHint: () => "",
      loading: false,
    };
  }
  return ctx;
};