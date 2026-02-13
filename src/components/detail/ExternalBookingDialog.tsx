import { useState, useCallback } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ExternalBookingButtonProps {
  url: string;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ExternalBookingButton = ({ url, title = "Reserve Now", className, children }: ExternalBookingButtonProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = useCallback(() => {
    setLoading(true);
    toast({ title: "Opening booking page...", description: "Redirecting to external site." });
    
    // Small delay for spinner visibility, then open
    setTimeout(() => {
      window.open(url, "_blank", "noopener,noreferrer");
      setLoading(false);
    }, 800);
  }, [url, toast]);

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Opening...
        </>
      ) : (
        children || (
          <>
            <ExternalLink className="h-4 w-4 mr-2" />
            {title}
          </>
        )
      )}
    </Button>
  );
};

// Keep backward compatibility - but now it's just a loading button that opens a new tab
export const ExternalBookingDialog = ExternalBookingButton;
