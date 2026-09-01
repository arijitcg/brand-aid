// Auto-fetches a competitor's website text + Google reviews via the
// Places API (New) — the legacy Places endpoints Google now steers
// everyone away from.
// Secret: GOOGLE_PLACES_API_KEY (with "Places API (New)" enabled on the
// Google Cloud project the key belongs to)
import { errorMessage, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseForRequest } from "../_shared/supabaseClient.ts";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWebsiteText(websiteUrl: string): Promise<string> {
  try {
    const res = await fetch(websiteUrl, { signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    return stripHtml(html).slice(0, 4000);
  } catch {
    return "";
  }
}

interface PlaceReview {
  author: string;
  rating: number;
  text: string;
  publishedAt?: string;
}

interface PlacesReviewResult {
  reviews: PlaceReview[];
  avgRating: number;
  reviewCount: number;
}

async function fetchGoogleReviews(competitorName: string, apiKey: string): Promise<PlacesReviewResult> {
  const empty: PlacesReviewResult = { reviews: [], avgRating: 0, reviewCount: 0 };

  const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({ textQuery: competitorName }),
    signal: AbortSignal.timeout(15000),
  });
  if (!searchRes.ok) throw new Error(`Places searchText error: ${searchRes.status} ${await searchRes.text()}`);
  const searchData = await searchRes.json();
  const placeId = searchData.places?.[0]?.id;
  if (!placeId) return empty;

  const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "rating,userRatingCount,reviews",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!detailsRes.ok) throw new Error(`Places details error: ${detailsRes.status} ${await detailsRes.text()}`);
  const details = await detailsRes.json();

  const reviews: PlaceReview[] = (details.reviews ?? []).map(
    (r: {
      authorAttribution?: { displayName?: string };
      rating?: number;
      text?: { text?: string };
      publishTime?: string;
    }) => ({
      author: r.authorAttribution?.displayName ?? "Anonymous",
      rating: r.rating ?? 0,
      text: r.text?.text ?? "",
      publishedAt: r.publishTime,
    })
  );

  return {
    reviews,
    avgRating: details.rating ?? 0,
    reviewCount: details.userRatingCount ?? reviews.length,
  };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { competitorId, name, websiteUrl } = await req.json();
    if (!competitorId || !name || !websiteUrl) {
      return jsonResponse({ error: "competitorId, name, and websiteUrl are required" }, 400);
    }

    const placesKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!placesKey) {
      return jsonResponse({ error: "GOOGLE_PLACES_API_KEY is not configured as an Edge Function secret." }, 501);
    }

    const [websiteSummary, placesResult] = await Promise.all([
      fetchWebsiteText(websiteUrl),
      fetchGoogleReviews(name, placesKey),
    ]);

    const supabase = supabaseForRequest(req);
    const { data, error } = await supabase
      .from("competitor_data")
      .upsert({
        competitor_id: competitorId,
        website_summary: websiteSummary,
        reviews: placesResult.reviews,
        avg_rating: placesResult.avgRating,
        review_count: placesResult.reviewCount,
        source: "live",
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({
      competitorId: data.competitor_id,
      websiteSummary: data.website_summary,
      reviews: data.reviews,
      avgRating: data.avg_rating,
      reviewCount: data.review_count,
      source: data.source,
    });
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500);
  }
});
