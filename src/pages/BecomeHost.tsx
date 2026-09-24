import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Plus, ArrowLeft, LayoutDashboard, Map, Building2, Tent, Home, BedDouble,
  Clock, CheckCircle2, XCircle, MapPin, RefreshCw, Ban, Info,
} from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used across the rest of the app:
// deep forest for structure and brand marks, a warm clay for the primary
// action, gold/steel-blue for the secondary hosting-type accents, dusty
// rust for danger states.
const FOREST       = "#1F4D3A";
const FOREST_DEEP  = "#123322";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const CLAY_LIGHT   = "#E0824F";
const CLAY_SOFT    = "#FBEDE7";
const GOLD         = "#B98A2A";
const GOLD_SOFT    = "#FBF2DD";
const GOLD_TEXT    = "#8A6716";
const INFO         = "#3E5590";
const INFO_SOFT    = "#EEF1F8";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";
const SUCCESS      = "#2F6F4E";
const SUCCESS_SOFT = "#EAF3EC";
const DANGER       = "#9C3B2B";
const DANGER_SOFT  = "#F7E9E5";

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Categories whose hosts may hold several approved listings. Everything else
// (e.g. "hotel") stays capped at one listing and goes to /my-listing.
const MULTI_LISTING_CATEGORIES = ["accommodation", "campsite"];

