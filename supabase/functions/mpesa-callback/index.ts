import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  console.log('=== MPESA CALLBACK ENDPOINT HIT ===');
  console.log('Request Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const rawBody = await req.text();
    console.log('Raw Request Body:', rawBody);
    
    const callbackData = JSON.parse(rawBody);
    console.log('M-Pesa Callback Parsed Data:', JSON.stringify(callbackData, null, 2));

    const { Body } = callbackData;
    const { stkCallback } = Body;

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const merchantRequestId = stkCallback.MerchantRequestID;
    const resultCode = stkCallback.ResultCode.toString();
    const resultDesc = stkCallback.ResultDesc;

    // Extract receipt number from CallbackMetadata if payment successful
    let mpesaReceiptNumber = null;
    if (resultCode === '0' && stkCallback.CallbackMetadata?.Item) {
      const receiptItem = stkCallback.CallbackMetadata.Item.find(
        (item: any) => item.Name === 'MpesaReceiptNumber'
      );
      if (receiptItem) {
        mpesaReceiptNumber = receiptItem.Value;
      }
    }

    // Determine payment status based on result code
    const paymentStatus = resultCode === '0' ? 'completed' : 'failed';

    // First, get the pending payment to access booking_data
    const { data: pendingPayment, error: fetchError } = await supabaseClient
      .from('pending_payments')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (fetchError) {
      console.error('Error fetching pending payment:', fetchError);
    }

    // Update pending_payments table
    const { error: updateError } = await supabaseClient
      .from('pending_payments')
      .update({
        payment_status: paymentStatus,
        result_code: resultCode,
        result_desc: resultDesc,
        mpesa_receipt_number: mpesaReceiptNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('checkout_request_id', checkoutRequestId);

    if (updateError) {
      console.error('Error updating pending payment:', updateError);
    } else {
      console.log(`✅ Payment status updated to ${paymentStatus} for ${checkoutRequestId}`);
    }

    // If payment was successful, create booking and send notifications
    if (resultCode === '0' && pendingPayment) {
      const bookingData = pendingPayment.booking_data;
      
      console.log('Creating booking for successful payment:', bookingData);

      // Check if booking already exists for this payment
      const { data: existingBooking } = await supabaseClient
        .from('bookings')
        .select('id')
        .eq('payment_phone', pendingPayment.phone_number)
        .eq('item_id', bookingData.item_id)
        .eq('payment_status', 'paid')
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Within last 5 mins
        .maybeSingle();

      if (existingBooking) {
        console.log('Booking already exists, skipping creation:', existingBooking.id);
      } else {
        // Insert booking with paid status
        const { data: booking, error: bookingError } = await supabaseClient
          .from('bookings')
          .insert({
            item_id: bookingData.item_id,
            booking_type: bookingData.booking_type,
            total_amount: bookingData.total_amount,
            booking_details: bookingData.booking_details,
            user_id: bookingData.user_id || null,
            is_guest_booking: bookingData.is_guest_booking || !bookingData.user_id,
            guest_name: bookingData.guest_name,
            guest_email: bookingData.guest_email,
            guest_phone: bookingData.guest_phone || null,
            visit_date: bookingData.visit_date || null,
            slots_booked: bookingData.slots_booked || 1,
            payment_status: 'paid',
            payment_method: 'mpesa',
            payment_phone: pendingPayment.phone_number,
            status: 'confirmed',
            referral_tracking_id: bookingData.referral_tracking_id || null,
          })
          .select()
          .single();

        if (bookingError) {
          console.error('Error creating booking:', bookingError);
        } else {
          console.log('✅ Booking created successfully:', booking.id);

          // Send notifications and emails
          await sendNotificationsAndEmails(
            supabaseClient,
            booking,
            bookingData,
            pendingPayment,
            mpesaReceiptNumber
          );
        }
      }
    }

    // Log callback for audit
    try {
      await supabaseClient
        .from('mpesa_callback_log')
        .insert({
          checkout_request_id: checkoutRequestId,
          merchant_request_id: merchantRequestId,
          result_code: resultCode,
          result_desc: resultDesc,
          raw_payload: callbackData,
        });
    } catch (logError) {
      console.error('Error inserting callback log:', logError);
    }

    console.log('CheckoutRequestID:', checkoutRequestId, 'ResultCode:', resultCode, 'Status:', paymentStatus);

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

async function sendNotificationsAndEmails(
  supabase: any,
  booking: any,
  bookingData: any,
  pendingPayment: any,
  mpesaReceiptNumber: string | null
) {
  try {
    const itemName = bookingData.emailData?.itemName || 'your booking';

    // Send confirmation email to user/guest
    if (bookingData.guest_email) {
      console.log('Sending confirmation email to:', bookingData.guest_email);
      
      const emailResult = await sendConfirmationEmail(
        bookingData.guest_email,
        bookingData.guest_name,
        booking.id,
        bookingData.booking_type,
        itemName,
        bookingData.total_amount,
        bookingData.booking_details,
        bookingData.visit_date,
        mpesaReceiptNumber
      );
      
      if (emailResult.success) {
        console.log('✅ Confirmation email sent to user');
      } else {
        console.error('❌ Failed to send confirmation email:', emailResult.error);
      }
    }

    // Create notification for user if logged in (using service role bypasses RLS)
    if (bookingData.user_id) {
      const { error: userNotifError } = await supabase
        .from('notifications')
        .insert({
          user_id: bookingData.user_id,
          type: 'payment_confirmed',
          title: 'Payment Successful',
          message: `Your payment of KES ${bookingData.total_amount} for ${itemName} has been confirmed.`,
          data: { 
            booking_id: booking.id, 
            amount: bookingData.total_amount,
            mpesa_receipt: mpesaReceiptNumber 
          },
        });

      if (userNotifError) {
        console.error('Error creating user notification:', userNotifError);
      } else {
        console.log('✅ User notification created');
      }
    }

    // Create notification for host and send email
    const hostId = bookingData.host_id || pendingPayment.host_id;
    if (hostId) {
      // Create in-app notification for host
      const { error: hostNotifError } = await supabase
        .from('notifications')
        .insert({
          user_id: hostId,
          type: 'new_booking',
          title: 'New Paid Booking',
          message: `You have a new paid booking for ${itemName}. Amount: KES ${bookingData.total_amount}`,
          data: { 
            booking_id: booking.id, 
            amount: bookingData.total_amount, 
            guest_name: bookingData.guest_name 
          },
        });

      if (hostNotifError) {
        console.error('Error creating host notification:', hostNotifError);
      } else {
        console.log('✅ Host notification created');
      }

      // Get host email and send notification
      const { data: hostProfile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('id', hostId)
        .single();

      if (hostProfile?.email) {
        const hostEmailResult = await sendHostNotificationEmail(
          hostProfile.email,
          hostProfile.name || 'Host',
          booking.id,
          bookingData.guest_name,
          itemName,
          bookingData.total_amount,
          bookingData.visit_date
        );
        
        if (hostEmailResult.success) {
          console.log('✅ Host notification email sent');
        } else {
          console.error('❌ Failed to send host email:', hostEmailResult.error);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendNotificationsAndEmails:', error);
  }
}

async function sendConfirmationEmail(
  email: string,
  guestName: string,
  bookingId: string,
  bookingType: string,
  itemName: string,
  totalAmount: number,
  bookingDetails: any,
  visitDate: string | null,
  mpesaReceipt: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const typeDisplay = bookingType.charAt(0).toUpperCase() + bookingType.slice(1);

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #008080; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .detail-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #008080; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            h1 { margin: 0; font-size: 24px; }
            h2 { color: #008080; font-size: 20px; margin-top: 0; }
            .amount { font-size: 28px; color: #008080; font-weight: bold; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin-top: 10px; background: #D4EDDA; color: #155724; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Payment Confirmed!</h1>
            </div>
            <div class="content">
              <p>Dear ${guestName},</p>
              <p>Great news! Your payment has been received and your booking is now confirmed.</p>
              
              <div class="detail-box">
                <h2>Booking Details</h2>
                <p><strong>Booking ID:</strong> ${bookingId}</p>
                <p><strong>Booking Type:</strong> ${typeDisplay}</p>
                <p><strong>Item:</strong> ${itemName}</p>
                ${visitDate ? `<p><strong>Visit Date:</strong> ${visitDate}</p>` : ''}
                ${mpesaReceipt ? `<p><strong>M-Pesa Receipt:</strong> ${mpesaReceipt}</p>` : ''}
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                <p class="amount">Total Paid: KES ${totalAmount.toFixed(2)}</p>
                <span class="status-badge">Payment Confirmed</span>
              </div>

              <p>Thank you for your booking. The host has been notified and will be expecting you.</p>
              <p>If you have any questions, please don't hesitate to contact us.</p>
            </div>
            <div class="footer">
              <p>This is an automated confirmation email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { error } = await resend.emails.send({
      from: 'Bookings <onboarding@resend.dev>',
      to: [email],
      subject: `✅ Payment Confirmed - ${itemName}`,
      html: emailHTML,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function sendHostNotificationEmail(
  email: string,
  hostName: string,
  bookingId: string,
  guestName: string,
  itemName: string,
  totalAmount: number,
  visitDate: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #008080; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .detail-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #008080; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            h1 { margin: 0; font-size: 24px; }
            h2 { color: #008080; font-size: 20px; margin-top: 0; }
            .amount { font-size: 28px; color: #008080; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 New Booking Received!</h1>
            </div>
            <div class="content">
              <p>Dear ${hostName},</p>
              <p>You have received a new paid booking!</p>
              
              <div class="detail-box">
                <h2>Booking Details</h2>
                <p><strong>Booking ID:</strong> ${bookingId}</p>
                <p><strong>Guest Name:</strong> ${guestName}</p>
                <p><strong>Item:</strong> ${itemName}</p>
                ${visitDate ? `<p><strong>Visit Date:</strong> ${visitDate}</p>` : ''}
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                <p class="amount">Amount: KES ${totalAmount.toFixed(2)}</p>
              </div>

              <p>Please prepare to receive your guest. You can view full booking details in your dashboard.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { error } = await resend.emails.send({
      from: 'Bookings <onboarding@resend.dev>',
      to: [email],
      subject: `🎉 New Booking - ${itemName}`,
      html: emailHTML,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
