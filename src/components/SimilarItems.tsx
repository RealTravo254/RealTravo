import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";

interface SimilarItemsProps {
  currentItemId: string;
  itemType: "trip" | "hotel" | "adventure" | "attraction" | "event";
  location?: string;
  country?: string;
}

export const SimilarItems = ({ currentItemId, itemType, location, country }: SimilarItemsProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSimilarItems();
  }, [currentItemId, itemType]);

  const fetchSimilarItems = async () => {
    try {
      let route = "";
      
      if (itemType === "trip") {
        route = "/trip";
        const { data, error } = await supabase
          .from("trips")
          .select("id, name, location, place, country, image_url, description, price")
          .eq("approval_status", "approved")
          .eq("is_hidden", false)
          .neq("id", currentItemId)
          .eq("country", country || "")
          .limit(6);
        if (error) throw error;
        setItems((data || []).map(item => ({ ...item, route })));
      } else if (itemType === "hotel") {
        route = "/hotel";
        const { data, error } = await supabase
          .from("hotels")
          .select("id, name, location, place, country, image_url, description")
          .eq("approval_status", "approved")
          .eq("is_hidden", false)
          .neq("id", currentItemId)
          .eq("country", country || "")
          .limit(6);
        if (error) throw error;
        setItems((data || []).map(item => ({ ...item, route, price: null })));
      } else if (itemType === "adventure") {
        route = "/adventure";
        const { data, error } = await supabase
          .from("adventure_places")
          .select("id, name, location, place, country, image_url, description, entry_fee")
          .eq("approval_status", "approved")
          .eq("is_hidden", false)
          .neq("id", currentItemId)
          .eq("country", country || "")
          .limit(6);
        if (error) throw error;
        setItems((data || []).map(item => ({ ...item, route, price: item.entry_fee })));
      } else if (itemType === "attraction") {
        route = "/attraction";
        const { data, error } = await supabase
          .from("attractions")
          .select("id, location_name, country, photo_urls, gallery_images, description, price_adult")
          .eq("approval_status", "approved")
          .eq("is_hidden", false)
          .neq("id", currentItemId)
          .eq("country", country || "")
          .limit(6);
        if (error) throw error;
        setItems((data || []).map(item => ({ 
          ...item, 
          route, 
          name: item.location_name,
          location: item.country,
          image_url: item.gallery_images?.[0] || item.photo_urls?.[0] || "",
          price: item.price_adult 
        })));
      }
    } catch (error) {
      console.error("Error fetching similar items:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || items.length === 0) return null;

  const getTitleByType = () => {
    const type = itemType as "adventure" | "hotel" | "attraction" | "trip" | "event";
    switch(type) {
      case "adventure":
        return "Similar Campsites & Experiences";
      case "hotel":
        return "Similar Hotels";
      case "attraction":
        return "Similar Attractions";
      case "event":
        return "Similar Events";
      case "trip":
        return "Similar Trips";
      default:
        return "Similar Items";
    }
  };

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6">
        {getTitleByType()}
      </h2>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4" style={{ width: `${items.length * 280}px` }}>
          {items.map((item) => (
            <Card
              key={item.id}
              className="flex-shrink-0 w-64 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                navigate(`${item.route}/${item.id}`);
                window.scrollTo(0, 0);
              }}
            >
              <div className="aspect-video relative">
                <img
                  src={item.image_url}
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-2 line-clamp-1">{item.name}</h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                  <MapPin className="h-3 w-3" />
                  <span className="line-clamp-1">{item.location}, {item.country}</span>
                </div>
                {item.price && (
                  <p className="text-sm font-semibold">KSh {item.price}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
