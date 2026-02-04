import { SupabaseClient } from "@supabase/supabase-js";
import {
  Database,
  Json,
  AgentPersonality,
  UserPreferences,
  AgentIdentityContext,
  ChannelType,
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
  customInstructions: string | null;
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
    customInstructions: row.custom_instructions,
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
    customInstructions?: string | null;
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
  if (updates.customInstructions !== undefined)
    dbUpdates.custom_instructions = updates.customInstructions;

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
 * @param agent - The agent configuration
 * @param user - The user context (name, timezone, email)
 * @param channelSource - The channel source (app, email, linkedin, etc.) for channel-specific prompts
 */
export async function buildSystemPrompt(
  agent: Agent, 
  user?: { id?: string; name: string; timezone?: string; email?: string },
  channelSource?: ChannelType
): Promise<string> {
  const personality = agent.personality || {};
  const preferences = agent.userPreferences || {};
  const identity = agent.identityContext || {};
  const timezone = user?.timezone || identity.owner?.timezone || "America/New_York";

  const sections: string[] = [];

  // Current time context
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  });
  const currentTime = formatter.format(now);
  
  sections.push(`## Current Time & Date Context`);
  sections.push(`**Right now it is:** ${currentTime} (${timezone})`);
  sections.push(`**UTC ISO timestamp:** ${now.toISOString()}`);
  sections.push(`**Today's date:** ${formatter.format(now).split(' at ')[0]}\n`);

  // Generic AI Assistant role
  sections.push(`## Your Role`);
  sections.push(`You are ${agent.name || "an AI assistant"}, ${agent.title || "helping users with their questions and tasks"}.`);
  
  if (personality.background) {
    sections.push(`\n${personality.background}`);
  }
  
  sections.push(`\nYou have the following capabilities:`);
  sections.push(`- Natural conversation and Q&A`);
  sections.push(`- Web research (use the 'research' tool for current information)`);
  sections.push(`- Feedback collection (bugs and feature requests)`);
  sections.push(`\n**Customize this section for your specific application.**`);

  // User context
  const userName = user?.name || identity.owner?.name;
  if (userName) {
    sections.push(`\n## User Context`);
    sections.push(`You are assisting ${userName}.`);
    if (identity.owner?.company) {
      sections.push(`${userName} is the ${identity.owner.role || "user"} of ${identity.owner.company}.`);
    }
    const tz = user?.timezone || identity.owner?.timezone;
    if (tz) {
      sections.push(`Their timezone is ${tz}.`);
    }
    if (user?.email) {
      sections.push(`Their email address is: ${user.email}`);
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

  // Capabilities (if defined)
  if (identity.capabilities && identity.capabilities.length > 0) {
    sections.push(`\n## Additional Capabilities`);
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

  // Custom instructions (always included)
  if (agent.customInstructions) {
    sections.push(`\n## Custom Instructions`);
    sections.push(agent.customInstructions);
  }

  // Tool usage guidelines
  sections.push(`\n## Tool Usage`);
  sections.push(`You have access to the following tools:\n`);
  
  sections.push(`### Research Tool`);
  sections.push(`- Use the 'research' tool for current events, news, prices, or information not in your training data`);
  sections.push(`- Cite sources when using research results`);
  sections.push(`- Format URLs as markdown links: [descriptive text](url)\n`);
  
  sections.push(`### Feedback Tools`);
  sections.push(`- Use 'submitFeedback' to log bugs or feature requests`);
  sections.push(`- Use 'searchFeedback' to find existing feedback before creating duplicates`);
  sections.push(`- Use 'updateFeedbackItem' to update feedback status or details`);
  sections.push(`- Use 'deleteFeedbackItem' to remove feedback (suggest marking as "wont_fix" instead)\n`);
  
  sections.push(`**IMPORTANT: Always respond after tool calls**`);
  sections.push(`After using ANY tools, you MUST send a final message to the user summarizing what you did.`);
  sections.push(`When presenting feedback results, include clickable links:`);
  sections.push(`- Feature requests: [Title](/feedback/features?feedbackId={id})`);
  sections.push(`- Bug reports: [Title](/feedback/bugs?feedbackId={id})`);

  // Markdown formatting guidelines
  sections.push(`\n## Markdown Formatting`);
  sections.push(`Your responses are rendered with markdown. Follow these guidelines:\n`);
  sections.push(`**URL Links:**`);
  sections.push(`- ALWAYS format URLs as hyperlinks: [descriptive text](url)`);
  sections.push(`- NEVER paste raw URLs`);
  sections.push(`- For research sources, cite properly: "According to [Source Name](url), ..."\n`);
  sections.push(`**Other formatting:**`);
  sections.push(`- Use **bold** for emphasis`);
  sections.push(`- Use bullet points for lists`);
  sections.push(`- Use numbered lists for steps`);
  sections.push(`- Use > blockquotes for callouts`);
  sections.push(`- Use \`code blocks\` for technical terms`);

  return sections.join("\n");
}
