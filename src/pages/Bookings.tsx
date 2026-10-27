import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { getLocalBookings, updateLocalBooking } from "@/lib/localBookings";
import { Button } from "@/components/ui/button";
import {
  Calendar, Users, MapPin, CalendarClock,
  X, CheckCircle, Download, ChevronDown, ChevronUp,
  Activity, Building2, Ticket, Phone,
  Mail, AlertTriangle, LogIn, UserPlus, BookOpenCheck, CreditCard, Clock, QrCode,
} from "lucide-react";
import {
  generateBookingPDF, getBookingMeta as getMeta, getBookingLines, getHostContact, getItemName,
  fmtMoney, fmtDate as fmt, qrPayload, qrImageUrl,
} from "@/lib/bookingPdf";
import { inquiryPayPath, inquiryAmount, inquiryLines } from "@/lib/bookingEmail";

// ── Design tokens ─────────────────────────────────────────────────────────
const FOREST       = "#1F4D3A";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const CLAY_LIGHT   = "#E0824F";
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

const RESCHEDULABLE_TYPES = ["trip", "event", "hotel", "adventure_place", "adventure"];

const isReschedulable = (booking: Booking) => {
  const type   = booking.booking_type?.toLowerCase();
  const status = booking.status?.toLowerCase();
  const alreadyRescheduled = !!booking.booking_details?.rescheduled_at;
  return RESCHEDULABLE_TYPES.includes(type) && (status === "confirmed" || status === "pending") && !alreadyRescheduled;
};

const getTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

const isPaidBooking = (b: Booking) => ["paid", "completed"].includes(b.payment_status?.toLowerCase());

// ─── Status pill ──────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  confirmed: { bg: SUCCESS_SOFT, text: SUCCESS,   border: `${SUCCESS}40` },
  paid:      { bg: SUCCESS_SOFT, text: SUCCESS,   border: `${SUCCESS}40` },
  completed: { bg: SUCCESS_SOFT, text: SUCCESS,   border: `${SUCCESS}40` },
  pending:   { bg: GOLD_SOFT,    text: GOLD_TEXT, border: `${GOLD}50` },
  cancelled: { bg: DANGER_SOFT,  text: DANGER,    border: `${DANGER}40` },
  unpaid:    { bg: CANVAS,       text: INK_SOFT,  border: HAIRLINE },
};

const StatusPill = ({ status, label }: { status: string; label?: string }) => {
  const s = STATUS_STYLES[status?.toLowerCase()] ?? { bg: CANVAS, text: INK_SOFT, border: HAIRLINE };
  return (
    <span className="text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border"
      style={{ background: s.bg, color: s.text, borderColor: s.border, fontFamily: FONT_BODY }}>
      {label || status}
    </span>
  );
};

const Row = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
  <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: `1px dashed ${HAIRLINE}` }}>
    <Icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: FOREST }} />
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>{label}</p>
      <p className="text-[13px] font-semibold break-words" style={{ color: INK }}>{value || "—"}</p>
    </div>
  </div>
);

