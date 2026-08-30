import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FunnelStage {
  label: string;
  value: number;
  icon: LucideIcon;
}

export function FunnelChart({ stages, dense = false }: { stages: FunnelStage[]; dense?: boolean }) {
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const pct = Math.max(4, Math.round((stage.value / max) * 100));
        const Icon = stage.icon;
        return (
          <div key={stage.label} className="flex items-center gap-3">
            <div
              className={cn(
                "flex shrink-0 items-center gap-2 text-sm text-muted-foreground",
                dense ? "w-36" : "w-44"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{stage.label}</span>
            </div>
            <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-muted">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-primary to-ring"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: `${pct}%`, opacity: 1 }}
                transition={{ duration: 0.8, delay: i * 0.12, ease: "easeOut" }}
              />
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: i * 0.12 + 0.5 }}
                className="absolute inset-y-0 right-2 flex items-center text-xs font-semibold text-foreground"
              >
                {stage.value}
              </motion.span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
