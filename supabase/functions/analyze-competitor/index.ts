// Generates SWOT, positioning, review-mined complaint patterns, and
// "how to outposition them" tips for one competitor via Claude.
// Secret: ANTHROPIC_API_KEY
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseForRequest } from "../_shared/supabaseClient.ts";
import { askClaudeForJson } from "../_shared/claude.ts";

interface AnalysisJson {
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  positioning: string;
  pricingNotes: string;
  complaintPatterns: string[];
  outpositionTips: string[];
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { competitorId, niche, competitorData } = await req.json();
    if (!competitorId || !niche || !competitorData) {
      return jsonResponse({ error: "competitorId, niche, and competitorData are required" }, 400);
    }

    const result = await askClaudeForJson<AnalysisJson>(
      "You are a competitive-intelligence analyst for small design/home-services businesses. " +
        "You only use the publicly available data given to you — never invent private metrics like " +
        "exact ad spend, cost-per-result, or precise targeting. Paraphrase review complaints as patterns, " +
        "never quote reviews verbatim at length.",
      [
        `Niche: ${niche}`,
        `Website extract: ${String(competitorData.websiteSummary ?? "").slice(0, 3000)}`,
        `Reviews (avg ${competitorData.avgRating}, n=${competitorData.reviewCount}): ${JSON.stringify(
          competitorData.reviews
        ).slice(0, 3000)}`,
        "",
        "Return a JSON object with this exact shape:",
        `{"swot": {"strengths": string[], "weaknesses": string[], "opportunities": string[], "threats": string[]}, "positioning": string, "pricingNotes": string, "complaintPatterns": string[], "outpositionTips": string[]}`,
      ].join("\n")
    );

    const supabase = supabaseForRequest(req);
    const { data, error } = await supabase
      .from("analyses")
      .upsert({
        competitor_id: competitorId,
        swot: result.swot,
        positioning: result.positioning,
        pricing_notes: result.pricingNotes,
        complaint_patterns: result.complaintPatterns,
        outposition_tips: result.outpositionTips,
        source: "live",
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({
      competitorId: data.competitor_id,
      swot: data.swot,
      positioning: data.positioning,
      pricingNotes: data.pricing_notes,
      complaintPatterns: data.complaint_patterns,
      outpositionTips: data.outposition_tips,
      source: data.source,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
