import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Settings } from "lucide-react";

// Define the specified Teal color
const TEAL_COLOR = "#008080";
const TEAL_HOVER_COLOR = "#005555"; // A darker shade of teal for hover

// Helper function for primary button styles
const getTealButtonStyle = () => {
  return {
    backgroundColor: TEAL_COLOR,
    borderColor: TEAL_COLOR,
    color: 'white',
    transition: 'background-color 0.15s',
  };
};

const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  if (!e.currentTarget.disabled) {
    (e.currentTarget.style as any).backgroundColor = TEAL_HOVER_COLOR;
  }
};

const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  if (!e.currentTarget.disabled) {
    (e.currentTarget.style as any).backgroundColor = TEAL_COLOR;
  }
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
        // Check if user is admin
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

        // Fetch current settings
        const { data: settingsData, error } = await supabase
          .from("referral_settings")
          .select("*")
          .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows found (expected for new setup)

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
    // 1. Validation: Commission rate cannot exceed service fee
    const validationErrors = [];
    // Renaming Adventure Place to be consistent with the label for clarity in validation
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
      // Fetch the ID of the single referral_settings row
      const { data: existingSettings, error: fetchError } = await supabase
        .from("referral_settings")
        .select("id")
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; // Ignore "no rows" error

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
        // Update existing row
        const { error } = await supabase
          .from("referral_settings")
          .update(updateData)
          .eq("id", existingSettings.id);
        saveError = error;
      } else {
        // Insert new row if none exists (assuming the table is configured for a single-row design)
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
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-48 mb-8" />
          <Skeleton className="h-96 w-full max-w-2xl mx-auto" />
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }


  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {/* The main content area uses flex-1, which allows it to grow and the content inside it to scroll if it overflows the viewport, satisfying the small screen scroll requirement. */}
      <main className="flex-1 container mx-auto px-4 py-8 pb-24 md:pb-8 overflow-y-auto"> 
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/account")}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Account
          </Button>

          <h1 className="text-3xl font-bold mb-8 text-foreground flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Set Referral Commission
          </h1>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Category Service Fees & Commission Rates</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure platform service fees and referral commission rates by category
                </p>
                {/* Visual aid for the calculation structure */}
                <div className="p-3 mt-2 bg-slate-50 border-l-4 border-teal-500 rounded-r text-xs">
                    <p className="font-semibold text-teal-700">Formula Hint:</p>
                    <p>Referral Payout = Booking Value $\times$ (Service Fee %) $\times$ (Commission Rate % / 100)</p>
                    <p className="mt-1 text-red-600">⚠️ **Commission Rate (%)** must be $\leq$ **Service Fee (%)** to avoid platform loss.</p>
                </div>
                
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Trip */}
                  <div className="space-y-4 p-4 border border-border rounded-lg">
                    <h3 className="font-semibold text-foreground">Trip</h3>
                    <div>
                      <Label htmlFor="tripServiceFee">Service Fee (%)</Label>
                      <Input
                        id="tripServiceFee"
                        type="number"
                        value={settings.tripServiceFee}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            tripServiceFee: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max="100"
                        step="0.1"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tripRate">Referral Commission (% of Service Fee)</Label>
                      <Input
                        id="tripRate"
                        type="number"
                        value={settings.tripCommissionRate}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            tripCommissionRate: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max={settings.tripServiceFee}
                        step="0.1"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  {/* Event */}
                  <div className="space-y-4 p-4 border border-border rounded-lg">
                    <h3 className="font-semibold text-foreground">Event</h3>
                    <div>
                      <Label htmlFor="eventServiceFee">Service Fee (%)</Label>
                      <Input
                        id="eventServiceFee"
                        type="number"
                        value={settings.eventServiceFee}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            eventServiceFee: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max="100"
                        step="0.1"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="eventRate">Referral Commission (% of Service Fee)</Label>
                      <Input
                        id="eventRate"
                        type="number"
                        value={settings.eventCommissionRate}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            eventCommissionRate: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max={settings.eventServiceFee}
                        step="0.1"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  {/* Hotel */}
                  <div className="space-y-4 p-4 border border-border rounded-lg">
                    <h3 className="font-semibold text-foreground">Hotel</h3>
                    <div>
                      <Label htmlFor="hotelServiceFee">Service Fee (%)</Label>
                      <Input
                        id="hotelServiceFee"
                        type="number"
                        value={settings.hotelServiceFee}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            hotelServiceFee: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max="100"
                        step="0.1"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hotelRate">Referral Commission (% of Service Fee)</Label>
                      <Input
                        id="hotelRate"
                        type="number"
                        value={settings.hotelCommissionRate}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            hotelCommissionRate: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max={settings.hotelServiceFee}
                        step="0.1"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  {/* Attraction */}
                  <div className="space-y-4 p-4 border border-border rounded-lg">
                    <h3 className="font-semibold text-foreground">Attraction</h3>
                    <div>
                      <Label htmlFor="attractionServiceFee">Service Fee (%)</Label>
                      <Input
                        id="attractionServiceFee"
                        type="number"
                        value={settings.attractionServiceFee}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            attractionServiceFee: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max="100"
                        step="0.1"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="attractionRate">Referral Commission (% of Service Fee)</Label>
                      <Input
                        id="attractionRate"
                        type="number"
                        value={settings.attractionCommissionRate}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            attractionCommissionRate: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max={settings.attractionServiceFee}
                        step="0.1"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  {/* Campsite/Experience */}
                  <div className="space-y-4 p-4 border border-border rounded-lg">
                    <h3 className="font-semibold text-foreground">Campsite/Experience</h3>
                    <div>
                      <Label htmlFor="adventurePlaceServiceFee">Service Fee (%)</Label>
                      <Input
                        id="adventurePlaceServiceFee"
                        type="number"
                        value={settings.adventurePlaceServiceFee}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            adventurePlaceServiceFee: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max="100"
                        step="0.1"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="adventurePlaceRate">Referral Commission (% of Service Fee)</Label>
                      <Input
                        id="adventurePlaceRate"
                        type="number"
                        value={settings.adventurePlaceCommissionRate}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            adventurePlaceCommissionRate: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max={settings.adventurePlaceServiceFee}
                        step="0.1"
                        className="mt-2"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Referral commission is deducted from the platform service fee, not the gross booking amount
                </p>
              </CardContent>
            </Card>


            {/* Color change applied here */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full"
              style={getTealButtonStyle()}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {saving ? "Saving..." : "Save All Settings"}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}