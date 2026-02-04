import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

interface ReviewSectionProps {
  itemId: string;
  itemType: "trip" | "event" | "hotel" | "adventure_place" | "attraction";
}

export function ReviewSection({ itemId, itemType }: ReviewSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);

  useEffect(() => {
    fetchRatings();
  }, [itemId, itemType]);

  const fetchRatings = async () => {
    try {
      const { data: reviews, error } = await supabase
        .from("reviews")
        .select("rating, user_id")
        .eq("item_id", itemId)
        .eq("item_type", itemType);

      if (error) throw error;
      if (reviews && reviews.length > 0) {
        const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        setAverageRating(avg);
        setTotalReviews(reviews.length);

        if (user) {
          const userReview = reviews.find((r) => r.user_id === user.id);
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
        variant: "destructive",
      });
      return;
    }
    try {
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("user_id", user.id)
        .eq("item_id", itemId)
        .eq("item_type", itemType)
        .single();

      if (existingReview) {
        const { error } = await supabase
          .from("reviews")
          .update({ rating })
          .eq("id", existingReview.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reviews").insert({
          user_id: user.id,
          item_id: itemId,
          item_type: itemType,
          rating,
        });
        if (error) throw error;
      }
      setUserRating(rating);
      fetchRatings();
      toast({
        title: "Rating submitted",
        description: "Thank you for your feedback!",
      });
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit rating",
        variant: "destructive",
      });
    }
  };

  return (
    <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-6">
        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Reviews & Ratings</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* LEFT SIDE: Database Summary Statistics */}
        <div className="flex flex-col items-center md:items-start p-5 bg-slate-50 rounded-2xl border border-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Average Rating
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-slate-900">
              {averageRating > 0 ? averageRating.toFixed(1) : "0.0"}
            </span>
            <span className="text-lg text-slate-400 font-semibold">/ 5</span>
          </div>
          
          <div className="flex items-center gap-1 mt-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-5 w-5 ${
                  star <= Math.round(averageRating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-slate-200 text-slate-200"
                }`}
              />
            ))}
          </div>
          <p className="mt-3 text-xs font-bold text-slate-500">
            Based on {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
          </p>
        </div>

        {/* RIGHT SIDE: User Rating Input Section */}
        <div className="flex flex-col justify-center space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {userRating > 0 ? "Your Rating" : "Rate your experience"}
            </h3>
            <p className="text-sm text-slate-500">
              Help others by rating this {itemType.replace("_", " ")}
            </p>
          </div>

          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 py-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRating(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    className="transition-all duration-200 hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`h-9 w-9 cursor-pointer transition-colors ${
                        star <= (hoveredStar || userRating)
                          ? "fill-yellow-400 text-yellow-400 drop-shadow-sm"
                          : "text-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {userRating > 0 && (
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold uppercase tracking-wide border border-green-100">
                  You rated this {userRating} {userRating === 1 ? "star" : "stars"}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
              <p className="text-sm text-slate-600">
                Please{" "}
                <Link 
                  to="/auth" 
                  className="font-bold text-slate-900 underline hover:text-slate-700 transition-colors"
                >
                  log in
                </Link>{" "}
                to provide a rating.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}