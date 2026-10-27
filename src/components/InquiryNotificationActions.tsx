import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Mail, Check, X, Clock, CreditCard, QrCode, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { sendInquiryEmail, inquiryPayPath, inquiryAmount, inquiryLines } from "@/lib/bookingEmail";
import { fmtMoney } from "@/lib/bookingPdf";

const SUCCESS = "#2F6F4E", SUCCESS_SOFT = "#EAF3EC", DANGER = "#9C3B2B", INK = "#1C2B22", INK_SOFT = "#5B6B60";
const HAIRLINE = "#DCE3DC", CANVAS = "#F4F6F2", CLAY = "#C1552F", GOLD = "#B98A2A", GOLD_SOFT = "#FBF2DD", GOLD_TEXT = "#8A6716";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

const remaining = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3.6e6);
  const m = Math.floor((ms % 3.6e6) / 6e4);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
};

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

const ContactRow = ({ phone, email }: { phone?: string | null; email?: string | null }) => (
  <div className="flex flex-col gap-1.5 mt-2">
    {phone && (
      <a href={`tel:${phone}`} onClick={stop} className="flex items-center justify-between rounded-xl px-3 py-2 text-[12px] font-semibold text-white" style={{ background: SUCCESS }}>
        <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Call</span>
        <span>{phone}</span>
      </a>
    )}
    {email && (
      <a href={`mailto:${email}`} onClick={stop} className="flex items-center justify-between rounded-xl px-3 py-2 text-[12px] font-semibold" style={{ background: "#fff", color: SUCCESS, border: `1px solid ${SUCCESS}` }}>
        <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</span>
        <span className="truncate ml-2">{email}</span>
      </a>
    )}
  </div>
);

const Pill = ({ bg, color, border, children }: { bg: string; color: string; border?: string; children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: bg, color, border: border ? `1px solid ${border}` : undefined }}>
    {children}
  </span>
);

const Summary = ({ row }: { row: any }) => {
  const lines = inquiryLines(row);
  return (
    <div className="mt-2 rounded-xl px-3 py-2" style={{ background: CANVAS }}>
      {row.item_name && <p className="text-[12px] font-semibold truncate" style={{ color: INK }}>{row.item_name}</p>}
      {lines.slice(0, 4).map((l, i) => (
        <div key={i} className="flex justify-between text-[11px]" style={{ color: INK_SOFT }}>
          <span className="truncate pr-2">{l.label}</span><span>{fmtMoney(l.amount)}</span>
        </div>
      ))}
      {lines.length > 4 && <p className="text-[10px]" style={{ color: INK_SOFT }}>+ {lines.length - 4} more</p>}
      <div className="flex justify-between text-[12px] font-semibold mt-1 pt-1" style={{ color: INK, borderTop: `1px dashed ${HAIRLINE}` }}>
        <span>Total</span><span>{fmtMoney(inquiryAmount(row))}</span>
      </div>
    </div>
  );
};

