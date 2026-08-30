import type { GrowthSignal, MarketPosition, Review } from "./types";

/**
 * Both signals are derived only from data already on hand (review count,
 * rating, and review dates from Google) — no separate "brand strength" API,
 * no invented score. Thresholds are a heuristic, not a certified ranking,
 * which is why the UI always labels these as "estimated."
 */

export function computeMarketPosition(reviewCount: number): MarketPosition {
  if (reviewCount >= 500) return "market-leader";
  if (reviewCount >= 100) return "established";
  if (reviewCount >= 20) return "emerging";
  return "new-entrant";
}

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

export function computeGrowthSignal(reviews: Review[]): GrowthSignal {
  const dated = reviews.filter((r) => r.publishedAt);
  if (dated.length === 0) return "insufficient-data";

  const now = Date.now();
  const recentCount = dated.filter((r) => now - new Date(r.publishedAt as string).getTime() <= SIX_MONTHS_MS).length;

  return recentCount / dated.length >= 0.6 ? "fast-growing" : "steady";
}

export const MARKET_POSITION_LABELS: Record<MarketPosition, string> = {
  "market-leader": "Market leader",
  established: "Established",
  emerging: "Emerging",
  "new-entrant": "New entrant",
};

export const GROWTH_SIGNAL_LABELS: Record<GrowthSignal, string> = {
  "fast-growing": "Fast-growing",
  steady: "Steady",
  "insufficient-data": "Not enough review data",
};
