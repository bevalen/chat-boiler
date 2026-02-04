import { createClient } from "@supabase/supabase-js";

// Simple admin client without complex type generics
// Type safety is less strict but avoids TypeScript issues
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Return null if Supabase is not configured (for boilerplate mode)
  if (!url || !key) {
    return null as any;
  }

  return createClient(url, key);
}
