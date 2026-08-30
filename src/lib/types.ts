export type DataSource = "live" | "mock";

export interface Search {
  id: string;
  niche: string;
  createdAt: string;
  competitorIds: string[];
  selectedCompetitorIds: string[];
}

export type CompetitorTier = "local" | "national";

export interface Competitor {
  id: string;
  searchId: string;
  name: string;
  websiteUrl: string;
  tier: CompetitorTier;
}

export interface Review {
  author: string;
  rating: number;
  text: string;
  /** ISO date string, when the source API provides one (e.g. Google Places). */
  publishedAt?: string;
}

export type MarketPosition = "market-leader" | "established" | "emerging" | "new-entrant";
export type GrowthSignal = "fast-growing" | "steady" | "insufficient-data";

export interface CompetitorData {
  competitorId: string;
  websiteSummary: string;
  reviews: Review[];
  avgRating: number;
  reviewCount: number;
  source: DataSource;
}

export interface Swot {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface Analysis {
  competitorId: string;
  swot: Swot;
  positioning: string;
  pricingNotes: string;
  complaintPatterns: string[];
  outpositionTips: string[];
  source: DataSource;
}

export interface AdExample {
  id: string;
  competitorId: string;
  pastedText: string;
  messagingAngle: string;
  createdAt: string;
  source: DataSource;
}

export type CampaignStatus = "draft" | "approved" | "rejected";

export interface CampaignDay {
  id: string;
  searchId: string;
  day: number;
  hook: string;
  caption: string;
  creativeConcept: string;
  status: CampaignStatus;
  source: DataSource;
}

export interface Report {
  id: string;
  searchId: string;
  title: string;
  createdAt: string;
}
