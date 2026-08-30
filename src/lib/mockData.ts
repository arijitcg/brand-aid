import type { Analysis, CampaignDay, CompetitorData, CompetitorTier, Review, Swot } from "./types";

/** Splits "interior design, Kolkata" into { category: "interior design", location: "Kolkata" }. */
export function parseNiche(niche: string): { category: string; location: string } {
  const parts = niche.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { category: parts[0], location: parts.slice(1).join(", ") };
  return { category: parts[0] || "Design", location: "" };
}

// Deterministic pseudo-random so the same niche always produces the same demo data.
function seedFrom(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  return h;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const LOCAL_SUFFIXES = [
  "Studio", "House", "Interiors", "Design Co", "Living", "Spaces", "Collective",
  "Atelier", "Works", "Home", "Craft", "Living Concepts",
];

const LOCAL_PREFIXES = ["North", "South", "Urban", "Prime", "Signature", "Elite", "Modern", "Classic"];

const NATIONAL_BRAND_WORDS = [
  "Vivant", "Nova", "Orbis", "Meridian", "Zenith", "Crescendo", "Bellweather", "Anthem", "Elevate", "Crestline",
];

const NATIONAL_SUFFIXES = ["Design", "Interiors", "Spaces", "Living"];

/**
 * Generates a mix of local and national/MNC-style competitors, both scoped
 * to the searched location — national entries are shown with an explicit
 * branch/studio in that city, matching the requirement that even large
 * players must have a real presence there, not just category leadership.
 */
export function generateMockCompetitors(niche: string): { name: string; websiteUrl: string; tier: CompetitorTier }[] {
  const { category, location } = parseNiche(niche);
  const rng = mulberry32(seedFrom(niche.toLowerCase().trim()));
  const categoryWord = category.split(/\s+/).filter(Boolean)[0] || "Design";
  const localCount = 2 + Math.floor(rng() * 2); // 2-3
  const nationalCount = 2;
  const used = new Set<string>();
  const results: { name: string; websiteUrl: string; tier: CompetitorTier }[] = [];

  while (results.filter((r) => r.tier === "local").length < localCount) {
    const prefix = pick(rng, LOCAL_PREFIXES);
    const suffix = pick(rng, LOCAL_SUFFIXES);
    const name = `${prefix} ${categoryWord} ${suffix}`;
    if (used.has(name)) continue;
    used.add(name);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    results.push({ name, websiteUrl: `https://${slug}.com`, tier: "local" });
  }

  while (results.filter((r) => r.tier === "national").length < nationalCount) {
    const brand = pick(rng, NATIONAL_BRAND_WORDS);
    const suffix = pick(rng, NATIONAL_SUFFIXES);
    const base = `${brand} ${suffix}`;
    if (used.has(base)) continue;
    used.add(base);
    const name = location ? `${base} — ${location} Studio` : base;
    const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "");
    results.push({ name, websiteUrl: `https://${slug}.com`, tier: "national" });
  }

  return results;
}

const REVIEW_TEMPLATES = {
  positive: [
    "The team really understood our vision and delivered on time.",
    "Loved the final result, communication was smooth throughout.",
    "Great attention to detail and quality materials used.",
    "Professional from the first consultation to handover.",
  ],
  negative: [
    "Project ran nearly a month past the promised timeline.",
    "Final quote ended up much higher than the initial estimate.",
    "Hard to get quick responses once the advance was paid.",
    "A few finishing details were rushed near the deadline.",
  ],
};

const DAY_MS = 1000 * 60 * 60 * 24;

// A handful of small review samples is realistic — Google Places itself only
// ever returns up to 5 per place, regardless of the true total review count.
export function generateMockReviews(seedKey: string, growthBias: "recent" | "spread"): Review[] {
  const rng = mulberry32(seedFrom(seedKey + "-reviews"));
  const authors = ["A. Sharma", "R. Iyer", "P. Banerjee", "S. Khan", "M. Das", "T. Rao"];
  const reviews: Review[] = [];
  const total = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < total; i++) {
    const isPositive = rng() > 0.4;
    const pool = isPositive ? REVIEW_TEMPLATES.positive : REVIEW_TEMPLATES.negative;
    const ageDays = growthBias === "recent" ? Math.floor(rng() * 150) : Math.floor(rng() * 540);
    reviews.push({
      author: pick(rng, authors),
      rating: isPositive ? 4 + Math.round(rng()) : 2 + Math.round(rng()),
      text: pick(rng, pool),
      publishedAt: new Date(Date.now() - ageDays * DAY_MS).toISOString(),
    });
  }
  return reviews;
}

