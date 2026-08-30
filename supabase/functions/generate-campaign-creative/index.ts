// Generates a background/scene image for one campaign day via Gemini
// (Imagen), uploads it to Supabase Storage, and saves the public URL on the
// campaign row. The prompt explicitly forbids any text/letters in the image
// — AI image models render text unreliably, so the hook is overlaid as real
// HTML/CSS on top of this image client-side instead of being baked in here.
// Secret: GEMINI_API_KEY
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseForRequest } from "../_shared/supabaseClient.ts";

// "Nano Banana" — Gemini's native image-output model, called via
// generateContent (not the older, separate Imagen :predict endpoint, which
// this API key's project doesn't have access to).
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

async function generateImage(prompt: string, apiKey: string): Promise<Uint8Array> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini image generation error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);
  const b64 = imagePart?.inlineData?.data;
  if (!b64) throw new Error(`Gemini returned no image: ${JSON.stringify(data).slice(0, 500)}`);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { campaignDayId } = await req.json();
    if (!campaignDayId) return jsonResponse({ error: "campaignDayId is required" }, 400);

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return jsonResponse({ error: "GEMINI_API_KEY is not configured as an Edge Function secret." }, 501);
    }

    const supabase = supabaseForRequest(req);
    const { data: day, error: dayError } = await supabase
      .from("campaigns")
      .select()
      .eq("id", campaignDayId)
      .single();
    if (dayError) throw dayError;

    const prompt = [
      `Professional social-media marketing photograph for a home interior design ad campaign.`,
      `Scene / concept: ${day.creative_concept}`,
      `Style: clean, modern, warm natural lighting, high-end residential interior, photorealistic, square 1:1`,
      `aspect ratio framed for an Instagram post.`,
      `Absolutely no text, no words, no letters, no numbers, no logos, no watermarks anywhere in the image —`,
      `pure visual scene only.`,
    ].join(" ");

    const imageBytes = await generateImage(prompt, geminiKey);

    const path = `${campaignDayId}.png`;
    const { error: uploadError } = await supabase.storage
      .from("campaign-creatives")
      .upload(path, imageBytes, { contentType: "image/png", upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from("campaign-creatives").getPublicUrl(path);
    const imageUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ creative_image_url: imageUrl })
      .eq("id", campaignDayId);
    if (updateError) throw updateError;

    return jsonResponse({ imageUrl });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
