import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Mail, Phone, User, ArrowLeft, Hash, CreditCard, Users, CheckCircle2 } from "lucide-react";

const AdminBookings = () => {
  const { type, id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast(); 
  const [bookings, setBookings] = useState<any[]>([]);
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { checkAdmin(); }, [user]);

  const checkAdmin = async () => {
    if (!user) { navigate("/auth"); return; }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!data?.some(r => r.role === "admin")) { toast({ title: "Access Denied", variant: "destructive" }); navigate("/"); return; }
    setIsAdmin(true); fetchBookings();
  };

  const fetchBookings = async () => {
    try {
      const table = type === "trip" ? "trips" : type === "hotel" ? "hotels" : "adventure_places";
      const { data: itemData } = await supabase.from(table as any).select("id,name,image_url").eq("id", id).single();
      setItem(itemData);
      const { data, error } = await supabase.from("bookings").select("*").eq("item_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      setBookings(data || []);
    } catch (e) { console.error(e); toast({ title: "Error", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const statusColor = (s: string) => {
    if (s === "confirmed" || s === "completed") return "text-green-600 bg-green-50 border-green-200";
    if (s === "cancelled") return "text-destructive bg-destructive/10 border-destructive/20";
    return "text-yellow-600 bg-yellow-50 border-yellow-200";
  };

  if (loading || !isAdmin) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-4 border-muted border-t-primary animate-spin" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Loading…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="container px-3 py-4 mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/review/${type}/${id}`)} className="mb-3 rounded-lg text-[9px] font-bold uppercase tracking-widest px-3 h-7">
          <ArrowLeft className="mr-1 h-3 w-3" /> Review
        </Button>

        <div className="mb-4">
          <Badge variant="secondary" className="text-[8px] mb-1">Admin</Badge>
          <h1 className="text-lg font-black uppercase tracking-tight text-foreground">
            Bookings: <span className="text-primary">{item?.name}</span>
          </h1>
          <p className="text-[9px] font-bold text-muted-foreground uppercase">{bookings.length} total bookings</p>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-card rounded-xl p-8 text-center border border-border">
            <p className="text-xs text-muted-foreground font-bold uppercase">No records found</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {bookings.map(b => (
              <div key={b.id} className="bg-card rounded-xl border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[8px] font-mono text-muted-foreground">{b.id.slice(0, 8)}</span>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant="outline" className={`text-[7px] px-1.5 py-0 h-4 ${statusColor(b.status)}`}>{b.status}</Badge>
                    <Badge variant="outline" className={`text-[7px] px-1.5 py-0 h-4 ${statusColor(b.payment_status || 'pending')}`}>{b.payment_status || 'pending'}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">{b.guest_name || "Anonymous"}</p>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{new Date(b.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                      <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{b.slots_booked || 1}</span>
                      {b.payment_method && <span className="flex items-center gap-0.5"><CreditCard className="h-2.5 w-2.5" />{b.payment_method}</span>}
                    </div>
                  </div>
                  <p className="text-sm font-black text-destructive shrink-0">KSh {b.total_amount?.toLocaleString()}</p>
                </div>
                {(b.guest_email || b.guest_phone) && (
                  <div className="flex gap-3 mt-1.5 pt-1.5 border-t border-border">
                    {b.guest_email && <a href={`mailto:${b.guest_email}`} className="text-[9px] text-primary flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{b.guest_email}</a>}
                    {b.guest_phone && <a href={`tel:${b.guest_phone}`} className="text-[9px] text-primary flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{b.guest_phone}</a>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminBookings;
