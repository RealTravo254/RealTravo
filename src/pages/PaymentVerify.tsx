import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
};

type VerificationStatus = 'loading' | 'success' | 'failed' | 'error';

const PaymentVerify = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [message, setMessage] = useState('');
  const [bookingDetails, setBookingDetails] = useState<any>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const reference = searchParams.get('reference') || searchParams.get('trxref');
      
      if (!reference) {
        // Try to get reference from session storage
        const storedReference = sessionStorage.getItem('paystack_reference');
        if (storedReference) {
          await processVerification(storedReference);
        } else {
          setStatus('error');
          setMessage('No payment reference found');
        }
        return;
      }

      await processVerification(reference);
    };

    const processVerification = async (reference: string) => {
      try {
        const { data, error } = await supabase.functions.invoke('paystack-verify', {
          body: { reference },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data?.success && data?.data?.isSuccessful) {
          setStatus('success');
          setMessage('Payment successful! Your booking has been confirmed.');
          setBookingDetails(data.data);
          
          // Clear session storage
          sessionStorage.removeItem('paystack_reference');
          sessionStorage.removeItem('paystack_booking_data');
        } else {
          setStatus('failed');
          setMessage(data?.error || 'Payment verification failed');
        }
      } catch (error: any) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage(error.message || 'An error occurred during verification');
      }
    };

    verifyPayment();
  }, [searchParams]);

  const handleGoToBookings = () => {
    navigate('/bookings');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleRetry = () => {
    navigate(-2); // Go back to booking page
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin mx-auto mb-6" style={{ color: COLORS.TEAL }} />
            <h1 className="text-2xl font-black uppercase tracking-tight mb-2" style={{ color: COLORS.TEAL }}>
              Verifying Payment
            </h1>
            <p className="text-slate-500">Please wait while we confirm your payment...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight mb-2" style={{ color: COLORS.TEAL }}>
              Payment Successful!
            </h1>
            <p className="text-slate-500 mb-6">{message}</p>
            
            {bookingDetails && (
              <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-left">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Payment Details</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Reference</span>
                    <span className="text-sm font-bold">{bookingDetails.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Amount</span>
                    <span className="text-sm font-bold">KES {bookingDetails.amount?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Channel</span>
                    <span className="text-sm font-bold capitalize">{bookingDetails.channel}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <Button
                onClick={handleGoToBookings}
                className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-white"
                style={{ backgroundColor: COLORS.TEAL }}
              >
                View My Bookings
              </Button>
              <Button
                onClick={handleGoHome}
                variant="outline"
                className="w-full h-12 rounded-2xl font-black uppercase tracking-widest"
              >
                Back to Home
              </Button>
            </div>
          </>
        )}

        {(status === 'failed' || status === 'error') && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight mb-2" style={{ color: COLORS.CORAL }}>
              Payment {status === 'failed' ? 'Failed' : 'Error'}
            </h1>
            <p className="text-slate-500 mb-6">{message}</p>
            
            <div className="space-y-3">
              <Button
                onClick={handleRetry}
                className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-white"
                style={{ backgroundColor: COLORS.CORAL }}
              >
                Try Again
              </Button>
              <Button
                onClick={handleGoHome}
                variant="outline"
                className="w-full h-12 rounded-2xl font-black uppercase tracking-widest"
              >
                Back to Home
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentVerify;
