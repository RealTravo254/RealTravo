import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { MapPin, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MapViewProps {
  listings: any[];
  onMarkerClick?: (listing: any) => void;
}

export const MapView = ({ listings, onMarkerClick }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!mapContainer.current || !listings.length) return;

    // Get Mapbox token from environment or use placeholder
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN_HERE';
    
    if (mapboxToken === 'YOUR_MAPBOX_TOKEN_HERE') {
      console.warn('Please add your Mapbox token to Supabase Edge Function Secrets');
    }

    mapboxgl.accessToken = mapboxToken;

    // Calculate center based on listings
    const centerLat = listings.reduce((sum, item) => sum + (item.latitude || 0), 0) / listings.length || 0;
    const centerLng = listings.reduce((sum, item) => sum + (item.longitude || 0), 0) / listings.length || 0;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [centerLng || 36.8219, centerLat || -1.2921], // Default to Nairobi
      zoom: 6,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add markers for each listing
    listings.forEach((listing) => {
      // Use latitude/longitude if available, otherwise skip
      const lat = listing.latitude || 0;
      const lng = listing.longitude || 0;

      if (!lat || !lng) return;

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.backgroundImage = 'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)';
      el.style.width = '30px';
      el.style.height = '40px';
      el.style.backgroundSize = 'cover';
      el.style.cursor = 'pointer';

      // Create marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(map.current!);

      // Add click event
      el.addEventListener('click', () => {
        setSelectedListing(listing);
        if (onMarkerClick) {
          onMarkerClick(listing);
        }
      });

      markers.current.push(marker);
    });

    // Cleanup
    return () => {
      markers.current.forEach(marker => marker.remove());
      map.current?.remove();
    };
  }, [listings, onMarkerClick]);

  const handleCardClick = (listing: any) => {
    const typeMap: Record<string, string> = {
      "TRIP": "trip",
      "EVENT": "event",
      "HOTEL": "hotel",
      "ADVENTURE PLACE": "adventure",
      "ACCOMMODATION": "accommodation",
      "ATTRACTION": "attraction"
    };
    navigate(`/${typeMap[listing.type]}/${listing.id}`);
  };

  return (
    <div className="relative w-full h-[calc(100vh-200px)] md:h-[600px] rounded-lg overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Selected listing info card */}
      {selectedListing && (
        <Card className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 p-4 shadow-lg z-10">
          <button
            onClick={() => setSelectedListing(null)}
            className="absolute top-2 right-2 p-1 hover:bg-accent rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          
          <div
            onClick={() => handleCardClick(selectedListing)}
            className="cursor-pointer"
          >
            <img
              src={selectedListing.image_url}
              alt={selectedListing.name}
              loading="lazy"
              decoding="async"
              className="w-full h-40 object-cover rounded-lg mb-3"
            />
            
            <h3 className="font-bold text-base mb-2 line-clamp-2">
              {selectedListing.name}
            </h3>
            
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="line-clamp-1">
                {selectedListing.location}, {selectedListing.country}
              </span>
            </div>
            
            {selectedListing.price && (
              <p className="font-bold text-primary">
                KSh {selectedListing.price}
              </p>
            )}
            
            {selectedListing.entry_fee && (
              <p className="font-bold text-primary">
                KSh {selectedListing.entry_fee}
              </p>
            )}
          </div>
        </Card>
      )}
      
      {/* No location data warning */}
      {listings.length > 0 && !listings.some(l => l.latitude && l.longitude) && (
        <Card className="absolute top-4 left-1/2 -translate-x-1/2 p-3 shadow-lg z-10 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            No location data available for these listings
          </p>
        </Card>
      )}
    </div>
  );
};
