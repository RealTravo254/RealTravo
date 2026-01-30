import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { 
      email, 
      amount, 
      bookingData,
      callbackUrl 
    } = body;

    if (!email || !amount) {
      throw new Error("Email and amount are required");
    }

    // Amount should be in kobo (smallest currency unit) for NGN, but for KES it's already in cents
    // Paystack requires amount in smallest unit
    const amountInCents = Math.round(amount * 100);

    // Generate a unique reference
    const reference = `PAY_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Initialize Paystack transaction
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountInCents,
        reference,
        currency: "KES",
        callback_url: callbackUrl || `${supabaseUrl}/functions/v1/paystack-callback`,
        metadata: {
          booking_data: bookingData,
          custom_fields: [
            {
              display_name: "Booking Type",
              variable_name: "booking_type",
              value: bookingData?.booking_type || "unknown",
            },
            {
              display_name: "Item Name",
              variable_name: "item_name",
              value: bookingData?.emailData?.itemName || "Booking",
            },
          ],
        },
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error("Paystack error:", paystackData);
      throw new Error(paystackData.message || "Failed to initialize payment");
    }

    // Store payment record
    const { error: paymentError } = await supabase.from("payments").insert([{
      checkout_request_id: reference,
      phone_number: email, // Using email for card payments
      amount: amount,
      account_reference: reference,
      payment_status: "pending",
      booking_data: bookingData,
      host_id: bookingData?.host_id || null,
      user_id: bookingData?.user_id || null,
    }]);

    if (paymentError) {
      console.error("Error storing payment:", paymentError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          authorization_url: paystackData.data.authorization_url,
          access_code: paystackData.data.access_code,
          reference: paystackData.data.reference,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Paystack initialize error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
