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

  // 3. LinkedIn extension token authentication
  if (authHeader?.startsWith("Bearer ") && channelSource === "linkedin") {
    const token = authHeader.substring(7);
    console.log("[auth] LinkedIn extension auth attempt");

    const adminClient = getAdminClient();
    supabase = adminClient;

    const { data: credentials } = await adminClient
      .from("user_channel_credentials")
      .select("user_id, credentials, is_active")
      .eq("channel_type", "linkedin")
      .eq("is_active", true);

    if (credentials) {
      const matchingCred = credentials.find((cred) => {
        const linkedInCreds = cred.credentials as { extension_token?: string; token_expires_at?: string };
        if (linkedInCreds.extension_token === token) {
          if (linkedInCreds.token_expires_at) {
            const expiresAt = new Date(linkedInCreds.token_expires_at);
            if (expiresAt < new Date()) {
              console.log("[auth] LinkedIn extension token expired");
              return false;
            }
          }
          return true;
        }
        return false;
      });

      if (matchingCred) {
        console.log("[auth] LinkedIn extension auth successful for user:", matchingCred.user_id);
        user = { id: matchingCred.user_id };
        isExtensionAuth = true;
        return { user, supabase, isExtensionAuth };
      }
    }

    console.log("[auth] LinkedIn extension auth failed - invalid token");
    return { user: null, supabase, isExtensionAuth: false };
  }

  // 4. Regular browser-based authentication
  supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  user = data.user;

  return { user, supabase, isExtensionAuth };
}
