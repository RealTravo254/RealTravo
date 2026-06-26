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

// ─── Colour palette (mirrors the PDF export) ────────────────────────────────
const TEAL       = "#008080";
const TEAL_DARK  = "#006666";
const TEAL_LIGHT = "#e6f4f4";
const CORAL      = "#FF7F50";
const CORAL_BG   = "#fff5f0";
const SLATE_50   = "#f8fafc";
const SLATE_100  = "#f1f5f9";
const SLATE_200  = "#e2e8f0";
const SLATE_400  = "#94a3b8";
const SLATE_600  = "#475569";
const SLATE_800  = "#1e293b";
const GREEN_BG   = "#f0fdf4";
const GREEN_TEXT = "#166534";
const AMBER_BG   = "#fffbeb";
const AMBER_TEXT = "#92400e";

// ─── Shared CSS injected into every email ───────────────────────────────────
const BASE_CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f0f4f8;color:${SLATE_800};-webkit-font-smoothing:antialiased;}
  .wrapper{background:#f0f4f8;padding:32px 16px;}
  /* ── Outer card ── */
  .card{max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);}
  /* ── Header banner ── */
  .header{background:linear-gradient(135deg,${TEAL} 0%,${TEAL_DARK} 100%);padding:32px 32px 28px;position:relative;overflow:hidden;}
  .header::after{content:'';position:absolute;right:-40px;top:-40px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.06);}
  .header-logo{font-size:11px;font-weight:900;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:16px;}
  .header-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:24px;padding:6px 14px;margin-bottom:20px;}
  .header-badge-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;}
  .header-badge-dot.pending{background:#fbbf24;}
  .header-badge-text{font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#fff;}
  .header-title{font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.5px;line-height:1.2;margin-bottom:6px;}
  .header-subtitle{font-size:13px;color:rgba(255,255,255,0.75);line-height:1.5;}
  /* ── Booking ID strip ── */
  .booking-id-strip{background:${TEAL_LIGHT};border-bottom:1px solid ${SLATE_200};padding:12px 32px;display:flex;justify-content:space-between;align-items:center;}
  .booking-id-label{font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:${SLATE_400};}
  .booking-id-value{font-size:11px;font-weight:700;color:${TEAL};font-family:monospace;letter-spacing:0.05em;}
  /* ── Body ── */
  .body{padding:28px 32px 32px;}
  .greeting{font-size:14px;color:${SLATE_600};margin-bottom:20px;line-height:1.6;}
  /* ── Section blocks ── */
  .section{margin-bottom:20px;}
  .section-label{font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:${SLATE_400};margin-bottom:10px;}
  /* ── Info grid card ── */
  .info-card{background:${SLATE_50};border:1px solid ${SLATE_200};border-radius:12px;overflow:hidden;}
  .info-row{display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-bottom:1px solid ${SLATE_200};}
  .info-row:last-child{border-bottom:none;}
  .info-key{font-size:12px;color:${SLATE_400};font-weight:600;}
  .info-val{font-size:12px;color:${SLATE__800};font-weight:700;text-align:right;max-width:60%;}
  /* ── Amount hero ── */
  .amount-card{background:linear-gradient(135deg,${TEAL} 0%,${TEAL_DARK} 100%);border-radius:12px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}
  .amount-label{font-size:11px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.75);}
  .amount-value{font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px;}
  .status-pill{display:inline-block;padding:5px 14px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;}
  .status-paid{background:#dcfce7;color:${GREEN_TEXT};}
  .status-pending{background:#fef9c3;color:${AMBER_TEXT};}
  /* ── Extras tables ── */
  .extras-card{border:1px solid ${SLATE_200};border-radius:12px;overflow:hidden;margin-bottom:16px;}
  .extras-header{padding:10px 16px;font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;}
  .extras-header.teal{background:${TEAL_LIGHT};color:${TEAL};}
  .extras-header.coral{background:${CORAL_BG};color:${CORAL};}
  .extras-header.slate{background:${SLATE_100};color:${SLATE_600};}
  .extras-table{width:100%;border-collapse:collapse;}
  .extras-table th{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${SLATE_400};padding:8px 16px;text-align:left;background:${SLATE_50};}
  .extras-table th.right{text-align:right;}
  .extras-table td{font-size:12px;padding:9px 16px;border-top:1px solid ${SLATE_200};color:${SLATE_600};}
  .extras-table td.bold{font-weight:700;color:${SLATE_800};}
  .extras-table td.right{text-align:right;font-weight:700;color:${TEAL};}
  /* ── Host contact card ── */
  .host-card{background:${TEAL_LIGHT};border:1px solid rgba(0,128,128,0.2);border-radius:12px;padding:16px 20px;}
  .host-name{font-size:14px;font-weight:900;color:${TEAL};margin-bottom:4px;}
  .host-meta{font-size:12px;color:${SLATE_600};line-height:1.8;}
  /* ── QR section ── */
  .qr-section{text-align:center;background:${SLATE_50};border:1px solid ${SLATE_200};border-radius:12px;padding:24px 20px;margin-bottom:20px;}
  .qr-label{font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:${SLATE_400};margin-bottom:4px;}
  .qr-sublabel{font-size:12px;color:${SLATE_600};margin-bottom:16px;}
  .qr-img{border:3px solid ${TEAL};border-radius:12px;padding:8px;background:#fff;display:inline-block;}
  /* ── Payment instructions ── */
  .pay-card{background:${AMBER_BG};border:1px solid #fde68a;border-radius:12px;padding:16px 20px;}
  .pay-title{font-size:12px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:${AMBER_TEXT};margin-bottom:6px;}
  .pay-body{font-size:13px;color:#78350f;line-height:1.6;}
  /* ── Footer ── */
  .footer{background:${SLATE_100};border-top:1px solid ${SLATE_200};padding:20px 32px;text-align:center;}
  .footer-brand{font-size:13px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:${TEAL};margin-bottom:4px;}
  .footer-note{font-size:11px;color:${SLATE_400};line-height:1.6;}
  /* ── Divider ── */
  .divider{border:none;border-top:1px solid ${SLATE_200};margin:20px 0;}
`;

function buildGuestEmailHTML(
  bookingDetails: any,
  guestName: string,
  guestEmail: string,
  guestPhone: string,
  bookingType: string,
  itemName: string,
  visitDate: string | null,
  totalAmount: number,
  bookingId: string,
  isPaid: boolean,
  hostInfo?: { name?: string; email?: string; phone?: string }
): string {
  const details = typeof bookingDetails === 'string'
    ? JSON.parse(bookingDetails)
    : (bookingDetails || {});

  const safeGuestName = escapeHtml(guestName);
  const safeItemName  = escapeHtml(itemName);
  const typeDisplay   = bookingType.charAt(0).toUpperCase() + bookingType.slice(1);
  const qrUrl         = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(bookingId)}&bgcolor=ffffff&color=008080&margin=2`;
  const totalPeople   = (Number(details.adults) || 0) + (Number(details.children) || 0);
  const shortId       = bookingId.split('-')[0].toUpperCase();

  // ── Ticket rows ───────────────────────────────────────────────────────────
  let ticketRows = '';
  if (details.ticketSelections?.length) {
    ticketRows = details.ticketSelections.map((t: any) =>
      `<tr>
        <td class="bold">${escapeHtml(t.name || 'General')}</td>
        <td style="text-align:center;padding:9px 16px;border-top:1px solid ${SLATE_200};color:${SLATE_600};">${t.quantity}</td>
        <td class="right">KES ${(Number(t.price) * Number(t.quantity)).toLocaleString()}</td>
      </tr>`
    ).join('');
  }

  // ── Facility rows ─────────────────────────────────────────────────────────
  let facilityRows = '';
  if (details.selectedFacilities?.length) {
    facilityRows = details.selectedFacilities.map((f: any) => {
      const name = escapeHtml(typeof f === 'string' ? f : f.name || '');
      if (!name) return '';
      const days = f.startDate && f.endDate
        ? Math.max(1, Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000))
        : null;
      const dateRange = f.startDate && f.endDate
        ? `<br><span style="font-size:10px;color:${SLATE_400};">${formatDate(f.startDate)} → ${formatDate(f.endDate)} (${days} night${days === 1 ? '' : 's'})</span>`
        : '';
      const lineTotal = days && f.price ? `KES ${(Number(f.price) * days).toLocaleString()}` : (f.price ? `KES ${Number(f.price).toLocaleString()}/day` : '—');
      return `<tr>
        <td class="bold">${name}${dateRange}</td>
        <td style="text-align:center;padding:9px 16px;border-top:1px solid ${SLATE_200};color:${SLATE_600};">${days ?? '—'}</td>
        <td class="right">${lineTotal}</td>
      </tr>`;
    }).filter(Boolean).join('');
  }

  // ── Activity rows ─────────────────────────────────────────────────────────
  let activityRows = '';
  if (details.selectedActivities?.length) {
    activityRows = details.selectedActivities.map((a: any) => {
      const name = escapeHtml(typeof a === 'string' ? a : a.name || '');
      if (!name) return '';
      const qty   = a.numberOfPeople || 1;
      const price = a.price ? Number(a.price) : 0;
      return `<tr>
        <td class="bold">${name}</td>
        <td style="text-align:center;padding:9px 16px;border-top:1px solid ${SLATE_200};color:${SLATE_600};">${qty} pax</td>
        <td class="right">${price ? `KES ${(price * qty).toLocaleString()}` : '—'}</td>
      </tr>`;
    }).filter(Boolean).join('');
  }

  const ticketBlock = ticketRows ? `
    <div class="section">
      <div class="extras-card">
        <div class="extras-header teal">🎟 Tickets</div>
        <table class="extras-table">
          <thead><tr>
            <th>Type</th>
            <th style="text-align:center;padding:8px 16px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${SLATE_400};background:${SLATE_50};">Qty</th>
            <th class="right">Amount</th>
          </tr></thead>
          <tbody>${ticketRows}</tbody>
        </table>
      </div>
    </div>` : '';

  const facilityBlock = facilityRows ? `
    <div class="section">
      <div class="extras-card">
        <div class="extras-header slate">🏠 Facilities</div>
        <table class="extras-table">
          <thead><tr>
            <th>Facility</th>
            <th style="text-align:center;padding:8px 16px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${SLATE_400};background:${SLATE_50};">Nights</th>
            <th class="right">Total</th>
          </tr></thead>
          <tbody>${facilityRows}</tbody>
        </table>
      </div>
    </div>` : '';

  const activityBlock = activityRows ? `
    <div class="section">
      <div class="extras-card">
        <div class="extras-header coral">🏄 Activities</div>
        <table class="extras-table">
          <thead><tr>
            <th>Activity</th>
            <th style="text-align:center;padding:8px 16px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${SLATE_400};background:${SLATE_50};">People</th>
            <th class="right">Total</th>
          </tr></thead>
          <tbody>${activityRows}</tbody>
        </table>
      </div>
    </div>` : '';

  const hostBlock = (hostInfo && (hostInfo.name || hostInfo.email || hostInfo.phone)) ? `
    <div class="section">
      <div class="section-label">Host Contact</div>
      <div class="host-card">
        ${hostInfo.name ? `<div class="host-name">${escapeHtml(hostInfo.name)}</div>` : ''}
        <div class="host-meta">
          ${hostInfo.email ? `📧 ${escapeHtml(hostInfo.email)}<br>` : ''}
          ${hostInfo.phone ? `📞 ${escapeHtml(hostInfo.phone)}` : ''}
        </div>
      </div>
    </div>` : '';

  const qrOrPayBlock = isPaid ? `
    <div class="qr-section">
      <div class="qr-label">Your QR Check-In Code</div>
      <div class="qr-sublabel">Show this at the venue for instant check-in</div>
      <div class="qr-img">
        <img src="${qrUrl}" alt="Booking QR Code" width="180" height="180" style="display:block;" />
      </div>
      <div style="margin-top:12px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:${SLATE_400};">ID: ${escapeHtml(shortId)}</div>
    </div>` : `
    <div class="section">
      <div class="pay-card">
        <div class="pay-title">⏳ Payment Required</div>
        <div class="pay-body">Your booking is reserved but not yet confirmed. Please complete payment to receive your QR check-in code and finalize your reservation.</div>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Booking ${isPaid ? 'Confirmed' : 'Submitted'} – ${escapeHtml(itemName)}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
<div class="wrapper">
<div class="card">

  <!-- ── HEADER ────────────────────────────────── -->
  <div class="header">
    <div class="header-logo">Realtravo</div>
    <div class="header-badge">
      <div class="header-badge-dot${isPaid ? '' : ' pending'}"></div>
      <span class="header-badge-text">${isPaid ? 'Payment Confirmed' : 'Pending Payment'}</span>
    </div>
    <div class="header-title">${isPaid ? 'Booking Confirmed!' : 'Booking Submitted'}</div>
    <div class="header-subtitle">${escapeHtml(safeItemName)} · ${typeDisplay}</div>
  </div>

  <!-- ── BOOKING ID STRIP ───────────────────────── -->
  <div class="booking-id-strip">
    <span class="booking-id-label">Booking Reference</span>
    <span class="booking-id-value">${escapeHtml(bookingId)}</span>
  </div>

  <!-- ── BODY ──────────────────────────────────── -->
  <div class="body">

    <p class="greeting">
      Dear <strong>${safeGuestName}</strong>,<br>
      ${isPaid
        ? 'Great news! Your payment has been received and your booking is fully confirmed. Everything you need is below.'
        : 'Thank you for your booking! Your reservation is held and awaiting payment. Complete payment to confirm your spot.'}
    </p>

    <!-- Amount hero -->
    <div class="amount-card">
      <div>
        <div class="amount-label">Total Amount</div>
        <div class="amount-value">KES ${Number(totalAmount).toLocaleString()}</div>
      </div>
      <span class="status-pill ${isPaid ? 'status-paid' : 'status-pending'}">
        ${isPaid ? '✓ Paid' : '⏳ Pending'}
      </span>
    </div>

    <!-- Booking summary info card -->
    <div class="section">
      <div class="section-label">Booking Summary</div>
      <div class="info-card">
        <div class="info-row">
          <span class="info-key">Item</span>
          <span class="info-val">${safeItemName}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Category</span>
          <span class="info-val">${escapeHtml(typeDisplay)}</span>
        </div>
        ${visitDate ? `
        <div class="info-row">
          <span class="info-key">Visit Date</span>
          <span class="info-val">${escapeHtml(formatDate(String(visitDate)))}</span>
        </div>` : ''}
        ${totalPeople > 0 ? `
        <div class="info-row">
          <span class="info-key">Guests</span>
          <span class="info-val">${Number(details.adults) || 0} Adults · ${Number(details.children) || 0} Children</span>
        </div>` : ''}
        ${details.rooms ? `
        <div class="info-row">
          <span class="info-key">Rooms</span>
          <span class="info-val">${Number(details.rooms)}</span>
        </div>` : ''}
      </div>
    </div>

    <!-- Guest info card -->
    <div class="section">
      <div class="section-label">Guest Details</div>
      <div class="info-card">
        <div class="info-row">
          <span class="info-key">Name</span>
          <span class="info-val">${safeGuestName}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Email</span>
          <span class="info-val">${escapeHtml(guestEmail)}</span>
        </div>
        ${guestPhone ? `
        <div class="info-row">
          <span class="info-key">Phone</span>
          <span class="info-val">${escapeHtml(guestPhone)}</span>
        </div>` : ''}
      </div>
    </div>

    <!-- Extras: tickets / facilities / activities -->
    ${ticketBlock}
    ${facilityBlock}
    ${activityBlock}

    <!-- Host contact -->
    ${hostBlock}

    <!-- QR code or payment instructions -->
    ${qrOrPayBlock}

    <p style="font-size:13px;color:${SLATE_600};line-height:1.6;margin-top:8px;">
      Thank you for choosing <strong style="color:${TEAL};">Realtravo</strong>. We look forward to welcoming you!
    </p>

  </div><!-- /body -->

  <!-- ── FOOTER ─────────────────────────────────── -->
  <div class="footer">
    <div class="footer-brand">Realtravo</div>
    <div class="footer-note">
      This is an automated confirmation email — please do not reply.<br>
      For support, visit <a href="https://realtravo.com" style="color:${TEAL};text-decoration:none;">realtravo.com</a>
    </div>
  </div>

</div><!-- /card -->
</div><!-- /wrapper -->
</body>
</html>`;
}

// ─── Host notification HTML (lighter, same palette) ─────────────────────────
function buildHostEmailHTML(
  hostName: string,
  guestName: string,
  guestEmail: string,
  guestPhone: string,
  itemName: string,
  visitDate: string | null,
  totalAmount: number,
  bookingId: string,
  isPaid: boolean,
  details: any
): string {
  const safeHostName  = escapeHtml(hostName);
  const safeGuestName = escapeHtml(guestName);
  const safeItemName  = escapeHtml(itemName);
  const totalPeople   = (Number(details.adults) || 0) + (Number(details.children) || 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>New Booking – ${escapeHtml(itemName)}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
<div class="wrapper">
<div class="card">

  <div class="header">
    <div class="header-logo">Realtravo · Host Notification</div>
    <div class="header-badge">
      <div class="header-badge-dot${isPaid ? '' : ' pending'}"></div>
      <span class="header-badge-text">${isPaid ? 'Paid Booking' : 'Pending Payment'}</span>
    </div>
    <div class="header-title">🎉 New Booking!</div>
    <div class="header-subtitle">${safeItemName}</div>
  </div>

  <div class="booking-id-strip">
    <span class="booking-id-label">Booking Reference</span>
    <span class="booking-id-value">${escapeHtml(bookingId)}</span>
  </div>

  <div class="body">

    <p class="greeting">
      Dear <strong>${safeHostName}</strong>,<br>
      You have received a new booking for <strong>${safeItemName}</strong>. Please review the guest details below and prepare accordingly.
    </p>

    <div class="amount-card">
      <div>
        <div class="amount-label">Booking Amount</div>
        <div class="amount-value">KES ${Number(totalAmount).toLocaleString()}</div>
      </div>
      <span class="status-pill ${isPaid ? 'status-paid' : 'status-pending'}">
        ${isPaid ? '✓ Paid' : '⏳ Pending'}
      </span>
    </div>

    <div class="section">
      <div class="section-label">Guest Information</div>
      <div class="info-card">
        <div class="info-row">
          <span class="info-key">Guest Name</span>
          <span class="info-val">${safeGuestName}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Email</span>
          <span class="info-val">${escapeHtml(guestEmail)}</span>
        </div>
        ${guestPhone ? `
        <div class="info-row">
          <span class="info-key">Phone</span>
          <span class="info-val">${escapeHtml(guestPhone)}</span>
        </div>` : ''}
        ${visitDate ? `
        <div class="info-row">
          <span class="info-key">Visit Date</span>
          <span class="info-val">${escapeHtml(formatDate(String(visitDate)))}</span>
        </div>` : ''}
        ${totalPeople > 0 ? `
        <div class="info-row">
          <span class="info-key">Guests</span>
          <span class="info-val">${Number(details.adults) || 0} Adults · ${Number(details.children) || 0} Children</span>
        </div>` : ''}
        ${details.rooms ? `
        <div class="info-row">
          <span class="info-key">Rooms</span>
          <span class="info-val">${Number(details.rooms)}</span>
        </div>` : ''}
      </div>
    </div>

    <p style="font-size:13px;color:${SLATE_600};line-height:1.6;">
      View the full booking details and manage your listing in your
      <a href="https://realtravo.com/dashboard" style="color:${TEAL};font-weight:700;text-decoration:none;">Realtravo Dashboard</a>.
    </p>

  </div>

  <div class="footer">
    <div class="footer-brand">Realtravo · Host Portal</div>
    <div class="footer-note">This is an automated host notification — please do not reply.</div>
  </div>

</div>
</div>
</body>
</html>`;
}

// ─── Main handler ────────────────────────────────────────────────────────────
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

    const isPaid = paymentStatus === 'paid' || paymentStatus === 'completed'
      || booking.payment_status === 'paid' || booking.payment_status === 'completed';

    const bookingDetailsObject = typeof bookingDetails === 'string'
      ? JSON.parse(bookingDetails)
      : (bookingDetails || {});

    const guestPhone = bookingDetailsObject.phone || booking.guest_phone || '';

    // ── Resolve host contact ──────────────────────────────────────────────
    let hostInfo: { name?: string; email?: string; phone?: string } = {};
    try {
      let hostTable = 'trips';
      if (booking.booking_type === 'hotel') hostTable = 'hotels';
      else if (booking.booking_type === 'adventure' || booking.booking_type === 'adventure_place') hostTable = 'adventure_places';
      const itemSelect = hostTable === 'trips' ? 'created_by,email,phone_number' : 'created_by,email,phone_numbers';
      const { data: itemRow } = await supabaseClient.from(hostTable).select(itemSelect).eq('id', booking.item_id).single();
      const itemPhone = itemRow
        ? ((itemRow as any).phone_number || ((itemRow as any).phone_numbers && (itemRow as any).phone_numbers[0]))
        : undefined;
      if (itemRow?.created_by) {
        const { data: hostProfile } = await supabaseClient.from('profiles').select('email,name,phone_number').eq('id', itemRow.created_by).single();
        hostInfo = {
          name:  hostProfile?.name || undefined,
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

    // ── Send guest email ──────────────────────────────────────────────────
    const guestEmailHTML = buildGuestEmailHTML(
      bookingDetails, guestName, recipientEmail, guestPhone,
      bookingType, itemName, visitDate || null,
      totalAmount, bookingId, isPaid, hostInfo
    );

    const { error: sendError } = await resend.emails.send({
      from: "Realtravo <noreply@realtravo.com>",
      to: [recipientEmail],
      subject: `Booking ${isPaid ? 'Confirmed ✓' : 'Submitted'} – ${escapeHtml(itemName)}`,
      html: guestEmailHTML,
    });

    if (sendError) {
      console.error("Error sending guest email:", sendError);
    } else {
      console.log("Guest booking email sent to:", recipientEmail);
    }

    // ── Send host notification ────────────────────────────────────────────
    try {
      let tableName = 'trips';
      if (booking.booking_type === 'hotel') tableName = 'hotels';
      else if (booking.booking_type === 'adventure' || booking.booking_type === 'adventure_place') tableName = 'adventure_places';

      const { data: item } = await supabaseClient.from(tableName).select('created_by').eq('id', booking.item_id).single();

      if (item?.created_by) {
        const { data: host } = await supabaseClient.from('profiles').select('email, name').eq('id', item.created_by).single();

        if (host?.email) {
          const hostEmailHTML = buildHostEmailHTML(
            host.name || 'Host',
            guestName, recipientEmail, guestPhone,
            itemName, visitDate || null, totalAmount,
            bookingId, isPaid, bookingDetailsObject
          );

          await resend.emails.send({
            from: "Realtravo <noreply@realtravo.com>",
            to: [host.email],
            subject: `New Booking – ${escapeHtml(itemName)}`,
            html: hostEmailHTML,
          });
          console.log("Host notification email sent to:", host.email);
        }
      }
    } catch (hostError) {
      console.error("Failed to send host notification:", hostError);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-booking-confirmation:", error);
    return new Response(JSON.stringify({ error: error.message || "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);