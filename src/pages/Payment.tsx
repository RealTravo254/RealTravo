import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, DollarSign, Wallet, TrendingUp, Award, Percent, Receipt
} from "lucide-react";
import { useHostVerificationStatus } from "@/hooks/useHostVerificationStatus";
import { WithdrawalDialog } from "@/components/referral/WithdrawalDialog";
import { Badge } from "@/components/ui/badge";

export default function Payment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isVerifiedHost, status: verificationStatus, loading: verificationLoading } = useHostVerificationStatus();
  const [loading, setLoading] = useState(true);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);

  const [stats, setStats] = useState({
    totalReferred: 0, totalBookings: 0, totalCommission: 0,
    hostEarnings: 0, bookingEarnings: 0, grossBalance: 0,
    serviceFeeDeducted: 0, referralDeducted: 0, withdrawableBalance: 0, avgServiceFeeRate: 0,
  });

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (!verificationLoading) fetchData();
  }, [user, navigate, isVerifiedHost, verificationLoading]);

  const fetchData = async () => {
    try {
      // Fetch host earnings from completed bookings + settings
      const [bookingsRes, settingsRes] = await Promise.all([
        supabase.from("bookings")
          .select("total_amount, item_id, booking_type, payment_status, service_fee_amount, referral_tracking_id")
          .eq("payment_status", "completed"),
        supabase.from("referral_settings").select("*").single(),
      ]);

      const bookings = bookingsRes.data || [];
      const settings = settingsRes.data;
      
      // Batch fetch all item owners instead of N+1 queries
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
      let totalReferralDeducted = 0;

      for (const b of bookings) {
        if (ownerMap.get(b.item_id) === user?.id) {
          const amount = Number(b.total_amount);
          grossHostEarnings += amount;
          
          let serviceFeeRate = 20.0;
          if (settings) {
            if (b.booking_type === 'trip' || b.booking_type === 'event') serviceFeeRate = Number(settings.trip_service_fee);
            else if (b.booking_type === 'hotel') serviceFeeRate = Number(settings.hotel_service_fee);
            else if (b.booking_type === 'adventure' || b.booking_type === 'adventure_place') serviceFeeRate = Number(settings.adventure_place_service_fee);
          }
          const fee = (amount * serviceFeeRate) / 100;
          totalServiceFee += fee;
          
          if (b.referral_tracking_id) {
            let commRate = 5.0;
            if (settings) {
              if (b.booking_type === 'trip' || b.booking_type === 'event') commRate = Number(settings.trip_commission_rate);
              else if (b.booking_type === 'hotel') commRate = Number(settings.hotel_commission_rate);
              else if (b.booking_type === 'adventure' || b.booking_type === 'adventure_place') commRate = Number(settings.adventure_place_commission_rate);
            }
            totalReferralDeducted += (fee * commRate) / 100;
          }
        }
      }

      const netHostEarnings = grossHostEarnings - totalServiceFee;

      if (isVerifiedHost) {
        const [refRes, comRes] = await Promise.all([
          supabase.from("referral_tracking").select("referred_user_id").eq("referrer_id", user!.id),
          supabase.from("referral_commissions").select("commission_type,commission_amount,booking_amount,status,withdrawn_at").eq("referrer_id", user!.id),
        ]);
        const refs = refRes.data || [], coms = comRes.data || [];
        const unique = new Set(refs.map(r => r.referred_user_id).filter(Boolean));
        const bookE = coms.filter(c => c.commission_type === 'booking').reduce((s, c) => s + Number(c.commission_amount), 0);
        const withdrawableCommissions = coms.filter(c => c.status === 'paid' && !c.withdrawn_at).reduce((s, c) => s + Number(c.commission_amount), 0);
        const rate = settings?.platform_referral_commission_rate || 5.0;
        setStats({
          totalReferred: unique.size, totalBookings: coms.length, totalCommission: bookE,
          hostEarnings: grossHostEarnings, bookingEarnings: bookE, grossBalance: grossHostEarnings,
          serviceFeeDeducted: totalServiceFee, referralDeducted: totalReferralDeducted,
          withdrawableBalance: netHostEarnings + withdrawableCommissions, avgServiceFeeRate: rate,
        });
      } else {
        setStats(prev => ({ ...prev, hostEarnings: grossHostEarnings, withdrawableBalance: netHostEarnings, grossBalance: grossHostEarnings, serviceFeeDeducted: totalServiceFee, referralDeducted: totalReferralDeducted }));
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
      <main className="container px-3 py-4 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-3 rounded-lg text-[9px] font-bold uppercase tracking-widest px-3 h-7">
          <ArrowLeft className="mr-1 h-3 w-3" /> Home
        </Button>

        <div className="mb-4">
          <h1 className="text-lg font-black uppercase tracking-tight text-foreground">Payment Dashboard</h1>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Earnings, referrals & withdrawals</p>
        </div>

        {/* Balance Card */}
        <div className="bg-card rounded-xl p-4 border border-border mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Wallet className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Available Balance</p>
                <p className="text-2xl font-black text-destructive">KES {stats.withdrawableBalance.toLocaleString()}</p>
              </div>
            </div>
            <Button onClick={() => setShowWithdrawDialog(true)} disabled={stats.withdrawableBalance <= 0} size="sm"
              className="rounded-lg text-[9px] font-bold uppercase h-8 px-4">
              Withdraw
            </Button>
          </div>
        </div>

        {/* Host Earnings Breakdown */}
        <div className="mb-3">
          <h2 className="text-sm font-black uppercase tracking-tight text-foreground">Earnings Breakdown</h2>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Host income after deductions</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <StatCard icon={<DollarSign className="h-4 w-4" />} label="Gross Earnings" value={`KES ${stats.hostEarnings.toLocaleString()}`} />
          <StatCard icon={<Percent className="h-4 w-4" />} label="Service Fee" value={`- KES ${stats.serviceFeeDeducted.toLocaleString()}`} />
          {stats.referralDeducted > 0 && (
            <StatCard icon={<Award className="h-4 w-4" />} label="Referral Comm." value={`- KES ${Math.round(stats.referralDeducted).toLocaleString()}`} />
          )}
          <StatCard icon={<Wallet className="h-4 w-4" />} label="Net Earnings" value={`KES ${Math.max(0, stats.hostEarnings - stats.serviceFeeDeducted).toLocaleString()}`} />
        </div>

        {/* Referral Stats */}
        {isVerifiedHost && (
          <>
            <div className="mb-3">
              <h2 className="text-sm font-black uppercase tracking-tight text-foreground">Referral Earnings</h2>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Track your performance</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <StatCard icon={<TrendingUp className="h-4 w-4" />} label="From Bookings" value={`KES ${stats.bookingEarnings.toLocaleString()}`} />
              <StatCard icon={<Percent className="h-4 w-4" />} label="Rate" value={`${stats.avgServiceFeeRate}%`} />
              <StatCard icon={<Award className="h-4 w-4" />} label="Referrals" value={stats.totalReferred} />
              <StatCard icon={<DollarSign className="h-4 w-4" />} label="Conversions" value={stats.totalBookings} />
              <StatCard icon={<Wallet className="h-4 w-4" />} label="Total Earned" value={`KES ${stats.totalCommission.toLocaleString()}`} />
            </div>
          </>
        )}
      </main>

      <WithdrawalDialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}
        availableBalance={stats.withdrawableBalance} userId={user?.id || ""} onSuccess={handleWithdrawalSuccess} />
    </div>
  );
}

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div className="bg-card rounded-xl p-3 border border-border">
    <div className="flex items-center gap-2 mb-1">
      <div className="text-primary">{icon}</div>
      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-sm font-black text-foreground">{typeof value === 'string' && value.includes('KES') ? <span className="text-destructive">{value}</span> : value}</p>
  </div>
);
