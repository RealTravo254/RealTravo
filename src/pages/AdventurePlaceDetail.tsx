import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Share2, Mail, DollarSign } from "lucide-react";
import { BookAdventureDialog } from "@/components/booking/BookAdventureDialog";
import { useToast } from "@/hooks/use-toast";

interface Facility {
  name: string;
  price: number;
}

interface Activity {
  name: string;
  price: number;
}

interface AdventurePlace {
  id: string;
  name: string;
  location: string;
  place: string;
  country: string;
  image_url: string;
  images: string[];
  description: string;
  entry_fee: number;
  entry_fee_type: string;
  phone_numbers: string[];
  email: string;
  facilities: Facility[];
  activities: Activity[];
  amenities: string[];
  registration_number: string;
  map_link: string;
}

const AdventurePlaceDetail = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [place, setPlace] = useState<AdventurePlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    fetchPlace();
  }, [id]);

  const fetchPlace = async () => {
    try {
      const { data, error } = await supabase
        .from("adventure_places")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPlace(data as any);
    } catch (error) {
      console.error("Error fetching adventure place:", error);
      toast({
        title: "Error",
        description: "Failed to load place details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: place?.name,
          text: place?.description,
          url: window.location.href,
        });
      } catch (error) {
        console.log("Share failed:", error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Place link copied to clipboard",
      });
    }
  };

  const openInMaps = () => {
    if (place?.map_link) {
      window.open(place.map_link, '_blank');
    } else {
      const query = encodeURIComponent(`${place?.name}, ${place?.location}, ${place?.country}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background">Loading...</div>;
  }

  if (!place) {
    return <div className="min-h-screen bg-background">Place not found</div>;
  }

  const displayImages = place.images?.length > 0 
    ? place.images 
    : [place.image_url, place.image_url, place.image_url, place.image_url];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold">{place.name}</h1>
          <Button
            variant="ghost"
            onClick={handleShare}
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>

        {/* Image Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-6">
          <div className="md:col-span-1 md:order-1 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
            {displayImages.slice(1, 4).map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`${place.name} ${idx + 2}`}
                className="w-24 h-24 md:w-full md:h-32 object-cover flex-shrink-0"
              />
            ))}
          </div>
          <div className="md:col-span-3 md:order-2">
            <img
              src={displayImages[0]}
              alt={place.name}
              className="w-full h-64 md:h-96 object-cover"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <p className="text-muted-foreground">{place.location}, {place.country}</p>

            <div>
              <h2 className="text-xl font-semibold mb-2">About</h2>
              <p className="text-muted-foreground">{place.description}</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-2">Entry Fee</h2>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-lg">
                  {place.entry_fee_type === 'free' ? 'Free Entry' : `$${place.entry_fee}`}
                </span>
              </div>
            </div>

            {place.amenities && place.amenities.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-2">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {place.amenities.map((amenity, idx) => (
                    <span key={idx} className="bg-secondary px-3 py-1 rounded-full text-sm">
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {place.facilities && place.facilities.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-3">Available Facilities</h2>
                <div className="grid gap-3">
                  {place.facilities.map((facility, idx) => (
                    <div key={idx} className="border rounded-lg p-4 flex justify-between items-center">
                      <span className="font-medium">{facility.name}</span>
                      <span className="font-bold">${facility.price}/day</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {place.activities && place.activities.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-3">Available Activities</h2>
                <div className="grid gap-3">
                  {place.activities.map((activity, idx) => (
                    <div key={idx} className="border rounded-lg p-4 flex justify-between items-center">
                      <span className="font-medium">{activity.name}</span>
                      <span className="font-bold">${activity.price}/person</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={openInMaps}
              className="w-full"
            >
              <MapPin className="mr-2 h-4 w-4" />
              View on Map
            </Button>

            <div className="bg-card p-6 rounded-lg border space-y-3">
              <h3 className="font-semibold">Contact Information</h3>
              {place.phone_numbers && place.phone_numbers.map((phone, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href={`tel:${phone}`} className="text-sm">{phone}</a>
                </div>
              ))}
              {place.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <a href={`mailto:${place.email}`} className="text-sm">{place.email}</a>
                </div>
              )}
              <Button 
                className="w-full mt-4" 
                onClick={() => setBookingOpen(true)}
              >
                Book Now
              </Button>
            </div>
          </div>
        </div>
      </main>

      <BookAdventureDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        place={place}
      />

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default AdventurePlaceDetail;
