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
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Wallet } from "lucide-react";

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
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchData = async () => {
      try {
        // Calculate balance from approved bookings
        const { data: bookings } = await supabase
          .from("bookings")
          .select("total_amount, item_id, booking_type, payment_status")
          .eq("payment_status", "completed");

        if (bookings) {
          // Filter bookings for items created by this user
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
              const { data: attraction } = await supabase
                .from("attractions")
                .select("created_by")
                .eq("id", booking.item_id)
                .single();
              isCreator = attraction?.created_by === user.id;
            }

            if (isCreator) {
              total += Number(booking.total_amount);
            }
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

  const handleSaveBankDetails = () => {
    if (!bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.bankName) {
      toast({
        title: "Error",
        description: "Please fill in all bank details",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Bank details saved successfully",
    });
  };

  const handleWithdraw = () => {
    if (!bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.bankName) {
      toast({
        title: "Error",
        description: "Please set your bank details before withdrawing",
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
      toast({
        title: "Success",
        description: `Withdrawal of $${amount.toFixed(2)} initiated successfully`,
      });
    }, 1500);
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
      <main className="flex-1 container mx-auto px-4 py-8">
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
              <p className="text-4xl font-bold text-primary">
                ${balance.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          {/* Bank Details Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  value={bankDetails.accountName}
                  onChange={(e) =>
                    setBankDetails({ ...bankDetails, accountName: e.target.value })
                  }
                  placeholder="Enter account name"
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
              <div>
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={bankDetails.bankName}
                  onChange={(e) =>
                    setBankDetails({ ...bankDetails, bankName: e.target.value })
                  }
                  placeholder="Enter bank name"
                />
              </div>
              <Button onClick={handleSaveBankDetails} className="w-full">
                Save Bank Details
              </Button>
            </CardContent>
          </Card>

          {/* Withdrawal Card */}
          <Card>
            <CardHeader>
              <CardTitle>Withdraw Funds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount to Withdraw</Label>
                <Input
                  id="amount"
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                />
              </div>
              <Button
                onClick={handleWithdraw}
                disabled={processing || balance <= 0}
                className="w-full"
              >
                {processing ? "Processing..." : "Withdraw"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}
