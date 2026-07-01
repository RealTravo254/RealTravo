import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, DollarSign, Wallet, TrendingUp, Award, Percent,
  Users, ArrowUpRight, CreditCard, Clock, CheckCircle2, XCircle, Lock,
} from "lucide-react";
import { useHostVerificationStatus } from "@/hooks/useHostVerificationStatus";
import { WithdrawalDialog } from "@/components/referral/WithdrawalDialog";
import { WithdrawalDetailsSection } from "@/components/payment/WithdrawalDetailsSection";
import { SEOHead } from "@/components/SEOHead";
import { useCurrency } from "@/contexts/CurrencyContext";

const MIN_WITHDRAWAL = 100;

// Number of hours after guest's visit date before earnings are released
const HOLD_HOURS = 24;

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending:   { icon: <Clock className="h-3 w-3" />,         color: "text-amber-600 dark:text-amber-400",  label: "Pending"   },
  completed: { icon: <CheckCircle2 className="h-3 w-3" />,  color: "text-emerald-600",                    label: "Completed" },
  rejected:  { icon: <XCircle className="h-3 w-3" />,       color: "text-destructive",                    label: "Rejected"  },
};

/**
 * Returns true if the booking's earnings are past the 24-hour hold window.
 */
function isEarningReleased(booking: any): boolean {
  const rawDate =
    booking.visit_date ||
    booking.booking_details?.date ||
    null;

  if (!rawDate) return true;

  const visitTime = new Date(rawDate).getTime();
  const releaseTime = visitTime + HOLD_HOURS * 60 * 60 * 1000;
  return Date.now() >= releaseTime;
}

