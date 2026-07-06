import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  Loader2, Inbox, Mountain, Calendar,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const TEAL = "#008080";
const ITEMS_PER_PAGE = 10;

type ItemType = "trip" | "adventure_place";
type FilterType = "all" | ItemType;

// The exact Supabase table-name literal union that supabase.from() accepts
// for these two tables. Keeping this as a literal union (not `string`) is
// what makes `supabase.from(table)` type-check correctly everywhere below.
type SupabaseTable = "trips" | "adventure_places";

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

const TYPE_TABLE_MAP: Record<ItemType, SupabaseTable> = {
  trip: "trips",
  adventure_place: "adventure_places",
};

// Maps our internal itemType to the URL segment used by /admin/review/:itemType/:id
// AdminReviewDetail accepts "adventure" (and "adventure_place") for adventures,
// and PendingApprovalItems.tsx already navigates using "adventure" — so we
// match that here to keep links consistent, e.g. /admin/review/adventure/<id>
const NAV_TYPE_MAP: Record<ItemType, string> = {
  trip: "trip",
  adventure_place: "adventure",
};

const TYPE_LABELS: Record<ItemType, string> = {
  trip: "Trip",
  adventure_place: "Adventure Place",
};

const TYPE_BADGE_COLORS: Record<ItemType, { bg: string; text: string }> = {
  trip: { bg: "#E6F7F7", text: "#006666" },
  adventure_place: { bg: "#EFFFF5", text: "#1A7A45" },
};

