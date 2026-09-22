import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Shield, UserCog, CreditCard, Users,
  Settings, CalendarCheck, Wallet, ChevronRight,
  Clock, CheckCircle2, XCircle, ClipboardList, BarChart3,
} from "lucide-react";
import { Header } from "@/components/Header";

/* ══════════════════════════════════════════════════════════════════
   ADMIN DASHBOARD — FULL PAGE, SAFE-AREA AWARE
   Route: /admin
══════════════════════════════════════════════════════════════════ */

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used across the rest of the app:
// deep forest for structure and brand marks, a warm clay for the icon tiles.
const FOREST       = "#1F4D3A";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

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

interface AdminCard {
  icon: any;
  label: string;
  description: string;
  path: string;
}

interface AdminSection {
  title: string;
  cards: AdminCard[];
}

const adminSections: AdminSection[] = [
  {
    title: "Listings Review",
    cards: [
      { icon: Clock,        label: "Pending Approvals", description: "Listings awaiting review", path: "/admin/pending" },
      { icon: CheckCircle2, label: "Approved Items",    description: "Listings already approved", path: "/admin/approved" },
      { icon: XCircle,      label: "Rejected Items",    description: "Listings that were rejected", path: "/admin/rejected" },
    ],
  },
  {
    title: "Bookings",
    cards: [
      { icon: ClipboardList, label: "Admin Bookings", description: "Manually manage bookings",        path: "/admin/bookings" },
      { icon: CalendarCheck, label: "All Bookings",   description: "View every booking on the platform", path: "/admin/all-bookings" },
    ],
  },
  {
    title: "Accounts & Verification",
    cards: [
      { icon: UserCog, label: "Host Verification",  description: "Review host verification requests", path: "/admin/verification" },
      { icon: Users,   label: "Accounts Overview",   description: "Browse and manage all user accounts", path: "/admin/accounts" },
    ],
  },
  {
    title: "Payments",
    cards: [
      { icon: CreditCard, label: "Payment Verification", description: "Confirm and reconcile payments",     path: "/admin/payment-verification" },
      { icon: Wallet,     label: "Withdrawal Requests",   description: "Approve or decline host withdrawals", path: "/admin/withdrawals" },
    ],
  },
  {
    title: "Analytics",
    cards: [
      { icon: BarChart3, label: "Visitor Analytics", description: "Visits, platforms, gender, age and time spent", path: "/admin/analytics" },
    ],
  },
  {
    title: "Platform Settings",
    cards: [
      { icon: Settings, label: "Referral Settings", description: "Configure referral rewards and rules", path: "/admin/referral-settings" },
    ],
  },
];

const AdminDashboard = () => {
  useInjectFonts();

  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        background: CANVAS,
        fontFamily: FONT_BODY,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      {/* Shared app header (fixed) */}
      <Header __fromLayout showSearchIcon={false} />
      <div style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }} />

      {/* Page intro: back button + plain title, no colored hero banner */}
      <div className="max-w-2xl w-full mx-auto px-4 pt-4">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold mb-4 rounded-full px-3 py-1.5 transition-colors"
          style={{ background: FOREST_SOFT, color: FOREST }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: FOREST_SOFT }}>
            <Shield className="h-5 w-5" style={{ color: FOREST }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Admin dashboard</h1>
            <p className="text-[12px] font-medium" style={{ color: INK_SOFT }}>Manage every part of the platform</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl w-full mx-auto space-y-5">
        {adminSections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-medium px-1 mb-1.5" style={{ color: INK_SOFT }}>
              {section.title}
            </p>
            <div className="space-y-2">
              {section.cards.map((card) => (
                <button
                  key={card.path}
                  onClick={() => navigate(card.path)}
                  className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white transition-colors group"
                  style={{ border: `1px solid ${HAIRLINE}` }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = CANVAS)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  <div className="flex items-center gap-3 text-left min-w-0">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: FOREST_SOFT }}>
                      <card.icon className="h-5 w-5" style={{ color: FOREST }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: INK }}>{card.label}</p>
                      <p className="text-[11px] truncate" style={{ color: INK_SOFT }}>{card.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" style={{ color: INK_SOFT }} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;