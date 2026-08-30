// Discovers top competitors for a niche via SerpAPI or Google Custom Search.
// Runs two location-scoped searches — one biased toward local businesses,
// one toward established/national chains — so results mix both, and even
// national players are required to show up for a location-scoped query
// (i.e. they need an actual presence there, not just category leadership).
//
// Raw web search results are noisy: forum threads, social posts, and
// directory/listicle pages show up alongside real competitor sites. Those
// are filtered out below rather than presented as if they were businesses.
//
// Secrets: SERPAPI_KEY  -or-  GOOGLE_CSE_KEY + GOOGLE_CSE_CX
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

type Tier = "local" | "national";

interface Candidate {
  name: string;
  websiteUrl: string;
  tier: Tier;
}

interface RawResult {
  title: string;
  websiteUrl: string;
}

function parseNiche(niche: string): { category: string; location: string } {
  const parts = niche.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { category: parts[0], location: parts.slice(1).join(", ") };
  return { category: parts[0] || "business", location: "" };
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Social platforms, forums, Q&A sites, and business directories/marketplaces
// aggregate many businesses under one domain — that domain is never itself
// a single competitor, so results from it are dropped rather than mis-shown
// as one.
const BLOCKED_DOMAINS = [
  "reddit.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "quora.com",
  "pinterest.com",
  "wikipedia.org",
  "linkedin.com",
  "medium.com",
  "houzz.in",
  "houzz.com",
  "re-thinkingthefuture.com",
  "sulekha.com",
  "justdial.com",
  "urbancompany.com",
  "urbanclap.com",
  "yellowpages.com",
  "indiamart.com",
  "tripadvisor.com",
  "yelp.com",
];

function isBlockedDomain(url: string): boolean {
  const host = hostnameOf(url);
  return BLOCKED_DOMAINS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

// Search-result titles are often listicle/guide phrasing ("100+ Best
// Interior Designers in Kolkata for Home") rather than an actual business
// name — in that case, the domain name reads as a more honest label than
// the page title.
function looksLikeListicleTitle(title: string): boolean {
  return /^(\d+\+?\s|top\s|best\s)/i.test(title.trim()) || title.length > 55 || /\?$/.test(title.trim());
}

function nameFromHost(host: string): string {
  const brand = host.split(".")[0];
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function cleanName(title: string, websiteUrl: string): string {
  if (looksLikeListicleTitle(title)) return nameFromHost(hostnameOf(websiteUrl));
  return title.split(/[|\-–:]/)[0].trim();
}

async function searchWithSerpApi(query: string, apiKey: string): Promise<RawResult[]> {
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=10&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
  const data = await res.json();
  const results = (data.organic_results ?? []) as { title: string; link: string }[];
  return results.map((r) => ({ title: r.title, websiteUrl: r.link }));
}

async function searchWithGoogleCse(query: string, key: string, cx: string): Promise<RawResult[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google CSE error: ${res.status}`);
  const data = await res.json();
  const items = (data.items ?? []) as { title: string; link: string }[];
  return items.map((r) => ({ title: r.title, websiteUrl: r.link }));
}

async function runSearch(query: string): Promise<RawResult[]> {
  const serpApiKey = Deno.env.get("SERPAPI_KEY");
  const cseKey = Deno.env.get("GOOGLE_CSE_KEY");
  const cseCx = Deno.env.get("GOOGLE_CSE_CX");

  if (serpApiKey) return searchWithSerpApi(query, serpApiKey);
  if (cseKey && cseCx) return searchWithGoogleCse(query, cseKey, cseCx);
  throw new Error(
    "No discovery API configured. Set SERPAPI_KEY or GOOGLE_CSE_KEY + GOOGLE_CSE_CX as Edge Function secrets."
  );
}

const MAX_PER_TIER = 6;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { niche } = await req.json();
    if (!niche || typeof niche !== "string") return jsonResponse({ error: "niche is required" }, 400);

    const { category, location } = parseNiche(niche);
    const localQuery = location ? `${category} in ${location}` : `${category} near me`;
    const nationalQuery = location ? `top ${category} companies in ${location}` : `top ${category} companies`;

    let localResults: RawResult[];
    let nationalResults: RawResult[];
    try {
      [localResults, nationalResults] = await Promise.all([runSearch(localQuery), runSearch(nationalQuery)]);
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 501);
    }

    const seen = new Set<string>();
    const competitors: Candidate[] = [];
    for (const [results, tier] of [
      [localResults, "local"],
      [nationalResults, "national"],
    ] as [RawResult[], Tier][]) {
      let addedForTier = 0;
      for (const r of results) {
        if (addedForTier >= MAX_PER_TIER) break;
        if (isBlockedDomain(r.websiteUrl)) continue;
        const host = hostnameOf(r.websiteUrl);
        if (seen.has(host)) continue;
        seen.add(host);
        competitors.push({ name: cleanName(r.title, r.websiteUrl), websiteUrl: r.websiteUrl, tier });
        addedForTier++;
      }
    }

    return jsonResponse({ competitors });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
