import { ShareableBookingLink } from "@/components/host/ShareableBookingLink";
import { ManualBookingDialog } from "@/components/host/ManualBookingDialog";
import { ListingAnalyticsDialog } from "@/components/host/ListingAnalyticsDialog";
import type { ListingItem } from "@/components/ListingGrid";

/** Payment & earnings page */
export const PAYMENT_URL = "https://www.realtravo.com/payment";

// Trigger styles so the dialog buttons look like the other nav items
export const TOOL_ROW =
  "w-full justify-start gap-3 h-auto px-4 py-3 rounded-xl border-0 bg-transparent " +
  "text-slate-600 text-[13px] font-semibold shadow-none hover:bg-slate-50 hover:text-slate-800";

export const TOOL_PILL =
  "w-auto h-auto gap-1.5 px-3.5 py-2 rounded-full border border-slate-200 bg-white " +
  "text-slate-600 text-[12px] font-semibold whitespace-nowrap shadow-none hover:bg-slate-50 hover:text-slate-800";

interface HostToolsProps {
  items: ListingItem[];
  /** "row" = desktop sidebar, "pill" = mobile scroll bar */
  variant?: "row" | "pill";
  onBookingCreated?: () => void;
}

/** Analytics, Share booking form and Manual booking – each with a listing dropdown */
export const HostTools = ({ items, variant = "row", onBookingCreated }: HostToolsProps) => {
  const cls = variant === "row" ? TOOL_ROW : TOOL_PILL;
  return (
    <>
      <ListingAnalyticsDialog items={items} triggerClassName={cls} label="Analytics" />
      <ShareableBookingLink items={items} triggerClassName={cls} label="Share booking form" />
      <ManualBookingDialog
        items={items}
        triggerClassName={cls}
        label="Manual booking"
        onBookingCreated={onBookingCreated}
      />
    </>
  );
};