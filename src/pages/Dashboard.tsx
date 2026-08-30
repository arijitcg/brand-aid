import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  FileText,
  Megaphone,
  Search as SearchIcon,
  Sparkles,
  SquareCheck,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FunnelChart } from "@/components/dashboard/FunnelChart";
import { getFunnelStats, listReports, listSearches } from "@/lib/dataStore";

function KpiCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof SearchIcon }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const searchesQuery = useQuery({ queryKey: ["searches"], queryFn: listSearches });
  const reportsQuery = useQuery({ queryKey: ["reports"], queryFn: listReports });
  const funnelQuery = useQuery({ queryKey: ["funnel-stats"], queryFn: getFunnelStats });

  const searches = searchesQuery.data ?? [];
  const reports = reportsQuery.data ?? [];
  const funnel = funnelQuery.data;

  return (
    <DashboardShell
      title="Dashboard"
      description="Every competitor analysis you've run, in one place."
      actions={
        <Button asChild>
          <Link to="/new">
            <Sparkles /> New Analysis
          </Link>
        </Button>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Searches run" value={searches.length} icon={SearchIcon} />
        <KpiCard label="Reports generated" value={reports.length} icon={FileText} />
        <KpiCard
          label="Avg competitors / search"
          value={
            searches.length
              ? (searches.reduce((s, x) => s + x.selectedCompetitorIds.length, 0) / searches.length || 0).toFixed(1)
              : "0"
          }
          icon={TrendingUp}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Intelligence funnel</CardTitle>
            <CardDescription>From discovery to an approved counter-campaign, across every search.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {funnel && (
              <FunnelChart
                stages={[
                  { label: "Discovered", value: funnel.discovered, icon: SearchIcon },
                  { label: "Selected", value: funnel.selected, icon: SquareCheck },
                  { label: "Analyzed", value: funnel.analyzed, icon: Sparkles },
                  { label: "Ad angles read", value: funnel.adAnglesCaptured, icon: Megaphone },
                  { label: "Campaign days drafted", value: funnel.campaignDaysGenerated, icon: FileText },
                  { label: "Days approved", value: funnel.campaignDaysApproved, icon: ThumbsUp },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline health</CardTitle>
            <CardDescription>How much of what you discover turns into an approved plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-medium">
                  {funnel && funnel.discovered > 0
                    ? Math.round((funnel.selected / funnel.discovered) * 100)
                    : 0}
                  % selection rate
                </p>
                <p className="text-xs text-muted-foreground">of discovered competitors get selected for analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <ThumbsUp className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">
                  {funnel && funnel.campaignDaysGenerated > 0
                    ? Math.round((funnel.campaignDaysApproved / funnel.campaignDaysGenerated) * 100)
                    : 0}
                  % approval rate
                </p>
                <p className="text-xs text-muted-foreground">of drafted campaign days get approved as-is</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent analyses</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {searchesQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : searches.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No analyses yet. Start by telling Brand Aid your niche.
              </p>
              <Button asChild>
                <Link to="/new">
                  <Sparkles /> Run your first analysis
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Niche</TableHead>
                  <TableHead>Competitors selected</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {searches.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.niche}</TableCell>
                    <TableCell>{s.selectedCompetitorIds.length}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/analysis/${s.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
