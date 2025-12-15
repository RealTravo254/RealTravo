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

    // Extract receipt number and amount from CallbackMetadata if payment successful
    let mpesaReceiptNumber = null;
    let paidAmount = null;
    let transactionDate = null;
    let phoneNumber = null;
    
    if (resultCode === '0' && stkCallback.CallbackMetadata?.Item) {
      for (const item of stkCallback.CallbackMetadata.Item) {
        switch (item.Name) {
          case 'MpesaReceiptNumber':
            mpesaReceiptNumber = item.Value;
            break;
          case 'Amount':
            paidAmount = item.Value;
            break;
          case 'TransactionDate':
            transactionDate = item.Value;
            break;
          case 'PhoneNumber':
            phoneNumber = item.Value?.toString();
            break;
        }
      }
    }

    // Determine payment status: pending -> completed or failed
    const paymentStatus = resultCode === '0' ? 'completed' : 'failed';
    const bookingStatus = resultCode === '0' ? 'confirmed' : 'cancelled';
    const bookingPaymentStatus = resultCode === '0' ? 'completed' : 'failed';

    // First, get the payment record to access booking_data
    const { data: payment, error: fetchError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (fetchError) {
      console.error('Error fetching payment:', fetchError);
    }

    // Update payments table with result
    const { error: updateError } = await supabaseClient
      .from('payments')
      .update({
        payment_status: paymentStatus,
        result_code: resultCode,
        result_desc: resultDesc,
        mpesa_receipt_number: mpesaReceiptNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('checkout_request_id', checkoutRequestId);

    if (updateError) {
      console.error('Error updating payment:', updateError);
    } else {
      console.log(`✅ Payment status updated to ${paymentStatus} for ${checkoutRequestId}`);
    }

    // Update the existing booking with payment result
    if (payment?.booking_data?.booking_id) {
      const bookingId = payment.booking_data.booking_id;
      
      console.log(`Updating booking ${bookingId} with status: ${bookingPaymentStatus}`);
      
      const { error: bookingUpdateError } = await supabaseClient
        .from('bookings')
        .update({
          payment_status: bookingPaymentStatus,
          status: bookingStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (bookingUpdateError) {
        console.error('Error updating booking:', bookingUpdateError);
      } else {
        console.log(`✅ Booking ${bookingId} updated to ${bookingPaymentStatus}/${bookingStatus}`);
        
        // If payment was successful, send notifications and emails
        if (resultCode === '0') {
          const bookingData = payment.booking_data;
          
          await sendNotificationsAndEmails(
            supabaseClient,
            { id: bookingId, ...bookingData },
            bookingData,
            payment,
            mpesaReceiptNumber
          );
        }
      }
    } else {
      console.error('No booking_id found in payment data');
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
  payment: any,
  mpesaReceiptNumber: string | null
) {
  try {
    const itemName = bookingData.emailData?.itemName || 'your booking';
    
    console.log('=== SENDING NOTIFICATIONS AND EMAILS ===');
    console.log('Booking ID:', booking.id);
    console.log('Guest Email:', bookingData.guest_email);
    console.log('Guest Name:', bookingData.guest_name);
    console.log('Item Name:', itemName);
    console.log('Is Guest Booking:', bookingData.is_guest_booking);
    console.log('User ID:', bookingData.user_id);

    // Send confirmation email to user/guest - this should always work for both logged-in and guest users
    const guestEmail = bookingData.guest_email;
    const guestName = bookingData.guest_name || 'Guest';
    
    if (guestEmail) {
      console.log('📧 Attempting to send confirmation email to:', guestEmail);
      
      const emailResult = await sendConfirmationEmail(
        guestEmail,
        guestName,
        booking.id,
        bookingData.booking_type,
        itemName,
        bookingData.total_amount,
        bookingData.booking_details,
        bookingData.visit_date,
        mpesaReceiptNumber
      );
      
      if (emailResult.success) {
        console.log('✅ Confirmation email sent successfully to:', guestEmail);
      } else {
        console.error('❌ Failed to send confirmation email to:', guestEmail, 'Error:', emailResult.error);
      }
    } else {
      console.warn('⚠️ No guest email found in booking data. Cannot send confirmation email.');
      console.log('Booking data keys:', Object.keys(bookingData));
    }

    // Create notification for user if logged in
    if (bookingData.user_id) {
      const details = bookingData.booking_details || {};
      const totalPeople = (details.adults || 0) + (details.children || 0);
      const facilitiesList = details.selectedFacilities?.map((f: any) => f.name).join(', ') || '';
      const activitiesList = details.selectedActivities?.map((a: any) => a.name).join(', ') || '';
      
      let userMessage = `Payment confirmed for ${itemName}. Booked by: ${bookingData.guest_name || 'Guest'}. People: ${totalPeople} (${details.adults || 0} adults, ${details.children || 0} children).`;
      if (facilitiesList) userMessage += ` Facilities: ${facilitiesList}.`;
      if (activitiesList) userMessage += ` Activities: ${activitiesList}.`;
      userMessage += ` Total: KES ${bookingData.total_amount}`;
      
      const { error: userNotifError } = await supabase
        .from('notifications')
        .insert({
          user_id: bookingData.user_id,
          type: 'payment_confirmed',
          title: 'Payment Successful',
          message: userMessage,
          data: { 
            booking_id: booking.id, 
            amount: bookingData.total_amount,
            mpesa_receipt: mpesaReceiptNumber,
            guest_name: bookingData.guest_name,
            total_people: totalPeople,
            adults: details.adults || 0,
            children: details.children || 0,
            facilities: details.selectedFacilities || [],
            activities: details.selectedActivities || []
          },
        });

      if (userNotifError) {
        console.error('Error creating user notification:', userNotifError);
      } else {
        console.log('✅ User notification created');
      }
    }

    // Create notification for host and send email
    const hostId = bookingData.host_id || payment.host_id;
    if (hostId) {
      const details = bookingData.booking_details || {};
      const totalPeople = (details.adults || 0) + (details.children || 0);
      const facilitiesList = details.selectedFacilities?.map((f: any) => f.name).join(', ') || '';
      const activitiesList = details.selectedActivities?.map((a: any) => a.name).join(', ') || '';
      
      let hostMessage = `New paid booking for ${itemName}. Booked by: ${bookingData.guest_name || 'Guest'}. People: ${totalPeople} (${details.adults || 0} adults, ${details.children || 0} children).`;
      if (facilitiesList) hostMessage += ` Facilities: ${facilitiesList}.`;
      if (activitiesList) hostMessage += ` Activities: ${activitiesList}.`;
      hostMessage += ` Amount: KES ${bookingData.total_amount}`;
      
      // Create in-app notification for host
      const { error: hostNotifError } = await supabase
        .from('notifications')
        .insert({
          user_id: hostId,
          type: 'new_booking',
          title: 'New Paid Booking',
          message: hostMessage,
          data: { 
            booking_id: booking.id, 
            amount: bookingData.total_amount, 
            guest_name: bookingData.guest_name,
            total_people: totalPeople,
            adults: details.adults || 0,
            children: details.children || 0,
            facilities: details.selectedFacilities || [],
            activities: details.selectedActivities || []
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