export function generateMockCompetitorData(competitorId: string, name: string, niche: string): CompetitorData {
  const rng = mulberry32(seedFrom(competitorId + "-volume"));
  // Simulated *total* review count — independent of the small sample above,
  // matching how Google Places reports a count far larger than the reviews
  // it actually returns.
  const volumeRoll = rng();
  const reviewCount =
    volumeRoll > 0.8
      ? 500 + Math.floor(rng() * 1500) // market leader
      : volumeRoll > 0.5
        ? 100 + Math.floor(rng() * 400) // established
        : volumeRoll > 0.25
          ? 20 + Math.floor(rng() * 80) // emerging
          : 3 + Math.floor(rng() * 17); // new entrant

  const growthBias = volumeRoll <= 0.5 && rng() > 0.4 ? "recent" : "spread";
  const reviews = generateMockReviews(competitorId, growthBias);
  const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return {
    competitorId,
    websiteSummary: `${name} positions itself as a full-service ${niche.split(",")[0] || "design"} provider, emphasizing turnkey execution, in-house 3D visualization, and a portfolio of completed residential projects. Pricing is presented as "custom quote" rather than published packages.`,
    reviews,
    avgRating: Math.round(avgRating * 10) / 10,
    reviewCount,
    source: "mock",
  };
}

function complaintPatternsFrom(reviews: Review[]): string[] {
  const negatives = reviews.filter((r) => r.rating <= 3).map((r) => r.text);
  if (negatives.length === 0) return ["No recurring complaint pattern found in sampled reviews."];
  const patterns = new Set<string>();
  negatives.forEach((text) => {
    if (/timeline|late|month/i.test(text)) patterns.add("Multiple reviews cite delayed project timelines.");
    if (/quote|estimate|higher|cost/i.test(text)) patterns.add("Recurring complaints about final cost exceeding the initial quote.");
    if (/response|advance|slow/i.test(text)) patterns.add("Customers report slower communication after the advance payment is collected.");
    if (/rushed|finishing|detail/i.test(text)) patterns.add("Some reviews mention rushed finishing work near project deadlines.");
  });
  return Array.from(patterns);
}

export function generateMockAnalysis(competitorId: string, name: string, niche: string, data: CompetitorData): Analysis {
  const rng = mulberry32(seedFrom(competitorId + "-analysis"));
  const swot: Swot = {
    strengths: [
      `Established local presence with a visible portfolio in ${niche.split(",")[1]?.trim() || "the target city"}.`,
      "In-house 3D visualization offered as a standard part of the sales process.",
      `Average review rating of ${data.avgRating}★ across ${data.reviewCount} sampled reviews.`,
    ],
    weaknesses: complaintPatternsFrom(data.reviews),
    opportunities: [
      "No published fixed-price packages — an evidence-backed, transparent pricing tier could differentiate.",
      "Limited visible presence on short-form video compared to overall ad spend signals.",
    ],
    threats: [
      "Strong brand recall from category leaders (e.g. Livspace, HomeLane) compressing mid-market share.",
      "Price-sensitive buyers comparing multiple quotes before committing.",
    ],
  };

  return {
    competitorId,
    swot,
    positioning: `${name} markets itself as a premium, full-service option targeting homeowners who want a single point of contact from design to handover, leaning on portfolio imagery and in-house visualization rather than price as the primary hook.`,
    pricingNotes: "Pricing is not published; positioned as custom-quote, consultation-first — AI-inferred estimate based on site structure, not a confirmed figure.",
    complaintPatterns: complaintPatternsFrom(data.reviews),
    outpositionTips: [
      "Publish a transparent starting-price tier where they only offer custom quotes — reduces buyer friction.",
      "Lead with a turnaround-time guarantee, directly addressing the delayed-timeline complaint pattern.",
      "Show a fixed-scope-change policy in ads to counter the 'quote grew after signing' pattern.",
      rng() > 0.5
        ? "Use before/after video content — their presence there looks thin relative to their ad activity."
        : "Highlight post-handover support/warranty, an area competitor reviews don't mention at all.",
    ],
    source: "mock",
  };
}

