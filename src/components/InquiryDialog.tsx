import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X, Zap, Send, AlertCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";

const FOREST = "#1F4D3A", FOREST_SOFT = "#EAF0EA";
const CLAY = "#C1552F", CLAY_LIGHT = "#E0824F", GOLD_SOFT = "#FBF2DD";
const INK = "#1C2B22", INK_SOFT = "#5B6B60", HAIRLINE = "#DCE3DC", CANVAS = "#F4F6F2";
const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

export type InquiryItemType = "adventure_place" | "trip";
type TypeId = "availability" | "closed_hours" | "special_package" | "special_pricing";
type KindId = "entrance" | "facility" | "activity" | "amenity" | "ticket" | "other";

const DAY_ABBREV = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const normDay = (d: string) => String(d ?? "").replace(/[^a-zA-Z]/g, "").slice(0, 3).toLowerCase();
const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const toDateInput = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fieldStyle: React.CSSProperties = {
  width: "100%", height: 42, borderRadius: 12, border: `1px solid ${HAIRLINE}`,
  background: "#fff", padding: "0 12px", fontSize: 14, color: INK, fontFamily: FONT_BODY, outline: "none",
};
const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-semibold mb-1.5" style={{ color: INK_SOFT }}>{children}</p>
);
const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button" onClick={onClick}
    className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
    style={{
      background: active ? FOREST : FOREST_SOFT, color: active ? "#fff" : FOREST,
      border: `1px solid ${active ? FOREST : `${FOREST}25`}`,
    }}
  >{children}</button>
);

interface Props {
  item: any;                       // the adventure_places row or trips row
  itemType: InquiryItemType;
  open: boolean;
  onClose: () => void;
}

