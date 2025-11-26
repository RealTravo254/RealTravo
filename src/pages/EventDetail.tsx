import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Share2, Heart, Map as MapIcon, Calendar, Users, Mail, Phone, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { BookTripDialog } from "@/components/booking/BookTripDialog";
import { SimilarItems } from "@/components/SimilarItems";

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

import { ReviewSection } from "@/components/ReviewSection";

interface Event {
  id: string;
  name: string;
  location: string;
  country: string;
  place: string;
  image_url: string;
  images: string[];
  description: string;
  price: number;
  price_child: number;
  date: string;
  is_custom_date: boolean;
  available_tickets: number;
  phone_number?: string;
  email?: string;
  map_link?: string;
  activities?: any;
  type: string;
}

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [referralLink, setReferralLink] = useState<string>("");
  const [isSaved, setIsSaved] = useState(false);
  const [bookedTickets, setBookedTickets] = useState(0);

  useEffect(() => {
    if (id) {
      fetchEvent();
      checkIfSaved();
      fetchBookedTickets();
    }
  }, [id, user]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", id)
        .eq("type", "event")
        .single();

      if (error) throw error;
      setEvent(data);
    } catch (error) {
      console.error("Error fetching event:", error);
      toast({ title: "Event not found", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchBookedTickets = async () => {
    try {
      const { data } = await supabase
        .from("bookings")
        .select("slots_booked")
        .eq("item_id", id)
        .in("status", ["confirmed", "pending"]);

      if (data) {
        const total = data.reduce((sum, booking) => sum + (booking.slots_booked || 0), 0);
        setBookedTickets(total);
      }
    } catch (error) {
      console.error("Error fetching booked tickets:", error);
    }
  };

  const checkIfSaved = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("saved_items")
        .select("id")
        .eq("user_id", user.id)
        .eq("item_id", id)
        .maybeSingle();

      setIsSaved(!!data);
    } catch (error) {
      console.error("Error checking saved status:", error);
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to save events",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    try {
      if (isSaved) {
        await supabase
          .from("saved_items")
          .delete()
          .eq("user_id", user.id)
          .eq("item_id", id);
        setIsSaved(false);
        toast({ title: "Removed from saved" });
      } else {
        await supabase.from("saved_items").insert({
          user_id: user.id,
          item_id: id,
          item_type: "EVENT",
        });
        setIsSaved(true);
        toast({ title: "Saved successfully" });
      }
    } catch (error) {
      console.error("Error toggling save:", error);
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to share with referral link",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    try {
      const { data: trackingData } = await supabase
        .from("referral_tracking")
        .insert({
          referrer_id: user.id,
          referral_type: "item_share",
          item_type: "event",
          item_id: id,
        })
        .select()
        .single();

      const shareUrl = `${window.location.origin}/event/${id}?ref=${trackingData?.id}`;
      setReferralLink(shareUrl);

      if (navigator.share) {
        await navigator.share({
          title: event?.name,
          text: `Check out this event: ${event?.name}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Link copied to clipboard!" });
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const openInMaps = () => {
    if (event?.map_link) {
      window.open(event.map_link, "_blank");
    } else {
      const query = encodeURIComponent(`${event?.name}, ${event?.location}, ${event?.country}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Event not found</p>
      </div>
    );
  }

  const allImages = [event.image_url, ...(event.images || [])].filter(Boolean);
  const remainingTickets = (event.available_tickets || 0) - bookedTickets;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container px-4 py-8 max-w-7xl mx-auto mb-20 md:mb-0">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Image Carousel */}
          <div className="space-y-4">
            <Carousel className="w-full relative">
              <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground z-20 text-xs font-bold px-3 py-1">
                EVENT
              </Badge>
              <CarouselContent>
                {allImages.map((image, index) => (
                  <CarouselItem key={index}>
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
                      <img
                        src={image}
                        alt={`${event.name} - Image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {allImages.length > 1 && (
                <>
                  <CarouselPrevious className="left-2" />
                  <CarouselNext className="right-2" />
                </>
              )}
            </Carousel>
          </div>

          {/* Event Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <MapPin className="h-4 w-4" />
                <span>{event.location}, {event.country}</span>
              </div>
              
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openInMaps}>
                <MapIcon className="h-4 w-4 mr-2" />
                Map
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                className={isSaved ? "bg-primary text-primary-foreground" : ""}
              >
                <Heart className={`h-4 w-4 mr-2 ${isSaved ? "fill-current" : ""}`} />
                Save
              </Button>
            </div>

            {/* Event Info Card - Hidden on small screens, shown on large */}
            <Card className="p-6 hidden md:block">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Event Date</p>
                    <p className="font-semibold">{new Date(event.date).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tickets Remaining</p>
                    <p className="font-semibold">{remainingTickets} / {event.available_tickets}</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Price per ticket</p>
                      <p className="text-2xl font-bold">${event.price}</p>
                      {event.price_child && event.price_child > 0 && (
                        <p className="text-sm text-muted-foreground">Child: ${event.price_child}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => setShowBooking(true)}
                    disabled={remainingTickets <= 0}
                  >
                    {remainingTickets <= 0 ? "Sold Out" : "Book Tickets"}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Contact Info */}
            {(event.phone_number || event.email) && (
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Contact Information</h3>
                <div className="space-y-3">
                  {event.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${event.phone_number}`} className="hover:underline">
                        {event.phone_number}
                      </a>
                    </div>
                  )}
                  {event.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${event.email}`} className="hover:underline">
                        {event.email}
                      </a>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-8">
          {event.description && (
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">About This Event</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
            </Card>
          )}
        </div>

        {/* Booking Button for Small Screens - Below Description */}
        <div className="md:hidden mb-8">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Event Date</p>
                  <p className="font-semibold">{new Date(event.date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Tickets Remaining</p>
                  <p className="font-semibold">{remainingTickets} / {event.available_tickets}</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Price per ticket</p>
                    <p className="text-2xl font-bold">${event.price}</p>
                    {event.price_child && event.price_child > 0 && (
                      <p className="text-sm text-muted-foreground">Child: ${event.price_child}</p>
                    )}
                  </div>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setShowBooking(true)}
                  disabled={remainingTickets <= 0}
                >
                  {remainingTickets <= 0 ? "Sold Out" : "Book Tickets"}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <ReviewSection itemId={event.id} itemType="event" />

        {/* Similar Events */}
        <SimilarItems currentItemId={event.id} itemType="trip" location={event.location} country={event.country} />
      </main>

      {showBooking && (
        <BookTripDialog
          open={showBooking}
          onOpenChange={setShowBooking}
          trip={event}
        />
      )}

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default EventDetail;
