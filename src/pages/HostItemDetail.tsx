import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Edit, Eye, MapPin, Mail, Phone, Download, FileText, 
  ArrowLeft, CheckCircle2, AlertCircle, Clock, ShieldCheck 
} from "lucide-react";
import { exportBookingsToCSV } from "@/lib/csvExport";
import { downloadAllBookingsAsPDF } from "@/lib/bookingDownload";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const HostItemDetail = () => {
  const { itemType: type, id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [item, setItem] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchItemDetails();
  }, [type, id, user]);

  const fetchItemDetails = async () => {
    try {
      let tableName = "";
      if (type === "trip") tableName = "trips";
      else if (type === "hotel") tableName = "hotels";
      else if (type === "adventure") tableName = "adventure_places";

      const { data: itemData, error: itemError } = await supabase
        .from(tableName as any)
        .select("*")
        .eq("id", id)
        .single();

      if (itemError) throw itemError;
      if ((itemData as any).created_by !== user.id) {
        toast({ title: "Access Denied", variant: "destructive" });
        navigate("/become-host");
        return;
      }
      setItem({ ...(itemData as any), type });

      const { data: bookingsData } = await supabase
        .from("creator_booking_summary")
        .select("*")
        .eq("item_id", id)
        .order("created_at", { ascending: false });

      setBookings(bookingsData || []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; icon: any; color: string }> = {
      approved: { label: "Live & Approved", icon: CheckCircle2, color: COLORS.TEAL },
      pending: { label: "Review Pending", icon: Clock, color: COLORS.CORAL },
      rejected: { label: "Action Required", icon: AlertCircle, color: COLORS.RED },
    };
    const config = configs[status] || { label: status, icon: ShieldCheck, color: "slate" };
    const Icon = config.icon;

    return (
      <Badge className="px-3 py-1.5 rounded-full border-none text-white font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 shadow-lg"
        style={{ backgroundColor: config.color }}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;
  if (!item) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* Hero Section */}
      <div className="relative w-full h-[40vh] md:h-[50vh] overflow-hidden">
        <div className="absolute top-4 left-4 z-50">
          <Button 
            onClick={() => navigate("/become-host")} 
            className="rounded-full bg-black/30 backdrop-blur-md text-white border-none hover:bg-black/50 font-black uppercase text-[10px] tracking-widest h-10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            My Dashboard
          </Button>
        </div>
        
        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute bottom-8 left-0 w-full p-8 z-40">
          <div className="container max-w-6xl mx-auto">
            <div className="mb-4">{getStatusBadge(item.approval_status)}</div>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl mb-3">
              {item.name}
            </h1>
            <div className="flex items-center gap-2 text-white/80 font-bold uppercase text-xs tracking-widest">
              <MapPin className="h-4 w-4 text-[#FF7F50]" />
              {item.location}, {item.country}
            </div>
          </div>
        </div>
      </div>

      <main className="container px-4 max-w-6xl mx-auto -mt-10 relative z-50">
        <div className="grid lg:grid-cols-[1.7fr,1fr] gap-6">
          
          {/* Main Column */}
          <div className="space-y-6">
            <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Listing Management</h2>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => navigate(`/edit-listing/${type}/${id}`)} 
                    className="rounded-xl font-black uppercase text-[10px] tracking-widest bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <Edit className="h-4 w-4 mr-2" /> Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => window.open(`/${type}/${id}`, '_blank')}
                    className="rounded-xl font-black uppercase text-[10px] tracking-widest border-slate-200"
                  >
                    <Eye className="h-4 w-4 mr-2" /> View
                  </Button>
                </div>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">{item.description}</p>
              
              {item.admin_notes && (
                <div className="p-5 rounded-2xl bg-red-50 border border-red-100">
                  <h3 className="text-xs font-black uppercase text-red-600 mb-2 tracking-widest">Feedback from Admin</h3>
                  <p className="text-sm text-red-800 font-medium">{item.admin_notes}</p>
                </div>
              )}
            </div>

            {/* Bookings Section */}
            <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Recent Activity</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Passenger & Guest Logs</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="bg-[#F0E68C]/20 text-[#857F3E] font-black uppercase text-[10px] tracking-tighter"
                    onClick={() => exportBookingsToCSV(bookings, item.name)}
                  >
                    <Download className="h-4 w-4 mr-1" /> CSV
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="bg-[#F0E68C]/20 text-[#857F3E] font-black uppercase text-[10px] tracking-tighter"
                    onClick={() => downloadAllBookingsAsPDF({ itemName: item.name, itemType: type || 'item', bookings })}
                  >
                    <FileText className="h-4 w-4 mr-1" /> PDF
                  </Button>
                </div>
              </div>

              {bookings.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                   <ShieldCheck className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No Bookings Yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="group p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-wrap md:flex-nowrap justify-between items-center transition-all hover:bg-white hover:shadow-md">
                      <div className="flex items-center gap-4">
                         <div className="h-12 w-12 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-slate-400 text-xs">
                           ID
                         </div>
                         <div>
                            <p className="text-xs font-black uppercase tracking-tight text-slate-800">
                              {booking.guest_name_masked || "Confidential Guest"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[9px] uppercase font-black border-slate-200">
                                {booking.status}
                              </Badge>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">{new Date(booking.created_at).toLocaleDateString()}</span>
                            </div>
                         </div>
                      </div>
                      <div className="text-right mt-4 md:mt-0 w-full md:w-auto">
                        <p className="text-lg font-black" style={{ color: COLORS.RED }}>KES {booking.total_amount?.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Gross Amount</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-4">
            <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100 lg:sticky lg:top-24">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Host Contact Info</h3>
              
              <div className="space-y-4 mb-8">
                {item.email && (
                  <div className="flex items-center gap-3 group">
                    <div className="p-2.5 rounded-xl bg-[#008080]/10 text-[#008080]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                      <p className="text-xs font-bold text-slate-700">{item.email}</p>
                    </div>
                  </div>
                )}
                
                {(item.phone_number || item.phone_numbers) && (
                  <div className="flex items-center gap-3 group">
                    <div className="p-2.5 rounded-xl bg-[#FF7F50]/10 text-[#FF7F50]">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contact</p>
                      <p className="text-xs font-bold text-slate-700">
                        {item.phone_number || item.phone_numbers?.[0] || "N/A"}
                      </p>
                    </div>
                  </div>
                )}

                {item.registration_number && (
                  <div className="flex items-center gap-3 group">
                    <div className="p-2.5 rounded-xl bg-[#857F3E]/10 text-[#857F3E]">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reg No.</p>
                      <p className="text-xs font-bold text-slate-700">{item.registration_number}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-50 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Total Revenue</span>
                  <span className="text-lg font-black" style={{ color: COLORS.RED }}>
                    KES {bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Total Sales</span>
                  <span className="text-lg font-black" style={{ color: COLORS.TEAL }}>{bookings.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <MobileBottomBar />
    </div>
  );
};

export default HostItemDetail;