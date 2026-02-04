/**
 * Authentication module for chat API
 * Handles various authentication methods: browser session, internal API, cron, and extension tokens
 */

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export interface AuthResult {
  user: { id: string } | null;
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof getAdminClient>;
  isExtensionAuth: boolean;
}

export interface AuthOptions {
  authHeader: string | null;
  cronHeader: string | null;
  externalUserId?: string;
  requestAgentId?: string;
  isBackgroundTask?: boolean;
  channelSource?: string;
}

/**
 * Authenticate the request using various methods
 */
export async function authenticateRequest(options: AuthOptions): Promise<AuthResult> {
  const {
    authHeader,
    cronHeader,
    externalUserId,
    requestAgentId,
    isBackgroundTask,
    channelSource,
  } = options;

  const expectedAuth = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  const isInternalCall = authHeader === expectedAuth;
  const isCronCall = cronHeader === process.env.CRON_SECRET && isBackgroundTask;

  let user: { id: string } | null = null;
  let supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof getAdminClient>;
  let isExtensionAuth = false;

  // 1. Cron authentication
  if (isCronCall && requestAgentId) {
    console.log("[auth] Cron call for agent:", requestAgentId);
    const adminClient = getAdminClient();
    supabase = adminClient;

    const { data: agent } = await adminClient
      .from("agents")
      .select("user_id")
      .eq("id", requestAgentId)
      .single();

    if (agent) {
      user = { id: agent.user_id };
      console.log("[auth] Cron call authenticated for user:", agent.user_id);
    }

    return { user, supabase, isExtensionAuth };
  }

  // 2. Internal API call with service role key
  if (isInternalCall && externalUserId) {
    console.log("[auth] Internal API call for user:", externalUserId);
    supabase = getAdminClient();
    user = { id: externalUserId };
    return { user, supabase, isExtensionAuth };
  }

  // 3. Regular browser-based authentication
  supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  user = data.user;

  return { user, supabase, isExtensionAuth };
}
