import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * A Supabase client scoped to the calling user's JWT, so every query still
 * goes through the RLS policies in supabase/migrations/0001_init.sql.
 */
export function supabaseForRequest(req: Request) {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}
