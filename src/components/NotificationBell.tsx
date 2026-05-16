import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Bell, CheckCircle2, Clock, ChevronRight, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
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

const NOTIFICATION_SOUND_URL = "/audio/notification.mp3";

const categorizeNotifications = (notifications: Notification[]) => {
  const groups: Record<string, Notification[]> = {};
  notifications.forEach((notification) => {
    const date = new Date(notification.created_at);
    let category: string;
    if (isToday(date)) category = "Today";
    else if (isYesterday(date)) category = "Yesterday";
    else category = format(date, "MMMM dd, yyyy");
    if (!groups[category]) groups[category] = [];
    groups[category].push(notification);
  });
  return Object.keys(groups).map((title) => ({ title, notifications: groups[title] }));
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getNotificationDeepLink = useCallback((notification: Notification): string | null => {
    const { type, data } = notification;
    switch (type) {
      case "host_verification":    return "/verification-status";
      case "payment_verification": return "/account";
      case "withdrawal_success":
      case "withdrawal_failed":    return "/payment";
      case "new_booking":
        if (data?.item_id && data?.booking_type) return `/host-bookings/${data.booking_type}/${data.item_id}`;
        return "/host-bookings";
      case "payment_confirmed":    return "/bookings";
      case "new_referral":         return "/payment";
      case "item_status":
      case "item_hidden":
      case "item_unhidden":
        if (data?.item_id && data?.item_type) return `/host-bookings/${data.item_type}/${data.item_id}`;
        return "/my-listing";
      default: return null;
    }
  }, []);

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      markAsRead(notification.id);
      const deepLink = getNotificationDeepLink(notification);
      if (deepLink) { setIsOpen(false); navigate(deepLink); }
    },
    [getNotificationDeepLink, navigate]
  );

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.5;
    return () => { audioRef.current = null; };
  }, []);

  const playNotificationSound = useCallback(() => {
    if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(console.error); }
  }, []);

  const showInAppNotification = useCallback((notification: Notification) => {
    toast({ title: notification.title, description: notification.message });
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error) {
      setNotifications(data || []);
      setUnreadCount(data?.filter((n) => !n.is_read).length || 0);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const channelName = `notifications-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          playNotificationSound();
          if (payload.new) showInAppNotification(payload.new as Notification);
          fetchNotifications();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        fetchNotifications
      );
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const markAsRead = async (notificationId: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    fetchNotifications();
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (!error) {
      fetchNotifications();
      toast({ title: "CLEARED!", description: "All notifications marked as read." });
    }
  };

  const categorizedNotifications = useMemo(
    () => categorizeNotifications(notifications),
    [notifications]
  );

  return (
    <div className="relative overflow-visible z-20">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <button
            className="h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 relative group overflow-visible"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 stroke-[2.5px] transition-transform group-hover:rotate-12" />
            {unreadCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center border-2 border-white text-[10px] font-black z-[50] bg-destructive text-destructive-foreground"
                style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.2)", pointerEvents: "none" }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </button>
        </SheetTrigger>

        {/*
          ✅ Constrained width: w-[80vw] max-w-[320px] — no longer full-width on desktop
        */}
        <SheetContent
          side="right"
          className="w-[80vw] max-w-[320px] p-0 border-none flex flex-col [&>button]:hidden"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {/* Header */}
          <div className="bg-primary px-4 pt-4 pb-4 relative flex-shrink-0">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-3.5 right-3.5 h-6 w-6 rounded-full bg-primary-foreground/15 flex items-center justify-center hover:bg-primary-foreground/25 transition-colors"
            >
              <X className="h-3 w-3 text-primary-foreground" />
            </button>

            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary-foreground/40 mb-0.5">
              Stay Updated
            </p>
            <div className="flex items-center justify-between pr-8">
              <h2 className="text-lg font-extrabold text-primary-foreground">Inbox</h2>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[9px] font-black uppercase tracking-widest text-primary-foreground/50 hover:text-primary-foreground transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto bg-background rounded-t-3xl py-2.5 px-2.5 space-y-2.5">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Bell className="h-6 w-6 text-primary" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  All caught up!
                </p>
              </div>
            ) : (
              categorizedNotifications.map((group) => (
                <div key={group.title}>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.22em] px-1 mb-1">
                    {group.title}
                  </p>
                  <div className="rounded-xl overflow-hidden border border-border bg-card divide-y divide-border/50">
                    {group.notifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/60 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div
                            className={`h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                              notification.is_read ? "bg-muted" : "bg-primary/10"
                            }`}
                          >
                            {notification.is_read ? (
                              <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <Clock className="h-3 w-3 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p
                              className={`text-xs font-semibold truncate ${
                                notification.is_read ? "text-muted-foreground" : "text-foreground"
                              }`}
                            >
                              {notification.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {notification.message}
                            </p>
                            <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                              {format(new Date(notification.created_at), "h:mm a")}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
            <div className="h-1" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};