import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      // Update payment status - use 'completed' or 'failed' to match the check constraint
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

      // If successful, create booking
      if (isSuccessful && paymentData.booking_data) {
        const bookingData = paymentData.booking_data as any;
        
        console.log("Creating booking with data:", bookingData);

        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .insert([{
            user_id: bookingData.user_id || null,
            item_id: bookingData.item_id,
            booking_type: bookingData.booking_type,
            total_amount: bookingData.total_amount,
            status: "confirmed",
            payment_status: "completed", // Use 'completed' to match the check constraint
            payment_method: "card",
            is_guest_booking: bookingData.is_guest_booking || false,
            guest_name: bookingData.guest_name,
            guest_email: bookingData.guest_email,
            guest_phone: bookingData.guest_phone || null,
            slots_booked: bookingData.slots_booked || 1,
            visit_date: bookingData.visit_date,
            booking_details: bookingData.booking_details,
          }])
          .select()
          .single();

        if (bookingError) {
          console.error("Error creating booking:", bookingError);
        } else {
          console.log("Booking created successfully:", booking?.id);

          // Send confirmation email to the user
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
            console.log("Booking confirmation email sent");
          } catch (emailError) {
            console.error("Error sending confirmation email:", emailError);
          }

          // Send notification email to the host
          try {
            // Get host email from the item
            let hostEmail = null;
            let hostId = null;
            
            if (bookingData.booking_type === 'trip' || bookingData.booking_type === 'event') {
              const { data: tripData } = await supabase
                .from('trips')
                .select('email, created_by')
                .eq('id', bookingData.item_id)
                .single();
              hostEmail = tripData?.email;
              hostId = tripData?.created_by;
            } else if (bookingData.booking_type === 'hotel') {
              const { data: hotelData } = await supabase
                .from('hotels')
                .select('email, created_by')
                .eq('id', bookingData.item_id)
                .single();
              hostEmail = hotelData?.email;
              hostId = hotelData?.created_by;
            } else if (bookingData.booking_type === 'adventure_place' || bookingData.booking_type === 'adventure') {
              const { data: adventureData } = await supabase
                .from('adventure_places')
                .select('email, created_by')
                .eq('id', bookingData.item_id)
                .single();
              hostEmail = adventureData?.email;
              hostId = adventureData?.created_by;
            }

            if (hostEmail) {
              await supabase.functions.invoke("send-host-booking-notification", {
                body: {
                  bookingId: booking?.id,
                  hostEmail: hostEmail,
                  guestName: bookingData.guest_name,
                  guestEmail: bookingData.guest_email,
                  guestPhone: bookingData.guest_phone,
                  bookingType: bookingData.booking_type,
                  itemName: bookingData.emailData?.itemName || "Booking",
                  totalAmount: bookingData.total_amount,
                  bookingDetails: bookingData.booking_details,
                  visitDate: bookingData.visit_date,
                },
              });
              console.log("Host notification email sent to:", hostEmail);
            }
          } catch (hostEmailError) {
            console.error("Error sending host notification email:", hostEmailError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          status: transaction.status,
          reference: transaction.reference,
          amount: transaction.amount / 100, // Convert back from kobo/cents
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
