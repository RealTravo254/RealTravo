import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plane, Building, Tent, Plus, ArrowLeft, LayoutDashboard, Map, Building2, Users } from "lucide-react";

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
  const [hostType, setHostType] = useState<HostType | null>(null);
  const [showTypeSelection, setShowTypeSelection] = useState(false);
  const [hasVerification, setHasVerification] = useState(false);
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
        // Check profile completion
        const { data: profileData } = await supabase.from('profiles').select('profile_completed').eq('id', user.id).single();
        if (cancelled) return;
        if (profileData && !profileData.profile_completed) {
          navigate('/complete-profile');
          return;
        }

        // Check host verification
        const { data: verification, error: verificationError } = await supabase
          .from("host_verifications")
          .select("status, hosting_category")
          .eq("user_id", user.id)
          .single();

        // Check company
        const { data: company } = await supabase
          .from("companies")
          .select("verification_status")
          .eq("user_id", user.id)
          .single();

        if (cancelled) return;

        const hasV = verification && !verificationError;
        setHasVerification(!!hasV);
        setVerificationStatus(verification?.status || null);
        setHostingCategory(verification?.hosting_category as HostingCategory || null);
        setHasCompany(!!company);
        setCompanyStatus(company?.verification_status || null);

        // Determine what to show
        const isGuideApproved = hasV && verification?.status === "approved" && verification?.hosting_category === "guide";
        const isCampsiteHost = hasV && verification?.hosting_category === "campsite";
        const isCompanyApproved = company && company.verification_status === "approved";
        const isVerifiedNoCategory = hasV && verification?.status === "approved" && !verification?.hosting_category;

        // If no verification at all and no company, show type selection (includes event option)
        if (!hasV && !company) {
          setShowTypeSelection(true);
          setLoading(false);
          return;
        }

        // Pending verification - but still allow showing the page for campsite hosts
        if (hasV && verification?.status === "pending" && verification?.hosting_category !== "campsite") {
          navigate("/verification-status");
          return;
        }
        if (hasV && verification?.status === "rejected") {
          navigate("/host-verification");
          return;
        }
        if (company && company.verification_status === "pending") {
          navigate("/verification-status");
          return;
        }

        // Load content for hosts
        const [trips, hotels, adventures] = await Promise.all([
          supabase.from("trips").select("id,name,type,approval_status").eq("created_by", user.id),
          supabase.from("hotels").select("id,name,approval_status").eq("created_by", user.id),
          supabase.from("adventure_places").select("id,name,approval_status").eq("created_by", user.id)
        ]);

        if (cancelled) return;

        // Track pending adventures for "waiting for verification" display
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
    setHostType(type);
    
    if (type === 'guide') {
      // Guide: needs basic verification, then can host flexible trips
      navigate("/host-verification?category=guide");
    } else if (type === 'campsite') {
      // Campsite: no verification needed, redirect to create adventure place directly
      toast({ title: "Welcome!", description: "You can now create your adventure place listing." });
      navigate("/create-adventure");
    } else if (type === 'company') {
      // Company: redirect to company registration
      navigate("/host-verification?category=company");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 border-4 border-[#008080] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Checking your host status...</p>
      </div>
    </div>
  );

  // Show hosting type selection
  if (showTypeSelection) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8 mx-auto mb-24 md:mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full bg-white shadow-sm border border-slate-100 hover:bg-slate-50">
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Button>
            <div>
              <Badge className="bg-[#008080] hover:bg-[#008080] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Become a Host
              </Badge>
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none text-slate-900 mb-2">
            How do you want to <span style={{ color: COLORS.CORAL }}>host?</span>
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-8">
            Choose your hosting type to get started
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Guide Card */}
            <button
              onClick={() => handleHostTypeSelect('guide')}
              className="group relative bg-white rounded-[24px] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 text-left p-6"
            >
              <div className="p-4 rounded-2xl bg-blue-50 w-fit mb-4 group-hover:bg-[#008080] transition-colors">
                <Map className="h-8 w-8 text-blue-600 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2">Tour Guide</h3>
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                Host flexible trips, guided tours and events. Share your knowledge and guide travelers.
              </p>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  <span>Flexible trips & events only</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  <span>Basic verification required</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  <span>Cannot host fixed trips, hotels or campsites</span>
                </div>
              </div>
              <div className="mt-6 py-2.5 rounded-xl text-center text-xs font-bold uppercase tracking-widest border-2 border-slate-200 group-hover:border-[#008080] group-hover:text-[#008080] transition-colors">
                Get Started →
              </div>
            </button>

            {/* Campsite/Adventure Card */}
            <button
              onClick={() => handleHostTypeSelect('campsite')}
              className="group relative bg-white rounded-[24px] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 text-left p-6"
            >
              <div className="p-4 rounded-2xl bg-emerald-50 w-fit mb-4 group-hover:bg-[#008080] transition-colors">
                <Tent className="h-8 w-8 text-emerald-600 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2">Campsite / Adventure</h3>
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                List your campsite or adventure place. You can also host events. No verification needed.
              </p>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  <span>No verification required</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  <span>Host adventure places & events</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  <span>Cannot host flexible trips or hotels</span>
                </div>
              </div>
              <div className="mt-6 py-2.5 rounded-xl text-center text-xs font-bold uppercase tracking-widest border-2 border-slate-200 group-hover:border-[#008080] group-hover:text-[#008080] transition-colors">
                Start Now →
              </div>
            </button>

            {/* Company Card */}
            <button
              onClick={() => handleHostTypeSelect('company')}
              className="group relative bg-white rounded-[24px] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 text-left p-6"
            >
              <div className="p-4 rounded-2xl bg-orange-50 w-fit mb-4 group-hover:bg-[#008080] transition-colors">
                <Building2 className="h-8 w-8 text-orange-600 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2">Register Company</h3>
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                Register your travel company to host fixed-date trips, events and accommodation. Company verification required.
              </p>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                  <span>Company verification required</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  <span>Host fixed-date trips & hotels</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  <span>Cannot host campsites or flexible trips</span>
                </div>
              </div>
              <div className="mt-6 py-2.5 rounded-xl text-center text-xs font-bold uppercase tracking-widest border-2 border-slate-200 group-hover:border-[#008080] group-hover:text-[#008080] transition-colors">
                Register →
              </div>
            </button>
          </div>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  // Show host dashboard for approved hosts
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <Header />
      
      <main className="flex-1 container px-4 py-12 mx-auto mb-24 md:mb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full bg-white shadow-sm border border-slate-100 hover:bg-slate-50">
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </Button>
              <Badge className="bg-[#008080] hover:bg-[#008080] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Host Dashboard
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none text-slate-900">
              Manage Your <span style={{ color: COLORS.CORAL }}>Inventory</span>
            </h1>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">
              Create and monitor your listings across the platform
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-white p-4 rounded-[24px] shadow-sm border border-slate-100">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[#F0E68C]/20">
              <LayoutDashboard className="h-5 w-5 text-[#857F3E]" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Assets</p>
              <p className="text-xl font-black text-slate-800">{myContent.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Fixed Trips - visible for companies or legacy verified users */}
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

          {/* Flexible/Guided Trips - visible for guides, companies, or legacy verified users */}
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

          {/* Events - visible for guides, campsites, companies, or legacy verified users */}
          {((hasCompany && companyStatus === 'approved') || 
            (hostingCategory === 'guide' && verificationStatus === 'approved') || 
            hostingCategory === 'campsite' ||
            (verificationStatus === 'approved' && !hostingCategory)) && (
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
          )}

          {/* Adventure Places - only for campsite hosts who haven't created one yet, or legacy users */}
          {(hostingCategory === 'campsite' || (verificationStatus === 'approved' && !hostingCategory)) && 
           !(hasCompany && companyStatus === 'approved') && 
           myContent.filter(i => i.contentType === 'adventure').length === 0 && (
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

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

interface CardProps {
  title: string;
  subtitle: string;
  image: string;
  icon: React.ReactNode;
  count: number;
  onManage: () => void;
  onAdd: () => void;
  accentColor: string;
}

const HostCategoryCard = ({ title, subtitle, image, icon, count, onManage, onAdd, accentColor }: CardProps) => (
  <div className="group relative bg-white rounded-[32px] overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 border border-slate-100 flex flex-col h-[420px]">
    <div className="relative h-1/2 overflow-hidden">
      <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      
      <div className="absolute top-4 left-4">
        <Badge className="bg-white/20 backdrop-blur-md text-white border-none py-1.5 px-3 rounded-full text-[10px] font-black uppercase tracking-widest">
          {count} Listings
        </Badge>
      </div>

      <div className="absolute bottom-4 left-6 right-6">
        <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] mb-1">{subtitle}</p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{title}</h2>
      </div>
    </div>

    <div className="p-8 flex flex-col justify-between flex-1 bg-white">
      <div className="flex items-start justify-between">
        <div className="p-4 rounded-2xl mb-4" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
          {icon}
        </div>
        <Button variant="ghost" onClick={onManage} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900">
          View All →
        </Button>
      </div>

      <Button 
        onClick={onAdd}
        className="w-full py-7 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all active:scale-95 border-none"
        style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)`, boxShadow: `0 8px 20px -6px ${accentColor}88` }}
      >
        <Plus className="h-4 w-4 mr-2 stroke-[3px]" />
        Add New {title.split(' ')[0]}
      </Button>
    </div>
  </div>
);

export default BecomeHost;
