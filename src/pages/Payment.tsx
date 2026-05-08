import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, DollarSign, Wallet, TrendingUp, Award, Percent, 
  Link2, Users, ArrowUpRight, CreditCard
} from "lucide-react";
import { useHostVerificationStatus } from "@/hooks/useHostVerificationStatus";
import { WithdrawalDialog } from "@/components/referral/WithdrawalDialog";
import { WithdrawalDetailsSection } from "@/components/payment/WithdrawalDetailsSection";
import { SEOHead } from "@/components/SEOHead";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function Payment() {
  const { formatPrice } = useCurrency(); 
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isVerifiedHost, status: verificationStatus, loading: verificationLoading } = useHostVerificationStatus();
  const [loading, setLoading] = useState(true);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);

  const [stats, setStats] = useState({
    totalReferred: 0, totalBookings: 0, totalCommission: 0,
    hostEarnings: 0, bookingEarnings: 0, grossBalance: 0,
    serviceFeeDeducted: 0, withdrawableBalance: 0,
  });

  // Commission history for timeline
  const [recentCommissions, setRecentCommissions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (!verificationLoading) fetchData();
  }, [user, navigate, isVerifiedHost, verificationLoading]);


  const fetchData = async () => {
    try {
      const [bookingsRes, settingsRes] = await Promise.all([
        supabase.from("bookings")
          .select("total_amount, item_id, booking_type, payment_status, service_fee_amount, referral_tracking_id")
          .eq("payment_status", "completed"),
        supabase.from("referral_settings").select("*").single(),
      ]);

      const bookings = bookingsRes.data || [];
      const settings = settingsRes.data;
      
      const itemIds = [...new Set(bookings.map(b => b.item_id))];
      const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
        supabase.from("trips").select("id, created_by").in("id", itemIds),
        supabase.from("hotels").select("id, created_by").in("id", itemIds),
        supabase.from("adventure_places").select("id, created_by").in("id", itemIds),
      ]);
      
      const ownerMap = new Map<string, string>();
      [...(tripsRes.data || []), ...(hotelsRes.data || []), ...(adventuresRes.data || [])].forEach(item => {
        if (item.created_by) ownerMap.set(item.id, item.created_by);
      });

      let grossHostEarnings = 0;
      let totalServiceFee = 0;

      for (const b of bookings) {
        if (ownerMap.get(b.item_id) === user?.id) {
          const amount = Number(b.total_amount);
          grossHostEarnings += amount;

          let serviceFeeRate = 0;
          if (settings) {
            if (b.booking_type === 'trip') serviceFeeRate = Number(settings.trip_service_fee || 0);
            else if (b.booking_type === 'event') serviceFeeRate = Number(settings.event_service_fee || 0);
            else if (b.booking_type === 'hotel') serviceFeeRate = Number(settings.hotel_service_fee || 0);
            else if (b.booking_type === 'adventure' || b.booking_type === 'adventure_place') serviceFeeRate = Number(settings.adventure_place_service_fee || 0);
            else if (b.booking_type === 'attraction') serviceFeeRate = Number(settings.attraction_service_fee || 0);
          }

          totalServiceFee += (amount * serviceFeeRate) / 100;
        }
      }

      const netHostEarnings = grossHostEarnings - totalServiceFee;

      if (isVerifiedHost) {
        const [refRes, comRes] = await Promise.all([
          supabase.from("referral_tracking").select("referred_user_id").eq("referrer_id", user!.id),
          supabase.from("referral_commissions")
            .select("commission_type,commission_amount,booking_amount,status,withdrawn_at,created_at,booking_id")
            .eq("referrer_id", user!.id)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);
        const refs = refRes.data || [], coms = comRes.data || [];
        const unique = new Set(refs.map(r => r.referred_user_id).filter(Boolean));
        const bookE = coms.filter(c => c.commission_type === 'booking').reduce((s, c) => s + Number(c.commission_amount), 0);
        const withdrawableCommissions = coms.filter(c => c.status === 'paid' && !c.withdrawn_at).reduce((s, c) => s + Number(c.commission_amount), 0);

        setRecentCommissions(coms.slice(0, 5));
        setStats({
          totalReferred: unique.size,
          totalBookings: coms.length,
          totalCommission: bookE,
          hostEarnings: grossHostEarnings,
          bookingEarnings: bookE,
          grossBalance: grossHostEarnings,
          serviceFeeDeducted: totalServiceFee,
          withdrawableBalance: netHostEarnings + withdrawableCommissions,
        });
      } else {
        setStats(prev => ({
          ...prev,
          hostEarnings: grossHostEarnings,
          withdrawableBalance: netHostEarnings,
          grossBalance: grossHostEarnings,
          serviceFeeDeducted: totalServiceFee,
        }));
      }
      setLoading(false);
    } catch (e) { console.error(e); setLoading(false); }
  };

  const handleWithdrawalSuccess = () => { setLoading(true); window.location.reload(); };

  if (loading || verificationLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-2">
        {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Payment Dashboard | Realtravo" description="View your earnings, referral commissions, and manage withdrawals on Realtravo." />
      <main className="container px-4 py-4 mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-3 rounded-lg text-[9px] font-bold uppercase tracking-widest px-3 h-7">
          <ArrowLeft className="mr-1 h-3 w-3" /> Home
        </Button>

        <div className="mb-4">
          <h1 className="text-lg font-black uppercase tracking-tight text-foreground">Payment Dashboard</h1>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Earnings, referrals & withdrawals</p>
        </div>

        <Button variant="outline" size="sm" className="mb-4 w-full rounded-xl text-[10px] font-black uppercase tracking-widest border-border" onClick={() => navigate("/payment-history")}>
          <CreditCard className="mr-2 h-3.5 w-3.5" /> View Payment History
        </Button>

        <div className="bg-card rounded-xl p-4 border border-border mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Wallet className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Available Balance</p>
                <p className="text-2xl font-black text-destructive">{formatPrice(stats.withdrawableBalance)}</p>
              </div>
            </div>
            <Button onClick={() => setShowWithdrawDialog(true)} disabled={stats.withdrawableBalance <= 0} size="sm"
              className="rounded-lg text-[9px] font-bold uppercase h-8 px-4">
              Withdraw
            </Button>
          </div>
        </div>

        <WithdrawalDetailsSection userId={user?.id || ""} />

        {/* Referral info */}
        {isVerifiedHost && (
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest text-primary">Referral Program</h3>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Share referral links from any listing's detail page to earn commissions. Commission rates are set per category by the admin.
            </p>
          </div>
        )}

        {/* Not verified host prompt */}
        {!isVerifiedHost && !verificationLoading && (
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800 mb-4">
            <div className="flex items-start gap-3">
              <Award className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-tight text-amber-800 dark:text-amber-300">Unlock Referral Earnings</h3>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                  {verificationStatus === 'pending' 
                    ? 'Your host verification is pending. Referral program will be unlocked once approved.'
                    : 'Become a verified host to earn commissions by sharing listings with your referral link.'}
                </p>
                {verificationStatus !== 'pending' && (
                  <Button size="sm" variant="outline" onClick={() => navigate("/host-verification")} 
                    className="mt-2 rounded-lg text-[9px] font-bold uppercase h-7 border-amber-300">
                    <ArrowUpRight className="h-3 w-3 mr-1" /> Get Verified
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Host Earnings Breakdown */}
        <div className="mb-3">
          <h2 className="text-sm font-black uppercase tracking-tight text-foreground">Earnings Breakdown</h2>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Host income after deductions</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <StatCard icon={<DollarSign className="h-4 w-4" />} label="Gross Earnings" value={formatPrice(stats.hostEarnings)} />
          <StatCard icon={<Percent className="h-4 w-4" />} label="Service Fee" value={`- ${formatPrice(stats.serviceFeeDeducted)}`} />
          <StatCard icon={<Wallet className="h-4 w-4" />} label="Net Earnings" value={formatPrice(Math.max(0, stats.hostEarnings - stats.serviceFeeDeducted))} />
        </div>

        {/* Referral Stats */}
        {isVerifiedHost && (
          <>
            <div className="mb-3">
              <h2 className="text-sm font-black uppercase tracking-tight text-foreground">Referral Earnings</h2>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Track your performance</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <StatCard icon={<Users className="h-4 w-4" />} label="People Referred" value={stats.totalReferred} />
              <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Conversions" value={stats.totalBookings} />
              <StatCard icon={<DollarSign className="h-4 w-4" />} label="From Bookings" value={formatPrice(stats.bookingEarnings)} />
              <StatCard icon={<Wallet className="h-4 w-4" />} label="Total Earned" value={formatPrice(stats.totalCommission)} />
            </div>

            {/* Recent Commission Activity */}
            {recentCommissions.length > 0 && (
              <>
                <div className="mb-3">
                  <h2 className="text-sm font-black uppercase tracking-tight text-foreground">Recent Activity</h2>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Latest referral commissions</p>
                </div>
                <div className="bg-card rounded-xl border border-border overflow-hidden mb-4">
                  {recentCommissions.map((c, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 ${i !== recentCommissions.length - 1 ? 'border-b border-border' : ''}`}>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-foreground">Booking Commission</p>
                          <p className="text-[9px] text-muted-foreground">
                            {c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-emerald-600">+{formatPrice(Number(c.commission_amount))}</p>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">
                          {c.withdrawn_at ? 'Withdrawn' : c.status === 'paid' ? 'Available' : c.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Per-item referral rates */}
            <div className="mb-3">
              <h2 className="text-sm font-black uppercase tracking-tight text-foreground">Referral Rates by Category</h2>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Commission rates per item type</p>
            </div>
            <ReferralRatesSection />
          </>
        )}
      </main>

      <WithdrawalDialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}
        availableBalance={stats.withdrawableBalance} userId={user?.id || ""} onSuccess={handleWithdrawalSuccess} />
    </div>
  );
}

const ReferralRatesSection = () => {
  const [rates, setRates] = useState<any>(null);
  useEffect(() => {
    supabase.from("referral_settings").select("trip_commission_rate,event_commission_rate,hotel_commission_rate,adventure_place_commission_rate").single()
      .then(({ data }) => data && setRates(data));
  }, []);
  if (!rates) return null;
  const items = [
    { label: "Trips", value: `${rates.trip_commission_rate}%` },
    { label: "Events", value: `${rates.event_commission_rate}%` },
    { label: "Hotels", value: `${rates.hotel_commission_rate}%` },
    { label: "Adventures", value: `${rates.adventure_place_commission_rate}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {items.map(item => (
        <StatCard key={item.label} icon={<Percent className="h-4 w-4" />} label={item.label} value={item.value} />
      ))}
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div className="bg-card rounded-xl p-3 border border-border">
    <div className="flex items-center gap-2 mb-1">
      <div className="text-primary">{icon}</div>
      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-sm font-black text-foreground">{value}</p>
  </div>
);
