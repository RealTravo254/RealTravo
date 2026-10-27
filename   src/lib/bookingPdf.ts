import { jsPDF } from "jspdf";

// ── Types ───────────────────────────────────────────────────────────────────
export interface BookingLine {
  section: string;
  label: string;
  amount: number;
  sub?: string;
}

// ── Formatting helpers ──────────────────────────────────────────────────────
export const fmtMoney = (n: number | string | null | undefined): string => {
  const v = Number(n) || 0;
  return `KES ${v.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
};

export const fmtDate = (d?: string | null): string => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

// ── Item name ───────────────────────────────────────────────────────────────
export const getItemName = (d: any): string =>
  d?.trip_name || d?.event_name || d?.item_name || d?.place_name ||
  d?.hotel_name || d?.name || d?.title || "Booking";

// ── Type label + who to contact ─────────────────────────────────────────────
export const getBookingMeta = (type: string, _d?: any) => {
  switch ((type || "").toLowerCase()) {
    case "trip":
      return { typeLabel: "Trip", contactLabel: "Trip organizer" };
    case "event":
      return { typeLabel: "Event", contactLabel: "Event organizer" };
    case "hotel":
      return { typeLabel: "Hotel stay", contactLabel: "Hotel contact" };
    case "adventure_place":
    case "adventure":
      return { typeLabel: "Adventure place", contactLabel: "Host contact" };
    default:
      return { typeLabel: "Booking", contactLabel: "Host contact" };
  }
};

// ── Host contact ────────────────────────────────────────────────────────────
export const getHostContact = (booking: any): { phone: string; email: string } => {
  const d = booking?.booking_details || {};
  return {
    phone: booking?.host_phone || d.host_phone || d.contact_phone || d.phone_number || "",
    email: booking?.host_email || d.host_email || d.contact_email || "",
  };
};

// ── Price breakdown lines ───────────────────────────────────────────────────
// Reads the common shapes stored in booking_details and falls back gracefully.
export const getBookingLines = (d: any): BookingLine[] => {
  if (!d) return [];
  const lines: BookingLine[] = [];

  const adults = Number(d.adults ?? d.num_adults ?? 0);
  const children = Number(d.children ?? d.num_children ?? 0);
  const adultPrice = Number(d.adult_price ?? d.price_adult ?? d.price ?? d.entry_fee ?? 0);
  const childPrice = Number(d.child_price ?? d.price_child ?? 0);

  if (adults > 0 && adultPrice > 0) {
    lines.push({ section: "Tickets", label: `Adult × ${adults}`, amount: adults * adultPrice, sub: `${fmtMoney(adultPrice)} each` });
  }
  if (children > 0 && childPrice > 0) {
    lines.push({ section: "Tickets", label: `Child × ${children}`, amount: children * childPrice, sub: `${fmtMoney(childPrice)} each` });
  }

  const activities = d.selectedActivities || d.selected_activities || d.activities;
  if (Array.isArray(activities)) {
    activities.forEach((a: any) => {
      if (!a || typeof a !== "object") return;
      const qty = Number(a.numberOfPeople ?? a.people ?? a.quantity ?? 1);
      const price = Number(a.price ?? 0);
      lines.push({
        section: "Activities",
        label: a.name || "Activity",
        amount: qty * price,
        sub: qty > 1 ? `${qty} × ${fmtMoney(price)}` : undefined,
      });
    });
  }

  const facilities = d.selectedFacilities || d.selected_facilities || d.facilities;
  if (Array.isArray(facilities)) {
    facilities.forEach((f: any) => {
      if (!f || typeof f !== "object") return;
      const price = Number(f.price ?? 0);
      let sub: string | undefined;
      if (f.startDate && f.endDate) sub = `${fmtDate(f.startDate)} – ${fmtDate(f.endDate)}`;
      lines.push({ section: "Facilities", label: f.name || "Facility", amount: price, sub });
    });
  }

  return lines;
};

// ── QR code ─────────────────────────────────────────────────────────────────
// Payload the host scans to verify a booking.
export const qrPayload = (bookingId: string, visitDate?: string, email?: string): string =>
  JSON.stringify({ t: "realtravo-booking", id: bookingId, d: visitDate || "", e: email || "" });

export const qrImageUrl = (payload: string, size = 220): string =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=4&data=${encodeURIComponent(payload)}`;

const loadImageAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// ── PDF ─────────────────────────────────────────────────────────────────────
export const generateBookingPDF = async (booking: any, bookingId: string): Promise<void> => {
  const d = booking?.booking_details || {};
  const { typeLabel, contactLabel } = getBookingMeta(booking?.booking_type, d);
  const name = getItemName(d);
  const lines = getBookingLines(d);
  const host = getHostContact(booking);
  const visit = booking?.visit_date || d.date || d.visit_date;
  const guestName = booking?.guest_name || d.guest_name;
  const guestEmail = booking?.guest_email || d.guest_email;
  const guestPhone = booking?.guest_phone || d.guest_phone;
  const paid = ["paid", "completed"].includes((booking?.payment_status || "").toLowerCase());

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  let y = 0;

  const ensureSpace = (needed: number) => {
    if (y + needed > H - 20) {
      doc.addPage();
      y = M;
    }
  };

  // Header band
  doc.setFillColor(31, 77, 58);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Real Travo", M, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Booking confirmation", M, 21);
  doc.text(typeLabel, W - M, 13, { align: "right" });
  doc.text(paid ? "PAID" : (booking?.payment_status || "").toUpperCase(), W - M, 21, { align: "right" });
  y = 38;

  // Title
  doc.setTextColor(28, 43, 34);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(name, W - M * 2 - 45);
  doc.text(titleLines, M, y);
  y += titleLines.length * 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(91, 107, 96);
  doc.text(`Booking ID: ${bookingId}`, M, y);
  y += 8;

  // QR code (top right, only for paid bookings)
  if (paid) {
    const payload = qrPayload(bookingId, visit, guestEmail);
    const dataUrl = await loadImageAsDataUrl(qrImageUrl(payload, 300));
    if (dataUrl) {
      doc.addImage(dataUrl, "PNG", W - M - 36, 32, 36, 36);
      doc.setFontSize(7);
      doc.text("Show at the venue", W - M - 18, 71, { align: "center" });
    }
  }
  y = Math.max(y, paid ? 76 : y);

  // Detail rows
  const detail = (label: string, value: any) => {
    if (value === undefined || value === null || value === "") return;
    ensureSpace(8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(91, 107, 96);
    doc.text(label, M, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(28, 43, 34);
    doc.text(String(value), M + 42, y);
    y += 6.5;
  };

  doc.setDrawColor(220, 227, 220);
  doc.line(M, y - 2, W - M, y - 2);
  y += 4;

  detail("Guest", guestName);
  detail("Email", guestEmail);
  detail("Phone", guestPhone);
  detail("Date", visit ? fmtDate(visit) : "");
  detail("Rescheduled on", d.rescheduled_at ? fmtDate(d.rescheduled_at) : "");
  detail("Adults", d.adults ?? d.num_adults);
  detail("Children", d.children ?? d.num_children);
  detail("Slots", booking?.slots_booked);
  detail("Location", d.location || d.locationName);
  detail("Booked on", fmtDate(booking?.created_at));
  y += 3;

  // Price breakdown
  if (lines.length > 0) {
    ensureSpace(14);
    doc.line(M, y, W - M, y);
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(31, 77, 58);
    doc.text("Breakdown", M, y);
    y += 7;

    Array.from(new Set(lines.map((l) => l.section))).forEach((section) => {
      ensureSpace(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(91, 107, 96);
      doc.text(section, M, y);
      y += 5.5;

      lines.filter((l) => l.section === section).forEach((l) => {
        ensureSpace(l.sub ? 11 : 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(28, 43, 34);
        doc.text(l.label, M + 3, y);
        doc.text(fmtMoney(l.amount), W - M, y, { align: "right" });
        y += 5;
        if (l.sub) {
          doc.setFontSize(8);
          doc.setTextColor(91, 107, 96);
          doc.text(l.sub, M + 3, y);
          y += 4.5;
        }
      });
      y += 2;
    });
  }

  // Total
  ensureSpace(16);
  doc.setDrawColor(31, 77, 58);
  doc.line(M, y, W - M, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(28, 43, 34);
  doc.text(paid ? "Total paid" : "Total", M, y);
  doc.setTextColor(193, 85, 47);
  doc.text(fmtMoney(booking?.total_amount), W - M, y, { align: "right" });
  y += 12;

  // Host contact
  if (host.phone || host.email) {
    ensureSpace(24);
    doc.setFillColor(251, 242, 221);
    doc.roundedRect(M, y, W - M * 2, 20, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(138, 103, 22);
    doc.text(contactLabel, M + 4, y + 6.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("For inquiries, cancellations, refunds or transfers", M + 4, y + 11.5);
    doc.text([host.phone, host.email].filter(Boolean).join("   |   "), M + 4, y + 16.5);
    y += 26;
  }

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(140, 150, 143);
  doc.text("Generated by Real Travo · realtravo.com", W / 2, H - 10, { align: "center" });

  doc.save(`booking-${String(bookingId).slice(0, 8)}.pdf`);
};