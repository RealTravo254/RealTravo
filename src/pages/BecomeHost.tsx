// src/pages/BecomeHost.tsx
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { HostLayout } from "@/components/host/HostLayout";
import { LISTING_GRID_CLASSES } from "@/components/ListingGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useNavigate } from "react-router-dom";
import {
  Plus, ArrowLeft, Map, Tent, BedDouble, Home, ShieldCheck, Clock, CheckCircle2,
  XCircle, MapPin, RefreshCw, Ban, Info, Wallet, QrCode, MessageCircle, UserCog,
  UserCircle, ListChecks, Pencil, EyeOff, CalendarDays, Layers, ChevronRight, Sparkles,
  Banknote, Ticket,
} from "lucide-react";

// ── Routes (change here if any path differs in your router) ───────────────
const ROUTES = {
  create: "/host/create",
  myListings: "/my-listing",
  payment: "/payment",
  qrScanner: "/qr-scanner",
  messages: "/messages",
  profileEdit: "/profile-edit",
  account: "/account",
  verification: "/host-verification",
  editListing: (type: string, id: string, resubmit = false) =>
    `/edit-listing/${type}/${id}${resubmit ? "?resubmit=true" : ""}`,
  bookings: (type: string, id: string) => `/host/bookings/${type}/${id}`,
};

// ── Design tokens ─────────────────────────────────────────────────────────
const FOREST = "#1F4D3A";
const FOREST_DEEP = "#123322";
const FOREST_SOFT = "#EAF0EA";
const CLAY = "#C1552F";
const CLAY_LIGHT = "#E0824F";
const CLAY_SOFT = "#FBEDE7";
const GOLD = "#B98A2A";
const GOLD_SOFT = "#FBF2DD";
const GOLD_TEXT = "#8A6716";
const INK = "#1C2B22";
const INK_SOFT = "#5B6B60";
const HAIRLINE = "#DCE3DC";
const CANVAS = "#F4F6F2";
const SUCCESS = "#2F6F4E";
const SUCCESS_SOFT = "#EAF3EC";
const DANGER = "#9C3B2B";
const DANGER_SOFT = "#F7E9E5";

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

const CREATE_IMAGE =
  "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1400&q=80";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80";

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

// ── Types & helpers ───────────────────────────────────────────────────────
type Kind = "trip" | "event" | "hotel" | "campsite" | "airbnb" | "adventure";
type Status = "approved" | "pending" | "rejected";

interface HostListing {
  id: string;
  name: string;
  image: string | null;
  place: string;
  kind: Kind;
  editType: "trip" | "hotel" | "adventure"; // what /edit-listing/:itemType expects
  status: Status;
  hidden: boolean;
  price: number | null; // null = not applicable / unknown
  isFree: boolean;
  date: string | null;
  createdAt: string | null;
}

const KIND_META: Record<Kind, { label: string; plural: string; icon: any }> = {
  trip:      { label: "Trip",      plural: "Trips",      icon: Map },
  event:     { label: "Event",     plural: "Events",     icon: CalendarDays },
  hotel:     { label: "Hotel",     plural: "Hotels",     icon: BedDouble },
  campsite:  { label: "Campsite",  plural: "Campsites",  icon: Tent },
  airbnb:    { label: "Airbnb",    plural: "Airbnbs",    icon: Home },
  adventure: { label: "Adventure", plural: "Adventures", icon: Tent },
};

const KIND_ORDER: Kind[] = ["trip", "event", "hotel", "campsite", "airbnb", "adventure"];

const normStatus = (s: any): Status => {
  const v = String(s ?? "").toLowerCase().trim();
  return v === "approved" ? "approved" : v === "rejected" ? "rejected" : "pending";
};

const STATUS_BADGE: Record<Status, { text: string; bg: string; icon: any }> = {
  approved: { text: "Live",         bg: SUCCESS, icon: CheckCircle2 },
  pending:  { text: "Under review", bg: GOLD,    icon: Clock },
  rejected: { text: "Rejected",     bg: DANGER,  icon: XCircle },
};

