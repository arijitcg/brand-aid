import { supabase, isSupabaseConfigured } from "./supabaseClient";
import {
  generateMockAdAngle,
  generateMockAdScreenshot,
  generateMockAnalysis,
  generateMockCampaign,
  generateMockCompetitorData,
  generateMockCompetitors,
} from "./mockData";
import type {
  AdExample,
  Analysis,
  CampaignDay,
  CampaignStatus,
  Competitor,
  CompetitorData,
  Report,
  Search,
} from "./types";

/**
 * Every function here has two branches: a Supabase branch (used once the user
 * wires up VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY + deploys the edge
 * functions in supabase/functions) and a localStorage-backed mock branch used
 * out of the box so the whole dashboard is clickable with zero setup.
 */
export const isLive = isSupabaseConfigured;

const DB_KEY = "designscope.mockdb.v1";

interface LocalDB {
  searches: Search[];
  competitors: Competitor[];
  competitorData: Record<string, CompetitorData>;
  analyses: Record<string, Analysis>;
  adExamples: AdExample[];
  campaigns: CampaignDay[];
  reports: Report[];
}

function emptyDb(): LocalDB {
  return {
    searches: [],
    competitors: [],
    competitorData: {},
    analyses: {},
    adExamples: [],
    campaigns: [],
    reports: [],
  };
}

function readDb(): LocalDB {
  if (typeof localStorage === "undefined") return emptyDb();
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return emptyDb();
  try {
    return { ...emptyDb(), ...JSON.parse(raw) } as LocalDB;
  } catch {
    return emptyDb();
  }
}

function writeDb(db: LocalDB) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

const id = () => crypto.randomUUID();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Searches
// ---------------------------------------------------------------------------

export async function createSearch(niche: string): Promise<Search> {
  if (isLive && supabase) {
    const { data, error } = await supabase
      .from("searches")
      .insert({ niche })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      niche: data.niche,
      createdAt: data.created_at,
      competitorIds: [],
      selectedCompetitorIds: [],
    };
  }

  await wait(200);
  const db = readDb();
  const search: Search = {
    id: id(),
    niche,
    createdAt: new Date().toISOString(),
    competitorIds: [],
    selectedCompetitorIds: [],
  };
  db.searches.unshift(search);
  writeDb(db);
  return search;
}

export async function listSearches(): Promise<Search[]> {
  if (isLive && supabase) {
    const { data, error } = await supabase
      .from("searches")
      .select()
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map((row) => ({
      id: row.id,
      niche: row.niche,
      createdAt: row.created_at,
      competitorIds: [],
      selectedCompetitorIds: row.selected_competitor_ids ?? [],
    }));
  }

  await wait(150);
  return readDb().searches;
}

export async function getSearch(searchId: string): Promise<Search | undefined> {
  if (isLive && supabase) {
    const { data, error } = await supabase.from("searches").select().eq("id", searchId).single();
    if (error) return undefined;
    return {
      id: data.id,
      niche: data.niche,
      createdAt: data.created_at,
      competitorIds: [],
      selectedCompetitorIds: data.selected_competitor_ids ?? [],
    };
  }

  await wait(100);
  return readDb().searches.find((s) => s.id === searchId);
}

// ---------------------------------------------------------------------------
// Competitor discovery + selection
// ---------------------------------------------------------------------------

export async function discoverCompetitors(searchId: string, niche: string): Promise<Competitor[]> {
  if (isLive && supabase) {
    const { data, error } = await supabase.functions.invoke("discover-competitors", {
      body: { niche },
    });
    if (error) throw error;
    const rows = (data?.competitors ?? []) as { name: string; websiteUrl: string; tier: string }[];
    const { data: inserted, error: insertError } = await supabase
      .from("competitors")
      .insert(rows.map((c) => ({ search_id: searchId, name: c.name, website_url: c.websiteUrl, tier: c.tier })))
      .select();
    if (insertError) throw insertError;
    return inserted.map((row) => ({
      id: row.id,
      searchId: row.search_id,
      name: row.name,
      websiteUrl: row.website_url,
      tier: row.tier,
    }));
  }

  await wait(900);
  const db = readDb();
  const candidates = generateMockCompetitors(niche).map((c) => ({
    id: id(),
    searchId,
    name: c.name,
    websiteUrl: c.websiteUrl,
    tier: c.tier,
  }));
  db.competitors.push(...candidates);
  const search = db.searches.find((s) => s.id === searchId);
  if (search) search.competitorIds = candidates.map((c) => c.id);
  writeDb(db);
  return candidates;
}

