import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { format, isToday, isYesterday } from "date-fns";
import {
  ArrowLeft, Search, Send, ShieldAlert, ShieldCheck, MessageSquare, Check, CheckCheck,
  Inbox, Lock, LogIn, UserPlus, Tag, Clock, CreditCard, Loader2, Plus, Calendar, AlertTriangle,
} from "lucide-react";
import { getItemName, fmtMoney, fmtDate } from "@/lib/bookingPdf";
import { inquiryAmount, inquiryPayPath } from "@/lib/bookingEmail";
import { cn } from "@/lib/utils";

// ── Design tokens (same palette as Bookings) ──────────────────────────────
const FOREST       = "#1F4D3A";
const FOREST_DEEP  = "#123322";
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

// ── Types ─────────────────────────────────────────────────────────────────
interface Conversation {
  id: string;
  booking_id: string;
  guest_id: string;
  host_id: string;
  item_id: string | null;
  item_type: string | null;
  item_name: string | null;
  last_message: string | null;
  last_message_at: string;
  created_at: string;
}

interface Msg {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

type ChatFilter = "all" | "unread" | "hosts" | "guests";

const MAX_LEN = 2000;

// ── Helpers ───────────────────────────────────────────────────────────────
const isChatEligible = (b: any) => {
  const s = b.status?.toLowerCase();
  const p = b.payment_status?.toLowerCase();
  return s !== "cancelled" && (["paid", "completed"].includes(p) || s === "confirmed");
};

// Detects things people shouldn't hand over in chat (kept on-platform for safety)
const SENSITIVE: Array<{ re: RegExp; label: string }> = [
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/i, label: "an email address" },
  { re: /(?:\+?\d[\s().-]?){9,}/, label: "a phone number" },
  { re: /(https?:\/\/|www\.)\S+/i, label: "a link" },
  {
    re: /\b(whats\s?app|telegram|m-?pesa|paybill|till number|bank account|account number|send (me )?money|pay (me )?directly|card number|cvv|pin)\b/i,
    label: "payment or off-platform contact details",
  },
];
const detectSensitive = (text: string) => SENSITIVE.filter((s) => s.re.test(text)).map((s) => s.label);

const listTime = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
};

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d");
};

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const Avatar = ({ name, role, size = 40 }: { name: string; role: "host" | "guest"; size?: number }) => (
  <div
    className="rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-white"
    style={{
      width: size, height: size, fontSize: size * 0.38,
      background: role === "host" ? `linear-gradient(135deg, ${FOREST}, ${FOREST_DEEP})` : `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})`,
    }}
  >
    {initials(name)}
  </div>
);

const RolePill = ({ role }: { role: "host" | "guest" }) => (
  <span
    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border"
    style={
      role === "host"
        ? { background: FOREST_SOFT, color: FOREST, borderColor: `${FOREST}30` }
        : { background: CLAY_SOFT_BG, color: CLAY, borderColor: `${CLAY}30` }
    }
  >
    {role === "host" ? "Host" : "Guest"}
  </span>
);
const CLAY_SOFT_BG = "#FBEDE6";

// ── Safety notice ─────────────────────────────────────────────────────────
const SafetyBanner = () => (
  <div
    className="flex items-start gap-2.5 px-4 py-2.5 flex-shrink-0"
    style={{ background: GOLD_SOFT, borderBottom: `1px solid ${GOLD}30` }}
  >
    <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: GOLD }} />
    <p className="text-[11px] leading-snug" style={{ color: GOLD_TEXT }}>
      <strong>Keep it safe.</strong> Don't share phone numbers, emails, ID or payment details in chat, and never
      pay outside RealTravo. Payments made off the platform aren't protected.
    </p>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────
