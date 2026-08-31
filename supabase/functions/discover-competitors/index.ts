// Discovers top competitors for a niche via SerpAPI or Google Custom Search.
// Runs two location-scoped searches — one biased toward local businesses,
// one toward established/national chains — so results mix both, and even
// national players are required to show up for a location-scoped query
// (i.e. they need an actual presence there, not just category leadership).
//
// The user can type ANY niche, which rules out a maintained blocklist of
// aggregator domains as the real filtering strategy — it can only ever know
// about aggregators already seen, keeps growing without bound, and (as
// happened here) a long-enough blocklist padded into the search query as
// `-site:` exclusions eventually overwhelms Google's query parsing and
// produces garbage results. So the *general* rule used instead: validate
// each candidate against real Google Places data (business category,
// address, review count) rather than pattern-matching its domain name.
// Directories, aggregators, news sites, and course listings don't operate
// as a single physical {category} business the way a genuine competitor
// does, and that's visible in the Places data itself, for any niche, without
// needing to know the aggregator by name in advance. Claude then reasons
// over those real facts (or their absence) rather than guessing from a
// search-result title/URL alone.
//
// Only a small, fixed set of domains is still hardcoded — social platforms
// and search engines, which are never a business in ANY niche and never
// will be, so there's no "unbounded list" risk from keeping those.
//
// Secrets: SERPAPI_KEY  -or-  GOOGLE_CSE_KEY + GOOGLE_CSE_CX
//          ANTHROPIC_API_KEY (optional — enables the classification pass)
//          GOOGLE_PLACES_API_KEY (optional — enables the Places validation pass)
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { askClaudeForJson } from "../_shared/claude.ts";

type Tier = "local" | "national";

interface Candidate {
  name: string;
  websiteUrl: string;
  tier: Tier;
}

interface PlacesInfo {
  matched: boolean;
  primaryType?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
}

interface EnrichedCandidate extends Candidate {
  places: PlacesInfo;
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

// Never a business in any niche, ever — safe to hardcode since this is a
// closed, niche-agnostic set, unlike aggregators/directories which are
// specific to whatever the user happened to type.
const UNIVERSAL_BLOCKED_DOMAINS = [
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
];
const SEARCH_EXCLUSIONS = UNIVERSAL_BLOCKED_DOMAINS.map((d) => `-site:${d}`).join(" ");

function isBlockedDomain(url: string): boolean {
  const host = hostnameOf(url);
  return UNIVERSAL_BLOCKED_DOMAINS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

// A listicle/directory PAGE is not a homepage representing one brand, even
// when it happens to be hosted on an otherwise-legitimate domain — checked
// on the URL path itself (deterministic, free, and niche-agnostic, unlike
// the domain-name guessing this replaces).
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
 * Resolves one candidate against real Google Places data — the general,
 * niche-agnostic signal used instead of a domain blocklist. A directory,
 * aggregator, news site, or course listing doesn't operate as a single
 * physical {category} business, and that's visible here (wrong category,
 * no match, or resolves to an unrelated corporate office) regardless of
 * what the aggregator happens to be called.
 */
async function lookupPlaces(name: string, location: string, apiKey: string): Promise<PlacesInfo> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.primaryType,places.formattedAddress,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({ textQuery: location ? `${name} ${location}` : name }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { matched: false };
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return { matched: false };
    return {
      matched: true,
      primaryType: place.primaryType,
      address: place.formattedAddress,
      rating: place.rating,
      reviewCount: place.userRatingCount,
    };
  } catch {
    return { matched: false };
  }
}

async function enrichWithPlaces(candidates: Candidate[], location: string): Promise<EnrichedCandidate[]> {
  const placesKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!placesKey) return candidates.map((c) => ({ ...c, places: { matched: false } }));

  return Promise.all(
    candidates.map(async (c) => ({ ...c, places: await lookupPlaces(c.name, location, placesKey) }))
  );
}

/**
 * Asks Claude which candidates are genuine individual competitor businesses
 * physically operating in this category, reasoning over each candidate's
 * real Places data (category, address, reviews — or its absence) rather
 * than guessing from the search-result title/URL alone. Returns the
 * surviving candidates unchanged if the classification call fails or no
 * Anthropic key is configured — this pass is a quality filter, not a hard
 * requirement for discovery to work.
 */