const TypeIcon = ({ type, className }: { type: ItemType; className?: string }) => {
  if (type === "trip") return <Calendar className={className} />;
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
  item, onToggleVisibility, isUpdating, onOpenReview,
}: {
  item: ListingRow;
  onToggleVisibility: (item: ListingRow) => void;
  isUpdating: boolean;
  onOpenReview: (item: ListingRow) => void;
}) => {
  const badge = TYPE_BADGE_COLORS[item.itemType];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenReview(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenReview(item);
        }
      }}
      className={`flex items-center gap-3 bg-white p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md hover:border-slate-200 ${
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
        {/* "View live" now opens the ADMIN REVIEW page, e.g. /admin/review/adventure/<id> */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenReview(item);
          }}
          className="h-9 w-9 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all"
          aria-label="Open admin review page"
          title="Open admin review page"
        >
          <ExternalLink size={14} />
        </button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isUpdating}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(item);
          }}
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
  const navigate = useNavigate();

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Confirm-dialog state
  const [pendingItem, setPendingItem] = useState<ListingRow | null>(null);

  const [rlsSuspected, setRlsSuspected] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ tripsCount: number; adventuresCount: number } | null>(null);

  // Navigate to the same admin review/approve page used for pending items.
  // AdminReviewDetail reads useParams() as { itemType, id }, and itemType
  // must be one of "trip" | "event" | "hotel" | "adventure" | "adventure_place".
  // We translate our ListingRow.itemType ("trip" | "adventure_place") into the
  // URL segment via NAV_TYPE_MAP so adventure links look like
  // /admin/review/adventure/<id> — matching the rest of the admin flow.
  const onOpenReview = useCallback((item: ListingRow) => {
    navigate(`/admin/review/${NAV_TYPE_MAP[item.itemType]}/${item.id}`);
  }, [navigate]);

  const fetchAllApproved = useCallback(async () => {
    setIsLoading(true);
    setRlsSuspected(false);
    try {
      const [tripsRes, adventuresRes] = await Promise.all([
        supabase
          .from("trips")
          .select("id,name,location,place,country,image_url,is_hidden,type,approval_status,created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("adventure_places")
          .select("id,name,location,place,country,image_url,is_hidden,approval_status,created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (tripsRes.error) throw tripsRes.error;
      if (adventuresRes.error) throw adventuresRes.error;

      const isApproved = (status: unknown) =>
        typeof status === "string" && status.trim().toLowerCase() === "approved";

      const tripsRaw = tripsRes.data || [];
      const adventuresRaw = adventuresRes.data || [];
      setDebugInfo({ tripsCount: tripsRaw.length, adventuresCount: adventuresRaw.length });

      console.log("[AdminApproved] trips fetched:", tripsRaw.length, "approved:", tripsRaw.filter((t: any) => isApproved(t.approval_status)).length);
      console.log("[AdminApproved] adventure_places fetched:", adventuresRaw.length, "approved:", adventuresRaw.filter((a: any) => isApproved(a.approval_status)).length);
      if (tripsRaw.length > 0) console.log("[AdminApproved] sample trip approval_status value:", JSON.stringify(tripsRaw[0].approval_status));
      if (adventuresRaw.length > 0) console.log("[AdminApproved] sample adventure_place approval_status value:", JSON.stringify(adventuresRaw[0].approval_status));

      if (tripsRaw.length === 0 && adventuresRaw.length === 0) {
        setRlsSuspected(true);
        console.warn(
          "[AdminApproved] Both tables returned 0 rows with no error. " +
          "This usually means Row Level Security is blocking this user/session " +
          "from reading rows it didn't create. Check your RLS policies on " +
          "'trips' and 'adventure_places' for SELECT — an admin needs a policy " +
          "that doesn't restrict to created_by = auth.uid()."
        );
      }

      const trips: ListingRow[] = tripsRaw
        .filter((t: any) => isApproved(t.approval_status) && t.type !== "event")
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          location: t.location,
          place: t.place,
          country: t.country,
          image_url: t.image_url,
          is_hidden: !!t.is_hidden,
          itemType: "trip" as const,
          created_at: t.created_at,
        }));

      const adventures: ListingRow[] = adventuresRaw
        .filter((a: any) => isApproved(a.approval_status))
        .map((a: any) => ({
          id: a.id,
          name: a.name,
          location: a.location,
          place: a.place,
          country: a.country,
          image_url: a.image_url,
          is_hidden: !!a.is_hidden,
          itemType: "adventure_place" as const,
          created_at: a.created_at,
        }));

      const merged = [...trips, ...adventures].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });

      setListings(merged);

      if (merged.length === 0 && (tripsRaw.length > 0 || adventuresRaw.length > 0)) {
        toast({
          title: "No approved items matched",
          description:
            "Rows exist in your tables, but none matched approval_status === \"approved\". Check the browser console for the exact stored value.",
          variant: "destructive",
        });
      }
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

  useEffect(() => {
    setPage(1);
  }, [filterType, searchQuery]);

  // Return type is the literal Supabase table-name union (not `string`),
  // so `supabase.from(table)` type-checks against the generated overloads.
  const tableForType = (itemType: ItemType): SupabaseTable => TYPE_TABLE_MAP[itemType];

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
            Manage visibility of all approved trips and adventure places.
            {counts.hidden > 0 && (
              <span className="ml-1 font-semibold text-red-500">
                {counts.hidden} currently hidden from the public.
              </span>
            )}
          </p>
        </header>

        {rlsSuspected && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5">
            <p className="text-sm font-bold text-amber-800 mb-1">
              No rows came back from either table — this usually means Row Level Security (RLS) is blocking access.
            </p>
            <p className="text-xs text-amber-700 leading-relaxed mb-3">
              Your <code className="bg-amber-100 px-1 rounded">approval_status</code> column is required (not nullable)
              with a default of <code className="bg-amber-100 px-1 rounded">'pending'</code>, so rows almost certainly
              exist — Supabase just isn't allowed to return them to this logged-in user. The most common cause is a
              SELECT policy like <code className="bg-amber-100 px-1 rounded">created_by = auth.uid()</code>, which lets
              hosts see only their own listings and hides everyone else's from an admin viewing this page.
            </p>
            <p className="text-xs text-amber-700 leading-relaxed mb-2 font-semibold">
              Fix: in Supabase → Authentication → Policies, add (or update) a SELECT policy on both tables so admins
              can read all rows, e.g.:
            </p>
            <pre className="bg-amber-100/80 text-amber-900 text-[11px] rounded-xl p-3 overflow-x-auto">
{`-- Run in Supabase SQL editor (adjust the admin check to match your schema)
create policy "Admins can view all trips"
  on public.trips for select
  using (
    auth.uid() in (select id from public.profiles where is_admin = true)
  );

create policy "Admins can view all adventure places"
  on public.adventure_places for select
  using (
    auth.uid() in (select id from public.profiles where is_admin = true)
  );`}
            </pre>
            <p className="text-[11px] text-amber-600 mt-2">
              Replace the <code className="bg-amber-100 px-1 rounded">is_admin</code> check with whatever column/table
              you already use to mark admin users. Also check the browser console for the exact diagnostic log.
            </p>
          </div>
        )}

        {!rlsSuspected && debugInfo && (debugInfo.tripsCount > 0 || debugInfo.adventuresCount > 0) && listings.length === 0 && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-amber-800">
              Fetched {debugInfo.tripsCount} trip row(s) and {debugInfo.adventuresCount} adventure place row(s), but
              none had <code className="bg-amber-100 px-1 rounded">approval_status === "approved"</code>.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Open the browser console to see the exact stored value for <code className="bg-amber-100 px-1 rounded">approval_status</code> on a sample row.
            </p>
          </div>
        )}

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

            <div className="sm:hidden">
              <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl">
                  <SelectItem value="all">All Types ({counts.all})</SelectItem>
                  <SelectItem value="trip">Trips ({counts.trip})</SelectItem>
                  <SelectItem value="adventure_place">Adventure Places ({counts.adventure_place})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-0.5">
            <FilterPill active={filterType === "all"} onClick={() => setFilterType("all")}>
              All ({counts.all})
            </FilterPill>
            <FilterPill active={filterType === "trip"} onClick={() => setFilterType("trip")}>
              Trips ({counts.trip})
            </FilterPill>
            <FilterPill active={filterType === "adventure_place"} onClick={() => setFilterType("adventure_place")}>
              Adventure Places ({counts.adventure_place})
            </FilterPill>
          </div>
        </div>

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
                    onOpenReview={onOpenReview}
                  />
                ))}
              </div>

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