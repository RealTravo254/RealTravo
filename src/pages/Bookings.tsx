import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { getLocalBookings, updateLocalBooking } from "@/lib/localBookings";
import {
  Calendar, Users, MapPin, CalendarClock,
  X, CheckCircle, Download, ChevronDown, ChevronUp,
  Activity, Building2, Ticket, Phone,
  Mail, AlertTriangle, LogIn,
} from "lucide-react";

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

const TEAL = "#008080";
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
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=008080&bgcolor=ffffff&margin=4`;
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

const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending:   "bg-amber-50 text-amber-700 border-amber-200",
    cancelled: "bg-red-50 text-red-600 border-red-200",
    paid:      "bg-emerald-50 text-emerald-700 border-emerald-200",
    unpaid:    "bg-slate-50 text-slate-500 border-slate-200",
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[status?.toLowerCase()] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {status}
    </span>
  );
};

// ─── Detail row ───────────────────────────────────────────────────────────────

const Row = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
  <div className="flex items-start gap-2 py-2 border-b border-dashed border-slate-100 last:border-0">
    <Icon className="h-3.5 w-3.5 text-teal-500 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-xs font-semibold text-slate-700 break-words">{value || "—"}</p>
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

  const TEAL_RGB:  [number,number,number] = [0,128,128];
  const CORAL_RGB: [number,number,number] = [255,127,80];
  const SLATE_RGB: [number,number,number] = [51,65,85];
  const LIGHT_RGB: [number,number,number] = [248,249,250];
  const MUTED_RGB: [number,number,number] = [100,116,139];
  const AMBER_RGB: [number,number,number] = [180,120,0];
  const WHITE:     [number,number,number] = [255,255,255];
  const GREEN_RGB: [number,number,number] = [16,185,129];

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
    doc.setFillColor(...TEAL_RGB);
    doc.rect(M, y, 3, 13, "F");
    doc.setFillColor(240, 253, 250);
    doc.roundedRect(M + 3, y, CW - 3, 13, 2, 2, "F");
    doc.setTextColor(...TEAL_RGB);
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
    doc.setFillColor(...LIGHT_RGB);
    doc.roundedRect(M, y, CW, rowH, 3, 3, "F");
    doc.setTextColor(...MUTED_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(String(label).toUpperCase(), M + 8, y + 9);
    doc.setTextColor(...SLATE_RGB);
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

  // Table header row (teal bg)
  const tableHeader = (left: string, right: string) => {
    newPage(22);
    doc.setFillColor(...TEAL_RGB);
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
    doc.setFillColor(...LIGHT_RGB);
    doc.roundedRect(M, y, CW, rowH, 3, 3, "F");
    doc.setTextColor(...SLATE_RGB);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const maxL = CW - 100;
    const leftLines: string[] = doc.splitTextToSize(left, maxL);
    leftLines.slice(0, 2).forEach((ln: string, i: number) =>
      doc.text(ln, M + 8, y + 13 + i * 10)
    );
    if (sub) {
      doc.setTextColor(...MUTED_RGB);
      doc.setFontSize(7);
      doc.text(sub, M + 8, y + 25, { maxWidth: maxL });
    }
    doc.setTextColor(...TEAL_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(right, W - M - 8, y + (sub ? 17 : 14), { align: "right" });
    y += rowH + 4;
  };

  // ── HEADER BANNER ─────────────────────────────────────────────
  doc.setFillColor(...TEAL_RGB);
  doc.rect(0, 0, W, 96, "F");
  doc.setFillColor(...CORAL_RGB);
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
    confirmed:[16,185,129], paid:[16,185,129],
    pending:[245,158,11],   cancelled:[239,68,68],
  };
  const sc = sColors[booking.status?.toLowerCase()] ?? [100,116,139];
  doc.setFillColor(...sc);
  doc.roundedRect(W - 132, 98, 96, 22, 11, 11, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text((booking.status || "").toUpperCase(), W - 84, 113, { align: "center" });

  // ── ITEM NAME ─────────────────────────────────────────────────
  doc.setTextColor(...TEAL_RGB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(listingName, M, y, { maxWidth: W - M * 2 - 110 });
  y += 18;

  doc.setTextColor(...MUTED_RGB);
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
  doc.setDrawColor(...TEAL_RGB);
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
  // 7. HOST / ORGANIZER CONTACT  (amber notice + phone + email)
  // ─────────────────────────────────────────────────────────────
  if (hostPhone || hostEmail) {
    section(`${contactLabel.toUpperCase()} CONTACT`);

    // Amber notice banner
    newPage(60);
    doc.setFillColor(255, 251, 235);
    doc.roundedRect(M, y, CW, 46, 5, 5, "F");
    doc.setDrawColor(...AMBER_RGB);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, 46, 5, 5, "S");
    doc.setTextColor(...AMBER_RGB);
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
  doc.setFillColor(...TEAL_RGB);
  doc.roundedRect(M, y, CW, 48, 6, 6, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TOTAL AMOUNT PAID", M + 14, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(179, 230, 230);
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

    doc.setFillColor(...LIGHT_RGB);
    doc.roundedRect(M, y, CW, boxH, 8, 8, "F");
    doc.setDrawColor(...TEAL_RGB);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, boxH, 8, 8, "S");

    // QR image (left side)
    doc.addImage(qrDataUrl, "PNG", M + 14, y + 15, 100, 100);

    // Right-side text block
    const rx = M + 130;

    doc.setTextColor(...TEAL_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("BOOKING QR CODE", rx, y + 32);

    doc.setTextColor(...MUTED_RGB);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    ["Scan this QR code at the venue to verify",
     "your booking. Present this PDF or the QR",
     "code on your mobile device to the host."]
      .forEach((ln, i) => doc.text(ln, rx, y + 50 + i * 13));

    doc.setTextColor(...SLATE_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(`Booking ID: ${booking.id}`, rx, y + 108);

    // ── HOST CONTACT BLOCK (below QR, inside the same card) ──────────────
    if (hasContact) {
      const contactY = y + 130 + 6;

      // Thin teal divider across full card width (inset)
      doc.setDrawColor(...TEAL_RGB);
      doc.setLineWidth(0.3);
      doc.line(M + 10, contactY, M + CW - 10, contactY);

      // Section label
      doc.setTextColor(...TEAL_RGB);
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
        doc.setFillColor(240, 253, 250);
        doc.roundedRect(M + 14, cy - 9, (CW - 28) / 2 - 4, 18, 4, 4, "F");
        doc.setDrawColor(...TEAL_RGB);
        doc.setLineWidth(0.3);
        doc.roundedRect(M + 14, cy - 9, (CW - 28) / 2 - 4, 18, 4, 4, "S");

        // Phone icon (simple circle + lines)
        doc.setFillColor(...TEAL_RGB);
        doc.circle(M + 22, cy, 3.5, "F");
        doc.setTextColor(...WHITE);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.text("📞", M + 20, cy + 2);

        doc.setTextColor(...TEAL_RGB);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text(hostPhone, M + 30, cy + 1.5);

        if (hostEmail) {
          // Email pill (second column)
          const ex = M + 14 + (CW - 28) / 2 + 4;
          const ew = (CW - 28) / 2 - 4;
          doc.setFillColor(240, 253, 250);
          doc.roundedRect(ex, cy - 9, ew, 18, 4, 4, "F");
          doc.setDrawColor(...TEAL_RGB);
          doc.setLineWidth(0.3);
          doc.roundedRect(ex, cy - 9, ew, 18, 4, 4, "S");

          doc.setTextColor(...TEAL_RGB);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          const emailLines: string[] = doc.splitTextToSize(hostEmail, ew - 20);
          doc.text(emailLines[0], ex + 8, cy + 1.5);
        }
        cy += 22;
      } else if (hostEmail) {
        // Email only — full-width pill
        doc.setFillColor(240, 253, 250);
        doc.roundedRect(M + 14, cy - 9, CW - 28, 18, 4, 4, "F");
        doc.setDrawColor(...TEAL_RGB);
        doc.setLineWidth(0.3);
        doc.roundedRect(M + 14, cy - 9, CW - 28, 18, 4, 4, "S");

        doc.setTextColor(...TEAL_RGB);
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
  doc.setFillColor(240, 253, 250);
  doc.rect(0, footerY - 12, W, 64, "F");
  doc.setDrawColor(...TEAL_RGB);
  doc.setLineWidth(1.2);
  doc.line(0, footerY - 12, W, footerY - 12);

  doc.setFillColor(...TEAL_RGB);
  doc.circle(M, footerY + 10, 3, "F");
  doc.setFillColor(...CORAL_RGB);
  doc.circle(M + 10, footerY + 10, 3, "F");

  doc.setTextColor(...TEAL_RGB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("realtravo.com", W / 2, footerY + 4, { align: "center" });

  doc.setTextColor(...MUTED_RGB);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-teal-600" />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Reschedule</p>
              <p className="text-sm font-black text-slate-800 truncate max-w-[200px]">{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          {done ? (
            <div className="flex flex-col items-center py-6 gap-2 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
              <p className="font-black text-lg text-slate-800">All Set!</p>
              <p className="text-slate-500 text-sm">Rescheduled to <span className="font-bold text-slate-800">{fmt(newDate)}</span></p>
              <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mt-1">⚠ This was your one allowed reschedule</p>
            </div>
          ) : (
            <>
              {current && (
                <div className="mb-4 flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400">Current Date</p>
                    <p className="text-xs font-semibold text-slate-700">{fmt(current)}</p>
                  </div>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Select New Date</label>
                <input type="date" min={getTomorrow()} value={newDate} onChange={(e) => setNewDate(e.target.value)}
                  className="w-full border border-slate-200 focus:border-teal-500 rounded-xl px-3 py-2.5 text-sm font-semibold bg-white outline-none transition-colors" />
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 font-medium leading-relaxed">You can only reschedule this booking <strong>once</strong>. This action cannot be undone.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 font-bold rounded-xl py-2.5 text-xs hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handle} disabled={!newDate || saving}
                  className="flex-1 text-white font-black rounded-xl py-2.5 text-xs disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
                  style={newDate && !saving ? { backgroundColor: TEAL } : undefined}>
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
    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4">
      <div className="mb-3">
        <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400">Item</p>
        <p className="text-sm font-black text-slate-800">{name}</p>
        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{booking.id}</p>
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
        <div className="py-2 border-b border-dashed border-slate-100">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
            <Ticket className="h-3 w-3" /> Tickets
          </p>
          <div className="space-y-1.5 ml-4">
            {tickets.map((t: any, i: number) => (
              <div key={i} className="text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">{t.name}</span>
                  <span className="font-bold text-slate-700">{fmtMoney(t.price * (t.quantity || 1))}</span>
                </div>
                <p className="text-[10px] text-slate-400">{t.quantity || 1} person{(t.quantity || 1) > 1 ? "s" : ""} × {fmtMoney(t.price)} per ticket</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      {acts?.length > 0 && (
        <div className="py-2 border-b border-dashed border-slate-100">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
            <Activity className="h-3 w-3" /> Activities
          </p>
          <div className="space-y-1.5 ml-4">
            {acts.map((a: any, i: number) => {
              const ppl = a.numberOfPeople || a.number_of_people || 1;
              return (
                <div key={i} className="text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-700">{a.name}</span>
                    <span className="font-bold text-slate-700">{fmtMoney((a.price || 0) * ppl)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">{ppl} person{ppl > 1 ? "s" : ""} × {fmtMoney(a.price || 0)} per person</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Facilities */}
      {facs?.length > 0 && (
        <div className="py-2 border-b border-dashed border-slate-100">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
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
                <div key={i} className="text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-700">{f.name}</span>
                    <span className="font-bold text-slate-700">{fmtMoney(total)}</span>
                  </div>
                  {f.startDate && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      From: {fmtShort(f.startDate)} → To: {fmtShort(f.endDate)}
                      {days > 0 && ` · ${days} day${days > 1 ? "s" : ""} · ${fmtMoney(f.price || 0)}/day`}
                    </p>
                  )}
                  {ppl && <p className="text-[10px] text-slate-400">{ppl} person{ppl > 1 ? "s" : ""}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Host / Organizer Contact */}
      {(hostPhone || hostEmail) && (
        <div className="mt-3 rounded-xl overflow-hidden border border-amber-200">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border-b border-amber-100">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">{contactLabel}</p>
              <p className="text-[10px] text-amber-600 mt-0.5 leading-snug">Contact for inquiries, cancellations, refunds, or transfers</p>
            </div>
          </div>
          <div className="px-3 py-2.5 bg-white flex flex-wrap gap-2">
            {hostPhone && (
              <a href={`tel:${hostPhone}`} className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-100 transition-colors">
                <Phone className="h-3 w-3" />{hostPhone}
              </a>
            )}
            {hostEmail && (
              <a href={`mailto:${hostEmail}`} className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-100 transition-colors">
                <Mail className="h-3 w-3" />{hostEmail}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <button onClick={handleDownload} disabled={downloading}
          className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-600 rounded-xl py-2 text-xs font-bold hover:border-teal-400 hover:text-teal-700 transition-all disabled:opacity-50">
          <Download className="h-3.5 w-3.5" />
          {downloading ? "Generating…" : "Download PDF"}
        </button>

        {isReschedulable(booking) ? (
          <button onClick={onReschedule}
            className="flex-1 flex items-center justify-center gap-1.5 text-white rounded-xl py-2 text-xs font-bold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: TEAL }}>
            <CalendarClock className="h-3.5 w-3.5" /> Reschedule
          </button>
        ) : booking.booking_details?.rescheduled_at ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl py-2 text-xs font-bold cursor-not-allowed">
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
    <div className={`bg-white rounded-xl border overflow-hidden transition-all ${open ? "border-teal-200" : "border-slate-100"}`}>
      <button onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-teal-600">{typeLabel}</span>
            <StatusPill status={booking.status} />
            {d.rescheduled_at && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-200">Rescheduled</span>
            )}
          </div>
          <p className="font-bold text-sm text-slate-800 truncate">{name}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[10px] text-slate-400 font-medium">
            {displayDate && (
              <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{fmt(displayDate)}</span>
            )}
            {(d.adults || d.num_adults) && (
              <span className="flex items-center gap-0.5">
                <Users className="h-2.5 w-2.5" />
                {d.adults || d.num_adults} adults
                {(d.children || d.num_children) ? ` · ${d.children || d.num_children} kids` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <p className="text-sm font-black" style={{ color: TEAL }}>{fmtMoney(booking.total_amount)}</p>
          <StatusPill status={booking.payment_status} />
          <span className="text-[9px] text-slate-400 font-bold flex items-center gap-0.5 mt-0.5">
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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [loading, setLoading]           = useState(true);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [filter, setFilter]             = useState<"all" | "upcoming" | "past">("all");

  // No more forced redirect to /auth — guests can view bookings stored
  // locally on this device instead.
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      fetchBookings();
    } else {
      loadLocalBookings();
    }
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
    toast({ title: "Rescheduled ✓", description: `Moved to ${fmt(newDate)}` });
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
      <div className="min-h-screen bg-[#F8F9FA] pb-20 md:pb-0">
        <Header />
        <main className="container px-4 py-12 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-teal-200 border-t-teal-600 animate-spin" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 animate-pulse">Loading…</p>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20 md:pb-0">
      <Header />
      <main className="container max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-[9px] font-bold uppercase tracking-widest text-teal-600 mb-0.5">My Account</p>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Bookings</h1>
          <p className="text-xs text-slate-400 mt-0.5">{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Guest notice — bookings only live on this device until they log in */}
        {!user && (
          <div className="mb-5 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-700">Saved on this device only</p>
              <p className="text-[11px] text-amber-600 mt-0.5 leading-relaxed">
                You're not logged in, so these bookings are stored locally and won't appear on another device or after the app is uninstalled.
              </p>
              <button
                onClick={() => navigate("/auth")}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-white rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: TEAL }}
              >
                <LogIn className="h-3 w-3" /> Log in to keep them safe
              </button>
            </div>
          </div>
        )}

        {bookings.length > 0 && (
          <div className="flex gap-1.5 mb-5 bg-white rounded-xl p-1 border border-slate-100">
            {(["all", "upcoming", "past"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${filter === f ? "text-white" : "text-slate-400 hover:text-slate-600"}`}
                style={filter === f ? { backgroundColor: TEAL } : undefined}>
                {f} <span className="opacity-60">({counts[f]})</span>
              </button>
            ))}
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center text-3xl">🗺️</div>
            <h2 className="text-lg font-black text-slate-700">No Bookings Yet</h2>
            <p className="text-slate-400 text-xs max-w-xs">Your trips, events, and reservations will appear here once you book something.</p>
            <button onClick={() => navigate("/")} className="mt-1 text-white font-bold rounded-xl px-5 py-2.5 text-xs hover:opacity-90 transition-opacity" style={{ backgroundColor: TEAL }}>
              Explore Now
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm font-semibold">No {filter} bookings</p>
          </div>
        ) : (
          <div className="space-y-2">
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