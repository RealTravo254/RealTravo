// src/components/ListingGrid.tsx
// Shared by Index, Explore, CountryListings, DivisionListings (and any other
// page that shows ListingCards), so they all stay in sync.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The card is always stacked (image on top, details below).
//   < sm : 1 column
//   sm   : 2 columns
//   lg   : 4 columns (big screens)
export const LISTING_GRID_CLASSES =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-stretch";

// Design tokens (kept in sync with ListingCard)
const HAIRLINE = "#DCE3DC";
const SKELETON = "#EAF0EA";

// Loading skeleton that matches the stacked ListingCard
export const RectSkeleton = () => (
  <div
    className="flex flex-col w-full h-full rounded-2xl overflow-hidden bg-white shadow-sm animate-pulse"
    style={{ border: `1px solid ${HAIRLINE}` }}
    aria-hidden="true"
  >
    {/* Image */}
    <div className="w-full aspect-[2/1]" style={{ background: SKELETON }} />

    {/* Details */}
    <div className="p-3 flex flex-col gap-2.5 flex-1">
      <div className="h-5 w-3/4 rounded" style={{ background: SKELETON }} />
      <div className="h-3 w-1/2 rounded" style={{ background: SKELETON }} />
      <div className="h-3 w-2/3 rounded" style={{ background: SKELETON }} />
      <div className="h-3 w-full rounded" style={{ background: SKELETON }} />

      {/* Footer: price + view link */}
      <div
        className="mt-auto pt-2.5 flex items-center justify-between"
        style={{ borderTop: `1px solid ${HAIRLINE}` }}
      >
        <div className="h-4 w-20 rounded" style={{ background: SKELETON }} />
        <div className="h-3 w-16 rounded" style={{ background: SKELETON }} />
      </div>
    </div>
  </div>
);

interface ListingGridProps {
  children?: ReactNode;
  /** Show skeleton placeholders instead of children. */
  loading?: boolean;
  /** How many skeletons to show while loading. */
  skeletonCount?: number;
  className?: string;
}

// Convenience wrapper: <ListingGrid loading={loading}>{cards}</ListingGrid>
export const ListingGrid = ({
  children,
  loading = false,
  skeletonCount = 8,
  className,
}: ListingGridProps) => (
  <div className={cn(LISTING_GRID_CLASSES, className)}>
    {loading
      ? Array.from({ length: skeletonCount }).map((_, i) => (
          <RectSkeleton key={i} />
        ))
      : children}
  </div>
);

export default ListingGrid;