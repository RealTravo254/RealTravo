// Save as: src/pages/admin/VisitAnalyticsPanel.tsx
// Drop <VisitAnalyticsPanel /> anywhere inside the /admin page (AdminDashboard).
// It has no Header/Footer of its own, and it only shows data to admins:
// the database function refuses everyone else.
//
// Needs: npm i recharts   (skip if already installed)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  CalendarDays,
  Clock,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  UserCheck,
  UserX,
  Users,
  UsersRound,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Group = "day" | "month" | "year";
type Preset = "7d" | "30d" | "90d" | "year" | "custom";
type TabKey = "overview" | "timeline" | "audience" | "pages";

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

const TABS: { key: TabKey; label: string; icon: ElementType }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "timeline", label: "By period", icon: CalendarDays },
  { key: "audience", label: "Audience", icon: UsersRound },
  { key: "pages", label: "Pages", icon: FileText },
];

const C_PRIMARY = "hsl(var(--primary))";
const C_GUEST = "#f59e0b";
const C_TEAL = "#14b8a6";
const PALETTE = [C_PRIMARY, C_GUEST, C_TEAL, "#8b5cf6", "#ef4444", "#64748b"];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
};
const axisTick = { fontSize: 11 };
const axisColor = "hsl(var(--muted-foreground))";
const gridColor = "hsl(var(--border))";

const pad2 = (n: number) => String(n).padStart(2, "0");
const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
};

const fmt = (n: number) => n.toLocaleString();
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const shorten = (s: string, max = 16) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const sharePct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

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

