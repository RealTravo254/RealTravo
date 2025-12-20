import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CategoryCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  className?: string;
}

export const CategoryCard = ({
  icon: Icon,
  title,
  description,
  onClick,
  className,
}: CategoryCardProps) => {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "group cursor-pointer overflow-hidden border-2 hover:border-primary transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
        className
      )}
    >
      {/* Reduced padding on all screen: from p-3/p-6 to p-2/p-3 */}
      <div className="p-2 md:p-3 flex flex-col items-center text-center gap-1 md:gap-2">
        {/* Reduced icon container size: from h-10/w-10 to h-8/w-8 AND md:h-16/md:w-16 to md:h-10/md:w-10 */}
        <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground group-hover:scale-110 transition-transform duration-300">
          {/* Reduced LucideIcon size: from h-5/w-5 to h-4/w-4 AND md:h-8/md:w-8 to md:h-5/md:w-5 */}
          <Icon className="h-4 w-4 md:h-5 md:w-5" />
        </div>
        <div>
          {/* Title with matching foreground color on large screens */}
          <h3 className="font-bold text-xs md:text-base mb-0 text-foreground">{title}</h3>
          {/* Description with consistent muted color on all screens */}
          <p className="text-xs text-muted-foreground hidden md:block">{description}</p>
        </div>
      </div>
    </Card>
  );
};