async function classifyCandidates(
  candidates: EnrichedCandidate[],
  category: string,
  location: string
): Promise<Candidate[]> {
  if (!Deno.env.get("ANTHROPIC_API_KEY") || candidates.length === 0) return candidates;

  try {
    const list = candidates
      .map((c, i) => {
        const p = c.places;
        const placesLine = p.matched
          ? `Places match: category "${p.primaryType ?? "unknown"}", ${p.address ?? "no address"}, ` +
            `${p.rating ?? "no"} rating (${p.reviewCount ?? 0} reviews)`
          : "Places match: none found";
        return `${i}. ${c.name} — ${c.websiteUrl}\n   ${placesLine}`;
      })
      .join("\n");

    const raw = await askClaudeForJson<number[] | { keep: number[] }>(
      `You identify which candidates are a genuine, SINGLE business that itself provides "${category}" directly ` +
        "to customers, as opposed to a marketplace/directory/aggregator platform that connects customers to many " +
        "independent providers of that same service. This is the single most important test, and it is about " +
        "BUSINESS MODEL, not fame, size, category match, or whether the candidate has its own real Google Places " +
        "listing — marketplaces are frequently huge, famous, highly-reviewed companies with real corporate offices " +
        "(a Places match proves the company is real, not that it itself performs the service). Ask: if a customer " +
        `used this site, would they end up as a customer of ONE specific "${category}" business (keep it), or ` +
        "would they be shown a list of many different, competing providers to choose between (exclude it, no " +
        "matter how large or well-known the platform is)? Examples of the marketplace pattern to exclude even " +
        "though every one of these is a large, legitimate, real company: Swiggy/Zomato/UberEats (food delivery " +
        "marketplaces, not restaurants), WedMeGood/WeddingSutra (wedding-vendor marketplaces, not photographers), " +
        "NoBroker/99acres/MagicBricks/Housing.com (real-estate marketplaces, not a builder — this applies to EVERY " +
        "vertical NoBroker or similar portals have a sub-section for, including interiors/home-services, not just " +
        "their core real-estate listings), UrbanCompany/Sulekha/Justdial/IndiaMART (local-services or B2B " +
        "marketplaces, not the provider). Also exclude, for the usual reasons: news articles or press coverage; " +
        "blog posts, listicles, or review guides ('best X in Y', 'top 10...', 'list of...'); job-listing or " +
        "employer-review sites (e.g. AmbitionBox, Glassdoor, Naukri, Indeed — these review employers as " +
        "workplaces, they are never themselves the service provider); market-research reports or industry " +
        "statistics; business directories, company-database profiles, or documents/slideshows hosted on " +
        "file-sharing sites (e.g. Scribd, SlideShare, Issuu, Academia.edu — a document ABOUT a niche is never " +
        "itself a business in that niche, regardless of its title); educational institutions, courses, or " +
        "certification programs that teach the subject rather than provide the service; and social media or forum " +
        "posts. Use each candidate's Places data as supporting context: a strong Places match (real category, " +
        "address, reviews) supports keeping a candidate but never overrides the marketplace/directory/document " +
        "checks above. Conversely, NO Places match at all should by default mean EXCLUDE — a real single-location " +
        "business in this niche almost always has some Google Places presence, so a total absence of one is a " +
        "strong signal this candidate is a webpage/article/directory-listing rather than an actual business; only " +
        "keep a no-match candidate if its name is unambiguously a specific, proper business name (not a generic " +
        "phrase like 'X in Y', 'list of X', 'best X'). When genuinely uncertain, exclude rather than " +
        "include.",
      `Niche: ${category}${location ? ` in ${location}` : ""}\n\nCandidates:\n${list}\n\n` +
        `Return a bare JSON array of the 0-based indices to KEEP (genuine individual competitor businesses only) ` +
        `— for example [0,2,3]. Do NOT wrap it in an object (NOT {"keep": [0,2,3]}), and do NOT include any text ` +
        `outside the array.`
    );
    // Claude occasionally wraps the array in an object (e.g. {"keep": [...]})
    // despite instructions not to — accept either shape rather than crashing
    // and silently falling into the unfiltered-fallback below.
    const keepIndices = Array.isArray(raw) ? raw : Array.isArray(raw?.keep) ? raw.keep : null;
    if (!keepIndices) {
      throw new Error(`Unexpected classification response shape: ${JSON.stringify(raw)}`);
    }
    const keep = new Set(keepIndices);
    // No fallback-to-unfiltered here on purpose: if Claude says none of the
    // raw results are genuine competitors, that's usually correct (an
    // aggregator-dominated results page) — showing the rejected aggregators
    // anyway would silently undo the whole point of this pass.
    return candidates.filter((_, i) => keep.has(i)).map(({ places: _places, ...c }) => c);
  } catch (err) {
    console.error(`[classifyCandidates] failed, returning unfiltered: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    return candidates.map(({ places: _places, ...c }) => c);
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

    const enriched = await enrichWithPlaces(candidates, location);
    const filtered = await classifyCandidates(enriched, category, location);

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
