import { Building2, Check, Globe, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Competitor } from "@/lib/types";

export function CompetitorCard({
  competitor,
  selected,
  onToggle,
  disabled,
}: {
  competitor: Competitor;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
        )}
      >
        {selected && <Check className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{competitor.name}</p>
          <Badge variant={competitor.tier === "national" ? "secondary" : "outline"} className="shrink-0">
            {competitor.tier === "national" ? (
              <>
                <Building2 className="h-3 w-3" /> National
              </>
            ) : (
              <>
                <Store className="h-3 w-3" /> Local
              </>
            )}
          </Badge>
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <Globe className="h-3 w-3 shrink-0" />
          {competitor.websiteUrl}
        </p>
      </div>
    </button>
  );
}
