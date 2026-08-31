import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2, Sparkles, Upload } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CompetitorCard } from "@/components/dashboard/CompetitorCard";
import {
  addAdExample,
  addAdExampleFromImage,
  analyzeCompetitor,
  createSearch,
  discoverCompetitors,
  fetchCompetitorData,
  setSelectedCompetitors,
} from "@/lib/dataStore";
import type { Competitor } from "@/lib/types";

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve({ base64, mediaType: file.type || "image/png" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type Step = "niche" | "select" | "analyzing" | "ads";

const EXAMPLE_NICHES = ["Interior design, Kolkata", "Modular kitchens, Pune", "Home renovation, Bengaluru"];

export default function NewAnalysis() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<Step>("niche");
  const [niche, setNiche] = React.useState("");
  const [searchId, setSearchId] = React.useState<string | null>(null);
  const [candidates, setCandidates] = React.useState<Competitor[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [analyzeProgress, setAnalyzeProgress] = React.useState<Record<string, "pending" | "done">>({});
  const [adDrafts, setAdDrafts] = React.useState<Record<string, string>>({});
  const [adResults, setAdResults] = React.useState<Record<string, { text: string; angle: string }>>({});

  const discoverMutation = useMutation({
    mutationFn: async (nicheValue: string) => {
      const search = await createSearch(nicheValue);
      const found = await discoverCompetitors(search.id, nicheValue);
      return { search, found };
    },
    onSuccess: ({ search, found }) => {
      setSearchId(search.id);
      setCandidates(found);
      setStep("select");
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!searchId) return;
      await setSelectedCompetitors(searchId, selectedIds);
      const selected = candidates.filter((c) => selectedIds.includes(c.id));
      // Each competitor's own fetch-then-analyze chain is sequential (analysis
      // needs the fetched data), but the chains for different competitors are
      // independent — running them in parallel cuts wall-clock time roughly
      // by the number of competitors instead of multiplying it.
      setAnalyzeProgress(Object.fromEntries(selected.map((c) => [c.id, "pending"])));
      await Promise.all(
        selected.map(async (c) => {
          await fetchCompetitorData(c, niche);
          await analyzeCompetitor(c, niche);
          setAnalyzeProgress((p) => ({ ...p, [c.id]: "done" }));
        })
      );
    },
    onSuccess: () => setStep("ads"),
  });

  const adMutation = useMutation({
    mutationFn: async (competitorId: string) => {
      const text = adDrafts[competitorId];
      if (!text?.trim()) return null;
      return addAdExample(competitorId, text.trim());
    },
    onSuccess: (result, competitorId) => {
      if (result) setAdResults((r) => ({ ...r, [competitorId]: { text: result.pastedText, angle: result.messagingAngle } }));
    },
  });

  const adImageMutation = useMutation({
    mutationFn: async ({ competitorId, file }: { competitorId: string; file: File }) => {
      const { base64, mediaType } = await fileToBase64(file);
      return addAdExampleFromImage(competitorId, base64, mediaType);
    },
    onSuccess: (result, { competitorId }) => {
      setAdResults((r) => ({ ...r, [competitorId]: { text: result.pastedText, angle: result.messagingAngle } }));
    },
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  const selectedCompetitors = candidates.filter((c) => selectedIds.includes(c.id));

  return (
    <DashboardShell title="New Analysis" description="Type a niche and let Brand Aid do the research.">
      <div className="mx-auto max-w-3xl space-y-6">
        {step === "niche" && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1 · Your niche</CardTitle>
              <CardDescription>
                e.g. "interior design, Kolkata" — include a city so results mix local businesses with national
                players that actually operate there, not just category leaders anywhere.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="niche">Niche / industry</Label>
                <Input
                  id="niche"
                  placeholder="interior design, Kolkata"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && niche.trim()) discoverMutation.mutate(niche.trim());
                  }}
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {EXAMPLE_NICHES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                      onClick={() => setNiche(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => niche.trim() && discoverMutation.mutate(niche.trim())}
                disabled={!niche.trim() || discoverMutation.isPending}
              >
                {discoverMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin" /> Finding competitors…
                  </>
                ) : (
                  <>
                    <Sparkles /> Find competitors
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "select" && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2 · Choose 2–3 competitors</CardTitle>
              <CardDescription>Brand Aid found these for "{niche}". Pick who to analyze.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {candidates.map((c) => (
                  <CompetitorCard
                    key={c.id}
                    competitor={c}
                    selected={selectedIds.includes(c.id)}
                    onToggle={() => toggleSelect(c.id)}
                    disabled={!selectedIds.includes(c.id) && selectedIds.length >= 3}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{selectedIds.length} / 3 selected</p>
                <Button
                  onClick={() => {
                    setStep("analyzing");
                    analyzeMutation.mutate();
                  }}
                  disabled={selectedIds.length < 2}
                >
                  Fetch &amp; analyze <ArrowRight />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "analyzing" && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3 · Fetching site + reviews, running analysis</CardTitle>
              <CardDescription>Pulling website content, Google reviews, and generating SWOT per competitor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedCompetitors.map((c) => {
                const status = analyzeProgress[c.id];
                return (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <span className="text-sm font-medium">{c.name}</span>
                    {status === "done" ? (
                      <Badge variant="success">Analyzed</Badge>
                    ) : status === "pending" ? (
                      <Badge variant="outline">
                        <Loader2 className="h-3 w-3 animate-spin" /> Working…
                      </Badge>
                    ) : (
                      <Badge variant="outline">Queued</Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {step === "ads" && (
          <Card>
            <CardHeader>
              <CardTitle>Step 4 · Ad Strategy Teardown (optional)</CardTitle>
              <CardDescription>
                Meta's ToS blocks automated access to the Ad Library, so there's no way around browsing it yourself —
                but you don't have to retype anything. Screenshot an ad and let AI read it, or paste the text directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedCompetitors.map((c) => {
                const isBusy = adImageMutation.isPending && adImageMutation.variables?.competitorId === c.id;
                return (
                  <div key={c.id} className="space-y-3 rounded-lg border border-border p-4">
                    <p className="text-sm font-semibold">{c.name}</p>

                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-sm text-muted-foreground hover:bg-muted/50">
                      {isBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Reading screenshot…
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" /> Upload a screenshot of their ad
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) adImageMutation.mutate({ competitorId: c.id, file });
                          e.target.value = "";
                        }}
                      />
                    </label>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-px flex-1 bg-border" /> or paste text <div className="h-px flex-1 bg-border" />
                    </div>

                    <Textarea
                      placeholder="Paste an ad headline / body copy from the Meta Ad Library…"
                      value={adDrafts[c.id] ?? ""}
                      onChange={(e) => setAdDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!adDrafts[c.id]?.trim() || adMutation.isPending}
                      onClick={() => adMutation.mutate(c.id)}
                    >
                      Analyze messaging angle
                    </Button>

                    {adResults[c.id] && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs italic text-muted-foreground">"{adResults[c.id].text}"</p>
                        <Badge variant="secondary" className="mt-2">
                          {adResults[c.id].angle}
                        </Badge>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex justify-end">
                <Button onClick={() => searchId && navigate(`/analysis/${searchId}`)}>
                  View analysis <ArrowRight />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
