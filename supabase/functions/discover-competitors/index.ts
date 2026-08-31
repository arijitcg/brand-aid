// Discovers top competitors for a niche via SerpAPI or Google Custom Search.
// Runs two location-scoped searches — one biased toward local businesses,
// one toward established/national chains — so results mix both, and even
// national players are required to show up for a location-scoped query
// (i.e. they need an actual presence there, not just category leadership).
//
// Raw web search results are noisy in two ways:
//  1. Obvious junk — forums, social posts, directory/listicle pages. A cheap
//     domain blocklist catches this before spending an AI call on it.
//  2. Niche-specific aggregators — e.g. searching "fast food" surfaces
//     Swiggy/Zomato (food-delivery marketplaces that list thousands of
//     restaurants, not a competitor themselves). A fixed blocklist can never
//     anticipate every industry's aggregators, so a Claude classification
//     pass judges "is this an individual competitor business, or a
//     marketplace/aggregator/portal" contextually for whatever niche was
//     searched.
//
// Secrets: SERPAPI_KEY  -or-  GOOGLE_CSE_KEY + GOOGLE_CSE_CX
//          ANTHROPIC_API_KEY (optional — enables the aggregator-filtering pass)
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { askClaudeForJson } from "../_shared/claude.ts";

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

// Generic junk that's never a competitor regardless of niche — social
// platforms, forums, Q&A sites, search engines, and cross-industry
// directories. Niche-specific aggregators (food delivery, real estate
// portals, job boards, etc.) are handled by the Claude pass below instead,
// since no fixed list could anticipate every industry's.
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
  "google.com",
  "google.co.in",
  "bing.com",
  "houzz.in",
  "houzz.com",
  "houzz.co.uk",
  "re-thinkingthefuture.com",
  "sulekha.com",
  "justdial.com",
  "urbancompany.com",
  "urbanclap.com",
  "yellowpages.com",
  "indiamart.com",
  "tripadvisor.com",
  "tripadvisor.in",
  "yelp.com",
  "latlong.net",
  "wanderlog.com",
  "dnb.com",
  // Job/employer-review sites — surface for "top companies" style queries.
  "glassdoor.com",
  "glassdoor.co.in",
  "naukri.com",
  "indeed.com",
  // Market-research/industry-report content farms.
  "marketdataforecast.com",
  "statista.com",
  "ibisworld.com",
  "grandviewresearch.com",
  "mordorintelligence.com",
  // Major news/business-media sites — cover industry trends, never a
  // competitor themselves.
  "livemint.com",
  "indianexpress.com",
  "economictimes.indiatimes.com",
  "timesofindia.indiatimes.com",
  "business-standard.com",
  "moneycontrol.com",
  // Food-delivery marketplaces — dominate search results for any food/
  // restaurant niche without being a competitor themselves.
  "swiggy.com",
  "zomato.com",
  "ubereats.com",
  "doordash.com",
  "grubhub.com",
  "foodpanda.com",
  "foodpanda.pk",
  "dineout.co.in",
  "eazydiner.com",
  "deliveroo.com",
  "magicpin.in",
  // Real estate / property portals.
  "99acres.com",
  "magicbricks.com",
  "housing.com",
  "makaan.com",
  "nobroker.in",
  // Company/startup research databases — informational, not a competitor.
  "tracxn.com",
  // Freelancer/service marketplaces — list many independent providers, not
  // a competitor themselves.
  "upwork.com",
  "fiverr.com",
  "freelancer.com",
  "guru.com",
  // Document/file-hosting sites — uploaded PDFs/docs about an industry are
  // never themselves a competitor.
  "scribd.com",
  "slideshare.net",
  "issuu.com",
  "academia.edu",
  "docs.google.com",
  "drive.google.com",
  "dropbox.com",
  // Generic free website-builder / blog-hosting domains. A handful of real
  // small businesses do use these, but in practice a result on one of these
  // is far more often a spam/placeholder/abandoned site than an authentic
  // brand — worth the trade-off for a "real brands only" bar.
  "jimdosite.com",
  "wixsite.com",
  "weebly.com",
  "blogspot.com",
  "sites.google.com",
  "wordpress.com",
];

// These same domains are also excluded directly in the search query itself
// (Google's `-site:` operator), so real competitor sites aren't crowded off
// page one by aggregators in the first place — filtering post-hoc only
// works if a genuine result made it into the top ~10 to begin with.
const SEARCH_EXCLUSIONS = BLOCKED_DOMAINS.map((d) => `-site:${d}`).join(" ");

