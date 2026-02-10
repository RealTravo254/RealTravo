import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingDownloadButton } from "@/components/booking/BookingDownloadButton";
import { BookingPDFData } from "@/lib/pdfBookingExport";

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
  const [bookingPDFData, setBookingPDFData] = useState<BookingPDFData | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const reference = searchParams.get('reference') || searchParams.get('trxref');
      
      if (!reference) {
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
          
          // Prepare booking PDF data for download
          if (data.data.bookingId) {
            const pdfData: BookingPDFData = {
              bookingId: data.data.bookingId,
              guestName: data.data.guestName || 'Guest',
              guestEmail: data.data.guestEmail || '',
              guestPhone: data.data.guestPhone,
              itemName: data.data.itemName || 'Booking',
              bookingType: data.data.bookingType || 'booking',
              visitDate: data.data.visitDate || new Date().toISOString(),
              totalAmount: data.data.amount || 0,
              adults: data.data.adults,
              children: data.data.children,
              slotsBooked: data.data.slotsBooked,
              paymentStatus: 'completed',
              facilities: data.data.facilities,
              activities: data.data.activities,
            };
            setBookingPDFData(pdfData);
          }
          
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
    navigate(-2);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="flex items-center justify-center gap-3 mb-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-3.5 h-3.5 rounded-full bg-primary animate-[teal-pulse_1.4s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
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
              {/* Download Booking Button - Important for guests */}
              {bookingPDFData && (
                <BookingDownloadButton 
                  booking={bookingPDFData}
                  variant="default"
                  size="lg"
                  className="w-full h-12 rounded-2xl font-black uppercase tracking-widest"
                />
              )}
              
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
