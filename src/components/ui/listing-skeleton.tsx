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
      "group overflow-hidden border-slate-100 bg-white flex flex-col",
      "rounded-[24px]", 
      compact ? "h-auto" : "h-full",
      className
    )}>
      {/* 1:1 Image Container Mockup */}
      <div className="relative m-2 rounded-[20px] bg-slate-50 overflow-hidden" style={{ paddingBottom: '70%' }}>
        <Skeleton className="absolute inset-0 w-full h-full rounded-[20px]" />
        
        {/* Category Badge Mockup */}
        <Skeleton className="absolute top-3 left-3 h-4 w-20 rounded-md opacity-70" />

        {/* Heart Button Mockup */}
        <div className="absolute top-3 right-3 h-8 w-8">
          <Skeleton className="h-full w-full rounded-full opacity-50" />
        </div>
      </div>
      
      {/* Content Section - Precision Spacing */}
      <div className="p-5 flex flex-col flex-1"> 
        <div className="flex justify-between items-start mb-2.5">
          {/* Title Lines */}
          <div className="space-y-2 w-full">
            <Skeleton className="h-5 w-[85%]" />
            <Skeleton className="h-5 w-[40%]" />
          </div>
          {/* Rating Box */}
          <Skeleton className="h-6 w-12 rounded-lg shrink-0 ml-2" />
        </div>
        
        {/* Location Row */}
        <div className="flex items-center gap-1.5 mb-4">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-32" />
        </div>

        {/* Activity Pills */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        
        {/* Footer Area */}
        <div className="mt-auto pt-4 border-t border-slate-50 flex items-end justify-between">
            <div className="space-y-2">
                <Skeleton className="h-2 w-12" /> {/* "Starts at" text */}
                <Skeleton className="h-6 w-28" /> {/* Price */}
            </div>

            <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-16" />
                </div>
                {/* Slots Availability Tag */}
                <Skeleton className="h-2.5 w-20 rounded-sm" />
            </div>
        </div>
      </div>
    </Card>
  );
}