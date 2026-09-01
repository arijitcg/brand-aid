// Reads a user-captured screenshot of an ad (from the public Meta Ad Library,
// Instagram, etc. — the user browses and screenshots it themselves; this
// function never fetches anything from Meta directly, so it never touches
// their automated-access restriction) and extracts the ad text + messaging
// angle via Claude vision.
// Secret: ANTHROPIC_API_KEY
import { errorMessage, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { askClaudeForJsonWithImage } from "../_shared/claude.ts";

interface ExtractedAd {
  extractedText: string;
  messagingAngle: string;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return jsonResponse({ error: "imageBase64 is required" }, 400);
    }

    const result = await askClaudeForJsonWithImage<ExtractedAd>(
      "You are an ad-strategy analyst. The image is a screenshot the user took of a competitor's ad " +
        "(e.g. from the Meta Ad Library or a social feed). Transcribe the visible ad headline/body copy " +
        "exactly as written, then identify its core messaging angle in one sentence (e.g. urgency/scarcity, " +
        "trust/credibility, price-anchoring, aspirational lifestyle). Do not invent spend, CPR, or targeting " +
        "data — you only have what's visible in the image.",
      'Return: {"extractedText": string, "messagingAngle": string}',
      imageBase64,
      mediaType || "image/png"
    );

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500);
  }
});