export const InquiryNotificationActions = ({ notification, userId }: { notification: any; userId: string }) => {
  const navigate = useNavigate();
  const inquiryId = notification?.data?.inquiry_id;
  const [row, setRow] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState("");
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    if (!inquiryId) return;
    const { data } = await (supabase as any).from("availability_inquiries").select("*").eq("id", inquiryId).maybeSingle();
    setRow(data);
  }, [inquiryId]);

  useEffect(() => { load(); }, [load]);
  // Re-render the countdown AND re-read the row, so "Pay now" flips to "Completed" after payment.
  useEffect(() => { const t = setInterval(() => { tick((n) => n + 1); load(); }, 30000); return () => clearInterval(t); }, [load]);

  if (!row) return null;

  const isHost = row.host_id === userId;
  const left = row.status === "pending" ? remaining(row.expires_at) : null;
  const status = row.status === "pending" && !left ? "expired" : row.status;
  const isPaid = row.payment_status === "paid";
  const amount = inquiryAmount(row);

  const respond = async (accept: boolean) => {
    setBusy(true);
    // Host may adjust the price before accepting; the guest then pays this updated amount.
    const adjusted = Number(price);
    if (accept && isHost && price !== "" && adjusted > 0 && adjusted !== amount) {
      const { error: pErr } = await (supabase as any).rpc("set_inquiry_price", { p_id: row.id, p_amount: adjusted });
      if (pErr) { setBusy(false); toast({ title: "Couldn't update price", description: pErr.message, variant: "destructive" }); return; }
    }
    const { data, error } = await (supabase as any).rpc("respond_to_inquiry", { p_id: row.id, p_accept: accept });
    setBusy(false);
    if (error) { toast({ title: "Couldn't respond", description: error.message, variant: "destructive" }); return; }
    if (data === "expired") toast({ title: "Too late", description: "The 12-hour window has passed.", variant: "destructive" });
    else {
      toast({ title: data === "accepted" ? "Request accepted" : "Request declined" });
      // Email the guest: "Accepted – pending payment" with a Pay now link.
      if (data === "accepted" && (adjusted > 0 ? adjusted : amount) > 0) sendInquiryEmail(row.id, "pending_payment");
    }
    load();
  };

  const goPay = (e: React.SyntheticEvent) => { stop(e); navigate(inquiryPayPath(row)); };
  const goBookings = (e: React.SyntheticEvent) => { stop(e); navigate("/bookings"); };

  return (
    <div className="px-3.5 pb-3.5 -mt-1" style={{ fontFamily: FONT_BODY }} onClick={stop}>
      {status === "pending" && isHost && (
        <>
          <p className="text-[10px] font-medium flex items-center gap-1 mb-2" style={{ color: row.is_urgent ? DANGER : INK_SOFT }}>
            <Clock className="h-3 w-3" /> {row.is_urgent ? "Urgent · " : ""}{left}
          </p>
          <Summary row={row} />
          <label className="block text-[10px] font-medium mt-2 mb-1" style={{ color: INK_SOFT }}>
            Final price (KES) — leave as is or adjust before accepting
          </label>
          <input
            type="number" inputMode="numeric" min={1} value={price} placeholder={String(amount)}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-[13px] font-semibold bg-white outline-none mb-2"
            style={{ border: `1px solid ${HAIRLINE}`, color: INK }}
          />
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={() => respond(true)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-[12px] font-semibold disabled:opacity-60" style={{ background: SUCCESS }}>
              <Check className="h-3.5 w-3.5" /> Accept
            </button>
            <button disabled={busy} onClick={() => respond(false)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-[12px] font-semibold disabled:opacity-60" style={{ background: DANGER }}>
              <X className="h-3.5 w-3.5" /> Decline
            </button>
          </div>
        </>
      )}

      {status === "pending" && !isHost && (
        <p className="text-[11px] font-medium flex items-center gap-1" style={{ color: INK_SOFT }}>
          <Clock className="h-3 w-3" /> Waiting for the host · {left}
        </p>
      )}

      {/* ACCEPTED, NOT PAID YET */}
      {status === "accepted" && !isPaid && (
        <>
          <Pill bg={GOLD_SOFT} color={GOLD_TEXT} border={`${GOLD}50`}>
            <Clock className="h-3 w-3" /> {amount <= 0 ? "Accepted" : isHost ? "Accepted · Waiting for guest payment" : "Accepted · Waiting for payment"}
          </Pill>
          {amount > 0 && <Summary row={row} />}
          {!isHost && amount > 0 && (
            <button onClick={goPay} className="mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-[12px] font-semibold"
              style={{ background: `linear-gradient(135deg, #E0824F, ${CLAY})` }}>
              <CreditCard className="h-3.5 w-3.5" /> Pending payment · Pay now {fmtMoney(amount)}
            </button>
          )}
          {isHost
            ? <ContactRow phone={row.guest_phone} email={row.guest_email} />
            : <ContactRow phone={row.host_phone} email={row.host_email} />}
        </>
      )}

      {/* ACCEPTED AND PAID → COMPLETED */}
      {status === "accepted" && isPaid && (
        <>
          <Pill bg={SUCCESS_SOFT} color={SUCCESS} border={`${SUCCESS}40`}>
            <CheckCircle2 className="h-3 w-3" /> Completed · Paid {fmtMoney(amount)}
          </Pill>
          <Summary row={row} />
          <button onClick={goBookings} className="mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-[12px] font-semibold" style={{ background: SUCCESS }}>
            <QrCode className="h-3.5 w-3.5" /> {isHost ? "View in bookings" : "View booking & QR code"}
          </button>
          {isHost
            ? <ContactRow phone={row.guest_phone} email={row.guest_email} />
            : <ContactRow phone={row.host_phone} email={row.host_email} />}
        </>
      )}

      {status === "declined" && (
        <Pill bg={DANGER} color="#fff"><X className="h-3 w-3" /> Declined</Pill>
      )}

      {status === "expired" && (
        <Pill bg={CANVAS} color={INK_SOFT} border={HAIRLINE}><Clock className="h-3 w-3" /> Expired (no reply in 12h)</Pill>
      )}
    </div>
  );
};
