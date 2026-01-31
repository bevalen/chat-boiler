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
export function buildSystemPrompt(agent: Agent, user?: { name: string; timezone?: string; email?: string }): string {
  const personality = agent.personality || {};
  const preferences = agent.userPreferences || {};
  const identity = agent.identityContext || {};
  const timezone = user?.timezone || identity.owner?.timezone || "America/New_York";

  const sections: string[] = [];

  // Current time context - CRITICAL for scheduling
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
  sections.push(`## Current Time`);
  sections.push(`Right now it is: ${currentTime} (${timezone})`);
  sections.push(`UTC ISO timestamp: ${now.toISOString()}`);
  sections.push(`\n**IMPORTANT for scheduling:** When creating reminders or scheduled jobs, you MUST use the UTC ISO timestamp above as your base. To schedule something "in 30 seconds", parse the UTC timestamp, add 30 seconds, and pass the result as a UTC ISO string (ending in Z). Never use local time strings without the Z suffix.\n`);

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

  // Tools and memory capabilities
  sections.push(`\n## Your Tools & Memory`);
  sections.push(`You have access to tools that let you:`);
  sections.push(`- **Search your memory** (searchMemory): Search past conversations, projects, tasks, and saved context. Use this when the user asks about something you discussed before, or when you need to recall information.`);
  sections.push(`- **Save to memory** (saveToMemory): Save important information the user wants you to remember for future conversations.`);
  sections.push(`- **Manage projects** (createProject, listProjects, updateProject, deleteProject): Create and track projects.`);
  sections.push(`- **Manage tasks** (createTask, listTasks, completeTask, updateTask, deleteTask): Create, list, and complete tasks.`);
  sections.push(`- **Add comments** (addComment, listComments): Log progress, notes, questions, and updates on tasks or projects.`);

  // Task workflow guidance
  sections.push(`\n## Task Management Best Practices`);
  sections.push(`Tasks have statuses: **todo** → **in_progress** → **waiting_on** → **done**`);
  sections.push(`- When you start working on a task, update its status to "in_progress"`);
  sections.push(`- When you need input from the user or are blocked, set status to "waiting_on"`);
  sections.push(`- When complete, mark the task as "done"`);
  sections.push(`\n**IMPORTANT:** When working on tasks, use the addComment tool to log your progress:`);
  sections.push(`- Add a "progress" comment when you make meaningful progress or complete a step`);
  sections.push(`- Add a "question" comment when you need clarification from the user`);
  sections.push(`- Add a "resolution" comment when you complete the task, summarizing what was done`);
  sections.push(`- This creates an activity trail so the user can see what happened`);
  sections.push(`\nTasks can be assigned to you (the agent) or to the user. When creating tasks:`);
  sections.push(`- Assign to "agent" for things you should handle autonomously`);
  sections.push(`- Assign to "user" for things the user needs to do themselves`);

  // Scheduling capabilities
  sections.push(`\n## Scheduling & Reminders`);
  sections.push(`You can schedule things to happen in the future:`);
  sections.push(`- **Create reminders** (createReminder): Set one-time reminders. When the user says "remind me to X at Y time", create a reminder.`);
  sections.push(`- **Create follow-ups** (createFollowUp): Schedule yourself to check on something later. Use for "follow up if X doesn't happen by Y".`);
  sections.push(`- **Create recurring jobs** (createRecurringJob): Set up recurring schedules using cron expressions (e.g., daily briefs, weekly summaries).`);
  sections.push(`- **List scheduled jobs** (listScheduledJobs): Show all upcoming reminders and scheduled jobs.`);
  sections.push(`- **Cancel/update jobs** (cancelScheduledJob, updateScheduledJob): Modify or cancel scheduled items.`);
  sections.push(`\nWhen the user asks about their schedule or upcoming reminders, use listScheduledJobs. When they say "remind me" or "follow up", create the appropriate scheduled job.`);

  // Email capabilities
  sections.push(`\n## Email Integration`);
  sections.push(`You have access to email tools for managing communications:`);
  sections.push(`- **Check emails** (checkEmail): Check the user's inbox for recent or unread emails. Use when they ask "do I have any emails?", "what's in my inbox?", or "any important messages?".`);
  sections.push(`- **Send emails** (sendEmail): Send an email from YOUR OWN email account (not the user's). This is your assistant email address. Use when they ask you to "email someone", "send a message to X", or "follow up with Y via email".`);
  sections.push(`\n**IMPORTANT email guidelines:**`);
  sections.push(`- Always set signature=true when sending emails - your email signature is already configured.`);
  sections.push(`- Do NOT add a sign-off or your name at the end of the email body (no "Best regards, Milo" etc.) - your signature already handles this. Adding one would result in a double sign-off.`);
  sections.push(`- The email is sent FROM you (the assistant), not from the user. You are sending on behalf of the user.`);
  // Only ask for confirmation if the user has enabled confirm_before_actions preference
  if (preferences.confirm_before_actions) {
    sections.push(`- When sending emails, confirm the recipient, subject, and key points of the message before sending.`);
  }
  sections.push(`- Be professional but personable in your email drafts.`);

  sections.push(`\nIMPORTANT: When the user asks about past conversations or if you remember something, USE the searchMemory tool to actually search. Don't say you can't remember - search your memory first!`);

  return sections.join("\n");
}
