import { Check, ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CampaignDay, CampaignStatus } from "@/lib/types";

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: "border-border",
  approved: "border-success/50 bg-success/5",
  rejected: "border-destructive/40 bg-destructive/5 opacity-70",
};

export function CampaignApprovalQueue({
  days,
  onStatusChange,
  onGenerateCreative,
  generatingDayId,
  creativeErrors,
}: {
  days: CampaignDay[];
  onStatusChange: (id: string, status: CampaignStatus) => void;
  onGenerateCreative: (day: CampaignDay) => void;
  generatingDayId: string | null;
  creativeErrors: Record<string, string>;
}) {
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const isGenerating = generatingDayId === d.id;
        const error = creativeErrors[d.id];
        return (
          <Card key={d.id} className={cn("transition-colors", STATUS_STYLES[d.status])}>
            <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge variant="outline">Day {d.day}</Badge>
                  {d.status === "approved" && <Badge variant="success">Approved</Badge>}
                  {d.status === "rejected" && <Badge variant="destructive">Rejected</Badge>}
                </div>
                <p className="font-semibold leading-snug">{d.hook}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d.caption}</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                  Creative concept
                </p>
                <p className="text-sm text-foreground/90">{d.creativeConcept}</p>

                <div className="mt-3">
                  {d.creativeImageUrl ? (
                    <div className="relative aspect-square w-full max-w-64 overflow-hidden rounded-lg border border-border">
                      <img src={d.creativeImageUrl} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4">
                        <p className="text-lg font-bold leading-tight text-white drop-shadow-md">{d.hook}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute right-2 top-2"
                        onClick={() => onGenerateCreative(d)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                        Regenerate
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => onGenerateCreative(d)} disabled={isGenerating}>
                      {isGenerating ? (
                        <>
                          <Loader2 className="animate-spin" /> Generating creative…
                        </>
                      ) : (
                        <>
                          <ImagePlus /> Generate creative
                        </>
                      )}
                    </Button>
                  )}
                  {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
                </div>
              </div>
              <div className="flex shrink-0 gap-2 sm:flex-col">
                {d.status !== "approved" && (
                  <Button size="sm" variant="success" onClick={() => onStatusChange(d.id, "approved")}>
                    <Check /> Approve
                  </Button>
                )}
                {d.status !== "rejected" && (
                  <Button size="sm" variant="outline" onClick={() => onStatusChange(d.id, "rejected")}>
                    <X /> Reject
                  </Button>
                )}
                {d.status !== "draft" && (
                  <Button size="sm" variant="ghost" onClick={() => onStatusChange(d.id, "draft")}>
                    <RotateCcw /> Reset
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
