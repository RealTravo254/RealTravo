import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Input validation schema ───────────────────────────────────────────────────
const hostNotificationSchema = z.object({
  hostId:      z.string().uuid("Invalid host ID format"),
  bookingId:   z.string().uuid("Invalid booking ID format"),
  guestName:   z.string().min(1, "Guest name required").max(100, "Guest name too long"),
  itemName:    z.string().min(1, "Item name required").max(200, "Item name too long"),
  totalAmount: z.number().positive("Amount must be positive").max(10000000, "Amount too large"),
  visitDate:   z.string().optional().nullable(),
});

// ─── HTML escape (XSS prevention) ─────────────────────────────────────────────
function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Money formatter (KES) ────────────────────────────────────────────────────
const fmtMoney = (n: number) => "KES " + Math.round(n).toLocaleString("en-KE");

// ─── Date formatters ──────────────────────────────────────────────────────────
const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-KE", {
    weekday: "short", year: "numeric", month: "long", day: "numeric",
  });

const fmtShort = (d: string) =>
  new Date(d).toLocaleDateString("en-KE", {
    year: "numeric", month: "short", day: "numeric",
  });

// ─── Booking type meta ────────────────────────────────────────────────────────
const getBookingMeta = (bookingType: string, bookingDetails: Record<string, unknown>) => {
  const raw = (bookingType || "").toLowerCase();
  const d = bookingDetails || {};
  const isGuidedTrip =
    raw === "trip" &&
    (d.trip_type === "guided" || d.tripType === "guided" ||
     d.is_guided === true   || d.isGuided === true);

  switch (raw) {
    case "trip":
      return isGuidedTrip
        ? { typeLabel: "Tour",            contactLabel: "Tour Organizer" }
        : { typeLabel: "Trip",            contactLabel: "Trip Organizer" };
    case "event":
      return { typeLabel: "Event",          contactLabel: "Event Organizer" };
    case "adventure_place":
    case "adventure":
      return { typeLabel: "Adventure Place", contactLabel: "Premises Owner / Operator" };
    case "hotel":
      return { typeLabel: "Hotel",          contactLabel: "Hotel Management" };
    default:
      return { typeLabel: "Booking",        contactLabel: "Organizer" };
  }
};

