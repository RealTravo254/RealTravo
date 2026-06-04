import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import {
  Calendar, Users, MapPin, CalendarClock,
  X, CheckCircle, Download, ChevronDown, ChevronUp,
  Activity, Building2, Ticket, Phone,
  Mail, AlertTriangle,
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

const isReschedulable = (booking: Booking) => {
  const type = booking.booking_type?.toLowerCase();
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

// KES formatter — no decimals
const fmtMoney = (n: number) =>
  "KES " + Math.round(n).toLocaleString("en-KE");

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
    <span
      className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
        map[status?.toLowerCase()] ?? "bg-slate-100 text-slate-500 border-slate-200"
      }`}
    >
      {status}
    </span>
  );
};

// ─── Detail row ───────────────────────────────────────────────────────────────

const Row = ({
  icon: Icon, label, value,
}: {
  icon: any; label: string; value: React.ReactNode;
}) => (
  <div className="flex items-start gap-2 py-2 border-b border-dashed border-slate-100 last:border-0">
    <Icon className="h-3.5 w-3.5 text-teal-500 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-xs font-semibold text-slate-700 break-words">{value || "—"}</p>
    </div>
  </div>
);

// ─── Download as PDF ──────────────────────────────────────────────────────────

const downloadBooking = async (booking: Booking) => {
  const d = booking.booking_details || {};
  const itemName =
    d.trip_name || d.event_name || d.hotel_name ||
    d.place_name || d.item_name || "Booking";

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const TEAL_RGB:  [number, number, number] = [0, 128, 128];
  const CORAL_RGB: [number, number, number] = [255, 127, 80];
  const SLATE_RGB: [number, number, number] = [51, 65, 85];
  const LIGHT_RGB: [number, number, number] = [248, 249, 250];
  const MUTED_RGB: [number, number, number] = [100, 116, 139];

  let y = 0;

  // ── Header banner ──────────────────────────────────────────────
  doc.setFillColor(...TEAL_RGB);
  doc.rect(0, 0, W, 90, "F");

  // Coral diagonal accent (top-right triangle)
  doc.setFillColor(...CORAL_RGB);
  doc.triangle(W - 120, 0, W, 0, W, 90, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("REALTRAVO", 36, 38);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("BOOKING CONFIRMATION", 36, 54);

  doc.setFontSize(7.5);
  doc.text(`Ref: ${booking.id}`, 36, 68);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 36, 80);

  y = 110;

  // ── Status badge ───────────────────────────────────────────────
  const statusColorMap: Record<string, [number, number, number]> = {
    confirmed: [16, 185, 129],
    paid:      [16, 185, 129],
    pending:   [245, 158, 11],
    cancelled: [239, 68, 68],
  };
  const sColor = statusColorMap[booking.status?.toLowerCase()] ?? [100, 116, 139];
  doc.setFillColor(...sColor);
  doc.roundedRect(W - 130, 95, 94, 22, 11, 11, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text((booking.status || "").toUpperCase(), W - 83, 110, { align: "center" });

  // ── Item name ──────────────────────────────────────────────────
  doc.setTextColor(...TEAL_RGB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(itemName, 36, y);
  y += 16;

  doc.setTextColor(...MUTED_RGB);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${(booking.booking_type || "").toUpperCase()} BOOKING`, 36, y);
  y += 22;

  // ── Helper: new page if near bottom ───────────────────────────
  const newPageIfNeeded = () => {
    if (y > H - 110) {
      doc.addPage();
      y = 40;
    }
  };

  // ── Helper: section header with teal left bar ──────────────────
  const section = (title: string) => {
    newPageIfNeeded();
    doc.setFillColor(...TEAL_RGB);
    doc.rect(36, y, 3, 12, "F");
    doc.setTextColor(...TEAL_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(title, 44, y + 9);
    y += 20;
  };

  // ── Helper: info row with light background ─────────────────────
  const row = (label: string, value: string | number | undefined | null) => {
    if (value === undefined || value === null || value === "") return;
    newPageIfNeeded();
    doc.setFillColor(...LIGHT_RGB);
    doc.roundedRect(36, y, W - 72, 22, 3, 3, "F");
    doc.setTextColor(...MUTED_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), 44, y + 9);
    doc.setTextColor(...SLATE_RGB);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const valStr = String(value);
    const maxWidth = W - 72 - 160;
    const lines = doc.splitTextToSize(valStr, maxWidth);
    if (lines.length > 1) {
      // multi-line row — expand the rect
      const rowH = 14 + lines.length * 11;
      doc.setFillColor(...LIGHT_RGB);
      doc.roundedRect(36, y, W - 72, rowH, 3, 3, "F");
      doc.setTextColor(...MUTED_RGB);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(label.toUpperCase(), 44, y + 9);
      doc.setTextColor(...SLATE_RGB);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      lines.forEach((line: string, i: number) => {
        doc.text(line, W - 44, y + 14 + i * 11, { align: "right" });
      });
      y += rowH + 6;
    } else {
      const truncated = doc.getStringUnitWidth(valStr) * 8.5 > maxWidth
        ? doc.splitTextToSize(valStr, maxWidth)[0] + "…"
        : valStr;
      doc.text(truncated, W - 44, y + 14, { align: "right" });
      y += 28;
    }
  };

  // ── Booking information ────────────────────────────────────────
  section("BOOKING INFORMATION");
  row("Payment Status", (booking.payment_status || "").toUpperCase());
  row("Total Amount",   fmtMoney(booking.total_amount));
  row("Booked On",      fmt(booking.created_at));
  if (booking.visit_date)  row("Visit Date",      fmt(booking.visit_date));
  if (d.date)              row("Event Date",      fmt(d.date));
  if (d.rescheduled_at)    row("Rescheduled On",  fmt(d.rescheduled_at));
  y += 8;

  // ── Guest details ──────────────────────────────────────────────
  const gName  = booking.guest_name  || d.guest_name;
  const gEmail = booking.guest_email || d.guest_email;
  const gPhone = booking.guest_phone || d.guest_phone;
  if (gName || gEmail || gPhone) {
    section("GUEST DETAILS");
    row("Name",  gName);
    row("Email", gEmail);
    row("Phone", gPhone);
    y += 8;
  }

  // ── Booking details ────────────────────────────────────────────
  const adults   = d.adults   || d.num_adults;
  const children = d.children || d.num_children;
  section("BOOKING DETAILS");
  row("Adults",       adults);
  row("Children",     children);
  row("Slots Booked", booking.slots_booked);
  row("Location",     d.location);
  y += 8;

  // ── Tickets ────────────────────────────────────────────────────
  if (d.ticketSelections?.length) {
    section("TICKETS");
    d.ticketSelections.forEach((t: any) => {
      row(`${t.name} × ${t.quantity} person(s)`, fmtMoney(t.price * t.quantity));
    });
    y += 8;
  }

  // ── Activities ─────────────────────────────────────────────────
  if (d.selectedActivities?.length) {
    section("ACTIVITIES");
    d.selectedActivities.forEach((a: any) => {
      const people = a.numberOfPeople || a.number_of_people || 1;
      row(`${a.name} — ${people} person(s)`, fmtMoney(a.price * people));
    });
    y += 8;
  }

  // ── Facilities ─────────────────────────────────────────────────
  if (d.selectedFacilities?.length) {
    section("FACILITIES");
    d.selectedFacilities.forEach((f: any) => {
      const people = f.numberOfPeople || f.number_of_people || null;
      let label = f.name;
      if (f.startDate && f.endDate) {
        label += ` · From: ${fmt(f.startDate)} → To: ${fmt(f.endDate)}`;
      }
      if (people) label += ` · ${people} person(s)`;
      row(label, fmtMoney(f.price));
    });
    y += 8;
  }

  // ── Host contact ───────────────────────────────────────────────
  const hostPhone = booking.host_phone || d.host_phone || d.emailData?.hostPhone || "";
  const hostEmail = booking.host_email || d.host_email || d.emailData?.hostEmail || "";
  if (hostPhone || hostEmail) {
    section("HOST CONTACT");
    row("Phone", hostPhone);
    row("Email", hostEmail);
    y += 8;
  }

  // ── Total highlight box ────────────────────────────────────────
  newPageIfNeeded();
  y += 10;
  doc.setFillColor(...TEAL_RGB);
  doc.roundedRect(36, y, W - 72, 44, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TOTAL AMOUNT PAID", 54, y + 16);
  doc.setFontSize(17);
  doc.text(fmtMoney(booking.total_amount), W - 54, y + 30, { align: "right" });
  y += 62;

  // ── QR Code ────────────────────────────────────────────────────
  try {
    const qrData = JSON.stringify({
      id: booking.id,
      ref: booking.id,
      item: itemName,
      guest: gName || "",
      amount: booking.total_amount,
      date: booking.visit_date || d.date || booking.created_at,
      status: booking.status,
    });
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      width: 120,
      margin: 1,
      color: { dark: "#008080", light: "#ffffff" },
    });

    newPageIfNeeded();
    y += 8;

    // QR section background
    doc.setFillColor(...LIGHT_RGB);
    doc.roundedRect(36, y, W - 72, 130, 8, 8, "F");
    doc.setDrawColor(...TEAL_RGB);
    doc.setLineWidth(0.5);
    doc.roundedRect(36, y, W - 72, 130, 8, 8, "S");

    // QR image (left side)
    doc.addImage(qrDataUrl, "PNG", 50, y + 15, 100, 100);

    // QR text (right side)
    doc.setTextColor(...TEAL_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("BOOKING QR CODE", 170, y + 32);

    doc.setTextColor(...MUTED_RGB);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const qrLines = [
      "Scan this QR code at the venue to verify",
      "your booking. Present this PDF or the QR",
      "code on your mobile device to the host.",
    ];
    qrLines.forEach((line, i) => doc.text(line, 170, y + 50 + i * 13));

    doc.setTextColor(...SLATE_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(`Booking ID: ${booking.id}`, 170, y + 105);

    y += 148;
  } catch (e) {
    console.warn("QR generation failed", e);
  }

  // ── Footer ─────────────────────────────────────────────────────
  const footerY = H - 52;
  doc.setFillColor(...LIGHT_RGB);
  doc.rect(0, footerY - 12, W, 64, "F");
  doc.setDrawColor(...TEAL_RGB);
  doc.setLineWidth(1.5);
  doc.line(0, footerY - 12, W, footerY - 12);

  doc.setTextColor(...TEAL_RGB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("realtravo.com", W / 2, footerY + 4, { align: "center" });

  doc.setTextColor(...MUTED_RGB);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    "Thank you for booking with Realtravo!  ·  support@realtravo.com",
    W / 2, footerY + 18, { align: "center" }
  );
  doc.text(`Booking ID: ${booking.id}`, W / 2, footerY + 30, { align: "center" });

  doc.save(`realtravo-booking-${booking.id.slice(0, 8)}.pdf`);
};

