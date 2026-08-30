import { Badge } from "@/components/ui/badge";
import type { DataSource } from "@/lib/types";

export function DataSourceBadge({ source }: { source: DataSource }) {
  if (source === "live") {
    return <Badge variant="success">Live data</Badge>;
  }
  return <Badge variant="mock">Demo data</Badge>;
}
