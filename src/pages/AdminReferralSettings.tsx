import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Settings, Info, Percent, ShieldCheck } from "lucide-react";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

export default function AdminReferralSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [settings, setSettings] = useState({
    tripCommissionRate: 5.0,
    eventCommissionRate: 5.0,
    hotelCommissionRate: 5.0,
    attractionCommissionRate: 5.0,
    adventurePlaceCommissionRate: 5.0,
    tripServiceFee: 20.0,
    eventServiceFee: 20.0,
    hotelServiceFee: 20.0,
    attractionServiceFee: 20.0,
    adventurePlaceServiceFee: 20.0,
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const checkAdminAndFetchSettings = async () => {
      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const isUserAdmin = roles?.some((r) => r.role === "admin") || false;
        setIsAdmin(isUserAdmin);

        if (!isUserAdmin) {
          navigate("/account");
          return;
        }

        const { data: settingsData, error } = await supabase
          .from("referral_settings")
          .select("*")
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (settingsData) {
          setSettings({
            tripCommissionRate: Number(settingsData.trip_commission_rate || 5.0),
            eventCommissionRate: Number(settingsData.event_commission_rate || 5.0),
            hotelCommissionRate: Number(settingsData.hotel_commission_rate || 5.0),
            attractionCommissionRate: Number(settingsData.attraction_commission_rate || 5.0),
            adventurePlaceCommissionRate: Number(settingsData.adventure_place_commission_rate || 5.0),
            tripServiceFee: Number(settingsData.trip_service_fee || 20.0),
            eventServiceFee: Number(settingsData.event_service_fee || 20.0),
            hotelServiceFee: Number(settingsData.hotel_service_fee || 20.0),
            attractionServiceFee: Number(settingsData.attraction_service_fee || 20.0),
            adventurePlaceServiceFee: Number(settingsData.adventure_place_service_fee || 20.0),
          });
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching settings:", error);
        setLoading(false);
      }
    };

    checkAdminAndFetchSettings();
  }, [user, navigate]);

  const handleSave = async () => {
    const validationErrors = [];
    if (settings.tripCommissionRate > settings.tripServiceFee) validationErrors.push("Trip");
    if (settings.eventCommissionRate > settings.eventServiceFee) validationErrors.push("Event");
    if (settings.hotelCommissionRate > settings.hotelServiceFee) validationErrors.push("Hotel");
    if (settings.attractionCommissionRate > settings.attractionServiceFee) validationErrors.push("Attraction");
    if (settings.adventurePlaceCommissionRate > settings.adventurePlaceServiceFee) validationErrors.push("Campsite/Experience");

    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: `Commission rate cannot exceed service fee for: ${validationErrors.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: existingSettings, error: fetchError } = await supabase
        .from("referral_settings")
        .select("id")
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      const updateData = {
        trip_commission_rate: settings.tripCommissionRate,
        event_commission_rate: settings.eventCommissionRate,
        hotel_commission_rate: settings.hotelCommissionRate,
        attraction_commission_rate: settings.attractionCommissionRate,
        adventure_place_commission_rate: settings.adventurePlaceCommissionRate,
        trip_service_fee: settings.tripServiceFee,
        event_service_fee: settings.eventServiceFee,
        hotel_service_fee: settings.hotelServiceFee,
        attraction_service_fee: settings.attractionServiceFee,
        adventure_place_service_fee: settings.adventurePlaceServiceFee,
      };

      let saveError;
      if (existingSettings) {
        const { error } = await supabase
          .from("referral_settings")
          .update(updateData)
          .eq("id", existingSettings.id);
        saveError = error;
      } else {
        const { error } = await supabase
          .from("referral_settings")
          .insert([updateData]);
        saveError = error;
      }
      
      if (saveError) throw saveError;

      toast({
        title: "Success",
        description: "Referral commission settings updated successfully",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-64 rounded-2xl mb-8" />
          <Skeleton className="h-[600px] w-full max-w-4xl mx-auto rounded-[28px]" />
        </main>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      
      <main className="container px-4 max-w-4xl mx-auto py-8">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate("/account")}
              className="p-0 hover:bg-transparent text-slate-500 hover:text-[#008080] transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="text-[10px] font-black uppercase tracking-widest">Back to Account</span>
            </Button>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none flex items-center gap-3">
              <Settings className="h-8 w-8 text-[#008080]" />
              Referral Control
            </h1>
          </div>
          
          <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 flex items-center gap-2 self-start md:self-center shadow-sm">
            <ShieldCheck className="h-4 w-4 text-[#008080]" />
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Admin Authorization Active</span>
          </div>
        </div>

        {/* Info formula card */}
        <div className="bg-[#F0E68C]/20 border border-[#F0E68C] rounded-[24px] p-6 mb-8 flex gap-4">
          <div className="bg-white p-2 rounded-xl h-fit shadow-sm">
            <Info className="h-5 w-5 text-[#857F3E]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#857F3E]">Formula Logic</h3>
            <p className="text-sm font-medium text-slate-700">
              Referral Payout = Booking Value $\times$ (Service Fee %) $\times$ (Commission Rate % / 100)
            </p>
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-tighter mt-1">
              ⚠️ Commission Rate must never exceed Service Fee
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-8">
                <Percent className="h-5 w-5 text-[#FF7F50]" />
                <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>
                    Platform Rates
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { id: 'trip', label: 'Trips & Tours' },
                { id: 'event', label: 'Events & Experiences' },
                { id: 'hotel', label: 'Hotels & Stays' },
                { id: 'attraction', label: 'Attractions' },
                { id: 'adventurePlace', label: 'Campsites' }
              ].map((cat) => (
                <div key={cat.id} className="space-y-5 p-6 bg-slate-50/50 rounded-[22px] border border-slate-100 transition-all hover:shadow-md">
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#008080] border-b border-slate-100 pb-2">
                    {cat.label}
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label 
                        htmlFor={`${cat.id}ServiceFee`}
                        className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1"
                      >
                        Service Fee (%)
                      </Label>
                      <div className="relative">
                        <Input
                          id={`${cat.id}ServiceFee`}
                          type="number"
                          className="bg-white rounded-xl border-slate-200 h-11 focus:ring-[#008080] font-bold"
                          value={(settings as any)[`${cat.id}ServiceFee`]}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              [`${cat.id}ServiceFee`]: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">%</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label 
                        htmlFor={`${cat.id}Rate`}
                        className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1"
                      >
                        Commission (%)
                      </Label>
                      <div className="relative">
                        <Input
                          id={`${cat.id}Rate`}
                          type="number"
                          className="bg-white rounded-xl border-slate-200 h-11 focus:ring-[#008080] font-bold"
                          value={(settings as any)[`${cat.id}CommissionRate`]}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              [`${cat.id}CommissionRate`]: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
                    style={{ 
                        background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
                        boxShadow: `0 12px 24px -8px ${COLORS.CORAL}88`
                    }}
                >
                    {saving ? "Processing..." : "Deploy New Rates"}
                </Button>
            </div>
          </div>
        </div>
      </main>

      <MobileBottomBar />
    </div>
  );
}