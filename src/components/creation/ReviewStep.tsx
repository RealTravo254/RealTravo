import { Card } from "@/components/ui/card";
import { CheckCircle2, MapPin, Clock, DollarSign, Phone, Mail, User, Calendar, Building, Users, Ticket, Image as ImageIcon } from "lucide-react";

interface FacilityWithImages {
  name: string;
  price: number;
  capacity?: number | null;
  is_free?: boolean;
  images?: string[];
}

interface ActivityWithImages {
  name: string;
  price: number;
  is_free?: boolean;
  images?: string[];
}

interface ReviewStepProps {
  type: 'hotel' | 'adventure' | 'trip' | 'event';
  data: {
    name: string;
    registrationNumber?: string;
    registrationName?: string;
    location?: string;
    place?: string;
    country?: string;
    description?: string;
    email?: string;
    phoneNumber?: string;
    openingHours?: string;
    closingHours?: string;
    workingDays?: string[];
    // Entry fees (for adventure)
    entranceFeeType?: string;
    adultPrice?: string;
    childPrice?: string;
    // Trip/Event specific
    date?: string;
    isFlexibleDate?: boolean;
    priceAdult?: string;
    priceChild?: string;
    capacity?: string;
    // Amenities, facilities, activities
    amenities?: Array<{ name: string } | string>;
    facilities?: FacilityWithImages[];
    activities?: ActivityWithImages[];
    // Images count
    imageCount?: number;
  };
  creatorName?: string;
  creatorEmail?: string;
  creatorPhone?: string;
  accentColor?: string;
}

