import { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/embeddings";

// Types for search results
export interface MessageSearchResult {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
  similarity: number;
}

export interface ContextBlockSearchResult {
  id: string;
  type: string;
  title: string | null;
  content: string;
  createdAt: string;
  similarity: number;
}

export interface ProjectSearchResult {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdAt: string;
  similarity: number;
}

export interface TaskSearchResult {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string | null;
  createdAt: string;
  similarity: number;
}

export interface ActionLogSearchResult {
  id: string;
  toolName: string;
  action: string;
  params: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  similarity: number;
}

export interface UnifiedSearchResult {
  sourceType: "message" | "context_block" | "project" | "task";
  sourceId: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  similarity: number;
}

/**
 * Search messages by semantic similarity
 */
export async function searchMessages(
  supabase: SupabaseClient,
  query: string,
  agentId: string,
  options: { matchCount?: number; matchThreshold?: number } = {}
): Promise<MessageSearchResult[]> {
  const { matchCount = 10, matchThreshold = 0.7 } = options;

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("search_messages", {
    query_embedding: queryEmbedding,
    p_agent_id: agentId,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    console.error("Error searching messages:", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    conversationId: row.conversation_id as string,
    role: row.role as string,
    content: row.content as string,
    createdAt: row.created_at as string,
    similarity: row.similarity as number,
  }));
}

/**
 * Search context blocks by semantic similarity
 */
export async function searchContextBlocks(
  supabase: SupabaseClient,
  query: string,
  agentId: string,
  options: { matchCount?: number; matchThreshold?: number } = {}
): Promise<ContextBlockSearchResult[]> {
  const { matchCount = 5, matchThreshold = 0.7 } = options;

  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("search_context_blocks", {
    query_embedding: queryEmbedding,
    p_agent_id: agentId,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    console.error("Error searching context blocks:", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    type: row.type as string,
    title: row.title as string | null,
    content: row.content as string,
    createdAt: row.created_at as string,
    similarity: row.similarity as number,
  }));
}

/**
 * Search projects by semantic similarity
 */
export async function searchProjects(
  supabase: SupabaseClient,
  query: string,
  agentId: string,
  options: { matchCount?: number; matchThreshold?: number } = {}
): Promise<ProjectSearchResult[]> {
  const { matchCount = 5, matchThreshold = 0.7 } = options;

  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("search_projects", {
    query_embedding: queryEmbedding,
    p_agent_id: agentId,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    console.error("Error searching projects:", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    description: row.description as string | null,
    status: row.status as string,
    priority: row.priority as string,
    createdAt: row.created_at as string,
    similarity: row.similarity as number,
  }));
}

/**
 * Search tasks by semantic similarity
 */
export async function searchTasks(
  supabase: SupabaseClient,
  query: string,
  agentId: string,
  options: { matchCount?: number; matchThreshold?: number } = {}
): Promise<TaskSearchResult[]> {
  const { matchCount = 10, matchThreshold = 0.7 } = options;

  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("search_tasks", {
    query_embedding: queryEmbedding,
    p_agent_id: agentId,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    console.error("Error searching tasks:", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    description: row.description as string | null,
    status: row.status as string,
    priority: row.priority as string,
    dueDate: row.due_date as string | null,
    projectId: row.project_id as string | null,
    createdAt: row.created_at as string,
    similarity: row.similarity as number,
  }));
}

/**
 * Search action log by semantic similarity
 */
export async function searchActionLog(
  supabase: SupabaseClient,
  query: string,
  agentId: string,
  options: { matchCount?: number; matchThreshold?: number } = {}
): Promise<ActionLogSearchResult[]> {
  const { matchCount = 10, matchThreshold = 0.6 } = options;

  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("search_action_log", {
    query_embedding: queryEmbedding,
    p_agent_id: agentId,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    console.error("Error searching action log:", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    toolName: row.tool_name as string,
    action: row.action as string,
    params: row.params as Record<string, unknown> | null,
    result: row.result as Record<string, unknown> | null,
    createdAt: row.created_at as string,
    similarity: row.similarity as number,
  }));
}

/**
 * Combined semantic search across all data types
 * This is the main function for RAG retrieval
 */
export async function semanticSearchAll(
  supabase: SupabaseClient,
  query: string,
  agentId: string,
  options: { matchCount?: number; matchThreshold?: number } = {}
): Promise<UnifiedSearchResult[]> {
  const { matchCount = 15, matchThreshold = 0.65 } = options;

  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("semantic_search_all", {
    query_embedding: queryEmbedding,
    p_agent_id: agentId,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    console.error("Error in semantic search:", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    sourceType: row.source_type as "message" | "context_block" | "project" | "task",
    sourceId: row.source_id as string,
    title: row.title as string,
    content: row.content as string,
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.created_at as string,
    similarity: row.similarity as number,
  }));
}

/**
 * Get relevant context for a conversation
 * Combines recent messages with semantic search results
 */
export async function getRelevantContext(
  supabase: SupabaseClient,
  query: string,
  agentId: string,
  conversationId: string,
  options: {
    recentMessageCount?: number;
    semanticMatchCount?: number;
    matchThreshold?: number;
  } = {}
): Promise<{
  recentMessages: { role: string; content: string; createdAt: string }[];
  semanticResults: UnifiedSearchResult[];
}> {
  const { recentMessageCount = 10, semanticMatchCount = 10, matchThreshold = 0.65 } = options;

  // Get recent messages from this conversation
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(recentMessageCount);

  // Get semantic search results
  const semanticResults = await semanticSearchAll(supabase, query, agentId, {
    matchCount: semanticMatchCount,
    matchThreshold,
  });

  // Filter out messages from the current conversation (to avoid duplication)
  const filteredSemanticResults = semanticResults.filter(
    (result) =>
      result.sourceType !== "message" ||
      (result.metadata as { conversation_id?: string })?.conversation_id !== conversationId
  );

  return {
    recentMessages: (recentMessages || [])
      .reverse()
      .map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
    semanticResults: filteredSemanticResults,
  };
}

/**
 * Context gathered for an email for agent processing
 */
export interface EmailContext {
  email: {
    id: string;
    from_address: string;
    from_name: string | null;
    subject: string | null;
    text_body: string | null;
    html_body: string | null;
    in_reply_to: string | null;
    thread_id: string | null;
    received_at: string | null;
  };
  relatedProjects: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string | null;
    similarity: number;
  }>;
  relatedTasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string | null;
    similarity: number;
  }>;
  threadHistory: Array<{
    id: string;
    from_address: string;
    subject: string | null;
    text_body: string | null;
    direction: string;
    created_at: string | null;
  }>;
  relatedConversations: Array<{
    id: string;
    title: string | null;
    channel_type: string | null;
    recentMessage: string | null;
  }>;
  semanticContext: string;
}

