import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { 
  ChevronRight, 
  Tent, 
  Plus, 
  ArrowLeft, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  EyeOff 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  SOFT_GRAY: "#F8F9FA",
  RED: "#FF0000"
};

interface Experience {
  id: string;
  name: string;
  location: string;
  approval_status: string;
  is_hidden?: boolean;
  created_at: string;
  image_url?: string;
}

const CategoryExperiences = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchExperiences();
  }, [user, navigate]);

  const fetchExperiences = async () => {
    try {
      const { data, error } = await supabase
        .from("adventure_places")
        .select("id, name, location, approval_status, is_hidden, created_at, image_url")
        .eq("created_by", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExperiences(data || []);
    } catch (error) {
      console.error("Error fetching experiences:", error);
    } finally {
      setLoading(false);
    }
  };

  const StatusDisplay = ({ status, isHidden }: { status: string, isHidden?: boolean }) => {
    if (isHidden) return (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
        <EyeOff className="h-3 w-3 text-slate-500" />
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Hidden</span>
      </div>
    );

    const configs: Record<string, { label: string, color: string, icon: any }> = {
      approved: { label: "Live", color: "#22c55e", icon: CheckCircle2 },
      pending: { label: "Review", color: COLORS.CORAL, icon: Clock },
      rejected: { label: "Issue", color: COLORS.RED, icon: XCircle },
    };

    const config = configs[status] || configs.pending;
    const Icon = config.icon;

    return (
      <div 
        className="flex items-center gap-1.5 px-3 py-1 rounded-full border"
        style={{ backgroundColor: `${config.color}10`, borderColor: `${config.color}30` }}
      >
        <Icon className="h-3 w-3" style={{ color: config.color }} />
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: config.color }}>
          {config.label}
        </span>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F8F9FA] animate-pulse">
        <Header className="hidden md:block" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* Hero Header Section */}
      <div className="bg-white border-b border-slate-100 pt-12 pb-8 md:pt-20">
        <div className="container px-4 max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate("/become-host")}
                className="p-0 h-auto hover:bg-transparent text-slate-400 hover:text-[#008080] transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Dashboard</span>
              </Button>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none text-slate-900">
                My <span style={{ color: COLORS.TEAL }}>Experiences</span>
              </h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                Manage your listings and booking availability
              </p>
            </div>
            
            <Button 
              onClick={() => navigate("/create-adventure")}
              className="rounded-2xl px-6 py-6 h-auto text-xs font-black uppercase tracking-[0.15em] shadow-lg transition-all active:scale-95 border-none text-white"
              style={{ 
                background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT || '#FF9E7A'} 0%, ${COLORS.CORAL} 100%)`,
                boxShadow: `0 8px 20px -6px ${COLORS.CORAL}88`
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
        </div>
      </div>

      <main className="container px-4 py-10 max-w-4xl mx-auto">
        {experiences.length === 0 ? (
          <div className="bg-white rounded-[32px] p-12 text-center border border-slate-100 shadow-sm mt-8">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Tent className="h-10 w-10 text-slate-200" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 mb-2">No active listings</h3>
            <p className="text-slate-400 text-sm mb-8 max-w-xs mx-auto">Ready to share your next adventure with the community?</p>
            <Button 
              onClick={() => navigate("/create-adventure")}
              variant="outline"
              className="rounded-xl border-2 font-black uppercase tracking-widest text-[10px] px-8"
              style={{ color: COLORS.TEAL, borderColor: COLORS.TEAL }}
            >
              Start Creating
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {experiences.map((experience) => (
              <button
                key={experience.id}
                onClick={() => navigate(`/edit-listing/adventure/${experience.id}`)}
                className="w-full group bg-white rounded-[28px] p-4 flex items-center gap-4 border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#008080]/20 transition-all text-left relative overflow-hidden"
              >
                {/* Image/Icon Thumbnail */}
                <div className="h-20 w-20 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 relative">
                    {experience.image_url ? (
                        <img src={experience.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Tent className="h-8 w-8 text-slate-300" />
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusDisplay status={experience.approval_status} isHidden={experience.is_hidden} />
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                        ID: {experience.id.slice(0, 8)}
                    </span>
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 truncate mb-1">
                    {experience.name}
                  </h3>
                  <div className="flex items-center text-slate-400 gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="text-[10px] font-bold uppercase tracking-tight truncate">
                        {experience.location}
                    </span>
                  </div>
                </div>

                {/* Action Icon */}
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#008080] group-hover:text-white transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <MobileBottomBar />
    </div>
  );
};

export default CategoryExperiences;