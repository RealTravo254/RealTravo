import { useNavigate } from "react-router-dom";
import { Compass, Building2, Home, TreePine, Tent, Landmark, Map, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Shared category tab list ──────────────────────────────────────────────
// Mirrors the categories shown on the Index page (CATEGORIES / QUICK_NAV)
// so every listing page (Explore, CategoryDetail, CountyDetail) offers the
// exact same set of categories to jump between: Hotels, Accommodations,
// Campsites — plus an "All" entry. (Parks, Attraction, Tours/Guided, and
// Trips are all commented out — trip/tour fetching is disabled site-wide,
// so there's nothing to show at /category/guided or /category/trips.)
export interface CategoryTabItem {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

export const CATEGORY_TABS: CategoryTabItem[] = [
  { key: "all",            label: "All",            icon: Compass,    path: "/explore" },
  { key: "hotels",         label: "Hotels",         icon: Building2,  path: "/category/hotels" },
  { key: "accommodations", label: "Accommodations", icon: Home,       path: "/category/accommodations" },
  /* { key: "parks",          label: "Parks",          icon: TreePine,   path: "/category/parks" },
  { key: "attraction",     label: "Attraction",     icon: Landmark,   path: "/category/attraction" },
  */
  { key: "campsite",       label: "Campsites",      icon: Tent,       path: "/category/campsite" },
  /*
  { key: "guided",         label: "Tours",          icon: Map,        path: "/category/guided" },
  { key: "trips",          label: "Trips",          icon: Calendar,   path: "/category/trips" },
  */
];

interface CategoryTabsBarProps {
  /** key of CATEGORY_TABS that should render as active */
  activeKey: string;
  /**
   * If provided, tapping a tab calls this instead of navigating — useful
   * for pages that want to filter in-place rather than route to a new
   * category page (e.g. CountyDetail / Explore).
   */
  onSelect?: (key: string) => void;
  className?: string;
}

// Sideways-scrolling, no-wrap row of category pills. Meant to be rendered
// directly underneath (but visually separate from / "outside") the sticky
// teal search header, while still staying fixed in place as the page
// scrolls — see usage in CategoryDetail / CountyDetail / Explore, where
// this component is placed inside the same outer `sticky top-0` wrapper as
// the header, just in its own bar with a different background.
export const CategoryTabsBar = ({ activeKey, onSelect, className }: CategoryTabsBarProps) => {
  const navigate = useNavigate();

  return (
    <div className={cn("bg-background border-t border-border/60", className)}>
      <div className="container mx-auto px-4 py-2.5">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeKey === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => (onSelect ? onSelect(tab.key) : navigate(tab.path))}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shrink-0 border",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};