// src/components/ListingGrid.tsx
// Shared by Index, Explore, CountryListings, DivisionListings (and any other
// page that shows ListingCards), so they all stay in sync.

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, MessageSquare, BarChart3, Wallet } from "lucide-react";
import { ShareableBookingLink } from "@/components/host/ShareableBookingLink";
import { ManualBookingDialog } from "@/components/host/ManualBookingDialog";

// The card is always stacked (image on top, details below).
//   < sm : 1 column
//   sm   : 2 columns
//   lg   : 4 columns (big screens)
export const LISTING_GRID_CLASSES =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-stretch";

// Payment & Earnings page
export const PAYMENT_URL = "https://www.realtravo.com/payment";

// Loading skeleton that matches the stacked ListingCard
export const RectSkeleton = () => (
  <div className="flex flex-col w-full rounded-2xl overflow-hidden border border-border bg-card animate-pulse">
    <div className="w-full aspect-[2/1] bg-muted" />
    <div className="p-3 space-y-3">
      <div className="h-5 w-3/4 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
      <div className="h-3 w-2/3 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
    </div>
    {/* action bar skeleton */}
    <div className="px-3 pb-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="h-8 rounded-xl bg-muted" />
        <div className="h-8 rounded-xl bg-muted" />
        <div className="h-8 rounded-xl bg-muted" />
        <div className="h-8 rounded-xl bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-8 rounded-xl bg-muted" />
        <div className="h-8 rounded-xl bg-muted" />
      </div>
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Shared item shape – every listing you want to share / book manually        */
/* -------------------------------------------------------------------------- */

export type ListingItemType =
  | "trip"
  | "event"
  | "hotel"
  | "adventure"
  | "adventure_place";

export interface ListingItem {
  id: string;
  type: ListingItemType;
  name: string;
  totalCapacity: number;
  facilities?: Array<{ name: string; price: number }>;
  activities?: Array<{ name: string; price: number }>;
  tripDate?: string | null;
  isFlexibleDate?: boolean;
}

interface ListingCardActionsProps {
  /** The listing this card represents (pre-selected in the dropdowns) */
  item: ListingItem;
  /** All listings the user can pick from in the share / manual dialogs */
  allItems: ListingItem[];
  /** Profile route. Defaults to /profile */
  profilePath?: string;
  /** Unread message count – shows a badge on the Messages button */
  unreadMessages?: number;
  /** Called after a manual entry is saved so the page can refresh */
  onBookingCreated?: () => void;
}

/**
 * Action bar to render directly under a ListingCard.
 *
 *   <ListingCardActions item={item} allItems={items} />
 *
 * Row 1: Profile | Messages
 * Row 2: Payment & Earnings | Analytics
 * Row 3: Share Form (dropdown) | Manual Booking (dropdown)
 */
export const ListingCardActions = ({
  item,
  allItems,
  profilePath = "/profile",
  unreadMessages = 0,
  onBookingCreated,
}: ListingCardActionsProps) => {
  const navigate = useNavigate();

  return (
    <div className="px-3 pb-3 pt-1 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 text-xs"
          onClick={() => navigate(profilePath)}
        >
          <User className="h-4 w-4" />
          Profile
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 text-xs relative"
          onClick={() => navigate(`/messages?item=${item.id}`)}
        >
          <MessageSquare className="h-4 w-4" />
          Messages
          {unreadMessages > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-[#FF7F50] hover:bg-[#FF7F50] text-[10px]">
              {unreadMessages > 99 ? "99+" : unreadMessages}
            </Badge>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 text-xs"
          onClick={() => window.location.assign(PAYMENT_URL)}
        >
          <Wallet className="h-4 w-4" />
          Payment
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 text-xs"
          onClick={() => navigate(`/analytics/${item.type}/${item.id}`)}
        >
          <BarChart3 className="h-4 w-4" />
          Analytics
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ShareableBookingLink
          items={allItems}
          defaultItemId={item.id}
          triggerClassName="w-full"
        />
        <ManualBookingDialog
          items={allItems}
          defaultItemId={item.id}
          triggerClassName="w-full"
          onBookingCreated={onBookingCreated}
        />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Optional: a toolbar for the top of the grid (not tied to one card)         */
/* -------------------------------------------------------------------------- */

interface ListingGridToolbarProps {
  items: ListingItem[];
  profilePath?: string;
  unreadMessages?: number;
  onBookingCreated?: () => void;
}

export const ListingGridToolbar = ({
  items,
  profilePath = "/profile",
  unreadMessages = 0,
  onBookingCreated,
}: ListingGridToolbarProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => navigate(profilePath)}>
        <User className="h-4 w-4" /> Profile
      </Button>
      <Button variant="outline" size="sm" className="rounded-xl gap-2 relative" onClick={() => navigate("/messages")}>
        <MessageSquare className="h-4 w-4" /> Messages
        {unreadMessages > 0 && (
          <Badge className="ml-1 h-5 min-w-5 px-1 rounded-full bg-[#FF7F50] hover:bg-[#FF7F50] text-[10px]">
            {unreadMessages}
          </Badge>
        )}
      </Button>
      <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => window.location.assign(PAYMENT_URL)}>
        <Wallet className="h-4 w-4" /> Payment & Earnings
      </Button>
      <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => navigate("/analytics")}>
        <BarChart3 className="h-4 w-4" /> Analytics
      </Button>
      <ShareableBookingLink items={items} />
      <ManualBookingDialog items={items} onBookingCreated={onBookingCreated} />
    </div>
  );
};