/**
 * Minimal Anthropic Messages API client for Supabase Edge Functions (Deno).
 * Requires the ANTHROPIC_API_KEY secret: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
 */
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-5";

export function hasClaudeKey(): boolean {
  return Boolean(ANTHROPIC_API_KEY);
}

function extractJson<T>(text: string): T {
  const match = text.match(/[[{][\s\S]*[\]}]/);
  if (!match) throw new Error(`Claude response did not contain JSON: ${text}`);
  return JSON.parse(match[0]) as T;
}

async function sendMessage(system: string, content: unknown): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured as an Edge Function secret.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: `${system}\n\nRespond with ONLY a single valid JSON object/array. No markdown, no commentary, no code fences.`,
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.stop_reason === "max_tokens") {
    // The response was cut off mid-output (thinking tokens count against
    // max_tokens too, so a verbose answer can exhaust the budget before
    // finishing) — surface this plainly instead of a cryptic JSON parse error.
    throw new Error("Claude response was truncated (hit max_tokens) before completing valid JSON.");
  }
  return data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
}

/**
 * Sends a prompt and expects a single JSON object back. Instructs the model
 * to respond with JSON only, then parses the first {...} block in the reply.
 */
export async function askClaudeForJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  const text = await sendMessage(systemPrompt, userPrompt);
  return extractJson<T>(text);
}

/**
 * Same as askClaudeForJson, but attaches a base64-encoded image (e.g. a
 * user-captured screenshot of an ad) alongside the text prompt.
 */
export async function askClaudeForJsonWithImage<T>(
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string,
  mediaType = "image/png"
): Promise<T> {
  const text = await sendMessage(systemPrompt, [
    { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
    { type: "text", text: userPrompt },
  ]);
  return extractJson<T>(text);
}
