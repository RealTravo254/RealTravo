import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Images, Calendar, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FacilityWithImages {
  name: string;
  price: number;
  capacity?: number;
  images?: string[];
  is_free?: boolean;
}

interface FacilityImageCardProps {
  facility: FacilityWithImages;
  itemId: string;
  itemType: "hotel" | "adventure_place";
  accentColor?: string;
}

export const FacilityImageCard = ({ 
  facility, 
  itemId, 
  itemType,
  accentColor = "#008080" 
}: FacilityImageCardProps) => {
  const navigate = useNavigate();
  const [showGallery, setShowGallery] = useState(false);
  
  const hasImages = facility.images && facility.images.length > 0;
  const mainImage = hasImages ? facility.images[0] : null;
  
  const handleReserve = () => {
    // Navigate to booking page with pre-selected facility and skipToFacility flag
    navigate(`/booking/${itemType}/${itemId}?facility=${encodeURIComponent(facility.name)}&skipToFacility=true`);
  };

  return (
    <>
      <div className="bg-background rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="flex">
          {/* Image Section */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 relative bg-muted">
            {mainImage ? (
              <img 
                src={mainImage} 
                alt={facility.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground font-bold">No Image</span>
              </div>
            )}
            
            {/* See All Images Button */}
            {hasImages && facility.images!.length > 1 && (
              <button
                onClick={() => setShowGallery(true)}
                className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-2 py-1 rounded-full flex items-center gap-1 hover:bg-black/80 transition-colors"
              >
                <Images className="h-3 w-3" />
                +{facility.images!.length - 1}
              </button>
            )}
          </div>
          
          {/* Content Section */}
          <div className="flex-1 p-3 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm">{facility.name}</h4>
              <div className="flex items-center gap-2 mt-1">
                {facility.is_free || facility.price === 0 ? (
                  <span className="text-xs font-bold text-emerald-600">Free</span>
                ) : (
                  <span className="text-xs font-bold" style={{ color: accentColor }}>
                    KSh {facility.price.toLocaleString()}/night
                  </span>
                )}
                {facility.capacity && (
                  <span className="text-[10px] text-muted-foreground">
                    • {facility.capacity} guests
                  </span>
                )}
              </div>
            </div>
            
            {/* Reserve Button */}
            <Button
              size="sm"
              onClick={handleReserve}
              className="mt-2 h-8 text-[10px] font-black uppercase tracking-wider rounded-lg"
              style={{ backgroundColor: accentColor }}
            >
              <Calendar className="h-3 w-3 mr-1" />
              Reserve
            </Button>
          </div>
        </div>
      </div>

      {/* Full Gallery Dialog */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="font-black uppercase tracking-tight">
              {facility.name} - Gallery
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <Carousel className="w-full">
              <CarouselContent>
                {facility.images?.map((img, idx) => (
                  <CarouselItem key={idx}>
                    <div className="aspect-video rounded-xl overflow-hidden">
                      <img 
                        src={img} 
                        alt={`${facility.name} - ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </Carousel>
            <p className="text-center text-sm text-muted-foreground mt-3">
              {facility.images?.length} photos
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface FacilitiesGridProps {
  facilities: FacilityWithImages[];
  itemId: string;
  itemType: "hotel" | "adventure_place";
  accentColor?: string;
}

export const FacilitiesGrid = ({ 
  facilities, 
  itemId, 
  itemType,
  accentColor = "#008080" 
}: FacilitiesGridProps) => {
  const paidFacilities = facilities.filter(f => f.price > 0 || !f.is_free);
  
  if (paidFacilities.length === 0) return null;

  return (
    <section className="bg-background rounded-3xl p-6 shadow-sm border border-border">
      <h2 className="text-[11px] font-black uppercase tracking-widest mb-4 text-muted-foreground">
        Facilities & Rooms
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {paidFacilities.map((facility, idx) => (
          <FacilityImageCard
            key={idx}
            facility={facility}
            itemId={itemId}
            itemType={itemType}
            accentColor={accentColor}
          />
        ))}
      </div>
    </section>
  );
};

// Similar component for Activities
interface ActivityWithImages {
  name: string;
  price: number;
  images?: string[];
  is_free?: boolean;
}

interface ActivitiesGridProps {
  activities: ActivityWithImages[];
  itemId: string;
  itemType: "hotel" | "adventure_place";
  accentColor?: string;
}

export const ActivitiesGrid = ({ 
  activities, 
  itemId, 
  itemType,
  accentColor = "#FF7F50" 
}: ActivitiesGridProps) => {
  const paidActivities = activities.filter(a => a.price > 0 || !a.is_free);
  
  if (paidActivities.length === 0) return null;

  return (
    <section className="bg-background rounded-3xl p-6 shadow-sm border border-border">
      <h2 className="text-[11px] font-black uppercase tracking-widest mb-4 text-muted-foreground">
        Activities
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {paidActivities.map((activity, idx) => (
          <ActivityImageCard
            key={idx}
            activity={activity}
            itemId={itemId}
            itemType={itemType}
            accentColor={accentColor}
          />
        ))}
      </div>
    </section>
  );
};

interface ActivityImageCardProps {
  activity: ActivityWithImages;
  itemId: string;
  itemType: "hotel" | "adventure_place";
  accentColor?: string;
}

const ActivityImageCard = ({ 
  activity, 
  itemId, 
  itemType,
  accentColor = "#FF7F50" 
}: ActivityImageCardProps) => {
  const navigate = useNavigate();
  const [showGallery, setShowGallery] = useState(false);
  
  const hasImages = activity.images && activity.images.length > 0;
  const mainImage = hasImages ? activity.images[0] : null;

  return (
    <>
      <div className="bg-background rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="flex">
          <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 relative bg-muted">
            {mainImage ? (
              <img 
                src={mainImage} 
                alt={activity.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground font-bold">No Image</span>
              </div>
            )}
            
            {hasImages && activity.images!.length > 1 && (
              <button
                onClick={() => setShowGallery(true)}
                className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-2 py-1 rounded-full flex items-center gap-1 hover:bg-black/80 transition-colors"
              >
                <Images className="h-3 w-3" />
                +{activity.images!.length - 1}
              </button>
            )}
          </div>
          
          <div className="flex-1 p-3 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm">{activity.name}</h4>
              <div className="mt-1">
                {activity.is_free || activity.price === 0 ? (
                  <span className="text-xs font-bold text-emerald-600">Free</span>
                ) : (
                  <span className="text-xs font-bold" style={{ color: accentColor }}>
                    KSh {activity.price.toLocaleString()}/person
                  </span>
                )}
              </div>
            </div>
            
            <Button
              size="sm"
              onClick={() => navigate(`/booking/${itemType}/${itemId}`)}
              className="mt-2 h-8 text-[10px] font-black uppercase tracking-wider rounded-lg"
              style={{ backgroundColor: accentColor }}
            >
              Book Activity
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="font-black uppercase tracking-tight">
              {activity.name} - Gallery
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <Carousel className="w-full">
              <CarouselContent>
                {activity.images?.map((img, idx) => (
                  <CarouselItem key={idx}>
                    <div className="aspect-video rounded-xl overflow-hidden">
                      <img 
                        src={img} 
                        alt={`${activity.name} - ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </Carousel>
            <p className="text-center text-sm text-muted-foreground mt-3">
              {activity.images?.length} photos
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