export async function getCompetitors(searchId: string): Promise<Competitor[]> {
  if (isLive && supabase) {
    const { data, error } = await supabase.from("competitors").select().eq("search_id", searchId);
    if (error) throw error;
    return data.map((row) => ({
      id: row.id,
      searchId: row.search_id,
      name: row.name,
      websiteUrl: row.website_url,
      tier: row.tier,
    }));
  }

  await wait(80);
  return readDb().competitors.filter((c) => c.searchId === searchId);
}

export async function setSelectedCompetitors(searchId: string, competitorIds: string[]): Promise<void> {
  if (isLive && supabase) {
    const { error } = await supabase
      .from("searches")
      .update({ selected_competitor_ids: competitorIds })
      .eq("id", searchId);
    if (error) throw error;
    return;
  }

  await wait(100);
  const db = readDb();
  const search = db.searches.find((s) => s.id === searchId);
  if (search) search.selectedCompetitorIds = competitorIds;
  writeDb(db);
}

// ---------------------------------------------------------------------------
// Competitor data (website + reviews) and AI analysis
// ---------------------------------------------------------------------------

export async function fetchCompetitorData(competitor: Competitor, niche: string): Promise<CompetitorData> {
  if (isLive && supabase) {
    const { data, error } = await supabase.functions.invoke("fetch-competitor-data", {
      body: { competitorId: competitor.id, name: competitor.name, websiteUrl: competitor.websiteUrl },
    });
    if (error) throw error;
    return data as CompetitorData;
  }

  await wait(1100);
  const db = readDb();
  const result = generateMockCompetitorData(competitor.id, competitor.name, niche);
  db.competitorData[competitor.id] = result;
  writeDb(db);
  return result;
}

export async function getCompetitorData(competitorId: string): Promise<CompetitorData | undefined> {
  if (isLive && supabase) {
    const { data, error } = await supabase
      .from("competitor_data")
      .select()
      .eq("competitor_id", competitorId)
      .single();
    if (error) return undefined;
    return {
      competitorId: data.competitor_id,
      websiteSummary: data.website_summary,
      reviews: data.reviews,
      avgRating: data.avg_rating,
      reviewCount: data.review_count,
      source: data.source,
    };
  }

  await wait(60);
  return readDb().competitorData[competitorId];
}

export async function analyzeCompetitor(competitor: Competitor, niche: string): Promise<Analysis> {
  const data = (await getCompetitorData(competitor.id)) ?? (await fetchCompetitorData(competitor, niche));

  if (isLive && supabase) {
    const { data: result, error } = await supabase.functions.invoke("analyze-competitor", {
      body: { competitorId: competitor.id, niche, competitorData: data },
    });
    if (error) throw error;
    return result as Analysis;
  }

  await wait(1400);
  const db = readDb();
  const analysis = generateMockAnalysis(competitor.id, competitor.name, niche, data);
  db.analyses[competitor.id] = analysis;
  writeDb(db);
  return analysis;
}

export async function getAnalysis(competitorId: string): Promise<Analysis | undefined> {
  if (isLive && supabase) {
    const { data, error } = await supabase.from("analyses").select().eq("competitor_id", competitorId).single();
    if (error) return undefined;
    return {
      competitorId: data.competitor_id,
      swot: data.swot,
      positioning: data.positioning,
      pricingNotes: data.pricing_notes,
      complaintPatterns: data.complaint_patterns,
      outpositionTips: data.outposition_tips,
      source: data.source,
    };
  }

  await wait(60);
  return readDb().analyses[competitorId];
}

// ---------------------------------------------------------------------------
// Ad Library teardown (manual paste, per Meta ToS restriction)
// ---------------------------------------------------------------------------

