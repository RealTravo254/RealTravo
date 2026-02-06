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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronRight, User, Briefcase, CreditCard, Shield, 
  LogOut, UserCog, Users, Receipt, 
  CalendarCheck, Crown, Settings 
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

  useEffect(() => {
    if (!user || !isOpen) return;
    
    const fetchUserData = async () => {
      try {
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("name").eq("id", user.id).single(),
          supabase.from("user_roles").select("role").eq("user_id", user.id)
        ]);
        
        if (profileRes.data) setUserName(profileRes.data.name);

        if (rolesRes.data && rolesRes.data.length > 0) {
          const roleList = rolesRes.data.map(r => r.role);
          setUserRole(roleList.includes("admin") ? "admin" : "user");
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching user data:", error);
        setLoading(false);
      }
    };
    fetchUserData();
  }, [user, isOpen]);

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
      
      <SheetContent className="w-full sm:max-w-md p-0 border-none bg-[#F8F9FA]">
        {/* Header */}
        <div className="p-6 bg-white border-b border-slate-100">
          <SheetHeader>
            <div>
              <p className="text-[10px] font-black text-[#FF7F50] uppercase tracking-[0.2em] mb-1">Settings</p>
              <SheetTitle className="text-2xl font-black uppercase tracking-tighter" style={{ color: COLORS.TEAL }}>
                My Account
              </SheetTitle>
            </div>
          </SheetHeader>
        </div>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-[28px]" />
                <Skeleton className="h-20 w-full rounded-[20px]" />
                <Skeleton className="h-20 w-full rounded-[20px]" />
              </div>
            ) : (
              <>
                {/* User Profile Card */}
                <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Crown size={60} style={{ color: COLORS.TEAL }} />
                  </div>
                  
                  <div className="relative z-10 flex items-center gap-4">
                    <div 
                      className="h-16 w-16 rounded-[20px] flex items-center justify-center shadow-inner"
                      style={{ backgroundColor: `${COLORS.TEAL}15` }}
                    >
                      <span className="text-2xl font-black" style={{ color: COLORS.TEAL }}>
                        {userName?.charAt(0) || "U"}
                      </span>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-[#FF7F50] uppercase tracking-[0.2em] mb-0.5">
                        Welcome back
                      </p>
                      <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">
                        {userName || "Explorer"}
                      </h2>
                      {userRole === "admin" && (
                        <span className="inline-block mt-1.5 px-2 py-0.5 bg-[#008080] text-white text-[8px] font-black uppercase tracking-widest rounded-full">
                          Administrator
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Menu Sections */}
                <div className="space-y-6">
                  {menuItems.map((section, idx) => {
                    const visibleItems = section.items.filter(item => item.show);
                    if (visibleItems.length === 0) return null;

                    return (
                      <div key={idx} className="space-y-2">
                        <h3 className="ml-3 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          {section.section}
                        </h3>
                        <div className="bg-white rounded-[24px] overflow-hidden shadow-sm border border-slate-100 divide-y divide-slate-50">
                          {visibleItems.map((item) => (
                            <button 
                              key={item.path} 
                              onClick={() => handleNavigate(item.path)} 
                              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-all active:scale-[0.98] group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-[#F0E68C]/10 group-hover:bg-[#008080] transition-colors">
                                  <item.icon className="h-4 w-4 text-[#857F3E] group-hover:text-white" />
                                </div>
                                <span className="text-[12px] font-black uppercase tracking-tight text-slate-700">
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

                  {/* Logout Button */}
                  <button 
                    onClick={handleLogout} 
                    className="w-full flex items-center justify-between p-5 bg-white rounded-[24px] border border-red-50 shadow-sm hover:bg-red-50/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-red-50 group-hover:bg-red-500 transition-colors">
                        <LogOut className="h-4 w-4 text-red-500 group-hover:text-white" />
                      </div>
                      <span className="text-[12px] font-black uppercase tracking-tight text-red-500">
                        Log Out
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-red-200 group-hover:text-red-500" />
                  </button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
