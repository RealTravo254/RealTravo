import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Building, Plane, Tent, Bell, ChevronRight, ArrowLeft, Calendar, QrCode, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface HostedItem {
  id: string; name: string; type: string; image_url: string; paidBookingsCount: number;
}

const HostBookings = () => {
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
  if (loading) return <div className="min-h-screen bg-background animate-pulse" />;

  return (
    <div className="min-h-screen bg-background">
      <main className="container px-3 py-4 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/creator-dashboard")} className="mb-3 rounded-lg text-[9px] font-bold uppercase tracking-widest px-3 h-7">
          <ArrowLeft className="mr-1 h-3 w-3" /> Dashboard
        </Button>

        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-foreground">Host Bookings</h1>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Monitor your active bookings</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-card rounded-lg p-2 border border-border text-center min-w-[60px]">
              <p className="text-[8px] font-bold text-muted-foreground uppercase">Items</p>
              <p className="text-sm font-black text-primary">{hostedItems.length}</p>
            </div>
            <div className="bg-card rounded-lg p-2 border border-border text-center min-w-[60px]">
              <p className="text-[8px] font-bold text-muted-foreground uppercase">Paid</p>
              <p className="text-sm font-black text-orange-500">{total}</p>
            </div>
          </div>
        </div>

        {isMobile && (
          <Button onClick={() => navigate("/qr-scanner")} className="w-full mb-4 py-4 rounded-xl text-xs font-black uppercase tracking-widest" variant="default">
            <QrCode className="mr-2 h-4 w-4" /> Scan QR Code
          </Button>
        )}

        {hostedItems.length === 0 ? (
          <div className="bg-card rounded-xl p-8 text-center border border-border">
            <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-xs font-bold text-muted-foreground uppercase">No listings yet</p>
            <Button size="sm" onClick={() => navigate("/become-host")} className="mt-3 rounded-lg text-[9px] font-bold">Become a Host</Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {hostedItems.map(item => (
              <button key={item.id} onClick={() => navigate(`/host-bookings/${item.type}/${item.id}`)}
                className="w-full bg-card hover:bg-muted/50 transition-all rounded-xl px-2 py-2 border border-border flex items-center gap-2 text-left">
                <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center text-muted-foreground">
                  {getIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3.5 mb-0.5">{item.type}</Badge>
                  <p className="text-xs font-bold text-foreground truncate leading-tight">{item.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-sm font-black ${item.paidBookingsCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{item.paidBookingsCount}</span>
                  {item.paidBookingsCount > 0 ? <Bell className="h-3.5 w-3.5 text-primary animate-pulse" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
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
