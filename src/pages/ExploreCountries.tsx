// src/pages/ExploreCountries.tsx
//
// Public page that lists every country (from the `countries` table managed in
// CountryDivisionsManager) as a small square card, two per row, each with its
// image and a live count of approved listings.
//
// Search matches country names AND division names:
//   - a country match shows that country plus ALL of its divisions
//   - a division match shows its parent country plus the matching divisions
//
// Listing counts come from approved rows in `adventure_places`:
//   - per country  → matched on the free-text `country` column vs countries.name
//   - per division → matched on `division_id`

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X, Globe, MapPin, ArrowLeft, ChevronLeft } from "lucide-react";

// ── Where a tapped division should go. Change this one function to match the
// route your home-page "Explore <Country>" rail uses. ──────────────────────
const divisionPath = (country: Country, division: Division) =>
  `/?country=${encodeURIComponent(country.name)}&division=${division.id}`;
const countryPath = (country: Country) => `/?country=${encodeURIComponent(country.name)}`;

// ── Design tokens (same field-guide system as the rest of the app) ────────
const FOREST = "#1F4D3A";
const FOREST_DEEP = "#123322";
const FOREST_SOFT = "#EAF0EA";
const CLAY = "#C1552F";
const INK = "#1C2B22";
const INK_SOFT = "#5B6B60";
const HAIRLINE = "#DCE3DC";
const CANVAS = "#F4F6F2";
const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

