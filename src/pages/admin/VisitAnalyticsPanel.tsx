// Save as: src/pages/admin/VisitAnalyticsPanel.tsx
// Drop <VisitAnalyticsPanel /> anywhere inside the /admin page (AdminDashboard).
// It has no Header/Footer of its own, and it only shows data to admins:
// the database function refuses everyone else.
//
// Requires: npm install jspdf jspdf-autotable
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, ChevronLeft, ChevronRight, Clock, Download, Eye, Loader2,
  RefreshCw, UserCheck, UserX, Users,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
const ROWS_PER_PAGE = 15;

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
/* PDF export                                                          */
/* ------------------------------------------------------------------ */

function exportAnalyticsPdf(view: LoadedView, rows: SeriesRow[]) {
  const { data, from, to, group } = view;
  const t = data.totals;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = 16;

  doc.setFontSize(16);
  doc.text("Visitor analytics report", 14, cursorY);
  cursorY += 7;
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${fmtPeriod(from, "day")} to ${fmtPeriod(to, "day")} · grouped by ${group}`, 14, cursorY);
  doc.setTextColor(0);
  cursorY += 8;

  autoTable(doc, {
    startY: cursorY,
    head: [["Visits", "Unique visitors", "Logged in", "Guests", "Unique users", "Avg time"]],
    body: [[
      t.visits, t.unique_visitors, t.logged_in, t.guests, t.unique_users, fmtMinutes(t.avg_minutes),
    ]],
    theme: "grid",
    headStyles: { fillColor: [40, 40, 40] },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });
  // @ts-expect-error jspdf-autotable augments doc with lastAutoTable at runtime
  cursorY = doc.lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text(`Visits by ${group}`, 14, cursorY);
  cursorY += 4;
  autoTable(doc, {
    startY: cursorY,
    head: [["Period", "Visits", "Unique", "Logged in", "Guests", "Avg time"]],
    body: rows.map((r) => [
      fmtPeriod(r.period, group),
      r.visits,
      r.unique_visitors,
      r.logged_in,
      r.guests,
      fmtMinutes(r.avg_minutes),
    ]),
    theme: "striped",
    headStyles: { fillColor: [40, 40, 40] },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  // @ts-expect-error jspdf-autotable augments doc with lastAutoTable at runtime
  cursorY = doc.lastAutoTable.finalY + 10;

  const addBreakdown = (title: string, breakdownRows: BreakdownRow[]) => {
    if (breakdownRows.length === 0) return;
    if (cursorY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      cursorY = 16;
    }
    doc.setFontSize(12);
    doc.text(title, 14, cursorY);
    cursorY += 4;
    const total = breakdownRows.reduce((s, r) => s + r.visits, 0);
    autoTable(doc, {
      startY: cursorY,
      head: [["Label", "Visits", "Share", "Avg time"]],
      body: breakdownRows.map((r) => [
        r.label,
        r.visits,
        total ? `${Math.round((r.visits / total) * 100)}%` : "0%",
        fmtMinutes(r.avg_minutes),
      ]),
      theme: "striped",
      headStyles: { fillColor: [40, 40, 40] },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    // @ts-expect-error jspdf-autotable augments doc with lastAutoTable at runtime
    cursorY = doc.lastAutoTable.finalY + 10;
  };

  addBreakdown("Platform", data.platform);
  addBreakdown("Login method", data.login);
  addBreakdown("Gender (logged-in visitors)", data.gender);
  addBreakdown("Age group (logged-in visitors)", data.age);
  addBreakdown("Top entry pages", data.pages);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generated ${new Date().toLocaleString()} · Page ${i} of ${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  doc.save(`visitor-analytics-${from}-to-${to}.pdf`);
  void pageWidth; // reserved for future header art / logo alignment
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

function Pagination({
  page,
  totalPages,
  totalRows,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const startRow = (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalRows);

  // Compact page-number list: first, last, current ±1, with ellipses between gaps.
  const pageNumbers: (number | "ellipsis")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
      pageNumbers.push(p);
    } else if (pageNumbers[pageNumbers.length - 1] !== "ellipsis") {
      pageNumbers.push("ellipsis");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-border/60">
      <p className="text-[11px] text-muted-foreground">
        Showing {startRow}–{endRow} of {totalRows}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          className="h-7 w-7 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {pageNumbers.map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e${i}`} className="px-1.5 text-[11px] text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`h-7 min-w-7 px-2 rounded-lg text-[11px] font-bold border transition-colors ${
                p === page
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
          className="h-7 w-7 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
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
  const [exporting, setExporting] = useState(false);
  const [tablePage, setTablePage] = useState(1);
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
      setTablePage(1); // reset to page 1 whenever fresh data loads
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

  // Table is shown newest-first; pagination walks through that reversed order.
  const reversedRows = useMemo(() => [...rows].reverse(), [rows]);
  const totalPages = Math.max(1, Math.ceil(reversedRows.length / ROWS_PER_PAGE));
  const clampedPage = Math.min(tablePage, totalPages);
  const pagedRows = useMemo(
    () => reversedRows.slice((clampedPage - 1) * ROWS_PER_PAGE, clampedPage * ROWS_PER_PAGE),
    [reversedRows, clampedPage]
  );

  const handleExportPdf = () => {
    if (!view) return;
    setExporting(true);
    // Deferred a tick so the "Exporting…" label paints before the (synchronous) PDF build.
    window.setTimeout(() => {
      try {
        exportAnalyticsPdf(view, rows);
      } finally {
        setExporting(false);
      }
    }, 0);
  };

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
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportPdf}
            disabled={!view || loading || exporting}
            className="h-8 px-3 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted flex items-center gap-1.5 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {exporting ? "Exporting…" : "Download PDF"}
          </button>
          <button
            onClick={load}
            disabled={loading || rangeInvalid}
            className="h-8 px-3 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
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
          {reversedRows.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-auto">
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
                    {pagedRows.map((r) => (
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
              <Pagination
                page={clampedPage}
                totalPages={totalPages}
                totalRows={reversedRows.length}
                pageSize={ROWS_PER_PAGE}
                onChange={setTablePage}
              />
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