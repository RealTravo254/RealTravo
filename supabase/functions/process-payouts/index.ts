// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KENYA_BANK_CODES: Record<string, string> = {
  "kenya commercial bank": "068",
  "kcb": "068",
  "kcb bank": "068",
  "equity bank": "049",
  "equity": "049",
  "co-operative bank of kenya": "011",
  "co-operative bank": "011",
  "cooperative bank": "011",
  "coop bank": "011",
  "absa bank kenya": "003",
  "absa": "003",
  "standard chartered bank kenya": "004",
  "standard chartered": "004",
  "stanbic bank kenya": "031",
  "stanbic": "031",
  "diamond trust bank": "063",
  "dtb": "063",
  "ncba bank": "007",
  "ncba": "007",
  "i&m bank": "057",
  "im bank": "057",
  "family bank": "070",
  "national bank of kenya": "012",
  "national bank": "012",
  "prime bank": "010",
  "bank of africa kenya": "019",
  "bank of africa": "019",
  "citibank": "016",
  "bank of baroda": "006",
  "bank of india": "005",
  "sidian bank": "066",
  "victoria commercial bank": "054",
  "guardian bank": "053",
  "gulf african bank": "072",
  "first community bank": "074",
  "credit bank": "025",
  "consolidated bank": "023",
  "african banking corporation": "035",
  "access bank kenya": "084",
  "access bank": "084",
  "uba kenya": "085",
  "uba": "085",
  "dib bank kenya": "078",
  "sbm bank kenya": "076",
  "sbm bank": "076",
  "mayfair cib bank": "065",
  "mayfair": "065",
  "hfc ltd": "008",
  "hfc": "008",
};

function getBankCode(bankName: string): string {
  if (!bankName) return "";
  const normalized = bankName.toLowerCase().trim();
  // Already a numeric code — return as-is
  if (/^\d+$/.test(normalized)) return bankName.trim();
  return KENYA_BANK_CODES[normalized] || normalized;
}

function formatMpesaNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "254" + cleaned.slice(1);
  else if (cleaned.startsWith("+254")) cleaned = cleaned.slice(1);
  else if (!cleaned.startsWith("254")) cleaned = "254" + cleaned;
  return cleaned;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── SCHEDULED PAYOUTS ────────────────────────────────────────────────────
    if (action === "process_scheduled" || !action) {
      const internalKey = req.headers.get("x-internal-key");
      const expectedKey = Deno.env.get("INTERNAL_CRON_KEY") || supabaseServiceKey;
      if (internalKey !== expectedKey) {
        return new Response(
          JSON.stringify({ error: "Unauthorized - internal endpoint" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const now = new Date().toISOString();
      const { data: duePayout, error: payoutError } = await supabase
        .from("payouts")
        .select("*")
        .eq("status", "scheduled")
        .lte("scheduled_for", now)
        .limit(50);

      if (payoutError) throw new Error(`Error fetching payouts: ${payoutError.message}`);

      const results = [];

      for (const payout of duePayout || []) {
        try {
          const isMpesa = payout.bank_code === "mpesa";
          const recipientPayload = isMpesa
            ? {
                type: "mobile_money",
                name: payout.account_name,
                account_number: formatMpesaNumber(payout.account_number),
                bank_code: "MPESA",
                currency: "KES",
              }
            : {
                type: "nuban",
                name: payout.account_name,
                account_number: payout.account_number,
                bank_code: getBankCode(payout.bank_code),
                currency: "KES",
              };

          const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
            method: "POST",
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify(recipientPayload),
          });
          const recipientData = await recipientResponse.json();

          if (!recipientData.status) {
            await supabase.from("payouts").update({
              status: "failed",
              failure_reason: recipientData.message || "Failed to create transfer recipient",
            }).eq("id", payout.id);
            continue;
          }

          const recipientCode = recipientData.data.recipient_code;

          const transferResponse = await fetch("https://api.paystack.co/transfer", {
            method: "POST",
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "balance",
              amount: Math.round(payout.amount * 100),
              recipient: recipientCode,
              reason: `Payout for booking ${payout.booking_id}`,
              reference: `PAY_OUT_${payout.id}_${Date.now()}`,
            }),
          });
          const transferData = await transferResponse.json();

          if (!transferData.status) {
            await supabase.from("payouts").update({
              status: "failed",
              failure_reason: transferData.message || "Failed to initiate transfer",
            }).eq("id", payout.id);
            continue;
          }

          await supabase.from("payouts").update({
            status: "processing",
            transfer_code: transferData.data.transfer_code,
            reference: transferData.data.reference,
          }).eq("id", payout.id);

          if (payout.booking_id) {
            await supabase.from("bookings").update({
              payout_status: "processing",
              payout_reference: transferData.data.reference,
            }).eq("id", payout.booking_id);
          }

          results.push({ payout_id: payout.id, status: "processing", transfer_code: transferData.data.transfer_code });
        } catch (err: any) {
          console.error(`Error processing payout ${payout.id}:`, err);
          await supabase.from("payouts").update({ status: "failed", failure_reason: err.message }).eq("id", payout.id);
        }
      }

      return new Response(
        JSON.stringify({ success: true, processed: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── MANUAL WITHDRAWAL ────────────────────────────────────────────────────
    if (action === "withdraw") {
      // Verify JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
      if (authError || !user?.id) {
        return new Response(JSON.stringify({ error: "Unauthorized - invalid token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const user_id = user.id;

      // ── Safely extract and coerce all fields — null/undefined both treated as empty ──
      const {
        amount,
        payment_method,
        mpesa_number,
        bank_code,
        account_number,
        account_name,
      } = body;

      const safeMpesa    = mpesa_number   ? String(mpesa_number).trim()   : "";
      const safeBank     = bank_code      ? String(bank_code).trim()      : "";
      const safeAccNum   = account_number ? String(account_number).trim() : "";
      const safeAccName  = account_name   ? String(account_name).trim()   : "";

      // ── Validate inputs ────────────────────────────────────────────────────
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
        throw new Error("A valid amount is required");

      if (!payment_method || !["mpesa", "bank"].includes(payment_method))
        throw new Error("payment_method must be 'mpesa' or 'bank'");

      if (payment_method === "mpesa" && !safeMpesa)
        throw new Error("M-Pesa phone number is required");

      if (payment_method === "bank") {
        if (!safeBank)    throw new Error("Please select a bank");
        if (!safeAccNum)  throw new Error("Account number is required");
        if (!safeAccName) throw new Error("Account holder name is required");
      }

      // ── Calculate available balance ────────────────────────────────────────
      const { data: allBookings } = await supabase
        .from("bookings")
        .select("id, total_amount, item_id, booking_type, payment_status")
        .eq("payment_status", "completed");

      const { data: settings } = await supabase.from("referral_settings").select("*").single();

      let grossHostEarnings = 0;
      let totalServiceFees = 0;

      for (const b of allBookings || []) {
        const tableMap: Record<string, string> = {
          trip: "trips", event: "trips", hotel: "hotels",
          adventure: "adventure_places", adventure_place: "adventure_places",
        };
        const tbl = tableMap[b.booking_type];
        if (!tbl) continue;
        const { data: item } = await supabase.from(tbl).select("created_by").eq("id", b.item_id).single();
        if (item?.created_by !== user_id) continue;

        const amt = Number(b.total_amount);
        grossHostEarnings += amt;

        let sfRate = 20.0;
        if (settings) {
          if (b.booking_type === "trip" || b.booking_type === "event") sfRate = Number(settings.trip_service_fee ?? 20);
          else if (b.booking_type === "hotel") sfRate = Number(settings.hotel_service_fee ?? 20);
          else if (b.booking_type === "adventure" || b.booking_type === "adventure_place") sfRate = Number(settings.adventure_place_service_fee ?? 20);
        }
        totalServiceFees += (amt * sfRate) / 100;
      }

      const netHostEarnings = grossHostEarnings - totalServiceFees;

      const { data: existingPayouts } = await supabase
        .from("payouts")
        .select("amount, status")
        .eq("recipient_id", user_id)
        .in("status", ["pending", "processing", "completed"]);

      const alreadyWithdrawn = (existingPayouts || []).reduce((s: number, p: any) => s + Number(p.amount), 0);

      const { data: commissions } = await supabase
        .from("referral_commissions")
        .select("commission_amount")
        .eq("referrer_id", user_id)
        .eq("status", "paid")
        .is("withdrawn_at", null);

      const refBalance = (commissions || []).reduce((s: number, c: any) => s + Number(c.commission_amount), 0);
      const availableBalance = Math.max(0, netHostEarnings - alreadyWithdrawn + refBalance);
      const requestedAmount = Number(amount);

      if (requestedAmount > availableBalance) {
        throw new Error(
          `Insufficient balance. Available: KES ${availableBalance.toFixed(2)}, Requested: KES ${requestedAmount.toFixed(2)}`
        );
      }

      // ── Build Paystack recipient payload ───────────────────────────────────
      let recipientPayload: Record<string, string>;

      if (payment_method === "mpesa") {
        const formattedPhone = formatMpesaNumber(safeMpesa);
        recipientPayload = {
          type: "mobile_money",
          name: user.email || "M-Pesa Withdrawal",
          account_number: formattedPhone,
          bank_code: "MPESA",
          currency: "KES",
        };
      } else {
        const resolvedCode = getBankCode(safeBank);
        if (!resolvedCode || !/^\d+$/.test(resolvedCode)) {
          throw new Error(
            `Bank "${safeBank}" was not recognised. Please select a valid bank from the list.`
          );
        }
        recipientPayload = {
          type: "nuban",
          name: safeAccName,
          account_number: safeAccNum,
          bank_code: resolvedCode,
          currency: "KES",
        };
      }

      // ── Insert payout record ───────────────────────────────────────────────
      const { data: payout, error: payoutInsertError } = await supabase
        .from("payouts")
        .insert({
          recipient_id: user_id,
          recipient_type: "combined",
          amount: requestedAmount,
          status: "pending",
          bank_code: payment_method === "mpesa" ? "mpesa" : getBankCode(safeBank),
          account_number: payment_method === "mpesa" ? formatMpesaNumber(safeMpesa) : safeAccNum,
          account_name: payment_method === "mpesa" ? (user.email || "M-Pesa") : safeAccName,
          scheduled_for: new Date().toISOString(),
        })
        .select()
        .single();

      if (payoutInsertError) {
        console.error("Payout insert error:", JSON.stringify(payoutInsertError));
        throw new Error(`Error creating payout record: ${payoutInsertError.message}`);
      }

      // ── Create Paystack transfer recipient ─────────────────────────────────
      const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(recipientPayload),
      });
      const recipientData = await recipientResponse.json();

      if (!recipientData.status) {
        await supabase.from("payouts").update({
          status: "failed",
          failure_reason: recipientData.message || "Paystack rejected the recipient details",
        }).eq("id", payout.id);
        throw new Error(
          recipientData.message || "Failed to create transfer recipient. Please check your payment details and try again."
        );
      }

      const recipientCode = recipientData.data.recipient_code;

      // ── Initiate transfer ──────────────────────────────────────────────────
      const transferResponse = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "balance",
          amount: Math.round(requestedAmount * 100),
          recipient: recipientCode,
          reason: `Withdrawal via ${payment_method === "mpesa" ? "M-Pesa" : "Bank Transfer"}`,
          reference: `WITHDRAW_${payout.id}_${Date.now()}`,
        }),
      });
      const transferData = await transferResponse.json();

      if (!transferData.status) {
        await supabase.from("payouts").update({
          status: "failed",
          failure_reason: transferData.message || "Transfer initiation failed",
        }).eq("id", payout.id);
        throw new Error(transferData.message || "Failed to initiate transfer. Please try again.");
      }

      // ── Update payout to processing ────────────────────────────────────────
      await supabase.from("payouts").update({
        status: "processing",
        transfer_code: transferData.data.transfer_code,
        reference: transferData.data.reference,
      }).eq("id", payout.id);

      // ── Mark referral commissions as withdrawn ─────────────────────────────
      if (refBalance > 0) {
        await supabase
          .from("referral_commissions")
          .update({
            withdrawn_at: new Date().toISOString(),
            withdrawal_reference: transferData.data.reference,
          })
          .eq("referrer_id", user_id)
          .eq("status", "paid")
          .is("withdrawn_at", null);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Withdrawal of KES ${requestedAmount.toLocaleString()} initiated successfully via ${payment_method === "mpesa" ? "M-Pesa" : "Bank Transfer"}.`,
          reference: transferData.data.reference,
          method: payment_method,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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