// ─── Reschedule Modal ─────────────────────────────────────────────────────────

const RescheduleModal = ({
  booking,
  onClose,
  onConfirm,
}: {
  booking: Booking;
  onClose: () => void;
  onConfirm: (id: string, date: string) => Promise<void>;
}) => {
  const [newDate, setNewDate] = useState("");
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);

  const name =
    booking.booking_details?.trip_name ||
    booking.booking_details?.event_name ||
    booking.booking_details?.hotel_name ||
    booking.booking_details?.place_name ||
    booking.booking_details?.item_name ||
    "Booking";

  const current = booking.booking_details?.date
    ? new Date(booking.booking_details.date).toISOString().split("T")[0]
    : null;

  const handle = async () => {
    if (!newDate) return;
    setSaving(true);
    try {
      await onConfirm(booking.id, newDate);
      setDone(true);
      setTimeout(onClose, 2200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6 md:pb-0"
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
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          {done ? (
            <div className="flex flex-col items-center py-6 gap-2 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
              <p className="font-black text-lg text-slate-800">All Set!</p>
              <p className="text-slate-500 text-sm">
                Rescheduled to <span className="text-slate-800 font-bold">{fmt(newDate)}</span>
              </p>
              <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mt-1">
                ⚠ This was your one allowed reschedule
              </p>
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
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  Select New Date
                </label>
                <input
                  type="date"
                  min={getTomorrow()}
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full border border-slate-200 focus:border-teal-500 rounded-xl px-3 py-2.5 text-sm font-semibold bg-white outline-none transition-colors"
                />
              </div>

              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                  You can only reschedule this booking <strong>once</strong>. This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 border border-slate-200 text-slate-600 font-bold rounded-xl py-2.5 text-xs hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handle}
                  disabled={!newDate || saving}
                  className="flex-1 text-white font-black rounded-xl py-2.5 text-xs disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
                  style={newDate && !saving ? { backgroundColor: TEAL } : undefined}
                >
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

const BookingDetail = ({
  booking,
  onReschedule,
}: {
  booking: Booking;
  onReschedule: () => void;
}) => {
  const d = booking.booking_details || {};
  const name =
    d.trip_name || d.event_name || d.hotel_name ||
    d.place_name || d.item_name || "Booking";

  return (
    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4">
      {/* Item name + ID */}
      <div className="mb-3">
        <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400">Item</p>
        <p className="text-sm font-black text-slate-800">{name}</p>
        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{booking.id}</p>
      </div>

      {/* Guest */}
      {(booking.guest_name  || d.guest_name)  && <Row icon={Users}  label="Guest"       value={booking.guest_name  || d.guest_name}  />}
      {(booking.guest_email || d.guest_email) && <Row icon={Mail}   label="Email"       value={booking.guest_email || d.guest_email} />}
      {(booking.guest_phone || d.guest_phone) && <Row icon={Phone}  label="Phone"       value={booking.guest_phone || d.guest_phone} />}

      {/* Dates */}
      {booking.visit_date   && <Row icon={Calendar}      label="Visit Date"     value={fmt(booking.visit_date)} />}
      {d.date               && <Row icon={Calendar}      label="Event Date"     value={fmt(d.date)} />}
      {d.rescheduled_at     && <Row icon={CalendarClock} label="Rescheduled On" value={fmt(d.rescheduled_at)} />}

      {/* Guests counts */}
      {(d.adults   || d.num_adults)   && <Row icon={Users}  label="Adults"   value={d.adults   || d.num_adults}   />}
      {(d.children || d.num_children) && <Row icon={Users}  label="Children" value={d.children || d.num_children} />}
      {booking.slots_booked           && <Row icon={Ticket} label="Slots"    value={booking.slots_booked}          />}
      {d.location                     && <Row icon={MapPin} label="Location" value={d.location}                    />}

      {/* Tickets */}
      {d.ticketSelections?.length > 0 && (
        <div className="py-2 border-b border-dashed border-slate-100">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
            <Ticket className="h-3 w-3" /> Tickets
          </p>
          <div className="space-y-1 ml-4">
            {d.ticketSelections.map((t: any, i: number) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-slate-600">{t.name} × {t.quantity} person(s)</span>
                <span className="font-bold text-slate-700">{fmtMoney(t.price * t.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      {d.selectedActivities?.length > 0 && (
        <div className="py-2 border-b border-dashed border-slate-100">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
            <Activity className="h-3 w-3" /> Activities
          </p>
          <div className="space-y-1 ml-4">
            {d.selectedActivities.map((a: any, i: number) => {
              const people = a.numberOfPeople || a.number_of_people || 1;
              return (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-slate-600">{a.name} — {people} person(s)</span>
                  <span className="font-bold text-slate-700">{fmtMoney(a.price * people)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Facilities */}
      {d.selectedFacilities?.length > 0 && (
        <div className="py-2 border-b border-dashed border-slate-100">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Facilities
          </p>
          <div className="space-y-1.5 ml-4">
            {d.selectedFacilities.map((f: any, i: number) => {
              const people = f.numberOfPeople || f.number_of_people || null;
              return (
                <div key={i} className="text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-700 font-semibold">{f.name}</span>
                    <span className="font-bold text-slate-700">{fmtMoney(f.price)}</span>
                  </div>
                  {f.startDate && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      From: {fmt(f.startDate)} → To: {fmt(f.endDate)}
                    </p>
                  )}
                  {people && (
                    <p className="text-[10px] text-slate-400">{people} person(s)</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Host contact */}
      {(booking.host_phone || booking.host_email) && (
        <div className="pt-2 pb-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Host Contact</p>
          <div className="flex flex-wrap gap-1.5">
            {booking.host_phone && (
              <a
                href={`tel:${booking.host_phone}`}
                className="flex items-center gap-1 text-[10px] bg-white border border-slate-200 rounded-full px-2.5 py-1 text-slate-600 hover:border-teal-400 transition-colors font-semibold"
              >
                <Phone className="h-3 w-3 text-teal-600" />
                {booking.host_phone}
              </a>
            )}
            {booking.host_email && (
              <a
                href={`mailto:${booking.host_email}`}
                className="flex items-center gap-1 text-[10px] bg-white border border-slate-200 rounded-full px-2.5 py-1 text-slate-600 hover:border-teal-400 transition-colors font-semibold"
              >
                <Mail className="h-3 w-3 text-teal-600" />
                {booking.host_email}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-4">
        <button
          onClick={() => downloadBooking(booking)}
          className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-600 rounded-xl py-2 text-xs font-bold hover:border-teal-400 hover:text-teal-700 transition-all"
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </button>

        {isReschedulable(booking) ? (
          <button
            onClick={onReschedule}
            className="flex-1 flex items-center justify-center gap-1.5 text-white rounded-xl py-2 text-xs font-bold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: TEAL }}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            Reschedule
          </button>
        ) : booking.booking_details?.rescheduled_at ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl py-2 text-xs font-bold cursor-not-allowed">
            <AlertTriangle className="h-3.5 w-3.5" />
            Rescheduled
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ─── Booking Card ─────────────────────────────────────────────────────────────

const BookingCard = ({
  booking,
  onReschedule,
}: {
  booking: Booking;
  onReschedule: (b: Booking) => void;
}) => {
  const [open, setOpen] = useState(false);
  const d = booking.booking_details || {};

  const name =
    d.trip_name || d.event_name || d.hotel_name ||
    d.place_name || d.item_name || "Booking";

  const displayDate = booking.visit_date || d.date;

  const typeLabel: Record<string, string> = {
    trip: "Trip", event: "Event", hotel: "Hotel",
    adventure_place: "Adventure", adventure: "Adventure",
  };

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all ${
      open ? "border-teal-200" : "border-slate-100"
    }`}>
      {/* Card header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors"
      >
        {/* Left: name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-teal-600">
              {typeLabel[booking.booking_type?.toLowerCase()] || booking.booking_type}
            </span>
            <StatusPill status={booking.status} />
            {d.rescheduled_at && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-200">
                Rescheduled
              </span>
            )}
          </div>

          <p className="font-bold text-sm text-slate-800 truncate">{name}</p>

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[10px] text-slate-400 font-medium">
            {displayDate && (
              <span className="flex items-center gap-0.5">
                <Calendar className="h-2.5 w-2.5" />
                {fmt(displayDate)}
              </span>
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

        {/* Right: amount + chevron */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <p className="text-sm font-black" style={{ color: TEAL }}>
            {fmtMoney(booking.total_amount)}
          </p>
          <StatusPill status={booking.payment_status} />
          <span className="text-[9px] text-slate-400 font-bold flex items-center gap-0.5 mt-0.5">
            {open ? <><ChevronUp className="h-3 w-3" /> less</> : <><ChevronDown className="h-3 w-3" /> details</>}
          </span>
        </div>
      </button>

      {open && (
        <BookingDetail booking={booking} onReschedule={() => onReschedule(booking)} />
      )}
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

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchBookings();
  }, [user]);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBookings(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async (id: string, newDate: string) => {
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return;
    const updated = {
      ...booking.booking_details,
      date: newDate,
      rescheduled_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("bookings")
      .update({ booking_details: updated })
      .eq("id", id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      throw error;
    }
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, booking_details: updated } : b))
    );
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
    upcoming: bookings.filter((b) => {
      const d = b.visit_date || b.booking_details?.date;
      return d && new Date(d) >= now;
    }).length,
    past: bookings.filter((b) => {
      const d = b.visit_date || b.booking_details?.date;
      return !d || new Date(d) < now;
    }).length,
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pb-20 md:pb-0">
        <Header />
        <main className="container px-4 py-12 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-teal-200 border-t-teal-600 animate-spin" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 animate-pulse">
            Loading…
          </p>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20 md:pb-0">
      <Header />

      <main className="container max-w-2xl mx-auto px-4 py-6">
        {/* Page header */}
        <div className="mb-6">
          <p className="text-[9px] font-bold uppercase tracking-widest text-teal-600 mb-0.5">
            My Account
          </p>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Bookings</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Filter tabs */}
        {bookings.length > 0 && (
          <div className="flex gap-1.5 mb-5 bg-white rounded-xl p-1 border border-slate-100">
            {(["all", "upcoming", "past"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  filter === f ? "text-white" : "text-slate-400 hover:text-slate-600"
                }`}
                style={filter === f ? { backgroundColor: TEAL } : undefined}
              >
                {f} <span className="opacity-60">({counts[f]})</span>
              </button>
            ))}
          </div>
        )}

        {/* Empty states */}
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center text-3xl">
              🗺️
            </div>
            <h2 className="text-lg font-black text-slate-700">No Bookings Yet</h2>
            <p className="text-slate-400 text-xs max-w-xs">
              Your trips, events, and reservations will appear here once you book something.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-1 text-white font-bold rounded-xl px-5 py-2.5 text-xs hover:opacity-90 transition-opacity"
              style={{ backgroundColor: TEAL }}
            >
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
              <BookingCard
                key={booking.id}
                booking={booking}
                onReschedule={setRescheduling}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
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