import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  Calendar, Users, MapPin, CalendarClock,
  X, CheckCircle, Download, ChevronDown, ChevronUp,
  Activity, Building2, Ticket, Phone,
  Mail, AlertTriangle, Loader2, Clock,
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

// ─── Constants & helpers ──────────────────────────────────────────────────────

const TEAL = "#008080";
const RESCHEDULABLE_TYPES = ["trip", "event", "hotel", "adventure_place", "adventure"];

const isReschedulable = (booking: Booking) =>
  RESCHEDULABLE_TYPES.includes(booking.booking_type?.toLowerCase()) &&
  ["confirmed", "pending"].includes(booking.status?.toLowerCase()) &&
  !booking.booking_details?.rescheduled_at;

const getTomorrow = () => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-KE", {
    weekday: "short", year: "numeric", month: "long", day: "numeric",
  });

const fmtShort = (d: string) =>
  new Date(d).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" });

const KES = (n: number) =>
  `KES ${new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

const daysBetween = (start: string, end: string) => {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(Math.ceil(ms / (1000 * 60 * 60 * 24)), 1);
};

const bookingName = (b: Booking) => {
  const d = b.booking_details || {};
  return d.trip_name || d.event_name || d.hotel_name || d.place_name || d.item_name || "Booking";
};

// ─── PDF Download ─────────────────────────────────────────────────────────────

const downloadPDF = async (booking: Booking) => {
  // Dynamic imports — qrcode must be in dependencies
  const [{ jsPDF }, QRCode] = await Promise.all([
    import("jspdf"),
    import("qrcode"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const d = booking.booking_details || {};
  const name = bookingName(booking);

  const teal  : [number,number,number] = [0, 128, 128];
  const coral : [number,number,number] = [255, 127, 80];
  const dark  : [number,number,number] = [30, 41, 59];
  const mid   : [number,number,number] = [100, 116, 139];
  const light : [number,number,number] = [248, 250, 252];
  const white : [number,number,number] = [255, 255, 255];

  let y = 0;

  const checkPage = (need: number) => {
    if (y + need > H - 60) {
      doc.addPage();
      y = 36;
    }
  };

  // ── Header band ──
  doc.setFillColor(...teal);
  doc.rect(0, 0, W, 90, "F");
  doc.setFillColor(...coral);
  doc.triangle(W - 100, 0, W, 0, W, 100, "F");

  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("REALTRAVO", 36, 38);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 240, 240);
  doc.text("BOOKING CONFIRMATION", 36, 54);

  const typeLabel = booking.booking_type?.toUpperCase() || "BOOKING";
  doc.setDrawColor(...white);
  doc.roundedRect(36, 62, doc.getTextWidth(typeLabel) + 16, 18, 4, 4, "D");
  doc.setTextColor(...white);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(typeLabel, 44, 74);

  y = 108;

  // ── Item title ──
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(name, 36, y);
  y += 6;
  doc.setDrawColor(...teal);
  doc.setLineWidth(2);
  doc.line(36, y, 200, y);
  y += 18;

  // ── Status pills ──
  const pillColors: Record<string, [number,number,number]> = {
    confirmed: [16, 185, 129],
    pending:   [245, 158, 11],
    cancelled: [239, 68, 68],
    paid:      [16, 185, 129],
    unpaid:    [148, 163, 184],
  };

  const pill = (label: string, color: [number,number,number], x: number, yy: number) => {
    doc.setFillColor(...color);
    const tw = doc.getTextWidth(label.toUpperCase()) + 18;
    doc.roundedRect(x, yy - 11, tw, 16, 4, 4, "F");
    doc.setTextColor(...white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + 9, yy);
    return x + tw + 8;
  };

  let px = 36;
  px = pill(booking.status, pillColors[booking.status?.toLowerCase()] || mid, px, y);
  px = pill(booking.payment_status, pillColors[booking.payment_status?.toLowerCase()] || mid, px, y);
  if (d.rescheduled_at) pill("RESCHEDULED", [59, 130, 246], px, y);
  y += 24;

  // ── Layout helpers ──
  const COL1 = 36;
  const COL2 = W / 2 + 10;
  const COL_W = W / 2 - 56;

  const section = (title: string) => {
    checkPage(36);
    doc.setFillColor(...light);
    doc.roundedRect(36, y, W - 72, 20, 4, 4, "F");
    doc.setTextColor(...teal);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(title.toUpperCase(), 44, y + 13);
    y += 28;
  };

  const field = (label: string, value: string, x: number, fw = false) => {
    if (!value || value === "—") return 0;
    const maxW = fw ? W - 90 : COL_W;
    checkPage(32);
    doc.setTextColor(...mid);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(value, maxW);
    doc.text(lines, x, y + 11);
    return lines.length * 12 + 17;
  };

  const fieldRow = (l1: string, v1: string, l2: string, v2: string) => {
    checkPage(36);
    const startY = y;
    const h1 = field(l1, v1, COL1) || 0;
    const h2 = field(l2, v2, COL2) || 0;
    y = startY + Math.max(h1, h2) + 4;
  };

  const fieldFull = (label: string, value: string) => {
    checkPage(36);
    const h = field(label, value, COL1, true) || 0;
    y += h + 4;
  };

  // ── Booking Details ──
  section("Booking Details");
  fieldRow("Booking ID", booking.id, "Booked On", fmt(booking.created_at));
  fieldRow("Type", booking.booking_type?.toUpperCase() || "—", "Total Amount", KES(booking.total_amount));

  if (d.rescheduled_at) {
    fieldRow(
      "Original Visit Date", d.original_date ? fmt(d.original_date) : "—",
      "New Visit Date ✦",    d.date ? fmt(d.date) : "—",
    );
    fieldFull("Rescheduled On", fmt(d.rescheduled_at));
  } else {
    if (booking.visit_date || d.date) {
      fieldRow(
        booking.visit_date ? "Visit / Check-In Date" : "Event Date",
        booking.visit_date ? fmt(booking.visit_date) : (d.date ? fmt(d.date) : ""),
        d.date && booking.visit_date ? "Event Date" : "",
        d.date && booking.visit_date ? fmt(d.date) : "",
      );
    }
  }
  y += 6;

  // ── Guest Details ──
  section("Guest Details");
  fieldRow("Guest Name", booking.guest_name || d.guest_name || "—", "Email", booking.guest_email || d.guest_email || "—");
  fieldFull("Phone", booking.guest_phone || d.guest_phone || "—");
  y += 6;

  // ── Guests & Slots ──
  section("Guests & Slots");
  fieldRow(
    "Adults",   String(d.adults   || d.num_adults   || "—"),
    "Children", String(d.children || d.num_children || 0),
  );
  if (booking.slots_booked || d.location) {
    fieldRow("Slots Booked", String(booking.slots_booked || "—"), "Location", d.location || "—");
  }
  y += 6;

  // ── Tickets ──
  if (d.ticketSelections?.length) {
    section("Tickets");
    d.ticketSelections.forEach((t: any) => {
      fieldRow(t.name, `× ${t.quantity} tickets`, "Subtotal", KES(t.price * t.quantity));
    });
    y += 6;
  }

  // ── Activities ──
  if (d.selectedActivities?.length) {
    section("Activities");
    d.selectedActivities.forEach((a: any, i: number) => {
      checkPage(60);
      const subtotal = (a.price || 0) * (a.numberOfPeople || 1);

      doc.setTextColor(...dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${i + 1}. ${a.name}`, COL1, y);
      doc.setTextColor(...teal);
      doc.text(KES(subtotal), W - 36, y, { align: "right" });
      y += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...mid);
      const ppl     = `${a.numberOfPeople || 1} ${(a.numberOfPeople || 1) === 1 ? "person" : "people"}`;
      const rate    = `@ ${KES(a.price || 0)}/person`;
      const dateStr = a.startDate ? `  ·  ${fmtShort(a.startDate)} → ${fmtShort(a.endDate || a.startDate)}` : "";
      const daysStr = a.startDate && a.endDate ? `  ·  ${daysBetween(a.startDate, a.endDate)} day(s)` : "";
      doc.text(`${ppl}  ${rate}${dateStr}${daysStr}`, COL1 + 10, y);
      y += 16;
    });
    y += 4;
  }

  // ── Facilities ──
  if (d.selectedFacilities?.length) {
    section("Facilities");
    d.selectedFacilities.forEach((f: any, i: number) => {
      checkPage(60);
      const days     = f.startDate && f.endDate ? daysBetween(f.startDate, f.endDate) : 1;
      const subtotal = (f.price || 0) * days;

      doc.setTextColor(...dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${i + 1}. ${f.name}`, COL1, y);
      doc.setTextColor(...teal);
      doc.text(KES(subtotal), W - 36, y, { align: "right" });
      y += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...mid);
      const rateStr = `@ ${KES(f.price || 0)}/day`;
      const daysStr = `${days} day(s)`;
      const dateStr = f.startDate
        ? `  Check-in: ${fmtShort(f.startDate)}  →  Check-out: ${fmtShort(f.endDate)}`
        : "";
      doc.text(`${daysStr}  ${rateStr}${dateStr}`, COL1 + 10, y);
      y += 16;
    });
    y += 4;
  }

  // ── Host contact ──
  if (booking.host_phone || booking.host_email) {
    section("Host Contact");
    fieldRow("Phone", booking.host_phone || "—", "Email", booking.host_email || "—");
    y += 6;
  }

  // ── Grand total band ──
  checkPage(60);
  y += 8;
  doc.setFillColor(...teal);
  doc.roundedRect(36, y, W - 72, 44, 6, 6, "F");
  doc.setTextColor(200, 240, 240);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("TOTAL AMOUNT PAID (KES)", 52, y + 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...white);
  doc.text(KES(booking.total_amount), 52, y + 35);
  y += 64;

  // ── QR Code ──
  checkPage(130);
  const qrData = JSON.stringify({
    id:      booking.id,
    item:    name,
    type:    booking.booking_type,
    status:  booking.status,
    payment: booking.payment_status,
    amount:  booking.total_amount,
    date:    booking.visit_date || d.date || booking.created_at,
    guest:   booking.guest_name || d.guest_name,
  });

  // QRCode.default handles both ESM and CJS interop
  const qrLib = (QRCode as any).default ?? QRCode;
  const qrUrl: string = await qrLib.toDataURL(qrData, {
    width: 110,
    margin: 1,
    color: { dark: "#003333", light: "#ffffff" },
  });

  const QR_SIZE = 110;
  doc.setFillColor(...white);
  doc.roundedRect(W - 36 - QR_SIZE - 4, y - 4, QR_SIZE + 8, QR_SIZE + 26, 6, 6, "F");
  doc.addImage(qrUrl, "PNG", W - 36 - QR_SIZE, y, QR_SIZE, QR_SIZE);
  doc.setTextColor(...mid);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Scan to verify booking", W - 36 - QR_SIZE + 8, y + QR_SIZE + 16);

  // Disclaimer text
  doc.setTextColor(...mid);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  const note = doc.splitTextToSize(
    "This is your official booking confirmation from Realtravo. Please present this document at the venue. All details are verified and cannot be edited.",
    W / 2 - 46,
  );
  doc.text(note, 36, y + 16);

  // ── Footer strip ──
  doc.setFillColor(...teal);
  doc.rect(0, H - 32, W, 32, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...white);
  doc.text("realtravo.com", 36, H - 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 230, 230);
  doc.text("Thank you for booking with Realtravo!", W / 2, H - 12, { align: "center" });
  doc.text(new Date().toLocaleDateString("en-KE"), W - 36, H - 12, { align: "right" });

  doc.save(`realtravo-booking-${booking.id.slice(0, 8)}.pdf`);
};

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
    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${map[status?.toLowerCase()] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {status}
    </span>
  );
};

// ─── Detail row ───────────────────────────────────────────────────────────────

const Row = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
  <div className="flex items-start gap-3 py-3 border-b border-dashed border-slate-100 last:border-0">
    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon className="h-4 w-4 text-teal-600" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <div className="text-sm font-semibold text-slate-800 break-words">{value || "—"}</div>
    </div>
  </div>
);

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

  const name = bookingName(booking);
  const current =
    booking.booking_details?.date
      ? new Date(booking.booking_details.date).toISOString().split("T")[0]
      : booking.visit_date
      ? new Date(booking.visit_date).toISOString().split("T")[0]
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
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div style={{ background: `linear-gradient(135deg, ${TEAL}, #00b3b3)` }} className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-white/80" />
            <div>
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Reschedule</p>
              <p className="text-white font-black text-base truncate max-w-[200px]">{name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        <div className="p-6">
          {done ? (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <CheckCircle className="h-16 w-16 text-emerald-500" />
              <p className="font-black text-xl text-slate-800">All Set!</p>
              <p className="text-slate-500 text-sm">
                New visit date: <span className="text-slate-800 font-bold">{fmt(newDate)}</span>
              </p>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mt-1">
                ⚠ This was your one allowed reschedule
              </p>
            </div>
          ) : (
            <>
              {current && (
                <div className="mb-4 bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Current Visit Date</p>
                  <p className="text-sm font-bold text-slate-700">{fmt(current)}</p>
                </div>
              )}
              <div className="mb-5">
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  New Visit Date
                </label>
                <input
                  type="date"
                  min={getTomorrow()}
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full border-2 border-slate-200 focus:border-teal-500 rounded-xl px-4 py-3 text-sm font-semibold bg-white outline-none transition-colors"
                />
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                  You can only reschedule this booking <strong>once</strong>. This cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 border-2 border-slate-200 text-slate-600 font-bold rounded-xl py-3 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handle}
                  disabled={!newDate || saving}
                  style={newDate && !saving ? { background: `linear-gradient(135deg, ${TEAL}, #00b3b3)` } : undefined}
                  className="flex-1 text-white font-black rounded-xl py-3 text-sm disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {saving ? "Saving…" : "Confirm Reschedule"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Expanded Detail Panel ────────────────────────────────────────────────────

const BookingDetail = ({
  booking,
  onReschedule,
}: {
  booking: Booking;
  onReschedule: () => void;
}) => {
  const [downloading, setDownloading] = useState(false);
  const d    = booking.booking_details || {};
  const name = bookingName(booking);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadPDF(booking);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const activitiesTotal = (d.selectedActivities || []).reduce(
    (sum: number, a: any) => sum + (a.price || 0) * (a.numberOfPeople || 1),
    0,
  );

  const facilitiesTotal = (d.selectedFacilities || []).reduce((sum: number, f: any) => {
    const days = f.startDate && f.endDate ? daysBetween(f.startDate, f.endDate) : 1;
    return sum + (f.price || 0) * days;
  }, 0);

  const ticketsTotal = (d.ticketSelections || []).reduce(
    (sum: number, t: any) => sum + (t.price || 0) * (t.quantity || 0),
    0,
  );

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5">
      {/* Item name & ID */}
      <div className="mb-5">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-0.5">Item</p>
        <p className="text-lg font-black text-slate-800">{name}</p>
        <p className="text-xs text-slate-400 mt-0.5 font-mono">ID: {booking.id}</p>
      </div>

      {/* Guest info */}
      {(booking.guest_name  || d.guest_name)  && <Row icon={Users} label="Guest Name"  value={booking.guest_name  || d.guest_name} />}
      {(booking.guest_email || d.guest_email) && <Row icon={Mail}  label="Guest Email" value={booking.guest_email || d.guest_email} />}
      {(booking.guest_phone || d.guest_phone) && <Row icon={Phone} label="Guest Phone" value={booking.guest_phone || d.guest_phone} />}

      {/* Dates */}
      {d.rescheduled_at ? (
        <>
          {d.original_date && (
            <div className="flex items-start gap-3 py-3 border-b border-dashed border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Calendar className="h-4 w-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Original Visit Date</p>
                <p className="text-sm font-semibold text-slate-400 line-through">{fmt(d.original_date)}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 py-3 border-b border-dashed border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <CalendarClock className="h-4 w-4 text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">New Visit Date</p>
                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                  Rescheduled
                </span>
              </div>
              <p className="text-sm font-black" style={{ color: TEAL }}>{fmt(d.date)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Changed on {fmt(d.rescheduled_at)}</p>
            </div>
          </div>
        </>
      ) : (
        <>
          {booking.visit_date && <Row icon={Calendar} label="Visit / Check-In Date" value={fmt(booking.visit_date)} />}
          {d.date             && <Row icon={Calendar} label="Event Date"             value={fmt(d.date)} />}
        </>
      )}

      {/* People */}
      {(d.adults   || d.num_adults)   && <Row icon={Users}  label="Adults"       value={`${d.adults || d.num_adults} adult(s)`} />}
      {(d.children || d.num_children) && <Row icon={Users}  label="Children"     value={`${d.children || d.num_children} child(ren)`} />}
      {booking.slots_booked           && <Row icon={Ticket} label="Slots Booked" value={booking.slots_booked} />}
      {d.location                     && <Row icon={MapPin} label="Location"     value={d.location} />}

      {/* Tickets */}
      {d.ticketSelections?.length > 0 && (
        <div className="py-3 border-b border-dashed border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                <Ticket className="h-4 w-4 text-teal-600" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tickets</p>
            </div>
            <span className="text-xs font-black text-slate-500">
              Subtotal: <span style={{ color: TEAL }}>{KES(ticketsTotal)}</span>
            </span>
          </div>
          <div className="ml-11 space-y-2">
            {d.ticketSelections.map((t: any, i: number) => (
              <div key={i} className="bg-white rounded-xl px-3 py-2.5 border border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">{t.name}</span>
                  <span className="text-sm font-black" style={{ color: TEAL }}>{KES(t.price * t.quantity)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{t.quantity} ticket(s) × {KES(t.price)} each</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      {d.selectedActivities?.length > 0 && (
        <div className="py-3 border-b border-dashed border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                <Activity className="h-4 w-4 text-teal-600" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activities</p>
            </div>
            <span className="text-xs font-black text-slate-500">
              Subtotal: <span style={{ color: TEAL }}>{KES(activitiesTotal)}</span>
            </span>
          </div>
          <div className="ml-11 space-y-3">
            {d.selectedActivities.map((a: any, i: number) => {
              const subtotal = (a.price || 0) * (a.numberOfPeople || 1);
              const days     = a.startDate && a.endDate ? daysBetween(a.startDate, a.endDate) : null;
              return (
                <div key={i} className="bg-white rounded-xl px-3 py-3 border border-slate-100">
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-sm font-black text-slate-800">{a.name}</span>
                    <span className="text-sm font-black ml-2 flex-shrink-0" style={{ color: TEAL }}>{KES(subtotal)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {a.numberOfPeople || 1} {(a.numberOfPeople || 1) === 1 ? "person" : "people"}
                    </span>
                    <span>Rate: {KES(a.price || 0)}/person</span>
                    {a.startDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {fmtShort(a.startDate)}
                        {a.endDate && a.endDate !== a.startDate ? ` → ${fmtShort(a.endDate)}` : ""}
                      </span>
                    )}
                    {days && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {days} day(s)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Facilities */}
      {d.selectedFacilities?.length > 0 && (
        <div className="py-3 border-b border-dashed border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-teal-600" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Facilities</p>
            </div>
            <span className="text-xs font-black text-slate-500">
              Subtotal: <span style={{ color: TEAL }}>{KES(facilitiesTotal)}</span>
            </span>
          </div>
          <div className="ml-11 space-y-3">
            {d.selectedFacilities.map((f: any, i: number) => {
              const days     = f.startDate && f.endDate ? daysBetween(f.startDate, f.endDate) : 1;
              const subtotal = (f.price || 0) * days;
              return (
                <div key={i} className="bg-white rounded-xl px-3 py-3 border border-slate-100">
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-sm font-black text-slate-800">{f.name}</span>
                    <span className="text-sm font-black ml-2 flex-shrink-0" style={{ color: TEAL }}>{KES(subtotal)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {f.startDate && (
                      <>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-emerald-500" />
                          <span className="font-semibold text-emerald-700">Check-in:</span> {fmtShort(f.startDate)}
                        </span>
                        {f.endDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-red-400" />
                            <span className="font-semibold text-red-600">Check-out:</span> {fmtShort(f.endDate)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {days} night(s)
                        </span>
                      </>
                    )}
                    <span>Rate: {KES(f.price || 0)}/night</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Host contact */}
      {(booking.host_phone || booking.host_email) && (
        <div className="pt-3 pb-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Host Contact</p>
          <div className="flex flex-wrap gap-2">
            {booking.host_phone && (
              <a
                href={`tel:${booking.host_phone}`}
                className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-700 hover:border-teal-400 transition-colors font-semibold"
              >
                <Phone className="h-3.5 w-3.5 text-teal-600" />{booking.host_phone}
              </a>
            )}
            {booking.host_email && (
              <a
                href={`mailto:${booking.host_email}`}
                className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-700 hover:border-teal-400 transition-colors font-semibold"
              >
                <Mail className="h-3.5 w-3.5 text-teal-600" />{booking.host_email}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mt-5 rounded-2xl overflow-hidden border border-teal-100">
        <div style={{ background: `linear-gradient(135deg, ${TEAL}, #00b3b3)` }} className="px-4 py-2">
          <p className="text-white/80 text-[10px] font-black uppercase tracking-widest">Booking Summary</p>
        </div>
        <div className="bg-white px-4 py-3 space-y-1.5">
          {ticketsTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tickets</span>
              <span className="font-semibold text-slate-700">{KES(ticketsTotal)}</span>
            </div>
          )}
          {activitiesTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Activities</span>
              <span className="font-semibold text-slate-700">{KES(activitiesTotal)}</span>
            </div>
          )}
          {facilitiesTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Facilities</span>
              <span className="font-semibold text-slate-700">{KES(facilitiesTotal)}</span>
            </div>
          )}
          {(d.adults || d.num_adults) && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Entry / Base</span>
              <span className="font-semibold text-slate-700">
                {KES(booking.total_amount - ticketsTotal - activitiesTotal - facilitiesTotal)}
              </span>
            </div>
          )}
          <div className="border-t border-slate-100 pt-2 mt-2 flex justify-between">
            <span className="font-black text-sm text-slate-700">Total Paid</span>
            <span className="font-black text-base" style={{ color: TEAL }}>{KES(booking.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex-1 flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-700 rounded-2xl py-3 text-sm font-black hover:border-teal-400 hover:text-teal-700 transition-all disabled:opacity-50"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? "Generating…" : "Download PDF"}
        </button>

        {isReschedulable(booking) ? (
          <button
            onClick={onReschedule}
            style={{ background: `linear-gradient(135deg, ${TEAL}, #00b3b3)` }}
            className="flex-1 flex items-center justify-center gap-2 text-white rounded-2xl py-3 text-sm font-black hover:opacity-90"
          >
            <CalendarClock className="h-4 w-4" /> Reschedule
          </button>
        ) : booking.booking_details?.rescheduled_at ? (
          <div className="flex-1 flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl py-3 text-sm font-bold cursor-not-allowed">
            <AlertTriangle className="h-4 w-4" /> Already Rescheduled
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
  const d    = booking.booking_details || {};
  const name = bookingName(booking);

  const typeColors: Record<string, string> = {
    trip:            "bg-blue-50 text-blue-700 border-blue-200",
    event:           "bg-violet-50 text-violet-700 border-violet-200",
    hotel:           "bg-orange-50 text-orange-700 border-orange-200",
    adventure_place: "bg-emerald-50 text-emerald-700 border-emerald-200",
    adventure:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  const typeEmojis: Record<string, string> = {
    trip: "✈️", event: "🎟️", hotel: "🏨",
    adventure_place: "🌿", adventure: "🌿",
  };

  const typeClass   = typeColors[booking.booking_type?.toLowerCase()] || "bg-slate-50 text-slate-600 border-slate-200";
  const emoji       = typeEmojis[booking.booking_type?.toLowerCase()] || "📋";
  const displayDate = d.rescheduled_at ? d.date : (booking.visit_date || d.date);

  return (
    <div className={`bg-white rounded-3xl border-2 overflow-hidden transition-all duration-300 ${open ? "border-teal-300 shadow-lg shadow-teal-50" : "border-transparent shadow-md hover:shadow-lg"}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-5 flex items-start gap-4 hover:bg-slate-50/40 transition-colors"
      >
        <div
          className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-xl"
          style={{ background: `linear-gradient(135deg, ${TEAL}15, ${TEAL}28)` }}
        >
          {emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${typeClass}`}>
              {booking.booking_type}
            </span>
            <StatusPill status={booking.status} />
            {d.rescheduled_at && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-200">
                Rescheduled
              </span>
            )}
          </div>

          <p className="font-black text-slate-800 text-base leading-tight truncate">{name}</p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500 font-medium">
            {displayDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {d.rescheduled_at && <span className="text-blue-500 font-bold">New: </span>}
                {fmt(displayDate)}
              </span>
            )}
            {(d.adults || d.num_adults) && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {d.adults || d.num_adults} Adults
                {(d.children || d.num_children) ? ` · ${d.children || d.num_children} Kids` : ""}
              </span>
            )}
            {d.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{d.location}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <p className="text-xl font-black" style={{ color: TEAL }}>{KES(booking.total_amount)}</p>
          <StatusPill status={booking.payment_status} />
          <div className="mt-1 flex items-center gap-1 text-slate-400 text-xs font-bold">
            {open ? <><ChevronUp className="h-3.5 w-3.5" /> Less</> : <><ChevronDown className="h-3.5 w-3.5" /> Details</>}
          </div>
        </div>
      </button>

      {open && <BookingDetail booking={booking} onReschedule={() => onReschedule(booking)} />}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const Bookings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);

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
      original_date:  booking.booking_details?.date || booking.visit_date || null,
      date:           newDate,
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
      prev.map((b) => (b.id === id ? { ...b, booking_details: updated } : b)),
    );
    toast({ title: "Rescheduled ✓", description: `New visit date: ${fmt(newDate)}` });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pb-20 md:pb-0">
        <Header />
        <main className="container px-4 py-12 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-400 animate-pulse">
            Loading bookings…
          </p>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20 md:pb-0">
      <Header />
      <main className="container max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-teal-600 mb-1">My Account</p>
          <h1 className="text-4xl font-black text-slate-800 leading-none tracking-tight">Bookings</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {bookings.length} booking{bookings.length !== 1 ? "s" : ""} total
          </p>
        </div>

        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-20 h-20 rounded-3xl bg-teal-50 flex items-center justify-center text-4xl">🗺️</div>
            <h2 className="text-2xl font-black text-slate-700">No Bookings Yet</h2>
            <p className="text-slate-400 text-sm max-w-xs">
              Your trips, events, and reservations will appear here once you book something.
            </p>
            <button
              onClick={() => navigate("/")}
              style={{ background: `linear-gradient(135deg, ${TEAL}, #00b3b3)` }}
              className="mt-2 text-white font-black rounded-2xl px-6 py-3 text-sm hover:opacity-90"
            >
              Explore Now
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onReschedule={setRescheduling}
              />
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