const useInjectFonts = () => {
  useEffect(() => {
    const id = "adventure-detail-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
};

interface Country { id: string; name: string; iso_code: string | null; image_url: string | null }
interface Division { id: string; country_id: string; name: string; image_url: string | null }

const listingsLabel = (n: number) => `${n} listing${n === 1 ? "" : "s"}`;

// ── Square tile (used for both countries and divisions) ───────────────────
const SquareTile = ({
  name, image, count, onClick, icon,
}: { name: string; image: string | null; count: number; onClick: () => void; icon: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative aspect-square w-full overflow-hidden rounded-2xl text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2"
    style={{ border: `1px solid ${HAIRLINE}`, background: FOREST_SOFT, boxShadow: "0 4px 14px rgba(28,43,34,0.06)", ["--tw-ring-color" as any]: FOREST }}
  >
    {image ? (
      <img src={image} alt={name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center" style={{ color: `${FOREST}55` }}>
        {icon}
      </div>
    )}
    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(14,23,18,0.82), rgba(14,23,18,0.15) 55%, transparent)" }} />
    <div className="absolute inset-x-0 bottom-0 p-3">
      <h3 className="line-clamp-2 text-base font-semibold leading-tight text-white" style={{ fontFamily: FONT_DISPLAY }}>
        {name}
      </h3>
      <p className="mt-0.5 text-xs font-medium text-white/80">{listingsLabel(count)}</p>
    </div>
  </button>
);

// ── Page ──────────────────────────────────────────────────────────────────
const ExploreCountries = () => {
  useInjectFonts();
  const navigate = useNavigate();

  const [countries, setCountries] = useState<Country[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [places, setPlaces] = useState<{ country: string | null; division_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [activeCountryId, setActiveCountryId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, d, p] = await Promise.all([
        supabase.from("countries").select("id, name, iso_code, image_url").order("name", { ascending: true }),
        supabase.from("country_divisions").select("id, country_id, name, image_url").order("name", { ascending: true }),
        supabase.from("adventure_places").select("country, division_id").eq("approval_status", "approved"),
      ]);
      if (cancelled) return;
      if (c.error || d.error) {
        setError((c.error || d.error)!.message);
      } else {
        setCountries(c.data || []);
        setDivisions(d.data || []);
        setPlaces(p.data || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Listing counts ──
  const countryCounts = useMemo(() => {
    const m = new Map<string, number>();
    places.forEach((p) => {
      const key = (p.country || "").trim().toLowerCase();
      if (key) m.set(key, (m.get(key) || 0) + 1);
    });
    return m;
  }, [places]);

  const divisionCounts = useMemo(() => {
    const m = new Map<string, number>();
    places.forEach((p) => {
      if (p.division_id) m.set(p.division_id, (m.get(p.division_id) || 0) + 1);
    });
    return m;
  }, [places]);

  const countryCount = (c: Country) => countryCounts.get(c.name.trim().toLowerCase()) || 0;
  const divisionsByCountry = useMemo(() => {
    const m = new Map<string, Division[]>();
    divisions.forEach((d) => m.set(d.country_id, [...(m.get(d.country_id) || []), d]));
    return m;
  }, [divisions]);

  // Countries with the most listings first, then alphabetical.
  const sortedCountries = useMemo(
    () => [...countries].sort((a, b) => countryCount(b) - countryCount(a) || a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [countries, countryCounts],
  );

  // ── Search: country matches show all divisions; division matches show
  //    their parent country with just the matching divisions. ──
  const q = query.trim().toLowerCase();
  const searchGroups = useMemo(() => {
    if (!q) return [];
    return sortedCountries
      .map((country) => {
        const countryHit = country.name.toLowerCase().includes(q) || (country.iso_code || "").toLowerCase() === q;
        const own = divisionsByCountry.get(country.id) || [];
        const divs = countryHit ? own : own.filter((d) => d.name.toLowerCase().includes(q));
        return countryHit || divs.length > 0 ? { country, divisions: divs } : null;
      })
      .filter(Boolean) as { country: Country; divisions: Division[] }[];
  }, [q, sortedCountries, divisionsByCountry]);

  const activeCountry = activeCountryId ? countries.find((c) => c.id === activeCountryId) || null : null;

  // ── Group block: country tile + its divisions, two per row ──
  const renderGroup = (country: Country, divs: Division[]) => (
    <section key={country.id} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <SquareTile
          name={country.name}
          image={country.image_url}
          count={countryCount(country)}
          onClick={() => navigate(countryPath(country))}
          icon={<Globe className="h-8 w-8" />}
        />
        {divs.map((d) => (
          <SquareTile
            key={d.id}
            name={d.name}
            image={d.image_url}
            count={divisionCounts.get(d.id) || 0}
            onClick={() => navigate(divisionPath(country, d))}
            icon={<MapPin className="h-8 w-8" />}
          />
        ))}
      </div>
      {divs.length === 0 && (
        <p className="text-xs" style={{ color: INK_SOFT }}>No divisions added for {country.name} yet.</p>
      )}
    </section>
  );

  return (
    <div className="flex min-h-screen flex-col" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <Header />
      <main className="container mx-auto mb-24 max-w-3xl flex-1 px-4 py-8">
        {/* Title */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => (activeCountry && !q ? setActiveCountryId(null) : navigate(-1))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white"
            style={{ border: `1px solid ${HAIRLINE}` }}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" style={{ color: INK_SOFT }} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
              Explore <span style={{ color: CLAY }}>countries</span>
            </h1>
            <p className="mt-0.5 text-xs font-medium" style={{ color: INK_SOFT }}>
              Browse places to stay by country and division
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: INK_SOFT }} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a country or division"
            className="h-12 rounded-xl bg-white pl-10 pr-10 text-sm font-medium"
            style={{ border: `1px solid ${HAIRLINE}` }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full hover:bg-black/5"
            >
              <X className="h-4 w-4" style={{ color: INK_SOFT }} />
            </button>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: FOREST }} />
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm" style={{ color: INK_SOFT }}>Couldn't load countries: {error}</p>
        ) : q ? (
          searchGroups.length === 0 ? (
            <p className="py-16 text-center text-sm" style={{ color: INK_SOFT }}>
              No country or division matches "{query.trim()}".
            </p>
          ) : (
            <div className="space-y-8">{searchGroups.map((g) => renderGroup(g.country, g.divisions))}</div>
          )
        ) : activeCountry ? (
          <div className="space-y-4">
            <button
              onClick={() => setActiveCountryId(null)}
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: INK_SOFT }}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> All countries
            </button>
            {renderGroup(activeCountry, divisionsByCountry.get(activeCountry.id) || [])}
          </div>
        ) : sortedCountries.length === 0 ? (
          <p className="py-16 text-center text-sm" style={{ color: INK_SOFT }}>No countries have been added yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sortedCountries.map((c) => (
              <SquareTile
                key={c.id}
                name={c.name}
                image={c.image_url}
                count={countryCount(c)}
                onClick={() => setActiveCountryId(c.id)}
                icon={<Globe className="h-8 w-8" />}
              />
            ))}
          </div>
        )}
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default ExploreCountries;