export const ReviewStep = ({ type, data, creatorName, creatorEmail, creatorPhone, accentColor = "#008080" }: ReviewStepProps) => {
  const formatPrice = (price: string | number | undefined) => {
    if (!price) return "Free";
    const num = typeof price === 'string' ? parseFloat(price) : price;
    if (num === 0) return "Free";
    return `KES ${num.toLocaleString()}`;
  };

  const formatDays = (days?: string[]) => {
    if (!days || days.length === 0) return "Not specified";
    return days.join(", ");
  };

  const Section = ({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon: React.ElementType }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${accentColor}15` }}>
          <Icon className="h-4 w-4" style={{ color: accentColor }} />
        </div>
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</h4>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">{children}</div>
    </div>
  );

  const InfoRow = ({ label, value, fullWidth = false }: { label: string; value: string | undefined; fullWidth?: boolean }) => (
    <div className={fullWidth ? "col-span-2" : ""}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="font-bold text-slate-700 truncate">{value || "—"}</p>
    </div>
  );

  const isHotelOrAdventure = type === 'hotel' || type === 'adventure';
  const isTripOrEvent = type === 'trip' || type === 'event';

  return (
    <Card className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-100 space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2.5 rounded-xl bg-green-50">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: accentColor }}>
            Review Your Listing
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
            Please verify all details before submitting
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <Section title="Basic Information" icon={Building}>
        <InfoRow label="Name" value={data.name} fullWidth />
        {isHotelOrAdventure && (
          <>
            <InfoRow label="Registration Name" value={data.registrationName} />
            <InfoRow label="Registration Number" value={data.registrationNumber} />
          </>
        )}
        {data.description && (
          <div className="col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</p>
            <p className="font-medium text-slate-600 text-sm line-clamp-3">{data.description}</p>
          </div>
        )}
      </Section>

      {/* Location */}
      <Section title="Location" icon={MapPin}>
        <InfoRow label="Country" value={data.country} />
        <InfoRow label="City/Place" value={data.place} />
        <InfoRow label="Specific Location" value={data.location} fullWidth />
      </Section>

      {/* Date & Time for Trip/Event */}
      {isTripOrEvent && (
        <Section title="Date & Schedule" icon={Calendar}>
          {data.isFlexibleDate ? (
            <>
              <InfoRow label="Date Type" value="Flexible / Open Availability" fullWidth />
              <InfoRow label="Opening Hours" value={data.openingHours} />
              <InfoRow label="Closing Hours" value={data.closingHours} />
              <InfoRow label="Working Days" value={formatDays(data.workingDays)} fullWidth />
            </>
          ) : (
            <>
              <InfoRow label="Fixed Date" value={data.date ? new Date(data.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined} />
              <InfoRow label="Event/Trip Hours" value={data.openingHours && data.closingHours ? `${data.openingHours} - ${data.closingHours}` : undefined} />
            </>
          )}
        </Section>
      )}

      {/* Operating Hours for Hotel/Adventure */}
      {isHotelOrAdventure && (
        <Section title="Operating Hours" icon={Clock}>
          <InfoRow label="Opening Hours" value={data.openingHours} />
          <InfoRow label="Closing Hours" value={data.closingHours} />
          <InfoRow label="Operating Days" value={formatDays(data.workingDays)} fullWidth />
        </Section>
      )}

      {/* Pricing */}
      <Section title="Pricing & Capacity" icon={DollarSign}>
        {isTripOrEvent && (
          <>
            <InfoRow label="Adult Price" value={formatPrice(data.priceAdult)} />
            <InfoRow label="Child Price" value={formatPrice(data.priceChild)} />
            <InfoRow label="Max Capacity" value={data.capacity ? `${data.capacity} slots` : undefined} />
          </>
        )}
        {type === 'adventure' && (
          <>
            <InfoRow label="Entry Fee Type" value={data.entranceFeeType === 'paid' ? 'Paid' : 'Free'} />
            {data.entranceFeeType === 'paid' && (
              <>
                <InfoRow label="Adult Entry Fee" value={formatPrice(data.adultPrice)} />
                <InfoRow label="Child Entry Fee" value={formatPrice(data.childPrice)} />
              </>
            )}
          </>
        )}
      </Section>

      {/* Facilities - Enhanced with images */}
      {data.facilities && data.facilities.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50">
              <Building className="h-4 w-4 text-amber-600" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
              Facilities ({data.facilities.length})
            </h4>
          </div>
          <div className="space-y-3">
            {data.facilities.map((facility, i) => (
              <div 
                key={i}
                className="p-3 rounded-xl bg-amber-50/50 border border-amber-100"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-slate-700">{facility.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        facility.is_free || facility.price === 0
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-amber-100 text-amber-600"
                      }`}>
                        {facility.is_free || facility.price === 0 ? "Free" : `KES ${facility.price.toLocaleString()}/night`}
                      </span>
                      {facility.capacity && (
                        <span className="text-[10px] font-bold text-slate-500">
                          • {facility.capacity} guests
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Facility Images */}
                {facility.images && facility.images.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {facility.images.map((img, imgIdx) => (
                      <div key={imgIdx} className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
                        <img src={img} alt={`${facility.name} ${imgIdx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <div className="flex items-center text-[10px] text-slate-400 font-bold ml-1">
                      <ImageIcon className="h-3 w-3 mr-1" />
                      {facility.images.length}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities - Enhanced with images */}
      {data.activities && data.activities.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${accentColor}15` }}>
              <Users className="h-4 w-4" style={{ color: accentColor }} />
            </div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
              Activities ({data.activities.length})
            </h4>
          </div>
          <div className="space-y-3">
            {data.activities.map((activity, i) => (
              <div 
                key={i}
                className="p-3 rounded-xl border border-slate-100"
                style={{ backgroundColor: `${accentColor}08` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-slate-700">{activity.name}</p>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full mt-1 inline-block ${
                      activity.is_free || activity.price === 0
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {activity.is_free || activity.price === 0 ? "Free" : `KES ${activity.price.toLocaleString()}/person`}
                    </span>
                  </div>
                </div>
                {/* Activity Images */}
                {activity.images && activity.images.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {activity.images.map((img, imgIdx) => (
                      <div key={imgIdx} className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
                        <img src={img} alt={`${activity.name} ${imgIdx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <div className="flex items-center text-[10px] text-slate-400 font-bold ml-1">
                      <ImageIcon className="h-3 w-3 mr-1" />
                      {activity.images.length}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Amenities */}
      {data.amenities && data.amenities.length > 0 && (
        <Section title={`Amenities (${data.amenities.length})`} icon={CheckCircle2}>
          <div className="col-span-2 flex flex-wrap gap-2">
            {data.amenities.map((amenity, i) => (
              <span 
                key={i}
                className="inline-flex px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600"
              >
                {typeof amenity === 'string' ? amenity : amenity.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Contact Info - Item Phone/Email */}
      <Section title="Contact Information" icon={Phone}>
        <InfoRow label="Item Email" value={data.email} />
        <InfoRow label="Item Phone" value={data.phoneNumber} />
      </Section>

      {/* Creator Info */}
      <Section title="Creator Profile" icon={User}>
        <InfoRow label="Name" value={creatorName || "Not available"} />
        <InfoRow label="Email" value={creatorEmail || "Not available"} />
        {creatorPhone && <InfoRow label="Phone" value={creatorPhone} />}
      </Section>

      {/* Images */}
      {data.imageCount && data.imageCount > 0 && (
        <div className="pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-green-600 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {data.imageCount} {data.imageCount === 1 ? 'image' : 'images'} uploaded
          </p>
        </div>
      )}
    </Card>
  );
};
