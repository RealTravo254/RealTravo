import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Bell, CheckCircle2, Clock, ChevronRight, X, Inbox,
  ShieldCheck, CreditCard, Wallet, CalendarCheck, Star,
  EyeOff, Eye, AlertCircle, Gift, Ban,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { format, isToday, isYesterday } from "date-fns";
import { useNavigate } from "react-router-dom";

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used across the rest of the app.
// Notification types still get their own hue for scannability, but drawn
// from this earthier palette instead of a generic Tailwind rainbow.
const FOREST       = "#1F4D3A";
const FOREST_DEEP  = "#123322";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const CLAY_SOFT    = "#FBEDE6";
const GOLD         = "#B98A2A";
const GOLD_SOFT    = "#FBF2DD";
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

// Injects the two typefaces once, without needing to touch the app's index.html.
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

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

// ── Icon + colour per notification type ──────────────────────────────────────
const TYPE_META: Record<
  string,
  { icon: React.ElementType; bg: string; iconColor: string; accent: string }
> = {
  host_verification:     { icon: ShieldCheck,   bg: SUCCESS_SOFT, iconColor: SUCCESS, accent: SUCCESS },
  payment_verification:  { icon: CreditCard,    bg: INFO_SOFT,    iconColor: INFO,    accent: INFO    },
  withdrawal_success:    { icon: Wallet,        bg: SUCCESS_SOFT, iconColor: SUCCESS, accent: SUCCESS },
  withdrawal_failed:     { icon: Wallet,        bg: DANGER_SOFT,  iconColor: DANGER,  accent: DANGER  },
  new_booking:           { icon: CalendarCheck, bg: CLAY_SOFT,    iconColor: CLAY,    accent: CLAY    },
  payment_confirmed:     { icon: CreditCard,    bg: SUCCESS_SOFT, iconColor: SUCCESS, accent: SUCCESS },
  new_referral:          { icon: Gift,          bg: GOLD_SOFT,    iconColor: GOLD,    accent: GOLD    },
  item_status:           { icon: Star,          bg: GOLD_SOFT,    iconColor: GOLD,    accent: GOLD    },
  item_hidden:           { icon: EyeOff,        bg: CANVAS,       iconColor: INK_SOFT, accent: INK_SOFT },
  item_unhidden:         { icon: Eye,           bg: INFO_SOFT,    iconColor: INFO,    accent: INFO    },
  item_submitted:        { icon: Clock,         bg: GOLD_SOFT,    iconColor: GOLD,    accent: GOLD    },
  account_banned:        { icon: Ban,           bg: DANGER_SOFT,  iconColor: DANGER,  accent: DANGER  },
  account_unbanned:      { icon: ShieldCheck,   bg: SUCCESS_SOFT, iconColor: SUCCESS, accent: SUCCESS },
};

const DEFAULT_META = {
  icon: Bell,
  bg: CANVAS,
  iconColor: INK_SOFT,
  accent: FOREST,
};

const getMeta = (type: string) => TYPE_META[type] ?? DEFAULT_META;

// ── Group by date ─────────────────────────────────────────────────────────────
const categorize = (notifications: Notification[]) => {
  const groups: Record<string, Notification[]> = {};
  notifications.forEach((n) => {
    const d = new Date(n.created_at);
    const label = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "MMMM d, yyyy");
    (groups[label] ??= []).push(n);
  });
  return Object.entries(groups).map(([title, items]) => ({ title, items }));
};

// ── Relative time ─────────────────────────────────────────────────────────────
const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return format(new Date(iso), "MMM d");
};

