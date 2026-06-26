import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { createDetailPath } from "@/lib/slugUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Eye, EyeOff, MapPin, ExternalLink, Search, ChevronLeft, ChevronRight,
  Loader2, Inbox, Mountain, Hotel as HotelIcon, Calendar,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const TEAL = "#008080";
const ITEMS_PER_PAGE = 10;

type ItemType = "trip" | "event" | "hotel" | "adventure_place";
type FilterType = "all" | ItemType;

interface ListingRow {
  id: string;
  name: string;
  location: string | null;
  place?: string | null;
  country?: string | null;
  image_url: string | null;
  is_hidden: boolean;
  itemType: ItemType;
  created_at?: string | null;
}

const TYPE_TABLE_MAP: Record<"trip_event" | "hotel" | "adventure_place", string> = {
  trip_event: "trips",
  hotel: "hotels",
  adventure_place: "adventure_places",
};

const TYPE_LABELS: Record<ItemType, string> = {
  trip: "Trip",
  event: "Event",
  hotel: "Hotel",
  adventure_place: "Adventure Place",
};

const TYPE_BADGE_COLORS: Record<ItemType, { bg: string; text: string }> = {
  trip: { bg: "#E6F7F7", text: "#006666" },
  event: { bg: "#FFF0EB", text: "#C24D1A" },
  hotel: { bg: "#F0F4FF", text: "#3A56C4" },
  adventure_place: { bg: "#EFFFF5", text: "#1A7A45" },
};

const TypeIcon = ({ type, className }: { type: ItemType; className?: string }) => {
  if (type === "hotel") return <HotelIcon className={className} />;
  if (type === "trip" || type === "event") return <Calendar className={className} />;
  return <Mountain className={className} />;
};

