import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PaymentStatus } from '@/components/booking/PaymentStatusDialog';

interface MpesaPaymentOptions {
  onSuccess?: (bookingId: string) => void;
  onError?: (error: string) => void;
}

interface BookingData {
  item_id: string;
  booking_type: string;
  total_amount: number;
  booking_details: any;
  user_id?: string | null;
  is_guest_booking: boolean;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  visit_date?: string;
  slots_booked?: number;
  payment_method: string;
  payment_phone: string;
  host_id?: string;
  emailData?: {
    itemName: string;
  };
}

interface PaymentRecord {
  id: string;
  payment_status: string;
  result_desc: string | null;
  booking_data: { booking_id?: string } | null;
}

export const useMpesaPayment = (options: MpesaPaymentOptions = {}) => {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);

  // Subscribe to payments table changes
  useEffect(() => {
    if (!checkoutRequestId) return;

    const channel = supabase
      .channel(`payment-${checkoutRequestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `checkout_request_id=eq.${checkoutRequestId}`,
        },
        async (payload) => {
          const payment = payload.new as PaymentRecord;
          console.log('Payment status update:', payment.payment_status);

          if (payment.payment_status === 'completed') {
            setPaymentStatus('success');
            
            if (options.onSuccess) {
              options.onSuccess(payment.booking_data?.booking_id || payment.id);
            }
          } else if (payment.payment_status === 'failed') {
            setPaymentStatus('failed');
            setErrorMessage(payment.result_desc || 'Payment failed');
            if (options.onError) {
              options.onError(payment.result_desc || 'Payment failed');
            }
          }
        }
      )
      .subscribe();

    // Also poll as fallback (M-Pesa callback might be delayed)
    const pollInterval = setInterval(async () => {
      console.log('Polling payment status for:', checkoutRequestId);
      const { data, error } = await supabase
        .from('payments' as any)
        .select('payment_status, result_desc, id, booking_data')
        .eq('checkout_request_id', checkoutRequestId)
        .maybeSingle();

      if (error) {
        console.error('Error polling payment:', error);
        return;
      }

      const payment = data as unknown as PaymentRecord | null;
      console.log('Polled payment data:', payment);
      
      if (payment) {
        if (payment.payment_status === 'completed') {
          console.log('Payment completed! Booking ID:', payment.booking_data?.booking_id);
          clearInterval(pollInterval);
          setPaymentStatus('success');
          if (options.onSuccess) options.onSuccess(payment.booking_data?.booking_id || payment.id);
        } else if (payment.payment_status === 'failed') {
          console.log('Payment failed:', payment.result_desc);
          clearInterval(pollInterval);
          setPaymentStatus('failed');
          setErrorMessage(payment.result_desc || 'Payment failed');
          if (options.onError) options.onError(payment.result_desc || 'Payment failed');
        } else {
          console.log('Payment still pending, status:', payment.payment_status);
        }
      } else {
        console.log('No payment record found for checkout ID');
      }
    }, 3000);

    // Timeout after 60 seconds
    const timeout = setTimeout(async () => {
      clearInterval(pollInterval);
      channel.unsubscribe();
      
      // Update payment and booking as failed due to timeout
      if (checkoutRequestId) {
        await supabase
          .from('payments' as any)
          .update({ 
            payment_status: 'failed', 
            result_desc: 'Payment timed out. User did not complete the transaction within 60 seconds.' 
          })
          .eq('checkout_request_id', checkoutRequestId);

        // Also update the booking status to failed
        const { data } = await supabase
          .from('payments' as any)
          .select('booking_data')
          .eq('checkout_request_id', checkoutRequestId)
          .single();

        const payment = data as { booking_data?: { booking_id?: string } } | null;
        if (payment?.booking_data?.booking_id) {
          await supabase
            .from('bookings')
            .update({ 
              payment_status: 'failed', 
              status: 'cancelled' 
            })
            .eq('id', payment.booking_data.booking_id);
        }
      }
      
      setPaymentStatus('failed');
      setErrorMessage('Payment timed out. Please try again.');
    }, 60000);

    return () => {
      channel.unsubscribe();
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [checkoutRequestId, options.onSuccess, options.onError]);

  const initiatePayment = useCallback(async (
    phoneNumber: string,
    amount: number,
    bookingData: BookingData
  ) => {
    setPaymentStatus('waiting');
    setErrorMessage('');

    try {
      const accountReference = `BK${Date.now()}`;
      
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          phoneNumber,
          amount,
          accountReference,
          transactionDesc: `Payment for ${bookingData.emailData?.itemName || 'booking'}`,
          bookingData: {
            ...bookingData,
            payment_phone: phoneNumber,
          },
        },
      });

      if (error || !data?.success) {
        setPaymentStatus('failed');
        setErrorMessage(data?.error || error?.message || 'Failed to initiate payment');
        return false;
      }

      setCheckoutRequestId(data.checkoutRequestId);
      setPaymentStatus('processing');
      return true;
    } catch (error: any) {
      setPaymentStatus('failed');
      setErrorMessage(error.message || 'Failed to initiate payment');
      return false;
    }
  }, []);

  const resetPayment = useCallback(() => {
    setPaymentStatus('idle');
    setErrorMessage('');
    setCheckoutRequestId(null);
  }, []);

  return {
    paymentStatus,
    errorMessage,
    initiatePayment,
    resetPayment,
    isPaymentInProgress: paymentStatus === 'waiting' || paymentStatus === 'processing',
  };
};