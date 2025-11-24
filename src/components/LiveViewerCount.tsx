import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveViewerCountProps {
  itemId: string;
  itemType: 'trip' | 'hotel' | 'adventure' | 'attraction' | 'event';
  className?: string;
}

export function LiveViewerCount({ itemId, itemType, className }: LiveViewerCountProps) {
  const [viewerCount, setViewerCount] = useState(0);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    // Generate a unique user ID for this session
    const sessionUserId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const channelName = `${itemType}-${itemId}`;

    console.log(`[LiveViewer] Joining channel: ${channelName}`);

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: sessionUserId,
        },
      },
    });

    // Set up presence event listeners
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        console.log(`[LiveViewer] Presence sync - ${count} viewers:`, state);
        setViewerCount(count);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log(`[LiveViewer] User joined:`, key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log(`[LiveViewer] User left:`, key, leftPresences);
      })
      .subscribe(async (status) => {
        console.log(`[LiveViewer] Subscription status:`, status);
        
        if (status === 'SUBSCRIBED') {
          // Track this user's presence
          const presenceTrackStatus = await channel.track({
            user_id: sessionUserId,
            viewing_at: new Date().toISOString(),
          });
          console.log(`[LiveViewer] Presence track status:`, presenceTrackStatus);
          setIsTracking(true);
        }
      });

    // Cleanup on unmount
    return () => {
      console.log(`[LiveViewer] Cleaning up channel: ${channelName}`);
      channel.untrack();
      supabase.removeChannel(channel);
      setIsTracking(false);
    };
  }, [itemId, itemType]);

  // Don't show if no viewers or only 1 viewer (just you)
  if (!isTracking || viewerCount <= 1) {
    return null;
  }

  // Show viewer count with a subtle animation
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
        "bg-destructive/10 border border-destructive/20",
        "text-sm font-medium text-destructive",
        "animate-in fade-in slide-in-from-top-2 duration-300",
        className
      )}
    >
      <Eye className="h-4 w-4 animate-pulse" />
      <span>
        {viewerCount === 2 
          ? "1 other person viewing" 
          : `${viewerCount - 1} others viewing`}
      </span>
    </div>
  );
}
