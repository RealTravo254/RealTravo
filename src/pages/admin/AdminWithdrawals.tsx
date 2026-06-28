import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/SEOHead";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Wallet,
  Search, Filter, Copy, RefreshCw, ChevronLeft, ChevronRight,
  Lock, TrendingUp,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const HOLD_HOURS = 24;

type WithdrawalRequest = {
  id: string;
  user_id: string;
  amount: number;
  withdrawal_method: string;
  withdrawal_details: Record<string, string>;
  status: "pending" | "completed" | "rejected";
  admin_note: string | null;
  requested_at: string;
  resolved_at: string | null;
  user_name?: string;
  user_email?: string;
  // Calculated fields we attach after fetching
  user_available_balance?: number;
  user_held_balance?: number;
  user_total_paid_out?: number;
  user_pending_withdrawal_total?: number;
};

const PAGE_SIZE = 15;

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  mpesa: "M-Pesa",
  paystack: "Paystack",
};

const STATUS_CONFIG = {
  pending:   { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",        icon: <Clock className="h-3 w-3" /> },
  completed: { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected:  { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",                icon: <XCircle className="h-3 w-3" /> },
};

/** True when the booking's earnings are past the 24-hour hold window */
function isEarningReleased(booking: any): boolean {
  const rawDate =
    booking.visit_date ||
    booking.booking_details?.date ||
    null;
  if (!rawDate) return true;
  const releaseTime = new Date(rawDate).getTime() + HOLD_HOURS * 60 * 60 * 1000;
  return Date.now() >= releaseTime;
}

/** Fetch net released + held earnings for a single user_id */
async function fetchUserBalanceInfo(userId: string): Promise<{
  released: number;
  held: number;
  totalPaidOut: number;
  pendingWithdrawals: number;
}> {
  const [bookingsRes, settingsRes, withdrawalsRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("total_amount, item_id, booking_type, service_fee_amount, visit_date, booking_details")
      .eq("payment_status", "completed"),
    supabase.from("referral_settings").select("*").single(),
    (supabase as any)
      .from("withdrawal_requests")
      .select("amount, status")
      .eq("user_id", userId),
  ]);

  const bookings: any[] = bookingsRes.data || [];
  const settings = settingsRes.data;
  const withdrawals: any[] = withdrawalsRes.data || [];

  // Only bookings where this user is the host
  const itemIds = [...new Set(bookings.map((b) => b.item_id))];
  const [tripsRes, hotelsRes, advRes] = await Promise.all([
    supabase.from("trips").select("id, created_by").in("id", itemIds),
    supabase.from("hotels").select("id, created_by").in("id", itemIds),
    supabase.from("adventure_places").select("id, created_by").in("id", itemIds),
  ]);
  const ownerMap = new Map<string, string>();
  [...(tripsRes.data || []), ...(hotelsRes.data || []), ...(advRes.data || [])].forEach((item) => {
    if (item.created_by) ownerMap.set(item.id, item.created_by);
  });

  let released = 0;
  let held = 0;

  for (const b of bookings) {
    if (ownerMap.get(b.item_id) !== userId) continue;
    const amount = Number(b.total_amount);
    let rate = 0;
    if (settings) {
      if (b.booking_type === "trip")           rate = Number(settings.trip_service_fee || 0);
      else if (b.booking_type === "event")     rate = Number(settings.event_service_fee || 0);
      else if (b.booking_type === "hotel")     rate = Number(settings.hotel_service_fee || 0);
      else if (["adventure", "adventure_place"].includes(b.booking_type))
                                               rate = Number(settings.adventure_place_service_fee || 0);
      else if (b.booking_type === "attraction") rate = Number(settings.attraction_service_fee || 0);
    }
    const net = amount - (amount * rate) / 100;
    if (isEarningReleased(b)) released += net;
    else held += net;
  }

  const totalPaidOut = withdrawals
    .filter((w) => w.status === "completed")
    .reduce((s: number, w: any) => s + Number(w.amount), 0);

  const pendingWithdrawals = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((s: number, w: any) => s + Number(w.amount), 0);

  return {
    released: Math.max(0, released - totalPaidOut - pendingWithdrawals),
    held,
    totalPaidOut,
    pendingWithdrawals,
  };
}

export default function AdminWithdrawals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [dialogAction, setDialogAction] = useState<"complete" | "reject" | null>(null);

  const [summaryStats, setSummaryStats] = useState({
    pendingCount: 0,
    totalPending: 0,
    allTime: 0,
    completed: 0,
    totalPaidOut: 0,
  });

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => { setPage(0); }, [statusFilter]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    fetchRequests();
  }, [user, page, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (!user) return;
    fetchSummaryStats();
  }, [user]);

  const fetchSummaryStats = async () => {
    try {
      const { data: pendingData } = await (supabase as any)
        .from("withdrawal_requests")
        .select("amount")
        .eq("status", "pending");

      const { data: completedData } = await (supabase as any)
        .from("withdrawal_requests")
        .select("amount")
        .eq("status", "completed");

      const { count: allTime } = await (supabase as any)
        .from("withdrawal_requests")
        .select("*", { count: "exact", head: true });

      const pendingCount = (pendingData || []).length;
      const totalPending = (pendingData || []).reduce(
        (s: number, r: any) => s + Number(r.amount),
        0
      );
      const totalPaidOut = (completedData || []).reduce(
        (s: number, r: any) => s + Number(r.amount),
        0
      );

      setSummaryStats({
        pendingCount,
        totalPending,
        allTime: allTime || 0,
        completed: (completedData || []).length,
        totalPaidOut,
      });
    } catch {
      // fail silently
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = (supabase as any)
        .from("withdrawal_requests")
        .select("*", { count: "exact" })
        .order("requested_at", { ascending: false })
        .range(from, to);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);

      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        query = query.or(
          `withdrawal_method.ilike.%${q}%,withdrawal_details::text.ilike.%${q}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setTotalCount(count || 0);

      // Enrich with user profiles
      const userIds = [...new Set((data || []).map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // For pending requests we also compute the user's actual available balance
      const enriched: WithdrawalRequest[] = await Promise.all(
        (data || []).map(async (r: any) => {
          const base: WithdrawalRequest = {
            ...r,
            user_name: (profileMap.get(r.user_id) as any)?.name || "Unknown",
            user_email: (profileMap.get(r.user_id) as any)?.email || "",
          };

          if (r.status === "pending") {
            try {
              const bal = await fetchUserBalanceInfo(r.user_id);
              base.user_available_balance = bal.released;
              base.user_held_balance = bal.held;
              base.user_total_paid_out = bal.totalPaidOut;
              base.user_pending_withdrawal_total = bal.pendingWithdrawals;
            } catch {
              // non-critical, skip
            }
          }

          return base;
        })
      );

      setRequests(enriched);
    } catch (e: any) {
      toast({ title: "Failed to load requests", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openAction = (request: WithdrawalRequest, action: "complete" | "reject") => {
    setSelectedRequest(request);
    setDialogAction(action);
    setAdminNote("");
  };

  const handleAction = async () => {
    if (!selectedRequest || !dialogAction) return;
    if (dialogAction === "reject" && !adminNote.trim()) {
      toast({ title: "Please add a note explaining the rejection", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await (supabase as any)
        .from("withdrawal_requests")
        .update({
          status: dialogAction === "complete" ? "completed" : "rejected",
          admin_note: adminNote || null,
          resolved_at: new Date().toISOString(),
          resolved_by: user!.id,
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title:
          dialogAction === "complete"
            ? "Withdrawal marked as completed!"
            : "Withdrawal rejected",
        description:
          dialogAction === "complete"
            ? `${formatPrice(selectedRequest.amount)} deducted from user's balance.`
            : "User will be notified of the rejection.",
      });

      setSelectedRequest(null);
      setDialogAction(null);
      fetchRequests();
      fetchSummaryStats();
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!" });
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  const renderDetails = (method: string, details: Record<string, string>) => {
    if (method === "bank_transfer")
      return (
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold text-foreground">{details.bank_name}</p>
          <div className="flex items-center gap-1">
            <p className="text-[9px] text-muted-foreground font-mono">{details.account_number}</p>
            <button
              onClick={() => copyToClipboard(details.account_number)}
              className="text-muted-foreground hover:text-primary"
            >
              <Copy className="h-2.5 w-2.5" />
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground">{details.account_name}</p>
        </div>
      );
    if (method === "mpesa")
      return (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            <p className="text-[10px] font-bold text-foreground font-mono">{details.phone}</p>
            <button
              onClick={() => copyToClipboard(details.phone)}
              className="text-muted-foreground hover:text-primary"
            >
              <Copy className="h-2.5 w-2.5" />
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground">{details.name}</p>
        </div>
      );
    if (method === "paystack")
      return (
        <div className="flex items-center gap-1">
          <p className="text-[10px] font-bold text-foreground">{details.email}</p>
          <button
            onClick={() => copyToClipboard(details.email)}
            className="text-muted-foreground hover:text-primary"
          >
            <Copy className="h-2.5 w-2.5" />
          </button>
        </div>
      );
    return <p className="text-[9px] text-muted-foreground">{JSON.stringify(details)}</p>;
  };

  if (loading && requests.length === 0)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Withdrawal Requests | Admin"
        description="Admin panel for managing user withdrawal requests."
      />
      <main className="container px-4 py-4 mx-auto max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin")}
          className="mb-3 rounded-lg text-[9px] font-bold uppercase tracking-widest px-3 h-7"
        >
          <ArrowLeft className="mr-1 h-3 w-3" /> Admin
        </Button>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-foreground">
              Withdrawal Requests
            </h1>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
              Review & process manually
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchRequests(); fetchSummaryStats(); }}
            className="rounded-lg h-7 px-3"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
            <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Pending
            </p>
            <p className="text-xl font-black text-amber-700 dark:text-amber-300">
              {summaryStats.pendingCount}
            </p>
            <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
              {formatPrice(summaryStats.totalPending)} awaiting
            </p>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800">
            <p className="text-[8px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              Total Paid Out
            </p>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
              {formatPrice(summaryStats.totalPaidOut)}
            </p>
            <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
              {summaryStats.completed} of {summaryStats.allTime} completed
            </p>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search method, details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 rounded-xl text-xs h-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 rounded-xl text-xs h-8">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Requests List ── */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold">No withdrawal requests found</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {requests.map((req) => {
                const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;

                // Fraud-risk flag: requested amount > available balance
                const isSuspect =
                  req.status === "pending" &&
                  req.user_available_balance !== undefined &&
                  Number(req.amount) > req.user_available_balance;

                return (
                  <div
                    key={req.id}
                    className={`bg-card rounded-xl border p-3 ${
                      isSuspect ? "border-red-300 dark:border-red-700" : "border-border"
                    }`}
                  >
                    {/* Fraud warning banner */}
                    {isSuspect && (
                      <div className="flex items-center gap-2 mb-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700 rounded-lg px-2.5 py-1.5">
                        <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        <p className="text-[9px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest">
                          Requested amount exceeds available balance — verify before approving
                        </p>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-black text-foreground truncate">
                            {req.user_name}
                          </p>
                          <span
                            className={`flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${cfg.color}`}
                          >
                            {cfg.icon} {req.status}
                          </span>
                        </div>
                        <p className="text-[9px] text-muted-foreground">{req.user_email}</p>
                        <p className="text-[8px] text-muted-foreground mt-0.5">
                          {new Date(req.requested_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-foreground">
                          {formatPrice(Number(req.amount))}
                        </p>
                        <p className="text-[9px] font-bold text-muted-foreground">
                          {METHOD_LABELS[req.withdrawal_method] || req.withdrawal_method}
                        </p>
                      </div>
                    </div>

                    {/* Payment Details */}
                    <div className="bg-muted/40 rounded-lg p-2 mb-2">
                      {renderDetails(req.withdrawal_method, req.withdrawal_details)}
                    </div>

                    {/* Balance info for pending requests */}
                    {req.status === "pending" && req.user_available_balance !== undefined && (
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        <BalancePill
                          icon={<Wallet className="h-2.5 w-2.5" />}
                          label="Available"
                          value={formatPrice(req.user_available_balance)}
                          color="emerald"
                        />
                        <BalancePill
                          icon={<Lock className="h-2.5 w-2.5" />}
                          label="On Hold"
                          value={formatPrice(req.user_held_balance ?? 0)}
                          color="amber"
                        />
                        <BalancePill
                          icon={<TrendingUp className="h-2.5 w-2.5" />}
                          label="Paid Out"
                          value={formatPrice(req.user_total_paid_out ?? 0)}
                          color="blue"
                        />
                      </div>
                    )}

                    {/* Pending withdrawal total (other open requests) */}
                    {req.status === "pending" &&
                      req.user_pending_withdrawal_total !== undefined &&
                      req.user_pending_withdrawal_total > Number(req.amount) && (
                        <p className="text-[8px] text-amber-600 dark:text-amber-400 font-bold mb-2">
                          ⚠ User has{" "}
                          {formatPrice(
                            req.user_pending_withdrawal_total - Number(req.amount)
                          )}{" "}
                          in other pending requests
                        </p>
                      )}

                    {req.admin_note && (
                      <p className="text-[9px] text-muted-foreground italic mb-2">
                        Note: {req.admin_note}
                      </p>
                    )}

                    {req.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => openAction(req, "complete")}
                          className="flex-1 rounded-lg h-7 text-[9px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Completed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAction(req, "reject")}
                          className="flex-1 rounded-lg h-7 text-[9px] font-black uppercase tracking-widest border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <XCircle className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </div>
                    )}

                    {req.resolved_at && (
                      <p className="text-[8px] text-muted-foreground text-right mt-1">
                        Resolved{" "}
                        {new Date(req.resolved_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={!hasPrev || loading}
                  className="rounded-lg h-7 px-3 text-[9px] font-black uppercase tracking-widest"
                >
                  <ChevronLeft className="h-3 w-3 mr-1" /> Prev
                </Button>

                <div className="text-center">
                  <p className="text-[9px] font-black text-foreground uppercase tracking-widest">
                    Page {page + 1} of {totalPages}
                  </p>
                  <p className="text-[8px] text-muted-foreground">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of{" "}
                    {totalCount}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNext || loading}
                  className="rounded-lg h-7 px-3 text-[9px] font-black uppercase tracking-widest"
                >
                  Next <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Confirmation Dialog */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={(v) => {
          if (!actionLoading) { setSelectedRequest(null); setDialogAction(null); }
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-tight">
              {dialogAction === "complete" ? "Confirm Payment Sent" : "Reject Withdrawal"}
            </DialogTitle>
            <DialogDescription className="text-[10px]">
              {dialogAction === "complete"
                ? `Confirm you have manually sent ${
                    selectedRequest ? formatPrice(Number(selectedRequest.amount)) : ""
                  } to the user. This will deduct the amount from their balance.`
                : "This will notify the user their request was rejected."}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <>
              <div className="bg-muted/40 rounded-xl p-3 text-[10px] space-y-1">
                <p>
                  <span className="font-bold">User:</span> {selectedRequest.user_name}
                </p>
                <p>
                  <span className="font-bold">Amount:</span>{" "}
                  {formatPrice(Number(selectedRequest.amount))}
                </p>
                <p>
                  <span className="font-bold">Method:</span>{" "}
                  {METHOD_LABELS[selectedRequest.withdrawal_method]}
                </p>
                {Object.entries(selectedRequest.withdrawal_details).map(([k, v]) => (
                  <p key={k}>
                    <span className="font-bold capitalize">{k.replace(/_/g, " ")}:</span> {v}
                  </p>
                ))}
              </div>

              {/* Balance summary in dialog for pending */}
              {selectedRequest.user_available_balance !== undefined && (
                <div className="grid grid-cols-3 gap-1.5">
                  <BalancePill
                    icon={<Wallet className="h-2.5 w-2.5" />}
                    label="Available"
                    value={formatPrice(selectedRequest.user_available_balance)}
                    color="emerald"
                  />
                  <BalancePill
                    icon={<Lock className="h-2.5 w-2.5" />}
                    label="On Hold"
                    value={formatPrice(selectedRequest.user_held_balance ?? 0)}
                    color="amber"
                  />
                  <BalancePill
                    icon={<TrendingUp className="h-2.5 w-2.5" />}
                    label="Paid Out"
                    value={formatPrice(selectedRequest.user_total_paid_out ?? 0)}
                    color="blue"
                  />
                </div>
              )}
            </>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              {dialogAction === "reject"
                ? "Rejection reason (required)"
                : "Admin note (optional)"}
            </label>
            <Input
              placeholder={
                dialogAction === "reject"
                  ? "e.g. Invalid account details"
                  : "e.g. Sent via Paystack"
              }
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="rounded-xl text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => { setSelectedRequest(null); setDialogAction(null); }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              className={`flex-1 rounded-xl font-black text-xs uppercase ${
                dialogAction === "complete"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-destructive hover:bg-destructive/90"
              }`}
              onClick={handleAction}
              disabled={actionLoading}
            >
              {actionLoading
                ? "Processing..."
                : dialogAction === "complete"
                ? "Confirm Sent"
                : "Reject"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Small pill showing a balance figure with a coloured left border */
function BalancePill({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "emerald" | "amber" | "blue";
}) {
  const colors = {
    emerald: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
    amber:   "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
    blue:    "border-blue-400 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
  };
  return (
    <div
      className={`rounded-lg border-l-2 px-2 py-1.5 ${colors[color]}`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        {icon}
        <p className="text-[7px] font-black uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-[9px] font-black">{value}</p>
    </div>
  );
}