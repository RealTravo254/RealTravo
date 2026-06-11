import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, ArrowLeft, LayoutDashboard, Map, Building2, Tent, Lock,
  Clock, CheckCircle2, XCircle, Eye, MapPin, Edit3, AlertTriangle,
  ChevronRight, RefreshCw, Ban, Info,
} from "lucide-react";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  KHAKI_DARK: "#857F3E",
  SOFT_GRAY: "#F8F9FA",
};

type HostType = "guide" | "company" | "adventure";
type HostingCategory = "guide" | "company" | "adventure" | null;

// ── Selection Card ──────────────────────────────────────────────────────────
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

// ── Host Category Card (active hosting action card) ─────────────────────────
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
        <Plus className="h-3 w-3 mr-1 stroke-[3px]" /> Add {title.split(" ")[0]}
      </Button>
    </div>
  </div>
);

// ── Locked Card ─────────────────────────────────────────────────────────────
const LockedCard = ({ title, subtitle, image, icon, count, onManage, accentColor, lockMessage }: any) => (
  <div className="group bg-white rounded-[24px] overflow-hidden shadow-xl border border-slate-100 flex flex-col h-[320px] md:h-[160px] md:flex-row opacity-80">
    <div className="relative h-1/2 md:h-full md:w-56 md:shrink-0 overflow-hidden">
      <img src={image} alt={title} className="w-full h-full object-cover grayscale" />
      <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
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
        <div className="p-2 rounded-xl bg-slate-100 text-slate-400">
          <div className="scale-75 origin-center">{icon}</div>
        </div>
        {count > 0 && (
          <Button variant="ghost" onClick={onManage} className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 px-2">All →</Button>
        )}
      </div>
      <div className="flex items-center gap-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-3 py-2.5">
        <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-tight">{lockMessage}</p>
      </div>
    </div>
  </div>
);

