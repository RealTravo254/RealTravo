import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronRight, Plane, Building, Tent, MapPin,
  Search, ArrowLeft, XCircle, AlertCircle, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used on the adventure detail page:
// deep forest for structure and trust, a warm clay for the primary action,
// dusty rust reserved for "needs attention" states. Ink is a green-tinted
// charcoal rather than pure black.
const FOREST       = "#1F4D3A";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const CLAY_LIGHT   = "#E0824F";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";
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

const ITEMS_PER_PAGE = 20;

interface ListingItem {
  id: string;
  name: string;
  type: string;
  location: string;
  created_at: string;
}

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

const TYPE_STYLES: Record<string, { icon: any; label: string }> = {
  trip: { icon: Plane, label: "Trip" },
  hotel: { icon: Building, label: "Hotel" },
  adventure: { icon: Tent, label: "Adventure" },
};
const getTypeMeta = (type: string) => TYPE_STYLES[type] ?? { icon: MapPin, label: type };

const RejectedItems = () => {
  useInjectFonts();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<ListingItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchRejectedItems(0);
  }, [user, navigate]);

  const fetchRejectedItems = async (fetchOffset: number) => {
    if (fetchOffset === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
        supabase.from("trips").select("id, name, location, created_at").eq("approval_status", "rejected").range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1),
        supabase.from("hotels").select("id, name, location, created_at").eq("approval_status", "rejected").range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1),
        supabase.from("adventure_places").select("id, name, location, created_at").eq("approval_status", "rejected").range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1),
      ]);

      const allItems: ListingItem[] = [
        ...(tripsRes.data?.map(t => ({ ...t, type: "trip" })) || []),
        ...(hotelsRes.data?.map(h => ({ ...h, type: "hotel" })) || []),
        ...(adventuresRes.data?.map(a => ({ ...a, type: "adventure" })) || []),
      ];

      const sortedItems = allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (fetchOffset === 0) {
        setItems(sortedItems);
        setFilteredItems(sortedItems);
      } else {
        setItems(prev => [...prev, ...sortedItems]);
        setFilteredItems(prev => [...prev, ...sortedItems]);
      }

      setOffset(fetchOffset + ITEMS_PER_PAGE);
      setHasMore(allItems.length >= ITEMS_PER_PAGE);
    } catch (error) {
      console.error("Error fetching rejected items:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !loadingMore) fetchRejectedItems(offset);
  };

  useEffect(() => {
    const query = searchQuery.toLowerCase().trim();
    if (query === "") {
      setFilteredItems(items);
    } else {
      setFilteredItems(items.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query)
      ));
    }
  }, [searchQuery, items]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: CANVAS }}>
        <div className="h-10 w-10 rounded-full animate-spin" style={{ border: `2px solid ${FOREST_SOFT}`, borderTopColor: FOREST }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <Header />

      <main className="container max-w-3xl mx-auto px-4 py-6 md:py-10">
        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <BackButton onClick={() => navigate(-1)} />
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
              Rejected <span style={{ color: DANGER }}>listings</span>
            </h1>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: INK_SOFT }}>
              Review and update items that require changes
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: INK_SOFT }} />
          <Input
            placeholder="Search by name or location"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 rounded-xl bg-white pl-10 text-sm font-medium"
            style={{ border: `1px solid ${HAIRLINE}` }}
          />
        </div>

        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-[24px] p-12 text-center" style={{ border: `1px solid ${HAIRLINE}` }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: DANGER_SOFT }}>
              <XCircle className="h-6 w-6" style={{ color: DANGER }} />
            </div>
            <p className="font-semibold text-sm" style={{ color: INK_SOFT }}>
              {searchQuery ? "No matching results found" : "No rejected items at this time"}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {filteredItems.map((item) => {
                const { icon: Icon, label } = getTypeMeta(item.type);
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/admin/review/${item.type}/${item.id}`)}
                    className="w-full text-left bg-white rounded-2xl p-4 flex items-center gap-3.5 relative overflow-hidden transition-all hover:shadow-md"
                    style={{ border: `1px solid ${HAIRLINE}` }}
                  >
                    {/* Accent edge */}
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: DANGER }} />

                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ml-1.5"
                      style={{ background: DANGER_SOFT }}
                    >
                      <Icon className="h-5 w-5" style={{ color: DANGER }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span
                          className="text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: DANGER_SOFT, color: DANGER }}
                        >
                          {label}
                        </span>
                        <span className="text-[10px] font-medium" style={{ color: INK_SOFT }}>
                          {new Date(item.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold truncate" style={{ color: INK }}>{item.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5" style={{ color: INK_SOFT }}>
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="text-[11px] font-medium truncate">{item.location}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span
                        className="hidden sm:inline-block text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ background: DANGER_SOFT, color: DANGER }}
                      >
                        Action required
                      </span>
                      <ChevronRight className="h-4 w-4" style={{ color: INK_SOFT }} />
                    </div>
                  </button>
                );
              })}
            </div>

            {hasMore && !searchQuery && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-xl text-[12px] font-semibold text-white border-none h-11 px-6 hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)` }}
                >
                  {loadingMore ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…</>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        <div className="mt-8 flex items-center justify-center gap-2" style={{ color: INK_SOFT }}>
          <AlertCircle className="h-3.5 w-3.5" />
          <p className="text-[11px] font-medium">Tap an item to see rejection reasons and edit</p>
        </div>
      </main>

      <MobileBottomBar />
    </div>
  );
};

export default RejectedItems;