export const NotificationBell = () => {
  useInjectFonts();

  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [animateBell, setAnimateBell] = useState(false);

  // ── Deep-link map ────────────────────────────────────────────────────────
  const getDeepLink = useCallback((n: Notification): string | null => {
    const { type, data } = n;
    switch (type) {
      case "host_verification":    return "/verification-status";
      case "payment_verification": return "/account";
      case "withdrawal_success":
      case "withdrawal_failed":    return "/payment";
      case "new_booking":
        return data?.item_id && data?.booking_type
          ? `/host-bookings/${data.booking_type}/${data.item_id}`
          : "/host-bookings";
      case "payment_confirmed":    return "/bookings";
      case "new_referral":         return "/payment";
      case "item_status":
      case "item_hidden":
      case "item_unhidden":
        return data?.item_id && data?.item_type
          ? `/host-bookings/${data.item_type}/${data.item_id}`
          : "/my-listing";
      default: return null;
    }
  }, []);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications(data ?? []);
    setUnreadCount(data?.filter((n) => !n.is_read).length ?? 0);
  }, [user]);

  // ── Realtime ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const channelId = `bell-notif-${user.id}`;

    try {
      const existing = supabase.channel(channelId);
      supabase.removeChannel(existing);
    } catch (e) {
      // ignore
    }

    const channel = supabase.channel(channelId);

    channel
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        // Bell wiggle animation only — no sound, no permission request
        setAnimateBell(true);
        setTimeout(() => setAnimateBell(false), 1000);

        if (payload.new) {
          const n = payload.new as Notification;
          // In-app toast only — no browser notification API called
          toast({ title: n.title, description: n.message });
        }
        fetchNotifications();
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, fetchNotifications);

    channel.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchNotifications]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await supabase.from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    fetchNotifications();
  }, [user, fetchNotifications]);

  const handleClick = useCallback((n: Notification) => {
    markAsRead(n.id);
    const link = getDeepLink(n);
    if (link) { setIsOpen(false); navigate(link); }
  }, [markAsRead, getDeepLink, navigate]);

  const grouped = useMemo(() => categorize(notifications), [notifications]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative z-20">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>

        {/* ── Bell trigger ── */}
        <SheetTrigger asChild>
          <button
            aria-label="Notifications"
            className="relative h-9 w-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-slate-100 active:scale-90"
          >
            <Bell
              className={`h-5 w-5 stroke-[2px] transition-transform duration-200 ${
                animateBell ? "animate-[wiggle_0.4s_ease-in-out]" : ""
              }`}
            />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white leading-none z-10"
                style={{ background: DANGER, fontFamily: FONT_BODY }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </SheetTrigger>

        {/* ── Drawer ── */}
        <SheetContent
          side="right"
          className="w-[88vw] max-w-[360px] p-0 border-none shadow-2xl [&>button]:hidden"
        >
          <div
            className="flex flex-col h-full"
            style={{
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
              background: CANVAS,
              fontFamily: FONT_BODY,
            }}
          >

            {/* ── Header ── */}
            <div
              className="relative flex-shrink-0 px-5 pt-5 pb-4"
              style={{ background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)` }}
            >
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 h-7 w-7 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>

              <div className="flex items-end justify-between pr-8">
                <div>
                  <p className="text-[10px] font-medium text-white/55 mb-0.5">
                    Notifications
                  </p>
                  <h2 className="text-2xl font-semibold text-white tracking-tight leading-none" style={{ fontFamily: FONT_DISPLAY }}>
                    Inbox
                  </h2>
                </div>

                {unreadCount > 0 && (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[22px] font-semibold text-white leading-none" style={{ fontFamily: FONT_DISPLAY }}>
                      {unreadCount}
                    </span>
                    <span className="text-[10px] font-medium text-white/55">
                      unread
                    </span>
                  </div>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-white/65 hover:text-white transition-colors"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Mark all as read
                </button>
              )}

              <div className="absolute bottom-0 left-0 right-0 overflow-hidden h-3 pointer-events-none">
                <svg viewBox="0 0 360 12" preserveAspectRatio="none" className="w-full h-full">
                  <path d="M0,0 C90,12 270,12 360,0 L360,12 L0,12 Z" fill={CANVAS} />
                </svg>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4 space-y-4">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="relative mb-5">
                    <div className="h-16 w-16 rounded-2xl bg-white shadow-sm flex items-center justify-center" style={{ border: `1px solid ${HAIRLINE}` }}>
                      <Inbox className="h-7 w-7" style={{ color: `${FOREST}55` }} />
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-lg">✨</span>
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: INK }}>All caught up</p>
                  <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>
                    No notifications yet. We'll let you know when something happens.
                  </p>
                </div>
              ) : (
                grouped.map((group) => (
                  <div key={group.title}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-[10px] font-medium" style={{ color: INK_SOFT }}>
                        {group.title}
                      </span>
                      <div className="flex-1 h-px" style={{ background: HAIRLINE }} />
                    </div>

                    <div className="space-y-2">
                      {group.items.map((n) => {
                        const meta = getMeta(n.type);
                        const Icon = meta.icon;
                        const isUnread = !n.is_read;
                        const hasLink = !!getDeepLink(n);

                        return (
                          <button
                            key={n.id}
                            onClick={() => handleClick(n)}
                            className="w-full text-left rounded-2xl transition-all duration-150 group bg-white"
                            style={{
                              border: `1px solid ${isUnread ? `${FOREST}25` : HAIRLINE}`,
                              boxShadow: isUnread ? "0 2px 8px rgba(28,43,34,0.06)" : "none",
                            }}
                          >
                            <div className="flex items-start gap-3 p-3.5">
                              <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                                <Icon className="h-4 w-4" style={{ color: meta.iconColor }} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[12px] font-semibold leading-tight truncate" style={{ color: isUnread ? INK : INK_SOFT }}>
                                    {n.title}
                                  </p>
                                  <span className="text-[10px] font-medium whitespace-nowrap flex-shrink-0 mt-0.5" style={{ color: INK_SOFT }}>
                                    {relativeTime(n.created_at)}
                                  </span>
                                </div>
                                <p className="text-[11px] mt-0.5 line-clamp-2 leading-snug" style={{ color: INK_SOFT }}>
                                  {n.message}
                                </p>

                                <div className="flex items-center justify-between mt-2">
                                  <span
                                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize"
                                    style={{ background: `${meta.accent}15`, color: meta.accent }}
                                  >
                                    {n.type.replace(/_/g, " ")}
                                  </span>

                                  <div className="flex items-center gap-1.5">
                                    {isUnread && (
                                      <span
                                        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                                        style={{ background: meta.accent }}
                                      />
                                    )}
                                    {hasLink && (
                                      <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-all" style={{ color: HAIRLINE }} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {isUnread && (
                              <div
                                className="h-0.5 rounded-b-2xl"
                                style={{ background: `linear-gradient(90deg, ${meta.accent}, transparent)` }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Footer ── */}
            {notifications.length > 0 && (
              <div className="flex-shrink-0 px-4 py-3 bg-white" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                <p className="text-[10px] text-center font-medium" style={{ color: "#A7B2AB" }}>
                  {notifications.length} notification{notifications.length !== 1 ? "s" : ""} · Last {notifications.length} shown
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <style>{`
        @keyframes wiggle {
          0%,100% { transform: rotate(0deg); }
          20%      { transform: rotate(-15deg); }
          40%      { transform: rotate(15deg); }
          60%      { transform: rotate(-10deg); }
          80%      { transform: rotate(8deg); }
        }
      `}</style>
    </div>
  );
};