import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ListingSkeletonProps {
  compact?: boolean;
  className?: string;
}

export function ListingSkeleton({ compact = false, className }: ListingSkeletonProps) {
  return (
    <div className={cn(
      "overflow-hidden bg-card shadow-sm w-full flex flex-col rounded-none border",
      className
    )}>
      {/* Image skeleton with exact aspect ratio matching ListingCard (75% = 4:3) */}
      <div className="relative overflow-hidden bg-muted" style={{ paddingBottom: '75%' }}>
        <Skeleton className="absolute inset-0 w-full h-full" />
        {/* Badge placeholder */}
        <div className="absolute top-1.5 left-1.5 z-10">
          <Skeleton className="h-4 w-12 md:h-5 md:w-14 rounded" />
        </div>
        {/* Heart button placeholder */}
        <div className="absolute top-1.5 right-1.5 z-10">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      
      {/* Content skeleton matching ListingCard layout */}
      <div className="p-2 md:p-4 flex flex-col space-y-1.5 flex-1">
        {/* Title skeleton - uppercase style */}
        <Skeleton className="h-3.5 md:h-5 w-4/5" />
        
        {/* Star rating row skeleton */}
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3 md:h-3.5 md:w-3.5 rounded-full" />
          <Skeleton className="h-2.5 md:h-3 w-6" />
          <Skeleton className="h-2 md:h-2.5 w-14" />
        </div>
        
        {/* Location row skeleton */}
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3 rounded-full flex-shrink-0" />
          <Skeleton className="h-2.5 md:h-3.5 w-2/3" />
        </div>
        
        {/* Price/Date row skeleton */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/50 mt-auto">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 md:h-4 w-16 md:w-20" />
            <Skeleton className="h-2.5 md:h-3.5 w-14 md:w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Grid skeleton for displaying multiple loading cards
export function ListingGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn(
      "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5",
      className
    )}>
      {[...Array(count)].map((_, i) => (
        <ListingSkeleton key={i} />
      ))}
    </div>
  );
}

// Horizontal scroll skeleton for featured sections
export function HorizontalScrollSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:gap-4 pl-1 pr-8 md:pl-2 md:pr-12">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[45vw] md:w-56">
          <ListingSkeleton />
        </div>
      ))}
    </div>
  );
}
