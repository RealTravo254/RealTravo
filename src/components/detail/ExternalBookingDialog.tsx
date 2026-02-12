import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, X } from "lucide-react";

interface ExternalBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
}

export const ExternalBookingDialog = ({ open, onOpenChange, url, title = "Reserve" }: ExternalBookingDialogProps) => {
  const [loading, setLoading] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between">
          <DialogTitle className="font-black uppercase tracking-tight text-sm">{title}</DialogTitle>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> Open in browser
          </a>
        </DialogHeader>
        <div className="flex-1 relative w-full h-full">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <iframe
            src={url}
            className="w-full h-full border-none"
            style={{ minHeight: "calc(85vh - 60px)" }}
            onLoad={() => setLoading(false)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
            title={title}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};