// Tooltip title: show the full period name (e.g. "12 Sep 2026") instead of the short axis label.
const periodTitle = (_label: unknown, payload: ReadonlyArray<{ payload?: unknown }>) =>
  (payload?.[0]?.payload as { full?: string } | undefined)?.full ?? "";

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
        <p className="text-[11px] font-bold">{label}</p>
      </div>
      <p className="text-xl font-bold text-foreground leading-none">
        {typeof value === "number" ? fmt(value) : value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="p-4 rounded-xl border border-border bg-card space-y-3">
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function NoData({ text }: { text?: string }) {
  return <p className="text-xs text-muted-foreground py-4">{text ?? "No data for this period."}</p>;
}

/** Horizontal bar chart for ranked lists (pages, age groups, gender...). */
function HBarChart({ rows, color = C_PRIMARY, limit = 8 }: { rows: BreakdownRow[]; color?: string; limit?: number }) {
  const data = rows.slice(0, limit).map((r) => ({
    name: capitalize(r.label),
    short: shorten(capitalize(r.label)),
    Visits: r.visits,
  }));
  return (
    <div style={{ height: data.length * 34 + 28 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={gridColor} />
          <XAxis type="number" allowDecimals={false} tick={axisTick} stroke={axisColor} />
          <YAxis type="category" dataKey="short" width={104} tick={axisTick} stroke={axisColor} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            labelFormatter={(_l: unknown, payload: ReadonlyArray<{ payload?: unknown }>) =>
              (payload?.[0]?.payload as { name?: string } | undefined)?.name ?? ""
            }
          />
          <Bar dataKey="Visits" fill={color} radius={[0, 6, 6, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut chart for a small set of categories (platform, login method). */
function Donut({ rows }: { rows: BreakdownRow[] }) {
  const data = rows.map((r) => ({ name: capitalize(r.label), value: r.visits }));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: unknown) => `${fmt(Number(v))} (${sharePct(Number(v), total)}%)`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Table for any breakdown, with a share bar. */
function BreakdownTable({ firstColumn, rows, limit = 15 }: { firstColumn: string; rows: BreakdownRow[]; limit?: number }) {
  const total = rows.reduce((s, r) => s + r.visits, 0);
  const showPeople = rows.some((r) => r.people !== undefined);
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs min-w-[420px]">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="font-bold py-2 px-1">{firstColumn}</th>
            <th className="font-bold py-2 px-1 text-right">Visits</th>
            {showPeople && <th className="font-bold py-2 px-1 text-right">People</th>}
            <th className="font-bold py-2 px-1 text-right">Avg time</th>
            <th className="font-bold py-2 px-1 w-32">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r) => {
            const share = sharePct(r.visits, total);
            return (
              <tr key={r.label} className="border-b border-border/60 last:border-0">
                <td className="py-2 px-1 font-medium text-foreground max-w-[200px] truncate" title={r.label}>
                  {capitalize(r.label)}
                </td>
                <td className="py-2 px-1 text-right tabular-nums">{fmt(r.visits)}</td>
                {showPeople && <td className="py-2 px-1 text-right tabular-nums">{fmt(r.people ?? 0)}</td>}
                <td className="py-2 px-1 text-right whitespace-nowrap">{fmtMinutes(r.avg_minutes)}</td>
                <td className="py-2 px-1">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                    </div>
                    <span className="text-muted-foreground tabular-nums w-9 text-right">{share}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Chart on top, exact numbers underneath. */
function BreakdownSection({
  title,
  hint,
  firstColumn,
  rows,
  empty,
  color,
}: {
  title: string;
  hint?: string;
  firstColumn: string;
  rows: BreakdownRow[];
  empty?: string;
  color?: string;
}) {
  return (
    <ChartCard title={title} hint={hint}>
      {rows.length === 0 ? (
        <NoData text={empty} />
      ) : (
        <>
          <HBarChart rows={rows} color={color} />
          <BreakdownTable firstColumn={firstColumn} rows={rows} />
        </>
      )}
    </ChartCard>
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
  const [tab, setTab] = useState<TabKey>("overview");

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

  // Data shaped for the charts.
  const chartData = useMemo(
    () =>
      view
        ? rows.map((r) => ({
            label: fmtPeriod(r.period, view.group, true),
            full: fmtPeriod(r.period, view.group),
            "Logged in": r.logged_in,
            Guests: r.guests,
            "Unique visitors": r.unique_visitors,
            "Avg minutes": r.avg_minutes ?? 0,
          }))
        : [],
    [rows, view]
  );

  const t = view?.data.totals;
  const guestPct = t ? sharePct(t.guests, t.visits) : 0;
  const functionMissing = !!error && /could not find|does not exist/i.test(error);
  const roundTop = chartData.length <= 45; // rounded bar tops look messy when bars are very thin

  const presetBtn = (p: Preset, label: string) => (
    <button
      key={p}
      onClick={() => applyPreset(p)}
      aria-pressed={preset === p}
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
    <section className="space-y-4">
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
            <span className="block text-[11px] font-bold text-muted-foreground">From</span>
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
            <span className="block text-[11px] font-bold text-muted-foreground">To</span>
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
            <span className="block text-[11px] font-bold text-muted-foreground">Group by</span>
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
        <>
          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Analytics sections"
            className="flex gap-2 overflow-x-auto py-2 sticky top-0 z-10 bg-background/95 backdrop-blur"
          >
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
                  tab === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
            {t.visits === 0 && (
              <div className="p-4 rounded-xl border border-border bg-card text-xs text-muted-foreground">
                No visits were recorded in this period. If you expected some, check that the visit tracker is
                deployed and that <code>visit-tracking.sql</code> was run in Supabase.
              </div>
            )}

            {/* ------------------------------ Overview ------------------------------ */}
            {tab === "overview" && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <StatCard icon={Eye} label="Visits" value={t.visits} sub="Sessions in this period" />
                  <StatCard
                    icon={Users}
                    label="Unique visitors"
                    value={t.unique_visitors}
                    sub="Different devices / browsers"
                  />
                  <StatCard
                    icon={UserCheck}
                    label="Logged in"
                    value={t.logged_in}
                    sub={`${t.unique_users} different people`}
                  />
                  <StatCard icon={UserX} label="Guests" value={t.guests} sub={`${guestPct}% of visits`} />
                  <StatCard icon={Clock} label="Avg time" value={fmtMinutes(t.avg_minutes)} sub="Per visit" />
                </div>

                <ChartCard
                  title={`Visits by ${view.group}`}
                  hint="Bars show logged-in and guest visits. The line shows unique visitors."
                >
                  {chartData.length === 0 ? (
                    <NoData />
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis
                            dataKey="label"
                            tick={axisTick}
                            stroke={axisColor}
                            interval="preserveStartEnd"
                            minTickGap={28}
                          />
                          <YAxis allowDecimals={false} tick={axisTick} stroke={axisColor} />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                            labelFormatter={periodTitle}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="Logged in" stackId="v" fill={C_PRIMARY} />
                          <Bar
                            dataKey="Guests"
                            stackId="v"
                            fill={C_GUEST}
                            radius={roundTop ? [4, 4, 0, 0] : undefined}
                          />
                          <Line
                            type="monotone"
                            dataKey="Unique visitors"
                            stroke={C_TEAL}
                            strokeWidth={2}
                            dot={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </ChartCard>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ChartCard title="Platform" hint="Where visits came from">
                    {view.data.platform.length === 0 ? <NoData /> : <Donut rows={view.data.platform} />}
                  </ChartCard>
                  <ChartCard title="Login method" hint="How logged-in visitors signed in">
                    {view.data.login.length === 0 ? <NoData /> : <Donut rows={view.data.login} />}
                  </ChartCard>
                </div>
              </>
            )}

            {/* ------------------------------ By period ------------------------------ */}
            {tab === "timeline" && (
              <>
                <ChartCard title={`Average time per visit, by ${view.group}`} hint="In minutes">
                  {chartData.length === 0 ? (
                    <NoData />
                  ) : (
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis
                            dataKey="label"
                            tick={axisTick}
                            stroke={axisColor}
                            interval="preserveStartEnd"
                            minTickGap={28}
                          />
                          <YAxis tick={axisTick} stroke={axisColor} />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                            labelFormatter={periodTitle}
                            formatter={(v: unknown) => fmtMinutes(Number(v))}
                          />
                          <Bar
                            dataKey="Avg minutes"
                            fill={C_TEAL}
                            radius={roundTop ? [4, 4, 0, 0] : undefined}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </ChartCard>

                {rows.length > 0 && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="max-h-96 overflow-auto">
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
                              <td className="px-3 py-2 text-right tabular-nums">{r.visits}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{r.unique_visitors}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{r.logged_in}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{r.guests}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMinutes(r.avg_minutes)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ------------------------------ Audience ------------------------------ */}
            {tab === "audience" && (
              <>
                <BreakdownSection
                  title="Gender"
                  hint="Logged-in visitors only"
                  firstColumn="Gender"
                  rows={view.data.gender}
                  color={C_PRIMARY}
                  empty={
                    view.data.demographics_available
                      ? "No logged-in visits in this period."
                      : "Gender isn't available: check the profiles column names in admin-analytics.sql."
                  }
                />
                <BreakdownSection
                  title="Age group"
                  hint="Logged-in visitors only"
                  firstColumn="Age group"
                  rows={view.data.age}
                  color={C_TEAL}
                  empty={
                    view.data.demographics_available
                      ? "No logged-in visits in this period."
                      : "Age isn't available: check the profiles column names in admin-analytics.sql."
                  }
                />
                <BreakdownSection
                  title="Platform"
                  firstColumn="Platform"
                  rows={view.data.platform}
                  color={C_GUEST}
                />
                <BreakdownSection
                  title="Login method"
                  firstColumn="Method"
                  rows={view.data.login}
                  color={C_PRIMARY}
                />
              </>
            )}

            {/* -------------------------------- Pages -------------------------------- */}
            {tab === "pages" && (
              <BreakdownSection
                title="Top entry pages"
                hint="The first page people opened. Chart shows the top 8, table the top 15."
                firstColumn="Page"
                rows={view.data.pages}
              />
            )}

            <p className="text-[10px] text-muted-foreground">
              Times are shown in Nairobi time. Time spent is approximate (counted in 30-second steps). Guests have no
              gender or age because those come from a logged-in profile.
            </p>
          </div>
        </>
      )}
    </section>
  );
}