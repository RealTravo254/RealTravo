import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('M-Pesa Callback endpoint hit - raw body incoming');
    const callbackData = await req.json();
    console.log('M-Pesa Callback received:', JSON.stringify(callbackData, null, 2));
    console.log('Request headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { Body } = callbackData;
    const { stkCallback } = Body;

    const merchantRequestId = stkCallback.MerchantRequestID;
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    // Update pending payment status
    const updateData: any = {
      payment_status: resultCode === 0 ? 'completed' : 'failed',
      result_code: resultCode.toString(),
      result_desc: resultDesc,
      updated_at: new Date().toISOString(),
    };

    // If payment successful, extract M-Pesa receipt number
    if (resultCode === 0 && stkCallback.CallbackMetadata) {
      const items = stkCallback.CallbackMetadata.Item;
      const receiptItem = items.find((item: any) => item.Name === 'MpesaReceiptNumber');
      if (receiptItem) {
        updateData.mpesa_receipt_number = receiptItem.Value;
      }
    }

    // Update pending payment
    const { data: pendingPayment, error: updateError } = await supabaseClient
      .from('pending_payments')
      .update(updateData)
      .eq('checkout_request_id', checkoutRequestId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating pending payment:', updateError);
      return new Response(JSON.stringify({ success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If payment successful, create booking
    if (resultCode === 0 && pendingPayment) {
      const bookingData = pendingPayment.booking_data as any;
      
      const { data: booking, error: bookingError } = await supabaseClient
        .from('bookings')
        .insert({
          ...bookingData,
          payment_status: 'completed',
        })
        .select()
        .single();

      if (bookingError) {
        console.error('Error creating booking:', bookingError);
      } else {
        console.log('Booking created successfully:', booking.id);

        // Send confirmation email
        try {
          const emailData = bookingData.emailData || {
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
          console.log('Confirmation email sent successfully');
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
