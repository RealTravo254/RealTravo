import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plane, Tent, Plus, ArrowLeft, LayoutDashboard, Map, Building2, Users, CalendarDays, Clock } from "lucide-react";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

type HostType = 'guide' | 'campsite' | 'company' | 'event';
type HostingCategory = 'guide' | 'campsite' | 'company' | null;

const BecomeHost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [myContent, setMyContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTypeSelection, setShowTypeSelection] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [hasCompany, setHasCompany] = useState(false);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  const [hostingCategory, setHostingCategory] = useState<HostingCategory>(null);
  const [pendingAdventures, setPendingAdventures] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const { data: profileData } = await supabase.from('profiles').select('profile_completed').eq('id', user.id).single();
        if (cancelled) return;
        if (profileData && !profileData.profile_completed) {
          navigate('/complete-profile');
          return;
        }

        const { data: verification, error: verificationError } = await supabase
          .from("host_verifications")
          .select("status, hosting_category")
          .eq("user_id", user.id)
          .single();

        const { data: company } = await supabase
          .from("companies")
          .select("verification_status")
          .eq("user_id", user.id)
          .single();

        if (cancelled) return;

        const hasV = verification && !verificationError;
        setVerificationStatus(verification?.status || null);
        setHostingCategory(verification?.hosting_category as HostingCategory || null);
        setHasCompany(!!company);
        setCompanyStatus(company?.verification_status || null);

        if (!hasV && !company) {
          setShowTypeSelection(true);
          setLoading(false);
          return;
        }

        if (hasV && verification?.status === "pending" && verification?.hosting_category !== "campsite") {
          navigate("/verification-status");
          return;
        }
        
        if (hasV && verification?.status === "rejected") {
          navigate("/host-verification");
          return;
        }

        const [trips, hotels, adventures] = await Promise.all([
          supabase.from("trips").select("id,name,type,approval_status").eq("created_by", user.id),
          supabase.from("hotels").select("id,name,approval_status").eq("created_by", user.id),
          supabase.from("adventure_places").select("id,name,approval_status").eq("created_by", user.id)
        ]);

        if (cancelled) return;

        const pendingAdv = adventures.data?.filter(a => a.approval_status === 'pending') || [];
        setPendingAdventures(pendingAdv);

        const allContent = [
          ...(trips.data?.map(t => ({ ...t, contentType: t.type || "trip" })) || []),
          ...(hotels.data?.map(h => ({ ...h, contentType: "hotel" })) || []),
          ...(adventures.data?.map(a => ({ ...a, contentType: "adventure" })) || [])
        ];
        setMyContent(allContent);
        setShowTypeSelection(false);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();

    return () => { cancelled = true; };
  }, [user, navigate]);

  const handleHostTypeSelect = async (type: HostType) => {
    if (type === 'guide') navigate("/host-verification?category=guide");
    else if (type === 'campsite') {
      toast({ title: "Welcome!", description: "You can now create your adventure place listing." });
      navigate("/create-adventure");
    } else if (type === 'company') navigate("/host-verification?category=company");
    else if (type === 'event') navigate("/create-event");
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center">
      <div className="h-10 w-10 border-4 border-[#008080] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // SELECTION VIEW (Two rows, two columns)
  if (showTypeSelection) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8 mx-auto mb-24">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full bg-white shadow-sm border border-slate-100">
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Button>
            <Badge className="bg-[#008080] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              Become a Host
            </Badge>
          </div>

          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 mb-8">
            How do you want to <span style={{ color: COLORS.CORAL }}>host?</span>
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SelectionCard 
              icon={<Map className="h-8 w-8 text-blue-600" />}
              title="Tour Guide"
              desc="Host flexible trips and guided tours. Basic verification required."
              onClick={() => handleHostTypeSelect('guide')}
              bg="bg-blue-50"
            />
            <SelectionCard 
              icon={<Tent className="h-8 w-8 text-emerald-600" />}
              title="Campsite / Adventure"
              desc="List your campsite or nature spot. No verification needed."
              onClick={() => handleHostTypeSelect('campsite')}
              bg="bg-emerald-50"
            />
            <SelectionCard 
              icon={<Building2 className="h-8 w-8 text-orange-600" />}
              title="Register Company"
              desc="Host fixed-date trips and hotels. Company verification required."
              onClick={() => handleHostTypeSelect('company')}
              bg="bg-orange-50"
            />
            <SelectionCard 
              icon={<CalendarDays className="h-8 w-8 text-purple-600" />}
              title="Host an Event"
              desc="Create sports, music or cultural events. No verification needed."
              onClick={() => handleHostTypeSelect('event')}
              bg="bg-purple-50"
            />
          </div>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  // DASHBOARD VIEW (Two Column Grid)
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-12 mx-auto mb-24">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full bg-white shadow-sm border border-slate-100">
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </Button>
              <Badge className="bg-[#008080] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Host Dashboard
              </Badge>
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter leading-none text-slate-900">
              Manage Your <span style={{ color: COLORS.CORAL }}>Inventory</span>
            </h1>
          </div>
          <div className="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-[#857F3E]" />
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Assets</p>
              <p className="text-xl font-black text-slate-800">{myContent.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {pendingAdventures.map(adv => (
            <div key={adv.id} className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-[24px] p-6 flex items-center gap-4">
              <Clock className="h-6 w-6 text-amber-600" />
              <div className="flex-1">
                <h3 className="font-black text-sm uppercase text-amber-800">{adv.name}</h3>
                <p className="text-xs font-bold text-amber-600 uppercase">Waiting for admin verification</p>
              </div>
            </div>
          ))}

          {((hasCompany && companyStatus === 'approved') || (verificationStatus === 'approved' && !hostingCategory)) && (
            <HostCategoryCard 
              title="Fixed Trips"
              subtitle="Fixed-Date Tours"
              image="/images/category-trips.webp"
              icon={<Plane className="h-8 w-8" />}
              count={myContent.filter(i => i.contentType === 'trip').length}
              onManage={() => navigate("/host/trips")}
              onAdd={() => navigate("/create-trip")}
              accentColor={COLORS.TEAL}
            />
          )}

          {((hostingCategory === 'guide' && verificationStatus === 'approved') || 
            (hasCompany && companyStatus === 'approved') ||
            (verificationStatus === 'approved' && !hostingCategory)) && (
            <HostCategoryCard 
              title="Guided Tours"
              subtitle="Flexible & Custom-Date Trips"
              image="/images/category-trips.webp"
              icon={<Map className="h-8 w-8" />}
              count={myContent.filter(i => i.contentType === 'trip').length}
              onManage={() => navigate("/host/trips")}
              onAdd={() => navigate("/create-trip?flexible=true")}
              accentColor={COLORS.TEAL}
            />
          )}

          <HostCategoryCard 
            title="Events"
            subtitle="Sports & Social Events"
            image="/images/category-campsite.webp"
            icon={<Users className="h-8 w-8" />}
            count={myContent.filter(i => i.contentType === 'event').length}
            onManage={() => navigate("/host/trips")}
            onAdd={() => navigate("/create-event")}
            accentColor={COLORS.KHAKI_DARK}
          />

          {(hostingCategory === 'campsite' || (verificationStatus === 'approved' && !hostingCategory)) && (
            <HostCategoryCard 
              title="Adventure Places"
              subtitle="Campsites & Nature"
              image="/images/category-campsite.webp"
              icon={<Tent className="h-8 w-8" />}
              count={myContent.filter(i => i.contentType === 'adventure').length}
              onManage={() => navigate("/host/experiences")}
              onAdd={() => navigate("/create-adventure")}
              accentColor={COLORS.CORAL}
            />
          )}
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

const SelectionCard = ({ icon, title, desc, onClick, bg }: any) => (
  <button onClick={onClick} className="group bg-white rounded-[24px] p-6 shadow-lg border border-slate-100 text-left transition-all hover:shadow-xl">
    <div className={`p-4 rounded-2xl w-fit mb-4 ${bg} group-hover:bg-[#008080] transition-colors`}>
      <div className="group-hover:text-white transition-colors">{icon}</div>
    </div>
    <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2">{title}</h3>
    <p className="text-sm text-slate-500 leading-relaxed mb-6">{desc}</p>
    <div className="py-2.5 rounded-xl text-center text-xs font-bold uppercase tracking-widest border-2 border-slate-200 group-hover:border-[#008080] group-hover:text-[#008080] transition-colors">
      Get Started →
    </div>
  </button>
);

const HostCategoryCard = ({ title, subtitle, image, icon, count, onManage, onAdd, accentColor }: any) => (
  <div className="group bg-white rounded-[32px] overflow-hidden shadow-xl border border-slate-100 flex flex-col h-[420px]">
    <div className="relative h-1/2 overflow-hidden">
      <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
      <div className="absolute top-4 left-4">
        <Badge className="bg-white/20 backdrop-blur-md text-white border-none text-[10px] font-black uppercase">{count} Listings</Badge>
      </div>
      <div className="absolute bottom-4 left-6">
        <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">{subtitle}</p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{title}</h2>
      </div>
    </div>
    <div className="p-8 flex flex-col justify-between flex-1">
      <div className="flex items-start justify-between">
        <div className="p-4 rounded-2xl mb-4" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>{icon}</div>
        <Button variant="ghost" onClick={onManage} className="text-[10px] font-black uppercase text-slate-400">View All →</Button>
      </div>
      <Button 
        onClick={onAdd}
        className="w-full py-7 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white transition-all active:scale-95 border-none"
        style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)` }}
      >
        <Plus className="h-4 w-4 mr-2 stroke-[3px]" /> Add New {title.split(' ')[0]}
      </Button>
    </div>
  </div>
);

export default BecomeHost;