// ─── Reschedule Modal ─────────────────────────────────────────────────────────
const RescheduleModal = ({
  booking, onClose, onConfirm,
}: { booking: Booking; onClose: () => void; onConfirm: (id: string, date: string) => Promise<void> }) => {
  const [newDate, setNewDate] = useState("");
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);

  const name = getItemName(booking.booking_details);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4" style={{ background: "rgba(14,23,18,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" style={{ boxShadow: "0 24px 60px rgba(14,23,18,0.25)", fontFamily: FONT_BODY }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <div className="flex items-center gap-2.5">
            <CalendarClock className="h-4 w-4" style={{ color: FOREST }} />
            <div>
              <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Reschedule</p>
              <p className="text-sm font-semibold truncate max-w-[200px]" style={{ color: INK }}>{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors" style={{ background: CANVAS }}>
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
                  style={{ border: `1px solid ${HAIRLINE}`, color: INK }} />
              </div>
              <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 mb-4" style={{ background: GOLD_SOFT }}>
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: GOLD }} />
                <p className="text-[11px] font-medium leading-relaxed" style={{ color: GOLD_TEXT }}>You can only reschedule this booking <strong>once</strong>. This action cannot be undone.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-xs font-semibold" style={{ border: `1px solid ${HAIRLINE}`, color: INK_SOFT }}>Cancel</button>
                <button onClick={handle} disabled={!newDate || saving}
                  className="flex-1 text-white font-semibold rounded-xl py-2.5 text-xs transition-all disabled:opacity-40"
                  style={newDate && !saving ? { background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` } : { background: HAIRLINE, color: INK_SOFT }}>
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

// ─── QR panel (shown for every paid / confirmed booking) ──────────────────────
const QrPanel = ({ booking }: { booking: Booking }) => {
  const d = booking.booking_details || {};
  const email = booking.guest_email || d.guest_email || "";
  const payload = qrPayload(booking.id, booking.visit_date || d.date || d.visit_date, email);
  return (
    <div className="mt-3 rounded-xl p-3.5 flex items-center gap-3.5 bg-white" style={{ border: `1px solid ${FOREST}30` }}>
      <img src={qrImageUrl(payload, 220)} alt="Booking QR code" width={116} height={116} className="rounded-lg flex-shrink-0" style={{ border: `1px solid ${HAIRLINE}` }} />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold flex items-center gap-1" style={{ color: FOREST }}>
          <QrCode className="h-3.5 w-3.5" /> Your entry QR code
        </p>
        <p className="text-[11px] mt-1 leading-snug" style={{ color: INK_SOFT }}>
          Show this to the host at the venue. They scan it to verify and check you in.
        </p>
        <p className="text-[10px] font-mono mt-1.5 truncate" style={{ color: INK_SOFT }}>ID {booking.id.slice(0, 8)}</p>
      </div>
    </div>
  );
};

// ─── Expanded detail panel ────────────────────────────────────────────────────
const BookingDetail = ({ booking, onReschedule }: { booking: Booking; onReschedule: () => void }) => {
  const [downloading, setDownloading] = useState(false);
  const d = booking.booking_details || {};
  const { contactLabel } = getMeta(booking.booking_type, d);
  const name = getItemName(d);
  const { phone: hostPhone, email: hostEmail } = getHostContact(booking);
  const lines = getBookingLines(d);
  const sections = Array.from(new Set(lines.map((l) => l.section)));
  const SECTION_ICON: Record<string, any> = { "Entry tickets": Ticket, Tickets: Ticket, Activities: Activity, Facilities: Building2 };

  const handleDownload = async () => {
    setDownloading(true);
    try { await generateBookingPDF(booking, booking.id); }
    finally { setDownloading(false); }
  };

  return (
    <div className="px-4 py-4" style={{ borderTop: `1px solid ${HAIRLINE}`, background: `${CANVAS}80`, fontFamily: FONT_BODY }}>
      <div className="mb-3">
        <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Item</p>
        <p className="text-sm font-semibold" style={{ color: INK }}>{name}</p>
        <p className="text-[10px] font-mono mt-0.5" style={{ color: INK_SOFT }}>{booking.id}</p>
      </div>

      {isPaidBooking(booking) && <QrPanel booking={booking} />}

      <div className="mt-2">
        {(booking.guest_name  || d.guest_name)  && <Row icon={Users}  label="Guest" value={booking.guest_name  || d.guest_name}  />}
        {(booking.guest_email || d.guest_email) && <Row icon={Mail}   label="Email" value={booking.guest_email || d.guest_email} />}
        {(booking.guest_phone || d.guest_phone) && <Row icon={Phone}  label="Phone" value={booking.guest_phone || d.guest_phone} />}

        {booking.visit_date && <Row icon={Calendar}      label="Visit Date"     value={fmt(booking.visit_date)} />}
        {d.date             && <Row icon={Calendar}      label="Event Date"     value={fmt(d.date)} />}
        {d.rescheduled_at   && <Row icon={CalendarClock} label="Rescheduled On" value={fmt(d.rescheduled_at)} />}

        {(d.adults   || d.num_adults)   && <Row icon={Users}  label="Adults"   value={d.adults   || d.num_adults}   />}
        {(d.children || d.num_children) && <Row icon={Users}  label="Children" value={d.children || d.num_children} />}
        {booking.slots_booked           && <Row icon={Ticket} label="Slots"    value={booking.slots_booked}          />}
        {(d.location || d.locationName) && <Row icon={MapPin} label="Location" value={d.location || d.locationName} />}
      </div>

      {sections.map((s) => {
        const Icon = SECTION_ICON[s] || Ticket;
        return (
          <div key={s} className="py-2.5" style={{ borderBottom: `1px dashed ${HAIRLINE}` }}>
            <p className="text-[10px] font-medium mb-1.5 flex items-center gap-1.5" style={{ color: INK_SOFT }}>
              <Icon className="h-3 w-3" /> {s}
            </p>
            <div className="space-y-1.5 ml-4">
              {lines.filter((l) => l.section === s).map((l, i) => (
                <div key={i} className="text-[13px]">
                  <div className="flex justify-between">
                    <span className="font-semibold" style={{ color: INK }}>{l.label}</span>
                    <span className="font-semibold" style={{ color: INK }}>{fmtMoney(l.amount)}</span>
                  </div>
                  {l.sub && <p className="text-[11px]" style={{ color: INK_SOFT }}>{l.sub}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex justify-between items-center pt-3 text-[13px] font-semibold" style={{ color: INK }}>
        <span>Total paid</span><span style={{ color: CLAY }}>{fmtMoney(booking.total_amount)}</span>
      </div>

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
              <a href={`tel:${hostPhone}`} className="flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-3 py-1.5"
                style={{ color: FOREST, background: FOREST_SOFT, border: `1px solid ${FOREST}25` }}>
                <Phone className="h-3 w-3" />{hostPhone}
              </a>
            )}
            {hostEmail && (
              <a href={`mailto:${hostEmail}`} className="flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-3 py-1.5"
                style={{ color: FOREST, background: FOREST_SOFT, border: `1px solid ${FOREST}25` }}>
                <Mail className="h-3 w-3" />{hostEmail}
              </a>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <button onClick={handleDownload} disabled={downloading}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all disabled:opacity-50"
          style={{ border: `1px solid ${HAIRLINE}`, color: INK_SOFT }}>
          <Download className="h-3.5 w-3.5" />
          {downloading ? "Generating…" : "Download PDF"}
        </button>

        {isReschedulable(booking) ? (
          <button onClick={onReschedule}
            className="flex-1 flex items-center justify-center gap-1.5 text-white rounded-xl py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
            style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}>
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
  const { typeLabel } = getMeta(booking.booking_type, d);
  const name = getItemName(d);
  const displayDate = booking.visit_date || d.date;
  const isCustomCompleted = !!d.inquiry_id && isPaidBooking(booking);

  return (
    <div className="bg-white rounded-xl overflow-hidden transition-all" style={{ border: `1px solid ${open ? FOREST + "40" : HAIRLINE}`, fontFamily: FONT_BODY }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-[10px] font-semibold" style={{ color: FOREST }}>{typeLabel}</span>
            {isCustomCompleted
              ? <StatusPill status="completed" label="Completed" />
              : <StatusPill status={booking.status} />}
            {d.inquiry_id && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border" style={{ background: INFO_SOFT, color: INFO, borderColor: `${INFO}30` }}>Custom</span>
            )}
            {d.rescheduled_at && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border" style={{ background: INFO_SOFT, color: INFO, borderColor: `${INFO}30` }}>Rescheduled</span>
            )}
          </div>
          <p className="font-semibold text-[14px] truncate" style={{ color: INK }}>{name}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] font-medium" style={{ color: INK_SOFT }}>
            {displayDate && <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{fmt(displayDate)}</span>}
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

// ─── Accepted by host, waiting for the guest to pay ──────────────────────────
const PendingPaymentCard = ({ row, onPay }: { row: any; onPay: () => void }) => {
  const lines = inquiryLines(row);
  const visit = row.visit_date || row.booking_details?.visit_date;
  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: `1px solid ${GOLD}50`, fontFamily: FONT_BODY }}>
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: GOLD_SOFT, color: GOLD_TEXT, border: `1px solid ${GOLD}50` }}>
            <Clock className="h-3 w-3" /> Accepted · Waiting for payment
          </span>
        </div>
        <p className="font-semibold text-[14px] truncate" style={{ color: INK }}>{row.item_name || getItemName(row.booking_details)}</p>
        {visit && <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: INK_SOFT }}><Calendar className="h-2.5 w-2.5" />{fmt(visit)}</p>}
        <div className="mt-2">
          {lines.slice(0, 3).map((l, i) => (
            <div key={i} className="flex justify-between text-[11px]" style={{ color: INK_SOFT }}>
              <span className="truncate pr-2">{l.label}</span><span>{fmtMoney(l.amount)}</span>
            </div>
          ))}
          {lines.length > 3 && <p className="text-[10px]" style={{ color: INK_SOFT }}>+ {lines.length - 3} more</p>}
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-[15px] font-semibold" style={{ color: CLAY }}>{fmtMoney(inquiryAmount(row))}</span>
          <button onClick={onPay} className="flex items-center gap-1.5 text-white font-semibold rounded-xl px-4 py-2 text-xs"
            style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}>
            <CreditCard className="h-3.5 w-3.5" /> Pay now
          </button>
        </div>
      </div>
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
  const [pending, setPending]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [filter, setFilter]             = useState<"all" | "upcoming" | "past">("all");

  useEffect(() => {
    if (authLoading) return;
    if (user) fetchBookings();
    else loadLocalBookings();
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

      // Accepted by the host but not paid yet → "Pending payment · Pay now"
      const { data: inq } = await (supabase as any)
        .from("availability_inquiries").select("*")
        .eq("guest_id", user?.id).eq("status", "accepted").neq("payment_status", "paid")
        .order("created_at", { ascending: false });
      setPending((inq || []).filter((r: any) => inquiryAmount(r) > 0));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadLocalBookings = () => {
    setLoading(true);
    try { setBookings(getLocalBookings() as unknown as Booking[]); }
    catch (e) { console.error(e); }
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
  const dateOf = (b: Booking) => b.visit_date || b.booking_details?.date;
  const filtered = bookings.filter((b) => {
    if (filter === "all") return true;
    const d = dateOf(b);
    if (!d) return filter === "past";
    return filter === "upcoming" ? new Date(d) >= now : new Date(d) < now;
  });

  const counts = {
    all: bookings.length,
    upcoming: bookings.filter((b) => { const d = dateOf(b); return d && new Date(d) >= now; }).length,
    past:     bookings.filter((b) => { const d = dateOf(b); return !d || new Date(d) < now; }).length,
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
            <div className="flex items-center gap-2.5">
              <Button onClick={() => openAuthModal("login")} variant="outline" className="rounded-xl text-sm font-semibold gap-2 px-6 py-3" style={{ borderColor: HAIRLINE, color: INK }}>
                <LogIn className="h-4 w-4" /> Log in
              </Button>
              <Button onClick={() => openAuthModal("signup")} className="rounded-xl text-sm font-semibold gap-2 px-6 py-3 text-white border-none hover:opacity-95"
                style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}>
                <UserPlus className="h-4 w-4" /> Sign up
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
              <Button onClick={() => openAuthModal("login")} size="sm" variant="outline" className="rounded-xl text-xs font-semibold" style={{ borderColor: `${FOREST}30`, color: FOREST }}>Log in</Button>
              <Button onClick={() => openAuthModal("signup")} size="sm" className="rounded-xl text-xs font-semibold gap-1.5 text-white border-none hover:opacity-95"
                style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}>
                <LogIn className="h-3.5 w-3.5" /> Sign up
              </Button>
            </div>
          </div>
        )}

        {/* Accepted by host → waiting for payment */}
        {pending.length > 0 && (
          <section className="mb-6">
            <p className="text-[11px] font-semibold mb-2" style={{ color: GOLD_TEXT }}>Pending payment ({pending.length})</p>
            <div className="space-y-2.5">
              {pending.map((row) => (
                <PendingPaymentCard key={row.id} row={row} onPay={() => navigate(inquiryPayPath(row))} />
              ))}
            </div>
          </section>
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
          pending.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: FOREST_SOFT }}>🗺️</div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: FONT_DISPLAY, color: INK }}>No bookings yet</h2>
              <p className="text-[13px] max-w-xs" style={{ color: INK_SOFT }}>Your trips, events, and reservations will appear here once you book something.</p>
              <button onClick={() => navigate("/")} className="mt-1 text-white font-semibold rounded-xl px-5 py-2.5 text-[13px] hover:opacity-90 transition-opacity"
                style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}>
                Explore now
              </button>
            </div>
          )
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
        <RescheduleModal booking={rescheduling} onClose={() => setRescheduling(null)} onConfirm={handleReschedule} />
      )}
    </div>
  );
};

export default Bookings;