const Messages = () => {
  useInjectFonts();

  const { user, loading: authLoading } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const db = supabase as any;

  const [tab, setTab] = useState<"chats" | "offers">("chats");
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [bookings, setBookings] = useState<any[]>([]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [filter, setFilter] = useState<ChatFilter>("all");
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [offers, setOffers] = useState<any[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);

  const activeRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoStarted = useRef(false);

  useEffect(() => { activeRef.current = activeId; }, [activeId]);

  // ── Load conversations, unread counts, names, bookings ──────────────────
  const loadAll = useCallback(async () => {
    if (!user) return;
    const [convRes, unreadRes, bookRes] = await Promise.all([
      db.from("booking_conversations").select("*").order("last_message_at", { ascending: false }),
      db.from("booking_messages").select("conversation_id").is("read_at", null).neq("sender_id", user.id),
      db.from("bookings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    if (convRes.error) {
      setSetupError(
        /relation|does not exist|schema cache/i.test(convRes.error.message)
          ? "Messaging isn't set up yet. Run booking_messages.sql in your Supabase SQL editor."
          : convRes.error.message
      );
      setLoading(false);
      return;
    }
    setSetupError(null);

    const convs: Conversation[] = convRes.data || [];
    setConversations(convs);

    const counts: Record<string, number> = {};
    (unreadRes.data || []).forEach((r: any) => { counts[r.conversation_id] = (counts[r.conversation_id] || 0) + 1; });
    setUnread(counts);

    setBookings(bookRes.data || []);

    // Names of the people we talk to (falls back to "Host" / "Guest" if profiles are private)
    const otherIds = Array.from(new Set(convs.map((c) => (c.guest_id === user.id ? c.host_id : c.guest_id))));
    if (otherIds.length) {
      const { data: profs } = await db.from("profiles").select("*").in("id", otherIds);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => {
        const n = p.full_name || p.name || p.display_name || p.username;
        if (n) map[p.id] = n;
      });
      setNames(map);
    }
    setLoading(false);
  }, [user, db]);

  useEffect(() => {
    if (authLoading) return;
    if (user) loadAll();
    else setLoading(false);
  }, [user, authLoading, loadAll]);

  // ── Open a conversation ──────────────────────────────────────────────────
  const openConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setMessages([]);
    setDraft("");
    setConfirming(false);
    setMessagesLoading(true);
    const { data, error } = await db
      .from("booking_messages").select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(300);
    if (activeRef.current !== id) return;
    setMessagesLoading(false);
    if (error) {
      toast({ title: "Couldn't load messages", description: error.message, variant: "destructive" });
      return;
    }
    setMessages(data || []);
    setUnread((u) => ({ ...u, [id]: 0 }));
    await db.rpc("mark_conversation_read", { p_conversation_id: id });
  }, [db]);

  // ── Start a chat from a booking ──────────────────────────────────────────
  const startChat = useCallback(async (booking: any) => {
    setStarting(booking.id);
    try {
      const { data, error } = await db.rpc("start_booking_conversation", {
        p_booking_id: booking.id,
        p_item_name: getItemName(booking.booking_details),
      });
      if (error) throw error;
      await loadAll();
      setTab("chats");
      await openConversation(data as string);
    } catch (e: any) {
      toast({ title: "Can't start chat", description: e.message || "Something went wrong", variant: "destructive" });
    } finally {
      setStarting(null);
    }
  }, [db, loadAll, openConversation]);

  // Deep links: /messages?c=<conversationId> or /messages?booking=<bookingId>
  useEffect(() => {
    if (loading || !user || autoStarted.current) return;
    const c = params.get("c");
    const bk = params.get("booking");
    if (c && conversations.some((x) => x.id === c)) {
      autoStarted.current = true;
      openConversation(c);
      setParams({}, { replace: true });
    } else if (bk) {
      const booking = bookings.find((b) => b.id === bk);
      if (booking && isChatEligible(booking)) {
        autoStarted.current = true;
        const existing = conversations.find((x) => x.booking_id === bk);
        if (existing) openConversation(existing.id);
        else startChat(booking);
        setParams({}, { replace: true });
      }
    }
  }, [loading, user, params, conversations, bookings, openConversation, startChat, setParams]);

  // ── Realtime ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`messages-page-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "booking_messages" }, (payload: any) => {
        const m = payload.new as Msg;
        const isMine = m.sender_id === user.id;

        if (m.conversation_id === activeRef.current) {
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (!isMine) db.rpc("mark_conversation_read", { p_conversation_id: m.conversation_id });
        } else if (!isMine) {
          setUnread((u) => ({ ...u, [m.conversation_id]: (u[m.conversation_id] || 0) + 1 }));
        }

        setConversations((prev) => {
          if (!prev.some((c) => c.id === m.conversation_id)) { loadAll(); return prev; }
          return prev
            .map((c) => (c.id === m.conversation_id ? { ...c, last_message: m.body.slice(0, 140), last_message_at: m.created_at } : c))
            .sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at));
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "booking_messages" }, (payload: any) => {
        const m = payload.new as Msg;
        if (m.conversation_id === activeRef.current) {
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read_at: m.read_at } : x)));
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "booking_conversations" }, () => loadAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadAll, db]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll + textarea sizing ─────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activeId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  // ── Send ─────────────────────────────────────────────────────────────────
  const doSend = async (text: string) => {
    if (!user || !activeId) return;
    setSending(true);
    try {
      const { data, error } = await db
        .from("booking_messages")
        .insert({ conversation_id: activeId, sender_id: user.id, body: text })
        .select().single();
      if (error) throw error;
      setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
      setConversations((prev) =>
        prev
          .map((c) => (c.id === activeId ? { ...c, last_message: text.slice(0, 140), last_message_at: data.created_at } : c))
          .sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at))
      );
      setDraft("");
      setConfirming(false);
    } catch (e: any) {
      toast({ title: "Message not sent", description: e.message || "Please try again", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sensitive = useMemo(() => detectSensitive(draft), [draft]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (sensitive.length && !confirming) { setConfirming(true); return; }
    doSend(text);
  };

  // ── Offers & requests ────────────────────────────────────────────────────
  const loadOffers = useCallback(async () => {
    if (!user) return;
    setOffersLoading(true);
    let res = await db.from("availability_inquiries").select("*")
      .or(`guest_id.eq.${user.id},host_id.eq.${user.id}`)
      .order("created_at", { ascending: false }).limit(50);
    if (res.error) {
      // schema without host_id → guest side only
      res = await db.from("availability_inquiries").select("*")
        .eq("guest_id", user.id).order("created_at", { ascending: false }).limit(50);
    }
    setOffers(res.data || []);
    setOffersLoading(false);
  }, [user, db]);

  useEffect(() => {
    if (tab === "offers") loadOffers();
  }, [tab, loadOffers]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const eligibleBookings = useMemo(() => bookings.filter(isChatEligible), [bookings]);
  const bookingsWithoutChat = useMemo(
    () => eligibleBookings.filter((b) => !conversations.some((c) => c.booking_id === b.id)),
    [eligibleBookings, conversations]
  );
  const totalUnread = useMemo(() => Object.values(unread).reduce((a, b) => a + b, 0), [unread]);
  const chatsLocked = conversations.length === 0 && eligibleBookings.length === 0;

  const roleOf = (c: Conversation): "host" | "guest" => (c.guest_id === user?.id ? "host" : "guest"); // role of the OTHER person
  const otherName = (c: Conversation) =>
    names[c.guest_id === user?.id ? c.host_id : c.guest_id] || (roleOf(c) === "host" ? "Host" : "Guest");

  const visibleConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      const role = c.guest_id === user?.id ? "host" : "guest";
      if (filter === "unread" && !unread[c.id]) return false;
      if (filter === "hosts" && role !== "host") return false;
      if (filter === "guests" && role !== "guest") return false;
      if (!q) return true;
      const n = names[c.guest_id === user?.id ? c.host_id : c.guest_id] || role;
      return `${n} ${c.item_name || ""} ${c.last_message || ""}`.toLowerCase().includes(q);
    });
  }, [conversations, filter, query, unread, names, user?.id]);

  const active = conversations.find((c) => c.id === activeId) || null;

  const grouped = useMemo(() => {
    const out: Array<{ day: string; items: Msg[] }> = [];
    messages.forEach((m) => {
      const day = dayLabel(m.created_at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    });
    return out;
  }, [messages]);

  // ── Auth gate ────────────────────────────────────────────────────────────
  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen pb-20 md:pb-0" style={{ background: CANVAS }}>
        <Header />
        <main className="container px-4 py-16 flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full animate-spin" style={{ border: `2px solid ${FOREST_SOFT}`, borderTopColor: FOREST }} />
          <p className="text-[11px] font-medium animate-pulse" style={{ color: INK_SOFT, fontFamily: FONT_BODY }}>Loading messages…</p>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pb-24" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
        <Header />
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <div className="flex flex-col items-center py-16 bg-white rounded-[32px] px-6 text-center" style={{ border: `1px solid ${HAIRLINE}` }}>
            <div className="p-5 rounded-2xl mb-5" style={{ background: FOREST_SOFT }}>
              <MessageSquare className="h-9 w-9" style={{ color: FOREST }} />
            </div>
            <h1 className="text-xl font-semibold mb-2" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Sign in to see your messages</h1>
            <p className="text-sm mb-6 max-w-sm" style={{ color: INK_SOFT }}>Chat with your host after you book, and keep track of your offers and requests.</p>
            <div className="flex gap-2.5">
              <Button onClick={() => openAuthModal("login")} variant="outline" className="rounded-xl gap-2" style={{ borderColor: HAIRLINE, color: INK }}>
                <LogIn className="h-4 w-4" /> Log in
              </Button>
              <Button onClick={() => openAuthModal("signup")} className="rounded-xl gap-2 text-white border-none" style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}>
                <UserPlus className="h-4 w-4" /> Sign up
              </Button>
            </div>
          </div>
        </div>
        <MobileBottomBar />
      </div>
    );
  }

  // ── Page ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-20 md:pb-0" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <Header />

      <main className="max-w-6xl mx-auto px-0 md:px-4 md:py-6">
        {/* Page title (hidden on mobile while a chat is open) */}
        <div className={cn("px-4 md:px-0 pt-4 md:pt-0 mb-3 md:mb-4", activeId && tab === "chats" && "hidden md:block")}>
          <p className="text-[10px] font-semibold mb-0.5" style={{ color: FOREST }}>My account</p>
          <h1 className="text-[26px] font-semibold tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Messages</h1>
        </div>

        {/* Tabs */}
        <div className={cn("px-4 md:px-0 mb-3", activeId && tab === "chats" && "hidden md:block")}>
          <div className="inline-flex gap-1 bg-white rounded-xl p-1" style={{ border: `1px solid ${HAIRLINE}` }}>
            {([
              { id: "chats", label: "Chats", icon: MessageSquare, badge: totalUnread },
              { id: "offers", label: "Offers & requests", icon: Tag, badge: 0 },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
                style={tab === t.id ? { background: FOREST, color: "#fff" } : { color: INK_SOFT }}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.badge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ background: DANGER }}>
                    {t.badge > 99 ? "99+" : t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {setupError && (
          <div className="mx-4 md:mx-0 mb-3 flex items-start gap-2.5 rounded-xl p-3.5" style={{ background: DANGER_SOFT, border: `1px solid ${DANGER}30` }}>
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: DANGER }} />
            <p className="text-[12px] font-medium" style={{ color: DANGER }}>{setupError}</p>
          </div>
        )}

        {/* ═════════════════════ CHATS ═════════════════════ */}
        {tab === "chats" && !setupError && (
          chatsLocked ? (
            <div className="mx-4 md:mx-0 flex flex-col items-center text-center py-16 px-6 bg-white rounded-[28px]" style={{ border: `1px solid ${HAIRLINE}` }}>
              <div className="p-5 rounded-2xl mb-5" style={{ background: GOLD_SOFT }}>
                <Lock className="h-9 w-9" style={{ color: GOLD }} />
              </div>
              <h2 className="text-lg font-semibold mb-1.5" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Messaging unlocks after you book</h2>
              <p className="text-[13px] max-w-sm mb-5" style={{ color: INK_SOFT }}>
                Once you've booked a trip, stay or event, you can chat with the host right here to ask questions and plan your visit.
              </p>
              <button onClick={() => navigate("/")} className="text-white font-semibold rounded-xl px-6 py-2.5 text-[13px] hover:opacity-90" style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}>
                Explore and book
              </button>
            </div>
          ) : (
            <div
              className="md:rounded-[24px] overflow-hidden bg-white flex md:grid md:grid-cols-[360px_1fr]"
              style={{ border: `1px solid ${HAIRLINE}`, height: "calc(100dvh - 15.5rem)", minHeight: 460 }}
            >
              {/* ── Conversation list ── */}
              <section
                className={cn("flex-col min-h-0 w-full md:w-auto", activeId ? "hidden md:flex" : "flex")}
                style={{ borderRight: `1px solid ${HAIRLINE}` }}
              >
                <div className="p-3 space-y-2.5 flex-shrink-0" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: INK_SOFT }} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search chats"
                      className="w-full rounded-xl pl-9 pr-3 py-2 text-[13px] outline-none"
                      style={{ background: CANVAS, color: INK, border: `1px solid ${HAIRLINE}` }}
                    />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {([
                      { id: "all", label: "All" },
                      { id: "unread", label: `Unread${totalUnread ? ` (${totalUnread})` : ""}` },
                      { id: "hosts", label: "Hosts" },
                      { id: "guests", label: "Guests" },
                    ] as const).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-all"
                        style={filter === f.id ? { background: FOREST, color: "#fff", borderColor: FOREST } : { background: "#fff", color: INK_SOFT, borderColor: HAIRLINE }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {/* Bookings that can start a chat */}
                  {bookingsWithoutChat.length > 0 && (
                    <div className="p-3" style={{ background: FOREST_SOFT, borderBottom: `1px solid ${HAIRLINE}` }}>
                      <p className="text-[11px] font-semibold mb-2" style={{ color: FOREST }}>Start a chat with your host</p>
                      <div className="space-y-1.5">
                        {bookingsWithoutChat.slice(0, 4).map((b) => (
                          <div key={b.id} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2" style={{ border: `1px solid ${FOREST}20` }}>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold truncate" style={{ color: INK }}>{getItemName(b.booking_details)}</p>
                              {(b.visit_date || b.booking_details?.date) && (
                                <p className="text-[10px] flex items-center gap-1" style={{ color: INK_SOFT }}>
                                  <Calendar className="h-2.5 w-2.5" />{fmtDate(b.visit_date || b.booking_details?.date)}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => startChat(b)}
                              disabled={starting === b.id}
                              className="flex items-center gap-1 text-white text-[11px] font-semibold rounded-lg px-2.5 py-1.5 disabled:opacity-60"
                              style={{ background: FOREST }}
                            >
                              {starting === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                              Message
                            </button>
                          </div>
                        ))}
                        {bookingsWithoutChat.length > 4 && (
                          <p className="text-[10px] px-1" style={{ color: INK_SOFT }}>+ {bookingsWithoutChat.length - 4} more bookings</p>
                        )}
                      </div>
                    </div>
                  )}

                  {visibleConversations.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-14 px-6">
                      <Inbox className="h-8 w-8 mb-2" style={{ color: `${FOREST}55` }} />
                      <p className="text-[13px] font-semibold" style={{ color: INK }}>
                        {conversations.length === 0 ? "No chats yet" : "Nothing matches"}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: INK_SOFT }}>
                        {conversations.length === 0
                          ? "Pick a booking above to message its host."
                          : "Try another filter or search."}
                      </p>
                    </div>
                  ) : (
                    visibleConversations.map((c) => {
                      const role = roleOf(c);
                      const name = otherName(c);
                      const n = unread[c.id] || 0;
                      const isActive = c.id === activeId;
                      return (
                        <button
                          key={c.id}
                          onClick={() => openConversation(c.id)}
                          className="w-full text-left flex items-center gap-3 px-3.5 py-3 transition-colors"
                          style={{ background: isActive ? FOREST_SOFT : "transparent", borderBottom: `1px solid ${HAIRLINE}` }}
                        >
                          <Avatar name={name} role={role} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className={cn("text-[13px] truncate", n ? "font-bold" : "font-semibold")} style={{ color: INK }}>{name}</p>
                                <RolePill role={role} />
                              </div>
                              <span className="text-[10px] flex-shrink-0 font-medium" style={{ color: n ? FOREST : INK_SOFT }}>{listTime(c.last_message_at)}</span>
                            </div>
                            <p className="text-[10px] font-semibold truncate mt-0.5" style={{ color: FOREST }}>{c.item_name || "Booking"}</p>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <p className={cn("text-[12px] truncate", n && "font-semibold")} style={{ color: n ? INK : INK_SOFT }}>
                                {c.last_message || "No messages yet. Say hello 👋"}
                              </p>
                              {n > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white flex-shrink-0" style={{ background: CLAY }}>
                                  {n > 99 ? "99+" : n}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              {/* ── Chat pane ── */}
              <section className={cn("flex-col min-h-0 min-w-0 flex-1", activeId ? "flex" : "hidden md:flex")}>
                {!active ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-8" style={{ background: `${CANVAS}90` }}>
                    <div className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center mb-4" style={{ border: `1px solid ${HAIRLINE}` }}>
                      <MessageSquare className="h-7 w-7" style={{ color: `${FOREST}70` }} />
                    </div>
                    <p className="text-[15px] font-semibold" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Select a chat</p>
                    <p className="text-[12px] mt-1 max-w-xs" style={{ color: INK_SOFT }}>Choose a conversation to read and reply, or start one from a booking.</p>
                    <div className="mt-5 max-w-sm rounded-xl p-3.5 text-left flex gap-2.5" style={{ background: GOLD_SOFT, border: `1px solid ${GOLD}30` }}>
                      <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: GOLD }} />
                      <p className="text-[11px] leading-snug" style={{ color: GOLD_TEXT }}>
                        Never share personal contact or payment details in chat. Keep everything on RealTravo.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Chat header */}
                    <div className="flex items-center gap-3 px-3.5 py-3 flex-shrink-0 bg-white" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                      <button
                        onClick={() => setActiveId(null)}
                        className="md:hidden h-8 w-8 rounded-full flex items-center justify-center"
                        style={{ background: CANVAS }}
                        aria-label="Back to chats"
                      >
                        <ArrowLeft className="h-4 w-4" style={{ color: INK }} />
                      </button>
                      <Avatar name={otherName(active)} role={roleOf(active)} size={38} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[14px] font-semibold truncate" style={{ color: INK }}>{otherName(active)}</p>
                          <RolePill role={roleOf(active)} />
                        </div>
                        <p className="text-[11px] truncate" style={{ color: INK_SOFT }}>{active.item_name || "Booking"}</p>
                      </div>
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: SUCCESS_SOFT, color: SUCCESS }}>
                        <ShieldCheck className="h-3 w-3" /> Booking verified
                      </span>
                    </div>

                    <SafetyBanner />

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4" style={{ background: `${CANVAS}90` }}>
                      {messagesLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" style={{ color: FOREST }} /></div>
                      ) : messages.length === 0 ? (
                        <div className="text-center py-10 px-6">
                          <p className="text-[13px] font-semibold" style={{ color: INK }}>Say hello 👋</p>
                          <p className="text-[11px] mt-1" style={{ color: INK_SOFT }}>
                            Ask about arrival times, what to bring or anything else about your booking.
                          </p>
                        </div>
                      ) : (
                        grouped.map((g) => (
                          <div key={g.day} className="space-y-1.5">
                            <div className="flex justify-center">
                              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white" style={{ color: INK_SOFT, border: `1px solid ${HAIRLINE}` }}>{g.day}</span>
                            </div>
                            {g.items.map((m) => {
                              const mine = m.sender_id === user.id;
                              return (
                                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                                  <div
                                    className={cn("max-w-[82%] md:max-w-[70%] px-3.5 py-2 rounded-2xl", mine ? "rounded-br-md" : "rounded-bl-md")}
                                    style={
                                      mine
                                        ? { background: FOREST, color: "#fff" }
                                        : { background: "#fff", color: INK, border: `1px solid ${HAIRLINE}` }
                                    }
                                  >
                                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                                    <div className={cn("flex items-center gap-1 mt-0.5", mine ? "justify-end" : "justify-start")}>
                                      <span className="text-[9px]" style={{ color: mine ? "rgba(255,255,255,0.65)" : INK_SOFT }}>
                                        {format(new Date(m.created_at), "HH:mm")}
                                      </span>
                                      {mine && (m.read_at
                                        ? <CheckCheck className="h-3 w-3" style={{ color: "#8FE0B0" }} aria-label="Read" />
                                        : <Check className="h-3 w-3" style={{ color: "rgba(255,255,255,0.65)" }} aria-label="Sent" />)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))
                      )}
                      <div ref={bottomRef} />
                    </div>

                    {/* Composer */}
                    <div className="flex-shrink-0 bg-white px-3 py-2.5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                      {confirming && sensitive.length > 0 && (
                        <div className="mb-2 rounded-xl p-3" style={{ background: DANGER_SOFT, border: `1px solid ${DANGER}30` }}>
                          <p className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: DANGER }}>
                            <ShieldAlert className="h-3.5 w-3.5" /> This looks like it contains {sensitive.join(" and ")}
                          </p>
                          <p className="text-[11px] mt-1 leading-snug" style={{ color: DANGER }}>
                            For your safety, keep contact and payment details off chat. Bookings and payments made outside RealTravo aren't protected.
                          </p>
                          <div className="flex gap-2 mt-2.5">
                            <button onClick={() => { setConfirming(false); textareaRef.current?.focus(); }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white" style={{ background: FOREST }}>
                              Edit message
                            </button>
                            <button onClick={() => doSend(draft.trim())} disabled={sending} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white disabled:opacity-60" style={{ color: DANGER, border: `1px solid ${DANGER}40` }}>
                              Send anyway
                            </button>
                          </div>
                        </div>
                      )}

                      {!confirming && sensitive.length > 0 && (
                        <p className="mb-1.5 text-[11px] font-medium flex items-center gap-1.5" style={{ color: GOLD_TEXT }}>
                          <ShieldAlert className="h-3 w-3" /> Heads up: avoid sharing {sensitive[0]} in chat.
                        </p>
                      )}

                      <div className="flex items-end gap-2">
                        <textarea
                          ref={textareaRef}
                          value={draft}
                          onChange={(e) => { setDraft(e.target.value.slice(0, MAX_LEN)); setConfirming(false); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                          }}
                          rows={1}
                          placeholder="Write a message…"
                          className="flex-1 resize-none rounded-2xl px-3.5 py-2.5 text-[13px] outline-none"
                          style={{ background: CANVAS, color: INK, border: `1px solid ${HAIRLINE}`, maxHeight: 120 }}
                        />
                        <button
                          onClick={handleSend}
                          disabled={!draft.trim() || sending}
                          aria-label="Send message"
                          className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-all disabled:opacity-40"
                          style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}
                        >
                          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </button>
                      </div>
                      {draft.length > MAX_LEN - 200 && (
                        <p className="text-[10px] text-right mt-1" style={{ color: INK_SOFT }}>{draft.length}/{MAX_LEN}</p>
                      )}
                    </div>
                  </>
                )}
              </section>
            </div>
          )
        )}

        {/* ═════════════════════ OFFERS & REQUESTS ═════════════════════ */}
        {tab === "offers" && (
          <div className="px-4 md:px-0 max-w-2xl">
            {offersLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" style={{ color: FOREST }} /></div>
            ) : offers.length === 0 ? (
              <div className="flex flex-col items-center text-center py-16 bg-white rounded-[24px] px-6" style={{ border: `1px solid ${HAIRLINE}` }}>
                <Tag className="h-8 w-8 mb-3" style={{ color: `${FOREST}55` }} />
                <p className="text-[14px] font-semibold" style={{ color: INK }}>No offers or requests yet</p>
                <p className="text-[12px] mt-1 max-w-xs" style={{ color: INK_SOFT }}>
                  Custom booking requests and the offers hosts send back will show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {offers.map((o) => {
                  const iAmGuest = o.guest_id === user.id;
                  const status = String(o.status || "pending").toLowerCase();
                  const paid = String(o.payment_status || "").toLowerCase() === "paid";
                  const amount = inquiryAmount(o);
                  const visit = o.visit_date || o.booking_details?.visit_date;
                  const tone =
                    paid ? { bg: SUCCESS_SOFT, fg: SUCCESS, label: "Paid" }
                    : status === "accepted" ? { bg: GOLD_SOFT, fg: GOLD_TEXT, label: "Offer · awaiting payment" }
                    : status === "declined" ? { bg: DANGER_SOFT, fg: DANGER, label: "Declined" }
                    : status === "expired" ? { bg: CANVAS, fg: INK_SOFT, label: "Expired" }
                    : { bg: INFO_SOFT, fg: INFO, label: "Pending" };

                  return (
                    <div key={o.id} className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${HAIRLINE}` }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold" style={{ color: FOREST }}>
                            {iAmGuest ? "Your request" : "Request from a guest"}
                          </p>
                          <p className="text-[14px] font-semibold truncate" style={{ color: INK }}>
                            {o.item_name || getItemName(o.booking_details) || "Custom booking"}
                          </p>
                          {visit && (
                            <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: INK_SOFT }}>
                              <Calendar className="h-2.5 w-2.5" />{fmtDate(visit)}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 inline-flex items-center gap-1" style={{ background: tone.bg, color: tone.fg }}>
                          {status === "accepted" && !paid && <Clock className="h-3 w-3" />}
                          {tone.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[15px] font-semibold" style={{ color: CLAY }}>{amount > 0 ? fmtMoney(amount) : "—"}</span>
                        {iAmGuest && status === "accepted" && !paid && amount > 0 && (
                          <button onClick={() => navigate(inquiryPayPath(o))} className="flex items-center gap-1.5 text-white font-semibold rounded-xl px-4 py-2 text-xs" style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}>
                            <CreditCard className="h-3.5 w-3.5" /> Pay now
                          </button>
                        )}
                        {!iAmGuest && status === "pending" && (
                          <button onClick={() => navigate("/host-bookings")} className="text-xs font-semibold rounded-xl px-4 py-2" style={{ background: FOREST, color: "#fff" }}>
                            Respond in Host bookings
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <MobileBottomBar />
    </div>
  );
};

export default Messages;