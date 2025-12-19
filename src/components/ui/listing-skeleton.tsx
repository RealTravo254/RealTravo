import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface ListingSkeletonProps {
  compact?: boolean;
  className?: string;
}

export function ListingSkeleton({ compact = false, className }: ListingSkeletonProps) {
  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300 border-slate-100 bg-white flex flex-col",
      "rounded-[24px]", // Matches ListingCard heavy rounding
      compact ? "h-auto" : "h-full",
      className
    )}>
      {/* Image Container Skeleton - Matches m-2 and 70% padding-bottom */}
      <div className="relative overflow-hidden m-2 rounded-[20px] bg-slate-100" style={{ paddingBottom: '70%' }}>
        <Skeleton className="absolute inset-0 w-full h-full rounded-[20px]" />
        
        {/* Floating Category Badge Placeholder */}
        <Skeleton className="absolute top-3 left-3 h-5 w-16 rounded-full" />

        {/* Heart Button Placeholder */}
        <div className="absolute top-3 right-3 z-20 h-9 w-9">
          <Skeleton className="h-full w-full rounded-full" />
        </div>
      </div>
      
      {/* Content Section - Matches p-5 */}
      <div className="p-5 flex flex-col flex-1"> 
        <div className="flex justify-between items-start mb-2">
          {/* Title Placeholder */}
          <div className="space-y-1.5 w-3/4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          {/* Rating Badge Placeholder */}
          <Skeleton className="h-6 w-10 rounded-lg" />
        </div>
        
        {/* Location Row */}
        <div className="flex items-center gap-1.5 mb-3">
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
            <Skeleton className="h-3 w-24" />
        </div>

        {/* Activities/Highlights Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          <Skeleton className="h-4 w-12 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-10 rounded-md" />
        </div>
        
        {/* Footer: Price & Date - Matches border-t and mt-auto */}
        <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
            <div className="flex flex-col gap-1.5">
                <Skeleton className="h-2 w-10" />
                <Skeleton className="h-5 w-24" />
            </div>

            <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-12" />
                </div>
                {/* Slots Left placeholder */}
                <Skeleton className="h-2 w-14" />
            </div>
        </div>
      </div>
    </Card>
  );
}

// Grid skeleton for displaying multiple loading cards
export function ListingGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cn(
      "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
      className
    )}>
      {[...Array(count)].map((_, i) => (
        <ListingSkeleton key={i} />
      ))}
    </div>
  );
}

// Horizontal scroll skeleton
export function HorizontalScrollSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[280px] md:w-[320px]">
          <ListingSkeleton />
        </div>
      ))}
    </div>
  );
}