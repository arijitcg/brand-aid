import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, ExternalLink } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getEnvStatus, isLive } from "@/lib/dataStore";

export default function Settings() {
  const envQuery = useQuery({ queryKey: ["env-status"], queryFn: getEnvStatus });
  const env = envQuery.data;

  const integrations = [
    {
      name: "Supabase (database + auth)",
      live: isLive,
      envVars: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
      note: "Powers auth, and every table in supabase/migrations/0001_init.sql.",
    },
    {
      name: "Claude API (SWOT / positioning / campaign generation / ad-screenshot reading)",
      live: Boolean(env?.anthropic),
      envVars: ["ANTHROPIC_API_KEY (Edge Function secret)"],
      note: "Set as a Supabase Edge Function secret, not a browser env var — keeps the key server-side.",
    },
    {
      name: "Competitor discovery (SerpAPI / Google Custom Search)",
      live: Boolean(env?.discovery),
      envVars: ["SERPAPI_KEY or GOOGLE_CSE_KEY + GOOGLE_CSE_CX (Edge Function secret)"],
      note: "Used by the discover-competitors function to find real competitors for a niche.",
    },
    {
      name: "Google Places API (reviews)",
      live: Boolean(env?.googlePlaces),
      envVars: ["GOOGLE_PLACES_API_KEY (Edge Function secret)"],
      note: "Used by fetch-competitor-data to pull real Google reviews per competitor.",
    },
    {
      name: "Gemini image generation (campaign creatives)",
      live: Boolean(env?.imageGen),
      envVars: ["GEMINI_API_KEY (Edge Function secret)"],
      note: "Used by generate-campaign-creative — the hook text is always overlaid separately, never baked into the AI image.",
    },
  ];

  return (
    <DashboardShell title="Settings" description="Integration status — see README.md for full setup steps.">
      <div className="mx-auto max-w-2xl space-y-4">
        {integrations.map((i) => (
          <Card key={i.name}>
            <CardContent className="flex items-start justify-between gap-4 pt-5">
              <div className="flex items-start gap-3">
                {i.live ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                ) : (
                  <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">{i.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{i.note}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">{i.envVars.join(", ")}</p>
                </div>
              </div>
              <Badge variant={i.live ? "success" : "mock"} className="shrink-0">
                {i.live ? "Live" : "Demo data"}
              </Badge>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Data integrity policy</CardTitle>
            <CardDescription>Carried over from the project's data-integrity note.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0 text-sm text-foreground/90">
            <p>• Only publicly available data is used — website content and public reviews.</p>
            <p>• Ad creative, copy, and run-times are shown as facts; spend and funnel strategy are AI-inferred estimates, always labeled.</p>
            <p>• Reviews are analyzed as paraphrased patterns, never reproduced verbatim at length.</p>
            <p>• Private metrics (exact budget, CPR, precise targeting) are never fabricated or presented as fact.</p>
            <p>• Market position and growth signal are estimated from review volume and recency — a heuristic, not a certified ranking.</p>
          </CardContent>
        </Card>

        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline"
        >
          Open Supabase dashboard <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </DashboardShell>
  );
}
