import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, Mail, Phone, Calendar, User, Eye, Clock, 
  ArrowLeft, CheckCircle2, XCircle, ShieldAlert, 
  Users, Landmark, Tag, Globe, Info, Navigation
} from "lucide-react";
import { approvalStatusSchema } from "@/lib/validation";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const AdminReviewDetail = () => {
  const { itemType: type, id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [item, setItem] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const hasAdminRole = roles?.some(r => r.role === "admin");
    if (!hasAdminRole) {
      toast({ title: "Access Denied", variant: "destructive" });
      navigate("/");
      return;
    }
    setIsAdmin(true);
    fetchItemDetails();
  };

  const fetchItemDetails = async () => {
    try {
      let itemData: any = null;
      let tableName = "";

      if (type === "trip" || type === "event") {
        tableName = "trips";
      } else if (type === "hotel") {
        tableName = "hotels";
      } else if (type === "adventure" || type === "adventure_place") {
        tableName = "adventure_places";
      }

      if (tableName) {
        const { data } = await supabase.from(tableName as "trips" | "hotels" | "adventure_places").select("*").eq("id", id).maybeSingle();
        itemData = data;
      }

      if (!itemData) {
        toast({ title: "Item not found", variant: "destructive" });
        navigate("/admin");
        return;
      }
      
      setItem({ ...itemData, type, tableName });

      if (itemData.created_by) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", itemData.created_by).maybeSingle();
        setCreator(profile);
      }
    } catch (error) {
      toast({ title: "Error loading item", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateApprovalStatus = async (status: string) => {
    try {
      const validatedStatus = approvalStatusSchema.parse(status);
      const updateData = {
        approval_status: validatedStatus,
        approved_by: validatedStatus === "approved" ? user?.id : null,
        approved_at: validatedStatus === "approved" ? new Date().toISOString() : null,
        is_hidden: validatedStatus === "approved" ? false : item.is_hidden
      };

      const { error } = await supabase.from(item.tableName).update(updateData).eq("id", id);
      if (error) throw error;

      toast({ title: `Item ${status} successfully` });
      navigate("/admin");
    } catch (error) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const openInMaps = () => {
    const query = encodeURIComponent(`${item?.name || item?.location_name}, ${item?.location || item?.place}`);
    const mapUrl = item?.map_link || item?.location_link || `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(mapUrl, "_blank");
  };

  if (loading || !isAdmin || !item) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;

  const displayImages = [
    item.image_url,
    ...(item.gallery_images || []),
    ...(item.images || []),
    ...(item.photo_urls || [])
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-32">
      <Header className="hidden md:block" />

      <div className="relative w-full h-[45vh] md:h-[55vh] overflow-hidden">
        <div className="absolute top-4 left-4 right-4 z-50 flex justify-between">
          <Button onClick={() => navigate(-1)} className="rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0 hover:bg-black/50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex gap-2">
            <Badge className="bg-[#FF7F50] text-white border-none px-4 py-1.5 h-auto uppercase font-black tracking-widest text-[10px] rounded-full shadow-lg">
              {type?.replace('_', ' ')}
            </Badge>
            <Badge className={`border-none px-4 py-1.5 h-auto uppercase font-black tracking-widest text-[10px] rounded-full shadow-lg ${
              item.approval_status === 'approved' ? 'bg-green-500' : 'bg-yellow-500'
            }`}>
              {item.approval_status}
            </Badge>
          </div>
        </div>

        <Carousel plugins={[Autoplay({ delay: 4000 })]} className="w-full h-full">
          <CarouselContent className="h-full">
            {displayImages.map((img, idx) => (
              <CarouselItem key={idx} className="h-full">
                <div className="relative h-full w-full">
                  <img src={img} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="absolute bottom-12 left-8 z-40">
           <h1 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
            {item.name || item.location_name}
          </h1>
          <div className="flex items-center gap-2 text-white/80 mt-2">
            <MapPin className="h-4 w-4" />
            <span className="text-sm font-bold uppercase tracking-widest">{item.place || item.location}, {item.country}</span>
          </div>
        </div>
      </div>

      <main className="container px-4 max-w-7xl mx-auto -mt-10 relative z-50">
        <div className="grid lg:grid-cols-[1.7fr,1fr] gap-8">
          <div className="space-y-6">
            {/* 1. DESCRIPTION SECTION */}
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.TEAL }}>Submission Description</h2>
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{item.description || "No description provided."}</p>
            </div>

            {/* 2. TECHNICAL SPECIFICATIONS */}
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] mb-6" style={{ color: COLORS.TEAL }}>Technical Specifications</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Reg / License No.</p>
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-black">{item.registration_number || "NOT PROVIDED"}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Available Slots / Capacity</p>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-black">{item.available_tickets || item.capacity || "UNLIMITED"}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Origin Country</p>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-black uppercase">{item.country}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. SCHEDULE */}
            {(item.opening_hours || item.date) && (
              <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] mb-6" style={{ color: COLORS.TEAL }}>Operation Schedule</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Working Hours</p>
                      <p className="text-sm font-black">{item.opening_hours || "N/A"} — {item.closing_hours || "N/A"}</p>
                    </div>
                  </div>
                  {Array.isArray(item.days_opened) && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Available Days</p>
                      <div className="flex flex-wrap gap-1">
                        {item.days_opened.map((day: string) => (
                          <Badge key={day} variant="secondary" className="text-[9px] font-black uppercase bg-teal-50 text-teal-700 border-none">
                            {day}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.date && (
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-coral" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Fixed Event Date</p>
                        <p className="text-sm font-black">{new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. FEATURES */}
            {((item.amenities?.length > 0) || (item.activities?.length > 0) || (item.facilities?.length > 0)) && (
              <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] mb-6" style={{ color: COLORS.TEAL }}>Facilities & Activities Review</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[...(item.amenities || []), ...(item.activities || []), ...(item.facilities || [])].map((feat: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-teal-600" />
                        <span className="text-[11px] font-black uppercase text-slate-700">
                          {typeof feat === 'string' ? feat : feat.name}
                        </span>
                      </div>
                      {feat.price && <span className="text-[10px] font-bold text-teal-600">KSh {feat.price}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. SUBMITTER INFO */}
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] mb-6" style={{ color: COLORS.TEAL }}>Submitter Information</h2>
              <div className="flex flex-col md:flex-row gap-6 md:items-center">
                <div className="h-16 w-16 rounded-3xl bg-slate-100 flex items-center justify-center">
                  <User className="h-8 w-8 text-slate-300" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Contact Name</p>
                    <p className="text-sm font-black uppercase">{creator?.name || "Unknown Host"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Official Email</p>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-teal-600" />
                      <p className="text-xs font-bold">{item.email || creator?.email || "No Email"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Official Phone</p>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-teal-600" />
                      <p className="text-xs font-bold">{item.phone_number || creator?.phone_number || "No Phone"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-slate-100 lg:sticky lg:top-24">
              <div className="mb-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 text-center">Pricing Policy</p>
                <div className="space-y-4">
                  <div className="flex justify-between items-end p-5 rounded-3xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Adult Rate</p>
                      <p className="text-3xl font-black text-red-600">KSh {item.price || item.entry_fee || item.price_adult || 0}</p>
                    </div>
                    <Tag className="h-5 w-5 text-slate-200" />
                  </div>
                  {item.price_child !== undefined && (
                    <div className="flex justify-between items-end p-5 rounded-3xl bg-slate-50 border border-slate-100">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Child Rate</p>
                        <p className="text-xl font-black text-slate-800">KSh {item.price_child}</p>
                      </div>
                      <Tag className="h-4 w-4 text-slate-200" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <Button variant="ghost" onClick={openInMaps} className="flex-col h-auto py-4 bg-teal-50 text-teal-700 rounded-3xl border border-teal-100">
                  <Navigation className="h-5 w-5 mb-1" />
                  <span className="text-[9px] font-black uppercase">Verify Map</span>
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => window.open(`/${type}/${id}`, '_blank')}
                  className="flex-col h-auto py-4 bg-slate-50 text-slate-600 rounded-3xl border border-slate-200"
                >
                  <Eye className="h-5 w-5 mb-1" />
                  <span className="text-[9px] font-black uppercase">Live View</span>
                </Button>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={() => updateApprovalStatus("approved")}
                  disabled={item.approval_status === "approved"}
                  className="w-full py-8 rounded-[24px] text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
                  style={{ 
                    background: item.approval_status === 'approved' ? '#94a3b8' : `linear-gradient(135deg, #2dd4bf 0%, ${COLORS.TEAL} 100%)`,
                  }}
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Approve Entry
                </Button>

                {item.approval_status !== "approved" && (
                   <Button 
                    variant="ghost"
                    onClick={() => updateApprovalStatus("rejected")}
                    className="w-full py-4 text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-2xl"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Submission
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-24 left-4 right-4 md:hidden z-[100]">
        <div className="bg-black/90 backdrop-blur-xl p-4 rounded-3xl flex items-center justify-between border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500 rounded-xl">
                    <ShieldAlert className="h-4 w-4 text-black" />
                </div>
                <div>
                    <p className="text-[8px] font-black text-white/50 uppercase tracking-widest">Admin Control</p>
                    <p className="text-[10px] font-black text-white uppercase tracking-tight">{item.approval_status}</p>
                </div>
            </div>
            <div className="flex gap-2">
                <Button size="sm" onClick={() => updateApprovalStatus("approved")} className="bg-teal-500 h-9 rounded-xl text-[10px] font-black px-4">APPROVE</Button>
                <Button size="sm" variant="destructive" onClick={() => updateApprovalStatus("rejected")} className="h-9 rounded-xl text-[10px] font-black px-4">REJECT</Button>
            </div>
        </div>
      </div>
      <MobileBottomBar />
    </div>
  );
};

export default AdminReviewDetail;