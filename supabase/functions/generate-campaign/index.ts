// Drafts a 7-day counter-campaign (hooks, captions, creative concepts) from
// the competitive analyses already saved for this search.
// Secret: ANTHROPIC_API_KEY
import { errorMessage, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseForRequest } from "../_shared/supabaseClient.ts";
import { askClaudeForJson } from "../_shared/claude.ts";

interface CampaignDayJson {
  day: number;
  hook: string;
  caption: string;
  creativeConcept: string;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { searchId } = await req.json();
    if (!searchId) return jsonResponse({ error: "searchId is required" }, 400);

    const supabase = supabaseForRequest(req);

    const { data: search, error: searchError } = await supabase
      .from("searches")
      .select()
      .eq("id", searchId)
      .single();
    if (searchError) throw searchError;

    const { data: competitors, error: competitorsError } = await supabase
      .from("competitors")
      .select()
      .in("id", search.selected_competitor_ids ?? []);
    if (competitorsError) throw competitorsError;

    const { data: analyses, error: analysesError } = await supabase
      .from("analyses")
      .select()
      .in("competitor_id", (competitors ?? []).map((c) => c.id));
    if (analysesError) throw analysesError;

    const context = (analyses ?? [])
      .map((a) => {
        const competitor = competitors?.find((c) => c.id === a.competitor_id);
        return `${competitor?.name ?? "Competitor"}: outposition tips — ${JSON.stringify(a.outposition_tips)}; weaknesses — ${JSON.stringify(
          a.swot?.weaknesses ?? []
        )}`;
      })
      .join("\n");

    const raw = await askClaudeForJson<CampaignDayJson[] | { days: CampaignDayJson[] }>(
      "You are a performance-marketing copywriter for a small design/home-services business. " +
        "Draft a 7-day counter-campaign that exploits the competitor weaknesses and outposition " +
        "opportunities given to you. Keep hooks short and punchy, captions under 200 characters, " +
        "and creative concepts as one concrete shootable idea each.",
      [
        `Niche: ${search.niche}`,
        `Competitive analysis context:\n${context || "No analyses available."}`,
        "",
        'Return a bare JSON array of exactly 7 objects: [{"day": 1, "hook": string, "caption": string, ' +
          '"creativeConcept": string}, ...]. Do NOT wrap it in an object (NOT {"days": [...]})',
      ].join("\n")
    );
    // Claude occasionally wraps the array in an object despite instructions
    // not to — accept either shape rather than passing a broken value on.
    const days = Array.isArray(raw) ? raw : Array.isArray(raw?.days) ? raw.days : null;
    if (!days) throw new Error(`Unexpected campaign response shape: ${JSON.stringify(raw)}`);

    return jsonResponse({ days });
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500);
  }
});
