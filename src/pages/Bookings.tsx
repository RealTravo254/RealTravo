import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { getLocalBookings, updateLocalBooking } from "@/lib/localBookings";
import { Button } from "@/components/ui/button";
import {
  Calendar, Users, MapPin, CalendarClock,
  X, CheckCircle, Download, ChevronDown, ChevronUp,
  Activity, Building2, Ticket, Phone,
  Mail, AlertTriangle, LogIn, UserPlus, BookOpenCheck,
} from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used across the detail pages: deep
// forest for structure and brand marks, a warm clay for the primary action,
// and a dry-grass gold for caution/pending states. Ink is a green-tinted
// charcoal rather than pure black.
const FOREST       = "#1F4D3A";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const CLAY_LIGHT   = "#E0824F";
const CLAY_SOFT    = "#F7E9E5";
const GOLD         = "#B98A2A";
const GOLD_SOFT    = "#FBF2DD";
const GOLD_TEXT    = "#8A6716";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";
const SUCCESS      = "#2F6F4E";
const SUCCESS_SOFT = "#EAF3EC";
const DANGER       = "#9C3B2B";
const DANGER_SOFT  = "#F7E9E5";
const INFO         = "#3E5590";
const INFO_SOFT    = "#EEF1F8";

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Injects the two typefaces once, without needing to touch the app's index.html.
const useInjectFonts = () => {
  useEffect(() => {
    const id = "adventure-detail-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  booking_type: string;
  total_amount: number;
  booking_details: any;
  payment_status: string;
  status: string;
  created_at: string;
  visit_date?: string;
  slots_booked?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  host_phone?: string;
  host_email?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RESCHEDULABLE_TYPES = ["trip", "event", "hotel", "adventure_place", "adventure"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isReschedulable = (booking: Booking) => {
  const type   = booking.booking_type?.toLowerCase();
  const status = booking.status?.toLowerCase();
  const alreadyRescheduled = !!booking.booking_details?.rescheduled_at;
  return (
    RESCHEDULABLE_TYPES.includes(type) &&
    (status === "confirmed" || status === "pending") &&
    !alreadyRescheduled
  );
};

const getTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString(undefined, {
    weekday: "short", year: "numeric", month: "long", day: "numeric",
  });

const fmtShort = (d: string) =>
  new Date(d).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });

const fmtMoney = (n: number) =>
  "KES " + Math.round(n).toLocaleString("en-KE");

const getBookingMeta = (booking: Booking): { typeLabel: string; contactLabel: string } => {
  const raw = booking.booking_type?.toLowerCase();
  const d = booking.booking_details || {};
  const isGuidedTrip =
    raw === "trip" &&
    (d.trip_type === "guided" || d.tripType === "guided" ||
     d.is_guided === true || d.isGuided === true);
  switch (raw) {
    case "trip":
      return isGuidedTrip
        ? { typeLabel: "Tour",           contactLabel: "Tour Organizer" }
        : { typeLabel: "Trip",           contactLabel: "Trip Organizer" };
    case "event":
      return { typeLabel: "Event",         contactLabel: "Event Organizer" };
    case "adventure_place":
    case "adventure":
      return { typeLabel: "Adventure Place", contactLabel: "Premises Owner / Operator" };
    case "hotel":
      return { typeLabel: "Hotel",         contactLabel: "Hotel Management" };
    default:
      return { typeLabel: "Booking",       contactLabel: "Organizer" };
  }
};

// ── QR Code generator (canvas via free API — no extra dependency) ─────────────
const generateQRDataUrl = (text: string, size = 120): Promise<string> =>
  new Promise((resolve) => {
    try {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=1f4d3a&bgcolor=ffffff&margin=4`;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) { ctx.drawImage(img, 0, 0, size, size); resolve(canvas.toDataURL("image/png")); }
        else resolve("");
      };
      img.onerror = () => resolve("");
      img.src = url;
    } catch { resolve(""); }
  });

// ─── Status pill ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  confirmed: { bg: SUCCESS_SOFT, text: SUCCESS,   border: `${SUCCESS}40` },
  paid:      { bg: SUCCESS_SOFT, text: SUCCESS,   border: `${SUCCESS}40` },
  pending:   { bg: GOLD_SOFT,    text: GOLD_TEXT, border: `${GOLD}50` },
  cancelled: { bg: DANGER_SOFT,  text: DANGER,    border: `${DANGER}40` },
  unpaid:    { bg: CANVAS,       text: INK_SOFT,  border: HAIRLINE },
};

// Uses inline styles rather than Tailwind arbitrary-value classes, since
// those class names are built from runtime variables and Tailwind's JIT
// compiler can only pick up class names that appear literally in source.
const StatusPill = ({ status }: { status: string }) => {
  const s = STATUS_STYLES[status?.toLowerCase()] ?? { bg: CANVAS, text: INK_SOFT, border: HAIRLINE };
  return (
    <span
      className="text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border"
      style={{ background: s.bg, color: s.text, borderColor: s.border, fontFamily: FONT_BODY }}
    >
      {status}
    </span>
  );
};

// ─── Detail row ───────────────────────────────────────────────────────────────

const Row = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
  <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: `1px dashed ${HAIRLINE}` }}>
    <Icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: FOREST }} />
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>{label}</p>
      <p className="text-[13px] font-semibold break-words" style={{ color: INK }}>{value || "—"}</p>
    </div>
  </div>
);

// ─── PDF download ─────────────────────────────────────────────────────────────

const downloadBooking = async (booking: Booking) => {
  const d   = booking.booking_details || {};
  const { typeLabel, contactLabel } = getBookingMeta(booking);

  const itemName =
    d.item_name || d.trip_name || d.event_name ||
    d.hotel_name || d.place_name || "Booking";

  // ── Resolve ALL contact fields from every possible location ──────────────
  const hostPhone =
    booking.host_phone ||
    d.host_phone ||
    d.emailData?.hostPhone ||
    d.phone_number ||
    (Array.isArray(d.phone_numbers) ? d.phone_numbers[0] : "") ||
    "";

  const hostEmail =
    booking.host_email ||
    d.host_email ||
    d.emailData?.hostEmail ||
    d.email ||
    "";

  // Listing details captured from the creation form
  const listingName     = d.item_name    || d.name    || itemName;
  const listingLocation = d.location     || d.locationName || "";
  const listingPlace    = d.place        || "";
  const listingCountry  = d.country      || "";
  const openingHours    = d.opening_hours || d.openingHours || "";
  const closingHours    = d.closing_hours || d.closingHours || "";
  const daysOpened      = d.days_opened  || d.workingDays  || [];
  const eventCategory   = d.event_category || "";
  const registrationNum = d.registration_number || d.registrationNumber || "";
  const entranceFeeType = d.entry_fee_type || d.entranceFeeType || "";

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W   = doc.internal.pageSize.getWidth();
  const H   = doc.internal.pageSize.getHeight();

  // ── Palette used inside the PDF, mirroring the on-page design tokens ────
  const FOREST_RGB:      [number,number,number] = [31,77,58];    // FOREST
  const FOREST_TINT_RGB: [number,number,number] = [234,240,234]; // FOREST_SOFT
  const CLAY_RGB:        [number,number,number] = [193,85,47];   // CLAY
  const INK_RGB:         [number,number,number] = [28,43,34];    // INK
  const CANVAS_RGB:      [number,number,number] = [244,246,242]; // CANVAS
  const INK_SOFT_RGB:    [number,number,number] = [91,107,96];   // INK_SOFT
  const GOLD_TEXT_RGB:   [number,number,number] = [138,103,22];  // GOLD_TEXT
  const GOLD_SOFT_RGB:   [number,number,number] = [251,242,221]; // GOLD_SOFT
  const WHITE:           [number,number,number] = [255,255,255];
  const SUCCESS_RGB:     [number,number,number] = [47,111,78];   // SUCCESS
  const SOFT_MINT_RGB:   [number,number,number] = [200,224,208]; // pale forest text-on-dark

  let y = 0;
  const M = 36;
  const CW = W - M * 2;

  // ── Helpers ───────────────────────────────────────────────────
  const newPage = (need = 40) => {
    if (y > H - need - 60) { doc.addPage(); y = 40; }
  };

  const section = (title: string) => {
    newPage(50);
    y += 4;
    doc.setFillColor(...FOREST_RGB);
    doc.rect(M, y, 3, 13, "F");
    doc.setFillColor(...FOREST_TINT_RGB);
    doc.roundedRect(M + 3, y, CW - 3, 13, 2, 2, "F");
    doc.setTextColor(...FOREST_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(title, M + 10, y + 9.5);
    y += 22;
  };

  const infoRow = (label: string, value: string | number | null | undefined) => {
    if (value === undefined || value === null || String(value).trim() === "") return;
    newPage(28);
    const valStr = String(value);
    const maxW   = CW - 100;
    const lines: string[] = doc.splitTextToSize(valStr, maxW);
    const rowH = lines.length > 1 ? 14 + lines.length * 11 : 22;
    doc.setFillColor(...CANVAS_RGB);
    doc.roundedRect(M, y, CW, rowH, 3, 3, "F");
    doc.setTextColor(...INK_SOFT_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(String(label).toUpperCase(), M + 8, y + 9);
    doc.setTextColor(...INK_RGB);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (lines.length > 1) {
      lines.forEach((ln: string, i: number) =>
        doc.text(ln, W - M - 8, y + 14 + i * 11, { align: "right" })
      );
    } else {
      doc.text(valStr, W - M - 8, y + 15, { align: "right" });
    }
    y += rowH + 5;
  };

  // Table header row (forest bg)
  const tableHeader = (left: string, right: string) => {
    newPage(22);
    doc.setFillColor(...FOREST_RGB);
    doc.roundedRect(M, y, CW, 18, 3, 3, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(left,  M + 8,       y + 12);
    doc.text(right, W - M - 8,   y + 12, { align: "right" });
    y += 22;
  };

  // Table data row
  const tableRow = (left: string, right: string, sub?: string) => {
    newPage(32);
    const rowH = sub ? 32 : 22;
    doc.setFillColor(...CANVAS_RGB);
    doc.roundedRect(M, y, CW, rowH, 3, 3, "F");
    doc.setTextColor(...INK_RGB);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const maxL = CW - 100;
    const leftLines: string[] = doc.splitTextToSize(left, maxL);
    leftLines.slice(0, 2).forEach((ln: string, i: number) =>
      doc.text(ln, M + 8, y + 13 + i * 10)
    );
    if (sub) {
      doc.setTextColor(...INK_SOFT_RGB);
      doc.setFontSize(7);
      doc.text(sub, M + 8, y + 25, { maxWidth: maxL });
    }
    doc.setTextColor(...FOREST_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(right, W - M - 8, y + (sub ? 17 : 14), { align: "right" });
    y += rowH + 4;
  };

  // ── HEADER BANNER ─────────────────────────────────────────────
  doc.setFillColor(...FOREST_RGB);
  doc.rect(0, 0, W, 96, "F");
  doc.setFillColor(...CLAY_RGB);
  doc.triangle(W - 110, 0, W, 0, W, 96, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("REALTRAVO", M, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("BOOKING CONFIRMATION", M, 56);

  doc.setFontSize(7);
  doc.text(`Ref: ${booking.id}`, M, 70);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, M, 82);

  y = 108;

  // ── STATUS BADGE ──────────────────────────────────────────────
  const sColors: Record<string,[number,number,number]> = {
    confirmed: SUCCESS_RGB, paid: SUCCESS_RGB,
    pending: [185,138,42],  cancelled: [156,59,43],
  };
  const sc = sColors[booking.status?.toLowerCase()] ?? INK_SOFT_RGB;
  doc.setFillColor(...sc);
  doc.roundedRect(W - 132, 98, 96, 22, 11, 11, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text((booking.status || "").toUpperCase(), W - 84, 113, { align: "center" });

  // ── ITEM NAME ─────────────────────────────────────────────────
  doc.setTextColor(...FOREST_RGB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(listingName, M, y, { maxWidth: W - M * 2 - 110 });
  y += 18;

  doc.setTextColor(...INK_SOFT_RGB);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${typeLabel.toUpperCase()} BOOKING`, M, y);
  y += 10;

  // Sub-info line: location · country
  if (listingLocation || listingPlace || listingCountry) {
    const loc = [listingLocation, listingPlace, listingCountry].filter(Boolean).join(", ");
    doc.setFontSize(7.5);
    doc.text(`📍 ${loc}`, M, y + 6);
    y += 14;
  }
  y += 10;

  // ── DIVIDER ───────────────────────────────────────────────────
  doc.setDrawColor(...FOREST_RGB);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 14;

  // ─────────────────────────────────────────────────────────────
  // 1. BOOKING INFORMATION
  // ─────────────────────────────────────────────────────────────
  section("BOOKING INFORMATION");
  infoRow("Booking ID",      booking.id);
  infoRow("Payment Status",  (booking.payment_status || "").toUpperCase());
  infoRow("Total Amount",    fmtMoney(booking.total_amount));
  infoRow("Booked On",       fmt(booking.created_at));
  if (booking.visit_date)    infoRow("Visit Date",     fmt(booking.visit_date));
  if (d.date)                infoRow("Event Date",     fmt(d.date));
  if (d.rescheduled_at)      infoRow("Rescheduled On", fmt(d.rescheduled_at));
  if (eventCategory)         infoRow("Event Category", eventCategory);
  if (registrationNum)       infoRow("Reg. Number",    registrationNum);
  if (entranceFeeType)       infoRow("Entrance Type",  entranceFeeType.toUpperCase());
  if (openingHours && closingHours) infoRow("Operating Hours", `${openingHours} – ${closingHours}`);
  if (Array.isArray(daysOpened) && daysOpened.length)
                             infoRow("Open Days",      daysOpened.join(", "));
  y += 6;

  // ─────────────────────────────────────────────────────────────
  // 2. GUEST DETAILS
  // ─────────────────────────────────────────────────────────────
  const gName  = booking.guest_name  || d.guest_name;
  const gEmail = booking.guest_email || d.guest_email;
  const gPhone = booking.guest_phone || d.guest_phone;
  if (gName || gEmail || gPhone) {
    section("GUEST DETAILS");
    infoRow("Name",  gName);
    infoRow("Email", gEmail);
    infoRow("Phone", gPhone);
    y += 6;
  }

  // ─────────────────────────────────────────────────────────────
  // 3. BOOKING DETAILS
  // ─────────────────────────────────────────────────────────────
  const adults   = d.adults   || d.num_adults;
  const children = d.children || d.num_children;
  section("BOOKING DETAILS");
  infoRow("Adults",       adults);
  infoRow("Children",     children);
  infoRow("Slots Booked", booking.slots_booked);
  infoRow("Location",     d.location || d.locationName);
  y += 6;

  // ─────────────────────────────────────────────────────────────
  // 4. TICKETS
  // ─────────────────────────────────────────────────────────────
  const tickets = d.ticketSelections || d.ticket_selections;
  if (tickets?.length) {
    section("TICKETS");
    tableHeader("TICKET TYPE", "SUBTOTAL");
    tickets.forEach((t: any) => {
      const qty = t.quantity || 1;
      tableRow(
        t.name,
        fmtMoney(t.price * qty),
        `${qty} person${qty > 1 ? "s" : ""} × ${fmtMoney(t.price)} per ticket`
      );
    });
    y += 6;
  }

  // ─────────────────────────────────────────────────────────────
  // 5. ACTIVITIES
  // ─────────────────────────────────────────────────────────────
  const acts = d.selectedActivities || d.activities;
  if (acts?.length) {
    section("ACTIVITIES");
    tableHeader("ACTIVITY  /  PEOPLE", "SUBTOTAL");
    acts.forEach((a: any) => {
      const ppl = a.numberOfPeople || a.number_of_people || 1;
      const sub = (a.price || 0) * ppl;
      tableRow(
        a.name,
        fmtMoney(sub),
        `${ppl} person${ppl > 1 ? "s" : ""} × ${fmtMoney(a.price || 0)} per person`
      );
    });
    y += 6;
  }

  // ─────────────────────────────────────────────────────────────
  // 6. FACILITIES
  // ─────────────────────────────────────────────────────────────
  const facs = d.selectedFacilities || d.facilities;
  if (facs?.length) {
    section("FACILITIES");
    tableHeader("FACILITY  /  DATES", "PRICE");
    facs.forEach((f: any) => {
      let sub = "";
      let price = f.price || 0;
      if (f.startDate && f.endDate) {
        const days = Math.max(1, Math.ceil(
          (new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000
        ));
        price = (f.price || 0) * days;
        sub = `From: ${fmtShort(f.startDate)}  →  To: ${fmtShort(f.endDate)}  (${days} day${days > 1 ? "s" : ""} × ${fmtMoney(f.price || 0)}/day)`;
      }
      const ppl = f.numberOfPeople || f.number_of_people;
      if (ppl) sub += (sub ? "  ·  " : "") + `${ppl} person${ppl > 1 ? "s" : ""}`;
      tableRow(f.name, fmtMoney(price), sub || undefined);
    });
    y += 6;
  }

  // ─────────────────────────────────────────────────────────────
  // 7. HOST / ORGANIZER CONTACT  (gold notice + phone + email)
  // ─────────────────────────────────────────────────────────────
  if (hostPhone || hostEmail) {
    section(`${contactLabel.toUpperCase()} CONTACT`);

    // Gold notice banner
    newPage(60);
    doc.setFillColor(...GOLD_SOFT_RGB);
    doc.roundedRect(M, y, CW, 46, 5, 5, "F");
    doc.setDrawColor(...GOLD_TEXT_RGB);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, 46, 5, 5, "S");
    doc.setTextColor(...GOLD_TEXT_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(`Contact the ${contactLabel} below for inquiries,`, M + 10, y + 14);
    doc.text("cancellations, refunds, or booking transfers.", M + 10, y + 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Please have your Booking ID ready.", M + 10, y + 38);
    y += 54;

    infoRow("Phone", hostPhone);
    infoRow("Email", hostEmail);
    y += 6;
  }

  // ─────────────────────────────────────────────────────────────
  // 8. TOTAL HIGHLIGHT BOX
  // ─────────────────────────────────────────────────────────────
  newPage(60);
  y += 10;
  doc.setFillColor(...FOREST_RGB);
  doc.roundedRect(M, y, CW, 48, 6, 6, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TOTAL AMOUNT PAID", M + 14, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SOFT_MINT_RGB);
  doc.text((booking.payment_status || "").toUpperCase(), M + 14, y + 32);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(fmtMoney(booking.total_amount), W - M - 14, y + 32, { align: "right" });
  y += 62;

  // ─────────────────────────────────────────────────────────────
  // 9. QR CODE
  // ─────────────────────────────────────────────────────────────
  const qrText = `REALTRAVO|${booking.id}|${listingName}|${gName || ""}|KES ${Math.round(booking.total_amount)}|${booking.visit_date || d.date || booking.created_at}`;
  const qrDataUrl = await generateQRDataUrl(qrText, 120);
  if (qrDataUrl) {
    // Calculate box height: base 130 + extra rows if contact present
    const hasContact = !!(hostPhone || hostEmail);
    const contactRows = (hostPhone ? 1 : 0) + (hostEmail ? 1 : 0);
    const boxH = hasContact ? 130 + 18 + contactRows * 22 + 10 : 130;

    newPage(boxH + 10);
    y += 8;

    doc.setFillColor(...CANVAS_RGB);
    doc.roundedRect(M, y, CW, boxH, 8, 8, "F");
    doc.setDrawColor(...FOREST_RGB);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, boxH, 8, 8, "S");

    // QR image (left side)
    doc.addImage(qrDataUrl, "PNG", M + 14, y + 15, 100, 100);

    // Right-side text block
    const rx = M + 130;

    doc.setTextColor(...FOREST_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("BOOKING QR CODE", rx, y + 32);

    doc.setTextColor(...INK_SOFT_RGB);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    ["Scan this QR code at the venue to verify",
     "your booking. Present this PDF or the QR",
     "code on your mobile device to the host."]
      .forEach((ln, i) => doc.text(ln, rx, y + 50 + i * 13));

    doc.setTextColor(...INK_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(`Booking ID: ${booking.id}`, rx, y + 108);

    // ── HOST CONTACT BLOCK (below QR, inside the same card) ──────────────
    if (hasContact) {
      const contactY = y + 130 + 6;

      // Thin forest divider across full card width (inset)
      doc.setDrawColor(...FOREST_RGB);
      doc.setLineWidth(0.3);
      doc.line(M + 10, contactY, M + CW - 10, contactY);

      // Section label
      doc.setTextColor(...FOREST_RGB);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(
        `${contactLabel.toUpperCase()} CONTACT`,
        M + 14,
        contactY + 12
      );

      let cy = contactY + 24;

      if (hostPhone) {
        // Phone pill
        doc.setFillColor(...FOREST_TINT_RGB);
        doc.roundedRect(M + 14, cy - 9, (CW - 28) / 2 - 4, 18, 4, 4, "F");
        doc.setDrawColor(...FOREST_RGB);
        doc.setLineWidth(0.3);
        doc.roundedRect(M + 14, cy - 9, (CW - 28) / 2 - 4, 18, 4, 4, "S");

        // Phone icon (simple circle + lines)
        doc.setFillColor(...FOREST_RGB);
        doc.circle(M + 22, cy, 3.5, "F");
        doc.setTextColor(...WHITE);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.text("📞", M + 20, cy + 2);

        doc.setTextColor(...FOREST_RGB);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text(hostPhone, M + 30, cy + 1.5);

        if (hostEmail) {
          // Email pill (second column)
          const ex = M + 14 + (CW - 28) / 2 + 4;
          const ew = (CW - 28) / 2 - 4;
          doc.setFillColor(...FOREST_TINT_RGB);
          doc.roundedRect(ex, cy - 9, ew, 18, 4, 4, "F");
          doc.setDrawColor(...FOREST_RGB);
          doc.setLineWidth(0.3);
          doc.roundedRect(ex, cy - 9, ew, 18, 4, 4, "S");

          doc.setTextColor(...FOREST_RGB);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          const emailLines: string[] = doc.splitTextToSize(hostEmail, ew - 20);
          doc.text(emailLines[0], ex + 8, cy + 1.5);
        }
        cy += 22;
      } else if (hostEmail) {
        // Email only — full-width pill
        doc.setFillColor(...FOREST_TINT_RGB);
        doc.roundedRect(M + 14, cy - 9, CW - 28, 18, 4, 4, "F");
        doc.setDrawColor(...FOREST_RGB);
        doc.setLineWidth(0.3);
        doc.roundedRect(M + 14, cy - 9, CW - 28, 18, 4, 4, "S");

        doc.setTextColor(...FOREST_RGB);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text(hostEmail, M + 22, cy + 1.5);
        cy += 22;
      }
    }

    y += boxH + 10;
  }

  // ─────────────────────────────────────────────────────────────
  // 10. FOOTER
  // ─────────────────────────────────────────────────────────────
  const footerY = H - 52;
  doc.setFillColor(...FOREST_TINT_RGB);
  doc.rect(0, footerY - 12, W, 64, "F");
  doc.setDrawColor(...FOREST_RGB);
  doc.setLineWidth(1.2);
  doc.line(0, footerY - 12, W, footerY - 12);

  doc.setFillColor(...FOREST_RGB);
  doc.circle(M, footerY + 10, 3, "F");
  doc.setFillColor(...CLAY_RGB);
  doc.circle(M + 10, footerY + 10, 3, "F");

  doc.setTextColor(...FOREST_RGB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("realtravo.com", W / 2, footerY + 4, { align: "center" });

  doc.setTextColor(...INK_SOFT_RGB);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Thank you for booking with Realtravo!  ·  support@realtravo.com", W / 2, footerY + 18, { align: "center" });
  doc.text(`Booking ID: ${booking.id}`, W / 2, footerY + 30, { align: "center" });

  doc.save(`realtravo-booking-${booking.id.slice(0, 8)}.pdf`);
};

// ─── Reschedule Modal ─────────────────────────────────────────────────────────

const RescheduleModal = ({
  booking, onClose, onConfirm,
}: {
  booking: Booking; onClose: () => void;
  onConfirm: (id: string, date: string) => Promise<void>;
}) => {
  const [newDate, setNewDate] = useState("");
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);

  const name =
    booking.booking_details?.item_name || booking.booking_details?.trip_name ||
    booking.booking_details?.event_name || booking.booking_details?.hotel_name ||
    booking.booking_details?.place_name || "Booking";

  const current = booking.booking_details?.date
    ? new Date(booking.booking_details.date).toISOString().split("T")[0]
    : null;

  const handle = async () => {
    if (!newDate) return;
    setSaving(true);
    try { await onConfirm(booking.id, newDate); setDone(true); setTimeout(onClose, 2200); }
    finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4"
      style={{ background: "rgba(14,23,18,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" style={{ boxShadow: "0 24px 60px rgba(14,23,18,0.25)", fontFamily: FONT_BODY }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <div className="flex items-center gap-2.5">
            <CalendarClock className="h-4 w-4" style={{ color: FOREST }} />
            <div>
              <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Reschedule</p>
              <p className="text-sm font-semibold truncate max-w-[200px]" style={{ color: INK }}>{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors" style={{ background: CANVAS }}
            onMouseEnter={(e) => (e.currentTarget.style.background = HAIRLINE)}
            onMouseLeave={(e) => (e.currentTarget.style.background = CANVAS)}>
            <X className="h-3.5 w-3.5" style={{ color: INK_SOFT }} />
          </button>
        </div>

        <div className="p-5">
          {done ? (
            <div className="flex flex-col items-center py-6 gap-2 text-center">
              <CheckCircle className="h-12 w-12" style={{ color: SUCCESS }} />
              <p className="font-semibold text-lg" style={{ fontFamily: FONT_DISPLAY, color: INK }}>All set</p>
              <p className="text-sm" style={{ color: INK_SOFT }}>Rescheduled to <span className="font-semibold" style={{ color: INK }}>{fmt(newDate)}</span></p>
              <p className="text-[11px] rounded-full px-3 py-1 mt-1" style={{ color: GOLD_TEXT, background: GOLD_SOFT }}>This was your one allowed reschedule</p>
            </div>
          ) : (
            <>
              {current && (
                <div className="mb-4 flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: CANVAS }}>
                  <Calendar className="h-3.5 w-3.5 flex-shrink-0" style={{ color: INK_SOFT }} />
                  <div>
                    <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Current date</p>
                    <p className="text-[13px] font-semibold" style={{ color: INK }}>{fmt(current)}</p>
                  </div>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-[10px] font-medium mb-1.5" style={{ color: INK_SOFT }}>Select new date</label>
                <input type="date" min={getTomorrow()} value={newDate} onChange={(e) => setNewDate(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold bg-white outline-none transition-colors"
                  style={{ border: `1px solid ${HAIRLINE}`, color: INK }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = FOREST)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = HAIRLINE)} />
              </div>
              <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 mb-4" style={{ background: GOLD_SOFT }}>
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: GOLD }} />
                <p className="text-[11px] font-medium leading-relaxed" style={{ color: GOLD_TEXT }}>You can only reschedule this booking <strong>once</strong>. This action cannot be undone.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-xs font-semibold transition-colors"
                  style={{ border: `1px solid ${HAIRLINE}`, color: INK_SOFT }}>Cancel</button>
                <button onClick={handle} disabled={!newDate || saving}
                  className="flex-1 text-white font-semibold rounded-xl py-2.5 text-xs transition-all disabled:opacity-40"
                  style={newDate && !saving ? { background: `linear-gradient(135deg, #E0824F, ${CLAY})` } : { background: HAIRLINE, color: INK_SOFT }}>
                  {saving ? "Saving…" : "Confirm"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Expanded detail panel ────────────────────────────────────────────────────

const BookingDetail = ({ booking, onReschedule }: { booking: Booking; onReschedule: () => void }) => {
  const [downloading, setDownloading] = useState(false);
  const d = booking.booking_details || {};
  const { contactLabel } = getBookingMeta(booking);

  const name = d.item_name || d.trip_name || d.event_name || d.hotel_name || d.place_name || "Booking";

  // Resolve host contact from every possible location
  const hostPhone =
    booking.host_phone || d.host_phone || d.emailData?.hostPhone ||
    d.phone_number || (Array.isArray(d.phone_numbers) ? d.phone_numbers[0] : "") || "";
  const hostEmail =
    booking.host_email || d.host_email || d.emailData?.hostEmail || d.email || "";

  const acts = d.selectedActivities || d.activities;
  const facs = d.selectedFacilities || d.facilities;
  const tickets = d.ticketSelections || d.ticket_selections;

  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadBooking(booking); }
    finally { setDownloading(false); }
  };

  return (
    <div className="px-4 py-4" style={{ borderTop: `1px solid ${HAIRLINE}`, background: `${CANVAS}80`, fontFamily: FONT_BODY }}>
      <div className="mb-3">
        <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Item</p>
        <p className="text-sm font-semibold" style={{ color: INK }}>{name}</p>
        <p className="text-[10px] font-mono mt-0.5" style={{ color: INK_SOFT }}>{booking.id}</p>
      </div>

      {(booking.guest_name  || d.guest_name)  && <Row icon={Users}  label="Guest"  value={booking.guest_name  || d.guest_name}  />}
      {(booking.guest_email || d.guest_email) && <Row icon={Mail}   label="Email"  value={booking.guest_email || d.guest_email} />}
      {(booking.guest_phone || d.guest_phone) && <Row icon={Phone}  label="Phone"  value={booking.guest_phone || d.guest_phone} />}

      {booking.visit_date && <Row icon={Calendar}      label="Visit Date"     value={fmt(booking.visit_date)} />}
      {d.date             && <Row icon={Calendar}      label="Event Date"     value={fmt(d.date)} />}
      {d.rescheduled_at   && <Row icon={CalendarClock} label="Rescheduled On" value={fmt(d.rescheduled_at)} />}

      {(d.adults   || d.num_adults)   && <Row icon={Users}  label="Adults"   value={d.adults   || d.num_adults}   />}
      {(d.children || d.num_children) && <Row icon={Users}  label="Children" value={d.children || d.num_children} />}
      {booking.slots_booked           && <Row icon={Ticket} label="Slots"    value={booking.slots_booked}          />}
      {(d.location || d.locationName) && <Row icon={MapPin} label="Location" value={d.location || d.locationName} />}

      {/* Tickets */}
      {tickets?.length > 0 && (
        <div className="py-2.5" style={{ borderBottom: `1px dashed ${HAIRLINE}` }}>
          <p className="text-[10px] font-medium mb-1.5 flex items-center gap-1.5" style={{ color: INK_SOFT }}>
            <Ticket className="h-3 w-3" /> Tickets
          </p>
          <div className="space-y-1.5 ml-4">
            {tickets.map((t: any, i: number) => (
              <div key={i} className="text-[13px]">
                <div className="flex justify-between">
                  <span className="font-semibold" style={{ color: INK }}>{t.name}</span>
                  <span className="font-semibold" style={{ color: INK }}>{fmtMoney(t.price * (t.quantity || 1))}</span>
                </div>
                <p className="text-[11px]" style={{ color: INK_SOFT }}>{t.quantity || 1} person{(t.quantity || 1) > 1 ? "s" : ""} × {fmtMoney(t.price)} per ticket</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      {acts?.length > 0 && (
        <div className="py-2.5" style={{ borderBottom: `1px dashed ${HAIRLINE}` }}>
          <p className="text-[10px] font-medium mb-1.5 flex items-center gap-1.5" style={{ color: INK_SOFT }}>
            <Activity className="h-3 w-3" /> Activities
          </p>
          <div className="space-y-1.5 ml-4">
            {acts.map((a: any, i: number) => {
              const ppl = a.numberOfPeople || a.number_of_people || 1;
              return (
                <div key={i} className="text-[13px]">
                  <div className="flex justify-between">
                    <span className="font-semibold" style={{ color: INK }}>{a.name}</span>
                    <span className="font-semibold" style={{ color: INK }}>{fmtMoney((a.price || 0) * ppl)}</span>
                  </div>
                  <p className="text-[11px]" style={{ color: INK_SOFT }}>{ppl} person{ppl > 1 ? "s" : ""} × {fmtMoney(a.price || 0)} per person</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Facilities */}
      {facs?.length > 0 && (
        <div className="py-2.5" style={{ borderBottom: `1px dashed ${HAIRLINE}` }}>
          <p className="text-[10px] font-medium mb-1.5 flex items-center gap-1.5" style={{ color: INK_SOFT }}>
            <Building2 className="h-3 w-3" /> Facilities
          </p>
          <div className="space-y-2 ml-4">
            {facs.map((f: any, i: number) => {
              let days = 0;
              if (f.startDate && f.endDate)
                days = Math.max(1, Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000));
              const total = (f.price || 0) * Math.max(days, 1);
              const ppl   = f.numberOfPeople || f.number_of_people;
              return (
                <div key={i} className="text-[13px]">
                  <div className="flex justify-between">
                    <span className="font-semibold" style={{ color: INK }}>{f.name}</span>
                    <span className="font-semibold" style={{ color: INK }}>{fmtMoney(total)}</span>
                  </div>
                  {f.startDate && (
                    <p className="text-[11px] mt-0.5" style={{ color: INK_SOFT }}>
                      From: {fmtShort(f.startDate)} → To: {fmtShort(f.endDate)}
                      {days > 0 && ` · ${days} day${days > 1 ? "s" : ""} · ${fmtMoney(f.price || 0)}/day`}
                    </p>
                  )}
                  {ppl && <p className="text-[11px]" style={{ color: INK_SOFT }}>{ppl} person{ppl > 1 ? "s" : ""}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Host / Organizer Contact */}
      {(hostPhone || hostEmail) && (
        <div className="mt-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${GOLD}40` }}>
          <div className="flex items-center gap-2.5 px-3.5 py-3" style={{ background: GOLD_SOFT, borderBottom: `1px solid ${GOLD}30` }}>
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: GOLD }} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold" style={{ color: GOLD_TEXT }}>{contactLabel}</p>
              <p className="text-[11px] mt-0.5 leading-snug" style={{ color: GOLD_TEXT }}>Contact for inquiries, cancellations, refunds, or transfers</p>
            </div>
          </div>
          <div className="px-3.5 py-3 bg-white flex flex-wrap gap-2">
            {hostPhone && (
              <a href={`tel:${hostPhone}`} className="flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-3 py-1.5 transition-colors"
                style={{ color: FOREST, background: FOREST_SOFT, border: `1px solid ${FOREST}25` }}>
                <Phone className="h-3 w-3" />{hostPhone}
              </a>
            )}
            {hostEmail && (
              <a href={`mailto:${hostEmail}`} className="flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-3 py-1.5 transition-colors"
                style={{ color: FOREST, background: FOREST_SOFT, border: `1px solid ${FOREST}25` }}>
                <Mail className="h-3 w-3" />{hostEmail}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <button onClick={handleDownload} disabled={downloading}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all disabled:opacity-50"
          style={{ border: `1px solid ${HAIRLINE}`, color: INK_SOFT }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = FOREST; e.currentTarget.style.color = FOREST; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = HAIRLINE; e.currentTarget.style.color = INK_SOFT; }}>
          <Download className="h-3.5 w-3.5" />
          {downloading ? "Generating…" : "Download PDF"}
        </button>

        {isReschedulable(booking) ? (
          <button onClick={onReschedule}
            className="flex-1 flex items-center justify-center gap-1.5 text-white rounded-xl py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
            style={{ background: `linear-gradient(135deg, #E0824F, ${CLAY})` }}>
            <CalendarClock className="h-3.5 w-3.5" /> Reschedule
          </button>
        ) : booking.booking_details?.rescheduled_at ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold cursor-not-allowed"
            style={{ background: GOLD_SOFT, border: `1px solid ${GOLD}30`, color: GOLD_TEXT }}>
            <AlertTriangle className="h-3.5 w-3.5" /> Rescheduled
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ─── Booking Card ─────────────────────────────────────────────────────────────

const BookingCard = ({ booking, onReschedule }: { booking: Booking; onReschedule: (b: Booking) => void }) => {
  const [open, setOpen] = useState(false);
  const d = booking.booking_details || {};
  const { typeLabel } = getBookingMeta(booking);
  const name = d.item_name || d.trip_name || d.event_name || d.hotel_name || d.place_name || "Booking";
  const displayDate = booking.visit_date || d.date;

  return (
    <div className="bg-white rounded-xl overflow-hidden transition-all" style={{ border: `1px solid ${open ? FOREST + "40" : HAIRLINE}`, fontFamily: FONT_BODY }}>
      <button onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.background = `${CANVAS}90`)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-[10px] font-semibold" style={{ color: FOREST }}>{typeLabel}</span>
            <StatusPill status={booking.status} />
            {d.rescheduled_at && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border" style={{ background: INFO_SOFT, color: INFO, borderColor: `${INFO}30` }}>Rescheduled</span>
            )}
          </div>
          <p className="font-semibold text-[14px] truncate" style={{ color: INK }}>{name}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] font-medium" style={{ color: INK_SOFT }}>
            {displayDate && (
              <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{fmt(displayDate)}</span>
            )}
            {(d.adults || d.num_adults) && (
              <span className="flex items-center gap-1">
                <Users className="h-2.5 w-2.5" />
                {d.adults || d.num_adults} adults
                {(d.children || d.num_children) ? ` · ${d.children || d.num_children} kids` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <p className="text-sm font-semibold" style={{ color: CLAY }}>{fmtMoney(booking.total_amount)}</p>
          <StatusPill status={booking.payment_status} />
          <span className="text-[10px] font-medium flex items-center gap-0.5 mt-0.5" style={{ color: INK_SOFT }}>
            {open ? <><ChevronUp className="h-3 w-3" /> less</> : <><ChevronDown className="h-3 w-3" /> details</>}
          </span>
        </div>
      </button>
      {open && <BookingDetail booking={booking} onReschedule={() => onReschedule(booking)} />}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const Bookings = () => {
  useInjectFonts();

  const { user, loading: authLoading } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [loading, setLoading]           = useState(true);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [filter, setFilter]             = useState<"all" | "upcoming" | "past">("all");

  // No forced redirect to /auth — guests can view bookings stored locally on
  // this device, and are offered the same in-page auth modal Saved uses
  // (rather than being sent to a separate /auth page) to sign in and keep
  // them permanently.
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      fetchBookings();
    } else {
      loadLocalBookings();
    }
    // Re-runs the moment `user` flips from null -> a real user (i.e. right
    // after they log in or sign up from this page's modal), taking them
    // from local/guest bookings straight into their real account bookings
    // without ever navigating away from /bookings.
  }, [user, authLoading]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bookings").select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBookings(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadLocalBookings = () => {
    setLoading(true);
    try {
      const local = getLocalBookings();
      setBookings(local as unknown as Booking[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleReschedule = async (id: string, newDate: string) => {
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return;
    const updated = { ...booking.booking_details, date: newDate, rescheduled_at: new Date().toISOString() };

    if (user) {
      const { error } = await supabase.from("bookings").update({ booking_details: updated }).eq("id", id);
      if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); throw error; }
    } else {
      updateLocalBooking(id, { booking_details: updated });
    }

    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, booking_details: updated } : b)));
    toast({ title: "Rescheduled", description: `Moved to ${fmt(newDate)}` });
  };

  const now = new Date();
  const filtered = bookings.filter((b) => {
    if (filter === "all") return true;
    const d = b.visit_date || b.booking_details?.date;
    if (!d) return filter === "past";
    return filter === "upcoming" ? new Date(d) >= now : new Date(d) < now;
  });

  const counts = {
    all: bookings.length,
    upcoming: bookings.filter((b) => { const d = b.visit_date || b.booking_details?.date; return d && new Date(d) >= now; }).length,
    past:     bookings.filter((b) => { const d = b.visit_date || b.booking_details?.date; return !d || new Date(d) < now; }).length,
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen pb-20 md:pb-0" style={{ background: CANVAS }}>
        <Header />
        <main className="container px-4 py-12 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full animate-spin" style={{ border: `2px solid ${FOREST_SOFT}`, borderTopColor: FOREST }} />
          <p className="text-[11px] font-medium animate-pulse" style={{ color: INK_SOFT, fontFamily: FONT_BODY }}>Loading…</p>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  // ── Not logged in, and nothing saved locally yet: same full-page prompt
  // pattern as Saved.tsx, using the shared auth modal rather than /auth. ──
  if (!user && bookings.length === 0) {
    return (
      <div className="min-h-screen pb-24" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
        <Header />
        <div className="container mx-auto px-4 py-12">
          <header className="mb-8">
            <h1 className="text-[28px] font-semibold tracking-tight mb-2" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Bookings</h1>
            <p className="text-[13px]" style={{ color: INK_SOFT }}>All your trips, stays and events in one place.</p>
          </header>
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[32px]" style={{ border: `1px solid ${HAIRLINE}` }}>
            <div className="p-5 rounded-2xl mb-6" style={{ background: FOREST_SOFT }}>
              <BookOpenCheck className="h-10 w-10" style={{ color: FOREST }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Sign in to see your bookings</h2>
            <p className="text-sm mb-6 text-center max-w-sm" style={{ color: INK_SOFT }}>Log in or create an account to keep every trip, stay and event booking safely in one place.</p>
            {/* Opens the same auth modal used across the app (e.g. Saved,
                the bottom nav bar) instead of navigating to a separate
                /auth page — the person never leaves Bookings, so once
                they're signed in this view just swaps to their real list. */}
            <div className="flex items-center gap-2.5">
              <Button
                onClick={() => openAuthModal("login")}
                variant="outline"
                className="rounded-xl text-sm font-semibold gap-2 px-6 py-3"
                style={{ borderColor: HAIRLINE, color: INK }}
              >
                <LogIn className="h-4 w-4" />
                Log in
              </Button>
              <Button
                onClick={() => openAuthModal("signup")}
                className="rounded-xl text-sm font-semibold gap-2 px-6 py-3 text-white border-none hover:opacity-95"
                style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}
              >
                <UserPlus className="h-4 w-4" />
                Sign up
              </Button>
            </div>
          </div>
        </div>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0" style={{ background: CANVAS }}>
      <Header />
      <main className="container max-w-2xl mx-auto px-4 py-6" style={{ fontFamily: FONT_BODY }}>
        <div className="mb-6">
          <p className="text-[10px] font-semibold mb-1" style={{ color: FOREST }}>My account</p>
          <h1 className="text-[28px] font-semibold tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Bookings</h1>
          <p className="text-[13px] mt-0.5" style={{ color: INK_SOFT }}>{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Guest notice — bookings only live on this device until they log in.
            Same look and popup behaviour as Saved's embedded banner: the
            Log in / Sign up buttons open the shared auth modal instead of
            navigating to a separate page. */}
        {!user && (
          <div className="mb-6 rounded-2xl p-4 flex items-center gap-4" style={{ background: FOREST_SOFT, border: `1px solid ${FOREST}25` }}>
            <div className="p-3 rounded-xl shrink-0" style={{ background: "#ffffffaa" }}>
              <AlertTriangle className="h-5 w-5" style={{ color: FOREST }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: INK }}>Saved on this device only</p>
              <p className="text-[11px] mt-0.5" style={{ color: INK_SOFT }}>You're not logged in, so these bookings won't appear on another device or after the app is uninstalled.</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                onClick={() => openAuthModal("login")}
                size="sm"
                variant="outline"
                className="rounded-xl text-xs font-semibold"
                style={{ borderColor: `${FOREST}30`, color: FOREST }}
              >
                Log in
              </Button>
              <Button
                onClick={() => openAuthModal("signup")}
                size="sm"
                className="rounded-xl text-xs font-semibold gap-1.5 text-white border-none hover:opacity-95"
                style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign up
              </Button>
            </div>
          </div>
        )}

        {bookings.length > 0 && (
          <div className="flex gap-1.5 mb-5 bg-white rounded-xl p-1" style={{ border: `1px solid ${HAIRLINE}` }}>
            {(["all", "upcoming", "past"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold capitalize transition-all"
                style={filter === f ? { background: FOREST, color: "#fff" } : { color: INK_SOFT }}>
                {f} <span className="opacity-70">({counts[f]})</span>
              </button>
            ))}
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: FOREST_SOFT }}>🗺️</div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: FONT_DISPLAY, color: INK }}>No bookings yet</h2>
            <p className="text-[13px] max-w-xs" style={{ color: INK_SOFT }}>Your trips, events, and reservations will appear here once you book something.</p>
            <button onClick={() => navigate("/")} className="mt-1 text-white font-semibold rounded-xl px-5 py-2.5 text-[13px] hover:opacity-90 transition-opacity"
              style={{ background: `linear-gradient(135deg, #E0824F, ${CLAY})` }}>
              Explore now
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-semibold" style={{ color: INK_SOFT }}>No {filter} bookings</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((booking) => (
              <BookingCard key={booking.id} booking={booking} onReschedule={setRescheduling} />
            ))}
          </div>
        )}
      </main>
      <MobileBottomBar />

      {rescheduling && (
        <RescheduleModal
          booking={rescheduling}
          onClose={() => setRescheduling(null)}
          onConfirm={handleReschedule}
        />
      )}
    </div>
  );
};

export default Bookings;