/**
 * Gather comprehensive context for an incoming email
 * Includes thread history, related projects/tasks, past conversations, and semantic search
 */
export async function gatherContextForEmail(
  supabase: SupabaseClient,
  agentId: string,
  emailId: string,
  options: { matchCount?: number; matchThreshold?: number } = {}
): Promise<EmailContext | null> {
  const { matchCount = 15, matchThreshold = 0.6 } = options;

  try {
    // 1. Get email details
    const { data: email, error: emailError } = await supabase
      .from("emails")
      .select("id, from_address, from_name, subject, text_body, html_body, in_reply_to, thread_id, received_at")
      .eq("id", emailId)
      .single();

    if (emailError || !email) {
      console.error("[search] Error fetching email:", emailError);
      return null;
    }

    // 2. Get email thread history (previous emails in this conversation)
    const threadHistory: EmailContext["threadHistory"] = [];
    if (email.thread_id || email.in_reply_to) {
      const { data: threadEmails } = await supabase
        .from("emails")
        .select("id, from_address, subject, text_body, direction, created_at")
        .eq("agent_id", agentId)
        .or(
          email.thread_id
            ? `thread_id.eq.${email.thread_id}`
            : `message_id.eq.${email.in_reply_to},in_reply_to.eq.${email.in_reply_to}`
        )
        .neq("id", emailId)
        .order("created_at", { ascending: true })
        .limit(10);

      if (threadEmails) {
        threadHistory.push(...threadEmails);
      }
    }

    // 3. Search for related projects and tasks
    const emailContent = `${email.subject || ""}\n${email.text_body || email.html_body || ""}`;
    
    const [projectResults, taskResults, semanticResults] = await Promise.all([
      searchProjects(supabase, emailContent, agentId, {
        matchCount: 5,
        matchThreshold,
      }),
      searchTasks(supabase, emailContent, agentId, {
        matchCount: 5,
        matchThreshold,
      }),
      semanticSearchAll(supabase, emailContent, agentId, {
        matchCount,
        matchThreshold,
      }),
    ]);

    // 4. Find related conversations (from past messages)
    const conversationIds = new Set(
      semanticResults
        .filter((r) => r.sourceType === "message" && r.metadata.conversation_id)
        .map((r) => (r.metadata as { conversation_id: string }).conversation_id)
    );

    const relatedConversations: EmailContext["relatedConversations"] = [];
    if (conversationIds.size > 0) {
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, title, channel_type")
        .in("id", Array.from(conversationIds))
        .limit(5);

      if (conversations) {
        for (const conv of conversations) {
          const { data: recentMsg } = await supabase
            .from("messages")
            .select("content")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          relatedConversations.push({
            id: conv.id,
            title: conv.title,
            channel_type: conv.channel_type,
            recentMessage: recentMsg?.content || null,
          });
        }
      }
    }

    // 5. Format semantic context
    const semanticContext = formatContextForAI(semanticResults);

    return {
      email,
      relatedProjects: projectResults.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        similarity: p.similarity,
      })),
      relatedTasks: taskResults.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        similarity: t.similarity,
      })),
      threadHistory,
      relatedConversations,
      semanticContext,
    };
  } catch (error) {
    console.error("[search] Error gathering context for email:", error);
    return null;
  }
}

