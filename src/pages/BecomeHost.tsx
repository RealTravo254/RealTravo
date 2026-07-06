import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Plus, ArrowLeft, LayoutDashboard, Map, Building2, Tent, Home,
  Clock, CheckCircle2, XCircle, MapPin, RefreshCw, Ban, Info,
} from "lucide-react";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  KHAKI_DARK: "#857F3E",
};

type ViewState =
  | { screen: "loading" }
  | { screen: "banned" }
  | { screen: "redirect"; to: string }
  | { screen: "type-selection" }
  | { screen: "adventure-pending"; place: any }
  | { screen: "adventure-no-place" }
  | { screen: "adventure-rejected"; place: any }
  | { screen: "adventure-accommodation-dashboard"; places: any[] }
  | { screen: "guide-company-dashboard"; content: any[] };

// ── Sub-components ────────────────────────────────────────────────────────────

const SelectionCard = ({ icon, title, desc, onClick, bg }: any) => (
  <button
    onClick={onClick}
    className="group bg-white rounded-[24px] p-6 shadow-lg border border-slate-100 text-left transition-all hover:shadow-xl hover:-translate-y-1"
  >
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
      {/* ── "Add Trip" / create-trip entry point disabled ──────────────────────
          Creating new trips and events is temporarily hidden. Guests already
          approved as a guide/company can still view and manage existing
          listings via "All →" above — they just can't create new ones from
          here right now. Uncomment to restore the create flow.
      <Button
        onClick={onAdd}
        className="w-full py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 border-none"
        style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)` }}
      >
        <Plus className="h-3 w-3 mr-1 stroke-[3px]" /> Add {title.split(" ")[0]}
      </Button>
      */}
    </div>
  </div>
);

