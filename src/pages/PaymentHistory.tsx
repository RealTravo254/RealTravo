import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Receipt, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Payment {
  id: string;
  checkout_request_id: string;
  phone_number: string;
  amount: number;
  account_reference: string;
  transaction_desc: string;
  payment_status: string;
  mpesa_receipt_number: string | null;
  result_desc: string | null;
  created_at: string;
  updated_at: string;
  booking_data: any;
}

export default function PaymentHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [retryingPayment, setRetryingPayment] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showRetryDialog, setShowRetryDialog] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    fetchPayments();

    // Set up realtime subscription for payment updates
    const channel = supabase
      .channel('payment-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Payment update received:', payload);
          fetchPayments(); // Refresh payments when any update occurs
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const fetchPayments = async () => {
    try {
      // Fetch payments by user_id directly
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPayments((data as unknown as Payment[]) || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching payments:", error);
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const handleRetryPayment = async (payment: Payment) => {
    if (!payment.booking_data) {
      toast({
        title: "Cannot retry",
        description: "Booking data not found for this payment",
        variant: "destructive",
      });
      return;
    }

    setRetryingPayment(payment.id);

    try {
      // Reinitiate M-Pesa STK Push
      const { data: mpesaResponse, error: mpesaError } = await supabase.functions.invoke("mpesa-stk-push", {
        body: {
          phoneNumber: payment.phone_number,
          amount: payment.amount,
          accountReference: payment.account_reference,
          transactionDesc: payment.transaction_desc || "Booking payment",
          bookingData: payment.booking_data,
        },
      });

      if (mpesaError || !mpesaResponse?.success) {
        throw new Error(mpesaResponse?.error || "Failed to initiate payment");
      }

      toast({
        title: "Payment initiated",
        description: "Please check your phone to complete the M-Pesa payment",
      });

      // Refresh payments after a short delay
      setTimeout(() => {
        fetchPayments();
      }, 2000);
    } catch (error: any) {
      console.error("Retry payment error:", error);
      toast({
        title: "Retry failed",
        description: error.message || "Failed to retry payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRetryingPayment(null);
      setShowRetryDialog(false);
      setSelectedPayment(null);
    }
  };

  const openRetryDialog = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowRetryDialog(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-48 mb-8" />
          <div className="max-w-4xl mx-auto space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
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
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <h1 className="text-3xl font-bold mb-2 text-foreground">Payment History</h1>
          <p className="text-muted-foreground mb-8">View your M-Pesa transaction history</p>

          {payments.length === 0 ? (
            <Card className="p-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No payment history found</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your M-Pesa transactions will appear here
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => (
                <Card key={payment.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg text-foreground">
                          {payment.transaction_desc || payment.account_reference}
                        </h3>
                        {getStatusBadge(payment.payment_status)}
                      </div>
                      
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium">Amount:</span> KSh {payment.amount.toLocaleString()}
                        </p>
                        <p>
                          <span className="font-medium">Phone:</span> +{payment.phone_number}
                        </p>
                        {payment.mpesa_receipt_number && (
                          <p className="flex items-center gap-1">
                            <Receipt className="h-4 w-4" />
                            <span className="font-medium">Receipt:</span> {payment.mpesa_receipt_number}
                          </p>
                        )}
                        {payment.result_desc && payment.payment_status !== "pending" && (
                          <p className="text-xs mt-2">
                            <span className="font-medium">Details:</span> {payment.result_desc}
                          </p>
                        )}
                      </div>
                    </div>

                     <div className="text-right flex flex-col items-end gap-2">
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(payment.created_at), { addSuffix: true })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </p>
                      
                      {payment.payment_status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRetryDialog(payment)}
                          disabled={retryingPayment === payment.id}
                          className="mt-2"
                        >
                          {retryingPayment === payment.id ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Retrying...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Retry Payment
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Retry Payment Confirmation Dialog */}
      <AlertDialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will initiate a new M-Pesa payment request for{" "}
              <span className="font-semibold">KSh {selectedPayment?.amount.toLocaleString()}</span> to phone number{" "}
              <span className="font-semibold">+{selectedPayment?.phone_number}</span>.
              <br />
              <br />
              Please ensure your phone is ready to receive the STK push notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedPayment && handleRetryPayment(selectedPayment)}
              disabled={retryingPayment !== null}
            >
              {retryingPayment ? "Processing..." : "Confirm Retry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
      <MobileBottomBar />
    </div>
  );
}
