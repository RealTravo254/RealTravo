import { Card } from "@/components/ui/card";
import { CheckCircle2, MapPin, Clock, DollarSign, Phone, User, Calendar, Building, Users, Image as ImageIcon, Link as LinkIcon, Sparkles, Globe2, Navigation } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface FacilityWithImages {
  name: string;
  price: number;
  capacity?: number | null;
  is_free?: boolean;
  booking_link?: string;
  bookingLink?: string;
  amenities?: string[];
  images?: string[];
}

interface ActivityWithImages {
  name: string;
  price: number;
  is_free?: boolean;
  images?: string[];
  previewUrls?: string[];
}

interface ReviewStepProps {
  type: 'hotel' | 'adventure' | 'trip' | 'event';
  data: {
    name: string;
    registrationNumber?: string;
    registrationName?: string;
    location?: string;
    locationName?: string;
    place?: string;
    country?: string;
    description?: string;
    email?: string;
    phoneNumber?: string;
    openingHours?: string;
    closingHours?: string;
    workingDays?: string[];
    entranceFeeType?: string;
    adultPrice?: string;
    childPrice?: string;
    date?: string;
    isFlexibleDate?: boolean;
    flexibleDurationMonths?: string;
    priceAdult?: string;
    priceChild?: string;
    capacity?: string;
    tripType?: string;
    establishmentType?: string;
    generalBookingLink?: string;
    amenities?: Array<{ name: string } | string>;
    generalFacilities?: string[];
    facilities?: FacilityWithImages[];
    activities?: ActivityWithImages[];
    latitude?: number | null;
    longitude?: number | null;
    mapLink?: string;
    imageCount?: number;
    galleryPreviewUrls?: string[];
    inclusions?: string[];
    exclusions?: string[];
    ticketTypes?: { name: string; price: number }[];
    allowChildren?: boolean;
    traLicensePreviewUrl?: string;
    eventCertificatePreviewUrl?: string;
    pickupLocation?: string; // ← ADDED
  };
  creatorName?: string;
  creatorEmail?: string;
  creatorPhone?: string;
  accentColor?: string;
}

