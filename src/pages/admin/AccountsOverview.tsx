import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Search, Download, Users, Wallet, 
  DollarSign, Building, UserCheck 
} from "lucide-react";
import { format } from "date-fns";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  SOFT_GRAY: "#F8F9FA"
};

const ITEMS_PER_PAGE = 20;

interface HostAccount {
  user_id: string;
  name: string;
  email: string;
  total_bookings: number;
  total_revenue: number;
  total_payout: number;
  pending_payout: number;
}

interface ReferralAccount {
  referrer_id: string;
  name: string;
  email: string;
  total_referrals: number;
  total_commission: number;
  withdrawn: number;
  balance: number;
}

const AccountsOverview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hostAccounts, setHostAccounts] = useState<HostAccount[]>([]);
  const [referralAccounts, setReferralAccounts] = useState<ReferralAccount[]>([]);
  const [hostOffset, setHostOffset] = useState(0);
  const [refOffset, setRefOffset] = useState(0);
  const [hasMoreHosts, setHasMoreHosts] = useState(true);
  const [hasMoreRefs, setHasMoreRefs] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    const checkAdmin = async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = data?.map(r => r.role) || [];
      if (!roles.includes("admin")) { navigate("/"); return; }
      setIsAdmin(true);
    };
    checkAdmin();
  }, [user, navigate]);

  const fetchHostAccounts = useCallback(async (offset = 0, append = false) => {
    // Get all hosts (users who created items)
    const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
      supabase.from("trips").select("created_by").not("created_by", "is", null),
      supabase.from("hotels").select("created_by").not("created_by", "is", null),
      supabase.from("adventure_places").select("created_by").not("created_by", "is", null),
    ]);

    const hostIds = new Set<string>();
    tripsRes.data?.forEach(t => hostIds.add(t.created_by!));
    hotelsRes.data?.forEach(h => hostIds.add(h.created_by!));
    adventuresRes.data?.forEach(a => hostIds.add(a.created_by!));

    const allHostIds = Array.from(hostIds);
    if (allHostIds.length === 0) { setHostAccounts([]); return; }

    // Get profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", allHostIds)
      .range(offset, offset + ITEMS_PER_PAGE - 1);

    if (!profiles || profiles.length === 0) {
      setHasMoreHosts(false);
      return;
    }

    // Get all item IDs per host
    const hostItemIds: Record<string, string[]> = {};
    profiles.forEach(p => { hostItemIds[p.id] = []; });

    tripsRes.data?.forEach(t => { if (hostItemIds[t.created_by!]) hostItemIds[t.created_by!].push(t.created_by!); });
    
    // Get booking stats per host by fetching their items
    const allItemIdsForHosts: string[] = [];
    const itemToHost: Record<string, string> = {};

    for (const hostId of profiles.map(p => p.id)) {
      const tItems = tripsRes.data?.filter(t => t.created_by === hostId) || [];
      const hItems = hotelsRes.data?.filter(h => h.created_by === hostId) || [];
      const aItems = adventuresRes.data?.filter(a => a.created_by === hostId) || [];
      // We need item IDs - refetch with IDs
    }

    // Simpler approach: get booking aggregates
    const { data: payoutsData } = await supabase
      .from("payouts")
      .select("recipient_id, amount, status")
      .in("recipient_id", profiles.map(p => p.id));

    const accounts: HostAccount[] = profiles.map(p => {
      const payouts = payoutsData?.filter(po => po.recipient_id === p.id) || [];
      const totalPayout = payouts.filter(po => po.status === "completed").reduce((s, po) => s + po.amount, 0);
      const pendingPayout = payouts.filter(po => po.status === "pending").reduce((s, po) => s + po.amount, 0);

      return {
        user_id: p.id,
        name: p.name || "Unknown",
        email: p.email || "",
        total_bookings: 0,
        total_revenue: totalPayout + pendingPayout,
        total_payout: totalPayout,
        pending_payout: pendingPayout,
      };
    });

    if (append) {
      setHostAccounts(prev => [...prev, ...accounts]);
    } else {
      setHostAccounts(accounts);
    }
    setHostOffset(offset);
    setHasMoreHosts(profiles.length >= ITEMS_PER_PAGE);
  }, []);

  const fetchReferralAccounts = useCallback(async (offset = 0, append = false) => {
    // Get all referrers from commissions
    const { data: commissions } = await supabase
      .from("referral_commissions")
      .select("referrer_id, commission_amount, status, withdrawn_at");

    if (!commissions || commissions.length === 0) {
      setReferralAccounts([]);
      return;
    }

    // Aggregate by referrer
    const referrerMap: Record<string, { total: number; withdrawn: number; count: number }> = {};
    commissions.forEach(c => {
      if (!referrerMap[c.referrer_id]) referrerMap[c.referrer_id] = { total: 0, withdrawn: 0, count: 0 };
      referrerMap[c.referrer_id].total += Number(c.commission_amount);
      referrerMap[c.referrer_id].count++;
      if (c.withdrawn_at) referrerMap[c.referrer_id].withdrawn += Number(c.commission_amount);
    });

    const referrerIds = Object.keys(referrerMap).slice(offset, offset + ITEMS_PER_PAGE);
    if (referrerIds.length === 0) { setHasMoreRefs(false); return; }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", referrerIds);

    // Get referral tracking counts
    const { data: trackingData } = await supabase
      .from("referral_tracking")
      .select("referrer_id")
      .in("referrer_id", referrerIds);

    const trackingCounts: Record<string, number> = {};
    trackingData?.forEach(t => {
      trackingCounts[t.referrer_id] = (trackingCounts[t.referrer_id] || 0) + 1;
    });

    const accounts: ReferralAccount[] = referrerIds.map(rid => {
      const profile = profiles?.find(p => p.id === rid);
      const stats = referrerMap[rid];
      return {
        referrer_id: rid,
        name: profile?.name || "Unknown",
        email: profile?.email || "",
        total_referrals: trackingCounts[rid] || 0,
        total_commission: stats.total,
        withdrawn: stats.withdrawn,
        balance: stats.total - stats.withdrawn,
      };
    });

    if (append) {
      setReferralAccounts(prev => [...prev, ...accounts]);
    } else {
      setReferralAccounts(accounts);
    }
    setRefOffset(offset);
    setHasMoreRefs(referrerIds.length >= ITEMS_PER_PAGE);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchHostAccounts(), fetchReferralAccounts()]);
      setLoading(false);
    };
    load();
  }, [isAdmin, fetchHostAccounts, fetchReferralAccounts]);

  const filteredHosts = searchQuery
    ? hostAccounts.filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()) || h.email.toLowerCase().includes(searchQuery.toLowerCase()))
    : hostAccounts;

  const filteredRefs = searchQuery
    ? referralAccounts.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.email.toLowerCase().includes(searchQuery.toLowerCase()))
    : referralAccounts;

  const downloadCSV = (type: "hosts" | "referrals") => {
    const rows: string[][] = [];
    if (type === "hosts") {
      rows.push(["Name", "Email", "Total Revenue (KES)", "Total Payout (KES)", "Pending Payout (KES)"]);
      hostAccounts.forEach(h => rows.push([h.name, h.email, String(h.total_revenue), String(h.total_payout), String(h.pending_payout)]));
    } else {
      rows.push(["Name", "Email", "Total Referrals", "Total Commission (KES)", "Withdrawn (KES)", "Balance (KES)"]);
      referralAccounts.forEach(r => rows.push([r.name, r.email, String(r.total_referrals), String(r.total_commission), String(r.withdrawn), String(r.balance)]));
    }

    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_accounts_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
          <Skeleton className="h-12 w-60 rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-6 font-black uppercase text-[10px] tracking-widest">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin
        </Button>

        <div className="mb-8">
          <Badge className="bg-[#FF7F50] hover:bg-[#FF7F50] border-none px-3 py-1 uppercase font-black tracking-widest text-[10px] rounded-full mb-3">
            Admin
          </Badge>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900">Accounts Overview</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Host payments & referral balances</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-12 rounded-2xl border-slate-200 bg-white"
          />
        </div>

        <Tabs defaultValue="hosts" className="space-y-6">
          <TabsList className="bg-white rounded-2xl p-1 border border-slate-100 shadow-sm">
            <TabsTrigger value="hosts" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-[#008080] data-[state=active]:text-white">
              <Building className="h-4 w-4 mr-2" /> Host Payments
            </TabsTrigger>
            <TabsTrigger value="referrals" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-[#008080] data-[state=active]:text-white">
              <UserCheck className="h-4 w-4 mr-2" /> Referral Balances
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hosts" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => downloadCSV("hosts")} variant="outline" className="rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2">
                <Download className="h-4 w-4" /> Download All
              </Button>
            </div>

            {filteredHosts.length === 0 ? (
              <div className="bg-white rounded-[28px] p-12 text-center border border-slate-100">
                <Building className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                <p className="font-black uppercase text-slate-400 text-xs tracking-widest">No host accounts found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHosts.map(host => (
                  <div key={host.user_id} className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-black text-lg uppercase tracking-tight text-slate-800">{host.name}</h3>
                        <p className="text-xs text-slate-400">{host.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <div className="text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Revenue</p>
                          <p className="text-lg font-black" style={{ color: COLORS.TEAL }}>KES {host.total_revenue.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Paid Out</p>
                          <p className="text-lg font-black text-green-600">KES {host.total_payout.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
                          <p className="text-lg font-black" style={{ color: COLORS.CORAL }}>KES {host.pending_payout.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {hasMoreHosts && !searchQuery && (
                  <Button onClick={() => fetchHostAccounts(hostOffset + ITEMS_PER_PAGE, true)} variant="outline" className="w-full rounded-2xl h-12 font-black uppercase tracking-widest text-[10px]">
                    Load Next 20
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="referrals" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => downloadCSV("referrals")} variant="outline" className="rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2">
                <Download className="h-4 w-4" /> Download All
              </Button>
            </div>

            {filteredRefs.length === 0 ? (
              <div className="bg-white rounded-[28px] p-12 text-center border border-slate-100">
                <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                <p className="font-black uppercase text-slate-400 text-xs tracking-widest">No referral accounts found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRefs.map(ref => (
                  <div key={ref.referrer_id} className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-black text-lg uppercase tracking-tight text-slate-800">{ref.name}</h3>
                        <p className="text-xs text-slate-400">{ref.email}</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-1">{ref.total_referrals} referrals</p>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <div className="text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Commission</p>
                          <p className="text-lg font-black" style={{ color: COLORS.TEAL }}>KES {ref.total_commission.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Withdrawn</p>
                          <p className="text-lg font-black text-green-600">KES {ref.withdrawn.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Balance</p>
                          <p className="text-lg font-black" style={{ color: COLORS.CORAL }}>KES {ref.balance.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {hasMoreRefs && !searchQuery && (
                  <Button onClick={() => fetchReferralAccounts(refOffset + ITEMS_PER_PAGE, true)} variant="outline" className="w-full rounded-2xl h-12 font-black uppercase tracking-widest text-[10px]">
                    Load Next 20
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default AccountsOverview;
