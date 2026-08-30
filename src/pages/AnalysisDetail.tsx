import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Crown, Megaphone, MessageSquareWarning, Printer, Sparkles, Target, TrendingUp } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SwotCard } from "@/components/dashboard/SwotCard";
import { ComparisonChart, type ComparisonRow } from "@/components/dashboard/ComparisonChart";
import { DataSourceBadge } from "@/components/dashboard/DataSourceBadge";
import {
  analyzeCompetitor,
  getAdExamples,
  getAnalysis,
  getCompetitorData,
  getCompetitors,
  getSearch,
  saveReport,
} from "@/lib/dataStore";
import {
  computeGrowthSignal,
  computeMarketPosition,
  GROWTH_SIGNAL_LABELS,
  MARKET_POSITION_LABELS,
} from "@/lib/marketSignals";

export default function AnalysisDetail() {
  const { searchId } = useParams<{ searchId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const searchQuery = useQuery({
    queryKey: ["search", searchId],
    queryFn: () => getSearch(searchId as string),
    enabled: Boolean(searchId),
  });

  const competitorsQuery = useQuery({
    queryKey: ["competitors", searchId],
    queryFn: () => getCompetitors(searchId as string),
    enabled: Boolean(searchId),
  });

  const selected = React.useMemo(() => {
    if (!competitorsQuery.data || !searchQuery.data) return [];
    return competitorsQuery.data.filter((c) => searchQuery.data!.selectedCompetitorIds.includes(c.id));
  }, [competitorsQuery.data, searchQuery.data]);

  const detailQueries = useQueries({
    queries: selected.map((c) => ({
      queryKey: ["competitor-detail", c.id],
      queryFn: async () => {
        const [data, analysis, ads] = await Promise.all([
          getCompetitorData(c.id).then((d) => d ?? undefined),
          getAnalysis(c.id).then((a) => a ?? (searchQuery.data ? analyzeCompetitor(c, searchQuery.data.niche) : undefined)),
          getAdExamples(c.id),
        ]);
        return { competitor: c, data, analysis, ads };
      },
      enabled: Boolean(searchQuery.data),
    })),
  });

  const loading = searchQuery.isLoading || competitorsQuery.isLoading || detailQueries.some((q) => q.isLoading);
  const results = detailQueries.map((q) => q.data).filter((d): d is NonNullable<typeof d> => Boolean(d));

  const comparisonRows: ComparisonRow[] = results.map((r) => ({
    name: r.competitor.name,
    avgRating: r.data?.avgRating ?? 0,
    strengths: r.analysis?.swot.strengths.length ?? 0,
    weaknesses: r.analysis?.swot.weaknesses.length ?? 0,
  }));

  async function handleExport() {
    if (!searchQuery.data) return;
    await saveReport(searchQuery.data.id, `${searchQuery.data.niche} — competitor analysis`);
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    window.print();
  }

  if (!searchId) return null;

  return (
    <DashboardShell
      title={searchQuery.data ? `Analysis · ${searchQuery.data.niche}` : "Analysis"}
      description="Evidence-backed SWOT, positioning, and how to outposition each competitor."
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/dashboard">
              <ArrowLeft /> Back
            </Link>
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={loading}>
            <Printer /> Export PDF
          </Button>
          <Button onClick={() => navigate(`/analysis/${searchId}/campaign`)} disabled={loading}>
            <Megaphone /> 7-Day Campaign
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Loading analysis…
        </div>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No competitors selected for this search.</p>
      ) : (
        <div className="space-y-6">
          <div className="hidden print:block">
            <h1 className="text-xl font-semibold">Brand Aid — {searchQuery.data?.niche}</h1>
            <p className="text-sm text-muted-foreground">
              Competitor analysis generated {new Date().toLocaleDateString()}
            </p>
          </div>

          {comparisonRows.length > 1 && <ComparisonChart rows={comparisonRows} />}

          {results.map((r) => (
            <div key={r.competitor.id} className="space-y-4 break-inside-avoid-page">
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5 first:border-t-0 first:pt-0">
                <h2 className="text-lg font-semibold">{r.competitor.name}</h2>
                <Badge variant="outline">{r.competitor.websiteUrl}</Badge>
                {r.data && <Badge variant="secondary">{r.data.avgRating}★ ({r.data.reviewCount} reviews)</Badge>}
                {r.data &&
                  (() => {
                    const position = computeMarketPosition(r.data.reviewCount);
                    return (
                      <Badge variant={position === "market-leader" || position === "established" ? "success" : "outline"}>
                        {position === "market-leader" && <Crown className="h-3 w-3" />}
                        {MARKET_POSITION_LABELS[position]}
                      </Badge>
                    );
                  })()}
                {r.data &&
                  (() => {
                    const growth = computeGrowthSignal(r.data.reviews);
                    if (growth === "insufficient-data") return null;
                    return (
                      <Badge variant={growth === "fast-growing" ? "success" : "outline"}>
                        {growth === "fast-growing" && <TrendingUp className="h-3 w-3" />}
                        {GROWTH_SIGNAL_LABELS[growth]}
                      </Badge>
                    );
                  })()}
                {r.analysis && <DataSourceBadge source={r.analysis.source} />}
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                Estimated from review volume and recency — a heuristic, not a certified ranking.
              </p>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-4 w-4" /> Positioning
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <p className="text-sm text-foreground/90">{r.analysis?.positioning}</p>
                  <p className="text-xs text-muted-foreground">{r.analysis?.pricingNotes}</p>
                </CardContent>
              </Card>

              {r.analysis && <SwotCard swot={r.analysis.swot} title="SWOT" />}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquareWarning className="h-4 w-4" /> Review mining — recurring complaint patterns
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-1.5 text-sm text-foreground/90">
                    {r.analysis?.complaintPatterns.map((p, i) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-4 w-4" /> How to outposition them
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-1.5 text-sm">
                    {r.analysis?.outpositionTips.map((tip, i) => (
                      <li key={i}>• {tip}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {r.ads.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4" /> Ad teardown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {r.ads.map((ad) => (
                      <div key={ad.id} className="rounded-lg border border-border p-3">
                        <p className="text-sm italic text-muted-foreground">"{ad.pastedText}"</p>
                        <Badge variant="secondary" className="mt-2">
                          {ad.messagingAngle}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
