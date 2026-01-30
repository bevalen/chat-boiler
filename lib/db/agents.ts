import { SupabaseClient } from "@supabase/supabase-js";
import {
  Database,
  Json,
  AgentPersonality,
  UserPreferences,
  AgentIdentityContext,
} from "@/lib/types/database";

type AgentRow = Database["public"]["Tables"]["agents"]["Row"];
type AgentUpdate = Database["public"]["Tables"]["agents"]["Update"];

export interface Agent {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  title: string | null;
  avatarUrl: string | null;
  personality: AgentPersonality | null;
  userPreferences: UserPreferences | null;
  identityContext: AgentIdentityContext | null;
  createdAt: string | null;
}

function mapAgentRow(row: AgentRow): Agent {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    title: row.title,
    avatarUrl: row.avatar_url,
    personality: row.personality as AgentPersonality | null,
    userPreferences: row.user_preferences as UserPreferences | null,
    identityContext: row.identity_context as AgentIdentityContext | null,
    createdAt: row.created_at,
  };
}

/**
 * Get the agent for a user
 */
export async function getAgentForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<Agent | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    console.error("Error fetching agent:", error);
    return null;
  }

  return mapAgentRow(data);
}

/**
 * Get an agent by ID
 */
export async function getAgentById(
  supabase: SupabaseClient,
  agentId: string
): Promise<Agent | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (error || !data) {
    console.error("Error fetching agent:", error);
    return null;
  }

  return mapAgentRow(data);
}

/**
 * Update an agent's profile
 */
export async function updateAgent(
  supabase: SupabaseClient,
  agentId: string,
  updates: {
    name?: string;
    email?: string;
    title?: string;
    avatarUrl?: string;
    personality?: AgentPersonality;
    userPreferences?: UserPreferences;
    identityContext?: AgentIdentityContext;
  }
): Promise<Agent | null> {
  const dbUpdates: AgentUpdate = {};

  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
  if (updates.personality !== undefined)
    dbUpdates.personality = updates.personality as unknown as Json;
  if (updates.userPreferences !== undefined)
    dbUpdates.user_preferences = updates.userPreferences as unknown as Json;
  if (updates.identityContext !== undefined)
    dbUpdates.identity_context = updates.identityContext as unknown as Json;

  const { data, error } = await supabase
    .from("agents")
    .update(dbUpdates)
    .eq("id", agentId)
    .select()
    .single();

  if (error || !data) {
    console.error("Error updating agent:", error);
    return null;
  }

  return mapAgentRow(data);
}

/**
 * Build a system prompt from agent configuration
 */
export function buildSystemPrompt(agent: Agent, user?: { name: string; timezone?: string }): string {
  const personality = agent.personality || {};
  const preferences = agent.userPreferences || {};
  const identity = agent.identityContext || {};

  const sections: string[] = [];

  // Identity section
  sections.push(`You are ${agent.name}, ${agent.title || "an AI assistant"}.`);

  if (personality.background) {
    sections.push(personality.background);
  }

  // Owner/user context
  const ownerName = user?.name || identity.owner?.name;
  if (ownerName) {
    sections.push(`\n## Your Owner`);
    sections.push(`You work for ${ownerName}.`);
    if (identity.owner?.company) {
      sections.push(`${ownerName} is the ${identity.owner.role || "founder"} of ${identity.owner.company}.`);
    }
    const tz = user?.timezone || identity.owner?.timezone;
    if (tz) {
      sections.push(`Their timezone is ${tz}.`);
    }
  }

  // Personality traits
  if (personality.traits && personality.traits.length > 0) {
    sections.push(`\n## Your Personality`);
    sections.push(`- ${personality.traits.join(", ")}`);
    if (personality.style) {
      sections.push(`- Communication style: ${personality.style}`);
    }
    if (personality.tone) {
      sections.push(`- Tone: ${personality.tone}`);
    }
  }

  // Capabilities
  if (identity.capabilities && identity.capabilities.length > 0) {
    sections.push(`\n## Your Capabilities`);
    identity.capabilities.forEach((cap) => {
      sections.push(`- ${cap}`);
    });
  }

  // User preferences
  if (Object.keys(preferences).length > 0) {
    sections.push(`\n## Communication Guidelines`);
    if (preferences.response_style === "concise" || preferences.verbosity === "brief") {
      sections.push("- Keep responses concise and to the point");
    }
    if (preferences.use_bullet_points) {
      sections.push("- Use bullet points for lists and key information");
    }
    if (preferences.proactive_suggestions) {
      sections.push("- Proactively suggest next steps when appropriate");
    }
    if (preferences.confirm_before_actions) {
      sections.push("- Ask for confirmation before taking actions with external effects (like sending emails)");
    }
    if (preferences.preferred_communication) {
      sections.push(`- Be ${preferences.preferred_communication}`);
    }
  }

  return sections.join("\n");
}
