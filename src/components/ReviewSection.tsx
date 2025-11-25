import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Star, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_name?: string;
}

interface ReviewSectionProps {
  itemId: string;
  itemType: "trip" | "event" | "hotel" | "adventure_place" | "attraction";
}

export function ReviewSection({ itemId, itemType }: ReviewSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", itemId, itemType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("item_id", itemId)
        .eq("item_type", itemType)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set(data?.map(r => r.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.name]));

      return (data || []).map(review => ({
        ...review,
        user_name: profileMap.get(review.user_id) || "Anonymous"
      })) as Review[];
    },
  });

  const userReviews = reviews.filter(r => r.user_id === user?.id);
  const otherReviews = reviews.filter(r => r.user_id !== user?.id);
  const allReviewsSorted = [...userReviews, ...otherReviews];
  const displayedReviews = showAllReviews ? allReviewsSorted : allReviewsSorted.slice(0, 5);
  const hasMoreReviews = reviews.length > 5;

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in to submit a review");
      if (rating === 0) throw new Error("Please select a rating");

      if (editingReviewId) {
        const { error } = await supabase
          .from("reviews")
          .update({
            rating,
            comment: null,
          })
          .eq("id", editingReviewId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("reviews").insert({
          user_id: user.id,
          item_id: itemId,
          item_type: itemType,
          rating,
          comment: null,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingReviewId ? "Review updated successfully" : "Review submitted successfully" });
      setRating(0);
      setEditingReviewId(null);
      queryClient.invalidateQueries({ queryKey: ["reviews", itemId, itemType] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      if (!user) throw new Error("Must be logged in");

      const { error } = await supabase
        .from("reviews")
        .delete()
        .eq("id", reviewId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Review deleted successfully" });
      setDeleteReviewId(null);
      queryClient.invalidateQueries({ queryKey: ["reviews", itemId, itemType] });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting review", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (review: Review) => {
    setEditingReviewId(review.id);
    setRating(review.rating);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setRating(0);
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Reviews ({reviews.length})</h2>
        
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-5 w-5 ${star <= Math.round(averageRating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                />
              ))}
            </div>
            <span className="text-lg font-semibold">{averageRating.toFixed(1)} out of 5</span>
          </div>
        )}

        {user && !editingReviewId && (
          <div className="mb-6 space-y-4">
            <h3 className="text-lg font-semibold">Add Your Rating</h3>
            <div>
              <p className="text-sm font-medium mb-2">Your Rating</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-8 w-8 cursor-pointer transition-colors ${
                      star <= (hoveredStar || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                    }`}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => setRating(star)}
                  />
                ))}
              </div>
            </div>

            <Button
              onClick={() => submitReviewMutation.mutate()}
              disabled={rating === 0 || submitReviewMutation.isPending}
            >
              {submitReviewMutation.isPending ? "Submitting..." : "Submit Rating"}
            </Button>
          </div>
        )}

        {user && editingReviewId && (
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Your Rating</h3>
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Your Rating</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-8 w-8 cursor-pointer transition-colors ${
                      star <= (hoveredStar || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                    }`}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => setRating(star)}
                  />
                ))}
              </div>
            </div>

            <Button
              onClick={() => submitReviewMutation.mutate()}
              disabled={rating === 0 || submitReviewMutation.isPending}
            >
              {submitReviewMutation.isPending ? "Updating..." : "Update Rating"}
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {displayedReviews.map((review) => (
            <Card key={review.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold">{review.user_name || "Anonymous"}</p>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${star <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                  {user?.id === review.user_id && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(review)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteReviewId(review.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
            </Card>
          ))}

          {reviews.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No reviews yet. Be the first to review!</p>
          )}

          {hasMoreReviews && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAllReviews(!showAllReviews)}
            >
              {showAllReviews ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Show More ({reviews.length - 5} more)
                </>
              )}
            </Button>
          )}
        </div>
      </Card>

      <AlertDialog open={!!deleteReviewId} onOpenChange={() => setDeleteReviewId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your review? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteReviewId && deleteReviewMutation.mutate(deleteReviewId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
