import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plane, Plus, ArrowLeft, LayoutDashboard, Map, Building2, Tent } from "lucide-react";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  KHAKI_DARK: "#857F3E", 
  SOFT_GRAY: "#F8F9FA"
};

type HostType = 'guide' | 'company' | 'adventure';
type HostingCategory = 'guide' | 'company' | 'adventure' | null;

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

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const { data: profileData } = await supabase.from('profiles').select('profile_completed, is_banned').eq(user.id, user.id).single();
        if (cancelled) return;

        if (profileData?.is_banned) {
          toast({ title: "Account Banned", description: "You have been banned from hosting.", variant: "destructive" });
          navigate('/');
          return;
        }

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
        const currentCategory = verification?.hosting_category as HostingCategory || null;
        
        setVerificationStatus(verification?.status || null);
        setHostingCategory(currentCategory);
        setHasCompany(!!company);
        setCompanyStatus(company?.verification_status || null);

        // Adventure hosts bypass verification hurdles completely
        const isAdventureHost = currentCategory === 'adventure';

        // Direct to selection panel if they are entirely new
        if (!hasV && !company) {
          setShowTypeSelection(true);
          setLoading(false);
          return;
        }

        // Enforce approval restrictions only for non-adventure pathways
        if (!isAdventureHost) {
          const isApprovedGuide = verification?.status === 'approved';
          const isApprovedCompany = company?.verification_status === 'approved';
          
          if (!isApprovedGuide && !isApprovedCompany) {
            setShowTypeSelection(true);
            setLoading(false);
            return;
          }
        }

        // Populate dashboard assets
        const [trips, hotels] = await Promise.all([
          supabase.from("trips").select("id,name,type").eq("created_by", user.id),
          supabase.from("hotels").select("id,name,category").eq("created_by", user.id),
        ]);

        if (cancelled) return;

        const allContent = [
          ...(trips.data?.map(t => ({ ...t, contentType: 'trip' })) || []),
          ...(hotels.data?.map(h => ({ ...h, contentType: 'hotel' })) || []),
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

  const handleHostTypeSelect = (type: HostType) => {
    if (type === 'adventure') {
      navigate("/create-adventure");
    } else {
      navigate(`/host-verification?category=${type}`);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
      <div className="h-10 w-10 border-4 border-[#008080] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (showTypeSelection) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8 mx-auto mb-24">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full bg-white shadow-sm border">
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Button>
            <Badge className="bg-[#008080] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              Become a Host
            </Badge>
          </div>

          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 mb-8">
            Choose your <span style={{ color: COLORS.CORAL }}>Hosting Type</span>
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SelectionCard
              icon={<Tent className="h-8 w-8 text-emerald-600" />}
              title="Adventure Place"
              desc="List your campsite, park, or private adventure destination instantly."
              onClick={() => handleHostTypeSelect('adventure')}
              bg="bg-emerald-50"
            />
            <SelectionCard
              icon={<Map className="h-8 w-8 text-blue-600" />}
              title="Tour Guide"
              desc="Host flexible trips and guided tours."
              onClick={() => handleHostTypeSelect('guide')}
              bg="bg-blue-50"
            />
            <SelectionCard
              icon={<Building2 className="h-8 w-8 text-orange-600" />}
              title="Register Company"
              desc="Host fixed-date trips and hotels via your business."
              onClick={() => handleHostTypeSelect('company')}
              bg="bg-orange-50"
            />
          </div>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-12 mx-auto mb-24">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900">
            Manage <span style={{ color: COLORS.CORAL }}>Inventory</span>
          </h1>
          <div className="bg-white p-4 rounded-[24px] shadow-sm border flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-[#857F3E]" />
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Assets</p>
              <p className="text-xl font-black text-slate-800">{myContent.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Adventure Dashboard Card */}
          {hostingCategory === 'adventure' && (
            <HostCategoryCard
              title="Adventure Places"
              subtitle="Campsites & Parks"
              image="/images/category-campsite.webp"
              icon={<Tent className="h-8 w-8" />}
              count={myContent.filter(i => i.contentType === 'hotel').length}
              onManage={() => navigate("/host/hotels")}
              onAdd={() => navigate("/create-adventure")}
              accentColor={COLORS.KHAKI_DARK}
            />
          )}

          {/* Standard Host Dashboard Card */}
          {hostingCategory !== 'adventure' && (verificationStatus === 'approved' || companyStatus === 'approved') && (
            <>
              <HostCategoryCard
                title="Trips & Tours"
                subtitle="Guided Experiences"
                image="/images/category-trips.webp"
                icon={<Map className="h-8 w-8" />}
                count={myContent.filter(i => i.contentType === 'trip').length}
                onManage={() => navigate("/host/trips")}
                onAdd={() => navigate("/create-trip")}
                accentColor={COLORS.TEAL}
              />
            </>
          )}
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

const SelectionCard = ({ icon, title, desc, onClick, bg }: any) => (
  <button onClick={onClick} className="group bg-white rounded-[24px] p-6 shadow-lg border border-slate-100 text-left transition-all hover:shadow-xl hover:-translate-y-1">
    <div className={`p-4 rounded-2xl w-fit mb-4 ${bg} group-hover:bg-[#008080] transition-colors`}>
      <div className="group-hover:text-white transition-colors">{icon}</div>
    </div>
    <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2">{title}</h3>
    <p className="text-sm text-slate-500 leading-relaxed mb-6">{desc}</p>
    <div className="py-2.5 rounded-xl text-center text-xs font-bold uppercase tracking-widest border-2 border-slate-200 group-hover:border-[#008080] group-hover:text-[#008080] transition-colors">
      Start →
    </div>
  </button>
);

const HostCategoryCard = ({ title, subtitle, image, icon, count, onManage, onAdd, accentColor }: any) => (
  <div className="group bg-white rounded-[24px] overflow-hidden shadow-xl border border-slate-100 flex flex-col h-[320px] md:h-[160px] md:flex-row">
    <div className="relative h-1/2 md:h-full md:w-56 md:shrink-0 overflow-hidden">
      <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/80 via-black/30 to-transparent" />
      <div className="absolute top-2 left-2 md:top-3 md:left-3">
        <Badge className="bg-white/20 backdrop-blur-md text-white border-none text-[9px] font-black uppercase">{count} Listings</Badge>
      </div>
      <div className="absolute bottom-2 left-3 md:bottom-3 md:left-3">
        <p className="text-[8px] font-black text-white/70 uppercase tracking-widest">{subtitle}</p>
        <h2 className="text-base md:text-lg font-black text-white uppercase tracking-tighter">{title}</h2>
      </div>
    </div>
    <div className="p-4 md:px-6 md:py-4 flex flex-col justify-between flex-1">
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-xl" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
          <div className="scale-75 origin-center">{icon}</div>
        </div>
        <Button variant="ghost" onClick={onManage} className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 px-2">All →</Button>
      </div>
      <Button
        onClick={onAdd}
        className="w-full py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 border-none"
        style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)` }}
      >
        <Plus className="h-3 w-3 mr-1 stroke-[3px]" /> Add {title.split(' ')[0]}
      </Button>
    </div>
  </div>
);

export default BecomeHost;