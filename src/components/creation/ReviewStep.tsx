import { Card } from "@/components/ui/card";
import { CheckCircle2, MapPin, Clock, DollarSign, Phone, Mail, User, Calendar, Building, Users } from "lucide-react";

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
    amenities?: Array<{ name: string }>;
    facilities?: Array<{ name: string; price: number; capacity?: number | null; is_free?: boolean }>;
    activities?: Array<{ name: string; price: number; is_free?: boolean }>;
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
        {(type === 'hotel' || type === 'adventure') && (
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
      {(type === 'trip' || type === 'event') && (
        <Section title="Date & Schedule" icon={Calendar}>
          {data.isFlexibleDate ? (
            <InfoRow label="Date Type" value="Flexible / Open Availability" fullWidth />
          ) : (
            <InfoRow label="Fixed Date" value={data.date ? new Date(data.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined} />
          )}
          {(data.isFlexibleDate || type === 'event') && (
            <>
              <InfoRow label="Opening Hours" value={data.openingHours} />
              <InfoRow label="Closing Hours" value={data.closingHours} />
            </>
          )}
          {data.isFlexibleDate && (
            <InfoRow label="Working Days" value={formatDays(data.workingDays)} fullWidth />
          )}
        </Section>
      )}

      {/* Operating Hours for Hotel/Adventure */}
      {(type === 'hotel' || type === 'adventure') && (
        <Section title="Operating Hours" icon={Clock}>
          <InfoRow label="Opening Hours" value={data.openingHours} />
          <InfoRow label="Closing Hours" value={data.closingHours} />
          <InfoRow label="Operating Days" value={formatDays(data.workingDays)} fullWidth />
        </Section>
      )}

      {/* Pricing */}
      <Section title="Pricing & Capacity" icon={DollarSign}>
        {(type === 'trip' || type === 'event') && (
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

      {/* Activities */}
      {data.activities && data.activities.length > 0 && (
        <Section title={`Activities (${data.activities.length})`} icon={Users}>
          <div className="col-span-2 flex flex-wrap gap-2">
            {data.activities.map((activity, i) => (
              <span 
                key={i}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
              >
                {activity.name}
                {activity.price > 0 && !activity.is_free && (
                  <span className="text-[10px] opacity-75">({formatPrice(activity.price)})</span>
                )}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Facilities */}
      {data.facilities && data.facilities.length > 0 && (
        <Section title={`Facilities (${data.facilities.length})`} icon={Building}>
          <div className="col-span-2 flex flex-wrap gap-2">
            {data.facilities.map((facility, i) => (
              <span 
                key={i}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700"
              >
                {facility.name}
                {facility.price > 0 && !facility.is_free && (
                  <span className="text-[10px] opacity-75">({formatPrice(facility.price)})</span>
                )}
                {facility.capacity && (
                  <span className="text-[10px] opacity-75">• {facility.capacity} pax</span>
                )}
              </span>
            ))}
          </div>
        </Section>
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
                {amenity.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Contact Info */}
      <Section title="Contact Information" icon={Phone}>
        <InfoRow label="Email" value={data.email} />
        <InfoRow label="Phone" value={data.phoneNumber} />
      </Section>

      {/* Creator Info */}
      {(creatorName || creatorEmail) && (
        <Section title="Creator Profile" icon={User}>
          <InfoRow label="Name" value={creatorName} />
          <InfoRow label="Email" value={creatorEmail} />
          {creatorPhone && <InfoRow label="Phone" value={creatorPhone} />}
        </Section>
      )}

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
