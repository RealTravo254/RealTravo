// src/components/ListingGrid.tsx
// Shared by Index, Explore, CountryListings, DivisionListings (and any other
// page that shows ListingCards), so they all stay in sync.

// The card is always stacked (image on top, details below).
//   < sm : 1 column
//   sm   : 2 columns
//   lg   : 4 columns (big screens)
export const LISTING_GRID_CLASSES =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-stretch";

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
  </div>
);