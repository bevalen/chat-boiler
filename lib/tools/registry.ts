/**
 * Central tool registry for the AI agent
 * Initializes and exports all tools with proper context
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemoryTools } from "./memory-tools";
import { createProjectTools } from "./project-tools";
import { createTaskTools } from "./task-tools";
import { createCommentTools } from "./comment-tools";
import { createSchedulingTools } from "./scheduling-tools";
import { createFeedbackTools } from "./feedback-tools";
import {
  createCheckEmailTool,
  createSendEmailTool,
  createReplyToEmailTool,
  createForwardEmailTool,
  createMarkEmailAsReadTool,
  createGetEmailDetailsTool,
  createGetEmailThreadTool,
} from "./email-resend";
import { createResearchTool } from "./research";

export interface ToolRegistryContext {
  agentId: string;
  userId: string;
  supabase: SupabaseClient<any>;
  conversationId: string;
  // Agent and user profile info for email tools
  agentName: string;
  userName: string;
  userEmail?: string;
  userTitle?: string;
  userCompany?: string;
  userTimezone?: string;
  preferredNotificationChannel?: string;
}

/**
 * Create the complete tool registry with all available tools
 */
export function createToolRegistry(context: ToolRegistryContext) {
  const {
    agentId,
    userId,
    supabase,
    conversationId,
    agentName,
    userName,
    userEmail,
    userTitle,
    userCompany,
    userTimezone,
    preferredNotificationChannel,
  } = context;

  // Memory and conversation tools
  const memoryTools = createMemoryTools({ agentId, supabase });

  // Project management tools
  const projectTools = createProjectTools({ agentId, supabase });

  // Task management tools
  const taskTools = createTaskTools({ agentId, supabase });

  // Comment tools
  const commentTools = createCommentTools({ agentId, supabase });

  // Scheduling tools (reminders, agent tasks, follow-ups)
  const schedulingTools = createSchedulingTools({
    agentId,
    supabase,
    userTimezone,
    preferredNotificationChannel,
  });

  // Feedback tools
  const feedbackTools = createFeedbackTools({
    agentId,
    supabase,
    conversationId,
  });

  // Email tools (Resend-based)
  const emailTools = {
    checkEmail: createCheckEmailTool(agentId),
    sendEmail: createSendEmailTool(
      agentId,
      userId,
      agentName,
      userName,
      userEmail,
      userTitle,
      userCompany
    ),
    replyToEmail: createReplyToEmailTool(
      agentId,
      userId,
      agentName,
      userName,
      userEmail,
      userTitle,
      userCompany
    ),
    forwardEmail: createForwardEmailTool(
      agentId,
      userId,
      agentName,
      userName,
      userEmail,
      userTitle,
      userCompany
    ),
    markEmailAsRead: createMarkEmailAsReadTool(agentId),
    getEmailDetails: createGetEmailDetailsTool(agentId),
    getEmailThread: createGetEmailThreadTool(agentId),
  };

  // Research tool (Perplexity API)
  const researchTool = createResearchTool(agentId);

  // Combine all tools into a single registry
  return {
    // Memory
    ...memoryTools,
    // Projects
    ...projectTools,
    // Tasks
    ...taskTools,
    // Comments
    ...commentTools,
    // Scheduling
    ...schedulingTools,
    // Feedback
    ...feedbackTools,
    // Email
    ...emailTools,
    // Research
    research: researchTool,
  };
}

/**
 * Export type for the tool registry
 */
export type ToolRegistry = ReturnType<typeof createToolRegistry>;
