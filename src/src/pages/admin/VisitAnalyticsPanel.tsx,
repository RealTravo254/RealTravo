// Save as: src/pages/admin/VisitAnalyticsPanel.tsx
// Drop <VisitAnalyticsPanel /> anywhere inside the /admin page (AdminDashboard).
// It has no Header/Footer of its own, and it only shows data to admins:
// the database function refuses everyone else.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Clock, Eye, Loader2, RefreshCw, UserCheck, UserX, Users } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Group = "day" | "month" | "year";
type Preset = "7d" | "30d" | "90d" | "year" | "custom";

interface SeriesRow {
  period: string; // YYYY-MM-DD (first day of the day/month/year)
  visits: number;
  unique_visitors: number;
  guests: number;
  logged_in: number;
  avg_minutes: number | null;
}

interface BreakdownRow {
  label: string;
  visits: number;
  people?: number;
  avg_minutes: number | null;
}

interface Analytics {
  totals: {
    visits: number;
    unique_visitors: number;
    unique_users: number;
    guests: number;
    logged_in: number;
    avg_minutes: number;
  };
  series: SeriesRow[];
  platform: BreakdownRow[];
  login: BreakdownRow[];
  pages: BreakdownRow[];
  gender: BreakdownRow[];
  age: BreakdownRow[];
  demographics_available: boolean;
}

interface LoadedView {
  data: Analytics;
  from: string;
  to: string;
  group: Group;
}

// The generated Supabase types don't know about our custom function,
// so call rpc through a minimal typed wrapper instead of `any`.
type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};
const db = supabase as unknown as RpcClient;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
};

function fmtMinutes(m: number | null | undefined): string {
  if (m === null || m === undefined) return "–";
  if (m < 1) return `${Math.round(m * 60)}s`;
  return `${m} min`;
}

function fmtPeriod(p: string, g: Group, short = false): string {
  const [y, m, d] = p.split("-").map(Number);
  if (g === "year") return String(y);
  if (g === "month") return `${MONTHS[m - 1]} ${y}`;
  return short ? `${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]} ${y}`;
}

// List every period between from and to so days with 0 visits still show up.
// Returns null if the range would be too large (we then show only the days with data).
function buildPeriods(from: string, to: string, group: Group): string[] | null {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const end = new Date(ty, tm - 1, td);
  let cur =
    group === "day" ? new Date(fy, fm - 1, fd) : group === "month" ? new Date(fy, fm - 1, 1) : new Date(fy, 0, 1);
  const out: string[] = [];
  while (cur <= end) {
    out.push(toISODate(cur));
    if (out.length > 400) return null;
    cur =
      group === "day"
        ? new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
        : group === "month"
        ? new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
        : new Date(cur.getFullYear() + 1, 0, 1);
  }
  return out;
}

