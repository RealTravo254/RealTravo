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
      "overflow-hidden border-slate-200 bg-slate-50 flex flex-col",
      "rounded-[24px]",
      compact ? "h-auto" : "h-full",
      className
    )}>
      {/* Image Container - Matches m-2 and rounded-[20px] with 70% aspect ratio */}
      <div className="relative overflow-hidden m-2 rounded-[20px] bg-slate-100" style={{ paddingBottom: '70%' }}>
        <Skeleton className="absolute inset-0 w-full h-full rounded-[20px]" />
        
        {/* Floating Category Badge - top-3 left-3 */}
        <Skeleton className="absolute top-3 left-3 h-4 w-16 rounded-sm" />

        {/* Heart Button - top-3 right-3 */}
        <div className="absolute top-3 right-3 z-20">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      
      {/* Content Section - Matches p-5 */}
      <div className="p-5 flex flex-col flex-1"> 
        {/* Title + Rating row */}
        <div className="flex justify-between items-start mb-2">
          <div className="space-y-1 w-3/4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          {/* Rating Badge */}
          <Skeleton className="h-6 w-12 rounded-lg" />
        </div>
        
        {/* Location Row with MapPin icon */}
        <div className="flex items-center gap-1.5 mb-3">
          <Skeleton className="h-3.5 w-3.5 rounded-full flex-shrink-0" />
          <Skeleton className="h-2.5 w-28" />
        </div>

        {/* Activities/Tags - matches gap-1 mb-4 */}
        <div className="flex flex-wrap gap-1 mb-4">
          <Skeleton className="h-4 w-14 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-12 rounded-md" />
        </div>
        
        {/* Footer: Price & Date - matches border-t border-slate-50 mt-auto pt-4 */}
        <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-2 w-12" />
            <Skeleton className="h-5 w-20" />
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-2.5 w-14" />
            </div>
            <Skeleton className="h-2 w-20" />
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
      <Skeleton className="w-full h-[40vh] md:h-[50vh]" />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Title and rating */}
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-3/4" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        
        {/* Description */}
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        
        {/* Activities section */}
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-18 rounded-full" />
            <Skeleton className="h-8 w-22 rounded-full" />
          </div>
        </div>
        
        {/* Booking section */}
        <div className="space-y-4 p-6 rounded-2xl border border-slate-100 bg-white">
          <Skeleton className="h-6 w-40" />
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-28" />
            </div>
            <Skeleton className="h-12 w-32 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}