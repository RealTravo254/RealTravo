import { Tent, Zap, Phone } from "lucide-react";

interface QuickNavigationBarProps {
  hasFacilities: boolean;
  hasActivities: boolean;
  hasContact: boolean;
}

export const QuickNavigationBar = ({ hasFacilities, hasActivities, hasContact }: QuickNavigationBarProps) => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const items = [
    { id: 'facilities-section', label: 'Facilities', icon: Tent, show: hasFacilities },
    { id: 'activities-section', label: 'Activities', icon: Zap, show: hasActivities },
    { id: 'contact-section', label: 'Contact', icon: Phone, show: hasContact },
  ].filter(item => item.show);

  if (items.length === 0) return null;

  return (
    <div className="flex md:hidden gap-6 overflow-x-auto scrollbar-hide py-3 px-1 -mx-1">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => scrollToSection(item.id)}
          className="flex items-center gap-1.5 flex-shrink-0 transition-opacity active:opacity-60 hover:opacity-70"
        >
          <item.icon className="h-4 w-4 text-slate-900" />
          <span className="text-sm font-bold text-slate-900">{item.label}</span>
        </button>
      ))}
    </div>
  );
};
