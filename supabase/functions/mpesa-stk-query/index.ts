import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to get OAuth token');
    }

    const { access_token } = await tokenResponse.json();
    console.log('OAuth token obtained for STK Query');

    // Step 2: Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // Step 3: Query STK Push status
    const queryPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    console.log('Querying STK status:', { checkoutRequestId });

    const queryResponse = await fetch(
      'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryPayload),
      }
    );

    const queryData = await queryResponse.json();
    console.log('STK Query response:', queryData);

    // Check if it's a rate limit error
    if (queryData.fault?.detail?.errorcode === 'policies.ratelimit.SpikeArrestViolation') {
      console.log('Rate limit hit - will retry later');
      return new Response(
        JSON.stringify({
          success: false,
          resultCode: 'RATE_LIMIT',
          resultDesc: 'Rate limit exceeded, please try again in a moment',
          responseDescription: 'Too many requests to M-Pesa API',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      );
    }

    // Update database based on query result
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (queryData.ResultCode === '0') {
      // Payment successful
      const { data: pendingPayment, error: updateError } = await supabaseClient
        .from('pending_payments')
        .update({
          payment_status: 'completed',
          result_code: queryData.ResultCode,
          result_desc: queryData.ResultDesc,
          updated_at: new Date().toISOString(),
        })
        .eq('checkout_request_id', checkoutRequestId)
        .select()
        .single();

      if (!updateError && pendingPayment) {
        console.log('Payment status updated to completed');
        
        // Create booking
        const bookingData = pendingPayment.booking_data as any;
        const { data: booking, error: bookingError } = await supabaseClient
          .from('bookings')
          .insert({
            ...bookingData,
            payment_status: 'completed',
          })
          .select()
          .single();

        if (!bookingError && booking) {
          console.log('Booking created:', booking.id);

          // Send confirmation email to guest
          try {
            const emailData = {
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
          let creatorId = null;
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
              
              if (itemData) {
                creatorId = itemData.created_by;
                
                // Create notification for host
                if (creatorId) {
                  await supabaseClient.from('notifications').insert({
                    user_id: creatorId,
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
            }
          } catch (hostNotifError) {
            console.error('Error creating host notification:', hostNotifError);
          }
        }
      }
    } else if (queryData.ResultCode && queryData.ResultCode !== '1032') {
      // Payment failed (but not pending)
      // Only update if we have a valid result code and it's not pending (1032)
      await supabaseClient
        .from('pending_payments')
        .update({
          payment_status: 'failed',
          result_code: queryData.ResultCode,
          result_desc: queryData.ResultDesc,
          updated_at: new Date().toISOString(),
        })
        .eq('checkout_request_id', checkoutRequestId);
      
      console.log('Payment status updated to failed');
    } else {
      console.log('Payment still pending or no result code');
    }

    return new Response(
      JSON.stringify({
        success: true,
        resultCode: queryData.ResultCode,
        resultDesc: queryData.ResultDesc,
        responseDescription: queryData.ResponseDescription,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in mpesa-stk-query function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
