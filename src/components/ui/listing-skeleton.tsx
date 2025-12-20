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
      "overflow-hidden border-slate-100 bg-white flex flex-col",
      "rounded-[24px]",
      compact ? "h-auto" : "h-full min-h-[380px]",
      className
    )}>
      {/* Image Container Skeleton - Matches m-2 and 70% padding-bottom */}
      <div className="relative overflow-hidden m-2 rounded-[20px] bg-slate-100" style={{ paddingBottom: '70%' }}>
        <Skeleton className="absolute inset-0 w-full h-full rounded-[20px]" />
        
        {/* Floating Category Badge Placeholder */}
        <Skeleton className="absolute top-3 left-3 h-4 w-14 rounded-full" />

        {/* Distance Badge Placeholder - Bottom Right */}
        <Skeleton className="absolute bottom-3 right-3 h-5 w-12 rounded-full" />

        {/* Heart Button Placeholder */}
        <div className="absolute top-3 right-3 z-20 h-8 w-8">
          <Skeleton className="h-full w-full rounded-full" />
        </div>
      </div>
      
      {/* Content Section - Matches p-5 */}
      <div className="p-5 flex flex-col flex-1"> 
        <div className="flex justify-between items-start mb-2">
          {/* Title Placeholder - uppercase style */}
          <div className="space-y-1.5 w-3/4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          {/* Rating Badge Placeholder */}
          <Skeleton className="h-6 w-12 rounded-lg" />
        </div>
        
        {/* Location Row with icon */}
        <div className="flex items-center gap-1.5 mb-3">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Activities/Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          <Skeleton className="h-4 w-12 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-14 rounded-md" />
        </div>
        
        {/* Footer: Price & Date - Matches border-t and mt-auto */}
        <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-2 w-12" />
            <Skeleton className="h-5 w-20" />
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 w-14" />
            </div>
            {/* Slots Left placeholder */}
            <Skeleton className="h-2 w-16" />
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

// Horizontal scroll skeleton
export const HorizontalScrollSkeleton = memo(({ count = 5 }: { count?: number }) => {
  return (
    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide pl-1 pr-8 md:pl-2 md:pr-12">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[45vw] md:w-56">
          <ListingSkeleton />
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