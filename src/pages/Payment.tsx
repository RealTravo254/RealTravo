import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, Users, DollarSign, Wallet, TrendingUp, Award, Percent, 
  ShieldX, ShieldCheck, Clock, CheckCircle, XCircle, AlertCircle, 
  Building2, UserCircle, CreditCard 
} from "lucide-react";
import { useHostVerificationStatus } from "@/hooks/useHostVerificationStatus";
import { WithdrawalDialog } from "@/components/referral/WithdrawalDialog";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50", 
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const POPULAR_BANKS = [
  "Access Bank", "Equity Bank", "KCB Bank", "Stanbic Bank",
  "Standard Chartered", "Barclays Bank", "NCBA Bank",
  "Co-operative Bank", "I&M Bank", "DTB Bank", "Other"
];

export default function Payment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isVerifiedHost, status: verificationStatus, loading: verificationLoading } = useHostVerificationStatus();
  const [loading, setLoading] = useState(true);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  
  // Bank details state
  const [bankDetails, setBankDetails] = useState({ 
    accountName: "", 
    accountNumber: "", 
    bankName: "" 
  });
  const [bankVerificationStatus, setBankVerificationStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Financial stats state
  const [stats, setStats] = useState({
    totalReferred: 0,
    totalBookings: 0,
    totalCommission: 0,
    hostEarnings: 0,
    bookingEarnings: 0,
    grossBalance: 0,
    serviceFeeDeducted: 0,
    withdrawableBalance: 0,
    avgServiceFeeRate: 0,
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch bank details
        const { data: bankData } = await supabase
          .from("bank_details")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (bankData) {
          setBankDetails({
            accountName: bankData.account_holder_name,
            accountNumber: bankData.account_number,
            bankName: bankData.bank_name,
          });
          setBankVerificationStatus(bankData.verification_status);
          setRejectionReason(bankData.rejection_reason);
          if (bankData.last_updated) {
            const lastUpdate = new Date(bankData.last_updated);
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            setCanEdit(lastUpdate < oneMonthAgo || bankData.verification_status === 'rejected');
          }
        } else {
          setIsEditing(true);
        }

        // Fetch host earnings from bookings
        const { data: bookings } = await supabase
          .from("bookings")
          .select("total_amount, item_id, booking_type, payment_status")
          .eq("payment_status", "completed");

        let hostBalance = 0;
        if (bookings) {
          const tableMap: Record<string, string> = { 
            trip: "trips", 
            hotel: "hotels", 
            adventure: "adventure_places" 
          };
          for (const booking of bookings) {
            const tableName = tableMap[booking.booking_type];
            if (tableName) {
              const { data: item } = await supabase
                .from(tableName as any)
                .select("created_by")
                .eq("id", booking.item_id)
                .single();
              if ((item as any)?.created_by === user.id) {
                hostBalance += Number(booking.total_amount);
              }
            }
          }
        }

        // Fetch referral stats (only if verified host)
        if (isVerifiedHost) {
          const [referralsRes, commissionsRes, settingsRes] = await Promise.all([
            supabase.from("referral_tracking").select("referred_user_id").eq("referrer_id", user.id),
            supabase.from("referral_commissions").select("commission_type,commission_amount,booking_amount,status,withdrawn_at").eq("referrer_id", user.id),
            supabase.from("referral_settings").select("platform_referral_commission_rate").single(),
          ]);

          const referrals = referralsRes.data || [];
          const commissions = commissionsRes.data || [];
          const settings = settingsRes.data;

          const uniqueReferred = new Set(referrals.map((r) => r.referred_user_id).filter(Boolean));

          const hostEarnings = commissions.filter(c => c.commission_type === 'host')
            .reduce((sum, c) => sum + Number(c.commission_amount), 0);
          
          const bookingEarnings = commissions.filter(c => c.commission_type === 'booking')
            .reduce((sum, c) => sum + Number(c.commission_amount), 0);

          const totalCommission = hostEarnings + bookingEarnings;
          
          const withdrawableBalance = commissions
            .filter(c => c.status === 'paid' && !c.withdrawn_at)
            .reduce((sum, c) => sum + Number(c.commission_amount), 0);

          const grossBalance = commissions.filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + Number(c.commission_amount), 0);

          const totalBookingAmount = commissions.filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + Number(c.booking_amount), 0);

          const avgServiceFeeRate = settings?.platform_referral_commission_rate || 5.0;
          const estimatedServiceFee = totalBookingAmount * (avgServiceFeeRate / 100) - grossBalance;

          setStats({
            totalReferred: uniqueReferred.size,
            totalBookings: commissions.length,
            totalCommission,
            hostEarnings,
            bookingEarnings,
            grossBalance,
            serviceFeeDeducted: Math.max(0, estimatedServiceFee),
            withdrawableBalance: withdrawableBalance + hostBalance,
            avgServiceFeeRate,
          });
        } else {
          // If not a verified host, only show host earnings
          setStats(prev => ({
            ...prev,
            withdrawableBalance: hostBalance,
            grossBalance: hostBalance,
          }));
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching payment data:", error);
        setLoading(false);
      }
    };

    if (!verificationLoading) {
      fetchData();
    }
  }, [user, navigate, isVerifiedHost, verificationLoading]);

  const handleSaveBankDetails = async () => {
    if (!bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.bankName) {
      toast({ 
        title: "Error", 
        description: "Please fill in all details", 
        variant: "destructive" 
      });
      return;
    }
    
    setProcessing(true);
    try {
      const { data: existing } = await supabase
        .from("bank_details")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
        
      if (existing) {
        await supabase.from("bank_details").update({
          account_holder_name: bankDetails.accountName,
          bank_name: bankDetails.bankName,
          account_number: bankDetails.accountNumber,
          verification_status: "pending",
          rejection_reason: null,
          last_updated: new Date().toISOString(),
        }).eq("user_id", user?.id);
      } else {
        await supabase.from("bank_details").insert({
          user_id: user?.id,
          account_holder_name: bankDetails.accountName,
          bank_name: bankDetails.bankName,
          account_number: bankDetails.accountNumber,
          verification_status: "pending",
        });
      }
      
      setBankVerificationStatus("pending");
      setIsEditing(false);
      setCanEdit(false);
      toast({ 
        title: "Submitted", 
        description: "Details sent for verification" 
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        variant: "destructive" 
      });
    } finally { 
      setProcessing(false); 
    }
  };

  const handleWithdrawalSuccess = () => {
    setLoading(true);
    window.location.reload();
  };

  const getBankStatusBadge = () => {
    const base = "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2";
    switch (bankVerificationStatus) {
      case "verified": 
        return <div className={`${base} bg-green-100 text-green-700`}>
          <CheckCircle className="h-3 w-3" /> Verified
        </div>;
      case "pending": 
        return <div className={`${base} bg-yellow-100 text-yellow-700`}>
          <Clock className="h-3 w-3" /> Pending
        </div>;
      case "rejected": 
        return <div className={`${base} bg-red-100 text-red-700`}>
          <XCircle className="h-3 w-3" /> Action Required
        </div>;
      default: 
        return null;
    }
  };

  if (loading || verificationLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
        <div className="flex items-center gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-3.5 h-3.5 rounded-full bg-primary animate-[teal-pulse_1.4s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Loading details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col pb-24">
      <Header />

      <main className="flex-1 container px-4 max-w-6xl mx-auto py-8">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-6 mb-10">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="w-fit rounded-full bg-white shadow-sm border border-slate-100 hover:bg-slate-50 px-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" style={{ color: COLORS.TEAL }} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              Back to Account
            </span>
          </Button>

          <div className="space-y-2">
            <Badge 
              variant="secondary" 
              className="bg-[#FF7F50]/10 text-[#FF7F50] border-none px-4 py-1 uppercase font-black tracking-widest text-[10px] rounded-full"
            >
              Earnings & Payouts
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none text-slate-900">
              Payment <span style={{ color: COLORS.TEAL }}>Dashboard</span>
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              Manage your earnings and withdrawal methods
            </p>
          </div>
        </div>

        {/* Withdrawable Balance Card */}
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#008080]/5 rounded-full -mr-16 -mt-16" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div 
                className="p-4 rounded-2xl"
                style={{ backgroundColor: `${COLORS.RED}15` }}
              >
                <Wallet className="h-8 w-8" style={{ color: COLORS.RED }} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                  Available Balance
                </p>
                <span className="text-4xl font-black" style={{ color: COLORS.RED }}>
                  KES {stats.withdrawableBalance.toLocaleString()}
                </span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Ready to withdraw
                </p>
              </div>
            </div>
            
            <Button
              onClick={() => setShowWithdrawDialog(true)}
              disabled={stats.withdrawableBalance <= 0}
              className="rounded-2xl px-8 py-6 h-auto font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95"
              style={{ 
                background: stats.withdrawableBalance > 0
                  ? `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`
                  : '#cbd5e1',
                boxShadow: stats.withdrawableBalance > 0 
                  ? `0 12px 24px -8px ${COLORS.CORAL}88` 
                  : 'none'
              }}
            >
              Withdraw Funds
            </Button>
          </div>
        </div>

        {/* Bank Details Section */}
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>
                Bank Details
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                For secure withdrawals
              </p>
            </div>
            {getBankStatusBadge()}
          </div>

          {rejectionReason && bankVerificationStatus === "rejected" && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl mb-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                  Rejection Reason
                </p>
                <p className="text-sm font-medium text-red-700">{rejectionReason}</p>
              </div>
            </div>
          )}

          {!isEditing && bankVerificationStatus ? (
            <div className="space-y-4">
              <DetailRow icon={<Building2 />} label="Bank" value={bankDetails.bankName} />
              <DetailRow icon={<UserCircle />} label="Account Holder" value={bankDetails.accountName} />
              <DetailRow icon={<CreditCard />} label="Account Number" value={bankDetails.accountNumber} />
              {canEdit && (
                <Button 
                  onClick={() => setIsEditing(true)} 
                  variant="outline" 
                  className="w-full mt-4 rounded-2xl border-slate-200 text-[11px] font-black uppercase tracking-widest h-12"
                >
                  Update Payout Info
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Select Bank
                </Label>
                <Select 
                  value={bankDetails.bankName} 
                  onValueChange={(v) => setBankDetails({ ...bankDetails, bankName: v })}
                >
                  <SelectTrigger className="rounded-2xl h-12 border-slate-200 focus:ring-[#008080]">
                    <SelectValue placeholder="Choose your bank" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {POPULAR_BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Account Holder
                </Label>
                <Input 
                  value={bankDetails.accountName} 
                  onChange={(e) => setBankDetails({ ...bankDetails, accountName: e.target.value })} 
                  className="rounded-2xl h-12 border-slate-200" 
                  placeholder="Full Legal Name" 
                />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Account Number
                </Label>
                <Input 
                  value={bankDetails.accountNumber} 
                  onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })} 
                  className="rounded-2xl h-12 border-slate-200" 
                  placeholder="10-12 Digit Number" 
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSaveBankDetails}
                  disabled={processing}
                  className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-white shadow-lg shadow-[#008080]/20"
                  style={{ backgroundColor: COLORS.TEAL }}
                >
                  {processing ? "Saving..." : "Verify Details"}
                </Button>
                {bankVerificationStatus && (
                  <Button 
                    onClick={() => setIsEditing(false)} 
                    variant="ghost" 
                    className="h-14 rounded-2xl font-black uppercase tracking-widest text-slate-400"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Referral Stats - Only show if verified host */}
        {isVerifiedHost && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">
                Referral <span style={{ color: COLORS.CORAL }}>Earnings</span>
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Track your referral program performance
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {/* Booking Commissions */}
              <StatCard 
                icon={<TrendingUp className="h-6 w-6" />}
                label="From Bookings"
                value={`KES ${stats.bookingEarnings.toLocaleString()}`}
                subLabel="Booking Commission Earnings"
                color={COLORS.CORAL}
                isCash
              />

              {/* Service Fee Rate Info */}
              <StatCard 
                icon={<Percent className="h-6 w-6" />}
                label="Commission Rate"
                value={`${stats.avgServiceFeeRate}%`}
                subLabel="Of Service Fee Earned"
                color={COLORS.KHAKI_DARK}
              />

              {/* Total Referred */}
              <StatCard 
                icon={<Award className="h-6 w-6" />}
                label="Community Size"
                value={stats.totalReferred}
                subLabel="Unique Referrals"
                color={COLORS.TEAL}
              />

              {/* Total Bookings */}
              <StatCard 
                icon={<DollarSign className="h-6 w-6" />}
                label="Total Bookings"
                value={stats.totalBookings}
                subLabel="Converted Referrals"
                color={COLORS.CORAL}
              />

              {/* Total Commission Earned */}
              <StatCard 
                icon={<Wallet className="h-6 w-6" />}
                label="Total Earned"
                value={`KES ${stats.totalCommission.toLocaleString()}`}
                subLabel="Lifetime Earnings"
                color={COLORS.TEAL}
                isCash
              />
            </div>
          </>
        )}
      </main>

      {/* Withdrawal Dialog */}
      <WithdrawalDialog
        open={showWithdrawDialog}
        onOpenChange={setShowWithdrawDialog}
        availableBalance={stats.withdrawableBalance}
        userId={user?.id || ""}
        onSuccess={handleWithdrawalSuccess}
      />

      <Footer />
      <MobileBottomBar />
    </div>
  );
}

// Sub-components
const StatCard = ({ icon, label, value, subLabel, color, isCash = false }: any) => (
  <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
    <div className="flex justify-between items-start mb-6">
      <div 
        className="p-3 rounded-2xl shadow-inner"
        style={{ backgroundColor: `${color}15`, color: color }}
      >
        {icon}
      </div>
      <div className="bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active</span>
      </div>
    </div>
    
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span 
          className="text-3xl font-black tracking-tighter" 
          style={{ color: isCash ? COLORS.RED : "#1e293b" }}
        >
          {value}
        </span>
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {subLabel}
      </p>
    </div>
  </div>
);
const DetailRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-xl bg-white shadow-sm text-[#008080]">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        <span className="text-sm font-bold text-slate-700">{value}</span>
      </div>
    </div>
  </div>
);

const Badge = ({ children, className, variant, style }: any) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`} style={style}>
    {children}
  </span>
);