export async function addAdExample(competitorId: string, pastedText: string): Promise<AdExample> {
  if (isLive && supabase) {
    const { data: angleResult, error: angleError } = await supabase.functions.invoke("analyze-ads", {
      body: { pastedText },
    });
    if (angleError) throw angleError;
    const { data, error } = await supabase
      .from("ad_examples")
      .insert({ competitor_id: competitorId, pasted_text: pastedText, messaging_angle: angleResult?.messagingAngle })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      competitorId: data.competitor_id,
      pastedText: data.pasted_text,
      messagingAngle: data.messaging_angle,
      createdAt: data.created_at,
      source: "live",
    };
  }

  await wait(700);
  const db = readDb();
  const entry: AdExample = {
    id: id(),
    competitorId,
    pastedText,
    messagingAngle: generateMockAdAngle(pastedText),
    createdAt: new Date().toISOString(),
    source: "mock",
  };
  db.adExamples.push(entry);
  writeDb(db);
  return entry;
}

/**
 * The compliant alternative to automating the Meta Ad Library: the user
 * screenshots an ad themselves (ordinary human browsing, no automated access
 * involved) and Claude vision reads the text off the image.
 */
export async function addAdExampleFromImage(
  competitorId: string,
  imageBase64: string,
  mediaType: string
): Promise<AdExample> {
  if (isLive && supabase) {
    const { data: extracted, error: extractError } = await supabase.functions.invoke("analyze-ad-image", {
      body: { imageBase64, mediaType },
    });
    if (extractError) throw extractError;
    const { data, error } = await supabase
      .from("ad_examples")
      .insert({
        competitor_id: competitorId,
        pasted_text: extracted?.extractedText,
        messaging_angle: extracted?.messagingAngle,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      competitorId: data.competitor_id,
      pastedText: data.pasted_text,
      messagingAngle: data.messaging_angle,
      createdAt: data.created_at,
      source: "live",
    };
  }

  await wait(900);
  const db = readDb();
  const mock = generateMockAdScreenshot(competitorId + imageBase64.length);
  const entry: AdExample = {
    id: id(),
    competitorId,
    pastedText: mock.extractedText,
    messagingAngle: mock.messagingAngle,
    createdAt: new Date().toISOString(),
    source: "mock",
  };
  db.adExamples.push(entry);
  writeDb(db);
  return entry;
}

export async function getAdExamples(competitorId: string): Promise<AdExample[]> {
  if (isLive && supabase) {
    const { data, error } = await supabase.from("ad_examples").select().eq("competitor_id", competitorId);
    if (error) throw error;
    return data.map((row) => ({
      id: row.id,
      competitorId: row.competitor_id,
      pastedText: row.pasted_text,
      messagingAngle: row.messaging_angle,
      createdAt: row.created_at,
      source: "live",
    }));
  }

  await wait(60);
  return readDb().adExamples.filter((a) => a.competitorId === competitorId);
}

// ---------------------------------------------------------------------------
// 7-day campaign generator + approval queue
// ---------------------------------------------------------------------------

export async function generateCampaign(searchId: string): Promise<CampaignDay[]> {
  if (isLive && supabase) {
    const { data, error } = await supabase.functions.invoke("generate-campaign", {
      body: { searchId },
    });
    if (error) throw error;
    const rows = (data?.days ?? []) as { day: number; hook: string; caption: string; creativeConcept: string }[];
    const { data: inserted, error: insertError } = await supabase
      .from("campaigns")
      .insert(
        rows.map((d) => ({
          search_id: searchId,
          day: d.day,
          hook: d.hook,
          caption: d.caption,
          creative_concept: d.creativeConcept,
          status: "draft",
        }))
      )
      .select();
    if (insertError) throw insertError;
    return (inserted as Record<string, unknown>[])
      .map((row) => ({
        id: row.id as string,
        searchId: row.search_id as string,
        day: row.day as number,
        hook: row.hook as string,
        caption: row.caption as string,
        creativeConcept: row.creative_concept as string,
        status: row.status as CampaignStatus,
        source: "live" as const,
      }))
      .sort((a, b) => a.day - b.day);
  }

  await wait(1600);
  const db = readDb();
  db.campaigns = db.campaigns.filter((c) => c.searchId !== searchId);
  const days = generateMockCampaign(searchId).map((d) => ({ ...d, id: id(), status: "draft" as CampaignStatus }));
  db.campaigns.push(...days);
  writeDb(db);
  return days;
}

export async function getCampaign(searchId: string): Promise<CampaignDay[]> {
  if (isLive && supabase) {
    const { data, error } = await supabase
      .from("campaigns")
      .select()
      .eq("search_id", searchId)
      .order("day", { ascending: true });
    if (error) throw error;
    return data.map((row) => ({
      id: row.id,
      searchId: row.search_id,
      day: row.day,
      hook: row.hook,
      caption: row.caption,
      creativeConcept: row.creative_concept,
      status: row.status,
      source: "live" as const,
    }));
  }

  await wait(60);
  return readDb()
    .campaigns.filter((c) => c.searchId === searchId)
    .sort((a, b) => a.day - b.day);
}

export async function updateCampaignStatus(campaignDayId: string, status: CampaignStatus): Promise<void> {
  if (isLive && supabase) {
    const { error } = await supabase.from("campaigns").update({ status }).eq("id", campaignDayId);
    if (error) throw error;
    return;
  }

  await wait(80);
  const db = readDb();
  const day = db.campaigns.find((c) => c.id === campaignDayId);
  if (day) day.status = status;
  writeDb(db);
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function saveReport(searchId: string, title: string): Promise<Report> {
  if (isLive && supabase) {
    const { data, error } = await supabase
      .from("reports")
      .insert({ search_id: searchId, title })
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, searchId: data.search_id, title: data.title, createdAt: data.created_at };
  }

  await wait(200);
  const db = readDb();
  const report: Report = { id: id(), searchId, title, createdAt: new Date().toISOString() };
  db.reports.unshift(report);
  writeDb(db);
  return report;
}

export async function listReports(): Promise<Report[]> {
  if (isLive && supabase) {
    const { data, error } = await supabase.from("reports").select().order("created_at", { ascending: false });
    if (error) throw error;
    return data.map((row) => ({ id: row.id, searchId: row.search_id, title: row.title, createdAt: row.created_at }));
  }

  await wait(80);
  return readDb().reports;
}

// ---------------------------------------------------------------------------
// Funnel stats — aggregate pipeline counts for the funnel/stage dashboard
// ---------------------------------------------------------------------------

export interface FunnelStats {
  discovered: number;
  selected: number;
  analyzed: number;
  adAnglesCaptured: number;
  campaignDaysGenerated: number;
  campaignDaysApproved: number;
}

export async function getFunnelStats(): Promise<FunnelStats> {
  if (isLive && supabase) {
    const [competitors, analyses, ads, campaigns, approved, searches] = await Promise.all([
      supabase.from("competitors").select("id", { count: "exact", head: true }),
      supabase.from("analyses").select("competitor_id", { count: "exact", head: true }),
      supabase.from("ad_examples").select("id", { count: "exact", head: true }),
      supabase.from("campaigns").select("id", { count: "exact", head: true }),
      supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("searches").select("selected_competitor_ids"),
    ]);
    const selected = (searches.data ?? []).reduce(
      (sum: number, s: { selected_competitor_ids: string[] | null }) => sum + (s.selected_competitor_ids?.length ?? 0),
      0
    );
    return {
      discovered: competitors.count ?? 0,
      selected,
      analyzed: analyses.count ?? 0,
      adAnglesCaptured: ads.count ?? 0,
      campaignDaysGenerated: campaigns.count ?? 0,
      campaignDaysApproved: approved.count ?? 0,
    };
  }

  await wait(60);
  const db = readDb();
  return {
    discovered: db.competitors.length,
    selected: db.searches.reduce((sum, s) => sum + s.selectedCompetitorIds.length, 0),
    analyzed: Object.keys(db.analyses).length,
    adAnglesCaptured: db.adExamples.length,
    campaignDaysGenerated: db.campaigns.length,
    campaignDaysApproved: db.campaigns.filter((c) => c.status === "approved").length,
  };
}

// ---------------------------------------------------------------------------
// Edge Function secret status — for the Settings page's Live/Demo badges
// ---------------------------------------------------------------------------

export interface EnvStatus {
  anthropic: boolean;
  discovery: boolean;
  googlePlaces: boolean;
}

export async function getEnvStatus(): Promise<EnvStatus> {
  if (isLive && supabase) {
    const { data, error } = await supabase.functions.invoke("env-status");
    if (error) return { anthropic: false, discovery: false, googlePlaces: false };
    return data as EnvStatus;
  }

  return { anthropic: false, discovery: false, googlePlaces: false };
}
