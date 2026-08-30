import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Swot } from "@/lib/types";

const QUADRANTS: { key: keyof Swot; label: string; className: string }[] = [
  { key: "strengths", label: "Strengths", className: "bg-success/10 text-success" },
  { key: "weaknesses", label: "Weaknesses", className: "bg-destructive/10 text-destructive" },
  { key: "opportunities", label: "Opportunities", className: "bg-primary/10 text-primary" },
  { key: "threats", label: "Threats", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
];

export function SwotCard({ swot, title }: { swot: Swot; title?: string }) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", !title && "pt-5")}>
        {QUADRANTS.map((q) => (
          <div key={q.key} className="rounded-lg border border-border p-3">
            <span className={cn("mb-2 inline-block rounded px-2 py-0.5 text-xs font-semibold", q.className)}>
              {q.label}
            </span>
            <ul className="space-y-1.5 text-sm text-foreground/90">
              {swot[q.key].map((item, i) => (
                <li key={i} className="leading-snug">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
