import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ApprovedTab } from "./AdminDashboard_approved_tab";

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingListings, setPendingListings] = useState<any[]>([]);
  const [approvedListings, setApprovedListings] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [adminNotes, setAdminNotes] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      checkAdminRole();
    }
  }, [user]);

  const checkAdminRole = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .eq("role", "admin")
        .single();

      if (error || !data) {
        navigate("/");
        return;
      }

      setIsAdmin(true);
      fetchPendingListings();
      fetchApprovedListings();
      fetchAllBookings();
    } catch (error) {
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingListings = async () => {
    const [trips, events, hotels, adventures] = await Promise.all([
      supabase.from("trips").select("*").eq("approval_status", "pending"),
      supabase.from("events").select("*").eq("approval_status", "pending"),
      supabase.from("hotels").select("*").eq("approval_status", "pending"),
      supabase.from("adventure_places").select("*").eq("approval_status", "pending")
    ]);

    const all = [
      ...(trips.data?.map(t => ({ ...t, type: "trip", created_at: t.created_at })) || []),
      ...(events.data?.map(e => ({ ...e, type: "event", created_at: e.created_at })) || []),
      ...(hotels.data?.map(h => ({ ...h, type: "hotel", created_at: h.created_at })) || []),
      ...(adventures.data?.map(a => ({ ...a, type: "adventure", created_at: a.created_at })) || [])
    ];

    setPendingListings(all);
  };

  const fetchApprovedListings = async () => {
    const [trips, events, hotels, adventures] = await Promise.all([
      supabase.from("trips").select("*").eq("approval_status", "approved"),
      supabase.from("events").select("*").eq("approval_status", "approved"),
      supabase.from("hotels").select("*").eq("approval_status", "approved"),
      supabase.from("adventure_places").select("*").eq("approval_status", "approved")
    ]);

    const all = [
      ...(trips.data?.map(t => ({ ...t, type: "trip" })) || []),
      ...(events.data?.map(e => ({ ...e, type: "event" })) || []),
      ...(hotels.data?.map(h => ({ ...h, type: "hotel" })) || []),
      ...(adventures.data?.map(a => ({ ...a, type: "adventure" })) || [])
    ];

    setApprovedListings(all);
  };

  const fetchAllBookings = async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAllBookings(data);
    }
  };

  const handleApprove = async (itemId: string, itemType: string) => {
    const tableName = itemType === "adventure" ? "adventure_places" : `${itemType}s`;
    
    const { error } = await supabase
      .from(tableName as any)
      .update({ 
        approval_status: "approved",
        admin_notes: adminNotes[itemId] || null,
        approved_at: new Date().toISOString(),
        approved_by: user?.id
      })
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to approve listing");
    } else {
      toast.success("Listing approved successfully");
      fetchPendingListings();
      fetchApprovedListings();
    }
  };

  const handleToggleVisibility = async (itemId: string, itemType: string) => {
    const tableName = itemType === "adventure" ? "adventure_places" : `${itemType}s`;
    
    const { data: current } = await supabase
      .from(tableName as any)
      .select("is_hidden")
      .eq("id", itemId)
      .single();
    
    const newHiddenStatus = !(current as any)?.is_hidden;
    
    const { error } = await supabase
      .from(tableName as any)
      .update({ is_hidden: newHiddenStatus })
      .eq("id", itemId);

    if (error) {
      toast.error(`Failed to ${newHiddenStatus ? "hide" : "publish"} listing`);
    } else {
      toast.success(newHiddenStatus ? "Listing hidden from public view" : "Listing published to public");
      fetchApprovedListings();
    }
  };

  const handleReject = async (itemId: string, itemType: string) => {
    const tableName = itemType === "adventure" ? "adventure_places" : `${itemType}s`;
    
    const { error } = await supabase
      .from(tableName as any)
      .update({ 
        approval_status: "rejected",
        admin_notes: adminNotes[itemId] || "Rejected by admin"
      })
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to reject listing");
    } else {
      toast.success("Listing rejected");
      fetchPendingListings();
    }
  };

  const handleBan = async (itemId: string, itemType: string) => {
    const tableName = itemType === "adventure" ? "adventure_places" : `${itemType}s`;
    
    const { error } = await supabase
      .from(tableName as any)
      .update({ 
        approval_status: "banned",
        admin_notes: adminNotes[itemId] || "Banned by admin"
      })
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to ban listing");
    } else {
      toast.success("Listing banned");
      fetchPendingListings();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header />
        <main className="container px-4 py-8">
          <p>Loading...</p>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pending">Pending Approvals ({pendingListings.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved Items</TabsTrigger>
            <TabsTrigger value="bookings">All Bookings ({allBookings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingListings.length === 0 ? (
              <p className="text-muted-foreground">No pending listings</p>
            ) : (
              pendingListings.map((item) => (
                <Card key={item.id} className="p-6">
                  <div className="flex gap-4">
                    <img 
                      src={item.image_url} 
                      alt={item.name}
                      className="w-32 h-32 object-cover rounded"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold">{item.name}</h3>
                        <Badge className="capitalize">{item.type}</Badge>
                        {item.establishment_type && (
                          <Badge variant="outline" className="capitalize">{item.establishment_type}</Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      
                      <div className="grid md:grid-cols-2 gap-2 text-sm">
                        <p><span className="font-medium">Location:</span> {item.location}, {item.place}, {item.country}</p>
                        <p><span className="font-medium">Created:</span> {new Date(item.created_at).toLocaleDateString()}</p>
                        
                        {item.registration_number && (
                          <p><span className="font-medium">Registration #:</span> {item.registration_number}</p>
                        )}
                        
                        {item.email && (
                          <p><span className="font-medium">Creator Email:</span> {item.email}</p>
                        )}
                        
                        {item.phone_number && (
                          <p><span className="font-medium">Creator Phone:</span> {item.phone_number}</p>
                        )}
                        
                        {item.phone_numbers && item.phone_numbers.length > 0 && (
                          <p><span className="font-medium">Creator Phone:</span> {item.phone_numbers.join(', ')}</p>
                        )}
                      </div>

                      <Textarea
                        placeholder="Admin notes (optional)"
                        value={adminNotes[item.id] || ""}
                        onChange={(e) => setAdminNotes({ ...adminNotes, [item.id]: e.target.value })}
                        className="mt-2"
                      />

                      <div className="flex gap-2 mt-4">
                        <Button 
                          onClick={() => handleApprove(item.id, item.type)}
                          variant="default"
                        >
                          Approve
                        </Button>
                        <Button 
                          onClick={() => handleReject(item.id, item.type)}
                          variant="outline"
                        >
                          Reject
                        </Button>
                        <Button 
                          onClick={() => handleBan(item.id, item.type)}
                          variant="destructive"
                        >
                          Ban
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            <ApprovedTab 
              approvedListings={approvedListings}
              handleToggleVisibility={handleToggleVisibility}
            />
          </TabsContent>

          <TabsContent value="bookings" className="space-y-4">
            {allBookings.length === 0 ? (
              <p className="text-muted-foreground">No bookings yet</p>
            ) : (
              allBookings.map((booking) => (
                <Card key={booking.id} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Booking ID</p>
                      <p className="font-mono text-sm">{booking.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <Badge>{booking.booking_type}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Customer Name</p>
                      <p>{booking.guest_name || "Registered User"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p>{booking.guest_email || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p>{booking.guest_phone || booking.payment_phone || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="text-lg font-bold">${booking.total_amount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                        {booking.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Booking Date</p>
                      <p>{new Date(booking.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default AdminDashboard;
