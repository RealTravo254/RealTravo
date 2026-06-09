// @ts-nocheck
/// <reference lib="deno.window" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const bookingConfirmationSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID format"),
  email: z.string().email("Invalid email format").max(255, "Email too long"),
  guestName: z.string().min(1, "Guest name required").max(100, "Guest name too long"),
  bookingType: z.enum(['trip', 'event', 'hotel', 'adventure_place', 'adventure', 'attraction']),
  itemName: z.string().min(1, "Item name required").max(200, "Item name too long"),
  totalAmount: z.number().min(0, "Amount cannot be negative").max(10000000, "Amount too large"),
  bookingDetails: z.any().optional(),
  visitDate: z.string().optional().nullable(),
  paymentStatus: z.string().optional(),
});

function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') return '';
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function buildDetailsHTML(bookingDetails: any, guestName: string, guestEmail: string, guestPhone: string, bookingType: string, itemName: string, visitDate: string | null, totalAmount: number, bookingId: string, isPaid: boolean, hostInfo?: { name?: string; email?: string; phone?: string }): string {
  const details = typeof bookingDetails === 'string' ? JSON.parse(bookingDetails) : (bookingDetails || {});
  const safeGuestName = escapeHtml(guestName);
  const safeItemName = escapeHtml(itemName);
  const typeDisplay = escapeHtml(bookingType).charAt(0).toUpperCase() + escapeHtml(bookingType).slice(1);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingId)}`;
  
  const totalPeople = (Number(details.adults) || 0) + (Number(details.children) || 0);

  // Ticket types
  let ticketHTML = '';
  if (details.ticketSelections && Array.isArray(details.ticketSelections) && details.ticketSelections.length > 0) {
    ticketHTML = `<div style="background:#f0fdf4;padding:15px;border-radius:8px;margin:15px 0;">
      <h3 style="color:#008080;font-size:14px;margin-bottom:10px;text-transform:uppercase;">Ticket Types</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #ddd;"><th style="text-align:left;padding:6px 0;">Type</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th></tr>
        ${details.ticketSelections.map((t: any) => `<tr style="border-bottom:1px dashed #eee;"><td style="padding:6px 0;">${escapeHtml(t.name || 'General')}</td><td style="text-align:center;">${t.quantity}</td><td style="text-align:right;">KES ${(Number(t.price) * Number(t.quantity)).toLocaleString()}</td></tr>`).join('')}
      </table>
    </div>`;
  }

  // Facilities
  let facilitiesHTML = '';
  if (details.selectedFacilities && Array.isArray(details.selectedFacilities) && details.selectedFacilities.length > 0) {
    facilitiesHTML = `<div style="background:#f8f9fa;padding:15px;border-radius:8px;margin:15px 0;">
      <h3 style="color:#008080;font-size:14px;margin-bottom:10px;text-transform:uppercase;">Facilities Booked</h3>
      <ul style="list-style:none;padding:0;margin:0;">
        ${details.selectedFacilities.map((f: any) => {
          const name = escapeHtml(typeof f === 'string' ? f : f.name || '');
          const dateRange = f.startDate && f.endDate ? ` <span style="color:#666;">(${formatDate(f.startDate)} - ${formatDate(f.endDate)}, ${Math.max(1, Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000))} days)</span>` : '';
          const price = f.price ? ` - KES ${Number(f.price).toLocaleString()}/day` : '';
          return name ? `<li style="padding:8px 0;border-bottom:1px dashed #ddd;"><strong>${name}</strong>${dateRange}${price}</li>` : '';
        }).filter(Boolean).join('')}
      </ul>
    </div>`;
  }

  // Activities
  let activitiesHTML = '';
  if (details.selectedActivities && Array.isArray(details.selectedActivities) && details.selectedActivities.length > 0) {
    activitiesHTML = `<div style="background:#fff5f0;padding:15px;border-radius:8px;margin:15px 0;">
      <h3 style="color:#FF7F50;font-size:14px;margin-bottom:10px;text-transform:uppercase;">Activities</h3>
      <ul style="list-style:none;padding:0;margin:0;">
        ${details.selectedActivities.map((a: any) => {
          const name = escapeHtml(typeof a === 'string' ? a : a.name || '');
          const people = a.numberOfPeople ? ` (${a.numberOfPeople} ${a.numberOfPeople === 1 ? 'person' : 'people'})` : '';
          const price = a.price ? ` - KES ${Number(a.price).toLocaleString()}/person` : '';
          return name ? `<li style="padding:8px 0;border-bottom:1px dashed #ddd;"><strong>${name}</strong>${people}${price}</li>` : '';
        }).filter(Boolean).join('')}
      </ul>
    </div>`;
  }

  // Entry fee line
  let entryFeeHTML = '';
  if (details.adults || details.children) {
    entryFeeHTML = `<p><strong>Guests:</strong> ${Number(details.adults) || 0} Adults, ${Number(details.children) || 0} Children (${totalPeople} total)</p>`;
  }
  if (details.rooms) {
    entryFeeHTML += `<p><strong>Rooms:</strong> ${Number(details.rooms)}</p>`;
  }

  return `<!DOCTYPE html><html><head><style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333;}
    .container{max-width:600px;margin:0 auto;padding:20px;}
    .header{background:#008080;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0;}
    .content{background:#f9f9f9;padding:30px;border-radius:0 0 8px 8px;}
    .detail-box{background:white;padding:20px;margin:20px 0;border-radius:8px;border-left:4px solid #008080;}
    .footer{text-align:center;margin-top:30px;color:#666;font-size:14px;}
    h1{margin:0;font-size:24px;}h2{color:#008080;font-size:20px;margin-top:0;}
    .amount{font-size:28px;color:#008080;font-weight:bold;}
    .status-badge{display:inline-block;padding:8px 16px;border-radius:20px;font-weight:bold;margin-top:10px;}
    .status-pending{background:#FFF3CD;color:#856404;}.status-paid{background:#D4EDDA;color:#155724;}
    .qr-code{text-align:center;margin:20px 0;}.qr-code img{border:2px solid #008080;border-radius:8px;padding:10px;background:white;}
    .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #eee;}
    .info-label{color:#666;font-size:13px;}.info-value{font-weight:bold;font-size:13px;}
  </style></head><body><div class="container">
    <div class="header"><h1>${isPaid ? '✅ Booking Confirmed!' : '📋 Booking Submitted'}</h1></div>
    <div class="content">
      <p>Dear ${safeGuestName},</p>
      <p>${isPaid ? 'Great news! Your payment has been received and your booking is now confirmed.' : 'Thank you for your booking! Your reservation is pending payment confirmation.'}</p>
      <div class="detail-box">
        <h2>Booking Summary</h2>
        <div style="margin-bottom:12px;">
          <div class="info-row"><span class="info-label">Booking ID</span><span class="info-value">${escapeHtml(bookingId)}</span></div>
          <div class="info-row"><span class="info-label">Category</span><span class="info-value">${typeDisplay}</span></div>
          <div class="info-row"><span class="info-label">Item</span><span class="info-value">${safeItemName}</span></div>
          <div class="info-row"><span class="info-label">Guest Name</span><span class="info-value">${safeGuestName}</span></div>
          <div class="info-row"><span class="info-label">Email</span><span class="info-value">${escapeHtml(guestEmail)}</span></div>
          ${guestPhone ? `<div class="info-row"><span class="info-label">Phone</span><span class="info-value">${escapeHtml(guestPhone)}</span></div>` : ''}
          ${visitDate ? `<div class="info-row"><span class="info-label">Visit Date</span><span class="info-value">${escapeHtml(formatDate(String(visitDate)))}</span></div>` : ''}
          ${totalPeople > 0 ? `<div class="info-row"><span class="info-label">Total People</span><span class="info-value">${totalPeople}</span></div>` : ''}
        </div>
        ${entryFeeHTML}
        <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;">
        <p class="amount">Total: KES ${Number(totalAmount).toLocaleString()}</p>
        <span class="status-badge ${isPaid ? 'status-paid' : 'status-pending'}">${isPaid ? 'Payment Confirmed' : 'Payment Pending'}</span>
      </div>
      ${ticketHTML}${facilitiesHTML}${activitiesHTML}
      ${(hostInfo && (hostInfo.name || hostInfo.email || hostInfo.phone)) ? `<div class="detail-box"><h2>Host Contact</h2>
        ${hostInfo.name ? `<div class="info-row"><span class="info-label">Host</span><span class="info-value">${escapeHtml(hostInfo.name)}</span></div>` : ''}
        ${hostInfo.email ? `<div class="info-row"><span class="info-label">Email</span><span class="info-value">${escapeHtml(hostInfo.email)}</span></div>` : ''}
        ${hostInfo.phone ? `<div class="info-row"><span class="info-label">Phone</span><span class="info-value">${escapeHtml(hostInfo.phone)}</span></div>` : ''}
      </div>` : ''}
      ${isPaid ? `<div class="qr-code"><h3>Your Booking QR Code</h3><p>Show this at the venue for quick check-in:</p><img src="${qrCodeUrl}" alt="Booking QR Code" width="200" height="200" /></div>` : `<div class="detail-box"><h2>Payment Instructions</h2><p>To confirm your booking, please complete the payment process.</p></div>`}
      <p>Thank you for choosing us!</p>
    </div>
    <div class="footer"><p>This is an automated confirmation email. Please do not reply to this message.</p></div>
  </div></body></html>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawData = await req.json();
    let validatedData;
    try {
      validatedData = bookingConfirmationSchema.parse(rawData);
    } catch (validationError: unknown) {
      if (validationError instanceof z.ZodError) {
        const zErr = validationError as z.ZodError;
        return new Response(JSON.stringify({ error: "Invalid input", details: zErr.issues ?? zErr.errors }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw validationError;
    }

    const { bookingId, email, guestName, bookingType, itemName, totalAmount, bookingDetails, visitDate, paymentStatus } = validatedData;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, guest_email, guest_phone, payment_status, total_amount, item_id, booking_type')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const recipientEmail = booking.guest_email || email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "No email found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isPaid = paymentStatus === 'paid' || paymentStatus === 'completed' || booking.payment_status === 'paid' || booking.payment_status === 'completed';
    const guestPhone = bookingDetails?.phone || booking.guest_phone || '';

    // Resolve host contact info from item + profile
    const bookingDetailsObject = typeof bookingDetails === 'string' ? JSON.parse(bookingDetails) : (bookingDetails || {});
    let hostInfo: { name?: string; email?: string; phone?: string } = {};
    try {
      let hostTable = 'trips';
      if (booking.booking_type === 'hotel') hostTable = 'hotels';
      else if (booking.booking_type === 'adventure' || booking.booking_type === 'adventure_place') hostTable = 'adventure_places';
      const itemSelect = hostTable === 'trips' ? 'created_by,email,phone_number' : 'created_by,email,phone_numbers';
      const { data: itemRow } = await supabaseClient.from(hostTable).select(itemSelect).eq('id', booking.item_id).single();
      const itemPhone = itemRow ? ((itemRow as any).phone_number || ((itemRow as any).phone_numbers && (itemRow as any).phone_numbers[0])) : undefined;
      if (itemRow?.created_by) {
        const { data: hostProfile } = await supabaseClient.from('profiles').select('email,name,phone_number').eq('id', itemRow.created_by).single();
        hostInfo = {
          name: hostProfile?.name || undefined,
          email: bookingDetailsObject.host_email || (itemRow as any).email || hostProfile?.email || undefined,
          phone: bookingDetailsObject.host_phone || itemPhone || hostProfile?.phone_number || undefined,
        };
      } else {
        hostInfo = {
          email: bookingDetailsObject.host_email || (itemRow as any).email || undefined,
          phone: bookingDetailsObject.host_phone || itemPhone || undefined,
        };
      }
    } catch (e) { console.error('Host info lookup failed:', e); }

    // Build and send guest email
    const emailHTML = buildDetailsHTML(bookingDetails, guestName, recipientEmail, guestPhone, bookingType, itemName, visitDate || null, totalAmount, bookingId, isPaid, hostInfo);

    const { error: sendError } = await resend.emails.send({
      from: "Realtravo <noreply@realtravo.com>",
      to: [recipientEmail],
      subject: `Booking ${isPaid ? 'Confirmed' : 'Submitted'} - ${escapeHtml(itemName)}`,
      html: emailHTML,
    });

    if (sendError) {
      console.error("Error sending guest email:", sendError);
    } else {
      console.log("Guest booking email sent to:", recipientEmail);
    }

    // Send host notification email
    try {
      let tableName = 'trips';
      if (booking.booking_type === 'hotel') tableName = 'hotels';
      else if (booking.booking_type === 'adventure' || booking.booking_type === 'adventure_place') tableName = 'adventure_places';

      const { data: item } = await supabaseClient.from(tableName).select('created_by').eq('id', booking.item_id).single();
      
      if (item?.created_by) {
        const { data: host } = await supabaseClient.from('profiles').select('email, name').eq('id', item.created_by).single();
        
        if (host?.email) {
          const safeHostName = escapeHtml(host.name || 'Host');
          const details = typeof bookingDetails === 'string' ? JSON.parse(bookingDetails) : (bookingDetails || {});
          const totalPeople = (Number(details.adults) || 0) + (Number(details.children) || 0);

          const hostHTML = `<!DOCTYPE html><html><head><style>
            body{font-family:Arial,sans-serif;line-height:1.6;color:#333;}
            .container{max-width:600px;margin:0 auto;padding:20px;}
            .header{background:#008080;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0;}
            .content{background:#f9f9f9;padding:30px;border-radius:0 0 8px 8px;}
            .detail-box{background:white;padding:20px;margin:20px 0;border-radius:8px;border-left:4px solid #008080;}
            h1{margin:0;font-size:24px;}h2{color:#008080;font-size:20px;margin-top:0;}
            .amount{font-size:28px;color:#008080;font-weight:bold;}
          </style></head><body><div class="container">
            <div class="header"><h1>🎉 New Booking Received!</h1></div>
            <div class="content">
              <p>Dear ${safeHostName},</p>
              <p>You have received a new booking for <strong>${escapeHtml(itemName)}</strong>.</p>
              <div class="detail-box">
                <h2>Booking Details</h2>
                <p><strong>Booking ID:</strong> ${escapeHtml(bookingId)}</p>
                <p><strong>Guest:</strong> ${escapeHtml(guestName)}</p>
                <p><strong>Email:</strong> ${escapeHtml(recipientEmail)}</p>
                ${guestPhone ? `<p><strong>Phone:</strong> ${escapeHtml(guestPhone)}</p>` : ''}
                ${visitDate ? `<p><strong>Visit Date:</strong> ${escapeHtml(formatDate(String(visitDate)))}</p>` : ''}
                ${totalPeople > 0 ? `<p><strong>Total People:</strong> ${totalPeople} (${Number(details.adults) || 0} adults, ${Number(details.children) || 0} children)</p>` : ''}
                <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;">
                <p class="amount">Amount: KES ${Number(totalAmount).toLocaleString()}</p>
                <p><strong>Payment:</strong> ${isPaid ? '✅ Paid' : '⏳ Pending'}</p>
              </div>
              <p>Please prepare to welcome your guest. View full details in your dashboard.</p>
            </div>
          </div></body></html>`;

          await resend.emails.send({
            from: "Realtravo <noreply@realtravo.com>",
            to: [host.email],
            subject: `New Booking - ${escapeHtml(itemName)}`,
            html: hostHTML,
          });
          console.log("Host notification email sent to:", host.email);
        }
      }
    } catch (hostError) {
      console.error("Failed to send host notification:", hostError);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-booking-confirmation:", error);
    return new Response(JSON.stringify({ error: error.message || "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);