// Injects the two typefaces once, without needing to touch the app's index.html.
const useInjectFonts = () => {
  useEffect(() => {
    const id = "adventure-detail-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
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

// ── Shared page chrome ────────────────────────────────────────────────────
const BackButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    variant="ghost" size="icon" onClick={onClick}
    className="rounded-full bg-white hover:bg-white"
    style={{ border: `1px solid ${HAIRLINE}` }}
  >
    <ArrowLeft className="h-5 w-5" style={{ color: INK_SOFT }} />
  </Button>
);

const PageTitle = ({ eyebrow, title }: { eyebrow: string; title: React.ReactNode }) => (
  <div>
    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
      {title}
    </h1>
    <p className="text-[11px] font-medium mt-0.5" style={{ color: INK_SOFT }}>{eyebrow}</p>
  </div>
);

// ── Sub-components ────────────────────────────────────────────────────────────

const SelectionCard = ({ icon, title, desc, onClick, iconBg, accent }: any) => (
  <button
    onClick={onClick}
    className="group bg-white rounded-[24px] p-6 text-left transition-all hover:-translate-y-1"
    style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 8px 24px rgba(28,43,34,0.05)" }}
  >
    <div className="p-4 rounded-2xl w-fit mb-4 transition-colors" style={{ background: iconBg }}>
      {icon}
    </div>
    <h3 className="text-lg font-semibold tracking-tight mb-2" style={{ fontFamily: FONT_DISPLAY, color: INK }}>{title}</h3>
    <p className="text-sm leading-relaxed mb-6" style={{ color: INK_SOFT }}>{desc}</p>
    <div
      className="py-2.5 rounded-xl text-center text-[12px] font-semibold border transition-colors"
      style={{ borderColor: HAIRLINE, color: INK_SOFT }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = HAIRLINE; e.currentTarget.style.color = INK_SOFT; }}
    >
      Start →
    </div>
  </button>
);

const HostCategoryCard = ({ title, subtitle, image, icon, count, onManage, onAdd, accentColor }: any) => (
  <div className="group bg-white rounded-[24px] overflow-hidden flex flex-col h-[320px] md:h-[160px] md:flex-row" style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 10px 30px rgba(28,43,34,0.07)" }}>
    <div className="relative h-1/2 md:h-full md:w-56 md:shrink-0 overflow-hidden">
      <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r" style={{ backgroundImage: "linear-gradient(to top, rgba(14,23,18,0.8), rgba(14,23,18,0.3), transparent)" }} />
      <div className="absolute top-2 left-2 md:top-3 md:left-3">
        <Badge className="bg-white/20 backdrop-blur-md text-white border-none text-[9px] font-semibold">{count} listings</Badge>
      </div>
      <div className="absolute bottom-2 left-3 md:bottom-3 md:left-3">
        <p className="text-[9px] font-medium text-white/70">{subtitle}</p>
        <h2 className="text-base md:text-lg font-semibold text-white tracking-tight" style={{ fontFamily: FONT_DISPLAY }}>{title}</h2>
      </div>
    </div>
    <div className="p-4 md:px-6 md:py-4 flex flex-col justify-between flex-1">
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-xl" style={{ background: `${accentColor}18`, color: accentColor }}>
          <div className="scale-75 origin-center">{icon}</div>
        </div>
        <Button variant="ghost" onClick={onManage} className="text-[11px] font-semibold px-2 hover:bg-transparent" style={{ color: INK_SOFT }}>All →</Button>
      </div>
      {/* ── "Add Trip" / create-trip entry point re-enabled ───────────────── */}
      <Button
        onClick={onAdd}
        className="w-full py-3 rounded-xl text-[11px] font-semibold text-white transition-all active:scale-95 border-none hover:opacity-95"
        style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)` }}
      >
        <Plus className="h-3 w-3 mr-1 stroke-[3px]" /> Add {title.split(" ")[0]}
      </Button>
    </div>
  </div>
);

const AdventurePendingCard = ({ place }: { place: any }) => {
  const imageUrl = place.image_url || place.gallery_images?.[0] || place.images?.[0];
  const isHotel = place.category === "hotel";
  return (
    <div className="bg-white rounded-[28px] overflow-hidden" style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 10px 30px rgba(28,43,34,0.07)" }}>
      <div className="relative h-48 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={place.name} className="w-full h-full object-cover brightness-75" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: GOLD_SOFT }}>
            {isHotel
              ? <BedDouble className="h-14 w-14" style={{ color: `${GOLD}80` }} />
              : <Tent className="h-14 w-14" style={{ color: `${GOLD}80` }} />}
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(14,23,18,0.7), rgba(14,23,18,0.2), transparent)" }} />
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold" style={{ background: GOLD_SOFT, color: GOLD_TEXT, borderColor: `${GOLD}40` }}>
          <Clock className="h-3.5 w-3.5" style={{ color: GOLD }} /> Under review
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-[9px] font-medium text-white/60 mb-0.5">{isHotel ? "Your hotel" : "Your listing"}</p>
          <h3 className="text-xl font-semibold text-white tracking-tight leading-tight line-clamp-1" style={{ fontFamily: FONT_DISPLAY }}>{place.name}</h3>
          {(place.location || place.place) && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 text-white/70" />
              <p className="text-[11px] text-white/75 font-medium">
                {[place.place, place.location].filter(Boolean).join(", ")}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-3 p-4 rounded-2xl border" style={{ background: GOLD_SOFT, borderColor: `${GOLD}30` }}>
          <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#F2E2BE" }}>
            <Clock className="h-4 w-4" style={{ color: GOLD }} />
          </div>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: GOLD_TEXT }}>Pending approval</p>
            <p className="text-[12px] font-medium leading-relaxed" style={{ color: GOLD_TEXT }}>
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
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: step.done ? SUCCESS_SOFT : CANVAS }}>
                {step.done ? <CheckCircle2 className="h-3 w-3" style={{ color: SUCCESS }} /> : <span className="w-2 h-2 rounded-full block" style={{ background: HAIRLINE }} />}
              </div>
              <p className="text-[11px] font-semibold" style={{ color: step.done ? SUCCESS : INK_SOFT }}>
                {step.label}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 px-1">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: INK_SOFT }} />
          <p className="text-[10px] leading-relaxed" style={{ color: INK_SOFT }}>
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
    <div className="bg-white rounded-[24px] overflow-hidden flex flex-col" style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 8px 24px rgba(28,43,34,0.06)" }}>
      <div className="relative h-40 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={place.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: FOREST_SOFT }}>
            <Home className="h-10 w-10" style={{ color: `${FOREST}55` }} />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(14,23,18,0.7), rgba(14,23,18,0.08), transparent)" }} />
        <div className="absolute top-3 left-3">
          <Badge className="text-white border-none text-[9px] font-semibold" style={{ background: SUCCESS }}>Live</Badge>
        </div>
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-base font-semibold text-white tracking-tight line-clamp-1" style={{ fontFamily: FONT_DISPLAY }}>{place.name}</h3>
          {(place.place || place.location) && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 text-white/70" />
              <p className="text-[11px] text-white/75 font-medium">
                {[place.place, place.location].filter(Boolean).join(", ")}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="p-4 flex items-center justify-between">
        <span className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Accommodation</span>
        <Button variant="ghost" onClick={onManage} className="text-[11px] font-semibold px-2 hover:bg-transparent" style={{ color: INK_SOFT }}>Manage →</Button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const BecomeHost = () => {
  useInjectFonts();

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
        // Outdoor / Accommodation listings are allowed to multiply after approval.
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
          const allMultiListing = approved.every((p) => MULTI_LISTING_CATEGORIES.includes(p.category));

          if (allMultiListing) {
            // Outdoor / Accommodation hosts can hold multiple approved listings —
            // show the dashboard with an active "Add" entry point.
            setView({ screen: "adventure-accommodation-dashboard", places: approved });
            return;
          }

          // Hotel & Stay (and legacy park/attraction) remain capped at one
          // listing and keep using /my-listing.
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: CANVAS }}>
      <div className="h-10 w-10 border-4 rounded-full animate-spin" style={{ borderColor: FOREST_SOFT, borderTopColor: FOREST }} />
    </div>
  );

  // ── Banned ────────────────────────────────────────────────────────────────
  if (view.screen === "banned") return (
    <div className="min-h-screen flex flex-col" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16 mb-24">
        <div className="w-full max-w-md bg-white rounded-[28px] p-8 text-center" style={{ border: `1px solid ${DANGER}25`, boxShadow: "0 10px 30px rgba(28,43,34,0.07)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: DANGER_SOFT, border: `2px solid ${DANGER}30` }}>
            <Ban className="h-8 w-8" style={{ color: DANGER }} />
          </div>
          <div className="mb-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold" style={{ background: DANGER_SOFT, color: DANGER }}>
            Account banned
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight mb-3" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Hosting access restricted</h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: INK_SOFT }}>
            Your account has been banned from the Wanderer hosting programme. If you believe this is a mistake, please reach out to our support team.
          </p>
          <div style={{ borderTop: `1px solid ${HAIRLINE}` }} className="my-5" />
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl text-left mb-6" style={{ background: CANVAS, border: `1px solid ${HAIRLINE}` }}>
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: INK_SOFT }} />
            <p className="text-[11px] font-medium leading-relaxed" style={{ color: INK_SOFT }}>
              Banned accounts cannot create listings, manage trips, or accept bookings. Existing active listings may have been hidden from public view.
            </p>
          </div>
          <Button
            onClick={() => navigate("/")} variant="ghost"
            className="w-full rounded-2xl font-semibold text-[12px] hover:bg-transparent"
            style={{ border: `1px solid ${HAIRLINE}`, color: INK_SOFT }}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Back to home
          </Button>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );

  // ── Type Selection ────────────────────────────────────────────────────────
  if (view.screen === "type-selection") return (
    <div className="min-h-screen flex flex-col" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <Header />
      <main className="flex-1 container px-4 py-8 mx-auto mb-24">
        <div className="flex items-center gap-3 mb-6">
          <BackButton onClick={() => navigate("/")} />
          <span className="text-white px-3 py-1 rounded-full text-[11px] font-semibold" style={{ background: `linear-gradient(135deg, ${FOREST}, ${FOREST_DEEP})` }}>
            Become a host
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
          Choose your <span style={{ color: CLAY }}>hosting type</span>
        </h1>

        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl mb-8" style={{ background: GOLD_SOFT, border: `1px solid ${GOLD}30` }}>
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: GOLD }} />
          <p className="text-[11px] font-medium leading-relaxed" style={{ color: GOLD_TEXT }}>
            <span className="font-semibold">Note:</span> Accommodation / Airbnb and Hotel &amp; Stay are standalone hosting types — they cannot be combined with Tour Guide or Company hosting. Once your first Accommodation listing is approved, you can add more from your dashboard. Hotel &amp; Stay is limited to one listing per account.
          </p>
        </div>

        {/* All hosting types are offered. Hotel & Stay has its own form at /create-hotel. */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <SelectionCard
            icon={<Home className="h-8 w-8" style={{ color: SUCCESS }} />}
            title="Accommodation / Airbnb"
            desc="List your home, apartment, or private stay. Once approved, you can add unlimited Accommodation listings from your dashboard."
            onClick={() => navigate("/create-adventure")}
            iconBg={SUCCESS_SOFT}
            accent={SUCCESS}
          />
          <SelectionCard
            icon={<BedDouble className="h-8 w-8" style={{ color: CLAY }} />}
            title="Hotel & Stay"
            desc="Register your hotel, lodge, or guesthouse with room types, nightly rates, and check-in times."
            onClick={() => navigate("/create-hotel")}
            iconBg={CLAY_SOFT}
            accent={CLAY}
          />
          <SelectionCard
            icon={<Map className="h-8 w-8" style={{ color: INFO }} />}
            title="Tour Guide"
            desc="Host flexible trips and guided tours."
            onClick={() => navigate("/host-verification?category=guide")}
            iconBg={INFO_SOFT}
            accent={INFO}
          />
          <SelectionCard
            icon={<Building2 className="h-8 w-8" style={{ color: GOLD }} />}
            title="Register Company"
            desc="Host fixed-date trips and hotels via your business."
            onClick={() => navigate("/host-verification?category=company")}
            iconBg={GOLD_SOFT}
            accent={GOLD}
          />
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );

  // ── Adventure: Pending ────────────────────────────────────────────────────
  if (view.screen === "adventure-pending") return (
    <div className="min-h-screen flex flex-col" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <Header />
      <main className="flex-1 container px-4 py-12 mx-auto mb-24 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <BackButton onClick={() => navigate("/")} />
          <PageTitle eyebrow="Host dashboard" title={<>My <span style={{ color: CLAY }}>listing</span></>} />
        </div>
        <AdventurePendingCard place={view.place} />
      </main>
      <MobileBottomBar />
    </div>
  );

  // ── Adventure: Rejected ───────────────────────────────────────────────────
  if (view.screen === "adventure-rejected") return (
    <div className="min-h-screen flex flex-col" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <Header />
      <main className="flex-1 container px-4 py-8 mx-auto mb-24 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <BackButton onClick={() => navigate("/")} />
          <PageTitle eyebrow="Host dashboard" title={<>My <span style={{ color: CLAY }}>listing</span></>} />
        </div>

        <div className="mb-8 bg-white rounded-[24px] p-5" style={{ border: `1px solid ${DANGER}25`, boxShadow: "0 8px 24px rgba(28,43,34,0.05)" }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: DANGER_SOFT }}>
              <XCircle className="h-5 w-5" style={{ color: DANGER }} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold mb-1" style={{ color: DANGER }}>
                Your listing was rejected
              </h2>
              <p className="text-[12px] font-medium leading-relaxed mb-3" style={{ color: DANGER }}>
                Your submission for <span className="font-semibold">{view.place?.name}</span> did not meet our listing requirements. Please review your details and resubmit.
              </p>
              <Button
                onClick={() => navigate(`/edit-listing/adventure/${view.place?.id}?resubmit=true`)}
                size="sm"
                className="rounded-xl text-[11px] font-semibold text-white border-none hover:opacity-95"
                style={{ background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)` }}
              >
                <RefreshCw className="h-3 w-3 mr-1.5" /> Review & resubmit
              </Button>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold tracking-tight mb-4" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
          Or start a <span style={{ color: CLAY }}>new submission</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <SelectionCard
            icon={<Home className="h-8 w-8" style={{ color: SUCCESS }} />}
            title="Accommodation / Airbnb"
            desc="Fix your details and resubmit your home, apartment, or private stay."
            onClick={() => navigate("/create-adventure")}
            iconBg={SUCCESS_SOFT}
            accent={SUCCESS}
          />
          <SelectionCard
            icon={<BedDouble className="h-8 w-8" style={{ color: CLAY }} />}
            title="Hotel & Stay"
            desc="Start a fresh hotel, lodge, or guesthouse submission."
            onClick={() => navigate("/create-hotel")}
            iconBg={CLAY_SOFT}
            accent={CLAY}
          />
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );

  // ── Adventure: No place submitted yet ─────────────────────────────────────
  if (view.screen === "adventure-no-place") return (
    <div className="min-h-screen flex flex-col" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <Header />
      <main className="flex-1 container px-4 py-12 mx-auto mb-24 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <BackButton onClick={() => navigate("/")} />
          <PageTitle eyebrow="Host dashboard" title={<>My <span style={{ color: CLAY }}>listing</span></>} />
        </div>
        <div className="bg-white rounded-[28px] p-8 text-center" style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 10px 30px rgba(28,43,34,0.06)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: SUCCESS_SOFT }}>
            <Home className="h-8 w-8" style={{ color: SUCCESS }} />
          </div>
          <h3 className="text-xl font-semibold tracking-tight mb-2" style={{ fontFamily: FONT_DISPLAY, color: INK }}>No place submitted yet</h3>
          <p className="text-sm mb-6" style={{ color: INK_SOFT }}>You haven't submitted a listing yet. Create your listing to get started.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => navigate("/create-adventure")}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white border-none hover:opacity-95"
              style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)` }}
            >
              <Plus className="h-4 w-4 mr-2" /> Submit listing
            </Button>
            <Button
              onClick={() => navigate("/create-hotel")}
              variant="ghost"
              className="px-6 py-3 rounded-xl text-sm font-semibold hover:bg-transparent"
              style={{ border: `1px solid ${HAIRLINE}`, color: INK_SOFT }}
            >
              <BedDouble className="h-4 w-4 mr-2" /> Submit hotel
            </Button>
          </div>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );

  // ── Adventure: Accommodation dashboard (multiple approved listings) ───────
  if (view.screen === "adventure-accommodation-dashboard") {
    const { places } = view;
    return (
      <div className="min-h-screen flex flex-col" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
        <Header />
        <main className="flex-1 container px-4 py-12 mx-auto mb-24 max-w-4xl">
          <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              <BackButton onClick={() => navigate("/")} />
              <PageTitle
                eyebrow={`Host dashboard · ${places.length} listing${places.length !== 1 ? "s" : ""}`}
                title={<>My <span style={{ color: CLAY }}>accommodations</span></>}
              />
            </div>
            {/* Accommodation hosts CAN create additional listings — unlike the
                disabled "Add" pattern used for guide/company trips above. */}
            <Button
              onClick={() => navigate("/create-adventure")}
              className="rounded-xl text-[12px] font-semibold text-white border-none px-5 py-5 hover:opacity-95"
              style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)` }}
            >
              <Plus className="h-4 w-4 mr-2" /> Add accommodation
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
      <div className="min-h-screen flex flex-col" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
        <Header />
        <main className="flex-1 container px-4 py-12 mx-auto mb-24">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
                Host <span style={{ color: CLAY }}>dashboard</span>
              </h1>
              <p className="text-[11px] font-medium mt-1" style={{ color: INK_SOFT }}>Manage your trips & tours</p>
            </div>
            <div className="bg-white p-4 rounded-[24px] flex items-center gap-3" style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 4px 16px rgba(28,43,34,0.05)" }}>
              <LayoutDashboard className="h-5 w-5" style={{ color: FOREST }} />
              <div>
                <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Active trips</p>
                <p className="text-xl font-semibold" style={{ color: INK }}>{tripCount}</p>
              </div>
            </div>
          </div>

          <div className="max-w-lg">
            {/* "Add Trip" entry point is now live, navigating to /create-trip. */}
            <HostCategoryCard
              title="Trips & Tours"
              subtitle="Guided Experiences"
              image="/images/category-trips.webp"
              icon={<Map className="h-8 w-8" />}
              count={tripCount}
              onManage={() => navigate("/host/trips")}
              onAdd={() => navigate("/create-trip")}
              accentColor={FOREST}
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