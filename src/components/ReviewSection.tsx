import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
interface ReviewSectionProps {
  itemId: string;
  itemType: "trip" | "event" | "hotel" | "adventure_place" | "attraction";
}
export function ReviewSection({
  itemId,
  itemType
}: ReviewSectionProps) {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  useEffect(() => {
    fetchRatings();
  }, [itemId, itemType]);
  const fetchRatings = async () => {
    try {
      // Fetch all reviews for this item
      const {
        data: reviews,
        error
      } = await supabase.from("reviews").select("rating, user_id").eq("item_id", itemId).eq("item_type", itemType);
      if (error) throw error;
      if (reviews && reviews.length > 0) {
        const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        setAverageRating(avg);
        setTotalReviews(reviews.length);

        // Check if current user has rated
        if (user) {
          const userReview = reviews.find(r => r.user_id === user.id);
          if (userReview) {
            setUserRating(userReview.rating);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching ratings:", error);
    }
  };
  const handleRating = async (rating: number) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to rate this item",
        variant: "destructive"
      });
      return;
    }
    try {
      // Check if user already rated
      const {
        data: existingReview
      } = await supabase.from("reviews").select("id").eq("user_id", user.id).eq("item_id", itemId).eq("item_type", itemType).single();
      if (existingReview) {
        // Update existing rating
        const {
          error
        } = await supabase.from("reviews").update({
          rating
        }).eq("id", existingReview.id);
        if (error) throw error;
      } else {
        // Insert new rating
        const {
          error
        } = await supabase.from("reviews").insert({
          user_id: user.id,
          item_id: itemId,
          item_type: itemType,
          rating
        });
        if (error) throw error;
      }
      setUserRating(rating);
      fetchRatings();
      toast({
        title: "Rating submitted",
        description: "Thank you for your feedback!"
      });
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit rating",
        variant: "destructive"
      });
    }
  };
  return <Card className="p-6 mt-6 rounded-none shadow opacity-100 border-2 mx-px px-[12px] my-[2px] py-px">
      <h2 className="text-2xl font-semibold mb-4">Reviews</h2>
      
      <div className="space-y-4">
        {/* Average Rating Display */}
        <div className="flex items-center gap-4">
          <div className="text-center border-solid rounded-sm shadow-sm">
            <div className="text-4xl font-bold border-0 border-solid">{averageRating.toFixed(1)}</div>
            <div className="flex items-center justify-center gap-1 my-2">
              {[1, 2, 3, 4, 5].map(star => <Star key={star} className={`h-5 w-5 ${star <= Math.round(averageRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />)}
            </div>
            <div className="text-sm text-muted-foreground">{totalReviews} reviews</div>
          </div>
        </div>

        {/* User Rating Interface */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Rate this {itemType}</h3>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map(star => <button key={star} onClick={() => handleRating(star)} onMouseEnter={() => setHoveredStar(star)} onMouseLeave={() => setHoveredStar(0)} className="transition-transform hover:scale-110 focus:outline-none">
                <Star className={`h-8 w-8 cursor-pointer transition-colors ${star <= (hoveredStar || userRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
              </button>)}
          </div>
          {userRating > 0 && <p className="text-sm text-muted-foreground mt-2">
              You rated this {userRating} {userRating === 1 ? "star" : "stars"}
            </p>}
        </div>
      </div>
    </Card>;
}