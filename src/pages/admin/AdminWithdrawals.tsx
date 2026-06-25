import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/SEOHead";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Wallet,
  Search, Filter, Copy, RefreshCw,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type WithdrawalRequest = {
  id: string;
  user_id: string;
  amount: number;
  withdrawal_method: string;
  withdrawal_details: Record<string, string>;
  status: "pending" | "completed" | "rejected";
  admin_note: string | null;
  requested_at: string;
  resolved_at: string | null;
  user_name?: string;
  user_email?: string;
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  mpesa: "M-Pesa",
  paystack: "Paystack",
};

const STATUS_CONFIG = {
  pending:   { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",   icon: <Clock className="h-3 w-3" /> },
  completed: { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected:  { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",           icon: <XCircle className="h-3 w-3" /> },
};

export default function AdminWithdrawals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [filtered, setFiltered] = useState<WithdrawalRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [dialogAction, setDialogAction] = useState<"complete" | "reject" | null>(null);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    fetchRequests();
  }, [user]);

  useEffect(() => {
    let data = [...requests];
    if (statusFilter !== "all") data = data.filter(r => r.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(r =>
        r.user_name?.toLowerCase().includes(q) ||
        r.user_email?.toLowerCase().includes(q) ||
        r.withdrawal_method.includes(q) ||
        JSON.stringify(r.withdrawal_details).toLowerCase().includes(q)
      );
    }
    setFiltered(data);
  }, [requests, statusFilter, searchQuery]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("withdrawal_requests")
        .select("*")
        .order("requested_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set((data || []).map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p as { id: string; name: string; email: string }]));

      const enriched = (data || []).map((r: any) => ({
        ...r,
        user_name: profileMap.get(r.user_id)?.name || "Unknown",
        user_email: profileMap.get(r.user_id)?.email || "",
      }));

      setRequests(enriched);
    } catch (e: any) {
      toast({ title: "Failed to load requests", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openAction = (request: WithdrawalRequest, action: "complete" | "reject") => {
    setSelectedRequest(request);
    setDialogAction(action);
    setAdminNote("");
  };

  const handleAction = async () => {
    if (!selectedRequest || !dialogAction) return;
    if (dialogAction === "reject" && !adminNote.trim()) {
      toast({ title: "Please add a note explaining the rejection", variant: "destructive" });
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await (supabase as any)
        .from("withdrawal_requests")
        .update({
          status: dialogAction === "complete" ? "completed" : "rejected",
          admin_note: adminNote || null,
          resolved_at: new Date().toISOString(),
          resolved_by: user!.id,
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title: dialogAction === "complete" ? "Withdrawal marked as completed!" : "Withdrawal rejected",
        description: dialogAction === "complete"
          ? `${formatPrice(selectedRequest.amount)} deducted from user's balance.`
          : "User will be notified of the rejection.",
      });

      setSelectedRequest(null);
      setDialogAction(null);
      fetchRequests();
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!" });
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const totalPending = requests.filter(r => r.status === "pending").reduce((s, r) => s + Number(r.amount), 0);

  const renderDetails = (method: string, details: Record<string, string>) => {
    if (method === "bank_transfer") return (
      <div className="space-y-0.5">
        <p className="text-[10px] font-bold text-foreground">{details.bank_name}</p>
        <div className="flex items-center gap-1">
          <p className="text-[9px] text-muted-foreground font-mono">{details.account_number}</p>
          <button onClick={() => copyToClipboard(details.account_number)} className="text-muted-foreground hover:text-primary">
            <Copy className="h-2.5 w-2.5" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground">{details.account_name}</p>
      </div>
    );
    if (method === "mpesa") return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1">
          <p className="text-[10px] font-bold text-foreground font-mono">{details.phone}</p>
          <button onClick={() => copyToClipboard(details.phone)} className="text-muted-foreground hover:text-primary">
            <Copy className="h-2.5 w-2.5" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground">{details.name}</p>
      </div>
    );
    if (method === "paystack") return (
      <div className="flex items-center gap-1">
        <p className="text-[10px] font-bold text-foreground">{details.email}</p>
        <button onClick={() => copyToClipboard(details.email)} className="text-muted-foreground hover:text-primary">
          <Copy className="h-2.5 w-2.5" />
        </button>
      </div>
    );
    return <p className="text-[9px] text-muted-foreground">{JSON.stringify(details)}</p>;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Withdrawal Requests | Admin" description="Admin panel for managing user withdrawal requests." />
      <main className="container px-4 py-4 mx-auto max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="mb-3 rounded-lg text-[9px] font-bold uppercase tracking-widest px-3 h-7">
          <ArrowLeft className="mr-1 h-3 w-3" /> Admin
        </Button>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-foreground">Withdrawal Requests</h1>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Review & process manually</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRequests} className="rounded-lg h-7 px-3">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
            <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Pending</p>
            <p className="text-xl font-black text-amber-700 dark:text-amber-300">{pendingCount}</p>
            <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400">{formatPrice(totalPending)} total</p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border">
            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">All Time</p>
            <p className="text-xl font-black text-foreground">{requests.length}</p>
            <p className="text-[9px] font-bold text-muted-foreground">{requests.filter(r => r.status === 'completed').length} completed</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search user, method, details..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-7 rounded-xl text-xs h-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 rounded-xl text-xs h-8">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Requests List */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold">No withdrawal requests found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(req => {
              const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              return (
                <div key={req.id} className="bg-card rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-black text-foreground truncate">{req.user_name}</p>
                        <span className={`flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.icon} {req.status}
                        </span>
                      </div>
                      <p className="text-[9px] text-muted-foreground">{req.user_email}</p>
                      <p className="text-[8px] text-muted-foreground mt-0.5">
                        {new Date(req.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-foreground">{formatPrice(Number(req.amount))}</p>
                      <p className="text-[9px] font-bold text-muted-foreground">{METHOD_LABELS[req.withdrawal_method] || req.withdrawal_method}</p>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="bg-muted/40 rounded-lg p-2 mb-2">
                    {renderDetails(req.withdrawal_method, req.withdrawal_details)}
                  </div>

                  {req.admin_note && (
                    <p className="text-[9px] text-muted-foreground italic mb-2">Note: {req.admin_note}</p>
                  )}

                  {/* Actions — only for pending */}
                  {req.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => openAction(req, "complete")}
                        className="flex-1 rounded-lg h-7 text-[9px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Completed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAction(req, "reject")}
                        className="flex-1 rounded-lg h-7 text-[9px] font-black uppercase tracking-widest border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}

                  {req.resolved_at && (
                    <p className="text-[8px] text-muted-foreground text-right mt-1">
                      Resolved {new Date(req.resolved_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={v => { if (!actionLoading) { setSelectedRequest(null); setDialogAction(null); } }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-tight">
              {dialogAction === "complete" ? "Confirm Payment Sent" : "Reject Withdrawal"}
            </DialogTitle>
            <DialogDescription className="text-[10px]">
              {dialogAction === "complete"
                ? `Confirm you have manually sent ${selectedRequest ? formatPrice(Number(selectedRequest.amount)) : ""} to the user. This will deduct the amount from their balance.`
                : "This will notify the user their request was rejected."}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="bg-muted/40 rounded-xl p-3 text-[10px] space-y-1">
              <p><span className="font-bold">User:</span> {selectedRequest.user_name}</p>
              <p><span className="font-bold">Amount:</span> {formatPrice(Number(selectedRequest.amount))}</p>
              <p><span className="font-bold">Method:</span> {METHOD_LABELS[selectedRequest.withdrawal_method]}</p>
              {Object.entries(selectedRequest.withdrawal_details).map(([k, v]) => (
                <p key={k}><span className="font-bold capitalize">{k.replace(/_/g, ' ')}:</span> {v}</p>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              {dialogAction === "reject" ? "Rejection reason (required)" : "Admin note (optional)"}
            </label>
            <Input
              placeholder={dialogAction === "reject" ? "e.g. Invalid account details" : "e.g. Sent via Paystack"}
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              className="rounded-xl text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => { setSelectedRequest(null); setDialogAction(null); }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              className={`flex-1 rounded-xl font-black text-xs uppercase ${
                dialogAction === "complete" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90"
              }`}
              onClick={handleAction}
              disabled={actionLoading}
            >
              {actionLoading ? "Processing..." : dialogAction === "complete" ? "Confirm Sent" : "Reject"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}