import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingConfirmationRequest {
  bookingId: string;
  email: string;
  guestName: string;
  bookingType: string;
  itemName: string;
  totalAmount: number;
  bookingDetails: any;
  visitDate?: string;
  paymentStatus?: string;
}

// Generate QR code data URL using external API
const generateQRCodeUrl = (data: string): string => {
  const encodedData = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedData}`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, email, guestName, bookingType, itemName, totalAmount, bookingDetails, visitDate, paymentStatus }: BookingConfirmationRequest = await req.json();

    // Format booking type for display
    const typeDisplay = bookingType.charAt(0).toUpperCase() + bookingType.slice(1);

    // Build booking details HTML
    const details = bookingDetails as any;
    const totalPeople = (details.adults || 0) + (details.children || 0);
    
    let detailsHTML = `
      <p><strong>Booked By:</strong> ${guestName}</p>
      <p><strong>Number of People:</strong> ${totalPeople} (${details.adults || 0} adults, ${details.children || 0} children)</p>
      ${visitDate ? `<p><strong>Visit Date:</strong> ${visitDate}</p>` : ''}
    `;
    
    // Add facilities if present
    if (details.selectedFacilities && details.selectedFacilities.length > 0) {
      detailsHTML += `
        <p><strong>Facilities:</strong></p>
        <ul style="margin: 5px 0; padding-left: 20px;">
          ${details.selectedFacilities.map((fac: any) => `
            <li>${fac.name}${fac.checkIn ? ` - Check-in: ${fac.checkIn}, Check-out: ${fac.checkOut}` : ''} (KES ${fac.price || 0})</li>
          `).join('')}
        </ul>
      `;
    }
    
    // Add activities if present
    if (details.selectedActivities && details.selectedActivities.length > 0) {
      detailsHTML += `
        <p><strong>Activities:</strong></p>
        <ul style="margin: 5px 0; padding-left: 20px;">
          ${details.selectedActivities.map((act: any) => `
            <li>${act.name} - ${act.people || act.adults || 0} people (KES ${act.price || 0} each)</li>
          `).join('')}
        </ul>
      `;
    }

    // Determine if booking is paid
    const isPaid = paymentStatus === 'paid' || paymentStatus === 'completed';
    
    // Generate QR code data for paid bookings
    const qrData = JSON.stringify({
      bookingId,
      visitDate: visitDate || '',
      email
    });
    const qrCodeUrl = generateQRCodeUrl(qrData);

    // QR Code section for paid bookings only
    const qrCodeHTML = isPaid ? `
      <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f0f9f9; border-radius: 12px;">
        <h3 style="color: #008080; margin-bottom: 15px;">🎫 Your Check-in QR Code</h3>
        <img src="${qrCodeUrl}" alt="Booking QR Code" style="width: 200px; height: 200px; border: 4px solid #008080; border-radius: 8px;" />
        <p style="color: #666; font-size: 14px; margin-top: 15px;">
          Show this QR code to the host when you arrive for quick check-in
        </p>
      </div>
    ` : '';

    const statusBadge = isPaid 
      ? '<span class="status-badge status-paid">✓ Payment Confirmed</span>'
      : '<span class="status-badge status-pending">Payment Pending</span>';

    const headerTitle = isPaid ? '✅ Booking Confirmed!' : '📋 Booking Submitted!';
    const headerColor = isPaid ? '#22c55e' : '#008080';

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${headerColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .detail-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #008080; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            h1 { margin: 0; font-size: 24px; }
            h2 { color: #008080; font-size: 20px; margin-top: 0; }
            .amount { font-size: 28px; color: #008080; font-weight: bold; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin-top: 10px; }
            .status-pending { background: #FFF3CD; color: #856404; }
            .status-paid { background: #D1FAE5; color: #065F46; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${headerTitle}</h1>
            </div>
            <div class="content">
              <p>Dear ${guestName},</p>
              <p>${isPaid 
                ? 'Your payment has been confirmed! Your booking is now complete.' 
                : 'Thank you for your booking! Your reservation has been submitted successfully.'}</p>
              
              ${qrCodeHTML}

              <div class="detail-box">
                <h2>Booking Details</h2>
                <p><strong>Booking ID:</strong> ${bookingId}</p>
                <p><strong>Booking Type:</strong> ${typeDisplay}</p>
                <p><strong>Item:</strong> ${itemName}</p>
                <p><strong>Guest Name:</strong> ${guestName}</p>
                <p><strong>Email:</strong> ${email}</p>
                ${bookingDetails.phone ? `<p><strong>Phone:</strong> ${bookingDetails.phone}</p>` : ''}
                ${detailsHTML}
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                <p class="amount">Total Amount: KES ${totalAmount.toFixed(2)}</p>
                ${statusBadge}
              </div>

              ${!isPaid ? '<p>Please complete your payment to confirm your booking. The host will be notified once payment is received.</p>' : ''}
              <p>If you have any questions about your booking, please don't hesitate to contact us.</p>
            </div>
            <div class="footer">
              <p>This is an automated confirmation email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Bookings <onboarding@resend.dev>",
      to: [email],
      subject: `${isPaid ? '✅ ' : ''}Booking ${isPaid ? 'Confirmed' : 'Submitted'} - ${itemName}`,
      html: emailHTML,
    });

    if (error) {
      console.error("Error sending email:", error);
      throw error;
    }

    console.log("Booking confirmation email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-booking-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
