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
  Loader2, Inbox, Mountain, Calendar, ArrowLeft,
} from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used on the adventure detail page:
// deep forest for structure and trust, a warm clay for the primary action.
// Ink is a green-tinted charcoal rather than pure black.
const FOREST       = "#1F4D3A";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const CLAY_LIGHT   = "#E0824F";
const GOLD         = "#B98A2A";
const GOLD_SOFT    = "#FBF2DD";
const GOLD_TEXT    = "#8A6716";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";
const SUCCESS      = "#2F6F4E";
const SUCCESS_SOFT = "#EAF3EC";
const DANGER       = "#9C3B2B";
const DANGER_SOFT  = "#F7E9E5";

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Injects the two typefaces once, without needing to touch the app's index.html.
const useInjectFonts = () => {
  useEffect(() => {
    const id = "adventure-detail-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
};

// ─── Constants ────────────────────────────────────────────────────────────────
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
const NAV_TYPE_MAP: Record<ItemType, string> = {
  trip: "trip",
  adventure_place: "adventure",
};

const TYPE_LABELS: Record<ItemType, string> = {
  trip: "Trip",
  adventure_place: "Adventure Place",
};

const TYPE_BADGE_COLORS: Record<ItemType, { bg: string; text: string }> = {
  trip: { bg: FOREST_SOFT, text: FOREST },
  adventure_place: { bg: SUCCESS_SOFT, text: SUCCESS },
};

const TypeIcon = ({ type, className }: { type: ItemType; className?: string }) => {
  if (type === "trip") return <Calendar className={className} />;
  return <Mountain className={className} />;
};

// ─── Shared page chrome ─────────────────────────────────────────────────────
const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex h-10 w-10 items-center justify-center rounded-full bg-white transition-colors"
    style={{ border: `1px solid ${HAIRLINE}` }}
  >
    <ArrowLeft className="h-4 w-4" style={{ color: INK_SOFT }} />
  </button>
);

// ─── Filter Pill ──────────────────────────────────────────────────────────────
const FilterPill = ({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-3.5 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all flex-shrink-0"
    style={
      active
        ? { background: FOREST, color: "#fff" }
        : { background: "#fff", border: `1px solid ${HAIRLINE}`, color: INK_SOFT }
    }
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
      className="flex items-center gap-3 bg-white p-3 sm:p-4 rounded-2xl transition-all cursor-pointer hover:shadow-md"
      style={{ border: item.is_hidden ? `1px solid ${DANGER}30` : `1px solid ${HAIRLINE}`, background: item.is_hidden ? `${DANGER_SOFT}60` : "#fff" }}
    >
      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: FOREST_SOFT }}>
        {item.image_url ? (
          <img src={item.image_url} className="h-full w-full object-cover" alt="" />
        ) : (
          <TypeIcon type={item.itemType} className="h-6 w-6" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span
            className="text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{ background: badge.bg, color: badge.text }}
          >
            {TYPE_LABELS[item.itemType]}
          </span>
          {item.is_hidden && (
            <span className="text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: DANGER_SOFT, color: DANGER }}>
              Hidden
            </span>
          )}
        </div>
        <h3 className="text-sm sm:text-base font-semibold truncate" style={{ color: INK }}>{item.name}</h3>
        <div className="flex items-center text-xs mt-0.5" style={{ color: INK_SOFT }}>
          <MapPin size={11} className="mr-1 shrink-0" />
          <span className="truncate">
            {[item.location, item.place, item.country].filter(Boolean).join(", ") || "—"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenReview(item);
          }}
          className="h-9 w-9 rounded-full flex items-center justify-center transition-all hidden sm:flex"
          style={{ background: CANVAS, color: INK_SOFT }}
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
          className="rounded-xl text-[11px] font-semibold gap-1.5 h-9"
          style={
            item.is_hidden
              ? { borderColor: `${SUCCESS}40`, color: SUCCESS }
              : { borderColor: `${DANGER}30`, color: DANGER }
          }
        >
          {isUpdating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : item.is_hidden ? (
            <Eye size={14} />
          ) : (
            <EyeOff size={14} />
          )}
          <span className="hidden sm:inline">{item.is_hidden ? "Show" : "Hide"}</span>
        </Button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminApproved = () => {
  useInjectFonts();
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
    <div className="min-h-screen pb-24" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <Header />

      <div className="container max-w-4xl mx-auto px-4 py-6 md:py-10">
        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <BackButton onClick={() => navigate(-1)} />
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
              Approved <span style={{ color: CLAY }}>listings</span>
            </h1>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: INK_SOFT }}>
              Manage visibility of all approved trips and adventure places.
              {counts.hidden > 0 && (
                <span className="ml-1 font-semibold" style={{ color: DANGER }}>
                  {counts.hidden} currently hidden.
                </span>
              )}
            </p>
          </div>
        </div>

        {rlsSuspected && (
          <div className="mb-5 rounded-2xl p-4 sm:p-5" style={{ background: GOLD_SOFT, border: `1px solid ${GOLD}40` }}>
            <p className="text-sm font-semibold mb-1" style={{ color: GOLD_TEXT }}>
              No rows came back from either table — this usually means Row Level Security (RLS) is blocking access.
            </p>
            <p className="text-xs leading-relaxed mb-3" style={{ color: GOLD_TEXT }}>
              Your <code className="px-1 rounded" style={{ background: `${GOLD}20` }}>approval_status</code> column is required (not nullable)
              with a default of <code className="px-1 rounded" style={{ background: `${GOLD}20` }}>'pending'</code>, so rows almost certainly
              exist — Supabase just isn't allowed to return them to this logged-in user. The most common cause is a
              SELECT policy like <code className="px-1 rounded" style={{ background: `${GOLD}20` }}>created_by = auth.uid()</code>, which lets
              hosts see only their own listings and hides everyone else's from an admin viewing this page.
            </p>
            <p className="text-xs leading-relaxed mb-2 font-semibold" style={{ color: GOLD_TEXT }}>
              Fix: in Supabase → Authentication → Policies, add (or update) a SELECT policy on both tables so admins
              can read all rows, e.g.:
            </p>
            <pre className="text-[11px] rounded-xl p-3 overflow-x-auto" style={{ background: `${GOLD}18`, color: GOLD_TEXT }}>
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
            <p className="text-[11px] mt-2" style={{ color: GOLD_TEXT }}>
              Replace the <code className="px-1 rounded" style={{ background: `${GOLD}20` }}>is_admin</code> check with whatever column/table
              you already use to mark admin users. Also check the browser console for the exact diagnostic log.
            </p>
          </div>
        )}

        {!rlsSuspected && debugInfo && (debugInfo.tripsCount > 0 || debugInfo.adventuresCount > 0) && listings.length === 0 && (
          <div className="mb-5 rounded-2xl p-4" style={{ background: GOLD_SOFT, border: `1px solid ${GOLD}40` }}>
            <p className="text-sm font-semibold" style={{ color: GOLD_TEXT }}>
              Fetched {debugInfo.tripsCount} trip row(s) and {debugInfo.adventuresCount} adventure place row(s), but
              none had <code className="px-1 rounded" style={{ background: `${GOLD}20` }}>approval_status === "approved"</code>.
            </p>
            <p className="text-xs mt-1" style={{ color: GOLD_TEXT }}>
              Open the browser console to see the exact stored value for <code className="px-1 rounded" style={{ background: `${GOLD}20` }}>approval_status</code> on a sample row.
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 mb-5 space-y-4" style={{ border: `1px solid ${HAIRLINE}` }}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: INK_SOFT }} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or location"
                className="pl-10 h-11 rounded-xl text-sm font-medium"
                style={{ border: `1px solid ${HAIRLINE}` }}
              />
            </div>

            <div className="sm:hidden">
              <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                <SelectTrigger className="h-11 rounded-xl font-semibold" style={{ border: `1px solid ${HAIRLINE}` }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl">
                  <SelectItem value="all">All types ({counts.all})</SelectItem>
                  <SelectItem value="trip">Trips ({counts.trip})</SelectItem>
                  <SelectItem value="adventure_place">Adventure places ({counts.adventure_place})</SelectItem>
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
              Adventure places ({counts.adventure_place})
            </FilterPill>
          </div>
        </div>

        <main className="space-y-2.5">
          {isLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] w-full rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-[24px] p-14 text-center" style={{ border: `1px solid ${HAIRLINE}` }}>
              <Inbox className="h-9 w-9 mx-auto mb-3" style={{ color: INK_SOFT, opacity: 0.5 }} />
              <p className="font-semibold text-sm" style={{ color: INK_SOFT }}>
                {searchQuery || filterType !== "all" ? "No listings match your filters." : "No approved listings yet."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-2.5">
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
                  <p className="text-xs font-semibold" style={{ color: INK_SOFT }}>
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
                      style={{ borderColor: HAIRLINE }}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-semibold px-2" style={{ color: INK }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-xl h-9 w-9 p-0"
                      style={{ borderColor: HAIRLINE }}
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
        <AlertDialogContent className="rounded-2xl" style={{ fontFamily: FONT_BODY }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: FONT_DISPLAY }}>
              {pendingItem?.is_hidden ? "Show this listing?" : "Hide this listing?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingItem?.is_hidden ? (
                <>
                  <span className="font-semibold" style={{ color: INK }}>"{pendingItem?.name}"</span> will become
                  visible to the public again on the site.
                </>
              ) : (
                <>
                  <span className="font-semibold" style={{ color: INK }}>"{pendingItem?.name}"</span> will be hidden
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
              className="rounded-xl text-white border-none hover:opacity-90"
              style={{ background: pendingItem?.is_hidden ? SUCCESS : DANGER }}
            >
              {pendingItem?.is_hidden ? "Show listing" : "Hide listing"}
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