const placeText = (...parts: any[]) => parts.filter(Boolean).join(", ");
const firstImage = (r: any): string | null =>
  r.image_url || r.gallery_images?.[0] || r.images?.[0] || r.photo_urls?.[0] || null;
const num = (v: any): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

type ViewState = { screen: "loading" } | { screen: "banned" } | { screen: "dashboard" };

// ── Sub-components ────────────────────────────────────────────────────────
const BackButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    variant="ghost" size="icon" onClick={onClick}
    className="rounded-full bg-white hover:bg-white shrink-0"
    style={{ border: `1px solid ${HAIRLINE}` }}
  >
    <ArrowLeft className="h-5 w-5" style={{ color: INK_SOFT }} />
  </Button>
);

const StatTile = ({ icon: Icon, label, value, color, bg }: any) => (
  <div
    className="bg-white rounded-[20px] p-4 flex items-center gap-3"
    style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 4px 16px rgba(28,43,34,0.05)" }}
  >
    <div className="p-2.5 rounded-xl shrink-0" style={{ background: bg, color }}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-semibold leading-none" style={{ color: INK, fontFamily: FONT_DISPLAY }}>{value}</p>
      <p className="text-[11px] font-medium mt-1 truncate" style={{ color: INK_SOFT }}>{label}</p>
    </div>
  </div>
);

const ActionTile = ({ icon: Icon, label, desc, onClick, color, bg, badge }: any) => (
  <button
    onClick={onClick}
    className="group relative bg-white rounded-[20px] p-4 text-left transition-all hover:-translate-y-0.5 flex flex-col gap-3"
    style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 4px 16px rgba(28,43,34,0.05)" }}
  >
    <div className="flex items-start justify-between">
      <div className="p-2.5 rounded-xl" style={{ background: bg, color }}>
        <Icon className="h-5 w-5" />
      </div>
      {badge ? (
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
          {badge.text}
        </span>
      ) : (
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: INK_SOFT }} />
      )}
    </div>
    <div>
      <p className="text-sm font-semibold" style={{ color: INK, fontFamily: FONT_DISPLAY }}>{label}</p>
      <p className="text-[11px] leading-snug mt-0.5" style={{ color: INK_SOFT }}>{desc}</p>
    </div>
  </button>
);

// One icon + text row used inside the grid card
const InfoRow = ({ icon: Icon, children, color = INK_SOFT }: any) => (
  <div className="flex items-center gap-2 min-w-0">
    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
    <span className="text-[11px] font-medium truncate" style={{ color }}>{children}</span>
  </div>
);

