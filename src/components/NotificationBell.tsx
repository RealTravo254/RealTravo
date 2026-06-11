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
  host_verification:     { icon: ShieldCheck,   bg: "bg-emerald-50",  iconColor: "text-emerald-600", accent: "#059669" },
  payment_verification: { icon: CreditCard,    bg: "bg-blue-50",     iconColor: "text-blue-600",    accent: "#2563eb" },
  withdrawal_success:   { icon: Wallet,        bg: "bg-teal-50",     iconColor: "text-teal-600",    accent: "#0d9488" },
  withdrawal_failed:    { icon: Wallet,        bg: "bg-red-50",      iconColor: "text-red-500",     accent: "#ef4444" },
  new_booking:          { icon: CalendarCheck, bg: "bg-violet-50",   iconColor: "text-violet-600",  accent: "#7c3aed" },
  payment_confirmed:    { icon: CreditCard,    bg: "bg-green-50",    iconColor: "text-green-600",   accent: "#16a34a" },
  new_referral:         { icon: Gift,          bg: "bg-amber-50",    iconColor: "text-amber-500",   accent: "#f59e0b" },
  item_status:          { icon: Star,          bg: "bg-orange-50",   iconColor: "text-orange-500",  accent: "#f97316" },
  item_hidden:          { icon: EyeOff,        bg: "bg-slate-100",   iconColor: "text-slate-500",   accent: "#64748b" },
  item_unhidden:        { icon: Eye,           bg: "bg-sky-50",      iconColor: "text-sky-500",     accent: "#0ea5e9" },
  item_submitted:       { icon: Clock,         bg: "bg-amber-50",    iconColor: "text-amber-500",   accent: "#f59e0b" },
  account_banned:       { icon: Ban,           bg: "bg-red-50",      iconColor: "text-red-600",     accent: "#dc2626" },
  account_unbanned:     { icon: ShieldCheck,   bg: "bg-green-50",    iconColor: "text-green-600",   accent: "#16a34a" },
};

const DEFAULT_META = {
  icon: Bell,
  bg: "bg-slate-100",
  iconColor: "text-slate-500",
  accent: "#008080",
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

  // ── Realtime Setup with Explicit Sequence ───────────────────────────
  useEffect(() => {
    if (!user) return;
    
    // Fetch initial list
    fetchNotifications();

    // Create a distinct runtime channel ID
    const channelId = `bell-notif-${user.id}`;

    // Ensure any prior channel with the same id is removed first to avoid
    // adding callbacks after a channel has already been subscribed.
    try {
      const existing = supabase.channel(channelId);
      supabase.removeChannel(existing);
    } catch (e) {
      // ignore - removeChannel may throw if nothing exists yet
    }

    const channel = supabase.channel(channelId);

    // 1. Attach 'postgres_changes' event listeners FIRST
    channel
      .on("postgres_changes", {
        event: "INSERT", 
        schema: "public", 
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setAnimateBell(true);
        setTimeout(() => setAnimateBell(false), 1000);
        
        if (payload.new) {
          const n = payload.new as Notification;
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

    // 2. Trigger active subscription LAST
    channel.subscribe();

    // Clean up channel instantly when dependencies change or components unmount
    return () => { 
      supabase.removeChannel(channel); 
    };
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
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white leading-none z-10">
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
              background: "#f8fafc",
            }}
          >

          {/* ── Header ── */}
          <div
            className="relative flex-shrink-0 px-5 pt-5 pb-4"
            style={{ background: "linear-gradient(135deg, #008080 0%, #005f5f 100%)" }}
          >
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 h-7 w-7 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-white" />
            </button>

            <div className="flex items-end justify-between pr-8">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/50 mb-0.5">
                  Notifications
                </p>
                <h2 className="text-2xl font-black text-white tracking-tight leading-none">
                  Inbox
                </h2>
              </div>

              {unreadCount > 0 && (
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-[22px] font-black text-white leading-none">
                    {unreadCount}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">
                    unread
                  </span>
                </div>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white transition-colors"
              >
                <CheckCircle2 className="h-3 w-3" />
                Mark all as read
              </button>
            )}

            <div className="absolute bottom-0 left-0 right-0 overflow-hidden h-3 pointer-events-none">
              <svg viewBox="0 0 360 12" preserveAspectRatio="none" className="w-full h-full">
                <path d="M0,0 C90,12 270,12 360,0 L360,12 L0,12 Z" fill="#f8fafc" />
              </svg>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4 space-y-4">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="relative mb-5">
                  <div className="h-16 w-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                    <Inbox className="h-7 w-7 text-slate-300" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 text-lg">✨</span>
                </div>
                <p className="text-sm font-black text-slate-800 mb-1">All caught up!</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  No notifications yet. We'll let you know when something happens.
                </p>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.title}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.22em]">
                      {group.title}
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
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
                          className={`w-full text-left rounded-2xl border transition-all duration-150 group
                            ${isUnread
                              ? "bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300"
                              : "bg-white/60 border-slate-100 hover:bg-white hover:border-slate-200"
                            }`}
                        >
                          <div className="flex items-start gap-3 p-3.5">
                            <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                              <Icon className={`h-4 w-4 ${meta.iconColor}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-[12px] font-bold leading-tight truncate ${
                                  isUnread ? "text-slate-900" : "text-slate-500"
                                }`}>
                                  {n.title}
                                </p>
                                <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap flex-shrink-0 mt-0.5">
                                  {relativeTime(n.created_at)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                                {n.message}
                              </p>

                              <div className="flex items-center justify-between mt-2">
                                <span
                                  className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                                  style={{
                                    background: `${meta.accent}15`,
                                    color: meta.accent,
                                  }}
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
                                    <ChevronRight
                                      className="h-3 w-3 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all"
                                    />
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
            <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100 bg-white">
              <p className="text-[9px] text-center font-bold uppercase tracking-widest text-slate-300">
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