import { useState } from "react";
import { Home, Ticket, Heart, User, Compass } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { AccountSheet } from "@/components/AccountSheet";

const TEAL = "#008080";

export const MobileBottomBar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();

  const navItems = [
    { icon: Home,    label: t("nav.home"),     path: "/"          },
    { icon: Ticket,  label: t("nav.bookings"), path: "/bookings"  },
    { icon: Compass, label: "Explore",          path: "/explore", isCenter: true },
    { icon: Heart,   label: t("nav.saved"),    path: "/saved"     },
  ];

  return (
    <div
      className={cn("md:hidden fixed bottom-0 left-0 right-0 z-[110] shadow-[0_-4px_20px_rgb(0,0,0,0.08)]")}
      style={{ backgroundColor: TEAL, paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
    >
      <nav className="flex items-center justify-around h-14 px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative flex flex-col items-center justify-center group"
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all duration-200 mb-0.5",
                item.isCenter ? "bg-white/25 scale-110" : "",
                isActive && !item.isCenter ? "bg-white/20" : ""
              )}>
                <item.icon
                  className="h-4 w-4 transition-colors duration-200 text-white"
                  strokeWidth={isActive || item.isCenter ? 2.5 : 2}
                />
              </div>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider text-white/80",
                (isActive || item.isCenter) && "text-white font-black"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Profile — always opens AccountSheet; guest UI handled inside AccountSheet */}
        <AccountSheet>
          <button className="relative flex flex-col items-center justify-center group">
            <div className={cn(
              "p-1.5 rounded-xl transition-all duration-200 mb-0.5",
              location.pathname === "/account" ? "bg-white/20" : ""
            )}>
              <User
                className="h-4 w-4 text-white"
                strokeWidth={location.pathname === "/account" ? 2.5 : 2}
              />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/80">
              {user ? t("nav.profile") : t("nav.login")}
            </span>
          </button>
        </AccountSheet>
      </nav>
    </div>
  );
};