// ── Adventure Approved Card ─────────────────────────────────────────────────
const AdventureApprovedCard = ({
  place,
  onEdit,
  onView,
}: {
  place: any;
  onEdit: () => void;
  onView: () => void;
}) => {
  const imageUrl =
    place.image_url || place.gallery_images?.[0] || place.images?.[0];

  return (
    <div className="bg-white rounded-[28px] overflow-hidden shadow-xl border border-slate-100">
      {/* Hero image */}
      <div className="relative h-52 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={place.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center">
            <Tent className="h-14 w-14 text-teal-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        {/* Live badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wide bg-emerald-50 text-emerald-700 border-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Live & Approved
        </div>

        {/* Name overlay */}
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-0.5">
            Your Adventure Place
          </p>
          <h3 className="text-xl font-black text-white uppercase tracking-tight leading-tight line-clamp-1">
            {place.name}
          </h3>
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

      {/* Body */}
      <div className="p-5 space-y-3">
        {/* Success message */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl border bg-emerald-50 border-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-black text-emerald-700 uppercase tracking-wide">
              Live and accepting bookings
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5 leading-snug">
              Your adventure place is visible to explorers on Wanderer. Guests can now discover and book your experience.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            onClick={onEdit}
            className="py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white border-none transition-all active:scale-95 shadow-md"
            style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #005f5f 100%)` }}
          >
            <Edit3 className="h-3.5 w-3.5 mr-1.5" /> Edit Listing
          </Button>
          <Button
            onClick={onView}
            variant="ghost"
            className="py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-600 transition-all"
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" /> View Live
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Adventure Pending Card ──────────────────────────────────────────────────
const AdventurePendingCard = ({ place }: { place: any }) => {
  const imageUrl =
    place.image_url || place.gallery_images?.[0] || place.images?.[0];

  return (
    <div className="bg-white rounded-[28px] overflow-hidden shadow-xl border border-slate-100">
      {/* Hero image */}
      <div className="relative h-48 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={place.name}
            className="w-full h-full object-cover brightness-75"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center">
            <Tent className="h-14 w-14 text-amber-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Pending badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wide bg-amber-50 text-amber-700 border-amber-300">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          Under Review
        </div>

        {/* Name overlay */}
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-0.5">
            Your Adventure Place
          </p>
          <h3 className="text-xl font-black text-white uppercase tracking-tight leading-tight line-clamp-1">
            {place.name}
          </h3>
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

      {/* Body — ONLY the pending message, no action cards */}
      <div className="p-5">
        <div className="flex items-start gap-3 p-4 rounded-2xl border bg-amber-50 border-amber-200">
          <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-black text-amber-800 uppercase tracking-wide mb-1">
              Pending Approval
            </p>
            <p className="text-[12px] text-amber-700 font-medium leading-relaxed">
              Your adventure place has been submitted and is currently being reviewed by our team. We'll notify you once it goes live. This usually takes 24–48 hours.
            </p>
          </div>
        </div>

        {/* Subtle steps */}
        <div className="mt-4 space-y-2">
          {[
            { done: true, label: "Submission received" },
            { done: false, label: "Admin review in progress" },
            { done: false, label: "Published & live for bookings" },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.done ? "bg-emerald-100" : "bg-slate-100"
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-300 block" />
                )}
              </div>
              <p
                className={`text-[11px] font-bold uppercase tracking-wide ${
                  step.done ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────
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
  const [adventurePlace, setAdventurePlace] = useState<any | null>(null);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("profile_completed, is_banned")
          .eq("id", user.id)
          .single();

        if (cancelled) return;

        if (profileData?.is_banned) {
          setIsBanned(true);
          setLoading(false);
          return;
        }

        if (profileData && !profileData.profile_completed) {
          navigate("/complete-profile");
          return;
        }

        const { data: verification, error: verificationError } = await supabase
          .from("host_verifications")
          .select("status, hosting_category")
          .eq("user_id", user.id)
          .maybeSingle();

        const { data: company } = await supabase
          .from("companies")
          .select("verification_status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        const hasV = !!verification;
        const currentCategory = (verification?.hosting_category as HostingCategory) || null;

        setVerificationStatus(verification?.status || null);
        setHostingCategory(currentCategory);
        setHasCompany(!!company);
        setCompanyStatus(company?.verification_status || null);

        // ── Adventure host path — always takes priority if category is set ──
        // This fires even when status is "pending" or "rejected" so the user
        // never lands on the type-selection screen after submitting an adventure.
        if (currentCategory === "adventure") {
          let place: any = null;

          const { data: advPlaces } = await supabase
            .from("adventure_places")
            .select("id, name, image_url, gallery_images, images, location, place, approval_status")
            .eq("created_by", user.id)
            .limit(1);

          if (advPlaces && advPlaces.length > 0) {
            place = advPlaces[0];
          } else {
            const { data: hotelPlaces } = await supabase
              .from("hotels")
              .select(
                "id, name, image_url, gallery_images, images, location, place, approval_status, category"
              )
              .eq("created_by", user.id)
              .eq("category", "adventure")
              .limit(1);
            if (hotelPlaces && hotelPlaces.length > 0) {
              place = hotelPlaces[0];
            }
          }

          if (cancelled) return;
          setAdventurePlace(place || null);
          setLoading(false);
          return;
        }

        // ── Non-adventure host path ────────────────────────────────────────
        if (!hasV && !company) {
          setShowTypeSelection(true);
          setLoading(false);
          return;
        }

        const isApprovedGuide = verification?.status === "approved";
        const isApprovedCompany = company?.verification_status === "approved";

        if (!isApprovedGuide && !isApprovedCompany) {
          setShowTypeSelection(true);
          setLoading(false);
          return;
        }

        const [trips, hotels] = await Promise.all([
          supabase.from("trips").select("id,name,type").eq("created_by", user.id),
          supabase.from("hotels").select("id,name,category").eq("created_by", user.id),
        ]);

        if (cancelled) return;

        const allContent = [
          ...(trips.data?.map((t) => ({ ...t, contentType: "trip" })) || []),
          ...(hotels.data?.map((h) => ({ ...h, contentType: "hotel" })) || []),
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
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  const handleHostTypeSelect = (type: HostType) => {
    if (type === "adventure") {
      navigate("/create-adventure");
    } else {
      navigate(`/host-verification?category=${type}`);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-[#008080] border-t-transparent rounded-full animate-spin" />
      </div>
    );

  // ── Banned screen ──────────────────────────────────────────────────────────
  if (isBanned) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16 mb-24">
          <div className="w-full max-w-md bg-white rounded-[28px] p-8 shadow-xl border border-red-100 text-center">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-5">
              <Ban className="h-8 w-8 text-red-500" />
            </div>

            {/* Heading */}
            <div className="mb-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest">
              Account Banned
            </div>
            <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-slate-900 mb-3">
              Hosting Access Restricted
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Your account has been banned from the Wanderer hosting programme. If you believe this is a mistake, please reach out to our support team for further assistance.
            </p>

            {/* Divider */}
            <div className="border-t border-slate-100 my-5" />

            {/* Info box */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left mb-6">
              <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Banned accounts cannot create listings, manage trips, or accept bookings. Any existing active listings may have been hidden from public view.
              </p>
            </div>

            <Button
              onClick={() => navigate("/")}
              variant="ghost"
              className="w-full rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Back to Home
            </Button>
          </div>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  // ── Type selection ─────────────────────────────────────────────────────────
  if (showTypeSelection) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8 mx-auto mb-24">
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="rounded-full bg-white shadow-sm border"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Button>
            <Badge className="bg-[#008080] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              Become a Host
            </Badge>
          </div>

          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 mb-4">
            Choose your <span style={{ color: COLORS.CORAL }}>Hosting Type</span>
          </h1>

          {/* Adventure place notice */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 mb-8">
            <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
              <span className="font-black uppercase">Note:</span> An Adventure Place is a standalone hosting type — it cannot be combined with Tour Guide or Company hosting. Each account is limited to one adventure place listing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SelectionCard
              icon={<Tent className="h-8 w-8 text-emerald-600" />}
              title="Adventure Place"
              desc="List your campsite, park, or private adventure destination. One listing per account — standalone only."
              onClick={() => handleHostTypeSelect("adventure")}
              bg="bg-emerald-50"
            />
            <SelectionCard
              icon={<Map className="h-8 w-8 text-blue-600" />}
              title="Tour Guide"
              desc="Host flexible trips and guided tours."
              onClick={() => handleHostTypeSelect("guide")}
              bg="bg-blue-50"
            />
            <SelectionCard
              icon={<Building2 className="h-8 w-8 text-orange-600" />}
              title="Register Company"
              desc="Host fixed-date trips and hotels via your business."
              onClick={() => handleHostTypeSelect("company")}
              bg="bg-orange-50"
            />
          </div>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  // ── Adventure host dashboard ───────────────────────────────────────────────
  if (hostingCategory === "adventure") {
    const status = adventurePlace?.approval_status || null;

    // No place submitted yet — edge case
    if (!adventurePlace) {
      return (
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
          <Header />
          <main className="flex-1 container px-4 py-12 mx-auto mb-24 max-w-2xl">
            <div className="flex items-center gap-3 mb-8">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="rounded-full bg-white shadow-sm border"
              >
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </Button>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
                  My <span style={{ color: COLORS.CORAL }}>Adventure Place</span>
                </h1>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Host Dashboard
                </p>
              </div>
            </div>
            <div className="bg-white rounded-[28px] p-8 text-center shadow-lg border border-slate-100">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <Tent className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2">
                No Place Submitted
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                You haven't submitted an adventure place yet.
              </p>
              <Button
                onClick={() => navigate("/create-adventure")}
                className="px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest text-white border-none"
                style={{ background: `linear-gradient(135deg, ${COLORS.KHAKI_DARK} 0%, ${COLORS.KHAKI_DARK}cc 100%)` }}
              >
                <Plus className="h-4 w-4 mr-2" /> Submit Adventure Place
              </Button>
            </div>
          </main>
          <MobileBottomBar />
        </div>
      );
    }

    // ── APPROVED: show listing card with Edit + View Live ──────────────────
    if (status === "approved") {
      return (
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
          <Header />
          <main className="flex-1 container px-4 py-12 mx-auto mb-24 max-w-2xl">
            <div className="flex items-center gap-3 mb-8">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="rounded-full bg-white shadow-sm border"
              >
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </Button>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
                  My <span style={{ color: COLORS.CORAL }}>Adventure Place</span>
                </h1>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Host Dashboard
                </p>
              </div>
            </div>

            <AdventureApprovedCard
              place={adventurePlace}
              onEdit={() =>
                navigate(`/edit-listing/adventure/${adventurePlace.id}`)
              }
              onView={() =>
                navigate(`/adventure/${adventurePlace.id}`)
              }
            />
          </main>
          <MobileBottomBar />
        </div>
      );
    }

    // ── PENDING: show only the pending card, nothing else ─────────────────
    if (status === "pending") {
      return (
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
          <Header />
          <main className="flex-1 container px-4 py-12 mx-auto mb-24 max-w-2xl">
            <div className="flex items-center gap-3 mb-8">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="rounded-full bg-white shadow-sm border"
              >
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </Button>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
                  My <span style={{ color: COLORS.CORAL }}>Adventure Place</span>
                </h1>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Host Dashboard
                </p>
              </div>
            </div>

            <AdventurePendingCard place={adventurePlace} />
          </main>
          <MobileBottomBar />
        </div>
      );
    }

    // ── REJECTED: show all host type cards so they can resubmit or switch ─
    // (status === "rejected" or any unexpected value)
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8 mx-auto mb-24 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="rounded-full bg-white shadow-sm border"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Button>
            <Badge className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              Submission Rejected
            </Badge>
          </div>

          {/* Rejection notice */}
          <div className="mb-8 bg-white rounded-[24px] p-5 border border-red-100 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-black uppercase tracking-tight text-red-700 mb-1">
                  Your adventure place was rejected
                </h2>
                <p className="text-[12px] text-red-600 font-medium leading-relaxed mb-3">
                  Your submission for{" "}
                  <span className="font-black">{adventurePlace.name}</span> did
                  not meet our listing requirements. Please review your details
                  and resubmit, or choose a different hosting type below.
                </p>
                <Button
                  onClick={() =>
                    navigate(
                      `/edit-listing/adventure/${adventurePlace.id}?resubmit=true`
                    )
                  }
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
            Or choose a different <span style={{ color: COLORS.CORAL }}>hosting type</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SelectionCard
              icon={<Tent className="h-8 w-8 text-emerald-600" />}
              title="Adventure Place"
              desc="List your campsite, park, or private adventure destination instantly."
              onClick={() => navigate("/create-adventure")}
              bg="bg-emerald-50"
            />
            <SelectionCard
              icon={<Map className="h-8 w-8 text-blue-600" />}
              title="Tour Guide"
              desc="Host flexible trips and guided tours."
              onClick={() => handleHostTypeSelect("guide")}
              bg="bg-blue-50"
            />
            <SelectionCard
              icon={<Building2 className="h-8 w-8 text-orange-600" />}
              title="Register Company"
              desc="Host fixed-date trips and hotels via your business."
              onClick={() => handleHostTypeSelect("company")}
              bg="bg-orange-50"
            />
          </div>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  // ── Standard host dashboard (guide / company) ──────────────────────────────
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
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Active Assets
              </p>
              <p className="text-xl font-black text-slate-800">{myContent.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(verificationStatus === "approved" || companyStatus === "approved") && (
            <HostCategoryCard
              title="Trips & Tours"
              subtitle="Guided Experiences"
              image="/images/category-trips.webp"
              icon={<Map className="h-8 w-8" />}
              count={myContent.filter((i) => i.contentType === "trip").length}
              onManage={() => navigate("/host/trips")}
              onAdd={() => navigate("/create-trip")}
              accentColor={COLORS.TEAL}
            />
          )}
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default BecomeHost;