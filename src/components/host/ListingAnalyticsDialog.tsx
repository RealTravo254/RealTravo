import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, Loader2, Users, Wallet, Globe, ClipboardList, Clock } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

interface AnalyticsItem {
  id: string;
  type: string;
  name: string;
}

interface ListingAnalyticsDialogProps {
  items: AnalyticsItem[];
  defaultItemId?: string;
  triggerClassName?: string;
  /** Show the full "Analytics" label (toolbar) or the compact one (cards) */
  label?: string;
}

interface Stats {
  onlineCount: number;
  manualCount: number;
  pendingCount: number;
  slots: number;
  onlineRevenue: number;
  manualRevenue: number;
  months: Array<{ month: string; Online: number; Manual: number }>;
}

const typeLabel: Record<string, string> = {
  trip: "Trip",
  event: "Event",
  hotel: "Hotel",
  adventure: "Adventure",
  adventure_place: "Adventure place",
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const emptyStats = (): Stats => ({
  onlineCount: 0,
  manualCount: 0,
  pendingCount: 0,
  slots: 0,
  onlineRevenue: 0,
  manualRevenue: 0,
  months: [],
});

export const ListingAnalyticsDialog = ({
  items,
  defaultItemId,
  triggerClassName,
  label = "Analytics",
}: ListingAnalyticsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(defaultItemId || items[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (defaultItemId) setSelectedId(defaultItemId);
    else if (!items.some((i) => i.id === selectedId)) setSelectedId(items[0]?.id || "");
  }, [defaultItemId, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => items.find((i) => i.id === selectedId), [items, selectedId]);

  // Load stats whenever the dialog is open and the item changes
  useEffect(() => {
    if (!open || !selectedId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [bookingsRes, entriesRes] = await Promise.all([
          supabase.from("bookings").select("*").eq("item_id", selectedId),
          supabase.from("manual_entries").select("*").eq("item_id", selectedId),
        ]);
        if (bookingsRes.error) throw bookingsRes.error;
        if (entriesRes.error) throw entriesRes.error;

        const bookings = (bookingsRes.data || []) as any[];
        const entries = (entriesRes.data || []) as any[];

        const s = emptyStats();

        // Last 6 months buckets (by visit date)
        const buckets = new Map<string, { month: string; Online: number; Manual: number }>();
        for (let i = 5; i >= 0; i--) {
          const d = startOfMonth(subMonths(new Date(), i));
          buckets.set(format(d, "yyyy-MM"), { month: format(d, "MMM"), Online: 0, Manual: 0 });
        }
        const bump = (dateStr: string | null, key: "Online" | "Manual") => {
          if (!dateStr) return;
          const b = buckets.get(String(dateStr).slice(0, 7));
          if (b) b[key] += 1;
        };

        for (const b of bookings) {
          if (b.status === "cancelled" || b.status === "rejected") continue;
          if (b.status === "pending") s.pendingCount += 1;
          s.onlineCount += 1;
          const d = b.booking_details || {};
          s.slots += num(b.slots_booked ?? d.slotsBooked ?? d.slots ?? 0);
          // Revenue counts only paid bookings
          if (["paid", "completed"].includes(b.payment_status)) {
            s.onlineRevenue += num(b.total_amount ?? d.totalAmount ?? d.total_amount);
          }
          bump(b.visit_date, "Online");
        }

        for (const e of entries) {
          if (e.status === "cancelled" || e.status === "rejected") continue;
          if (e.status === "pending") s.pendingCount += 1;
          s.manualCount += 1;
          s.slots += num(e.slots_booked);
          s.manualRevenue += num(e.entry_details?.totalAmount);
          bump(e.visit_date, "Manual");
        }

        s.months = Array.from(buckets.values());
        if (!cancelled) setStats(s);
      } catch (err: any) {
        console.error("Analytics error:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load analytics");
          setStats(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, selectedId]);

  const totalBookings = (stats?.onlineCount || 0) + (stats?.manualCount || 0);
  const totalRevenue = (stats?.onlineRevenue || 0) + (stats?.manualRevenue || 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("rounded-xl gap-1.5 text-xs", triggerClassName)}
        >
          <BarChart3 className="h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent className="rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-black uppercase tracking-tight">
            Listing Analytics
          </DialogTitle>
          <DialogDescription>
            Bookings and earnings for the listing you choose. Cancelled and rejected bookings are excluded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Listing</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select a listing" />
              </SelectTrigger>
              <SelectContent>
                {items.length === 0 && <div className="p-3 text-sm text-slate-500">No listings yet.</div>}
                {items.map((item) => (
                  <SelectItem key={`${item.type}-${item.id}`} value={item.id}>
                    {item.name} · {typeLabel[item.type] ?? item.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selected && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
              Select a listing to see its analytics.
            </div>
          )}

          {selected && loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics...
            </div>
          )}

          {selected && error && !loading && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
              {error}
            </div>
          )}

          {selected && stats && !loading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard icon={<ClipboardList className="h-4 w-4" />} label="Total bookings" value={totalBookings.toLocaleString()} />
                <StatCard icon={<Wallet className="h-4 w-4" />} label="Revenue (KES)" value={totalRevenue.toLocaleString()} />
                <StatCard icon={<Users className="h-4 w-4" />} label="Guests / slots" value={stats.slots.toLocaleString()} />
                <StatCard icon={<Globe className="h-4 w-4" />} label="Online bookings" value={stats.onlineCount.toLocaleString()} sub={`KES ${stats.onlineRevenue.toLocaleString()}`} />
                <StatCard icon={<ClipboardList className="h-4 w-4" />} label="Manual entries" value={stats.manualCount.toLocaleString()} sub={`KES ${stats.manualRevenue.toLocaleString()}`} />
                <StatCard icon={<Clock className="h-4 w-4" />} label="Pending" value={stats.pendingCount.toLocaleString()} />
              </div>

              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  Bookings by visit month (last 6 months)
                </p>
                {totalBookings === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">No bookings for this listing yet.</p>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.months}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Online" stackId="a" fill="#008080" />
                        <Bar dataKey="Manual" stackId="a" fill="#FF7F50" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-slate-400">
                Online revenue counts paid bookings only. Manual revenue is the recorded total of host entries.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
    <div className="flex items-center gap-1.5 text-[#008080]">
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
    </div>
    <div className="text-xl font-black text-slate-800 mt-1">{value}</div>
    {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
  </div>
);