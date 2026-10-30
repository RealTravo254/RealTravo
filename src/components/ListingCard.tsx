// src/components/ListingGrid.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const LISTING_GRID_CLASSES =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-stretch";

const HAIRLINE = "#DCE3DC";
const SKELETON = "#EAF0EA";

export const RectSkeleton = () => (
  <div
    className="flex flex-col w-full h-full rounded-2xl overflow-hidden bg-white shadow-sm animate-pulse"
    style={{ border: `1px solid ${HAIRLINE}` }}
    aria-hidden="true"
  >
    <div className="w-full aspect-[2/1]" style={{ background: SKELETON }} />
    <div className="p-3 flex flex-col gap-2.5 flex-1">
      <div className="h-5 w-3/4 rounded" style={{ background: SKELETON }} />
      <div className="h-3 w-1/2 rounded" style={{ background: SKELETON }} />
      <div className="h-3 w-2/3 rounded" style={{ background: SKELETON }} />
      <div className="h-3 w-full rounded" style={{ background: SKELETON }} />
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
  loading?: boolean;
  skeletonCount?: number;
  className?: string;
}

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