// Grid card — stacked, full height of its grid row (1 / 2 / 4 columns)
const HostListingCard = ({
  item, priceLabel, onEdit, onResubmit, onBookings,
}: {
  item: HostListing;
  priceLabel: string | null;
  onEdit: () => void;
  onResubmit: () => void;
  onBookings: () => void;
}) => {
  const meta = KIND_META[item.kind];
  const KindIcon = meta.icon;
  const badge = STATUS_BADGE[item.status];
  const BadgeIcon = badge.icon;
  const dateLabel = item.date
    ? new Date(item.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <div
      className="flex flex-col w-full h-full bg-white rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 8px 24px rgba(28,43,34,0.06)" }}
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/3] overflow-hidden shrink-0" style={{ background: FOREST_SOFT }}>
        <img
          src={item.image || FALLBACK_IMAGE}
          alt={item.name}
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE; }}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(14,23,18,0.55), transparent 60%)" }} />
        <Badge className="absolute top-2.5 left-2.5 text-white border-none text-[9px] font-semibold gap-1" style={{ background: badge.bg }}>
          <BadgeIcon className="h-3 w-3" /> {badge.text}
        </Badge>
        <Badge className="absolute top-2.5 right-2.5 bg-white/90 text-[9px] font-semibold border-none gap-1" style={{ color: INK }}>
          <KindIcon className="h-3 w-3" /> {meta.label}
        </Badge>
        {item.hidden && (
          <Badge className="absolute bottom-2.5 left-2.5 bg-black/60 text-white border-none text-[9px] font-semibold gap-1">
            <EyeOff className="h-3 w-3" /> Hidden
          </Badge>
        )}
      </div>

      {/* Body fills the remaining height */}
      <div className="p-3.5 flex flex-col gap-3 flex-1">
        <h3 className="text-base font-semibold tracking-tight line-clamp-2" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
          {item.name || "Untitled listing"}
        </h3>

        <div className="space-y-1.5">
          {item.place && <InfoRow icon={MapPin}>{item.place}</InfoRow>}
          {dateLabel && <InfoRow icon={CalendarDays}>{dateLabel}</InfoRow>}
          {priceLabel && <InfoRow icon={item.isFree ? Ticket : Banknote} color={item.isFree ? SUCCESS : CLAY}>{priceLabel}</InfoRow>}
          {item.status === "rejected" && (
            <InfoRow icon={Info} color={DANGER}>Needs changes before it can go live</InfoRow>
          )}
        </div>

        {/* Actions pinned to the bottom */}
        <div className="mt-auto pt-1 flex gap-2">
          {item.status === "rejected" && (
            <Button
              onClick={onResubmit} size="sm"
              className="flex-1 rounded-xl text-[11px] font-semibold text-white border-none hover:opacity-95"
              style={{ background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)` }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Resubmit
            </Button>
          )}
          <Button
            onClick={onEdit} size="sm" variant="outline"
            className="flex-1 rounded-xl text-[11px] font-semibold bg-transparent"
            style={{ borderColor: HAIRLINE, color: INK }}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button
            onClick={onBookings} size="icon" variant="outline" title="Bookings"
            className="rounded-xl bg-transparent shrink-0"
            style={{ borderColor: HAIRLINE, color: INK_SOFT }}
          >
            <Ticket className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────
const BecomeHost = () => {
  useInjectFonts();

  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>({ screen: "loading" });
  const [listings, setListings] = useState<HostListing[]>([]);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [verStatus, setVerStatus] = useState<string | null>(null);
  const [compStatus, setCompStatus] = useState<string | null>(null);

  const goCreate = () => navigate(ROUTES.create);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    let cancelled = false;

    const init = async () => {
      try {
        // 1. Profile gate
        const { data: profileData } = await supabase
          .from("profiles")
          .select("profile_completed, is_banned")
          .eq("id", user.id)
          .single();

        if (cancelled) return;
        if (profileData?.is_banned) { setView({ screen: "banned" }); return; }
        if (profileData && !profileData.profile_completed) { navigate("/complete-profile"); return; }

        // 2. Verification status + ALL listing types, in parallel.
        //    Each query is allSettled-style so one failing table never hides the rest.
        const db = supabase as any;
        const safe = async (q: any) => {
          try {
            const res = await q;
            if (res.error) console.error("BecomeHost query error:", res.error);
            return (res.data ?? []) as any[];
          } catch (e) {
            console.error("BecomeHost query crashed:", e);
            return [] as any[];
          }
        };

        const [ver, comp, trips, hotels, places] = await Promise.all([
          supabase.from("host_verifications").select("status, hosting_category").eq("user_id", user.id).maybeSingle(),
          supabase.from("companies").select("verification_status").eq("user_id", user.id).maybeSingle(),
          safe(db.from("trips").select("*").eq("created_by", user.id)),
          safe(db.from("hotels").select("*").eq("created_by", user.id)),
          safe(db.from("adventure_places").select("*").eq("created_by", user.id)),
        ]);

        if (cancelled) return;

        setVerStatus(ver.data?.status ?? null);
        setCompStatus(comp.data?.verification_status ?? null);

        const all: HostListing[] = [
          ...trips
            .filter((t) => !t.deleted_by_creator)
            .map((t): HostListing => ({
              id: t.id, name: t.name, image: firstImage(t),
              place: placeText(t.location, t.country),
              kind: t.type === "event" ? "event" : "trip",
              editType: "trip",
              status: normStatus(t.approval_status),
              hidden: !!t.is_hidden,
              price: num(t.price),
              isFree: false,
              date: t.date ?? null,
              createdAt: t.created_at ?? null,
            })),
          ...hotels
            .filter((h) => !h.deleted_by_creator)
            .map((h): HostListing => ({
              id: h.id, name: h.name, image: firstImage(h),
              place: placeText(h.location, h.country),
              kind: "hotel",
              editType: "hotel",
              status: normStatus(h.approval_status),
              hidden: !!h.is_hidden,
              price: null,
              isFree: false,
              date: null,
              createdAt: h.created_at ?? null,
            })),
          ...places
            .filter((p) => !p.deleted_by_creator)
            .map((p): HostListing => {
              const free = p.entry_fee_type === "free";
              return {
                id: p.id, name: p.name, image: firstImage(p),
                place: placeText(p.place, p.location, p.country),
                kind: p.category === "airbnb" ? "airbnb"
                  : p.category === "hotel" ? "hotel"
                  : p.category === "campsite" ? "campsite" : "adventure",
                editType: "adventure",
                status: normStatus(p.approval_status),
                hidden: !!p.is_hidden,
                price: free ? 0 : num(p.entry_fee),
                isFree: free,
                date: null,
                createdAt: p.created_at ?? null,
              };
            }),
        ];

        // De-duplicate (same id + type) and show newest first
        const seen = new Set<string>();
        const unique = all.filter((l) => {
          const key = `${l.editType}-${l.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        unique.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

        setListings(unique);
        setView({ screen: "dashboard" });
      } catch (err) {
        console.error(err);
        setView({ screen: "dashboard" });
      }
    };

    init();
    return () => { cancelled = true; };
  }, [user?.id, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ────────────────────────────────────────────────────────
  const isVerified = verStatus === "approved" || compStatus === "approved";
  const verificationPending = verStatus === "pending" || compStatus === "pending";

  const counts = useMemo(() => {
    const byKind: Record<string, number> = {};
    listings.forEach((l) => { byKind[l.kind] = (byKind[l.kind] ?? 0) + 1; });
    return {
      total: listings.length,
      live: listings.filter((l) => l.status === "approved").length,
      pending: listings.filter((l) => l.status === "pending").length,
      rejected: listings.filter((l) => l.status === "rejected").length,
      byKind,
    };
  }, [listings]);

  const visible = filter === "all" ? listings : listings.filter((l) => l.kind === filter);

  const priceLabelFor = (l: HostListing): string | null => {
    if (l.isFree) return "Free entry";
    if (l.price === null || l.price === undefined) return null;
    if (l.price === 0) return "Free";
    return l.kind === "trip" || l.kind === "event" ? `${formatPrice(l.price)} / adult` : `From ${formatPrice(l.price)}`;
  };

  // Hotels are capped at one listing; unverified hosts can't stack submissions
  // while one is still under review.
  const blockReason: string | null = (() => {
    if (isVerified) return null;
    if (listings.some((l) => l.kind === "hotel"))
      return "A hotel is limited to one listing per account.";
    if (counts.live === 0 && counts.pending > 0)
      return "You can add more listings once your current submission is approved.";
    return null;
  })();

  const verificationTile = isVerified
    ? { text: "Verified", bg: SUCCESS_SOFT, color: SUCCESS }
    : verificationPending
    ? { text: "In review", bg: GOLD_SOFT, color: GOLD_TEXT }
    : { text: "Required", bg: CLAY_SOFT, color: CLAY };

  // ── Loading ─────────────────────────────────────────────────────────────
  if (view.screen === "loading") return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: CANVAS }}>
      <div className="h-10 w-10 border-4 rounded-full animate-spin" style={{ borderColor: FOREST_SOFT, borderTopColor: FOREST }} />
    </div>
  );

  // ── Banned ──────────────────────────────────────────────────────────────
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

  // ── Dashboard (all host types in one place) ─────────────────────────────
  const hasListings = listings.length > 0;
  const chipKinds = KIND_ORDER.filter((k) => (counts.byKind[k] ?? 0) > 0);

  return (
    <HostLayout>
      <div className="w-full space-y-6 lg:space-y-8" style={{ fontFamily: FONT_BODY }}>
        {/* Title */}
        <div className="flex items-center gap-3">
          <BackButton onClick={() => navigate("/")} />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
              Host <span style={{ color: CLAY }}>dashboard</span>
            </h1>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: INK_SOFT }}>
              {hasListings
                ? `${counts.total} listing${counts.total !== 1 ? "s" : ""} across trips, events, stays & campsites`
                : "Create your first listing to start hosting"}
            </p>
          </div>
        </div>

        {/* Hero: image create card + stats — fills the full width */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 lg:gap-6">
          <button
            onClick={blockReason ? undefined : goCreate}
            disabled={!!blockReason}
            className="group relative overflow-hidden rounded-[28px] text-left min-h-[220px] md:min-h-[260px] disabled:cursor-not-allowed"
            style={{ boxShadow: "0 12px 32px rgba(28,43,34,0.12)" }}
          >
            <img
              src={CREATE_IMAGE}
              alt="Create a listing"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE; }}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(14,23,18,0.88), rgba(14,23,18,0.35) 60%, rgba(14,23,18,0.15))" }} />
            <div className="relative h-full flex flex-col justify-end p-6 md:p-8 gap-3">
              <span className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-semibold">
                <Sparkles className="h-3 w-3" /> New listing
              </span>
              <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: FONT_DISPLAY }}>
                Create a listing
              </h2>
              <p className="text-sm text-white/80 max-w-md leading-relaxed">
                {blockReason ?? "Trips, events, campsites, Airbnbs or a hotel — we'll show only the types you're allowed to host."}
              </p>
              {!blockReason && (
                <span
                  className="inline-flex w-fit items-center rounded-xl px-5 py-2.5 text-[12px] font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)` }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Create listing
                </span>
              )}
            </div>
          </button>

          <div className="grid grid-cols-2 gap-3 lg:gap-4 content-stretch">
            <StatTile icon={Layers}       label="Total listings" value={counts.total}    color={FOREST}  bg={FOREST_SOFT} />
            <StatTile icon={CheckCircle2} label="Live"           value={counts.live}     color={SUCCESS} bg={SUCCESS_SOFT} />
            <StatTile icon={Clock}        label="Under review"   value={counts.pending}  color={GOLD}    bg={GOLD_SOFT} />
            <StatTile icon={XCircle}      label="Rejected"       value={counts.rejected} color={DANGER}  bg={DANGER_SOFT} />
          </div>
        </div>

        {/* Not verified → verification comes first */}
        {!isVerified && (
          <div
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl"
            style={{ background: GOLD_SOFT, border: `1px solid ${GOLD}30` }}
          >
            <div className="flex items-start gap-2.5 flex-1">
              <ShieldCheck className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: GOLD }} />
              <p className="text-[12px] font-medium leading-relaxed" style={{ color: GOLD_TEXT }}>
                <span className="font-semibold">
                  {verificationPending ? "Verification in review." : "Verify to host trips & events."}
                </span>{" "}
                {verificationPending
                  ? "We'll notify you as soon as you're approved."
                  : "Tour guides and companies must be verified before creating trips or events. Campsite, Airbnb and hotel hosts can list without it."}
              </p>
            </div>
            {!verificationPending && (
              <Button
                onClick={() => navigate(ROUTES.verification)} size="sm"
                className="rounded-xl text-[11px] font-semibold text-white border-none shrink-0"
                style={{ background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)` }}
              >
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Get verified
              </Button>
            )}
          </div>
        )}

        {/* Quick actions */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-3" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
            Quick <span style={{ color: CLAY }}>actions</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 lg:gap-4">
            <ActionTile icon={Wallet}        label="Earnings"     desc="Balance & withdrawals"   onClick={() => navigate(ROUTES.payment)}      color={SUCCESS} bg={SUCCESS_SOFT} />
            <ActionTile icon={QrCode}        label="Scan QR"      desc="Check guests in"         onClick={() => navigate(ROUTES.qrScanner)}    color={FOREST}  bg={FOREST_SOFT} />
            <ActionTile icon={MessageCircle} label="Messages"     desc="Chat with guests"        onClick={() => navigate(ROUTES.messages)}     color={CLAY}    bg={CLAY_SOFT} />
            <ActionTile icon={ListChecks}    label="All listings" desc="Manage, hide or delete"  onClick={() => navigate(ROUTES.myListings)}   color={GOLD}    bg={GOLD_SOFT} />
            <ActionTile icon={ShieldCheck}   label="Verification" desc="Guide or company status" onClick={() => navigate(ROUTES.verification)} color={verificationTile.color} bg={verificationTile.bg} badge={verificationTile} />
            <ActionTile icon={UserCog}       label="Edit profile" desc="Name, phone, password"   onClick={() => navigate(ROUTES.profileEdit)}  color={FOREST}  bg={FOREST_SOFT} />
            <ActionTile icon={UserCircle}    label="Account"      desc="Your account page"       onClick={() => navigate(ROUTES.account)}      color={INK_SOFT} bg={CANVAS} />
          </div>
        </section>

        {/* My listings: everything, with counts */}
        <section>
          <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
            <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
              My <span style={{ color: CLAY }}>listings</span>
              <span className="ml-2 text-[12px] font-medium" style={{ color: INK_SOFT }}>({counts.total})</span>
            </h2>
            {hasListings && (
              <Button
                variant="ghost" onClick={() => navigate(ROUTES.myListings)}
                className="text-[11px] font-semibold px-2 hover:bg-transparent" style={{ color: INK_SOFT }}
              >
                Manage all →
              </Button>
            )}
          </div>

          {hasListings ? (
            <>
              {/* Category count chips */}
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {[{ key: "all" as const, label: "All", icon: Layers, n: counts.total },
                  ...chipKinds.map((k) => ({ key: k, label: KIND_META[k].plural, icon: KIND_META[k].icon, n: counts.byKind[k] }))]
                  .map(({ key, label, icon: Icon, n }) => {
                    const active = filter === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-semibold transition-colors"
                        style={{
                          background: active ? FOREST : "#fff",
                          color: active ? "#fff" : INK_SOFT,
                          border: `1px solid ${active ? FOREST : HAIRLINE}`,
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                        <span className="rounded-full px-1.5 text-[10px]" style={{ background: active ? "rgba(255,255,255,0.2)" : CANVAS }}>
                          {n}
                        </span>
                      </button>
                    );
                  })}
              </div>

              {/* auto-rows-fr + h-full on the card = every card fills the full row height */}
              <div className={`${LISTING_GRID_CLASSES} auto-rows-fr mt-2`}>
                {visible.map((item) => (
                  <HostListingCard
                    key={`${item.editType}-${item.id}`}
                    item={item}
                    priceLabel={priceLabelFor(item)}
                    onEdit={() => navigate(ROUTES.editListing(item.editType, item.id))}
                    onResubmit={() => navigate(ROUTES.editListing(item.editType, item.id, true))}
                    onBookings={() => navigate(ROUTES.bookings(item.editType, item.id))}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-[24px] p-10 text-center bg-white border border-dashed" style={{ borderColor: HAIRLINE }}>
              <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: CLAY_SOFT }}>
                <Plus className="h-6 w-6" style={{ color: CLAY }} />
              </div>
              <p className="text-base font-semibold mb-1" style={{ fontFamily: FONT_DISPLAY, color: INK }}>No listings yet</p>
              <p className="text-sm mb-5" style={{ color: INK_SOFT }}>
                Your trips, events, hotels, campsites and Airbnbs will all appear here.
              </p>
              {!blockReason && (
                <Button
                  onClick={goCreate}
                  className="rounded-xl text-[12px] font-semibold text-white border-none px-5 py-5 hover:opacity-95"
                  style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)` }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Create listing
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
    </HostLayout>
  );
};

export default BecomeHost;