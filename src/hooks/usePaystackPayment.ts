import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PaystackPaymentOptions {
  onSuccess?: (reference: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

interface BookingData {
  item_id: string;
  booking_type: string;
  total_amount: number;
  booking_details: Record<string, any>;
  user_id?: string | null;
  is_guest_booking: boolean;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  visit_date: string;
  slots_booked: number;
  host_id?: string;
  emailData?: {
    itemName: string;
  };
}

export const usePaystackPayment = (options: PaystackPaymentOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initiatePayment = useCallback(async (
    email: string,
    amount: number,
    bookingData: BookingData
  ) => {
    setIsLoading(true);
    setPaymentStatus('pending');
    setErrorMessage(null);

    try {
      // Get the current origin for callback URL
      const callbackUrl = `${window.location.origin}/payment/verify`;

      const { data, error } = await supabase.functions.invoke('paystack-initialize', {
        body: {
          email,
          amount,
          bookingData,
          callbackUrl,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to initialize payment');
      }

      // Redirect to Paystack checkout
      if (data.data?.authorization_url) {
        // Store reference in session for verification
        sessionStorage.setItem('paystack_reference', data.data.reference);
        sessionStorage.setItem('paystack_booking_data', JSON.stringify(bookingData));
        
        // Redirect to Paystack
        window.location.href = data.data.authorization_url;
      } else {
        throw new Error('No authorization URL received');
      }

    } catch (error: any) {
      console.error('Paystack payment error:', error);
      setPaymentStatus('error');
      setErrorMessage(error.message);
      options.onError?.(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const verifyPayment = useCallback(async (reference: string) => {
    setIsLoading(true);
    setPaymentStatus('pending');

    try {
      const { data, error } = await supabase.functions.invoke('paystack-verify', {
        body: { reference },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Verification failed');
      }

      if (data.data?.isSuccessful) {
        setPaymentStatus('success');
        options.onSuccess?.(reference);
        return { success: true, data: data.data };
      } else {
        throw new Error('Payment was not successful');
      }

    } catch (error: any) {
      console.error('Payment verification error:', error);
      setPaymentStatus('error');
      setErrorMessage(error.message);
      options.onError?.(error.message);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const resetPayment = useCallback(() => {
    setPaymentStatus('idle');
    setErrorMessage(null);
    setIsLoading(false);
  }, []);

  return {
    initiatePayment,
    verifyPayment,
    isLoading,
    paymentStatus,
    errorMessage,
    resetPayment,
  };
};