// ─── Filter Pill ──────────────────────────────────────────────────────────────
const FilterPill = ({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all ${
      active ? "text-white shadow-md" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
    }`}
    style={active ? { background: TEAL } : {}}
  >
    {children}
  </button>
);

// ─── Listing Row Card ─────────────────────────────────────────────────────────
const ListingCard = ({
  item, onToggleVisibility, isUpdating,
}: {
  item: ListingRow;
  onToggleVisibility: (item: ListingRow) => void;
  isUpdating: boolean;
}) => {
  const badge = TYPE_BADGE_COLORS[item.itemType];
  const detailHref = createDetailPath(item.itemType, item.id, item.name, item.location || "");

  return (
    <div
      className={`flex items-center gap-3 bg-white p-3 sm:p-4 rounded-2xl border transition-all ${
        item.is_hidden ? "border-red-100 bg-red-50/30" : "border-slate-100"
      }`}
    >
      <div className="h-16 w-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
        {item.image_url ? (
          <img src={item.image_url} className="h-full w-full object-cover" alt="" />
        ) : (
          <TypeIcon type={item.itemType} className="h-6 w-6 text-slate-300" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md"
            style={{ background: badge.bg, color: badge.text }}
          >
            {TYPE_LABELS[item.itemType]}
          </span>
          {item.is_hidden && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-red-100 text-red-600">
              Hidden
            </span>
          )}
        </div>
        <h3 className="text-sm sm:text-base font-bold text-slate-800 truncate">{item.name}</h3>
        <div className="flex items-center text-slate-400 text-xs mt-0.5">
          <MapPin size={10} className="mr-1 shrink-0" />
          <span className="truncate">
            {[item.location, item.place, item.country].filter(Boolean).join(", ") || "—"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <a
          href={detailHref}
          target="_blank"
          rel="noopener noreferrer"
          className="h-9 w-9 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all"
          aria-label="View listing"
        >
          <ExternalLink size={14} />
        </a>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isUpdating}
          onClick={() => onToggleVisibility(item)}
          className={`rounded-xl text-[11px] font-bold gap-1.5 h-9 ${
            item.is_hidden
              ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
              : "border-red-200 text-red-500 hover:bg-red-50"
          }`}
        >
          {isUpdating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : item.is_hidden ? (
            <Eye size={14} />
          ) : (
            <EyeOff size={14} />
          )}
          {item.is_hidden ? "Show" : "Hide"}
        </Button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminApproved = () => {
  const { toast } = useToast();

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Confirm-dialog state
  const [pendingItem, setPendingItem] = useState<ListingRow | null>(null);

  const fetchAllApproved = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
        supabase
          .from("trips")
          .select("id,name,location,place,country,image_url,is_hidden,type,created_at")
          .eq("approval_status", "approved")
          .order("created_at", { ascending: false }),
        supabase
          .from("hotels")
          .select("id,name,location,place,country,image_url,is_hidden,created_at")
          .eq("approval_status", "approved")
          .order("created_at", { ascending: false }),
        supabase
          .from("adventure_places")
          .select("id,name,location,place,country,image_url,is_hidden,created_at")
          .eq("approval_status", "approved")
          .order("created_at", { ascending: false }),
      ]);

      if (tripsRes.error) throw tripsRes.error;
      if (hotelsRes.error) throw hotelsRes.error;
      if (adventuresRes.error) throw adventuresRes.error;

      const trips: ListingRow[] = (tripsRes.data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        location: t.location,
        place: t.place,
        country: t.country,
        image_url: t.image_url,
        is_hidden: !!t.is_hidden,
        itemType: t.type === "event" ? "event" : "trip",
        created_at: t.created_at,
      }));

      const hotels: ListingRow[] = (hotelsRes.data || []).map((h: any) => ({
        id: h.id,
        name: h.name,
        location: h.location,
        place: h.place,
        country: h.country,
        image_url: h.image_url,
        is_hidden: !!h.is_hidden,
        itemType: "hotel",
        created_at: h.created_at,
      }));

      const adventures: ListingRow[] = (adventuresRes.data || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        location: a.location,
        place: a.place,
        country: a.country,
        image_url: a.image_url,
        is_hidden: !!a.is_hidden,
        itemType: "adventure_place",
        created_at: a.created_at,
      }));

      const merged = [...trips, ...hotels, ...adventures].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });

      setListings(merged);
    } catch (err: any) {
      toast({
        title: "Failed to load listings",
        description: err?.message ?? "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllApproved();
  }, [fetchAllApproved]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [filterType, searchQuery]);

  const tableForType = (itemType: ItemType): string => {
    if (itemType === "trip" || itemType === "event") return TYPE_TABLE_MAP.trip_event;
    if (itemType === "hotel") return TYPE_TABLE_MAP.hotel;
    return TYPE_TABLE_MAP.adventure_place;
  };

  const requestToggleVisibility = (item: ListingRow) => {
    setPendingItem(item);
  };

  const confirmToggleVisibility = async () => {
    if (!pendingItem) return;
    const item = pendingItem;
    const nextHidden = !item.is_hidden;

    setUpdatingId(item.id);
    setPendingItem(null);

    try {
      const table = tableForType(item.itemType);
      const { error } = await supabase
        .from(table)
        .update({ is_hidden: nextHidden })
        .eq("id", item.id);

      if (error) throw error;

      setListings((prev) =>
        prev.map((l) => (l.id === item.id && l.itemType === item.itemType ? { ...l, is_hidden: nextHidden } : l))
      );

      toast({
        title: nextHidden ? "Listing hidden" : "Listing visible again",
        description: nextHidden
          ? `"${item.name}" is now hidden from public view.`
          : `"${item.name}" is now visible to the public.`,
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message ?? "Could not update visibility.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = listings;
    if (filterType !== "all") {
      rows = rows.filter((l) => l.itemType === filterType);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((l) =>
        [l.name, l.location, l.place, l.country].filter(Boolean).join(" ").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [listings, filterType, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    (currentPage - 1) * ITEMS_PER_PAGE + ITEMS_PER_PAGE
  );

  const counts = useMemo(() => {
    return {
      all: listings.length,
      trip: listings.filter((l) => l.itemType === "trip").length,
      event: listings.filter((l) => l.itemType === "event").length,
      hotel: listings.filter((l) => l.itemType === "hotel").length,
      adventure_place: listings.filter((l) => l.itemType === "adventure_place").length,
      hidden: listings.filter((l) => l.is_hidden).length,
    };
  }, [listings]);

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 font-sans">
      <Header />

      <div className="container mx-auto px-4 py-8 lg:py-12">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Approved Listings</h1>
          <p className="text-muted-foreground text-sm">
            Manage visibility of all approved trips, events, hotels and adventure places.
            {counts.hidden > 0 && (
              <span className="ml-1 font-semibold text-red-500">
                {counts.hidden} currently hidden from the public.
              </span>
            )}
          </p>
        </header>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or location..."
                className="pl-9 h-11 rounded-xl border-slate-200"
              />
            </div>

            {/* Mobile: select dropdown for type */}
            <div className="sm:hidden">
              <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl">
                  <SelectItem value="all">All Types ({counts.all})</SelectItem>
                  <SelectItem value="trip">Trips ({counts.trip})</SelectItem>
                  <SelectItem value="event">Events ({counts.event})</SelectItem>
                  <SelectItem value="hotel">Hotels ({counts.hotel})</SelectItem>
                  <SelectItem value="adventure_place">Adventure Places ({counts.adventure_place})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Desktop: pill filters */}
          <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-0.5">
            <FilterPill active={filterType === "all"} onClick={() => setFilterType("all")}>
              All ({counts.all})
            </FilterPill>
            <FilterPill active={filterType === "trip"} onClick={() => setFilterType("trip")}>
              Trips ({counts.trip})
            </FilterPill>
            <FilterPill active={filterType === "event"} onClick={() => setFilterType("event")}>
              Events ({counts.event})
            </FilterPill>
            <FilterPill active={filterType === "hotel"} onClick={() => setFilterType("hotel")}>
              Hotels ({counts.hotel})
            </FilterPill>
            <FilterPill active={filterType === "adventure_place"} onClick={() => setFilterType("adventure_place")}>
              Adventure Places ({counts.adventure_place})
            </FilterPill>
          </div>
        </div>

        {/* List */}
        <main className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] w-full rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-[32px] p-16 text-center border border-slate-100">
              <Inbox className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold">
                {searchQuery || filterType !== "all" ? "No listings match your filters." : "No approved listings yet."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3">
                {pageItems.map((item) => (
                  <ListingCard
                    key={`${item.itemType}-${item.id}`}
                    item={item}
                    onToggleVisibility={requestToggleVisibility}
                    isUpdating={updatingId === item.id}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs font-semibold text-slate-400">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-xl h-9 w-9 p-0"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-bold text-slate-600 px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-xl h-9 w-9 p-0"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={!!pendingItem} onOpenChange={(open) => !open && setPendingItem(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingItem?.is_hidden ? "Show this listing?" : "Hide this listing?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingItem?.is_hidden ? (
                <>
                  <span className="font-semibold text-slate-700">"{pendingItem?.name}"</span> will become
                  visible to the public again on the site.
                </>
              ) : (
                <>
                  <span className="font-semibold text-slate-700">"{pendingItem?.name}"</span> will be hidden
                  from the public immediately. Users will no longer be able to find or view this listing,
                  but it will remain in the database and can be made visible again at any time.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleVisibility}
              className={`rounded-xl ${
                pendingItem?.is_hidden
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {pendingItem?.is_hidden ? "Show Listing" : "Hide Listing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default AdminApproved;