// ─── Build the booking confirmation email HTML ────────────────────────────────
function buildBookingEmailHtml(params: {
  hostName:    string;
  guestName:   string;
  itemName:    string;
  bookingId:   string;
  totalAmount: number;
  visitDate?:  string | null;
}): string {
  const { hostName, guestName, itemName, bookingId, totalAmount, visitDate } = params;

  const safeHostName  = escapeHtml(hostName);
  const safeGuestName = escapeHtml(guestName);
  const safeItemName  = escapeHtml(itemName);
  const safeBookingId = escapeHtml(bookingId);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body          { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin:0; padding:0; }
          .container    { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header       { background: #008080; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content      { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .detail-box   { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #008080; }
          .footer       { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          h1            { margin: 0; font-size: 24px; }
          h2            { color: #008080; font-size: 20px; margin-top: 0; }
          .amount       { font-size: 28px; color: #008080; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 New Paid Booking!</h1>
          </div>
          <div class="content">
            <p>Dear ${safeHostName},</p>
            <p>Great news! You have received a new paid booking for your listing.</p>
            <div class="detail-box">
              <h2>Booking Details</h2>
              <p><strong>Booking ID:</strong> ${safeBookingId}</p>
              <p><strong>Guest Name:</strong> ${safeGuestName}</p>
              <p><strong>Item:</strong> ${safeItemName}</p>
              ${visitDate ? `<p><strong>Visit Date:</strong> ${escapeHtml(String(visitDate))}</p>` : ""}
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
              <p class="amount">Amount: ${fmtMoney(totalAmount)}</p>
            </div>
            <p>Please prepare to welcome your guest. You can view full booking details in your dashboard.</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// ─── Build the booking confirmation PDF (returns base64 PNG pages via canvas) ─
// NOTE: Full PDF generation with jsPDF is browser-only. In this edge function we
// generate a richly-structured HTML email that mirrors every section of the PDF
// produced by downloadBooking() in Bookings.tsx. If you need an actual PDF
// attachment, use a headless-browser service (e.g. Browserless) or a PDF API
// (e.g. PDFShift) and pass the HTML below to it.
function buildBookingPdfHtml(booking: {
  id:              string;
  booking_type:    string;
  total_amount:    number;
  booking_details: Record<string, unknown>;
  payment_status:  string;
  status:          string;
  created_at:      string;
  visit_date?:     string | null;
  slots_booked?:   number | null;
  guest_name?:     string | null;
  guest_email?:    string | null;
  guest_phone?:    string | null;
  host_phone?:     string | null;
  host_email?:     string | null;
}): string {
  const d   = (booking.booking_details || {}) as Record<string, unknown>;
  const { typeLabel, contactLabel } = getBookingMeta(booking.booking_type, d);

  const itemName =
    (d.item_name as string)  || (d.trip_name as string)  ||
    (d.event_name as string) || (d.hotel_name as string) ||
    (d.place_name as string) || "Booking";

  // ── Resolve host contact from every possible location ──────────────────────
  const hostPhone =
    booking.host_phone ||
    (d.host_phone as string) ||
    ((d.emailData as Record<string,unknown>)?.hostPhone as string) ||
    (d.phone_number as string) ||
    (Array.isArray(d.phone_numbers) ? (d.phone_numbers as string[])[0] : "") ||
    "";

  const hostEmail =
    booking.host_email ||
    (d.host_email as string) ||
    ((d.emailData as Record<string,unknown>)?.hostEmail as string) ||
    (d.email as string) ||
    "";

  const listingName     = (d.item_name    as string) || (d.name    as string) || itemName;
  const listingLocation = (d.location     as string) || (d.locationName as string) || "";
  const listingPlace    = (d.place        as string) || "";
  const listingCountry  = (d.country      as string) || "";
  const openingHours    = (d.opening_hours as string) || (d.openingHours as string) || "";
  const closingHours    = (d.closing_hours as string) || (d.closingHours as string) || "";
  const daysOpened      = (d.days_opened  as string[]) || (d.workingDays as string[]) || [];
  const eventCategory   = (d.event_category as string) || "";
  const registrationNum = (d.registration_number as string) || (d.registrationNumber as string) || "";
  const entranceFeeType = (d.entry_fee_type as string) || (d.entranceFeeType as string) || "";
  const rescheduledAt   = (d.rescheduled_at as string) || "";
  const eventDate       = (d.date as string) || "";

  const gName  = booking.guest_name  || (d.guest_name  as string) || "";
  const gEmail = booking.guest_email || (d.guest_email as string) || "";
  const gPhone = booking.guest_phone || (d.guest_phone as string) || "";

  const adults   = (d.adults   as number|string) || (d.num_adults   as number|string) || null;
  const children = (d.children as number|string) || (d.num_children as number|string) || null;

  const tickets   = (d.ticketSelections   as Record<string,unknown>[]) || (d.ticket_selections as Record<string,unknown>[]) || [];
  const acts      = (d.selectedActivities as Record<string,unknown>[]) || (d.activities        as Record<string,unknown>[]) || [];
  const facs      = (d.selectedFacilities as Record<string,unknown>[]) || (d.facilities        as Record<string,unknown>[]) || [];

  const locationLine = [listingLocation, listingPlace, listingCountry].filter(Boolean).join(", ");

  // status colour
  const statusMap: Record<string, string> = {
    confirmed: "#10b981", paid: "#10b981",
    pending:   "#f59e0b", cancelled: "#ef4444",
  };
  const statusColor = statusMap[(booking.status || "").toLowerCase()] ?? "#64748b";

  // ── Section / row helpers (inline HTML) ───────────────────────────────────
  const section = (title: string) => `
    <div style="margin-top:24px;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
      <div style="width:3px;height:18px;background:#008080;border-radius:2px;flex-shrink:0;"></div>
      <div style="flex:1;background:#f0fdf4;border-radius:4px;padding:5px 10px;">
        <span style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#008080;">${escapeHtml(title)}</span>
      </div>
    </div>`;

  const infoRow = (label: string, value: string|number|null|undefined) => {
    if (value === undefined || value === null || String(value).trim() === "") return "";
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;background:#f8f9fa;border-radius:6px;padding:8px 12px;margin-bottom:4px;">
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;">${escapeHtml(label)}</span>
        <span style="font-size:12px;font-weight:600;color:#334155;text-align:right;max-width:60%;">${escapeHtml(String(value))}</span>
      </div>`;
  };

  const tableHeader = (left: string, right: string) => `
    <div style="display:flex;justify-content:space-between;background:#008080;border-radius:6px;padding:7px 12px;margin-bottom:3px;">
      <span style="font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(left)}</span>
      <span style="font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(right)}</span>
    </div>`;

  const tableRow = (left: string, right: string, sub?: string) => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;background:#f8f9fa;border-radius:6px;padding:9px 12px;margin-bottom:4px;">
      <div style="max-width:65%;">
        <div style="font-size:12px;font-weight:600;color:#334155;">${escapeHtml(left)}</div>
        ${sub ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px;">${escapeHtml(sub)}</div>` : ""}
      </div>
      <span style="font-size:12px;font-weight:700;color:#008080;">${escapeHtml(right)}</span>
    </div>`;

  // ── Assemble sections ──────────────────────────────────────────────────────

  // 1. Booking Information
  let bookingInfoSection = section("BOOKING INFORMATION");
  bookingInfoSection += infoRow("Booking ID",      booking.id);
  bookingInfoSection += infoRow("Payment Status",  (booking.payment_status || "").toUpperCase());
  bookingInfoSection += infoRow("Total Amount",    fmtMoney(booking.total_amount));
  bookingInfoSection += infoRow("Booked On",       fmt(booking.created_at));
  if (booking.visit_date)  bookingInfoSection += infoRow("Visit Date",      fmt(booking.visit_date));
  if (eventDate)           bookingInfoSection += infoRow("Event Date",      fmt(eventDate));
  if (rescheduledAt)       bookingInfoSection += infoRow("Rescheduled On",  fmt(rescheduledAt));
  if (eventCategory)       bookingInfoSection += infoRow("Event Category",  eventCategory);
  if (registrationNum)     bookingInfoSection += infoRow("Reg. Number",     registrationNum);
  if (entranceFeeType)     bookingInfoSection += infoRow("Entrance Type",   entranceFeeType.toUpperCase());
  if (openingHours && closingHours) bookingInfoSection += infoRow("Operating Hours", `${openingHours} – ${closingHours}`);
  if (Array.isArray(daysOpened) && daysOpened.length)
    bookingInfoSection += infoRow("Open Days", daysOpened.join(", "));

  // 2. Guest Details
  let guestSection = "";
  if (gName || gEmail || gPhone) {
    guestSection = section("GUEST DETAILS");
    if (gName)  guestSection += infoRow("Name",  gName);
    if (gEmail) guestSection += infoRow("Email", gEmail);
    if (gPhone) guestSection += infoRow("Phone", gPhone);
  }

  // 3. Booking Details
  let detailsSection = section("BOOKING DETAILS");
  if (adults)                detailsSection += infoRow("Adults",       String(adults));
  if (children)              detailsSection += infoRow("Children",     String(children));
  if (booking.slots_booked)  detailsSection += infoRow("Slots Booked", String(booking.slots_booked));
  if (locationLine)          detailsSection += infoRow("Location",     locationLine);

  // 4. Tickets
  let ticketsSection = "";
  if (tickets.length) {
    ticketsSection = section("TICKETS");
    ticketsSection += tableHeader("TICKET TYPE", "SUBTOTAL");
    for (const t of tickets) {
      const qty = (t.quantity as number) || 1;
      ticketsSection += tableRow(
        String(t.name || ""),
        fmtMoney(((t.price as number) || 0) * qty),
        `${qty} person${qty > 1 ? "s" : ""} × ${fmtMoney((t.price as number) || 0)} per ticket`
      );
    }
  }

  // 5. Activities
  let actsSection = "";
  if (acts.length) {
    actsSection = section("ACTIVITIES");
    actsSection += tableHeader("ACTIVITY  /  PEOPLE", "SUBTOTAL");
    for (const a of acts) {
      const ppl = (a.numberOfPeople as number) || (a.number_of_people as number) || 1;
      const sub = (a.price as number || 0) * ppl;
      actsSection += tableRow(
        String(a.name || ""),
        fmtMoney(sub),
        `${ppl} person${ppl > 1 ? "s" : ""} × ${fmtMoney((a.price as number) || 0)} per person`
      );
    }
  }

  // 6. Facilities
  let facsSection = "";
  if (facs.length) {
    facsSection = section("FACILITIES");
    facsSection += tableHeader("FACILITY  /  DATES", "PRICE");
    for (const f of facs) {
      let sub = "";
      let price = (f.price as number) || 0;
      if (f.startDate && f.endDate) {
        const days = Math.max(1, Math.ceil(
          (new Date(f.endDate as string).getTime() - new Date(f.startDate as string).getTime()) / 86400000
        ));
        price = ((f.price as number) || 0) * days;
        sub   = `From: ${fmtShort(f.startDate as string)}  →  To: ${fmtShort(f.endDate as string)}  (${days} day${days > 1 ? "s" : ""} × ${fmtMoney((f.price as number) || 0)}/day)`;
      }
      const ppl = (f.numberOfPeople as number) || (f.number_of_people as number);
      if (ppl) sub += (sub ? "  ·  " : "") + `${ppl} person${ppl > 1 ? "s" : ""}`;
      facsSection += tableRow(String(f.name || ""), fmtMoney(price), sub || undefined);
    }
  }

  // 7. Host / Organizer Contact (amber notice block)
  let hostSection = "";
  if (hostPhone || hostEmail) {
    hostSection = section(`${contactLabel.toUpperCase()} CONTACT`);
    hostSection += `
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:8px;">
        <div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:4px;">⚠️ Contact the ${escapeHtml(contactLabel)} below for inquiries, cancellations, refunds, or booking transfers.</div>
        <div style="font-size:10px;color:#78350f;">Please have your Booking ID ready.</div>
      </div>`;
    if (hostPhone) hostSection += infoRow("Phone", hostPhone);
    if (hostEmail) hostSection += infoRow("Email", hostEmail);
  }

  // 8. QR code (served from free API — same technique as Bookings.tsx)
  const qrText   = `REALTRAVO|${booking.id}|${listingName}|${gName}|KES ${Math.round(booking.total_amount)}|${booking.visit_date || eventDate || booking.created_at}`;
  const qrUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrText)}&color=008080&bgcolor=ffffff&margin=4`;

  const qrSection = `
    <div style="background:#f8f9fa;border:1px solid #008080;border-radius:12px;padding:20px;display:flex;gap:20px;align-items:flex-start;margin-top:16px;">
      <img src="${qrUrl}" width="140" height="140" alt="Booking QR Code" style="border-radius:8px;flex-shrink:0;" />
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:800;color:#008080;margin-bottom:6px;">BOOKING QR CODE</div>
        <div style="font-size:11px;color:#64748b;line-height:1.6;margin-bottom:10px;">
          Scan this QR code at the venue to verify your booking. Present this email or the QR code on your mobile device to the host.
        </div>
        <div style="font-size:10px;font-weight:700;color:#334155;font-family:monospace;word-break:break-all;">Booking ID: ${escapeHtml(booking.id)}</div>

        ${(hostPhone || hostEmail) ? `
        <div style="margin-top:14px;border-top:1px dashed #cbd5e1;padding-top:12px;">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#008080;margin-bottom:8px;">${escapeHtml(contactLabel)} Contact</div>
          ${hostPhone ? `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:11px;">📞</span>
            <a href="tel:${escapeHtml(hostPhone)}" style="font-size:12px;font-weight:700;color:#0f766e;text-decoration:none;">${escapeHtml(hostPhone)}</a>
          </div>` : ""}
          ${hostEmail ? `
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:11px;">✉️</span>
            <a href="mailto:${escapeHtml(hostEmail)}" style="font-size:12px;font-weight:700;color:#0f766e;text-decoration:none;">${escapeHtml(hostEmail)}</a>
          </div>` : ""}
        </div>` : ""}
      </div>
    </div>`;

  // ── Full document ──────────────────────────────────────────────────────────
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; background: #f1f5f9; color: #334155; }
          .wrap { max-width: 660px; margin: 0 auto; background: #fff; }
        </style>
      </head>
      <body>
        <div class="wrap">

          <!-- ── HEADER BANNER ── -->
          <div style="background:#008080;padding:28px 32px 24px;position:relative;overflow:hidden;">
            <!-- coral accent triangle -->
            <div style="position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 110px 96px 0;border-color:transparent #ff7f50 transparent transparent;"></div>

            <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:0.05em;">REALTRAVO</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.15em;margin-top:4px;">BOOKING CONFIRMATION</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.6);margin-top:6px;">Ref: ${escapeHtml(booking.id)}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.6);">Generated: ${new Date().toLocaleDateString("en-KE")}</div>
          </div>

          <!-- ── STATUS + TITLE ── -->
          <div style="padding:20px 28px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:20px;font-weight:900;color:#008080;line-height:1.2;">${escapeHtml(listingName)}</div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin-top:4px;">${escapeHtml(typeLabel)} BOOKING</div>
              ${locationLine ? `<div style="font-size:11px;color:#64748b;margin-top:4px;">📍 ${escapeHtml(locationLine)}</div>` : ""}
            </div>
            <div style="background:${statusColor};color:#fff;font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:6px 16px;border-radius:999px;white-space:nowrap;flex-shrink:0;margin-top:4px;">
              ${escapeHtml(booking.status || "")}
            </div>
          </div>

          <!-- ── DIVIDER ── -->
          <div style="height:1px;background:linear-gradient(to right,#008080,transparent);margin:16px 28px;"></div>

          <!-- ── MAIN CONTENT ── -->
          <div style="padding:0 28px 28px;">

            ${bookingInfoSection}
            ${guestSection}
            ${detailsSection}
            ${ticketsSection}
            ${actsSection}
            ${facsSection}
            ${hostSection}

            <!-- ── TOTAL BOX ── -->
            <div style="background:#008080;border-radius:10px;padding:20px 24px;margin-top:24px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#fff;">TOTAL AMOUNT PAID</div>
                <div style="font-size:10px;color:rgba(255,255,255,0.6);margin-top:2px;">${escapeHtml((booking.payment_status || "").toUpperCase())}</div>
              </div>
              <div style="font-size:22px;font-weight:900;color:#fff;">${fmtMoney(booking.total_amount)}</div>
            </div>

            <!-- ── QR CODE + HOST CONTACT ── -->
            ${qrSection}

          </div>

          <!-- ── FOOTER ── -->
          <div style="background:#f0fdf4;border-top:2px solid #008080;padding:18px 28px;text-align:center;">
            <div style="font-size:14px;font-weight:800;color:#008080;margin-bottom:4px;">realtravo.com</div>
            <div style="font-size:11px;color:#64748b;">Thank you for booking with Realtravo! · support@realtravo.com</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:4px;font-family:monospace;">Booking ID: ${escapeHtml(booking.id)}</div>
          </div>

        </div>
      </body>
    </html>
  `;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Parse & validate input ──────────────────────────────────────────────
    const rawData = await req.json();

    let validatedData;
    try {
      validatedData = hostNotificationSchema.parse(rawData);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        console.error("Validation error:", validationError.errors);
        return new Response(
          JSON.stringify({ error: "Invalid input", details: validationError.errors }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw validationError;
    }

    const { hostId, bookingId, guestName, itemName, totalAmount, visitDate } = validatedData;

    // ── Supabase client ─────────────────────────────────────────────────────
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Verify booking exists and is paid ───────────────────────────────────
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select(
        "id, item_id, booking_type, payment_status, total_amount, status, created_at, " +
        "booking_details, visit_date, slots_booked, guest_name, guest_email, guest_phone, " +
        "host_phone, host_email"
      )
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("Booking not found:", bookingId);
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (booking.payment_status !== "paid" && booking.payment_status !== "completed") {
      console.error("Booking not paid:", bookingId, "Status:", booking.payment_status);
      return new Response(
        JSON.stringify({ error: "Booking is not paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Determine the table based on booking_type ───────────────────────────
    let tableName = "trips";
    if (booking.booking_type === "hotel") {
      tableName = "hotels";
    } else if (
      booking.booking_type === "adventure" ||
      booking.booking_type === "adventure_place"
    ) {
      tableName = "adventure_places";
    }

    // ── Verify the item belongs to the claimed host ─────────────────────────
    const { data: item, error: itemError } = await supabaseClient
      .from(tableName)
      .select("created_by")
      .eq("id", booking.item_id)
      .single();

    if (itemError || !item) {
      console.error("Item not found:", booking.item_id);
      return new Response(
        JSON.stringify({ error: "Item not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (item.created_by !== hostId) {
      console.error("Host does not own this item:", hostId, "vs", item.created_by);
      return new Response(
        JSON.stringify({ error: "Host does not own this item" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Get host details ────────────────────────────────────────────────────
    const { data: host, error: hostError } = await supabaseClient
      .from("profiles")
      .select("email, name")
      .eq("id", hostId)
      .single();

    if (hostError || !host || !host.email) {
      console.error("Host not found or no email:", hostId);
      return new Response(
        JSON.stringify({ error: "Host not found or no email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build email HTML (notification) ────────────────────────────────────
    const notificationHtml = buildBookingEmailHtml({
      hostName:    host.name || "Host",
      guestName,
      itemName,
      bookingId,
      totalAmount,
      visitDate,
    });

    // ── Build booking confirmation HTML (mirrors the PDF from Bookings.tsx) ─
    // Merge validated params with the full booking row so the PDF builder has
    // every field it needs (booking_details, guest_*, host_*, etc.).
    const fullBooking = {
      ...booking,
      // override with validated top-level params where the row might be stale
      guest_name:   booking.guest_name  || guestName,
      total_amount: booking.total_amount ?? totalAmount,
      visit_date:   booking.visit_date  || visitDate || null,
    };

    const confirmationHtml = buildBookingPdfHtml(fullBooking);

    // ── Send emails via Resend ──────────────────────────────────────────────
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const safeItemName = escapeHtml(itemName);

    // 1. Host notification
    const { data: hostEmailData, error: hostEmailError } = await resend.emails.send({
      from:    "Realtravo Bookings <noreply@realtravo.com>",
      to:      [host.email],
      subject: `New Paid Booking – ${safeItemName}`,
      html:    notificationHtml,
    });

    if (hostEmailError) {
      console.error("Error sending host notification email:", hostEmailError);
      throw hostEmailError;
    }

    console.log("Host notification email sent:", hostEmailData);

    // 2. Guest booking confirmation (if guest email is available)
    const guestEmailAddr = booking.guest_email || (booking.booking_details as Record<string,unknown>)?.guest_email as string || "";
    if (guestEmailAddr) {
      const { data: guestEmailData, error: guestEmailError } = await resend.emails.send({
        from:    "Realtravo Bookings <noreply@realtravo.com>",
        to:      [guestEmailAddr],
        subject: `Your Booking Confirmation – ${safeItemName}`,
        html:    confirmationHtml,
      });

      if (guestEmailError) {
        // Non-fatal — log but don't fail the whole request
        console.error("Error sending guest confirmation email:", guestEmailError);
      } else {
        console.log("Guest confirmation email sent:", guestEmailData);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: hostEmailData }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-host-booking-notification function:", error);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);