const AdventurePendingCard = ({ place }: { place: any }) => {
  const imageUrl = place.image_url || place.gallery_images?.[0] || place.images?.[0];
  return (
    <div className="bg-white rounded-[28px] overflow-hidden shadow-xl border border-slate-100">
      <div className="relative h-48 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={place.name} className="w-full h-full object-cover brightness-75" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center">
            <Tent className="h-14 w-14 text-amber-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wide bg-amber-50 text-amber-700 border-amber-300">
          <Clock className="h-3.5 w-3.5 text-amber-500" /> Under Review
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-0.5">Your Listing</p>
          <h3 className="text-xl font-black text-white uppercase tracking-tight leading-tight line-clamp-1">{place.name}</h3>
          {(place.location || place.place) && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 text-white/70" />
              <p className="text-[11px] text-white/75 font-semibold">
                {[place.place, place.location].filter(Boolean).join(", ")}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-3 p-4 rounded-2xl border bg-amber-50 border-amber-200">
          <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-black text-amber-800 uppercase tracking-wide mb-1">Pending Approval</p>
            <p className="text-[12px] text-amber-700 font-medium leading-relaxed">
              Your listing has been submitted and is currently being reviewed by our team. We'll notify you once it goes live. This usually takes 24–48 hours.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {[
            { done: true,  label: "Submission received" },
            { done: false, label: "Admin review in progress" },
            { done: false, label: "Published & live for bookings" },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? "bg-emerald-100" : "bg-slate-100"}`}>
                {step.done ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <span className="w-2 h-2 rounded-full bg-slate-300 block" />}
              </div>
              <p className={`text-[11px] font-bold uppercase tracking-wide ${step.done ? "text-emerald-600" : "text-slate-400"}`}>
                {step.label}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 px-1">
          <Info className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-400 leading-relaxed">
            You cannot submit another listing while this submission is under review.
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Accommodation card (used once approved — supports multiple listings) ─────
const AccommodationCard = ({ place, onManage }: { place: any; onManage: () => void }) => {
  const imageUrl = place.image_url || place.gallery_images?.[0];
  return (
    <div className="bg-white rounded-[24px] overflow-hidden shadow-lg border border-slate-100 flex flex-col">
      <div className="relative h-40 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={place.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
            <Home className="h-10 w-10 text-emerald-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute top-3 left-3">
          <Badge className="bg-emerald-500 text-white border-none text-[9px] font-black uppercase">Live</Badge>
        </div>
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-base font-black text-white uppercase tracking-tight line-clamp-1">{place.name}</h3>
          {(place.place || place.location) && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 text-white/70" />
              <p className="text-[11px] text-white/75 font-semibold">
                {[place.place, place.location].filter(Boolean).join(", ")}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="p-4 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accommodation</span>
        <Button variant="ghost" onClick={onManage} className="text-[10px] font-black uppercase text-slate-400 px-2">Manage →</Button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const BecomeHost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>({ screen: "loading" });

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    let cancelled = false;

    const init = async () => {
      try {
        // ── 1. Profile check ─────────────────────────────────────────────────
        const { data: profileData } = await supabase
          .from("profiles")
          .select("profile_completed, is_banned")
          .eq("id", user.id)
          .single();

        if (cancelled) return;
        if (profileData?.is_banned) { setView({ screen: "banned" }); return; }
        if (profileData && !profileData.profile_completed) { navigate("/complete-profile"); return; }

        // ── 2. Guide/company check FIRST ─────────────────────────────────────
        // Approved guides and companies always go straight to the trips dashboard.
        // Adventure place logic is completely separate and does not interfere.
        const [{ data: verification }, { data: company }] = await Promise.all([
          supabase.from("host_verifications").select("status, hosting_category").eq("user_id", user.id).maybeSingle(),
          supabase.from("companies").select("verification_status").eq("user_id", user.id).maybeSingle(),
        ]);

        if (cancelled) return;

        const verStatus  = verification?.status ?? null;
        const compStatus = company?.verification_status ?? null;
        const isApprovedGuide   = verStatus === "approved";
        const isApprovedCompany = compStatus === "approved";

        if (isApprovedGuide || isApprovedCompany) {
          const [trips, hotels] = await Promise.all([
            supabase.from("trips").select("id,name,type").eq("created_by", user.id),
            supabase.from("hotels").select("id,name,category").eq("created_by", user.id),
          ]);

          if (cancelled) return;

          const allContent = [
            ...(trips.data?.map((t) => ({ ...t, contentType: "trip" })) ?? []),
            ...(hotels.data?.map((h) => ({ ...h, contentType: "hotel" })) ?? []),
          ];

          setView({ screen: "guide-company-dashboard", content: allContent });
          return;
        }

        // ── 3. Not a guide/company — check adventure place(s) ────────────────
        // NOTE: no .limit(1) here anymore — a user may hold several rows once
        // Accommodation listings are allowed to multiply after approval.
        const { data: advPlaces } = await supabase
          .from("adventure_places")
          .select("id, name, image_url, gallery_images, location, place, approval_status, category")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false });

        if (cancelled) return;

        const places = advPlaces ?? [];

        if (places.length === 0) {
          setView({ screen: "type-selection" });
          return;
        }

        const normStatus = (p: any) => (p.approval_status ?? "").toLowerCase().trim();
        const approved = places.filter((p) => normStatus(p) === "approved");
        const rejected = places.filter((p) => normStatus(p) === "rejected");
        const pending  = places.filter((p) => normStatus(p) !== "approved" && normStatus(p) !== "rejected");

        if (approved.length > 0) {
          const allAccommodation = approved.every((p) => p.category === "accommodation");

          if (allAccommodation) {
            // Accommodation hosts can hold multiple approved listings — show the
            // dashboard with an active "Add Accommodation" entry point.
            setView({ screen: "adventure-accommodation-dashboard", places: approved });
            return;
          }

          // Legacy single-listing hosting types (hotel/campsite/park/attraction)
          // remain capped at one listing and keep using /my-listing.
          setView({ screen: "redirect", to: "/my-listing" });
          return;
        }

        if (pending.length > 0) {
          setView({ screen: "adventure-pending", place: pending[0] });
          return;
        }

        if (rejected.length > 0) {
          setView({ screen: "adventure-rejected", place: rejected[0] });
          return;
        }

        // ── 4. Nothing matched — show type selection ──────────────────────────
        setView({ screen: "type-selection" });
      } catch (err) {
        console.error(err);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [user, navigate]);

  // ── Redirect ──────────────────────────────────────────────────────────────
  if (view.screen === "redirect") {
    navigate(view.to);
    return null;
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (view.screen === "loading") return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
      <div className="h-10 w-10 border-4 border-[#008080] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Banned ────────────────────────────────────────────────────────────────
  if (view.screen === "banned") return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16 mb-24">
        <div className="w-full max-w-md bg-white rounded-[28px] p-8 shadow-xl border border-red-100 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-5">
            <Ban className="h-8 w-8 text-red-500" />
          </div>
          <div className="mb-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest">
            Account Banned
          </div>
          <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-slate-900 mb-3">Hosting Access Restricted</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Your account has been banned from the Wanderer hosting programme. If you believe this is a mistake, please reach out to our support team.
          </p>
          <div className="border-t border-slate-100 my-5" />
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left mb-6">
            <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Banned accounts cannot create listings, manage trips, or accept bookings. Existing active listings may have been hidden from public view.
            </p>
          </div>
          <Button onClick={() => navigate("/")} variant="ghost" className="w-full rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50">
            <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Back to Home
          </Button>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );

  // ── Type Selection ────────────────────────────────────────────────────────
  if (view.screen === "type-selection") return (
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

        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 mb-4">
          Choose your <span style={{ color: COLORS.CORAL }}>Hosting Type</span>
        </h1>

        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 mb-8">
          <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
            <span className="font-black uppercase">Note:</span> Accommodation / Airbnb is a standalone hosting type — it cannot be combined with Tour Guide or Company hosting. Once your first listing is approved, you can add more Accommodation properties from your dashboard.
          </p>
        </div>

        {/* ── Tour Guide and Register Company hosting types disabled ──────────
            Only Accommodation / Airbnb hosting is offered right now. This also
            means guided trips, fixed-date trips, and events (which are created
            via the Tour Guide / Company paths) are not reachable from this page.
            Uncomment the two SelectionCards below, and restore the grid to
            grid-cols-1 md:grid-cols-3, to bring these hosting types back. */}
        <div className="grid grid-cols-1 gap-6">
          <div className="max-w-sm">
            <SelectionCard
              icon={<Home className="h-8 w-8 text-emerald-600" />}
              title="Accommodation / Airbnb"
              desc="List your home, apartment, or private stay. Once approved, you can add unlimited Accommodation listings from your dashboard."
              onClick={() => navigate("/create-adventure")}
              bg="bg-emerald-50"
            />
          </div>
          {/*
          <SelectionCard
            icon={<Map className="h-8 w-8 text-blue-600" />}
            title="Tour Guide"
            desc="Host flexible trips and guided tours."
            onClick={() => navigate("/host-verification?category=guide")}
            bg="bg-blue-50"
          />
          <SelectionCard
            icon={<Building2 className="h-8 w-8 text-orange-600" />}
            title="Register Company"
            desc="Host fixed-date trips and hotels via your business."
            onClick={() => navigate("/host-verification?category=company")}
            bg="bg-orange-50"
          />
          */}
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );

  // ── Adventure: Pending ────────────────────────────────────────────────────
  if (view.screen === "adventure-pending") return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-12 mx-auto mb-24 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full bg-white shadow-sm border">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
              My <span style={{ color: COLORS.CORAL }}>Listing</span>
            </h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Host Dashboard</p>
          </div>
        </div>
        <AdventurePendingCard place={view.place} />
      </main>
      <MobileBottomBar />
    </div>
  );

  // ── Adventure: Rejected ───────────────────────────────────────────────────
  if (view.screen === "adventure-rejected") return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8 mx-auto mb-24 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full bg-white shadow-sm border">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
              My <span style={{ color: COLORS.CORAL }}>Listing</span>
            </h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Host Dashboard</p>
          </div>
        </div>

        <div className="mb-8 bg-white rounded-[24px] p-5 border border-red-100 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-black uppercase tracking-tight text-red-700 mb-1">
                Your listing was rejected
              </h2>
              <p className="text-[12px] text-red-600 font-medium leading-relaxed mb-3">
                Your submission for <span className="font-black">{view.place?.name}</span> did not meet our listing requirements. Please review your details and resubmit.
              </p>
              <Button
                onClick={() => navigate(`/edit-listing/adventure/${view.place?.id}?resubmit=true`)}
                size="sm"
                className="rounded-xl text-[10px] font-black uppercase tracking-widest text-white border-none"
                style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #005f5f 100%)` }}
              >
                <RefreshCw className="h-3 w-3 mr-1.5" /> Review & Resubmit
              </Button>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-4">
          Or start a <span style={{ color: COLORS.CORAL }}>new submission</span>
        </h2>
        <div className="max-w-sm">
          <SelectionCard
            icon={<Home className="h-8 w-8 text-emerald-600" />}
            title="Accommodation / Airbnb"
            desc="Fix your details and resubmit your home, apartment, or private stay."
            onClick={() => navigate("/create-adventure")}
            bg="bg-emerald-50"
          />
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );

  // ── Adventure: No place submitted yet ─────────────────────────────────────
  if (view.screen === "adventure-no-place") return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-12 mx-auto mb-24 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full bg-white shadow-sm border">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
              My <span style={{ color: COLORS.CORAL }}>Listing</span>
            </h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Host Dashboard</p>
          </div>
        </div>
        <div className="bg-white rounded-[28px] p-8 text-center shadow-lg border border-slate-100">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Home className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2">No Place Submitted Yet</h3>
          <p className="text-sm text-slate-500 mb-6">You haven't submitted a listing yet. Create your listing to get started.</p>
          <Button
            onClick={() => navigate("/create-adventure")}
            className="px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest text-white border-none"
            style={{ background: `linear-gradient(135deg, ${COLORS.KHAKI_DARK} 0%, ${COLORS.KHAKI_DARK}cc 100%)` }}
          >
            <Plus className="h-4 w-4 mr-2" /> Submit Listing
          </Button>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );

  // ── Adventure: Accommodation dashboard (multiple approved listings) ───────
  if (view.screen === "adventure-accommodation-dashboard") {
    const { places } = view;
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-12 mx-auto mb-24 max-w-4xl">
          <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full bg-white shadow-sm border">
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </Button>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
                  My <span style={{ color: COLORS.CORAL }}>Accommodations</span>
                </h1>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Host Dashboard · {places.length} Listing{places.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            {/* Accommodation hosts CAN create additional listings — unlike the
                disabled "Add" pattern used for guide/company trips above. */}
            <Button
              onClick={() => navigate("/create-adventure")}
              className="rounded-xl text-[11px] font-black uppercase tracking-widest text-white border-none px-5 py-5"
              style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #005f5f 100%)` }}
            >
              <Plus className="h-4 w-4 mr-2" /> Add Accommodation
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {places.map((place) => (
              <AccommodationCard
                key={place.id}
                place={place}
                onManage={() => navigate(`/edit-listing/adventure/${place.id}`)}
              />
            ))}
          </div>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  // ── Guide / Company dashboard — Trips only ────────────────────────────────
  if (view.screen === "guide-company-dashboard") {
    const { content } = view;
    const tripCount = content.filter((i) => i.contentType === "trip").length;

    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-12 mx-auto mb-24">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900">
                Host <span style={{ color: COLORS.CORAL }}>Dashboard</span>
              </h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage your trips & tours</p>
            </div>
            <div className="bg-white p-4 rounded-[24px] shadow-sm border flex items-center gap-3">
              <LayoutDashboard className="h-5 w-5 text-[#857F3E]" />
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Trips</p>
                <p className="text-xl font-black text-slate-800">{tripCount}</p>
              </div>
            </div>
          </div>

          <div className="max-w-lg">
            {/* onAdd is wired but the "Add Trip" button itself is commented out
                inside HostCategoryCard above, so this currently has no visible
                create-trip entry point — only "All →" to manage existing trips. */}
            <HostCategoryCard
              title="Trips & Tours"
              subtitle="Guided Experiences"
              image="/images/category-trips.webp"
              icon={<Map className="h-8 w-8" />}
              count={tripCount}
              onManage={() => navigate("/host/trips")}
              onAdd={() => navigate("/create-trip")}
              accentColor={COLORS.TEAL}
            />
          </div>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  return null;
};

export default BecomeHost;