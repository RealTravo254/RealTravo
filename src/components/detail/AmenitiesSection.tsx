import { ShieldCheck } from "lucide-react";

interface AmenitiesSectionProps {
  amenities: (string | { name: string })[];
}

export const AmenitiesSection = ({ amenities }: AmenitiesSectionProps) => {
  if (!amenities || amenities.length === 0) return null;

  return (
    <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-5 w-5 text-teal-600" />
        <h2 className="text-sm font-black uppercase tracking-widest text-teal-600">Amenities</h2>
      </div>
      
      {/* Desktop: Single column list | Mobile: 2-column grid */}
      <ul className="grid grid-cols-2 md:grid-cols-1 gap-x-6 gap-y-2">
        {amenities.map((amenity, idx) => {
          const amenityName = typeof amenity === 'string' ? amenity : amenity.name;
          return (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-slate-900 font-bold mt-1.5">•</span>
              <span className="text-sm text-slate-900 font-bold capitalize">{amenityName}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
