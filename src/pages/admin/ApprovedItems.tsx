import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronRight, Plane, Building, Tent, MapPin, Search, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ListingItem {
  id: string;
  name: string;
  type: string;
  location: string;
  created_at: string;
  is_hidden?: boolean;
}

const ApprovedItems = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<ListingItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchApprovedItems();
  }, [user, navigate]);

  const fetchApprovedItems = async () => {
    try {
      const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
        supabase.from("trips").select("id, name, location, created_at, is_hidden").eq("approval_status", "approved"),
        supabase.from("hotels").select("id, name, location, created_at, is_hidden").eq("approval_status", "approved"),
        supabase.from("adventure_places").select("id, name, location, created_at, is_hidden").eq("approval_status", "approved"),
      ]);

      const allItems: ListingItem[] = [
        ...(tripsRes.data?.map(t => ({ ...t, type: "trip" })) || []),
        ...(hotelsRes.data?.map(h => ({ ...h, type: "hotel" })) || []),
        ...(adventuresRes.data?.map(a => ({ ...a, type: "adventure" })) || []),
      ];

      const sortedItems = allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(sortedItems);
      setFilteredItems(sortedItems);
    } catch (error) {
      console.error("Error fetching approved items:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredItems(items);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.location.toLowerCase().includes(query)
      );
      setFilteredItems(filtered);
    }
  }, [searchQuery, items]);

  const getIcon = (type: string) => {
    switch (type) {
      case "trip": return Plane;
      case "hotel": return Building;
      case "adventure": return Tent;
      default: return MapPin;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8">
          <p className="text-center">Loading...</p>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8 max-w-4xl mx-auto mb-20 md:mb-0">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold mb-6">Approved Items</h1>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {filteredItems.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? "No items match your search" : "No approved items"}
            </p>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-border">
              {filteredItems.map((item) => {
                const Icon = getIcon(item.type);
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/admin/review/${item.type}/${item.id}`)}
                    className="w-full flex items-center justify-between p-6 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div className="text-left">
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.is_hidden && <Badge variant="outline">Hidden</Badge>}
                      <Badge variant="default">Approved</Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        )}
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default ApprovedItems;