export const ReviewStep = ({ type, data, creatorName, creatorEmail, creatorPhone, accentColor = "#008080" }: ReviewStepProps) => {
  const { formatPrice: currencyFormat, usdHint } = useCurrency();
  const formatPrice = (price: string | number | undefined) => {
    if (!price) return "Free";
    const num = typeof price === 'string' ? parseFloat(price) : price;
    if (num === 0) return "Free";
    return `${currencyFormat(num)}`;
  };

  const formatDays = (days?: string[]) => {
    if (!days || days.length === 0) return "Not specified";
    return days.join(", ");
  };

  const isHotelOrAdventure = type === 'hotel' || type === 'adventure';
  const isTripOrEvent = type === 'trip' || type === 'event';

  const establishmentLabel = data.establishmentType === 'accommodation_only' ? 'Accommodation Only'
    : data.establishmentType === 'hotel' ? 'Hotel / Resort'
    : data.establishmentType || undefined;

  const SectionHeader = ({ title, icon: Icon, count, colorClass = "bg-primary/10 text-primary" }: { title: string; icon: React.ElementType; count?: number; colorClass?: string }) => (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`p-2 rounded-xl ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <h4 className="text-sm font-bold text-foreground tracking-tight">{title}</h4>
      {count !== undefined && (
        <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  );

  const InfoItem = ({ label, value, fullWidth = false }: { label: string; value: string | undefined; fullWidth?: boolean }) => {
    if (!value && value !== "—") return null;
    return (
      <div className={`${fullWidth ? "col-span-2" : ""} p-3 rounded-xl bg-muted/50 border border-border/50`}>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className="font-semibold text-foreground text-sm truncate">{value || "—"}</p>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Card */}
      <Card className="relative overflow-hidden rounded-2xl border-0 shadow-lg">
        <div className="absolute inset-0 opacity-[0.06]" style={{ background: `linear-gradient(135deg, ${accentColor}, transparent)` }} />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/10 shrink-0">
              <Sparkles className="h-6 w-6 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                Review Your Listing
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Verify all details below before submitting for approval
              </p>
              {data.name && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-bold text-primary truncate max-w-[200px] sm:max-w-none">{data.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Basic Information */}
      <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
        <SectionHeader title="Basic Information" icon={Building} colorClass="bg-blue-500/10 text-blue-600" />
        <div className="grid grid-cols-2 gap-2.5">
          <InfoItem label="Name" value={data.name} fullWidth />
          {isHotelOrAdventure && (
            <>
              <InfoItem label="Registration Name" value={data.registrationName} />
              <InfoItem label="Registration No." value={data.registrationNumber} />
            </>
          )}
          {type === 'hotel' && data.establishmentType && (
            <InfoItem label="Type" value={establishmentLabel} />
          )}
          {isTripOrEvent && data.tripType && (
            <InfoItem label="Listing Type" value={data.tripType === 'trip' ? 'Trip / Tour' : 'Event / Sport'} />
          )}
          {data.description && (
            <div className="col-span-2 p-3 rounded-xl bg-muted/50 border border-border/50">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">{data.description}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Location */}
      <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
        <SectionHeader title="Location" icon={MapPin} colorClass="bg-rose-500/10 text-rose-600" />
        <div className="grid grid-cols-2 gap-2.5">
          <InfoItem label="Country" value={data.country} />
          <InfoItem label="City / Place" value={data.place} />
          {data.location && <InfoItem label="Specific Location" value={data.location} fullWidth />}
          {data.locationName && <InfoItem label="Location Name" value={data.locationName} fullWidth />}
          {/* PICKUP LOCATION — trips only */}
          {type === 'trip' && data.pickupLocation && (
            <div className="col-span-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Navigation className="h-3 w-3" /> Pickup Location
              </p>
              <p className="font-semibold text-amber-800 text-sm">{data.pickupLocation}</p>
            </div>
          )}
          {data.latitude && data.longitude && (
            <InfoItem label="GPS" value={`${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`} fullWidth />
          )}
        </div>
      </Card>

      {/* Schedule */}
      {isTripOrEvent && (
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
          <SectionHeader title="Date & Schedule" icon={Calendar} colorClass="bg-violet-500/10 text-violet-600" />
          <div className="grid grid-cols-2 gap-2.5">
            {data.isFlexibleDate ? (
              <>
                <InfoItem label="Date Type" value="Flexible / Open" fullWidth />
                {data.flexibleDurationMonths && (
                  <InfoItem label="Duration" value={`${data.flexibleDurationMonths} month${data.flexibleDurationMonths === '1' ? '' : 's'}`} />
                )}
                <InfoItem label="Opens" value={data.openingHours} />
                <InfoItem label="Closes" value={data.closingHours} />
                <InfoItem label="Working Days" value={formatDays(data.workingDays)} fullWidth />
              </>
            ) : (
              <>
                <InfoItem label="Date" value={data.date ? new Date(data.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined} />
                <InfoItem label="Hours" value={data.openingHours && data.closingHours ? `${data.openingHours} – ${data.closingHours}` : undefined} />
              </>
            )}
          </div>
        </Card>
      )}

      {/* Operating Hours */}
      {isHotelOrAdventure && (
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
          <SectionHeader title="Operating Hours" icon={Clock} colorClass="bg-amber-500/10 text-amber-600" />
          <div className="grid grid-cols-2 gap-2.5">
            {data.openingHours === "00:00" && data.closingHours === "23:59" ? (
              <InfoItem label="Hours" value="Open 24 Hours" fullWidth />
            ) : (
              <>
                <InfoItem label="Opens" value={data.openingHours} />
                <InfoItem label="Closes" value={data.closingHours} />
              </>
            )}
            <InfoItem label="Operating Days" value={formatDays(data.workingDays)} fullWidth />
          </div>
        </Card>
      )}

      {/* Pricing */}
      <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
        <SectionHeader title="Pricing & Capacity" icon={DollarSign} colorClass="bg-emerald-500/10 text-emerald-600" />
        <div className="grid grid-cols-2 gap-2.5">
          {isTripOrEvent && (
            <>
              <InfoItem label="Adult Price" value={formatPrice(data.priceAdult)} />
              <InfoItem label="Child Price" value={formatPrice(data.priceChild)} />
              <InfoItem label="Capacity" value={data.capacity ? `${data.capacity} slots` : undefined} />
            </>
          )}
          {type === 'adventure' && (
            <>
              <InfoItem label="Entry Type" value={data.entranceFeeType === 'paid' ? 'Paid' : 'Free'} />
              {data.entranceFeeType === 'paid' && (
                <>
                  <InfoItem label="Adult Fee" value={formatPrice(data.adultPrice)} />
                  <InfoItem label="Child Fee" value={formatPrice(data.childPrice)} />
                </>
              )}
            </>
          )}
          {type === 'hotel' && data.generalBookingLink && (
            <InfoItem label="Booking Link" value={data.generalBookingLink} fullWidth />
          )}
        </div>
      </Card>

      {/* Children & Ticket Types */}
      {isTripOrEvent && (
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
          <SectionHeader title="Ticket Info" icon={Users} colorClass="bg-indigo-500/10 text-indigo-600" />
          <div className="grid grid-cols-2 gap-2.5">
            <InfoItem label="Children Allowed" value={data.allowChildren === false ? "No" : "Yes"} />
            {data.ticketTypes && data.ticketTypes.length > 0 && (
              <div className="col-span-2 space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ticket Types</p>
                {data.ticketTypes.map((t, i) => (
                  <div key={i} className="flex justify-between p-2 rounded-lg bg-muted/50 border border-border/50">
                    <span className="text-sm font-semibold">{t.name}</span>
                    <span className="text-sm font-bold">{currencyFormat(t.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Inclusions & Exclusions */}
      {isTripOrEvent && ((data.inclusions && data.inclusions.length > 0) || (data.exclusions && data.exclusions.length > 0)) && (
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
          <SectionHeader title="Package Details" icon={CheckCircle2} colorClass="bg-emerald-500/10 text-emerald-600" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.inclusions && data.inclusions.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase text-emerald-600 tracking-widest mb-2">✓ Included</p>
                <ul className="space-y-1.5">
                  {data.inclusions.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                      <span className="mt-0.5">✓</span><span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.exclusions && data.exclusions.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase text-red-500 tracking-widest mb-2">✗ Not Included</p>
                <ul className="space-y-1.5">
                  {data.exclusions.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-600">
                      <span className="mt-0.5">✗</span><span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* General Amenities */}
      {data.generalFacilities && data.generalFacilities.length > 0 && (
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
          <SectionHeader title="General Amenities" icon={CheckCircle2} count={data.generalFacilities.length} colorClass="bg-teal-500/10 text-teal-600" />
          <div className="flex flex-wrap gap-2">
            {data.generalFacilities.map((item, i) => (
              <span key={i} className="px-3 py-1.5 bg-primary/8 text-primary rounded-full text-xs font-semibold border border-primary/15">
                {item}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Facilities */}
      {data.facilities && data.facilities.length > 0 && (
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
          <SectionHeader title="Facilities" icon={Building} count={data.facilities.length} colorClass="bg-amber-500/10 text-amber-600" />
          <div className="space-y-3">
            {data.facilities.map((facility, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-muted/40 border border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-foreground text-sm">{facility.name}</p>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                    facility.is_free || facility.price === 0
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-amber-500/10 text-amber-600"
                  }`}>
                    {facility.is_free || facility.price === 0 ? "Free" : `${currencyFormat(facility.price)}/night`}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {facility.capacity && (
                    <span className="text-[11px] text-muted-foreground font-medium">
                      👥 {facility.capacity} guests
                    </span>
                  )}
                  {(facility.booking_link || facility.bookingLink) && (
                    <span className="text-[11px] text-blue-500 font-medium flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" /> Has booking link
                    </span>
                  )}
                </div>
                {facility.amenities && facility.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {facility.amenities.map((a, j) => (
                      <span key={j} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {facility.images && facility.images.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
                    {facility.images.map((img, imgIdx) => (
                      <div key={imgIdx} className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-muted ring-1 ring-border/30">
                        <img src={img} alt={`${facility.name} ${imgIdx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))}
                    <span className="flex items-center text-[10px] text-muted-foreground font-medium ml-1 shrink-0">
                      <ImageIcon className="h-3 w-3 mr-1" />{facility.images.length}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Activities */}
      {data.activities && data.activities.length > 0 && (
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
          <SectionHeader title="Activities" icon={Users} count={data.activities.length} colorClass="bg-indigo-500/10 text-indigo-600" />
          <div className="space-y-3">
            {data.activities.map((activity, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-muted/40 border border-border/40">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground text-sm">{activity.name}</p>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                    activity.is_free || activity.price === 0
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {activity.is_free || activity.price === 0 ? "Free" : `${currencyFormat(activity.price)}/person`}
                  </span>
                </div>
                {activity.images && activity.images.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
                    {activity.images.map((img, imgIdx) => (
                      <div key={imgIdx} className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-muted ring-1 ring-border/30">
                        <img src={img} alt={`${activity.name} ${imgIdx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))}
                    <span className="flex items-center text-[10px] text-muted-foreground font-medium ml-1 shrink-0">
                      <ImageIcon className="h-3 w-3 mr-1" />{activity.images.length}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Amenities */}
      {data.amenities && data.amenities.length > 0 && (
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
          <SectionHeader title="Amenities" icon={CheckCircle2} count={data.amenities.length} colorClass="bg-teal-500/10 text-teal-600" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.amenities.map((amenity, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-xs text-foreground font-medium truncate">
                  {typeof amenity === 'string' ? amenity : amenity.name}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Contact & Creator - Side by side on larger screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
          <SectionHeader title="Contact Info" icon={Phone} colorClass="bg-sky-500/10 text-sky-600" />
          <div className="space-y-2.5">
            <InfoItem label="Email" value={data.email} fullWidth />
            <InfoItem label="Phone" value={data.phoneNumber} fullWidth />
          </div>
        </Card>

        <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
          <SectionHeader title="Creator Profile" icon={User} colorClass="bg-purple-500/10 text-purple-600" />
          <div className="space-y-2.5">
            <InfoItem label="Name" value={creatorName || "Not available"} fullWidth />
            <InfoItem label="Email" value={creatorEmail || "Not available"} fullWidth />
            {creatorPhone && <InfoItem label="Phone" value={creatorPhone} fullWidth />}
          </div>
        </Card>
      </div>

      {/* Gallery */}
      {data.galleryPreviewUrls && data.galleryPreviewUrls.length > 0 && (
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4 sm:p-5">
          <SectionHeader title="Gallery" icon={ImageIcon} count={data.galleryPreviewUrls.length} colorClass="bg-pink-500/10 text-pink-600" />
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {data.galleryPreviewUrls.map((url, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-muted ring-1 ring-border/30">
                <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Image count fallback */}
      {(!data.galleryPreviewUrls || data.galleryPreviewUrls.length === 0) && data.imageCount && data.imageCount > 0 && (
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {data.imageCount} {data.imageCount === 1 ? 'image' : 'images'} uploaded
            </p>
          </div>
        </Card>
      )}

      {/* TRA License Preview */}
      {data.traLicensePreviewUrl && (
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4">
          <SectionHeader title="TRA License" icon={ImageIcon} colorClass="bg-amber-500/10 text-amber-600" />
          <div className="rounded-xl overflow-hidden border border-border/40">
            <img src={data.traLicensePreviewUrl} alt="TRA License" className="w-full h-40 object-cover" />
          </div>
        </Card>
      )}

      {/* Event Certificate Preview */}
      {data.eventCertificatePreviewUrl && (
        <Card className="rounded-2xl border border-border/60 shadow-sm p-4">
          <SectionHeader title="Event Certificate / Permit" icon={ImageIcon} colorClass="bg-purple-500/10 text-purple-600" />
          <div className="rounded-xl overflow-hidden border border-border/40">
            <img src={data.eventCertificatePreviewUrl} alt="Event Certificate" className="w-full h-40 object-cover" />
          </div>
        </Card>
      )}
    </div>
  );
};