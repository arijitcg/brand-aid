import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CampaignApprovalQueue } from "@/components/dashboard/CampaignApprovalQueue";
import { generateCampaign, generateCampaignCreative, getCampaign, getSearch, updateCampaignStatus } from "@/lib/dataStore";
import type { CampaignDay, CampaignStatus } from "@/lib/types";

export default function Campaign() {
  const { searchId } = useParams<{ searchId: string }>();
  const queryClient = useQueryClient();
  const [generatingDayId, setGeneratingDayId] = React.useState<string | null>(null);
  const [creativeErrors, setCreativeErrors] = React.useState<Record<string, string>>({});

  const searchQuery = useQuery({
    queryKey: ["search", searchId],
    queryFn: () => getSearch(searchId as string),
    enabled: Boolean(searchId),
  });

  const campaignQuery = useQuery({
    queryKey: ["campaign", searchId],
    queryFn: () => getCampaign(searchId as string),
    enabled: Boolean(searchId),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateCampaign(searchId as string),
    onSuccess: (days) => queryClient.setQueryData(["campaign", searchId], days),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CampaignStatus }) => updateCampaignStatus(id, status),
    onSuccess: (_data, { id, status }) => {
      queryClient.setQueryData(["campaign", searchId], (old: Awaited<ReturnType<typeof getCampaign>> | undefined) =>
        old?.map((d) => (d.id === id ? { ...d, status } : d))
      );
    },
  });

  const creativeMutation = useMutation({
    mutationFn: (day: CampaignDay) => generateCampaignCreative(day.id, day.creativeConcept),
    onMutate: (day) => {
      setGeneratingDayId(day.id);
      setCreativeErrors((prev) => {
        const next = { ...prev };
        delete next[day.id];
        return next;
      });
    },
    onSuccess: (imageUrl, day) => {
      queryClient.setQueryData(["campaign", searchId], (old: Awaited<ReturnType<typeof getCampaign>> | undefined) =>
        old?.map((d) => (d.id === day.id ? { ...d, creativeImageUrl: imageUrl } : d))
      );
    },
    onError: (err, day) => {
      setCreativeErrors((prev) => ({
        ...prev,
        [day.id]: err instanceof Error ? err.message : "Failed to generate creative.",
      }));
    },
    onSettled: () => setGeneratingDayId(null),
  });

  const days = campaignQuery.data ?? [];
  const approvedCount = days.filter((d) => d.status === "approved").length;

  return (
    <DashboardShell
      title="7-Day Campaign Generator"
      description={searchQuery.data ? `Counter-campaign for "${searchQuery.data.niche}"` : "Counter-campaign"}
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to={`/analysis/${searchId}`}>
              <ArrowLeft /> Back to analysis
            </Link>
          </Button>
          {days.length > 0 && (
            <Button variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              <RefreshCw className={generateMutation.isPending ? "animate-spin" : ""} /> Regenerate
            </Button>
          )}
        </>
      }
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>Auto-post via Make.com once approved</span>
          <Badge variant="mock">Week 3–4 stretch — not built</Badge>
        </div>

        {campaignQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : days.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No campaign yet. Generate 7 days of hooks, captions, and creative concepts drawn from the competitive
              analysis.
            </p>
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" /> Drafting campaign…
                </>
              ) : (
                <>
                  <Sparkles /> Generate 7-day campaign
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{approvedCount} / 7 days approved</p>
            <CampaignApprovalQueue
              days={days}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              onGenerateCreative={(day) => creativeMutation.mutate(day)}
              generatingDayId={generatingDayId}
              creativeErrors={creativeErrors}
            />
          </>
        )}
      </div>
    </DashboardShell>
  );
}
