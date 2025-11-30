import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Log ALL incoming requests for debugging
  console.log('=== MPESA CALLBACK ENDPOINT HIT ===');
  console.log('Request Method:', req.method);
  console.log('Request Headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));
  console.log('Request URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request - returning CORS headers');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    console.log('Raw Request Body:', rawBody);
    
    const callbackData = JSON.parse(rawBody);
    console.log('M-Pesa Callback Parsed Data:', JSON.stringify(callbackData, null, 2));

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { Body } = callbackData;
    const { stkCallback } = Body;

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const merchantRequestId = stkCallback.MerchantRequestID;
    const resultCode = stkCallback.ResultCode.toString();
    const resultDesc = stkCallback.ResultDesc;

    // Insert into callback log - trigger will handle everything else
    const { error: logError } = await supabaseClient
      .from('mpesa_callback_log')
      .insert({
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId,
        result_code: resultCode,
        result_desc: resultDesc,
        raw_payload: callbackData,
      });

    if (logError) {
      console.error('Error inserting callback log:', logError);
      return new Response(JSON.stringify({ success: false, error: logError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Callback logged successfully - trigger will process reconciliation');
    console.log('CheckoutRequestID:', checkoutRequestId, 'ResultCode:', resultCode);

    return new Response(JSON.stringify({ 
      ResultCode: 0,
      ResultDesc: 'Accepted'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('❌ M-Pesa callback error:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    
    // Still return success to M-Pesa to prevent retries
    return new Response(JSON.stringify({ 
      ResultCode: 0,
      ResultDesc: 'Accepted'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
