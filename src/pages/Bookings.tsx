import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
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
    !alreadyRescheduled // 1-reschedule limit
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

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

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
      className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
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
  <div className="flex items-start gap-3 py-3 border-b border-dashed border-slate-100 last:border-0">
    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon className="h-4 w-4 text-teal-600" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 break-words">{value || "—"}</p>
    </div>
  </div>
);

// ─── Download helper ──────────────────────────────────────────────────────────

const downloadBooking = (booking: Booking) => {
  const d = booking.booking_details || {};
  const name =
    d.trip_name || d.event_name || d.hotel_name ||
    d.place_name || d.item_name || "Booking";

  const section = (title: string, lines: string[]) =>
    lines.length ? [`── ${title} ${"─".repeat(42 - title.length)}`, ...lines, ""].join("\n") : "";

  const lines = [
    "╔══════════════════════════════════════════╗",
    "║          REALTRAVO BOOKING RECEIPT       ║",
    "╚══════════════════════════════════════════╝",
    "",
    `Booking ID      : ${booking.id}`,
    `Type            : ${booking.booking_type?.toUpperCase()}`,
    `Item            : ${name}`,
    `Status          : ${booking.status}`,
    `Payment Status  : ${booking.payment_status}`,
    `Total Amount    : ${fmtMoney(booking.total_amount)}`,
    `Booked On       : ${fmt(booking.created_at)}`,
    booking.visit_date ? `Visit Date      : ${fmt(booking.visit_date)}` : "",
    d.date ? `Event Date      : ${fmt(d.date)}` : "",
    "",
    section("GUEST DETAILS", [
      `Name            : ${booking.guest_name || d.guest_name || "—"}`,
      `Email           : ${booking.guest_email || d.guest_email || "—"}`,
      `Phone           : ${booking.guest_phone || d.guest_phone || "—"}`,
    ]),
    section("BOOKING DETAILS", [
      `Adults          : ${d.adults || d.num_adults || "—"}`,
      `Children        : ${d.children || d.num_children || "—"}`,
      `Slots Booked    : ${booking.slots_booked || "—"}`,
      d.location ? `Location        : ${d.location}` : "",
    ].filter(Boolean)),
    d.ticketSelections?.length
      ? section("TICKETS", d.ticketSelections.map(
          (t: any) => `  • ${t.name} × ${t.quantity} — ${fmtMoney(t.price * t.quantity)}`
        ))
      : "",
    d.selectedActivities?.length
      ? section("ACTIVITIES", d.selectedActivities.map(
          (a: any) => `  • ${a.name} × ${a.numberOfPeople} — ${fmtMoney(a.price * a.numberOfPeople)}`
        ))
      : "",
    d.selectedFacilities?.length
      ? section("FACILITIES", d.selectedFacilities.map(
          (f: any) =>
            `  • ${f.name}${f.startDate ? ` (${fmt(f.startDate)} → ${fmt(f.endDate)})` : ""} — ${fmtMoney(f.price)}`
        ))
      : "",
    booking.host_phone ? `Host Phone      : ${booking.host_phone}` : "",
    booking.host_email ? `Host Email      : ${booking.host_email}` : "",
    d.rescheduled_at ? `\nRescheduled At  : ${fmt(d.rescheduled_at)}` : "",
    "",
    "────────────────────────────────────────────",
    "Thank you for booking with Realtravo!",
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");

  const blob = new Blob([lines], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `booking-${booking.id.slice(0, 8)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
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
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

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
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          style={{ background: `linear-gradient(135deg, ${TEAL}, #00b3b3)` }}
          className="px-6 py-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-white/80" />
            <div>
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Reschedule</p>
              <p className="text-white font-black text-base truncate max-w-[200px]">{name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
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
                Rescheduled to{" "}
                <span className="text-slate-800 font-bold">{fmt(newDate)}</span>
              </p>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mt-1">
                ⚠ This was your one allowed reschedule
              </p>
            </div>
          ) : (
            <>
              {current && (
                <div className="mb-4 flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3">
                  <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Current Date</p>
                    <p className="text-sm font-semibold text-slate-700">{fmt(current)}</p>
                  </div>
                </div>
              )}

              <div className="mb-5">
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  Select New Date
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
                  You can only reschedule this booking <strong>once</strong>. This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 border-2 border-slate-200 text-slate-600 font-bold rounded-xl py-3 text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handle}
                  disabled={!newDate || saving}
                  style={
                    newDate && !saving
                      ? { background: `linear-gradient(135deg, ${TEAL}, #00b3b3)` }
                      : undefined
                  }
                  className="flex-1 text-white font-black rounded-xl py-3 text-sm disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
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
    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5">
      {/* Item name */}
      <div className="mb-5">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-0.5">Item</p>
        <p className="text-lg font-black text-slate-800">{name}</p>
        <p className="text-xs text-slate-400 mt-0.5">ID: {booking.id}</p>
      </div>

      {/* Guest */}
      {(booking.guest_name || d.guest_name) && (
        <Row icon={Users} label="Guest Name" value={booking.guest_name || d.guest_name} />
      )}
      {(booking.guest_email || d.guest_email) && (
        <Row icon={Mail} label="Guest Email" value={booking.guest_email || d.guest_email} />
      )}
      {(booking.guest_phone || d.guest_phone) && (
        <Row icon={Phone} label="Guest Phone" value={booking.guest_phone || d.guest_phone} />
      )}

      {/* Dates */}
      {booking.visit_date && (
        <Row icon={Calendar} label="Visit / Check-In Date" value={fmt(booking.visit_date)} />
      )}
      {d.date && <Row icon={Calendar} label="Event Date" value={fmt(d.date)} />}
      {d.rescheduled_at && (
        <Row icon={CalendarClock} label="Rescheduled On" value={fmt(d.rescheduled_at)} />
      )}

      {/* Guests */}
      {(d.adults || d.num_adults) && (
        <Row icon={Users} label="Adults" value={d.adults || d.num_adults} />
      )}
      {(d.children || d.num_children) && (
        <Row icon={Users} label="Children" value={d.children || d.num_children} />
      )}
      {booking.slots_booked && (
        <Row icon={Ticket} label="Slots Booked" value={booking.slots_booked} />
      )}
      {d.location && <Row icon={MapPin} label="Location" value={d.location} />}

      {/* Tickets */}
      {d.ticketSelections?.length > 0 && (
        <div className="py-3 border-b border-dashed border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Ticket className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tickets</p>
          </div>
          <div className="ml-11 space-y-2">
            {d.ticketSelections.map((t: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-600">{t.name} × {t.quantity}</span>
                <span className="font-bold text-slate-800">{fmtMoney(t.price * t.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      {d.selectedActivities?.length > 0 && (
        <div className="py-3 border-b border-dashed border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Activity className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activities</p>
          </div>
          <div className="ml-11 space-y-2">
            {d.selectedActivities.map((a: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-600">{a.name} × {a.numberOfPeople}</span>
                <span className="font-bold text-slate-800">{fmtMoney(a.price * a.numberOfPeople)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Facilities */}
      {d.selectedFacilities?.length > 0 && (
        <div className="py-3 border-b border-dashed border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Facilities</p>
          </div>
          <div className="ml-11 space-y-3">
            {d.selectedFacilities.map((f: any, i: number) => (
              <div key={i} className="text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-700 font-semibold">{f.name}</span>
                  <span className="font-bold text-slate-800">{fmtMoney(f.price)}</span>
                </div>
                {f.startDate && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {fmt(f.startDate)} → {fmt(f.endDate)}
                  </p>
                )}
              </div>
            ))}
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
                <Phone className="h-3.5 w-3.5 text-teal-600" />
                {booking.host_phone}
              </a>
            )}
            {booking.host_email && (
              <a
                href={`mailto:${booking.host_email}`}
                className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-700 hover:border-teal-400 transition-colors font-semibold"
              >
                <Mail className="h-3.5 w-3.5 text-teal-600" />
                {booking.host_email}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-5">
        <button
          onClick={() => downloadBooking(booking)}
          className="flex-1 flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-700 rounded-2xl py-3 text-sm font-black hover:border-teal-400 hover:text-teal-700 transition-all"
        >
          <Download className="h-4 w-4" />
          Download
        </button>

        {isReschedulable(booking) ? (
          <button
            onClick={onReschedule}
            style={{ background: `linear-gradient(135deg, ${TEAL}, #00b3b3)` }}
            className="flex-1 flex items-center justify-center gap-2 text-white rounded-2xl py-3 text-sm font-black hover:opacity-90 transition-opacity"
          >
            <CalendarClock className="h-4 w-4" />
            Reschedule
          </button>
        ) : booking.booking_details?.rescheduled_at ? (
          <div className="flex-1 flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl py-3 text-sm font-bold cursor-not-allowed">
            <AlertTriangle className="h-4 w-4" />
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

  const typeColors: Record<string, string> = {
    trip:           "bg-blue-50 text-blue-700 border-blue-200",
    event:          "bg-violet-50 text-violet-700 border-violet-200",
    hotel:          "bg-orange-50 text-orange-700 border-orange-200",
    adventure_place:"bg-emerald-50 text-emerald-700 border-emerald-200",
    adventure:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  const typeClass =
    typeColors[booking.booking_type?.toLowerCase()] ||
    "bg-slate-50 text-slate-600 border-slate-200";

  const typeEmoji: Record<string, string> = {
    trip: "✈️", event: "🎟️", hotel: "🏨",
    adventure_place: "🌿", adventure: "🌿",
  };
  const emoji = typeEmoji[booking.booking_type?.toLowerCase()] || "📋";

  const displayDate = booking.visit_date || d.date;

  return (
    <div
      className={`bg-white rounded-3xl border-2 overflow-hidden transition-all duration-300 ${
        open
          ? "border-teal-300 shadow-lg shadow-teal-50"
          : "border-transparent shadow-md hover:shadow-lg"
      }`}
    >
      {/* Always-visible header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-5 flex items-start gap-4 hover:bg-slate-50/40 transition-colors"
      >
        {/* Emoji icon */}
        <div
          className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-xl"
          style={{ background: `linear-gradient(135deg, ${TEAL}15, ${TEAL}28)` }}
        >
          {emoji}
        </div>

        <div className="flex-1 min-w-0">
          {/* Badges */}
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
                {fmt(displayDate)}
              </span>
            )}
            {(d.adults || d.num_adults) && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {d.adults || d.num_adults} Adults
                {(d.children || d.num_children)
                  ? ` · ${d.children || d.num_children} Kids`
                  : ""}
              </span>
            )}
            {d.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {d.location}
              </span>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <p className="text-xl font-black" style={{ color: TEAL }}>
            {fmtMoney(booking.total_amount)}
          </p>
          <StatusPill status={booking.payment_status} />
          <div className="mt-1 flex items-center gap-1 text-slate-400 text-xs font-bold">
            {open ? (
              <><ChevronUp className="h-3.5 w-3.5" /> Less</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5" /> Details</>
            )}
          </div>
        </div>
      </button>

      {/* Expandable detail */}
      {open && (
        <BookingDetail
          booking={booking}
          onReschedule={() => onReschedule(booking)}
        />
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const Bookings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");

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
        <main className="container px-4 py-12 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-400 animate-pulse">
            Loading bookings…
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

      <main className="container max-w-2xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-teal-600 mb-1">
            My Account
          </p>
          <h1 className="text-4xl font-black text-slate-800 leading-none tracking-tight">
            Bookings
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {bookings.length} booking{bookings.length !== 1 ? "s" : ""} total
          </p>
        </div>

        {/* Filter tabs */}
        {bookings.length > 0 && (
          <div className="flex gap-2 mb-6 bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100">
            {(["all", "upcoming", "past"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  filter === f
                    ? "text-white shadow-md"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                style={
                  filter === f
                    ? { background: `linear-gradient(135deg, ${TEAL}, #00b3b3)` }
                    : {}
                }
              >
                {f}{" "}
                <span className="opacity-60">({counts[f]})</span>
              </button>
            ))}
          </div>
        )}

        {/* Empty states */}
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-20 h-20 rounded-3xl bg-teal-50 flex items-center justify-center text-4xl">
              🗺️
            </div>
            <h2 className="text-2xl font-black text-slate-700">No Bookings Yet</h2>
            <p className="text-slate-400 text-sm max-w-xs">
              Your trips, events, and reservations will all appear here once you book something.
            </p>
            <button
              onClick={() => navigate("/")}
              style={{ background: `linear-gradient(135deg, ${TEAL}, #00b3b3)` }}
              className="mt-2 text-white font-black rounded-2xl px-6 py-3 text-sm hover:opacity-90 transition-opacity"
            >
              Explore Now
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 font-semibold">No {filter} bookings found</p>
          </div>
        ) : (
          <div className="space-y-4">
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