const MESSAGING_ANGLES = [
  "Aspirational lifestyle framing — ad leads with the finished space, not the process.",
  "Urgency/scarcity framing — limited consultation slots or seasonal offer language.",
  "Trust/credibility framing — years in business, project count, or awards used as the hook.",
  "Price-anchoring framing — a 'starting from' figure used to justify a consultation booking.",
];

export function generateMockAdAngle(pastedText: string): string {
  const rng = mulberry32(seedFrom(pastedText || "ad"));
  return pick(rng, MESSAGING_ANGLES);
}

const MOCK_SCREENSHOT_ADS = [
  {
    extractedText: "Your dream home, delivered in 45 days. Book a free design consultation this week.",
    messagingAngle: "Urgency/scarcity framing — a tight timeline promise paired with a limited-window CTA.",
  },
  {
    extractedText: "12 years. 4,000+ homes. See why Kolkata trusts us with their biggest investment.",
    messagingAngle: "Trust/credibility framing — tenure and project count used as the hook.",
  },
  {
    extractedText: "Interiors starting at ₹2.5L. No hidden costs, no surprises at handover.",
    messagingAngle: "Price-anchoring framing — a starting figure used to justify booking a consultation.",
  },
  {
    extractedText: "Swipe to see this 2BHK go from empty shell to move-in ready — link in bio for a free quote.",
    messagingAngle: "Aspirational lifestyle framing — the finished space leads, not the process.",
  },
];

export function generateMockAdScreenshot(seedKey: string): { extractedText: string; messagingAngle: string } {
  const rng = mulberry32(seedFrom(seedKey + "-screenshot"));
  return pick(rng, MOCK_SCREENSHOT_ADS);
}

const CAMPAIGN_HOOKS = [
  "We quoted it. We stuck to it.",
  "Your timeline, guaranteed in writing.",
  "See the real cost before you sign anything.",
  "Ask us for the price they won't show you.",
  "From first sketch to move-in day, one team, one deadline.",
  "The only quote that doesn't change after your advance.",
  "Built for people who've been burned by 'final' quotes before.",
];

const CAMPAIGN_CONCEPTS = [
  "Split-screen: promised timeline vs. delivered timeline, ours on time.",
  "Short client testimonial focused on price transparency.",
  "Before/after reel with a visible countdown clock overlay.",
  "Founder-to-camera explaining the fixed-quote guarantee.",
  "Carousel: 3 real client quotes with the final invoice shown side-by-side.",
  "UGC-style walkthrough of a finished project with captions calling out on-time delivery.",
  "Comparison graphic: typical industry quote process vs. ours.",
];

export function generateMockCampaign(searchId: string): Omit<CampaignDay, "id" | "status">[] {
  const rng = mulberry32(seedFrom(searchId + "-campaign"));
  const days: Omit<CampaignDay, "id" | "status">[] = [];
  const usedHooks = new Set<number>();
  for (let day = 1; day <= 7; day++) {
    let hookIdx = Math.floor(rng() * CAMPAIGN_HOOKS.length);
    while (usedHooks.has(hookIdx) && usedHooks.size < CAMPAIGN_HOOKS.length) {
      hookIdx = Math.floor(rng() * CAMPAIGN_HOOKS.length);
    }
    usedHooks.add(hookIdx);
    days.push({
      searchId,
      day,
      hook: CAMPAIGN_HOOKS[hookIdx],
      caption: `Day ${day}: ${CAMPAIGN_HOOKS[hookIdx]} Book a free consultation this week — link in bio.`,
      creativeConcept: pick(rng, CAMPAIGN_CONCEPTS),
      source: "mock",
    });
  }
  return days;
}