export default function Payment() {
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isVerifiedHost, status: verificationStatus, loading: verificationLoading } = useHostVerificationStatus();
  const [loading, setLoading] = useState(true);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);

  const [stats, setStats] = useState({
    totalReferred: 0,
    totalBookings: 0,
    totalCommission: 0,
    hostEarnings: 0,
    bookingEarnings: 0,
    grossBalance: 0,
    serviceFeeDeducted: 0,
    withdrawableBalance: 0,
    heldBalance: 0,
    totalPaidOut: 0,
  });

  const [recentCommissions, setRecentCommissions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (!verificationLoading) fetchData();
  }, [user, navigate, isVerifiedHost, verificationLoading]);

  const fetchData = async () => {
    try {
      const [bookingsRes, settingsRes, withdrawalRes] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "total_amount, item_id, booking_type, payment_status, service_fee_amount, referral_tracking_id, visit_date, booking_details"
          )
          .eq("payment_status", "completed"),
        supabase.from("referral_settings").select("*").single(),
        (supabase as any)
          .from("withdrawal_requests")
          .select("*")
          .eq("user_id", user!.id)
          .order("requested_at", { ascending: false })
          .limit(10),
      ]);

      const bookings = bookingsRes.data || [];
      const settings = settingsRes.data;
      const withdrawals: any[] = withdrawalRes.data || [];
      setWithdrawalRequests(withdrawals);

      // ── Build owner map + per-listing service fee map ────────────────────
      const itemIds = [...new Set(bookings.map((b: any) => b.item_id))];
      const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
        // trips covers both "trip" and "event" booking types — each row has
        // its own admin-set service_fee_percentage.
        supabase.from("trips").select("id, created_by, service_fee_percentage").in("id", itemIds),
        // hotels still use the general/shared service fee from referral_settings
        supabase.from("hotels").select("id, created_by").in("id", itemIds),
        // adventure_places (campsites) also have their own admin-set service_fee_percentage
        supabase.from("adventure_places").select("id, created_by, service_fee_percentage").in("id", itemIds),
      ]);

      const ownerMap = new Map<string, string>();
      // Per-listing service fee override — covers trips, events, and campsites.
      // Hotels are intentionally NOT in this map; they use the general setting.
      const listingFeeMap = new Map<string, number | null>();

      (tripsRes.data || []).forEach((t: any) => {
        if (t.created_by) ownerMap.set(t.id, t.created_by);
        listingFeeMap.set(t.id, t.service_fee_percentage != null ? Number(t.service_fee_percentage) : null);
      });
      (adventuresRes.data || []).forEach((a: any) => {
        if (a.created_by) ownerMap.set(a.id, a.created_by);
        listingFeeMap.set(a.id, a.service_fee_percentage != null ? Number(a.service_fee_percentage) : null);
      });
      (hotelsRes.data || []).forEach((h: any) => {
        if (h.created_by) ownerMap.set(h.id, h.created_by);
      });

      // ── Compute gross host earnings split by hold status ─────────────────
      let grossHostEarnings = 0;
      let totalServiceFee = 0;
      let heldEarnings = 0;
      let releasedEarnings = 0;

      for (const b of bookings) {
        if (ownerMap.get(b.item_id) !== user?.id) continue;

        const amount = Number(b.total_amount);
        grossHostEarnings += amount;

        let serviceFeeRate = 0;
        if (b.booking_type === "trip" || b.booking_type === "event") {
          // Trips & events: own per-listing fee only, no general fallback.
          const listingFee = listingFeeMap.get(b.item_id);
          serviceFeeRate = listingFee != null ? listingFee : 0;
        } else if (b.booking_type === "hotel") {
          // Hotels still use the shared/general fee.
          serviceFeeRate = Number(settings?.hotel_service_fee || 0);
        } else if (b.booking_type === "adventure" || b.booking_type === "adventure_place") {
          // Campsites/adventures: own per-listing fee only, no general fallback.
          const listingFee = listingFeeMap.get(b.item_id);
          serviceFeeRate = listingFee != null ? listingFee : 0;
        } else if (b.booking_type === "attraction") {
          serviceFeeRate = Number(settings?.attraction_service_fee || 0);
        }

        const fee = (amount * serviceFeeRate) / 100;
        totalServiceFee += fee;

        const net = amount - fee;
        if (isEarningReleased(b)) {
          releasedEarnings += net;
        } else {
          heldEarnings += net;
        }
      }

      // ── Withdrawal totals ────────────────────────────────────────────────
      const completedWithdrawals = withdrawals
        .filter((w) => w.status === "completed")
        .reduce((s: number, w: any) => s + Number(w.amount), 0);

      const pendingWithdrawals = withdrawals
        .filter((w) => w.status === "pending")
        .reduce((s: number, w: any) => s + Number(w.amount), 0);

      const netReleased = releasedEarnings - completedWithdrawals - pendingWithdrawals;

      // ── Referral commissions (verified hosts only) ───────────────────────
      if (isVerifiedHost) {
        const [refRes, comRes] = await Promise.all([
          supabase
            .from("referral_tracking")
            .select("referred_user_id")
            .eq("referrer_id", user!.id),
          supabase
            .from("referral_commissions")
            .select(
              "commission_type,commission_amount,booking_amount,status,withdrawn_at,created_at,booking_id"
            )
            .eq("referrer_id", user!.id)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        const refs = refRes.data || [];
        const coms = comRes.data || [];
        const unique = new Set(refs.map((r) => r.referred_user_id).filter(Boolean));
        const bookE = coms
          .filter((c) => c.commission_type === "booking")
          .reduce((s, c) => s + Number(c.commission_amount), 0);
        const withdrawableCommissions = coms
          .filter((c) => c.status === "paid" && !c.withdrawn_at)
          .reduce((s, c) => s + Number(c.commission_amount), 0);

        setRecentCommissions(coms.slice(0, 5));
        setStats({
          totalReferred: unique.size,
          totalBookings: coms.length,
          totalCommission: bookE,
          hostEarnings: grossHostEarnings,
          bookingEarnings: bookE,
          grossBalance: grossHostEarnings,
          serviceFeeDeducted: totalServiceFee,
          withdrawableBalance: Math.max(0, netReleased + withdrawableCommissions),
          heldBalance: heldEarnings,
          totalPaidOut: completedWithdrawals,
        });
      } else {
        setStats((prev) => ({
          ...prev,
          hostEarnings: grossHostEarnings,
          withdrawableBalance: Math.max(0, netReleased),
          grossBalance: grossHostEarnings,
          serviceFeeDeducted: totalServiceFee,
          heldBalance: heldEarnings,
          totalPaidOut: completedWithdrawals,
        }));
      }

      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleWithdrawalSuccess = () => { setLoading(true); fetchData(); };

  const canWithdraw = stats.withdrawableBalance >= MIN_WITHDRAWAL;

  if (loading || verificationLoading)
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

  const pendingRequests = withdrawalRequests.filter((w) => w.status === "pending");
  const methodLabel: Record<string, string> = {
    bank_transfer: "Bank Transfer",
    mpesa: "M-Pesa",
    paystack: "Paystack",
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Payment Dashboard | Realtravo"
        description="View your earnings, referral commissions, and manage withdrawals on Realtravo."
      />
      <main className="container px-4 py-4 mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="mb-3 rounded-lg text-[9px] font-bold uppercase tracking-widest px-3 h-7"
        >
          <ArrowLeft className="mr-1 h-3 w-3" /> Home
        </Button>

        <div className="mb-4">
          <h1 className="text-lg font-black uppercase tracking-tight text-foreground">
            Payment Dashboard
          </h1>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
            Earnings, referrals & withdrawals
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mb-4 w-full rounded-xl text-[10px] font-black uppercase tracking-widest border-border"
          onClick={() => navigate("/payment-history")}
        >
          <CreditCard className="mr-2 h-3.5 w-3.5" /> View Payment History
        </Button>

        {/* ── Balance Cards ── */}
        <div className="grid grid-cols-1 gap-2 mb-1">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Wallet className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    Available Balance
                  </p>
                  <p className="text-2xl font-black text-destructive">
                    {formatPrice(stats.withdrawableBalance)}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowWithdrawDialog(true)}
                disabled={!canWithdraw}
                size="sm"
                className="rounded-lg text-[9px] font-bold uppercase h-8 px-4"
              >
                {canWithdraw ? "Withdraw" : `Min ${formatPrice(MIN_WITHDRAWAL)}`}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {stats.heldBalance > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                    On Hold
                  </p>
                </div>
                <p className="text-sm font-black text-amber-700 dark:text-amber-300">
                  {formatPrice(stats.heldBalance)}
                </p>
                <p className="text-[8px] text-amber-600 dark:text-amber-400 mt-0.5">
                  Released 24 h after visit
                </p>
              </div>
            )}

            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <p className="text-[8px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                  Total Paid Out
                </p>
              </div>
              <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                {formatPrice(stats.totalPaidOut)}
              </p>
              <p className="text-[8px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                Completed withdrawals
              </p>
            </div>
          </div>
        </div>

        {stats.withdrawableBalance > 0 && !canWithdraw && (
          <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold text-center mb-4 mt-1">
            Minimum withdrawal is {formatPrice(MIN_WITHDRAWAL)}. You need{" "}
            {formatPrice(MIN_WITHDRAWAL - stats.withdrawableBalance)} more.
          </p>
        )}
        {stats.withdrawableBalance <= 0 && stats.heldBalance > 0 && (
          <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold text-center mb-4 mt-1">
            {formatPrice(stats.heldBalance)} is held for 24 h after your guests&apos; visits.
          </p>
        )}
        {stats.withdrawableBalance <= 0 && stats.heldBalance === 0 && (
          <p className="text-[9px] text-muted-foreground font-bold text-center mb-4 mt-1">
            No balance available for withdrawal yet (or pending review).
          </p>
        )}
        {canWithdraw && (
          <p className="text-[9px] text-muted-foreground font-bold text-center mb-4 mt-1">
            Admin reviews requests manually · Transfers usually arrive within 24 hrs.
          </p>
        )}

        <WithdrawalDetailsSection userId={user?.id || ""} />

        {withdrawalRequests.length > 0 && (
          <>
            <div className="mb-3 mt-2">
              <h2 className="text-sm font-black uppercase tracking-tight text-foreground">
                Withdrawal Requests
              </h2>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                {pendingRequests.length > 0
                  ? `${pendingRequests.length} pending · admin will process soon`
                  : "All requests processed"}
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden mb-4">
              {withdrawalRequests.map((w, i) => {
                const cfg = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                const details = w.withdrawal_details || {};
                let detailLine = "";
                if (w.withdrawal_method === "bank_transfer")
                  detailLine = `${details.bank_name || ""} · ${details.account_number || ""}`;
                else if (w.withdrawal_method === "mpesa") detailLine = details.phone || "";
                else if (w.withdrawal_method === "paystack") detailLine = details.email || "";

                return (
                  <div
                    key={w.id}
                    className={`flex items-center justify-between p-3 ${
                      i !== withdrawalRequests.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                          w.status === "completed"
                            ? "bg-emerald-50 dark:bg-emerald-950/30"
                            : w.status === "rejected"
                            ? "bg-red-50 dark:bg-red-950/30"
                            : "bg-amber-50 dark:bg-amber-950/30"
                        }`}
                      >
                        <Wallet
                          className={`h-3.5 w-3.5 ${
                            w.status === "completed"
                              ? "text-emerald-600"
                              : w.status === "rejected"
                              ? "text-destructive"
                              : "text-amber-600"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-foreground">
                          {methodLabel[w.withdrawal_method] || w.withdrawal_method}
                        </p>
                        <p className="text-[9px] text-muted-foreground">{detailLine}</p>
                        <p className="text-[8px] text-muted-foreground">
                          {new Date(w.requested_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {w.admin_note && w.status === "rejected" && (
                          <p className="text-[8px] text-destructive font-bold mt-0.5">
                            Note: {w.admin_note}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-foreground">
                        {formatPrice(Number(w.amount))}
                      </p>
                      <div
                        className={`flex items-center justify-end gap-1 text-[8px] font-black uppercase ${cfg.color}`}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!isVerifiedHost && !verificationLoading && (
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800 mb-4">
            <div className="flex items-start gap-3">
              <Award className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-tight text-amber-800 dark:text-amber-300">
                  Unlock Referral Earnings
                </h3>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                  {verificationStatus === "pending"
                    ? "Your host verification is pending. Referral program will be unlocked once approved."
                    : "Become a verified host to earn commissions by sharing listings with your referral link."}
                </p>
                {verificationStatus !== "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/host-verification")}
                    className="mt-2 rounded-lg text-[9px] font-bold uppercase h-7 border-amber-300"
                  >
                    <ArrowUpRight className="h-3 w-3 mr-1" /> Get Verified
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mb-3">
          <h2 className="text-sm font-black uppercase tracking-tight text-foreground">
            Earnings Breakdown
          </h2>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
            Host income after deductions
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <StatCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Gross Earnings"
            value={formatPrice(stats.hostEarnings)}
          />
          <StatCard
            icon={<Percent className="h-4 w-4" />}
            label="Service Fee"
            value={`- ${formatPrice(stats.serviceFeeDeducted)}`}
          />
          <StatCard
            icon={<Wallet className="h-4 w-4" />}
            label="Net Earnings"
            value={formatPrice(Math.max(0, stats.hostEarnings - stats.serviceFeeDeducted))}
          />
          <StatCard
            icon={<Lock className="h-4 w-4" />}
            label="On Hold (24 h)"
            value={formatPrice(stats.heldBalance)}
          />
        </div>

        {isVerifiedHost && (
          <>
            <div className="mb-3">
              <h2 className="text-sm font-black uppercase tracking-tight text-foreground">
                Referral Earnings
              </h2>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                Track your performance
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <FactorCard
                icon={<Users className="h-4 w-4" />}
                label="People Referred"
                value={stats.totalReferred}
              />
              <FactorCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Conversions"
                value={stats.totalBookings}
              />
              <FactorCard
                icon={<DollarSign className="h-4 w-4" />}
                label="From Bookings"
                value={formatPrice(stats.bookingEarnings)}
              />
              <FactorCard
                icon={<Wallet className="h-4 w-4" />}
                label="Total Earned"
                value={formatPrice(stats.totalCommission)}
              />
            </div>

            {recentCommissions.length > 0 && (
              <>
                <div className="mb-3">
                  <h2 className="text-sm font-black uppercase tracking-tight text-foreground">
                    Recent Activity
                  </h2>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    Latest referral commissions
                  </p>
                </div>
                <div className="bg-card rounded-xl border border-border overflow-hidden mb-4">
                  {recentCommissions.map((c, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-3 ${
                        i !== recentCommissions.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-foreground">
                            Booking Commission
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            {c.created_at
                              ? new Date(c.created_at).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-emerald-600">
                          +{formatPrice(Number(c.commission_amount))}
                        </p>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">
                          {c.withdrawn_at
                            ? "Withdrawn"
                            : c.status === "paid"
                            ? "Available"
                            : c.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mb-3">
              <h2 className="text-sm font-black uppercase tracking-tight text-foreground">
                Referral Rates by Category
              </h2>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                Commission rates per item type
              </p>
            </div>
            <ReferralRatesSection />
          </>
        )}
      </main>

      <WithdrawalDialog
        open={showWithdrawDialog}
        onOpenChange={setShowWithdrawDialog}
        availableBalance={stats.withdrawableBalance}
        userId={user?.id || ""}
        onSuccess={handleWithdrawalSuccess}
      />
    </div>
  );
}

const ReferralRatesSection = () => {
  const [rates, setRates] = useState<any>(null);
  useEffect(() => {
    supabase
      .from("referral_settings")
      .select(
        "trip_commission_rate,event_commission_rate,hotel_commission_rate,adventure_place_commission_rate"
      )
      .single()
      .then(({ data }) => data && setRates(data));
  }, []);
  if (!rates) return null;
  const items = [
    { label: "Trips",      value: `${rates.trip_commission_rate}%` },
    { label: "Events",     value: `${rates.event_commission_rate}%` },
    { label: "Hotels",     value: `${rates.hotel_commission_rate}%` },
    { label: "Adventures", value: `${rates.adventure_place_commission_rate}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {items.map((item) => (
        <StatCard
          key={item.label}
          icon={<Percent className="h-4 w-4" />}
          label={item.label}
          value={item.value}
        />
      ))}
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) => (
  <div className="bg-card rounded-xl p-3 border border-border">
    <div className="flex items-center gap-2 mb-1">
      <div className="text-primary">{icon}</div>
      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
        {label}
      </span>
    </div>
    <p className="text-sm font-black text-foreground">{value}</p>
  </div>
);

const FactorCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) => (
  <div className="bg-card rounded-xl p-3 border border-border">
    <div className="flex items-center gap-2 mb-1">
      <div className="text-[#008080]">{icon}</div>
      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
        {label}
      </span>
    </div>
    <p className="text-sm font-black text-foreground">{value}</p>
  </div>
);