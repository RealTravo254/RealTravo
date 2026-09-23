import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export const SearchBar = ({ value, onChange, onSubmit }: SearchBarProps) => {
  const navigate = useNavigate();

  // Tapping this bar (it's a launcher, not the real search box) sends the
  // person to /explore and tells that page to open its own search with
  // suggestions ready, instead of typing here.
  const goToExploreSearch = () => {
    navigate("/explore", { state: { openSearch: true } });
  };

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="relative w-full max-w-3xl mx-auto">
          <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          <Input
            type="text"
            readOnly
            placeholder="Search for trips, events, hotels, places, or countries..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={goToExploreSearch}
            onClick={goToExploreSearch}
            className="pl-11 md:pl-14 pr-3 md:pr-4 h-10 md:h-14 text-sm md:text-lg rounded-full border-2 border-border bg-card text-foreground shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground transition-all cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};