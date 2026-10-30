import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { PlusCircle, LayoutList, Wallet, CalendarCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ── HostLayout ────────────────────────────────────────────────────────────
 * One shared shell for every host page: header + left sidebar (desktop) /
 * scrollable pill bar (mobile) + bottom bar.
 *
 * Wrap Create, Booking, QRScanner, Earnings … in <HostLayout> and the host
 * always has the same navigation. Change the `to` paths below if your
 * routes are named differently.
 * ────────────────────────────────────────────────────────────────────────── */

const TEAL = "#008080";

export const HOST_NAV = [
  { label: "Create listing", to: "/host/create", icon: PlusCircle, match: ["/host/create", "/create-"] },
  { label: "My listing", to: "/become-host", icon: LayoutList, match: ["/become-host", "/my-listing", "/host/trips", "/edit-listing"] },
  { label: "Payment & earnings", to: "/host/earnings", icon: Wallet, match: ["/host/earnings"] },
  { label: "Host bookings", to: "/host-bookings", icon: CalendarCheck, match: ["/host-bookings", "/host/bookings", "/qr-scanner"] },
  { label: "Host verification", to: "/host-verification", icon: ShieldCheck, match: ["/host-verification"] },
];

export const HostLayout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const isActive = (item: (typeof HOST_NAV)[number]) => item.match.some((m) => pathname.startsWith(m));

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />
      <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6 lg:py-10 flex gap-8 items-start">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-24 self-start">
          <nav className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-800">Host dashboard</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Manage everything you host</p>
            </div>
            <ul className="p-3 space-y-1">
              {HOST_NAV.map((item) => {
                const active = isActive(item);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all",
                        active ? "text-white shadow-md" : "text-slate-600 hover:bg-slate-50"
                      )}
                      style={active ? { background: TEAL } : {}}
                    >
                      <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-slate-400")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Mobile nav pills */}
          <nav className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
            {HOST_NAV.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-full text-[12px] font-semibold border transition-all",
                    active ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200"
                  )}
                  style={active ? { background: TEAL } : {}}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {children}
        </div>
      </div>
      <MobileBottomBar />
    </div>
  );
};

export default HostLayout;