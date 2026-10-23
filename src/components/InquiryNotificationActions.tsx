import { useCallback, useEffect, useState } from "react";
import { Phone, Mail, Check, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const SUCCESS = "#2F6F4E", DANGER = "#9C3B2B", INK = "#1C2B22", INK_SOFT = "#5B6B60", HAIRLINE = "#DCE3DC", CANVAS = "#F4F6F2";
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

export const InquiryNotificationActions = ({ notification, userId }: { notification: any; userId: string }) => {
  const inquiryId = notification?.data?.inquiry_id;
  const [row, setRow] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    if (!inquiryId) return;
    const { data } = await (supabase as any).from("availability_inquiries").select("*").eq("id", inquiryId).maybeSingle();
    setRow(data);
  }, [inquiryId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  if (!row) return null;

  const isHost = row.host_id === userId;
  const left = row.status === "pending" ? remaining(row.expires_at) : null;
  const status = row.status === "pending" && !left ? "expired" : row.status;

  const respond = async (accept: boolean) => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("respond_to_inquiry", { p_id: row.id, p_accept: accept });
    setBusy(false);
    if (error) { toast({ title: "Couldn't respond", description: error.message, variant: "destructive" }); return; }
    if (data === "expired") toast({ title: "Too late", description: "The 12-hour window has passed.", variant: "destructive" });
    else toast({ title: data === "accepted" ? "Request accepted" : "Request declined" });
    load();
  };

  return (
    <div className="px-3.5 pb-3.5 -mt-1" style={{ fontFamily: FONT_BODY }} onClick={stop}>
      {status === "pending" && isHost && (
        <>
          <p className="text-[10px] font-medium flex items-center gap-1 mb-2" style={{ color: row.is_urgent ? DANGER : INK_SOFT }}>
            <Clock className="h-3 w-3" /> {row.is_urgent ? "Urgent · " : ""}{left}
          </p>
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

      {status === "accepted" && (
        <>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: SUCCESS }}>
            <Check className="h-3 w-3" /> Accepted
          </span>
          {isHost
            ? <ContactRow phone={row.guest_phone} email={row.guest_email} />
            : <ContactRow phone={row.host_phone} email={row.host_email} />}
        </>
      )}

      {status === "declined" && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: DANGER }}>
          <X className="h-3 w-3" /> Declined
        </span>
      )}

      {status === "expired" && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: CANVAS, color: INK_SOFT, border: `1px solid ${HAIRLINE}` }}>
          <Clock className="h-3 w-3" /> Expired (no reply in 12h)
        </span>
      )}
    </div>
  );
};