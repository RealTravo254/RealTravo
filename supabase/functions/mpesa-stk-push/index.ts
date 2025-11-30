import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface STKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  bookingData?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, amount, accountReference, transactionDesc, bookingData }: STKPushRequest = await req.json();

    console.log('STK Push request received:', { phoneNumber, amount, accountReference });

    if (!bookingData) {
      throw new Error('Booking data is required');
    }

    const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET');
    const passkey = Deno.env.get('MPESA_PASSKEY');
    const shortcode = Deno.env.get('MPESA_SHORTCODE');

    if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
      throw new Error('M-Pesa credentials not configured');
    }

    // Step 1: Get OAuth token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenResponse = await fetch(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to get OAuth token');
    }

    const { access_token } = await tokenResponse.json();
    console.log('OAuth token obtained successfully');

    // Step 2: Generate timestamp
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    
    // Step 3: Generate password
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // Format phone number (remove leading 0 or +254, ensure starts with 254)
    let formattedPhone = phoneNumber.replace(/\s/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+254')) {
      formattedPhone = formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    // Step 4: Initiate STK Push
    const callbackURL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`;
    console.log('🔗 Callback URL being used:', callbackURL);
    
    const stkPushPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackURL,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    };

    console.log('Initiating STK Push:', { ...stkPushPayload, Password: '[REDACTED]', CallBackURL: callbackURL });

    const stkResponse = await fetch(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stkPushPayload),
      }
    );

    const stkData = await stkResponse.json();
    console.log('STK Push response:', stkData);

    if (!stkResponse.ok || stkData.ResponseCode !== '0') {
      throw new Error(stkData.ResponseDescription || 'STK Push failed');
    }

    // Save pending payment to database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: dbError } = await supabaseClient.from('pending_payments').insert({
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      phone_number: formattedPhone,
      amount: Math.round(amount),
      account_reference: accountReference,
      transaction_desc: transactionDesc,
      booking_data: bookingData,
    });

    if (dbError) {
      console.error('Error saving pending payment:', dbError);
    }

    // Send payment initiation email for guest bookings
    if (bookingData.is_guest_booking && bookingData.guest_email) {
      try {
        await supabaseClient.functions.invoke('send-payment-initiation', {
          body: {
            email: bookingData.guest_email,
            guestName: bookingData.guest_name,
            itemName: bookingData.emailData?.itemName || 'your booking',
            totalAmount: bookingData.total_amount,
            phone: phoneNumber,
          },
        });
        console.log('Payment initiation email sent to guest');
      } catch (emailError) {
        console.error('Error sending payment initiation email:', emailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'STK Push initiated successfully',
        checkoutRequestId: stkData.CheckoutRequestID,
        merchantRequestId: stkData.MerchantRequestID,
        data: {
          MerchantRequestID: stkData.MerchantRequestID,
          CheckoutRequestID: stkData.CheckoutRequestID,
          ResponseCode: stkData.ResponseCode,
          ResponseDescription: stkData.ResponseDescription,
          CustomerMessage: stkData.CustomerMessage,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in mpesa-stk-push function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
