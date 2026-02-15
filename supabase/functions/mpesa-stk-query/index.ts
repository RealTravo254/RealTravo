import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    
    if (!checkoutRequestId || typeof checkoutRequestId !== 'string' || checkoutRequestId.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid checkoutRequestId' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

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
      { headers: { 'Authorization': `Basic ${auth}` } }
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to get OAuth token');
    }

    const { access_token } = await tokenResponse.json();

    // Step 2: Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // Step 3: Query STK Push status
    const queryResponse = await fetch(
      'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        }),
      }
    );

    const queryData = await queryResponse.json();
    console.log('STK Query response:', queryData);

    // Check if it's a rate limit error
    if (queryData.fault?.detail?.errorcode === 'policies.ratelimit.SpikeArrestViolation') {
      return new Response(
        JSON.stringify({
          success: false,
          resultCode: 'RATE_LIMIT',
          resultDesc: 'Rate limit exceeded, please try again in a moment',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // Update payments table directly instead of deleted mpesa_callback_log
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resultCode = queryData.ResultCode?.toString() || '1032';
    const paymentStatus = resultCode === '0' ? 'completed' : (resultCode === '1032' ? 'pending' : 'failed');

    const { error: updateError } = await supabaseClient
      .from('payments')
      .update({
        payment_status: paymentStatus,
        result_code: resultCode,
        result_desc: queryData.ResultDesc || 'STK query result',
        updated_at: new Date().toISOString(),
      })
      .eq('checkout_request_id', checkoutRequestId);

    if (updateError) {
      console.error('Error updating payment from STK query:', updateError);
    } else {
      console.log(`Payment updated to ${paymentStatus} for ${checkoutRequestId}`);
    }

    // If payment completed, also update the booking
    if (paymentStatus === 'completed') {
      const { data: payment } = await supabaseClient
        .from('payments')
        .select('booking_data')
        .eq('checkout_request_id', checkoutRequestId)
        .single();

      if (payment?.booking_data?.booking_id) {
        await supabaseClient
          .from('bookings')
          .update({
            payment_status: 'completed',
            status: 'confirmed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.booking_data.booking_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        resultCode: queryData.ResultCode,
        resultDesc: queryData.ResultDesc,
        responseDescription: queryData.ResponseDescription,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in mpesa-stk-query function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred while querying payment status' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
