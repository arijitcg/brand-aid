// Reads one pasted Meta Ad Library ad and identifies its messaging angle.
// Secret: ANTHROPIC_API_KEY
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { askClaudeForJson } from "../_shared/claude.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { pastedText } = await req.json();
    if (!pastedText || typeof pastedText !== "string") {
      return jsonResponse({ error: "pastedText is required" }, 400);
    }

    const result = await askClaudeForJson<{ messagingAngle: string }>(
      "You are an ad-strategy analyst. Given one pasted ad (headline/body copy), identify its core " +
        "messaging angle in a single sentence (e.g. urgency/scarcity, trust/credibility, price-anchoring, " +
        "aspirational lifestyle). Do not invent spend, CPR, or targeting data — you only have the ad copy.",
      `Ad copy:\n${pastedText}\n\nReturn: {"messagingAngle": string}`
    );

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
