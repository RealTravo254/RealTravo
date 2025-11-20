import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Phone, Mail, Users, Home, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const AccommodationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [accommodation, setAccommodation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccommodation = async () => {
      try {
        const { data, error } = await supabase
          .from('accommodations')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setAccommodation(data);
      } catch (error) {
        console.error('Error fetching accommodation:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchAccommodation();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 mt-16">
          <Skeleton className="h-96 w-full mb-8" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-24 w-full" />
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  if (!accommodation) return null;

  const displayType = accommodation.accommodation_type === "Others" 
    ? accommodation.custom_type 
    : accommodation.accommodation_type;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div>
              <img
                src={accommodation.image_url}
                alt={accommodation.name}
                className="w-full h-96 object-cover rounded-lg"
              />
              {accommodation.gallery_images && accommodation.gallery_images.length > 1 && (
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {accommodation.gallery_images.slice(1, 5).map((img: string, idx: number) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`Gallery ${idx + 1}`}
                      className="w-full h-24 object-cover rounded"
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{accommodation.name}</h1>
                  <Badge variant="secondary" className="mb-4">{displayType}</Badge>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">
                    KSh {accommodation.price}
                  </p>
                  <p className="text-sm text-muted-foreground">per night</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-5 w-5" />
                  <span>{accommodation.location}, {accommodation.place}, {accommodation.country}</span>
                </div>

                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-muted-foreground" />
                    <span>{accommodation.number_of_rooms} {accommodation.number_of_rooms === 1 ? 'Room' : 'Rooms'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span>Up to {accommodation.capacity} guests</span>
                  </div>
                </div>
              </div>

              <Card className="p-6 mb-6">
                <h3 className="font-semibold mb-4">Contact Information</h3>
                {accommodation.email && (
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${accommodation.email}`} className="hover:underline">
                      {accommodation.email}
                    </a>
                  </div>
                )}
                {accommodation.phone_numbers && accommodation.phone_numbers.map((phone: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${phone}`} className="hover:underline">
                      {phone}
                    </a>
                  </div>
                ))}
                {accommodation.map_link && (
                  <Button variant="outline" className="w-full mt-4" asChild>
                    <a href={accommodation.map_link} target="_blank" rel="noopener noreferrer">
                      <MapPin className="h-4 w-4 mr-2" />
                      View on Map
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                )}
              </Card>

              <Button className="w-full" size="lg">
                Book Now
              </Button>
            </div>
          </div>

          {accommodation.description && (
            <Card className="p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">About this Accommodation</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{accommodation.description}</p>
            </Card>
          )}
        </div>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default AccommodationDetail;