function isBlockedDomain(url: string): boolean {
  const host = hostnameOf(url);
  return BLOCKED_DOMAINS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

// A listicle/directory PAGE is not a homepage representing one brand, even
// when it happens to be hosted on an otherwise-legitimate domain — checked
// on the URL path itself (deterministic, not dependent on LLM judgment),
// since the Claude pass alone proved too inconsistent to catch these
// reliably (e.g. ".../10-best-interior-design").
function isListicleUrlPath(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\/(\d+[-_]?)?(top|best)[-_]/.test(path) || /directory/.test(path) || /\/\d+-/.test(path);
  } catch {
    return false;
  }
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
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=20&api_key=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
  const data = await res.json();
  const results = (data.organic_results ?? []) as { title: string; link: string }[];
  return results.map((r) => ({ title: r.title, websiteUrl: r.link }));
}

async function searchWithGoogleCse(query: string, key: string, cx: string): Promise<RawResult[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=20`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
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

/**
 * Asks Claude which candidates are genuine individual competitor businesses,
 * as opposed to marketplaces/aggregators, news coverage, directories,
 * job/review sites, or market-research content that merely ranks well for
 * the search query. Returns the surviving candidates unchanged if the
 * classification call fails or no Anthropic key is configured — this pass
 * is a quality filter, not a hard requirement for discovery to work.
 */
async function filterOutAggregators(candidates: Candidate[], category: string, location: string): Promise<Candidate[]> {
  if (!Deno.env.get("ANTHROPIC_API_KEY") || candidates.length === 0) return candidates;

  try {
    const list = candidates.map((c, i) => `${i}. ${c.name} — ${c.websiteUrl}`).join("\n");
    const keepIndices = await askClaudeForJson<number[]>(
      "You identify which search results are the OFFICIAL WEBSITE of a genuine, individual competitor business in " +
        "a given industry — a specific company's own site for a business that actually operates in that space. " +
        "Exclude every result that is NOT that, including: marketplaces/aggregators/delivery apps that list many " +
        "unrelated businesses (e.g. Swiggy/Zomato/UberEats for restaurants, property portals for real estate); " +
        "news articles or press coverage about the industry; blog posts, listicles, or travel/review guides " +
        "('best X in Y', 'top 10...'); job-listing or employer-review sites (Glassdoor, Naukri, Indeed); market- " +
        "research reports or industry statistics pages; business directories or company-database profile pages; " +
        "and social media or forum posts. When in doubt about whether a result is a real operating business's own " +
        "site versus one of the above, exclude it.",
      `Niche: ${category}${location ? ` in ${location}` : ""}\n\nCandidates:\n${list}\n\n` +
        `Return a JSON array of the 0-based indices to KEEP (genuine individual competitor businesses only). ` +
        `Example: [0,2,3]`
    );
    const keep = new Set(keepIndices);
    // No fallback-to-unfiltered here on purpose: if Claude says none of the
    // raw results are genuine competitors, that's usually correct (an
    // aggregator-dominated results page) — showing the rejected aggregators
    // anyway would silently undo the whole point of this pass.
    return candidates.filter((_, i) => keep.has(i));
  } catch {
    return candidates;
  }
}

const MAX_PER_TIER = 6;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { niche } = await req.json();
    if (!niche || typeof niche !== "string") return jsonResponse({ error: "niche is required" }, 400);

    const { category, location } = parseNiche(niche);
    const localQuery = `${location ? `${category} in ${location}` : `${category} near me`} ${SEARCH_EXCLUSIONS}`;
    const nationalQuery = `${
      location ? `top ${category} companies in ${location}` : `top ${category} companies`
    } ${SEARCH_EXCLUSIONS}`;

    let localResults: RawResult[];
    let nationalResults: RawResult[];
    try {
      [localResults, nationalResults] = await Promise.all([runSearch(localQuery), runSearch(nationalQuery)]);
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 501);
    }

    const seen = new Set<string>();
    const candidates: Candidate[] = [];
    for (const [results, tier] of [
      [localResults, "local"],
      [nationalResults, "national"],
    ] as [RawResult[], Tier][]) {
      for (const r of results) {
        if (isBlockedDomain(r.websiteUrl) || isListicleUrlPath(r.websiteUrl)) continue;
        const host = hostnameOf(r.websiteUrl);
        if (seen.has(host)) continue;
        seen.add(host);
        candidates.push({ name: cleanName(r.title, r.websiteUrl), websiteUrl: r.websiteUrl, tier });
      }
    }

    const filtered = await filterOutAggregators(candidates, category, location);

    const competitors: Candidate[] = [];
    const countByTier: Record<Tier, number> = { local: 0, national: 0 };
    for (const c of filtered) {
      if (countByTier[c.tier] >= MAX_PER_TIER) continue;
      competitors.push(c);
      countByTier[c.tier]++;
    }

    return jsonResponse({ competitors });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
