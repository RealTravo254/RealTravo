import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Building, Plane, Tent, Bell, ChevronRight, ArrowLeft, Calendar, QrCode, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used across the rest of the app:
// deep forest for structure and brand marks, a warm clay for the primary
// action and the "has new paid bookings" highlight.
const FOREST       = "#1F4D3A";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const CLAY_LIGHT   = "#E0824F";
const CLAY_SOFT    = "#FBEDE6";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";

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

interface HostedItem {
  id: string; name: string; type: string; image_url: string; paidBookingsCount: number;
}

const HostBookings = () => {
  useInjectFonts();

  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [hostedItems, setHostedItems] = useState<HostedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    const fetch = async () => {
      const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
        supabase.from("trips").select("id,name,image_url,type").eq("created_by", user.id),
        supabase.from("hotels").select("id,name,image_url").eq("created_by", user.id),
        supabase.from("adventure_places").select("id,name,image_url").eq("created_by", user.id)
      ]);
      const allIds = [...(tripsRes.data||[]).map(t=>t.id),...(hotelsRes.data||[]).map(h=>h.id),...(adventuresRes.data||[]).map(a=>a.id)];
      let counts: Record<string, number> = {};
      if (allIds.length) {
        const { data } = await supabase.from("bookings").select("item_id").in("item_id", allIds).in("payment_status", ["paid", "completed"]);
        (data||[]).forEach(b => { counts[b.item_id] = (counts[b.item_id]||0)+1; });
      }
      const items: HostedItem[] = [
        ...(tripsRes.data||[]).map(t => ({ id: t.id, name: t.name, type: t.type||"trip", image_url: t.image_url, paidBookingsCount: counts[t.id]||0 })),
        ...(hotelsRes.data||[]).map(h => ({ id: h.id, name: h.name, type: "hotel", image_url: h.image_url, paidBookingsCount: counts[h.id]||0 })),
        ...(adventuresRes.data||[]).map(a => ({ id: a.id, name: a.name, type: "adventure", image_url: a.image_url, paidBookingsCount: counts[a.id]||0 }))
      ].sort((a,b) => b.paidBookingsCount - a.paidBookingsCount);
      setHostedItems(items);
      setLoading(false);
    };
    fetch();
  }, [user, navigate]);

  const getIcon = (type: string) => {
    if (type === "trip" || type === "event") return <Plane className="h-4 w-4" />;
    if (type === "hotel") return <Building className="h-4 w-4" />;
    return <Tent className="h-4 w-4" />;
  };

  const total = hostedItems.reduce((s, i) => s + i.paidBookingsCount, 0);
  if (loading) return <div className="min-h-screen animate-pulse" style={{ background: CANVAS }} />;

  return (
    <div className="min-h-screen" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <main className="container px-3 py-4 mx-auto">
        <Button
          variant="ghost" size="sm" onClick={() => navigate("/")}
          className="mb-3 rounded-lg text-[11px] font-semibold px-3 h-7 hover:bg-transparent"
          style={{ color: INK_SOFT }}
        >
          <ArrowLeft className="mr-1 h-3 w-3" /> Home
        </Button>

        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Host bookings</h1>
            <p className="text-[11px] font-medium" style={{ color: INK_SOFT }}>Monitor your active bookings</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-white rounded-lg p-2 text-center min-w-[60px]" style={{ border: `1px solid ${HAIRLINE}` }}>
              <p className="text-[9px] font-medium" style={{ color: INK_SOFT }}>Items</p>
              <p className="text-sm font-semibold" style={{ color: FOREST }}>{hostedItems.length}</p>
            </div>
            <div className="bg-white rounded-lg p-2 text-center min-w-[60px]" style={{ border: `1px solid ${HAIRLINE}` }}>
              <p className="text-[9px] font-medium" style={{ color: INK_SOFT }}>Paid</p>
              <p className="text-sm font-semibold" style={{ color: CLAY }}>{total}</p>
            </div>
          </div>
        </div>

        {isMobile && (
          <Button
            onClick={() => navigate("/qr-scanner")}
            className="w-full mb-4 py-4 rounded-xl text-sm font-semibold text-white border-none hover:opacity-95"
            style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}
          >
            <QrCode className="mr-2 h-4 w-4" /> Scan QR code
          </Button>
        )}

        {hostedItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center" style={{ border: `1px solid ${HAIRLINE}` }}>
            <Calendar className="h-8 w-8 mx-auto mb-3" style={{ color: `${FOREST}55` }} />
            <p className="text-[13px] font-semibold" style={{ color: INK_SOFT }}>No listings yet</p>
            <Button
              size="sm" onClick={() => navigate("/become-host")}
              className="mt-3 rounded-lg text-[11px] font-semibold text-white border-none hover:opacity-95"
              style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}
            >
              Become a host
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {hostedItems.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(`/host-bookings/${item.type}/${item.id}`)}
                className="w-full bg-white transition-all rounded-xl px-2 py-2 flex items-center gap-2 text-left"
                style={{ border: `1px solid ${HAIRLINE}` }}
                onMouseEnter={(e) => (e.currentTarget.style.background = CANVAS)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              >
                <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: FOREST_SOFT, color: FOREST }}>
                  {getIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full mb-1 capitalize"
                    style={{ background: FOREST_SOFT, color: FOREST }}
                  >
                    {item.type}
                  </span>
                  <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: INK }}>{item.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold" style={{ color: item.paidBookingsCount > 0 ? CLAY : INK_SOFT }}>
                    {item.paidBookingsCount}
                  </span>
                  {item.paidBookingsCount > 0
                    ? <Bell className="h-3.5 w-3.5 animate-pulse" style={{ color: CLAY }} />
                    : <ChevronRight className="h-3.5 w-3.5" style={{ color: INK_SOFT }} />}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default HostBookings;