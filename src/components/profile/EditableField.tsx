// src/components/profile/EditableField.tsx
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pencil, Check, X, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableFieldProps {
  icon: ReactNode;
  label: string;
  /** Read-only rendering of the current value. */
  display: ReactNode;
  /** Input(s) shown while editing. */
  children: ReactNode;
  isEditing: boolean;
  isSaving?: boolean;
  /** true when this field is time-locked and cannot be edited right now. */
  locked?: boolean;
  lockedMessage?: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  noBorder?: boolean;
}

export function EditableField({
  icon,
  label,
  display,
  children,
  isEditing,
  isSaving,
  locked,
  lockedMessage,
  onEdit,
  onSave,
  onCancel,
  noBorder,
}: EditableFieldProps) {
  return (
    <div
      className={cn(
        "p-4 flex items-start gap-3 transition-colors",
        !noBorder && "border-b border-border/60",
        isEditing && "bg-muted/30",
      )}
    >
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            {label}
          </Label>

          {!isEditing && !locked && (
            <button
              type="button"
              onClick={onEdit}
              className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}

          {locked && !isEditing && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
              <Lock className="h-3 w-3" />
              Locked
            </span>
          )}
        </div>

        {!isEditing ? (
          <div className="text-sm font-semibold text-foreground">{display}</div>
        ) : (
          <div className="space-y-3">
            {children}
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={isSaving}
                className="h-8 px-3 text-xs font-semibold"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Save
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onCancel}
                disabled={isSaving}
                className="h-8 px-3 text-xs"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {locked && lockedMessage && (
          <p className="text-[11px] text-muted-foreground mt-1">{lockedMessage}</p>
        )}
      </div>
    </div>
  );
}