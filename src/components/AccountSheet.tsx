import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  X, MapPin, Compass, Heart, Ticket, LogIn, UserPlus, Sparkles,
  User, LogOut, Briefcase, ChevronRight,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════
   GUEST PANEL — shown when no user is logged in
══════════════════════════════════════════════════════════════════ */
const GuestPanel = ({ onClose }: { onClose: () => void }) => {
  const navigate = useNavigate();

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const perks = [
    { icon: Heart,   text: "Save your favourite stays & experiences"  },
    { icon: Ticket,  text: "View and manage your bookings anytime"     },
    { icon: Compass, text: "Get personalised travel recommendations"   },
    { icon: MapPin,  text: "Become a host and earn from your property" },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Hero banner ── */}
      <div
        className="relative px-5 pt-10 pb-8 flex-shrink-0 overflow-hidden"
        style={{ background: "linear-gradient(135deg,#008080 0%,#005f5f 100%)" }}
      >
        {/* Decorative rings */}
        <div className="pointer-events-none absolute -top-6 -right-6 h-28 w-28 rounded-full border-[3px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full border-[2px] border-white/10" />

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-7 w-7 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-white" />
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2 mb-5">
          <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="h-[18px] w-[18px] text-white" />
          </div>
          <span className="text-white font-extrabold text-lg tracking-tight italic">RealTravo</span>
        </div>

        <h2 className="text-2xl font-black text-white leading-tight mb-1.5">
          Travel smarter,<br />host better.
        </h2>
        <p className="text-white/60 text-xs font-medium">
          Join thousands of travellers &amp; hosts.
        </p>
      </div>

      {/* ── Perks + CTAs ── */}
      <div className="px-4 py-5 flex-1 overflow-y-auto">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground mb-3">
          What you unlock
        </p>

        <div className="space-y-2 mb-6">
          {perks.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/40"
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-xs font-semibold text-foreground leading-snug">{text}</p>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={() => go("/auth?mode=signup")}
            className="w-full h-12 rounded-xl flex items-center justify-center gap-2.5 font-black text-sm text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#008080 0%,#005f5f 100%)" }}
          >
            <UserPlus className="h-4 w-4" />
            Create a free account
          </button>

          <button
            onClick={() => go("/auth?mode=login")}
            className="w-full h-12 rounded-xl flex items-center justify-center gap-2.5 font-bold text-sm text-foreground border border-border hover:bg-muted transition-all active:scale-95"
          >
            <LogIn className="h-4 w-4" />
            Log in to my account
          </button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4 leading-relaxed">
          By continuing you agree to our{" "}
          <button
            onClick={() => go("/privacy-policy")}
            className="underline underline-offset-2 font-semibold hover:text-primary transition-colors"
          >
            Privacy Policy
          </button>
          .
        </p>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   AUTHENTICATED PANEL — shown when user is logged in
══════════════════════════════════════════════════════════════════ */
const AuthenticatedPanel = ({ onClose }: { onClose: () => void }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [userName, setUserName]     = useState("");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name, profile_picture_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserName(data.name || "");
          setUserAvatar(data.profile_picture_url || null);
        }
      });
  }, [user]);

  const go = (path: string) => { onClose(); navigate(path); };

  const links = [
    { icon: Ticket,    label: "My Bookings", path: "/bookings"   },
    { icon: Heart,     label: "Saved Items", path: "/saved"      },
    { icon: Briefcase, label: "Become Host", path: "/become-host"},
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div
        className="px-5 pt-8 pb-6 flex-shrink-0 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#008080 0%,#005f5f 100%)" }}
      >
        <div className="pointer-events-none absolute -top-6 -right-6 h-28 w-28 rounded-full border-[3px] border-white/10" />

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-7 w-7 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-white" />
        </button>

        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden border border-white/20">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} className="h-full w-full object-cover" />
            ) : (
              <User className="h-6 w-6 text-white" />
            )}
          </div>
          <div>
            <p className="text-white font-black text-base">{userName || "Traveller"}</p>
            <p className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">
              Verified Member
            </p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {links.map(({ icon: Icon, label, path }) => (
          <button
            key={path}
            onClick={() => go(path)}
            className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-muted transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">{label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </button>
        ))}
      </div>

      {/* Sign out */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => { signOut(); onClose(); navigate("/"); }}
          className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border border-destructive text-destructive font-bold text-sm hover:bg-destructive/5 transition-colors active:scale-95"
        >
          <LogOut className="h-4 w-4" /> Log Out
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   ACCOUNT SHEET — main export
   • max-w-[360px] — no full-width stretch on desktop
   • GuestPanel or AuthenticatedPanel based on auth state
   • children = trigger element
══════════════════════════════════════════════════════════════════ */
interface AccountSheetProps {
  children: ReactNode;
}

export const AccountSheet = ({ children }: AccountSheetProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>

      <SheetContent
        side="right"
        className="w-[85vw] max-w-[360px] p-0 border-none flex flex-col [&>button]:hidden"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {user ? (
          <AuthenticatedPanel onClose={() => setOpen(false)} />
        ) : (
          <GuestPanel onClose={() => setOpen(false)} />
        )}
      </SheetContent>
    </Sheet>
  );
};