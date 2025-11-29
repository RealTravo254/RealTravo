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

        // Send confirmation email to guest
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
          console.log('Confirmation email sent to guest');
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
        }

        // Create notification for guest (if logged in)
        if (bookingData.user_id) {
          try {
            await supabaseClient.from('notifications').insert({
              user_id: bookingData.user_id,
              type: 'booking_confirmed',
              title: 'Booking Confirmed',
              message: `Your booking for ${bookingData.emailData?.itemName || 'item'} has been confirmed. Payment received successfully.`,
              data: {
                booking_id: booking.id,
                booking_type: bookingData.booking_type,
                item_id: bookingData.item_id,
              },
            });
            console.log('Guest notification created');
          } catch (notifError) {
            console.error('Error creating guest notification:', notifError);
          }
        }

        // Calculate and award referral commission
        if (bookingData.referral_tracking_id && booking.id && bookingData.total_amount) {
          try {
            // Get referral tracking details
            const { data: tracking } = await supabaseClient
              .from('referral_tracking')
              .select('*')
              .eq('id', bookingData.referral_tracking_id)
              .single();

            if (tracking) {
              // Get commission settings
              const { data: settings } = await supabaseClient
                .from('referral_settings')
                .select('*')
                .single();

              if (settings) {
                let commissionRate = Number(settings.booking_commission_rate);
                let commissionType = 'booking';

                // Check if this is a host referral
                if (tracking.referral_type === 'host') {
                  const { data: existingCommissions } = await supabaseClient
                    .from('referral_commissions')
                    .select('*')
                    .eq('referrer_id', tracking.referrer_id)
                    .eq('referred_user_id', tracking.referred_user_id)
                    .eq('commission_type', 'host');

                  if (existingCommissions && existingCommissions.length === 0) {
                    commissionRate = Number(settings.host_commission_rate);
                    commissionType = 'host';
                  } else if (existingCommissions && existingCommissions.length > 0) {
                    const firstCommission = existingCommissions[0];
                    const daysSinceFirst = Math.floor(
                      (Date.now() - new Date(firstCommission.created_at).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    
                    if (daysSinceFirst <= settings.host_commission_duration_days) {
                      commissionRate = Number(settings.host_commission_rate);
                      commissionType = 'host';
                    }
                  }
                }

                const commissionAmount = (bookingData.total_amount * commissionRate) / 100;

                // Create commission record
                await supabaseClient
                  .from('referral_commissions')
                  .insert({
                    referrer_id: tracking.referrer_id,
                    referred_user_id: tracking.referred_user_id,
                    booking_id: booking.id,
                    referral_tracking_id: bookingData.referral_tracking_id,
                    commission_type: commissionType,
                    commission_amount: commissionAmount,
                    commission_rate: commissionRate,
                    booking_amount: bookingData.total_amount,
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                  });

                // Update tracking status
                await supabaseClient
                  .from('referral_tracking')
                  .update({
                    status: 'converted',
                    converted_at: new Date().toISOString(),
                  })
                  .eq('id', bookingData.referral_tracking_id);

                console.log(`Commission awarded: ${commissionAmount} to referrer ${tracking.referrer_id}`);
              }
            }
          } catch (commissionError) {
            console.error('Error calculating commission:', commissionError);
          }
        }

        // Get host/creator ID from the item
        try {
          const tableMap: Record<string, string> = {
            'trip': 'trips',
            'event': 'trips',
            'hotel': 'hotels',
            'adventure_place': 'adventure_places',
            'attraction': 'attractions',
          };
          const tableName = tableMap[bookingData.booking_type as string];
          
          if (tableName) {
            const { data: itemData } = await supabaseClient
              .from(tableName)
              .select('created_by, email, name')
              .eq('id', bookingData.item_id)
              .single();
            
            if (itemData && itemData.created_by) {
              // Create notification for host
              await supabaseClient.from('notifications').insert({
                user_id: itemData.created_by,
                type: 'new_booking',
                title: 'New Booking Received',
                message: `You have a new booking for ${itemData.name}. ${bookingData.guest_name || 'A guest'} has booked for ${bookingData.visit_date || 'upcoming date'}.`,
                data: {
                  booking_id: booking.id,
                  booking_type: bookingData.booking_type,
                  item_id: bookingData.item_id,
                  guest_name: bookingData.guest_name,
                  total_amount: bookingData.total_amount,
                },
              });
              console.log('Host notification created');
            }
          }
        } catch (hostNotifError) {
          console.error('Error creating host notification:', hostNotifError);
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
