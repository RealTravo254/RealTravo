// @ts-nocheck
/// <reference lib="deno.window" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const body = await req.json();
    const { reference } = body;

    if (!reference) {
      throw new Error("Reference is required");
    }

    console.log("Verifying payment with reference:", reference);

    // Verify transaction with Paystack
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const verifyData = await verifyResponse.json();

    if (!verifyData.status) {
      throw new Error(verifyData.message || "Verification failed");
    }

    const transaction = verifyData.data;
    const isSuccessful = transaction.status === "success";

    console.log("Paystack verification result:", { status: transaction.status, isSuccessful });

    // Update payment record
    const { data: paymentData, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .eq("checkout_request_id", reference)
      .single();

    if (fetchError) {
      console.error("Error fetching payment:", fetchError);
    }

    if (paymentData) {
      // Update payment status
      await supabase
        .from("payments")
        .update({
          payment_status: isSuccessful ? "completed" : "failed",
          mpesa_receipt_number: transaction.reference,
          result_code: transaction.status,
          result_desc: transaction.gateway_response,
          updated_at: new Date().toISOString(),
        })
        .eq("checkout_request_id", reference);

      const bookingData = paymentData.booking_data as any;
      const pendingBookingId = bookingData?.pending_booking_id;

      if (isSuccessful && pendingBookingId) {
        console.log("Updating pending booking to confirmed:", pendingBookingId);

        // Get referral settings for service fee rates
        const { data: settings } = await supabase
          .from("referral_settings")
          .select("*")
          .single();

        let serviceFeeRate = 20.0;
        if (settings) {
          if (bookingData.booking_type === 'trip') {
            serviceFeeRate = Number(settings.trip_service_fee);
          } else if (bookingData.booking_type === 'event') {
            serviceFeeRate = Number(settings.event_service_fee);
          } else if (bookingData.booking_type === 'hotel') {
            serviceFeeRate = Number(settings.hotel_service_fee);
          } else if (bookingData.booking_type === 'adventure' || bookingData.booking_type === 'adventure_place') {
            serviceFeeRate = Number(settings.adventure_place_service_fee);
          } else if (bookingData.booking_type === 'attraction') {
            serviceFeeRate = Number(settings.attraction_service_fee);
          }
        }

        const totalAmount = Number(bookingData.total_amount);
        const serviceFeeAmount = (totalAmount * serviceFeeRate) / 100;
        const hostPayoutAmount = totalAmount - serviceFeeAmount;

        // Get host ID
        let hostId = null;
        if (bookingData.booking_type === 'trip' || bookingData.booking_type === 'event') {
          const { data: tripData } = await supabase.from('trips').select('created_by').eq('id', bookingData.item_id).single();
          hostId = tripData?.created_by;
        } else if (bookingData.booking_type === 'hotel') {
          const { data: hotelData } = await supabase.from('hotels').select('created_by').eq('id', bookingData.item_id).single();
          hostId = hotelData?.created_by;
        } else if (bookingData.booking_type === 'adventure_place' || bookingData.booking_type === 'adventure') {
          const { data: adventureData } = await supabase.from('adventure_places').select('created_by').eq('id', bookingData.item_id).single();
          hostId = adventureData?.created_by;
        }

        const visitDate = bookingData.visit_date ? new Date(bookingData.visit_date) : null;
        const payoutScheduledAt = visitDate
          ? new Date(visitDate.getTime() - (48 * 60 * 60 * 1000)).toISOString()
          : null;

        // UPDATE existing pending booking to confirmed
        const { data: booking, error: updateError } = await supabase
          .from("bookings")
          .update({
            status: "confirmed",
            payment_status: "completed",
            service_fee_amount: serviceFeeAmount,
            host_payout_amount: hostPayoutAmount,
            payout_status: 'scheduled',
            payout_scheduled_at: payoutScheduledAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pendingBookingId)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating booking:", updateError);
        } else {
          console.log("Booking confirmed successfully:", booking?.id);
          console.log("Payment distribution:", { totalAmount, serviceFeeAmount, hostPayoutAmount, serviceFeeRate });

          // Create payout record for host
          if (hostId && hostPayoutAmount > 0) {
            const { data: bankDetails } = await supabase
              .from('bank_details')
              .select('*')
              .eq('user_id', hostId)
              .eq('verification_status', 'verified')
              .single();

            if (bankDetails) {
              await supabase.from('payouts').insert({
                recipient_id: hostId,
                recipient_type: 'host',
                booking_id: booking?.id,
                amount: hostPayoutAmount,
                status: 'scheduled',
                scheduled_for: payoutScheduledAt,
                bank_code: bankDetails.bank_name,
                account_number: bankDetails.account_number,
                account_name: bankDetails.account_holder_name,
              });
              console.log("Host payout scheduled:", hostPayoutAmount);
            }
          }

          // Send confirmation email
          try {
            await supabase.functions.invoke("send-booking-confirmation", {
              body: {
                bookingId: booking?.id,
                email: bookingData.guest_email,
                guestName: bookingData.guest_name,
                bookingType: bookingData.booking_type,
                itemName: bookingData.emailData?.itemName || "Booking",
                totalAmount: bookingData.total_amount,
                bookingDetails: bookingData.booking_details,
                visitDate: bookingData.visit_date,
              },
            });
          } catch (emailError) {
            console.error("Error sending confirmation email:", emailError);
          }

          // Send host notification email
          try {
            let hostEmail = null;
            if (bookingData.booking_type === 'trip' || bookingData.booking_type === 'event') {
              const { data: tripData } = await supabase.from('trips').select('email').eq('id', bookingData.item_id).single();
              hostEmail = tripData?.email;
            } else if (bookingData.booking_type === 'hotel') {
              const { data: hotelData } = await supabase.from('hotels').select('email').eq('id', bookingData.item_id).single();
              hostEmail = hotelData?.email;
            } else if (bookingData.booking_type === 'adventure_place' || bookingData.booking_type === 'adventure') {
              const { data: adventureData } = await supabase.from('adventure_places').select('email').eq('id', bookingData.item_id).single();
              hostEmail = adventureData?.email;
            }

            if (hostEmail) {
              await supabase.functions.invoke("send-host-booking-notification", {
                body: {
                  bookingId: booking?.id,
                  hostEmail,
                  guestName: bookingData.guest_name,
                  guestEmail: bookingData.guest_email,
                  guestPhone: bookingData.guest_phone,
                  bookingType: bookingData.booking_type,
                  itemName: bookingData.emailData?.itemName || "Booking",
                  totalAmount: bookingData.total_amount,
                  hostPayoutAmount,
                  serviceFee: serviceFeeAmount,
                  bookingDetails: bookingData.booking_details,
                  visitDate: bookingData.visit_date,
                },
              });
            }
          } catch (hostEmailError) {
            console.error("Error sending host notification:", hostEmailError);
          }

          return new Response(
            JSON.stringify({
              success: true,
              data: {
                status: transaction.status,
                reference: transaction.reference,
                amount: transaction.amount / 100,
                paid_at: transaction.paid_at,
                channel: transaction.channel,
                currency: transaction.currency,
                isSuccessful,
                bookingId: booking?.id,
                guestName: bookingData.guest_name,
                guestEmail: bookingData.guest_email,
                guestPhone: bookingData.guest_phone,
                itemName: bookingData.emailData?.itemName || "Booking",
                bookingType: bookingData.booking_type,
                visitDate: bookingData.visit_date,
                slotsBooked: bookingData.slots_booked,
                adults: bookingData.booking_details?.adults,
                children: bookingData.booking_details?.children,
                facilities: bookingData.booking_details?.facilities,
                activities: bookingData.booking_details?.activities,
                serviceFee: serviceFeeAmount,
                hostPayout: hostPayoutAmount,
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else if (!isSuccessful && pendingBookingId) {
        // Payment failed - cancel the pending booking
        await supabase
          .from("bookings")
          .update({ status: 'cancelled', payment_status: 'failed', updated_at: new Date().toISOString() })
          .eq("id", pendingBookingId);
        console.log("Pending booking cancelled due to failed payment:", pendingBookingId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          status: transaction.status,
          reference: transaction.reference,
          amount: transaction.amount / 100,
          paid_at: transaction.paid_at,
          channel: transaction.channel,
          currency: transaction.currency,
          isSuccessful,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Paystack verify error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});