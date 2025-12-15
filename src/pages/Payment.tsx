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
import { ArrowLeft, Wallet, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const POPULAR_BANKS = [
  "Access Bank",
  "Equity Bank",
  "KCB Bank",
  "Stanbic Bank",
  "Standard Chartered",
  "Barclays Bank",
  "NCBA Bank",
  "Co-operative Bank",
  "I&M Bank",
  "DTB Bank",
  "Other"
];

// Define the specified Teal color
const TEAL_COLOR = "#008080";
const TEAL_HOVER_COLOR = "#005555"; // A darker shade of teal for hover

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
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
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
          setVerificationStatus(bankData.verification_status);
          setRejectionReason(bankData.rejection_reason);
          setLastUpdated(bankData.last_updated);
          
          // Check if user can edit (once per month)
          if (bankData.last_updated) {
            const lastUpdate = new Date(bankData.last_updated);
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            setCanEdit(lastUpdate < oneMonthAgo || bankData.verification_status === 'rejected');
          }
        } else {
          setIsEditing(true);
        }

        // Calculate balance from approved bookings
        const { data: bookings } = await supabase
          .from("bookings")
          .select("total_amount, item_id, booking_type, payment_status")
          .eq("payment_status", "completed");

        if (bookings) {
          let total = 0;
          for (const booking of bookings) {
            let isCreator = false;
            
            if (booking.booking_type === "trip") {
              const { data: trip } = await supabase
                .from("trips")
                .select("created_by")
                .eq("id", booking.item_id)
                .single();
              isCreator = trip?.created_by === user.id;
            } else if (booking.booking_type === "hotel") {
              const { data: hotel } = await supabase
                .from("hotels")
                .select("created_by")
                .eq("id", booking.item_id)
                .single();
              isCreator = hotel?.created_by === user.id;
            } else if (booking.booking_type === "adventure") {
              const { data: adventure } = await supabase
                .from("adventure_places")
                .select("created_by")
                .eq("id", booking.item_id)
                .single();
              isCreator = adventure?.created_by === user.id;
            } else if (booking.booking_type === "attraction") {
              // Attractions table doesn't exist - skip
              isCreator = false;
            }

            if (isCreator) {
              total += Number(booking.total_amount);
            }
          }

          // Add referral commissions to balance
          const { data: commissions } = await supabase
            .from("referral_commissions")
            .select("commission_amount")
            .eq("referrer_id", user.id)
            .eq("status", "paid");

          if (commissions) {
            const commissionTotal = commissions.reduce(
              (sum, c) => sum + Number(c.commission_amount),
              0
            );
            total += commissionTotal;
          }

          setBalance(total);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching payment data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  const handleSaveBankDetails = async () => {
    if (!bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.bankName) {
      toast({
        title: "Error",
        description: "Please fill in all bank details",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setProcessing(true);
    try {
      // Check if bank details exist
      const { data: existing } = await supabase
        .from("bank_details")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing with pending verification
        const { error } = await supabase
          .from("bank_details")
          .update({
            account_holder_name: bankDetails.accountName,
            bank_name: bankDetails.bankName,
            account_number: bankDetails.accountNumber,
            verification_status: "pending",
            rejection_reason: null,
            last_updated: new Date().toISOString(),
            // Store previous verified details
            previous_account_holder_name: existing.verification_status === 'verified' ? existing.account_holder_name : existing.previous_account_holder_name,
            previous_bank_name: existing.verification_status === 'verified' ? existing.bank_name : existing.previous_bank_name,
            previous_account_number: existing.verification_status === 'verified' ? existing.account_number : existing.previous_account_number,
            previous_verified_at: existing.verification_status === 'verified' ? existing.verified_at : existing.previous_verified_at,
          })
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Insert new bank details
        const { error } = await supabase
          .from("bank_details")
          .insert({
            user_id: user.id,
            account_holder_name: bankDetails.accountName,
            bank_name: bankDetails.bankName,
            account_number: bankDetails.accountNumber,
            verification_status: "pending",
          });

        if (error) throw error;
      }

      setVerificationStatus("pending");
      setIsEditing(false);
      setCanEdit(false);
      toast({
        title: "Success",
        description: "Bank details submitted for verification",
      });
    } catch (error) {
      console.error("Error saving bank details:", error);
      toast({
        title: "Error",
        description: "Failed to save bank details",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (verificationStatus !== "verified") {
      toast({
        title: "Error",
        description: "Please verify your bank details before withdrawing",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (amount > balance) {
      toast({
        title: "Error",
        description: "Insufficient balance",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    // Simulate withdrawal processing
    setTimeout(() => {
      setBalance(balance - amount);
      setWithdrawAmount("");
      setProcessing(false);
      setShowWithdrawDialog(false);
      toast({
        title: "Success",
        description: `Withdrawal of KSh ${amount.toFixed(2)} initiated successfully`,
      });
    }, 1500);
  };

  const getStatusBadge = () => {
    switch (verificationStatus) {
      case "verified":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600">
            <Clock className="h-3 w-3 mr-1" />
            Waiting for Verification
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-48 mb-8" />
          <div className="max-w-2xl mx-auto space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/account")}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Account
          </Button>

          <h1 className="text-3xl font-bold mb-8 text-foreground">My Payment</h1>

          {/* Balance Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Available Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Note: Not changing text-primary here, assuming it's an accent color for text */}
              <p className="text-4xl font-bold text-primary">
                KSh {balance.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          {/* Bank Details Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span>Bank Details (Withdrawal/Payout Only)</span>
                {getStatusBadge()}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                These details are exclusively for withdrawal and payout purposes
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {rejectionReason && verificationStatus === "rejected" && (
                <div className="p-4 bg-destructive/10 border border-destructive rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-semibold text-destructive">Rejection Reason:</p>
                    <p className="text-sm text-destructive/80">{rejectionReason}</p>
                  </div>
                </div>
              )}

              {!isEditing && verificationStatus ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground">Account Name</Label>
                    <p className="font-medium">{bankDetails.accountName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Bank Name</Label>
                    <p className="font-medium">{bankDetails.bankName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Account Number</Label>
                    <p className="font-medium">{bankDetails.accountNumber}</p>
                  </div>
                  
                  {canEdit && (
                    <Button 
                      onClick={() => setIsEditing(true)} 
                      variant="outline" 
                      className="w-full"
                    >
                      Edit Details
                    </Button>
                  )}
                  {!canEdit && verificationStatus === "verified" && (
                    <p className="text-sm text-muted-foreground text-center">
                      You can edit your details once per month
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="bankName">Select Bank</Label>
                    <Select
                      value={bankDetails.bankName}
                      onValueChange={(value) =>
                        setBankDetails({ ...bankDetails, bankName: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_BANKS.map((bank) => (
                          <SelectItem key={bank} value={bank}>
                            {bank}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="accountName">Account Holder Name</Label>
                    <Input
                      id="accountName"
                      value={bankDetails.accountName}
                      onChange={(e) =>
                        setBankDetails({ ...bankDetails, accountName: e.target.value })
                      }
                      placeholder="Enter account holder name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      value={bankDetails.accountNumber}
                      onChange={(e) =>
                        setBankDetails({ ...bankDetails, accountNumber: e.target.value })
                      }
                      placeholder="Enter account number"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSaveBankDetails} 
                      className="flex-1 text-white"
                      disabled={processing}
                      style={{ 
                        backgroundColor: TEAL_COLOR,
                        borderColor: TEAL_COLOR 
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = TEAL_HOVER_COLOR}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = TEAL_COLOR}
                    >
                      {processing ? "Saving..." : "Save Bank Details"}
                    </Button>
                    {!isEditing && (
                      <Button 
                        onClick={() => setIsEditing(false)} 
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Withdrawal Dialog */}
          <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
            <DialogTrigger asChild>
              <Button
                disabled={verificationStatus !== "verified" || balance <= 0}
                className="w-full text-white"
                size="lg"
                style={{ 
                  backgroundColor: TEAL_COLOR,
                  borderColor: TEAL_COLOR 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = TEAL_HOVER_COLOR}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = TEAL_COLOR}
              >
                Withdraw Funds
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Withdraw Funds</DialogTitle>
                <DialogDescription>
                  Enter the amount you want to withdraw to your bank account
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Bank:</span>
                    <span className="font-medium">{bankDetails.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Account:</span>
                    <span className="font-medium">{bankDetails.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Name:</span>
                    <span className="font-medium">{bankDetails.accountName}</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="withdrawAmount">Amount to Withdraw</Label>
                  <Input
                    id="withdrawAmount"
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Available: KSh {balance.toFixed(2)}
                  </p>
                </div>

                <Button
                  onClick={handleWithdraw}
                  disabled={processing}
                  className="w-full text-white"
                  style={{ 
                    backgroundColor: TEAL_COLOR,
                    borderColor: TEAL_COLOR 
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = TEAL_HOVER_COLOR}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = TEAL_COLOR}
                >
                  {processing ? "Processing..." : "Confirm Withdrawal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}