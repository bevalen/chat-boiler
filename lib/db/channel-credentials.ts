import { SupabaseClient } from "@supabase/supabase-js";
import {
  Database,
  ChannelType,
  SlackCredentials,
  ChannelCredentials,
} from "@/lib/types/database";

type ChannelCredentialsRow =
  Database["public"]["Tables"]["user_channel_credentials"]["Row"];

export interface UserChannelCredential {
  id: string;
  userId: string;
  channelType: "slack" | "email" | "sms" | "discord";
  credentials: ChannelCredentials;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

function mapCredentialsRow(row: ChannelCredentialsRow): UserChannelCredential {
  return {
    id: row.id,
    userId: row.user_id,
    channelType: row.channel_type,
    credentials: row.credentials as ChannelCredentials,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get channel credentials for a user by channel type
 */
export async function getChannelCredentials(
  supabase: SupabaseClient,
  userId: string,
  channelType: ChannelType
): Promise<{ credentials: UserChannelCredential | null; error: string | null }> {
  const { data, error } = await supabase
    .from("user_channel_credentials")
    .select("*")
    .eq("user_id", userId)
    .eq("channel_type", channelType)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows found
      return { credentials: null, error: null };
    }
    console.error("Error fetching channel credentials:", error);
    return { credentials: null, error: error.message };
  }

  return { credentials: mapCredentialsRow(data), error: null };
}

/**
 * Get all channel credentials for a user
 */
export async function getAllChannelCredentials(
  supabase: SupabaseClient,
  userId: string
): Promise<{ credentials: UserChannelCredential[]; error: string | null }> {
  const { data, error } = await supabase
    .from("user_channel_credentials")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching all channel credentials:", error);
    return { credentials: [], error: error.message };
  }

  return {
    credentials: (data || []).map(mapCredentialsRow),
    error: null,
  };
}

/**
 * Get Slack credentials for a user (convenience function with typed return)
 */
export async function getSlackCredentials(
  supabase: SupabaseClient,
  userId: string
): Promise<{ credentials: SlackCredentials | null; isActive: boolean; error: string | null }> {
  const { credentials, error } = await getChannelCredentials(
    supabase,
    userId,
    "slack"
  );

  if (error || !credentials) {
    return { credentials: null, isActive: false, error };
  }

  return {
    credentials: credentials.credentials as SlackCredentials,
    isActive: credentials.isActive,
    error: null,
  };
}

/**
 * Get user by Slack user ID (for incoming Slack messages)
 */
export async function getUserBySlackId(
  supabase: SupabaseClient,
  slackUserId: string
): Promise<{ userId: string | null; agentId: string | null; error: string | null }> {
  // Query for credentials containing this Slack user ID
  const { data, error } = await supabase
    .from("user_channel_credentials")
    .select("user_id")
    .eq("channel_type", "slack")
    .eq("is_active", true)
    .contains("credentials", { user_slack_id: slackUserId })
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { userId: null, agentId: null, error: null };
    }
    console.error("Error finding user by Slack ID:", error);
    return { userId: null, agentId: null, error: error.message };
  }

  // Get the user's agent
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", data.user_id)
    .single();

  if (agentError) {
    console.error("Error finding agent for user:", agentError);
    return { userId: data.user_id, agentId: null, error: agentError.message };
  }

  return { userId: data.user_id, agentId: agent.id, error: null };
}

/**
 * Create or update channel credentials for a user
 */
export async function upsertChannelCredentials(
  supabase: SupabaseClient,
  userId: string,
  channelType: ChannelType,
  credentials: ChannelCredentials,
  isActive: boolean = true
): Promise<{ credentials: UserChannelCredential | null; error: string | null }> {
  const { data, error } = await supabase
    .from("user_channel_credentials")
    .upsert(
      {
        user_id: userId,
        channel_type: channelType,
        credentials,
        is_active: isActive,
      },
      {
        onConflict: "user_id,channel_type",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error upserting channel credentials:", error);
    return { credentials: null, error: error.message };
  }

  return { credentials: mapCredentialsRow(data), error: null };
}

/**
 * Update Slack credentials specifically (convenience function)
 */
export async function updateSlackCredentials(
  supabase: SupabaseClient,
  userId: string,
  slackCredentials: SlackCredentials,
  isActive: boolean = true
): Promise<{ credentials: UserChannelCredential | null; error: string | null }> {
  return upsertChannelCredentials(supabase, userId, "slack", slackCredentials, isActive);
}

/**
 * Toggle channel active status
 */
export async function setChannelActive(
  supabase: SupabaseClient,
  userId: string,
  channelType: ChannelType,
  isActive: boolean
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from("user_channel_credentials")
    .update({ is_active: isActive })
    .eq("user_id", userId)
    .eq("channel_type", channelType);

  if (error) {
    console.error("Error updating channel active status:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Delete channel credentials for a user
 */
export async function deleteChannelCredentials(
  supabase: SupabaseClient,
  userId: string,
  channelType: ChannelType
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from("user_channel_credentials")
    .delete()
    .eq("user_id", userId)
    .eq("channel_type", channelType);

  if (error) {
    console.error("Error deleting channel credentials:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Check if a user has active Slack credentials
 */
export async function hasActiveSlack(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { credentials, isActive, error } = await getSlackCredentials(
    supabase,
    userId
  );
  return !error && credentials !== null && isActive;
}

/**
 * Get all users with active Slack credentials (for bot initialization)
 */
export async function getAllActiveSlackUsers(
  supabase: SupabaseClient
): Promise<{
  users: Array<{ userId: string; credentials: SlackCredentials }>;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("user_channel_credentials")
    .select("user_id, credentials")
    .eq("channel_type", "slack")
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching active Slack users:", error);
    return { users: [], error: error.message };
  }

  return {
    users: (data || []).map((row) => ({
      userId: row.user_id,
      credentials: row.credentials as SlackCredentials,
    })),
    error: null,
  };
}
