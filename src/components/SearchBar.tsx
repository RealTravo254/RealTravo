import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export const SearchBar = ({ value, onChange, onSubmit }: SearchBarProps) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSubmit();
    }
  };

  return (
    <div className="relative w-full mx-auto">
      <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search for trips, events, hotels, places, or countries..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        className="pl-10 md:pl-12 pr-3 md:pr-4 h-10 md:h-14 text-sm md:text-lg rounded-full border-2 focus-visible:border-primary shadow-md"
      />
    </div>
  );
};