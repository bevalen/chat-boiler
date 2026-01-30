import { createClient } from "@supabase/supabase-js";

// Simple admin client without complex type generics
// Type safety is less strict but avoids TypeScript issues
export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