export const InquiryDialog = ({ item, itemType, open, onClose }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const isTrip = itemType === "trip";

  const TYPES: { id: TypeId; label: string }[] = [
    { id: "availability", label: "Check availability" },
    { id: "closed_hours", label: isTrip ? "Different date / time" : "Closed day / hours" },
    { id: "special_package", label: "Special package" },
    { id: "special_pricing", label: "Special price offer" },
  ];
  const KINDS: { id: KindId; label: string }[] = isTrip
    ? [{ id: "ticket", label: "Ticket" }, { id: "activity", label: "Activity" }, { id: "other", label: "Whole trip" }]
    : [{ id: "entrance", label: "Entrance fee" }, { id: "facility", label: "Facility" }, { id: "activity", label: "Activity" }, { id: "amenity", label: "Amenity" }, { id: "other", label: "Whole place" }];

  const [type, setType] = useState<TypeId>("availability");
  const [kind, setKind] = useState<KindId>(isTrip ? "ticket" : "entrance");
  const [itemName, setItemName] = useState("");
  const [offered, setOffered] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState(1);
  const [urgent, setUrgent] = useState(false);
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  // Trips with a fixed date: start on that date
  useEffect(() => {
    if (!open) return;
    if (isTrip && !item.is_custom_date && item.date) setDate((d) => d || toDateInput(item.date));
  }, [open, isTrip, item?.date, item?.is_custom_date]);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("name, phone_number").eq("id", user.id).maybeSingle();
      if (data?.name) setName((p) => p || data.name);
      if (data?.phone_number) setPhone((p) => p || data.phone_number);
    })();
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const items = useMemo(() => {
    const out: Record<KindId, { name: string; price: number }[]> = {
      entrance: [{ name: "Entrance fee", price: Number(item.entry_fee) || 0 }],
      facility: (Array.isArray(item.facilities) ? item.facilities : []).map((f: any) => ({ name: f.name, price: Number(f.price) || 0 })),
      activity: (Array.isArray(item.activities) ? item.activities : []).map((a: any) => ({ name: a.name, price: Number(a.price) || 0 })),
      amenity:  (Array.isArray(item.amenities) ? item.amenities : []).map((a: any) => ({ name: pretty(typeof a === "string" ? a : a?.name || ""), price: 0 })).filter((a: any) => a.name),
      ticket: [
        { name: "Adult ticket", price: Number(item.price) || 0 },
        ...(item.allow_children !== false && item.price_child != null ? [{ name: "Child ticket", price: Number(item.price_child) || 0 }] : []),
        ...(Array.isArray(item.ticket_types) ? item.ticket_types.map((t: any) => ({ name: t.name, price: Number(t.price) || 0 })) : []),
      ],
      other: [],
    };
    return out;
  }, [item]);

  useEffect(() => { setItemName(items[kind]?.[0]?.name ?? ""); }, [kind, items]);

  const selected = items[kind]?.find((i) => i.name === itemName);

  // Warning when the chosen date doesn't match how the listing operates
  const dateWarning = (() => {
    if (!date) return null;
    if (isTrip) {
      if (item.is_custom_date) return null;
      const fixed = toDateInput(item.date);
      if (fixed && date !== fixed) return `This trip is scheduled for ${new Date(item.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}.`;
      return null;
    }
    const days: string[] = Array.isArray(item.days_opened) ? item.days_opened.map(normDay).filter(Boolean) : [];
    if (!days.length || new Set(days).size >= 7) return null;
    const d = new Date(`${date}T00:00:00`);
    return days.includes(DAY_ABBREV[d.getDay()]) ? null : "This place is normally closed that day.";
  })();

  if (!open) return null;
  const isOwner = !!user?.id && user.id === item.created_by;

  const submit = async () => {
    if (!user) { onClose(); navigate("/auth"); return; }
    if (!date) return toast({ title: "Pick a date", variant: "destructive" });
    if (date < todayStr()) return toast({ title: "Date can't be in the past", variant: "destructive" });
    if (!name.trim()) return toast({ title: "Enter your name", variant: "destructive" });
    if (phone.replace(/\D/g, "").length < 7) return toast({ title: "Enter a valid phone number", variant: "destructive" });
    if (type === "special_pricing" && !(Number(offered) > 0))
      return toast({ title: "Enter the price you want to offer", variant: "destructive" });
    if (type === "closed_hours" && !time)
      return toast({ title: "Pick the time you need", variant: "destructive" });

    setBusy(true);
    const { error } = await (supabase as any).from("availability_inquiries").insert({
      place_id: item.id,
      item_type: itemType,
      guest_id: user.id,
      guest_name: name.trim(),
      guest_email: user.email ?? null,
      guest_phone: phone.trim(),
      inquiry_type: type,
      item_kind: kind,
      item_name: kind === "other" ? null : itemName || null,
      current_price: selected?.price || null,
      offered_price: type === "special_pricing" ? Number(offered) : null,
      visit_date: date,
      visit_time: time || null,
      guests,
      is_urgent: urgent,
      note: note.trim() || null,
      host_id: item.created_by, // overwritten by the DB trigger
    });
    setBusy(false);

    if (error) {
      toast({ title: "Couldn't send request", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Request sent", description: "The host has 12 hours to accept or decline. You'll be notified." });
    onClose();
  };

  const modal = (
    <div className="fixed inset-0 flex items-end md:items-center justify-center" style={{ zIndex: 2147483000, background: "rgba(14,23,18,0.65)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-lg bg-white md:rounded-3xl rounded-t-3xl flex flex-col"
        style={{ maxHeight: "92vh", fontFamily: FONT_BODY, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-start justify-between px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <div>
            <h2 className="text-xl font-semibold leading-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Ask the host</h2>
            <p className="text-[12px] mt-0.5 flex items-center gap-1" style={{ color: INK_SOFT }}>
              <Clock className="h-3 w-3" /> The host has 12 hours to accept or decline
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: CANVAS }}>
            <X className="h-4 w-4" style={{ color: INK }} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {isOwner && (
            <div className="rounded-xl p-3 text-[12px] flex gap-2" style={{ background: GOLD_SOFT, color: "#8A6716" }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> This is your own listing, so you can't send a request to yourself.
            </div>
          )}

          <div>
            <Label>What do you need?</Label>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((t) => <Chip key={t.id} active={type === t.id} onClick={() => setType(t.id)}>{t.label}</Chip>)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <input type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <Label>Time {type === "closed_hours" ? "" : "(optional)"}</Label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={fieldStyle} />
            </div>
          </div>

          {dateWarning && (
            <div className="rounded-xl p-3 text-[12px] flex items-start gap-2" style={{ background: GOLD_SOFT, color: "#8A6716" }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                {dateWarning}{" "}
                {type !== "closed_hours" && (
                  <button type="button" className="underline font-semibold" onClick={() => setType("closed_hours")}>
                    {isTrip ? "Ask for a different date" : "Ask for a special opening"}
                  </button>
                )}
              </span>
            </div>
          )}

          <div>
            <Label>Number of guests</Label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))} className="h-9 w-9 rounded-full text-lg font-semibold" style={{ background: FOREST_SOFT, color: FOREST }}>−</button>
              <span className="w-8 text-center font-semibold" style={{ color: INK }}>{guests}</span>
              <button type="button" onClick={() => setGuests((g) => Math.min(500, g + 1))} className="h-9 w-9 rounded-full text-lg font-semibold" style={{ background: FOREST_SOFT, color: FOREST }}>+</button>
            </div>
          </div>

          <div>
            <Label>What is this for?</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {KINDS.map((k) => <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</Chip>)}
            </div>
            {kind !== "other" && items[kind].length > 0 && (
              <select value={itemName} onChange={(e) => setItemName(e.target.value)} style={fieldStyle}>
                {items[kind].map((i) => (
                  <option key={i.name} value={i.name}>{i.name}{i.price > 0 ? ` — ${formatPrice(i.price)}` : ""}</option>
                ))}
              </select>
            )}
            {kind !== "other" && items[kind].length === 0 && (
              <p className="text-[12px]" style={{ color: INK_SOFT }}>
                Nothing listed here. Choose "{isTrip ? "Whole trip" : "Whole place"}".
              </p>
            )}
          </div>

          {type === "special_pricing" && (
            <div>
              <Label>Your offered price{selected && selected.price > 0 ? ` (listed: ${formatPrice(selected.price)})` : ""}</Label>
              <input type="number" inputMode="decimal" min={0} value={offered} onChange={(e) => setOffered(e.target.value)} placeholder="e.g. 1500" style={fieldStyle} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Your name</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <Label>Phone</Label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254…" style={fieldStyle} />
            </div>
          </div>

          <button
            type="button" onClick={() => setUrgent((u) => !u)}
            className="w-full flex items-center gap-3 rounded-2xl p-3 text-left transition-all"
            style={{ background: urgent ? "#FBEDE6" : CANVAS, border: `1px solid ${urgent ? CLAY : HAIRLINE}` }}
          >
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: urgent ? CLAY : "#fff" }}>
              <Zap className="h-4 w-4" style={{ color: urgent ? "#fff" : INK_SOFT }} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ color: INK }}>Mark as urgent</p>
              <p className="text-[11px]" style={{ color: INK_SOFT }}>The host sees it flagged in their notification</p>
            </div>
            <span className="h-5 w-9 rounded-full relative transition-all" style={{ background: urgent ? CLAY : HAIRLINE }}>
              <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: urgent ? 18 : 2 }} />
            </span>
          </button>

          <div>
            <Label>Short note to host (optional, one-way)</Label>
            <input maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Birthday group of 8" style={fieldStyle} />
          </div>

          <p className="text-[11px] leading-snug" style={{ color: INK_SOFT }}>
            There is no chat. If the host accepts, you'll get a notification with their phone number and email so you can call or email them directly.
          </p>
        </div>

        <div className="px-5 py-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <button
            onClick={submit}
            disabled={busy || isOwner}
            className="w-full py-3.5 rounded-2xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)` }}
          >
            <Send className="h-4 w-4" /> {busy ? "Sending…" : user ? "Send request" : "Sign in to send"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};