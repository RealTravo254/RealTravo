import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Shield, UserCog, CreditCard, Users,
  Settings, CalendarCheck, Wallet, ChevronRight,
  Clock, CheckCircle2, XCircle, ClipboardList,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════
   ADMIN DASHBOARD — FULL PAGE, SAFE-AREA AWARE
   Route: /admin
══════════════════════════════════════════════════════════════════ */

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
    title: "Platform Settings",
    cards: [
      { icon: Settings, label: "Referral Settings", description: "Configure referral rewards and rules", path: "/admin/referral-settings" },
    ],
  },
];

const AdminDashboard = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen w-full bg-background flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      {/* Header */}
      <div className="bg-primary px-4 pt-5 pb-6 relative flex-shrink-0">
        <button
          onClick={() => navigate("/")}
          aria-label="Back"
          className="absolute top-4 left-4 h-8 w-8 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-primary-foreground" />
        </button>

        <div className="flex flex-col items-center text-center pt-8">
          <div className="h-12 w-12 rounded-xl bg-primary-foreground/15 flex items-center justify-center mb-2">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-black text-primary-foreground">Admin Dashboard</h1>
          <p className="text-primary-foreground/60 text-xs font-medium mt-0.5">
            Manage every part of the platform
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl w-full mx-auto space-y-5">
        {adminSections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.18em] px-1 mb-1.5">
              {section.title}
            </p>
            <div className="space-y-2">
              {section.cards.map((card) => (
                <button
                  key={card.path}
                  onClick={() => navigate(card.path)}
                  className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 text-left min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <card.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{card.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{card.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
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