/**
 * Format semantic search results for inclusion in AI context
 */
export function formatContextForAI(results: UnifiedSearchResult[]): string {
  if (results.length === 0) return "";

  const sections: string[] = ["## Relevant Context from Memory"];

  // Group by source type
  const messages = results.filter((r) => r.sourceType === "message");
  const projects = results.filter((r) => r.sourceType === "project");
  const tasks = results.filter((r) => r.sourceType === "task");
  const contextBlocks = results.filter((r) => r.sourceType === "context_block");

  if (projects.length > 0) {
    sections.push("\n### Related Projects:");
    projects.forEach((p) => {
      const meta = p.metadata as { status?: string; priority?: string };
      sections.push(`- **${p.title}** (${meta.status}, ${meta.priority} priority)`);
      if (p.content !== p.title) {
        sections.push(`  ${p.content.substring(0, 200)}${p.content.length > 200 ? "..." : ""}`);
      }
    });
  }

  if (tasks.length > 0) {
    sections.push("\n### Related Tasks:");
    tasks.forEach((t) => {
      const meta = t.metadata as { status?: string; priority?: string; due_date?: string };
      const dueInfo = meta.due_date ? ` (due: ${new Date(meta.due_date).toLocaleDateString()})` : "";
      sections.push(`- **${t.title}** [${meta.status}]${dueInfo}`);
    });
  }

  if (messages.length > 0) {
    sections.push("\n### Related Past Conversations:");
    messages.slice(0, 5).forEach((m) => {
      const meta = m.metadata as { role?: string };
      const preview = m.content.substring(0, 150);
      sections.push(`- [${meta.role}]: ${preview}${m.content.length > 150 ? "..." : ""}`);
    });
  }

  if (contextBlocks.length > 0) {
    sections.push("\n### Context Notes:");
    contextBlocks.forEach((cb) => {
      sections.push(`- **${cb.title}**: ${cb.content.substring(0, 200)}${cb.content.length > 200 ? "..." : ""}`);
    });
  }

  return sections.join("\n");
}

