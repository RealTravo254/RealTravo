import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[9998] bg-amber-500 text-white py-2 px-4",
        "flex items-center justify-center gap-2 text-sm font-medium",
        "animate-fade-in shadow-lg"
      )}
    >
      <WifiOff className="h-4 w-4" />
      <span>You're offline. Showing cached content.</span>
    </div>
  );
};
