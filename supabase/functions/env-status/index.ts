// Reports which Edge Function secrets are configured, as booleans only —
// never the values — so the Settings page can show accurate Live/Demo
// status instead of a guess.
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

Deno.serve((req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  return jsonResponse({
    anthropic: Boolean(Deno.env.get("ANTHROPIC_API_KEY")),
    discovery: Boolean(Deno.env.get("SERPAPI_KEY")) || Boolean(Deno.env.get("GOOGLE_CSE_KEY") && Deno.env.get("GOOGLE_CSE_CX")),
    googlePlaces: Boolean(Deno.env.get("GOOGLE_PLACES_API_KEY")),
  });
});