/**
 * Context gathered for a task for background agent processing
 */
export interface TaskContext {
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string | null;
    priority: string | null;
    due_date: string | null;
    project_id: string | null;
    agent_run_state: string | null;
    blocked_by: string[] | null;
  };
  project: {
    id: string;
    title: string;
    description: string | null;
    status: string | null;
  } | null;
  comments: Array<{
    id: string;
    author_type: string;
    content: string;
    comment_type: string | null;
    created_at: string | null;
  }>;
  blockingTasks: Array<{
    id: string;
    title: string;
    status: string | null;
  }>;
  relatedContext: string;
  scheduledJobs: Array<{
    id: string;
    title: string;
    next_run_at: string | null;
  }>;
}

/**
 * Gather all relevant context for a task for background agent processing
 * This includes: task details, project, comments, blocking tasks, semantic search, and scheduled jobs
 */
export async function gatherContextForTask(
  supabase: SupabaseClient,
  agentId: string,
  taskId: string
): Promise<TaskContext | null> {
  try {
    // 1. Get task details
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, project_id, agent_run_state, blocked_by")
      .eq("id", taskId)
      .eq("agent_id", agentId)
      .single();

    if (taskError || !task) {
      console.error("[search] Error fetching task:", taskError);
      return null;
    }

    // 2. Get project if linked
    let project: TaskContext["project"] = null;
    if (task.project_id) {
      const { data: projectData } = await supabase
        .from("projects")
        .select("id, title, description, status")
        .eq("id", task.project_id)
        .single();

      if (projectData) {
        project = projectData;
      }
    }

    // 3. Get all comments on this task (oldest first for context)
    const { data: comments } = await supabase
      .from("comments")
      .select("id, author_type, content, comment_type, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(50);

    // 4. Get blocking tasks
    const blockingTasks: TaskContext["blockingTasks"] = [];
    if (task.blocked_by && task.blocked_by.length > 0) {
      const { data: blockers } = await supabase
        .from("tasks")
        .select("id, title, status")
        .in("id", task.blocked_by);

      if (blockers) {
        blockingTasks.push(...blockers);
      }
    }

    // 5. Semantic search for related context
    const searchQuery = task.description
      ? `${task.title}\n${task.description}`
      : task.title;

    const semanticResults = await semanticSearchAll(supabase, searchQuery, agentId, {
      matchCount: 10,
      matchThreshold: 0.6,
    });

    // Filter out the current task from results
    const filteredResults = semanticResults.filter(
      (r) => !(r.sourceType === "task" && r.sourceId === taskId)
    );

    const relatedContext = formatContextForAI(filteredResults);

    // 6. Get scheduled jobs related to this task
    const { data: scheduledJobs } = await supabase
      .from("scheduled_jobs")
      .select("id, title, next_run_at")
      .eq("task_id", taskId)
      .eq("status", "active")
      .order("next_run_at", { ascending: true })
      .limit(5);

    return {
      task,
      project,
      comments: comments || [],
      blockingTasks,
      relatedContext,
      scheduledJobs: scheduledJobs || [],
    };
  } catch (error) {
    console.error("[search] Error gathering context for task:", error);
    return null;
  }
}

/**
 * Find tasks that match an email based on semantic similarity
 * Returns tasks that are potentially related to the email content
 */
export async function findTasksForEmail(
  supabase: SupabaseClient,
  agentId: string,
  emailContent: string,
  options: { matchCount?: number; matchThreshold?: number } = {}
): Promise<Array<{ id: string; title: string; status: string | null; similarity: number }>> {
  const { matchCount = 5, matchThreshold = 0.65 } = options;

  try {
    const results = await searchTasks(supabase, emailContent, agentId, {
      matchCount,
      matchThreshold,
    });

    return results.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      similarity: r.similarity,
    }));
  } catch (error) {
    console.error("[search] Error finding tasks for email:", error);
    return [];
  }
}
