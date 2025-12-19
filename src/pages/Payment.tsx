import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Wallet, CheckCircle, Clock, XCircle, AlertCircle, Building2, UserCircle, CreditCard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA",
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
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [bankDetails, setBankDetails] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
  });
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchData = async () => {
      try {
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
          setVerificationStatus(bankData.verification_status);
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

        const { data: bookings } = await supabase
          .from("bookings")
          .select("total_amount, item_id, booking_type, payment_status")
          .eq("payment_status", "completed");

        if (bookings) {
          let total = 0;
          for (const booking of bookings) {
            let isCreator = false;
            const tableMap: any = { trip: "trips", hotel: "hotels", adventure: "adventure_places" };
            const tableName = tableMap[booking.booking_type];
            
            if (tableName) {
              const { data: item } = await supabase.from(tableName as any).select("created_by").eq("id", booking.item_id).single();
              isCreator = (item as any)?.created_by === user.id;
            }

            if (isCreator) total += Number(booking.total_amount);
          }

          const { data: commissions } = await supabase.from("referral_commissions").select("commission_amount").eq("referrer_id", user.id).eq("status", "paid");
          if (commissions) {
            total += commissions.reduce((sum, c) => sum + Number(c.commission_amount), 0);
          }
          setBalance(total);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error:", error);
        setLoading(false);
      }
    };
    fetchData();
  }, [user, navigate]);

  const handleSaveBankDetails = async () => {
    if (!bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.bankName) {
      toast({ title: "Error", description: "Please fill in all details", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      const { data: existing } = await supabase.from("bank_details").select("*").eq("user_id", user?.id).maybeSingle();
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
      setVerificationStatus("pending");
      setIsEditing(false);
      setCanEdit(false);
      toast({ title: "Submitted", description: "Details sent for verification" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally { setProcessing(false); }
  };

  const getStatusBadge = () => {
    const base = "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2";
    switch (verificationStatus) {
      case "verified": return <div className={`${base} bg-green-100 text-green-700`}><CheckCircle className="h-3 w-3" /> Verified</div>;
      case "pending": return <div className={`${base} bg-yellow-100 text-yellow-700`}><Clock className="h-3 w-3" /> Pending</div>;
      case "rejected": return <div className={`${base} bg-red-100 text-red-700`}><XCircle className="h-3 w-3" /> Action Required</div>;
      default: return null;
    }
  };

  if (loading) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <Header />
      <main className="flex-1 container max-w-2xl mx-auto px-4 py-8 pb-32">
        <Button onClick={() => navigate("/account")} variant="ghost" className="mb-8 group hover:bg-transparent p-0 text-slate-400 hover:text-[#008080]">
          <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Account</span>
        </Button>

        <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-8" style={{ color: COLORS.TEAL }}>
          Payout & <br /><span style={{ color: COLORS.CORAL }}>Earnings</span>
        </h1>

        {/* Balance Card */}
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#008080]/5 rounded-full -mr-16 -mt-16" />
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Available Balance</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black" style={{ color: COLORS.RED }}>KSh {balance.toLocaleString()}</span>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">Gross Earnings</span>
            </div>
          </div>
        </div>

        {/* Bank Details Card */}
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Bank Details</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">For secure withdrawals</p>
            </div>
            {getStatusBadge()}
          </div>

          {rejectionReason && verificationStatus === "rejected" && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl mb-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Rejection Reason</p>
                <p className="text-sm font-medium text-red-700">{rejectionReason}</p>
              </div>
            </div>
          )}

          {!isEditing && verificationStatus ? (
            <div className="space-y-4">
              <DetailRow icon={<Building2 />} label="Bank" value={bankDetails.bankName} />
              <DetailRow icon={<UserCircle />} label="Account Holder" value={bankDetails.accountName} />
              <DetailRow icon={<CreditCard />} label="Account Number" value={bankDetails.accountNumber} />
              
              {canEdit && (
                <Button onClick={() => setIsEditing(true)} variant="outline" className="w-full mt-4 rounded-2xl border-slate-200 text-[11px] font-black uppercase tracking-widest h-12">
                  Update Payout Info
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select Bank</Label>
                <Select value={bankDetails.bankName} onValueChange={(v) => setBankDetails({ ...bankDetails, bankName: v })}>
                  <SelectTrigger className="rounded-2xl h-12 border-slate-200 focus:ring-[#008080]">
                    <SelectValue placeholder="Choose your bank" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {POPULAR_BANKS.map((bank) => <SelectItem key={bank} value={bank}>{bank}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Account Holder</Label>
                <Input value={bankDetails.accountName} onChange={(e) => setBankDetails({ ...bankDetails, accountName: e.target.value })} className="rounded-2xl h-12 border-slate-200" placeholder="Full Legal Name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Account Number</Label>
                <Input value={bankDetails.accountNumber} onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })} className="rounded-2xl h-12 border-slate-200" placeholder="10-12 Digit Number" />
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
                {verificationStatus && (
                  <Button onClick={() => setIsEditing(false)} variant="ghost" className="h-14 rounded-2xl font-black uppercase tracking-widest text-slate-400">Cancel</Button>
                )}
              </div>
            </div>
          )}
        </div>

        <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
          <DialogTrigger asChild>
            <Button
              disabled={verificationStatus !== "verified" || balance <= 0}
              className="w-full h-16 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
              style={{ 
                background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
                boxShadow: `0 12px 24px -8px ${COLORS.CORAL}88`
              }}
            >
              Withdraw Funds
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[32px] border-none p-8">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Request Payout</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Funds will be sent to your verified account</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="p-5 bg-slate-50 rounded-[24px] border border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Target Bank</span>
                  <span className="text-xs font-black text-slate-700 uppercase">{bankDetails.bankName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Account</span>
                  <span className="text-xs font-bold text-slate-700">{bankDetails.accountNumber}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Withdrawal Amount</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">KSh</span>
                  <Input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="h-14 pl-14 rounded-2xl border-slate-200 text-lg font-black" placeholder="0.00" />
                </div>
              </div>
              <Button onClick={() => {}} disabled={processing} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-white" style={{ backgroundColor: COLORS.TEAL }}>
                Confirm Withdrawal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}

const DetailRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-xl bg-white shadow-sm text-[#008080]">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        <span className="text-sm font-bold text-slate-700">{value}</span>
      </div>
    </div>
  </div>
);