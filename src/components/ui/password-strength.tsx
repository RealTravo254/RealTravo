import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
}

export const PasswordStrength = ({ password }: PasswordStrengthProps) => {
  const requirements = [
    { label: "At least 8 characters", test: (pwd: string) => pwd.length >= 8 },
    { label: "One uppercase letter", test: (pwd: string) => /[A-Z]/.test(pwd) },
    { label: "One lowercase letter", test: (pwd: string) => /[a-z]/.test(pwd) },
    { label: "One number", test: (pwd: string) => /[0-9]/.test(pwd) },
    { label: "One special character", test: (pwd: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd) },
  ];

  const metRequirements = requirements.filter(req => req.test(password)).length;
  const strength = metRequirements === 0 ? 0 : (metRequirements / requirements.length) * 100;

  const getStrengthColor = () => {
    if (strength === 0) return "bg-muted";
    if (strength < 40) return "bg-destructive";
    if (strength < 80) return "bg-warning";
    return "bg-success";
  };

  const getStrengthText = () => {
    if (strength === 0) return "";
    if (strength < 40) return "Weak";
    if (strength < 80) return "Good";
    return "Strong";
  };

  return (
    <div className="space-y-2">
      {password && (
        <>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Password strength:</span>
              <span className={cn(
                "font-semibold",
                strength < 40 && "text-destructive",
                strength >= 40 && strength < 80 && "text-warning",
                strength >= 80 && "text-success"
              )}>
                {getStrengthText()}
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all duration-300", getStrengthColor())}
                style={{ width: `${strength}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            {requirements.map((req, index) => {
              const isMet = req.test(password);
              return (
                <div key={index} className="flex items-center gap-2 text-xs">
                  {isMet ? (
                    <Check className="h-3 w-3 text-success flex-shrink-0" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={cn(
                    isMet ? "text-success" : "text-muted-foreground"
                  )}>
                    {req.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
