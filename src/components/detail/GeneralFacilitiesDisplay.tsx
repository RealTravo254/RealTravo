import { AVAILABLE_FACILITIES } from "@/components/creation/GeneralFacilitiesSelector";

interface GeneralFacilitiesDisplayProps {
  facilityIds: string[];
}

export const GeneralFacilitiesDisplay = ({ facilityIds }: GeneralFacilitiesDisplayProps) => {
  if (!facilityIds || facilityIds.length === 0) return null;

  const facilities = facilityIds
    .map(id => AVAILABLE_FACILITIES.find(f => f.id === id))
    .filter(Boolean);

  if (facilities.length === 0) return null;

  return (
    <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <h2 className="text-[11px] font-black uppercase tracking-widest mb-4 text-slate-400">General Facilities</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {facilities.map((facility) => {
          if (!facility) return null;
          const Icon = facility.icon;
          return (
            <div
              key={facility.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
            >
              <div className="p-2 rounded-lg bg-teal-50">
                <Icon className="h-4 w-4 text-teal-600" />
              </div>
              <span className="text-xs font-bold text-slate-700">{facility.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};