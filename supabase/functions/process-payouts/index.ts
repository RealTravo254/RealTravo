import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Paystack bank codes for Kenya
const BANK_CODES: Record<string, string> = {
  'equity': '070',
  'equity bank': '070',
  'kcb': '062',
  'kcb bank': '062',
  'cooperative': '078',
  'cooperative bank': '078',
  'coop bank': '078',
  'absa': '076',
  'absa bank': '076',
  'stanbic': '072',
  'stanbic bank': '072',
  'dtb': '076',
  'diamond trust': '076',
  'ncba': '069',
  'ncba bank': '069',
  'family bank': '050',
  'im bank': '067',
  'im bank limited': '067',
  'standard chartered': '074',
  'mpesa': '063', // M-Pesa paybill
};

function getBankCode(bankName: string): string {
  const normalized = bankName.toLowerCase().trim();
  return BANK_CODES[normalized] || normalized;
}

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

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Process scheduled payouts (48h before booking)
    if (action === 'process_scheduled' || !action) {
      const now = new Date().toISOString();
      
      // Get all scheduled payouts that are due
      const { data: duePayout, error: payoutError } = await supabase
        .from('payouts')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_for', now)
        .limit(50);

      if (payoutError) {
        throw new Error(`Error fetching payouts: ${payoutError.message}`);
      }

      console.log(`Found ${duePayout?.length || 0} payouts to process`);

      const results = [];

      for (const payout of duePayout || []) {
        try {
          // Create transfer recipient in Paystack
          const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "mobile_money",
              name: payout.account_name,
              account_number: payout.account_number,
              bank_code: getBankCode(payout.bank_code),
              currency: "KES",
            }),
          });

          const recipientData = await recipientResponse.json();

          if (!recipientData.status) {
            console.error("Failed to create recipient:", recipientData);
            await supabase.from('payouts').update({
              status: 'failed',
              failure_reason: recipientData.message || 'Failed to create transfer recipient',
            }).eq('id', payout.id);
            continue;
          }

          const recipientCode = recipientData.data.recipient_code;

          // Store recipient code for future use
          await supabase.from('transfer_recipients').upsert({
            user_id: payout.recipient_id,
            recipient_code: recipientCode,
            account_name: payout.account_name,
            account_number: payout.account_number,
            bank_code: getBankCode(payout.bank_code),
            bank_name: payout.bank_code,
          }, { onConflict: 'user_id' });

          // Initiate transfer
          const transferResponse = await fetch("https://api.paystack.co/transfer", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              source: "balance",
              amount: Math.round(payout.amount * 100), // Convert to cents
              recipient: recipientCode,
              reason: `Payout for booking ${payout.booking_id}`,
              reference: `PAY_OUT_${payout.id}_${Date.now()}`,
            }),
          });

          const transferData = await transferResponse.json();

          if (!transferData.status) {
            console.error("Failed to initiate transfer:", transferData);
            await supabase.from('payouts').update({
              status: 'failed',
              failure_reason: transferData.message || 'Failed to initiate transfer',
            }).eq('id', payout.id);
            continue;
          }

          // Update payout status
          await supabase.from('payouts').update({
            status: 'processing',
            transfer_code: transferData.data.transfer_code,
            reference: transferData.data.reference,
          }).eq('id', payout.id);

          // Update booking payout status
          if (payout.booking_id) {
            await supabase.from('bookings').update({
              payout_status: 'processing',
              payout_reference: transferData.data.reference,
            }).eq('id', payout.booking_id);
          }

          results.push({
            payout_id: payout.id,
            status: 'processing',
            transfer_code: transferData.data.transfer_code,
          });

          console.log(`Payout ${payout.id} initiated successfully`);

        } catch (error: any) {
          console.error(`Error processing payout ${payout.id}:`, error);
          await supabase.from('payouts').update({
            status: 'failed',
            failure_reason: error.message,
          }).eq('id', payout.id);
        }
      }

      return new Response(
        JSON.stringify({ success: true, processed: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Manual withdrawal request with M-Pesa or Bank
    if (action === 'withdraw') {
      const { user_id, amount, payout_type, payment_method, mpesa_number, bank_code, account_number, account_name } = body;

      if (!user_id || !amount) {
        throw new Error("user_id and amount are required");
      }

      if (!payment_method || !['mpesa', 'bank'].includes(payment_method)) {
        throw new Error("payment_method must be 'mpesa' or 'bank'");
      }

      // Validate payment details based on method
      if (payment_method === 'mpesa' && !mpesa_number) {
        throw new Error("M-Pesa phone number is required");
      }

      if (payment_method === 'bank' && (!bank_code || !account_number || !account_name)) {
        throw new Error("Bank code, account number, and account name are required");
      }

      // Check available balance based on payout type
      let availableBalance = 0;

      if (payout_type === 'commission') {
        // Check referral commission balance
        const { data: commissions } = await supabase
          .from('referral_commissions')
          .select('commission_amount')
          .eq('referrer_id', user_id)
          .eq('status', 'paid')
          .is('withdrawn_at', null);

        availableBalance = (commissions || []).reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0);
      } else if (payout_type === 'host') {
        // Check host earnings balance
        const { data: bookings } = await supabase
          .from('bookings')
          .select('host_payout_amount, item_id')
          .eq('payout_status', 'ready')
          .gt('host_payout_amount', 0);

        for (const booking of bookings || []) {
          const { data: trips } = await supabase.from('trips').select('id').eq('id', booking.item_id).eq('created_by', user_id);
          const { data: hotels } = await supabase.from('hotels').select('id').eq('id', booking.item_id).eq('created_by', user_id);
          const { data: adventures } = await supabase.from('adventure_places').select('id').eq('id', booking.item_id).eq('created_by', user_id);
          
          if ((trips && trips.length > 0) || (hotels && hotels.length > 0) || (adventures && adventures.length > 0)) {
            availableBalance += Number(booking.host_payout_amount);
          }
        }
      } else if (payout_type === 'combined') {
        // Combined: host earnings (gross - service fee) + referral commissions
        // 1. Calculate net host earnings
        const { data: allBookings } = await supabase
          .from('bookings')
          .select('total_amount, item_id, booking_type, payment_status, service_fee_amount, referral_tracking_id')
          .eq('payment_status', 'completed');

        const { data: settings } = await supabase
          .from('referral_settings')
          .select('*')
          .single();

        let netHostEarnings = 0;
        for (const b of allBookings || []) {
          const tables: Record<string, string> = { trip: 'trips', event: 'trips', hotel: 'hotels', adventure: 'adventure_places', adventure_place: 'adventure_places' };
          const tbl = tables[b.booking_type];
          if (!tbl) continue;
          const { data: item } = await supabase.from(tbl).select('created_by').eq('id', b.item_id).single();
          if (item?.created_by === user_id) {
            const amt = Number(b.total_amount);
            let sfRate = 20.0;
            if (settings) {
              if (b.booking_type === 'trip' || b.booking_type === 'event') sfRate = Number(settings.trip_service_fee);
              else if (b.booking_type === 'hotel') sfRate = Number(settings.hotel_service_fee);
              else if (b.booking_type === 'adventure' || b.booking_type === 'adventure_place') sfRate = Number(settings.adventure_place_service_fee);
            }
            netHostEarnings += amt - (amt * sfRate / 100);
          }
        }

        // 2. Referral commissions
        const { data: commissions } = await supabase
          .from('referral_commissions')
          .select('commission_amount')
          .eq('referrer_id', user_id)
          .eq('status', 'paid')
          .is('withdrawn_at', null);
        const refBalance = (commissions || []).reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0);

        availableBalance = netHostEarnings + refBalance;
      }

      if (amount > availableBalance) {
        throw new Error(`Insufficient balance. Available: KES ${availableBalance.toFixed(2)}`);
      }

      // Determine account details based on payment method
      const payoutAccountNumber = payment_method === 'mpesa' ? mpesa_number : account_number;
      const payoutAccountName = payment_method === 'mpesa' ? 'M-Pesa Withdrawal' : account_name;
      const payoutBankCode = payment_method === 'mpesa' ? '063' : getBankCode(bank_code);

      // Create payout record
      const { data: payout, error: payoutError } = await supabase
        .from('payouts')
        .insert({
          recipient_id: user_id,
          recipient_type: payout_type,
          amount: amount,
          status: 'pending',
          bank_code: payment_method === 'mpesa' ? 'mpesa' : bank_code,
          account_number: payoutAccountNumber,
          account_name: payoutAccountName,
          scheduled_for: new Date().toISOString(),
        })
        .select()
        .single();

      if (payoutError) {
        throw new Error(`Error creating payout: ${payoutError.message}`);
      }

      // Process the withdrawal immediately via Paystack
      try {
        // Create transfer recipient
        const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "mobile_money",
            name: payoutAccountName,
            account_number: payoutAccountNumber,
            bank_code: payoutBankCode,
            currency: "KES",
          }),
        });

        const recipientData = await recipientResponse.json();

        if (!recipientData.status) {
          throw new Error(recipientData.message || 'Failed to create transfer recipient');
        }

        // Initiate transfer
        const transferResponse = await fetch("https://api.paystack.co/transfer", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source: "balance",
            amount: Math.round(amount * 100),
            recipient: recipientData.data.recipient_code,
            reason: `${payout_type} withdrawal via ${payment_method}`,
            reference: `WITHDRAW_${payout.id}_${Date.now()}`,
          }),
        });

        const transferData = await transferResponse.json();

        if (!transferData.status) {
          await supabase.from('payouts').update({
            status: 'failed',
            failure_reason: transferData.message,
          }).eq('id', payout.id);
          throw new Error(transferData.message || 'Failed to initiate transfer');
        }

        // Update payout status
        await supabase.from('payouts').update({
          status: 'processing',
          transfer_code: transferData.data.transfer_code,
          reference: transferData.data.reference,
        }).eq('id', payout.id);

        // Mark commissions as withdrawn if applicable
        if (payout_type === 'commission') {
          await supabase
            .from('referral_commissions')
            .update({ 
              withdrawn_at: new Date().toISOString(),
              withdrawal_reference: transferData.data.reference,
            })
            .eq('referrer_id', user_id)
            .eq('status', 'paid')
            .is('withdrawn_at', null);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Withdrawal initiated successfully',
            reference: transferData.data.reference,
            method: payment_method,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } catch (error: any) {
        await supabase.from('payouts').update({
          status: 'failed',
          failure_reason: error.message,
        }).eq('id', payout.id);
        throw error;
      }
    }

    throw new Error("Invalid action");

  } catch (error: any) {
    console.error("Process payouts error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
