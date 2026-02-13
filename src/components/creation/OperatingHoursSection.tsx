import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WorkingDays {
  Mon: boolean;
  Tue: boolean;
  Wed: boolean;
  Thu: boolean;
  Fri: boolean;
  Sat: boolean;
  Sun: boolean;
}

interface OperatingHoursSectionProps {
  openingHours: string;
  closingHours: string;
  workingDays: WorkingDays;
  onOpeningChange: (value: string) => void;
  onClosingChange: (value: string) => void;
  onDaysChange: (days: WorkingDays) => void;
  accentColor?: string;
}

const HOUR_OPTIONS = [
  "12:00", "12:30", "1:00", "1:30", "2:00", "2:30", "3:00", "3:30",
  "4:00", "4:30", "5:00", "5:30", "6:00", "6:30", "7:00", "7:30",
  "8:00", "8:30", "9:00", "9:30", "10:00", "10:30", "11:00", "11:30"
];

const parseAmPmTime = (timeStr: string): { time: string; period: "AM" | "PM" } | null => {
  if (!timeStr) return null;
  if (timeStr === "00:00") return { time: "12:00", period: "AM" };
  if (timeStr === "23:59") return { time: "11:59", period: "PM" };
  
  // If already has AM/PM
  const match = timeStr.match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i);
  if (match) return { time: match[1], period: match[2].toUpperCase() as "AM" | "PM" };
  
  // Parse 24h format
  const parts = timeStr.split(":");
  if (parts.length === 2) {
    let h = parseInt(parts[0]);
    const m = parts[1];
    if (h === 0) return { time: `12:${m}`, period: "AM" };
    if (h < 12) return { time: `${h}:${m}`, period: "AM" };
    if (h === 12) return { time: `12:${m}`, period: "PM" };
    return { time: `${h - 12}:${m}`, period: "PM" };
  }
  return null;
};

const formatToStorageTime = (time: string, period: "AM" | "PM"): string => {
  return `${time} ${period}`;
};

export const OperatingHoursSection = ({
  openingHours,
  closingHours,
  workingDays,
  onOpeningChange,
  onClosingChange,
  onDaysChange,
  accentColor = "#008080"
}: OperatingHoursSectionProps) => {
  const is24Hours = openingHours === "00:00" && closingHours === "23:59";

  const openParsed = parseAmPmTime(openingHours);
  const closeParsed = parseAmPmTime(closingHours);

  const openTime = openParsed?.time || "8:00";
  const openPeriod = openParsed?.period || "AM";
  const closeTime = closeParsed?.time || "11:00";
  const closePeriod = closeParsed?.period || "PM";

  const toggle24Hours = (checked: boolean) => {
    if (checked) {
      onOpeningChange("00:00");
      onClosingChange("23:59");
    } else {
      onOpeningChange("8:00 AM");
      onClosingChange("11:00 PM");
    }
  };

  const handleOpenTimeChange = (time: string) => {
    onOpeningChange(formatToStorageTime(time, openPeriod));
  };

  const handleOpenPeriodChange = (period: "AM" | "PM") => {
    onOpeningChange(formatToStorageTime(openTime, period));
  };

  const handleCloseTimeChange = (time: string) => {
    onClosingChange(formatToStorageTime(time, closePeriod));
  };

  const handleClosePeriodChange = (period: "AM" | "PM") => {
    onClosingChange(formatToStorageTime(closeTime, period));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operating Days</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(workingDays) as (keyof WorkingDays)[]).map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => onDaysChange({ ...workingDays, [day]: !workingDays[day] })}
              className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${
                workingDays[day]
                  ? 'text-white border-transparent shadow-md'
                  : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
              }`}
              style={workingDays[day] ? { backgroundColor: accentColor } : {}}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* 24 Hours Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
        <div>
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Open 24 Hours</Label>
          <p className="text-[10px] text-muted-foreground">Toggle on if open all day</p>
        </div>
        <Switch checked={is24Hours} onCheckedChange={toggle24Hours} />
      </div>

      {!is24Hours && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Opening Time</Label>
            <div className="flex gap-2">
              <Select value={openTime} onValueChange={handleOpenTimeChange}>
                <SelectTrigger className="rounded-xl h-12 border-slate-100 bg-slate-50 font-bold flex-1">
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl max-h-60">
                  {HOUR_OPTIONS.map(h => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={openPeriod} onValueChange={(v) => handleOpenPeriodChange(v as "AM" | "PM")}>
                <SelectTrigger className="rounded-xl h-12 border-slate-100 bg-slate-50 font-bold w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl">
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Closing Time</Label>
            <div className="flex gap-2">
              <Select value={closeTime} onValueChange={handleCloseTimeChange}>
                <SelectTrigger className="rounded-xl h-12 border-slate-100 bg-slate-50 font-bold flex-1">
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl max-h-60">
                  {HOUR_OPTIONS.map(h => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={closePeriod} onValueChange={(v) => handleClosePeriodChange(v as "AM" | "PM")}>
                <SelectTrigger className="rounded-xl h-12 border-slate-100 bg-slate-50 font-bold w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl">
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};