import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface STKQueryRequest {
  checkoutRequestId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { checkoutRequestId }: STKQueryRequest = await req.json();
    console.log('STK Query request received for:', checkoutRequestId);

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
    console.log('OAuth token obtained for STK Query');

    // Step 2: Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // Step 3: Query STK Push status
    const queryPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    console.log('Querying STK status:', { checkoutRequestId });

    const queryResponse = await fetch(
      'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryPayload),
      }
    );

    const queryData = await queryResponse.json();
    console.log('STK Query response:', queryData);

    // Update database based on query result
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (queryData.ResultCode === '0') {
      // Payment successful
      const { data: pendingPayment, error: updateError } = await supabaseClient
        .from('pending_payments')
        .update({
          payment_status: 'completed',
          result_code: queryData.ResultCode,
          result_desc: queryData.ResultDesc,
          updated_at: new Date().toISOString(),
        })
        .eq('checkout_request_id', checkoutRequestId)
        .select()
        .single();

      if (!updateError && pendingPayment) {
        console.log('Payment status updated to completed');
        
        // Create booking
        const bookingData = pendingPayment.booking_data as any;
        const { data: booking, error: bookingError } = await supabaseClient
          .from('bookings')
          .insert({
            ...bookingData,
            payment_status: 'completed',
          })
          .select()
          .single();

        if (!bookingError && booking) {
          console.log('Booking created:', booking.id);

          // Send confirmation email
          try {
            const emailData = {
              bookingId: booking.id,
              email: bookingData.guest_email || bookingData.emailData?.email,
              guestName: bookingData.guest_name || bookingData.emailData?.guestName,
              bookingType: bookingData.booking_type,
              itemName: bookingData.emailData?.itemName || 'Booking',
              totalAmount: bookingData.total_amount,
              bookingDetails: bookingData.booking_details || {},
              visitDate: bookingData.visit_date,
            };

            await supabaseClient.functions.invoke('send-booking-confirmation', {
              body: emailData,
            });
            console.log('Confirmation email sent');
          } catch (emailError) {
            console.error('Error sending confirmation email:', emailError);
          }
        }
      }
    } else if (queryData.ResultCode !== '1032') {
      // Payment failed (but not pending)
      await supabaseClient
        .from('pending_payments')
        .update({
          payment_status: 'failed',
          result_code: queryData.ResultCode,
          result_desc: queryData.ResultDesc,
          updated_at: new Date().toISOString(),
        })
        .eq('checkout_request_id', checkoutRequestId);
      
      console.log('Payment status updated to failed');
    }

    return new Response(
      JSON.stringify({
        success: true,
        resultCode: queryData.ResultCode,
        resultDesc: queryData.ResultDesc,
        responseDescription: queryData.ResponseDescription,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in mpesa-stk-query function:', error);
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
