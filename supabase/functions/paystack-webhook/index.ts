import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

serve(async (req) => {
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

    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // Verify webhook signature - MANDATORY
    if (!signature) {
      console.error("Missing webhook signature");
      return new Response(
        JSON.stringify({ error: "Missing signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const hash = createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    if (hash !== signature) {
      console.error("Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = JSON.parse(rawBody);
    console.log("Paystack webhook event:", event.event);

    // Handle transfer events
    if (event.event === "transfer.success") {
      const transfer = event.data;
      const reference = transfer.reference;

      // Update payout status
      const { error } = await supabase
        .from('payouts')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('reference', reference);

      if (error) {
        console.error("Error updating payout:", error);
      } else {
        console.log("Payout completed:", reference);
      }

      // Update booking payout status
      await supabase
        .from('bookings')
        .update({
          payout_status: 'completed',
          payout_processed_at: new Date().toISOString(),
        })
        .eq('payout_reference', reference);

      // Create notification for recipient
      const { data: payout } = await supabase
        .from('payouts')
        .select('recipient_id, amount, recipient_type')
        .eq('reference', reference)
        .single();

      if (payout) {
        await supabase.from('notifications').insert({
          user_id: payout.recipient_id,
          type: 'payout_completed',
          title: 'Payout Successful',
          message: `Your ${payout.recipient_type} payout of KES ${payout.amount.toLocaleString()} has been sent to your bank account.`,
          data: { reference, amount: payout.amount },
        });
      }
    }

    if (event.event === "transfer.failed" || event.event === "transfer.reversed") {
      const transfer = event.data;
      const reference = transfer.reference;

      await supabase
        .from('payouts')
        .update({
          status: 'failed',
          failure_reason: transfer.reason || 'Transfer failed or reversed',
        })
        .eq('reference', reference);

      await supabase
        .from('bookings')
        .update({
          payout_status: 'failed',
        })
        .eq('payout_reference', reference);

      // Notify recipient of failure
      const { data: payout } = await supabase
        .from('payouts')
        .select('recipient_id, amount')
        .eq('reference', reference)
        .single();

      if (payout) {
        await supabase.from('notifications').insert({
          user_id: payout.recipient_id,
          type: 'payout_failed',
          title: 'Payout Failed',
          message: `Your payout of KES ${payout.amount.toLocaleString()} failed. Please check your bank details and try again.`,
          data: { reference, reason: transfer.reason },
        });
      }
    }

    // Handle charge success for payment verification
    if (event.event === "charge.success") {
      const charge = event.data;
      console.log("Charge success webhook received:", charge.reference);
      
      // The main verification is handled by paystack-verify function
      // This is just for redundancy
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Paystack webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
