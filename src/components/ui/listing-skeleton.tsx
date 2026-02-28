import { memo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface ListingSkeletonProps {
  compact?: boolean;
  className?: string;
}

const ListingSkeletonComponent = ({ compact = false, className }: ListingSkeletonProps) => {
  return (
    <Card className={cn(
      "relative flex flex-col overflow-hidden rounded-[32px] border border-border bg-card shadow-sm",
      compact ? "h-auto" : "h-full",
      className
    )}>
      {/* Image Container - matches ListingCard 4/3 ratio */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />

        {/* Category Badge */}
        <Skeleton className="absolute top-4 left-4 h-6 w-24 rounded-full" />

        {/* Heart Button */}
        <Skeleton className="absolute top-4 right-4 h-10 w-10 rounded-full" />
      </div>

      {/* Content Section - matches ListingCard p-6 */}
      <div className="flex flex-1 flex-col p-6">
        {/* Title + subtitle */}
        <div className="space-y-2">
          <Skeleton className="h-6 w-11/12 rounded-md" />
          <Skeleton className="h-6 w-8/12 rounded-md" />
        </div>

        {/* Location Row */}
        <div className="mt-3 flex items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5 rounded-sm flex-shrink-0" />
          <Skeleton className="h-3 w-36 rounded-sm" />
        </div>

        {/* Tags */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16 rounded-lg" />
          <Skeleton className="h-6 w-20 rounded-lg" />
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-end justify-between border-t border-border pt-5">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-16 rounded-sm" />
            <Skeleton className="h-7 w-28 rounded-sm" />
          </div>

          <div className="space-y-2 text-right">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-sm" />
          </div>
        </div>
      </div>
    </Card>
  );
};

// Memoize to prevent unnecessary re-renders
export const ListingSkeleton = memo(ListingSkeletonComponent);

// Grid skeleton for displaying multiple loading cards - matches listing grid layout
export const ListingGridSkeleton = memo(({ count = 8, className }: { count?: number; className?: string }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <ListingSkeleton key={i} />
      ))}
    </>
  );
});

// Horizontal scroll skeleton - matches the horizontal scroll containers
export const HorizontalScrollSkeleton = memo(({ count = 5 }: { count?: number }) => {
  return (
    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide pl-1 pr-8 md:pl-2 md:pr-12">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[45vw] md:w-56">
          <ListingSkeleton compact />
        </div>
      ))}
    </div>
  );
});

// Page detail skeleton
export function DetailPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero image skeleton */}
      <Skeleton className="w-full h-[40vh] md:h-[50vh] rounded-none" />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Title and rating */}
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-3/4 rounded-none" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-none" />
              <Skeleton className="h-4 w-32 rounded-none" />
            </div>
          </div>
          <Skeleton className="h-10 w-24 rounded-none" />
        </div>
        
        {/* Quick navigation shortcuts (mobile) */}
        <div className="flex gap-3 md:hidden">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
        
        {/* Description */}
        <div className="space-y-3 p-6 rounded-3xl border border-slate-100 bg-white">
          <Skeleton className="h-4 w-24 rounded-none" />
          <Skeleton className="h-4 w-full rounded-none" />
          <Skeleton className="h-4 w-full rounded-none" />
          <Skeleton className="h-4 w-3/4 rounded-none" />
        </div>
        
        {/* Operating hours (mobile) */}
        <div className="md:hidden space-y-3 p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-24 rounded-none" />
            <Skeleton className="h-3 w-32 rounded-none" />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Skeleton className="h-4 w-16 rounded-none" />
            <Skeleton className="h-4 w-20 rounded-none" />
            <Skeleton className="h-4 w-16 rounded-none" />
          </div>
        </div>
        
        {/* Amenities section */}
        <div className="space-y-3 p-6 rounded-3xl border border-slate-100 bg-white">
          <Skeleton className="h-5 w-24 rounded-none" />
          <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
            <Skeleton className="h-4 w-full rounded-none" />
            <Skeleton className="h-4 w-full rounded-none" />
            <Skeleton className="h-4 w-3/4 rounded-none" />
            <Skeleton className="h-4 w-2/3 rounded-none" />
          </div>
        </div>
        
        {/* Facilities section */}
        <div className="space-y-3 p-6 rounded-3xl border border-slate-100 bg-white">
          <Skeleton className="h-6 w-32 rounded-none" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-24 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-20 rounded-xl" />
          </div>
        </div>
        
        {/* Booking section */}
        <div className="space-y-4 p-6 rounded-[32px] border border-slate-100 bg-white shadow-xl">
          <Skeleton className="h-6 w-24 rounded-none" />
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <Skeleton className="h-3 w-16 rounded-none" />
              <Skeleton className="h-8 w-32 rounded-none" />
            </div>
            <div className="text-right">
              <Skeleton className="h-6 w-16 rounded-none" />
              <Skeleton className="h-3 w-20 rounded-none" />
            </div>
          </div>
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
