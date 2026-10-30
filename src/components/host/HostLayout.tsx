import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import {
  PlusCircle,
  LayoutList,
  Wallet,
  CalendarCheck,
  ShieldCheck,
  User,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HostTools, PAYMENT_URL } from "@/components/host/HostSidebarExtras";
import { useHostListings } from "@/hooks/useHostListings";
import type { ListingItem } from "@/components/ListingGrid";

/**
 * ── HostLayout ────────────────────────────────────────────────────────────
 * One shared shell for every host page: header + left sidebar (desktop) /
 * scrollable pill bar (mobile) + bottom bar.
 *
 * Sidebar sections
 *   • Main     – Create listing, My listing, Payment & earnings (opens
 *                https://www.realtravo.com/payment), Host bookings, Host verification
 *   • Tools    – Analytics, Share booking form, Manual booking (each has a
 *                dropdown to choose the listing)
 *   • Account  – Profile, Messages
 *
 * Optional props:
 *   items            – pass your own listings to skip the automatic fetch
 *   unreadMessages   – shows a badge on Messages
 *   onBookingCreated – runs after a manual booking is saved
 * ────────────────────────────────────────────────────────────────────────── */

const TEAL = "#008080";

// Payment & earnings is rendered as an external link to PAYMENT_URL
const PAYMENT_NAV_PATH = "/host/earnings";

export const HOST_NAV = [
  { label: "Create listing", to: "/host/create", icon: PlusCircle, match: ["/host/create", "/create-"] },
  { label: "My listing", to: "/become-host", icon: LayoutList, match: ["/become-host", "/my-listing", "/host/trips", "/edit-listing"] },
  { label: "Payment & earnings", to: PAYMENT_NAV_PATH, icon: Wallet, match: ["/host/earnings", "/payment"] },
  { label: "Host bookings", to: "/host-bookings", icon: CalendarCheck, match: ["/host-bookings", "/host/bookings", "/qr-scanner"] },
  { label: "Host verification", to: "/host-verification", icon: ShieldCheck, match: ["/host-verification"] },
];

export const HOST_ACCOUNT_NAV = [
  { label: "Profile", to: "/profile", icon: User, match: ["/profile"] },
  { label: "Messages", to: "/messages", icon: MessageSquare, match: ["/messages"] },
];

type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  match: string[];
};

/* ── One nav entry (works as sidebar row or mobile pill) ─────────────────── */
const NavEntry = ({
  item,
  active,
  variant,
  badge,
}: {
  item: NavItem;
  active: boolean;
  variant: "row" | "pill";
  badge?: number;
}) => {
  const external = item.to === PAYMENT_NAV_PATH;

  const className =
    variant === "row"
      ? cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all",
          active ? "text-white shadow-md" : "text-slate-600 hover:bg-slate-50"
        )
      : cn(
          "flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-full text-[12px] font-semibold border transition-all",
          active ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200"
        );

  const style = active ? { background: TEAL } : undefined;

  const content = (
    <>
      <item.icon
        className={cn(
          "shrink-0",
          variant === "row" ? "h-4 w-4" : "h-3.5 w-3.5",
          active ? "text-white" : variant === "row" ? "text-slate-400" : ""
        )}
      />
      {item.label}
      {badge ? (
        <span
          className={cn(
            "min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center",
            variant === "row" && "ml-auto",
            active ? "bg-white text-[#008080]" : "bg-[#FF7F50] text-white"
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </>
  );

  return external ? (
    <a href={PAYMENT_URL} className={className} style={style}>
      {content}
    </a>
  ) : (
    <Link to={item.to} className={className} style={style}>
      {content}
    </Link>
  );
};

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <p className="px-4 pt-4 pb-1 text-[11px] font-semibold text-slate-400">{children}</p>
);

interface HostLayoutProps {
  children: ReactNode;
  items?: ListingItem[];
  unreadMessages?: number;
  onBookingCreated?: () => void;
}

export const HostLayout = ({
  children,
  items: itemsProp,
  unreadMessages = 0,
  onBookingCreated,
}: HostLayoutProps) => {
  const { pathname } = useLocation();
  const isActive = (item: NavItem) => item.match.some((m) => pathname.startsWith(m));

  // Fetch the host's listings for the dropdowns unless the page passes them in
  const { items: fetchedItems, refetch } = useHostListings(!itemsProp);
  const items = itemsProp ?? fetchedItems;

  const handleBookingCreated = () => {
    refetch();
    onBookingCreated?.();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />
      <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6 lg:py-10 flex gap-8 items-start">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-24 self-start">
          <nav className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden max-h-[calc(100vh-7rem)] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-800">Host dashboard</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Manage everything you host</p>
            </div>

            <ul className="p-3 space-y-1">
              {HOST_NAV.map((item) => (
                <li key={item.to}>
                  <NavEntry item={item} active={isActive(item)} variant="row" />
                </li>
              ))}
            </ul>

            <div className="mx-3 border-t border-slate-100" />
            <div className="p-3 pt-0 space-y-1">
              <SectionTitle>Tools</SectionTitle>
              <HostTools items={items} variant="row" onBookingCreated={handleBookingCreated} />
            </div>

            <div className="mx-3 border-t border-slate-100" />
            <div className="p-3 pt-0 space-y-1">
              <SectionTitle>Account</SectionTitle>
              {HOST_ACCOUNT_NAV.map((item) => (
                <NavEntry
                  key={item.to}
                  item={item}
                  active={isActive(item)}
                  variant="row"
                  badge={item.to === "/messages" ? unreadMessages : undefined}
                />
              ))}
            </div>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Mobile nav pills */}
          <nav className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
            {HOST_NAV.map((item) => (
              <NavEntry key={item.to} item={item} active={isActive(item)} variant="pill" />
            ))}
            <HostTools items={items} variant="pill" onBookingCreated={handleBookingCreated} />
            {HOST_ACCOUNT_NAV.map((item) => (
              <NavEntry
                key={item.to}
                item={item}
                active={isActive(item)}
                variant="pill"
                badge={item.to === "/messages" ? unreadMessages : undefined}
              />
            ))}
          </nav>
          {children}
        </div>
      </div>
      <MobileBottomBar />
    </div>
  );
};

export default HostLayout;