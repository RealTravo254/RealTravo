import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Link, Check, Share2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ShareableItem {
  id: string;
  type: string;
  name: string;
}

interface ShareableBookingLinkProps {
  /** Pick-from list. The dropdown lets the user choose which booking form to share. */
  items?: ShareableItem[];
  /** Legacy single-item props (old host pages) – still supported */
  itemId?: string;
  itemType?: string;
  itemName?: string;
  /** Pre-selected item (e.g. the card the button was clicked on) */
  defaultItemId?: string;
  triggerClassName?: string;
  /** Trigger button text */
  label?: string;
  /** Optional hook – log/share analytics, e.g. insert into a shares table */
  onShared?: (item: ShareableItem, method: "copy" | "share") => void;
}

const typeLabel: Record<string, string> = {
  trip: "Trip",
  event: "Event",
  hotel: "Hotel",
  adventure: "Adventure",
  adventure_place: "Adventure place",
};

export const ShareableBookingLink = ({
  items: itemsProp,
  itemId,
  itemType,
  itemName,
  defaultItemId: defaultItemIdProp,
  triggerClassName,
  label = "Share Form",
  onShared,
}: ShareableBookingLinkProps) => {
  // Support both the new `items` array and the old single-item props
  const items: ShareableItem[] = useMemo(() => {
    if (itemsProp && itemsProp.length > 0) return itemsProp;
    if (itemId) return [{ id: itemId, type: itemType || "trip", name: itemName || "this listing" }];
    return [];
  }, [itemsProp, itemId, itemType, itemName]);
  const defaultItemId = defaultItemIdProp || itemId;

  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(defaultItemId || items[0]?.id || "");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId),
    [items, selectedId]
  );

  const bookingLink = selected
    ? `${window.location.origin}/booking/${selected.type}/${selected.id}`
    : "";

  const recordUpdate = (method: "copy" | "share") => {
    if (!selected) return;
    const stamp = format(new Date(), "MMM d, HH:mm");
    setLastUpdate(
      method === "copy"
        ? `Link for "${selected.name}" copied at ${stamp}`
        : `Link for "${selected.name}" shared at ${stamp}`
    );
    onShared?.(selected, method);
  };

  const copyToClipboard = async () => {
    if (!selected) {
      toast({ title: "Pick an item", description: "Choose which booking form to copy", variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      recordUpdate("copy");
      toast({ title: "Copied!", description: `Booking form for ${selected.name} copied` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy link", variant: "destructive" });
    }
  };

  const shareLink = async () => {
    if (!selected) {
      toast({ title: "Pick an item", description: "Choose which booking form to share", variant: "destructive" });
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Book ${selected.name}`,
          text: `Book your spot at ${selected.name}`,
          url: bookingLink,
        });
        recordUpdate("share");
        toast({ title: "Shared", description: `Booking form for ${selected.name} sent` });
      } catch (err) {
        if ((err as Error).name !== "AbortError") copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 rounded-xl border-[#008080] text-[#008080] hover:bg-[#008080]/10 text-xs",
            triggerClassName
          )}
        >
          <Link className="h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black uppercase tracking-tight">
            Share Booking Form
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Which booking form?
            </Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select an item to share" />
              </SelectTrigger>
              <SelectContent>
                {items.length === 0 && (
                  <div className="p-3 text-sm text-slate-500">No listings yet.</div>
                )}
                {items.map((item) => (
                  <SelectItem key={`${item.type}-${item.id}`} value={item.id}>
                    {item.name} · {typeLabel[item.type] ?? item.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-slate-500">
            Guests can use this link to submit their booking details. Entries appear in your
            bookings as "Pending" until you confirm them.
          </p>

          <div className="flex gap-2">
            <Input value={bookingLink} readOnly placeholder="Select an item first" className="rounded-xl bg-slate-50 text-sm" />
            <Button onClick={copyToClipboard} variant="outline" className="rounded-xl px-3" disabled={!selected}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <Button
            onClick={shareLink}
            disabled={!selected}
            className="w-full bg-[#008080] hover:bg-[#006666] rounded-xl gap-2"
          >
            <Share2 className="h-4 w-4" />
            Share Link
          </Button>

          {/* Update / status line */}
          {lastUpdate && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-bold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {lastUpdate}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> Bookings submitted via this link will be marked as "Pending"
              and won't count against availability until you confirm them.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};