function fillSeries(series: SeriesRow[], from: string, to: string, group: Group): SeriesRow[] {
  const periods = buildPeriods(from, to, group);
  if (!periods) return series;
  const map = new Map(series.map((r) => [r.period, r]));
  return periods.map(
    (p) =>
      map.get(p) ?? {
        period: p,
        visits: 0,
        unique_visitors: 0,
        guests: 0,
        logged_in: 0,
        avg_minutes: null,
      }
  );
}

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="p-3.5 rounded-xl border border-border bg-card space-y-1.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <p className="text-[10px] font-black uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-bold text-foreground leading-none">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Breakdown({ title, rows, empty }: { title: string; rows: BreakdownRow[]; empty?: string }) {
  const total = rows.reduce((s, r) => s + r.visits, 0);
  const max = Math.max(1, ...rows.map((r) => r.visits));

  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty ?? "No data for this period."}</p>
      ) : (
        rows.map((r) => (
          <div key={r.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground truncate capitalize">{r.label}</span>
              <span className="text-muted-foreground shrink-0">
                {r.visits} visits · {total ? Math.round((r.visits / total) * 100) : 0}% · {fmtMinutes(r.avg_minutes)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(r.visits / max) * 100}%` }} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export default function VisitAnalyticsPanel() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState(() => daysAgo(29));
  const [to, setTo] = useState(() => toISODate(new Date()));
  const [group, setGroup] = useState<Group>("day");

  const [view, setView] = useState<LoadedView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const rangeInvalid = !from || !to || from > to;

  const load = useCallback(async () => {
    if (rangeInvalid) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const { data, error: err } = await db.rpc("admin_visit_analytics", {
      p_from: from,
      p_to: to,
      p_group: group,
    });
    if (id !== requestId.current) return; // a newer request replaced this one
    if (err) {
      setError(err.message);
    } else {
      setView({ data: data as Analytics, from, to, group });
    }
    setLoading(false);
  }, [from, to, group, rangeInvalid]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const today = toISODate(new Date());
    if (p === "7d") {
      setFrom(daysAgo(6));
      setTo(today);
      setGroup("day");
    } else if (p === "30d") {
      setFrom(daysAgo(29));
      setTo(today);
      setGroup("day");
    } else if (p === "90d") {
      setFrom(daysAgo(89));
      setTo(today);
      setGroup("day");
    } else if (p === "year") {
      setFrom(`${new Date().getFullYear()}-01-01`);
      setTo(today);
      setGroup("month");
    }
  };

  const rows = useMemo(
    () => (view ? fillSeries(view.data.series, view.from, view.to, view.group) : []),
    [view]
  );

  const t = view?.data.totals;
  const maxVisits = Math.max(1, ...rows.map((r) => r.visits));
  const guestPct = t && t.visits ? Math.round((t.guests / t.visits) * 100) : 0;
  const functionMissing = !!error && /could not find|does not exist/i.test(error);

  const presetBtn = (p: Preset, label: string) => (
    <button
      key={p}
      onClick={() => applyPreset(p)}
      className={`h-8 px-3 rounded-lg text-xs font-bold border transition-colors ${
        preset === p
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-border hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="space-y-5">
      {/* Title bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">Visitor Analytics</h2>
            <p className="text-[10px] text-muted-foreground">Web and app visits</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading || rangeInvalid}
          className="h-8 px-3 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="p-3.5 rounded-xl border border-border bg-card space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {presetBtn("7d", "7 days")}
          {presetBtn("30d", "30 days")}
          {presetBtn("90d", "90 days")}
          {presetBtn("year", "This year")}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset("custom");
              }}
              className="h-8 px-2 rounded-lg border border-border bg-background text-xs text-foreground"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset("custom");
              }}
              className="h-8 px-2 rounded-lg border border-border bg-background text-xs text-foreground"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Group by
            </span>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as Group)}
              className="h-8 px-2 rounded-lg border border-border bg-background text-xs text-foreground"
            >
              <option value="day">Day</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </label>
        </div>

        {rangeInvalid && (
          <p className="text-xs text-destructive">The “From” date must be on or before the “To” date.</p>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive space-y-1">
          <p>Could not load analytics: {error}</p>
          {functionMissing && <p>Run <code>admin-analytics.sql</code> in the Supabase SQL Editor first.</p>}
        </div>
      )}

      {!view && loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {view && t && (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard icon={Eye} label="Visits" value={t.visits} sub="Sessions in this period" />
            <StatCard icon={Users} label="Unique visitors" value={t.unique_visitors} sub="Different devices / browsers" />
            <StatCard
              icon={UserCheck}
              label="Logged in"
              value={t.logged_in}
              sub={`${t.unique_users} different people`}
            />
            <StatCard icon={UserX} label="Guests" value={t.guests} sub={`${guestPct}% of visits`} />
            <StatCard icon={Clock} label="Avg time" value={fmtMinutes(t.avg_minutes)} sub="Per visit" />
          </div>

          {t.visits === 0 && (
            <div className="p-4 rounded-xl border border-border bg-card text-xs text-muted-foreground">
              No visits were recorded in this period. If you expected some, check that the visit tracker is deployed
              and that <code>visit-tracking.sql</code> was run in Supabase.
            </div>
          )}

          {/* Over time */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Visits by {view.group}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-primary" /> Logged in
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-primary/30" /> Guests
                </span>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data for this period.</p>
            ) : (
              <>
                <div className="flex items-end gap-px h-40 overflow-x-auto">
                  {rows.map((r) => {
                    const h = (r.visits / maxVisits) * 100;
                    const loggedH = r.visits ? (r.logged_in / r.visits) * 100 : 0;
                    return (
                      <div
                        key={r.period}
                        title={`${fmtPeriod(r.period, view.group)}: ${r.visits} visits (${r.logged_in} logged in, ${r.guests} guests)`}
                        className="flex-1 min-w-[6px] h-full flex items-end"
                      >
                        <div
                          className="w-full rounded-t-sm overflow-hidden flex flex-col justify-end"
                          style={{ height: `${h}%`, minHeight: r.visits ? 2 : 0 }}
                        >
                          <div className="bg-primary/30" style={{ height: `${100 - loggedH}%` }} />
                          <div className="bg-primary" style={{ height: `${loggedH}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{fmtPeriod(rows[0].period, view.group, true)}</span>
                  <span>{fmtPeriod(rows[rows.length - 1].period, view.group, true)}</span>
                </div>
              </>
            )}
          </div>

          {/* Table */}
          {rows.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted text-muted-foreground">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-bold">
                        {view.group === "day" ? "Date" : view.group === "month" ? "Month" : "Year"}
                      </th>
                      <th className="px-3 py-2 font-bold text-right">Visits</th>
                      <th className="px-3 py-2 font-bold text-right">Unique</th>
                      <th className="px-3 py-2 font-bold text-right">Logged in</th>
                      <th className="px-3 py-2 font-bold text-right">Guests</th>
                      <th className="px-3 py-2 font-bold text-right">Avg time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {[...rows].reverse().map((r) => (
                      <tr key={r.period}>
                        <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                          {fmtPeriod(r.period, view.group)}
                        </td>
                        <td className="px-3 py-2 text-right">{r.visits}</td>
                        <td className="px-3 py-2 text-right">{r.unique_visitors}</td>
                        <td className="px-3 py-2 text-right">{r.logged_in}</td>
                        <td className="px-3 py-2 text-right">{r.guests}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMinutes(r.avg_minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Breakdown title="Platform" rows={view.data.platform} />
            <Breakdown title="Login method" rows={view.data.login} />
            <Breakdown
              title="Gender (logged-in visitors)"
              rows={view.data.gender}
              empty={
                view.data.demographics_available
                  ? "No logged-in visits in this period."
                  : "Gender isn't available: check the profiles column names in admin-analytics.sql."
              }
            />
            <Breakdown
              title="Age group (logged-in visitors)"
              rows={view.data.age}
              empty={
                view.data.demographics_available
                  ? "No logged-in visits in this period."
                  : "Age isn't available: check the profiles column names in admin-analytics.sql."
              }
            />
          </div>

          <Breakdown title="Top entry pages" rows={view.data.pages} />

          <p className="text-[10px] text-muted-foreground">
            Times are shown in Nairobi time. Time spent is approximate (counted in 30-second steps). Guests have no
            gender or age because those come from a logged-in profile.
          </p>
        </div>
      )}
    </section>
  );
}