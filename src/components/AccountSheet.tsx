import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronRight, User, Briefcase, CreditCard, Shield, 
  LogOut, UserCog, Users, Receipt, 
  CalendarCheck, Settings 
} from "lucide-react";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

interface AccountSheetProps {
  children: React.ReactNode;
}

export const AccountSheet = ({ children }: AccountSheetProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // IMMEDIATE DATA LOADING - Fetch as soon as user is available, not just when sheet opens
  useEffect(() => {
    if (!user) return;
    
    const fetchUserData = async () => {
      setLoading(true);
      try {
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("name").eq("id", user.id).single(),
          supabase.from("user_roles").select("role").eq("user_id", user.id)
        ]);
        
        if (profileRes.data) {
          setUserName(profileRes.data.name || "User");
        }

        if (rolesRes.data && rolesRes.data.length > 0) {
          const roleList = rolesRes.data.map(r => r.role);
          setUserRole(roleList.includes("admin") ? "admin" : "user");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [user]); // Removed isOpen dependency - loads immediately when user exists

  const handleLogout = async () => {
    setIsOpen(false);
    await signOut();
  };

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const menuItems = [
    { section: "Host Tools", items: [
      { icon: Briefcase, label: "Become a Host", path: "/become-host", show: true },
      { icon: CalendarCheck, label: "My Host Bookings", path: "/host-bookings", show: true },
    ]},
    { section: "Personal", items: [
      { icon: User, label: "Edit Profile", path: "/profile/edit", show: true },
      { icon: Users, label: "My Referrals", path: "/my-referrals", show: true },
      { icon: CreditCard, label: "Payment Methods", path: "/payment", show: true },
      { icon: Receipt, label: "Payment History", path: "/payment-history", show: true },
    ]},
    { section: "Admin Control", items: [
      { icon: Shield, label: "Admin Dashboard", path: "/admin", show: userRole === "admin" },
      { icon: UserCog, label: "Host Verification", path: "/admin/verification", show: userRole === "admin" },
      { icon: CreditCard, label: "Payment Verification", path: "/admin/payment-verification", show: userRole === "admin" },
      { icon: Settings, label: "Referral Settings", path: "/admin/referral-settings", show: userRole === "admin" },
      { icon: CalendarCheck, label: "All Bookings", path: "/admin/all-bookings", show: userRole === "admin" },
      { icon: Users, label: "Accounts Overview", path: "/admin/accounts", show: userRole === "admin" },
    ]}
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md p-0 border-none bg-[#F8F9FA] flex flex-col">
        {/* COMPACT HEADER - Settings & My Account together */}
        <div className="px-6 pt-5 pb-4 bg-white border-b border-slate-100 flex-shrink-0">
          <SheetHeader>
            <div className="flex items-baseline gap-2">
              <span className="text-slate-300">/</span>
              <SheetTitle className="text-xl font-black uppercase tracking-tighter" style={{ color: COLORS.TEAL }}>
                My Account
              </SheetTitle>
            </div>
          </SheetHeader>
          
          {/* User Profile Info */}
          {!loading && userName && (
            <div className="flex items-center gap-3 mt-4 p-3 bg-gradient-to-r from-[#008080]/5 to-transparent rounded-xl border border-[#008080]/10">
              <div className="h-12 w-12 rounded-full bg-[#008080] flex items-center justify-center border-2 border-[#008080]/20">
                <span className="text-white font-bold text-lg">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{userName}</p>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {userRole === "admin" ? "Administrator" : "Member"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* MAIN CONTENT - No ScrollArea, compact spacing */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-[20px]" />
              <Skeleton className="h-20 w-full rounded-[20px]" />
              <Skeleton className="h-20 w-full rounded-[20px]" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Menu Sections - Compact spacing */}
              {menuItems.map((section, idx) => {
                const visibleItems = section.items.filter(item => item.show);
                if (visibleItems.length === 0) return null;

                return (
                  <div key={idx} className="space-y-2">
                    <h3 className="ml-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      {section.section}
                    </h3>
                    <div className="bg-white rounded-[20px] overflow-hidden shadow-sm border border-slate-100 divide-y divide-slate-50">
                      {visibleItems.map((item) => (
                        <button 
                          key={item.path} 
                          onClick={() => handleNavigate(item.path)} 
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-all active:scale-[0.98] group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-[#F0E68C]/10 group-hover:bg-[#008080] transition-colors">
                              <item.icon className="h-4 w-4 text-[#857F3E] group-hover:text-white" />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-tight text-slate-700">
                              {item.label}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#008080] transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Logout Button - Compact */}
              <button 
                onClick={handleLogout} 
                className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-[20px] border border-red-50 shadow-sm hover:bg-red-50/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-red-50 group-hover:bg-red-500 transition-colors">
                    <LogOut className="h-4 w-4 text-red-500 group-hover:text-white" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-tight text-red-500">
                    Log Out
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-red-200 group-hover:text-red-500" />
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};