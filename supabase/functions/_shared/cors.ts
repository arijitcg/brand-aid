export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

/**
 * Extracts a readable message from a caught error for API responses.
 * Postgrest/Supabase errors are plain objects with a `.message` (and often
 * `.details`/`.hint`), not Error instances — String(err) on those just
 * produces "[object Object]", hiding the actual failure reason.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    const details = "details" in err && typeof err.details === "string" ? ` (${err.details})` : "";
    return `${err.message}${details}`;
  }
  return String(err);
}
