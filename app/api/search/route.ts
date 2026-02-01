import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";

interface SearchResult {
  id: string;
  type:
    | "conversation"
    | "task"
    | "project"
    | "feedback"
    | "message"
    | "notification"
    | "lead"
    | "reminder";
  title: string;
  description?: string;
  metadata: {
    status?: string;
    priority?: string;
    date?: string;
    channelType?: string;
    type?: string;
    role?: string;
    conversationId?: string;
  };
  url: string;
  score: number;
}

// Escape special characters for PostgreSQL's to_tsquery
function escapeForTsQuery(query: string): string {
  // Remove special characters and split into words
  const words = query
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) return "";

  // Join with & for AND matching, add :* for prefix matching
  return words.map((word) => `${word}:*`).join(" & ");
}

// Build ILIKE pattern for fuzzy matching
function buildIlikePattern(query: string): string {
  return `%${query.replace(/[%_]/g, "\\$&")}%`;
}

export async function POST(request: Request) {
  try {
    const { query, limit = 20 } = await request.json();

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const agent = await getAgentForUser(supabase, user.id);
    if (!agent) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const trimmedQuery = query.trim();
    const ilikePattern = buildIlikePattern(trimmedQuery);
    const tsQuery = escapeForTsQuery(trimmedQuery);

    const results: SearchResult[] = [];
    const perCategoryLimit = Math.min(Math.ceil(limit / 6), 10);

    // Parallel search across all entity types
    const [
      conversationsResult,
      tasksResult,
      projectsResult,
      feedbackResult,
      messagesResult,
      notificationsResult,
      remindersResult,
      leadsResult,
    ] = await Promise.all([
      // Search conversations by title
      supabase
        .from("conversations")
        .select("id, title, channel_type, created_at, updated_at")
        .eq("agent_id", agent.id)
        .not("title", "is", null)
        .ilike("title", ilikePattern)
        .order("updated_at", { ascending: false })
        .limit(perCategoryLimit),

      // Search tasks by title and description
      supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_date, created_at")
        .eq("agent_id", agent.id)
        .or(`title.ilike.${ilikePattern},description.ilike.${ilikePattern}`)
        .order("created_at", { ascending: false })
        .limit(perCategoryLimit),

      // Search projects by title and description
      supabase
        .from("projects")
        .select("id, title, description, status, priority, created_at")
        .eq("agent_id", agent.id)
        .or(`title.ilike.${ilikePattern},description.ilike.${ilikePattern}`)
        .order("created_at", { ascending: false })
        .limit(perCategoryLimit),

      // Search feedback items by title, description, problem
      supabase
        .from("feedback_items")
        .select("id, title, description, problem, type, status, priority, created_at")
        .eq("agent_id", agent.id)
        .or(
          `title.ilike.${ilikePattern},description.ilike.${ilikePattern},problem.ilike.${ilikePattern}`
        )
        .order("created_at", { ascending: false })
        .limit(perCategoryLimit),

      // Search messages by content (limited to recent messages for performance)
      supabase
        .from("messages")
        .select("id, content, role, conversation_id, created_at")
        .eq("role", "assistant")
        .ilike("content", ilikePattern)
        .order("created_at", { ascending: false })
        .limit(perCategoryLimit),

      // Search notifications by title and content
      supabase
        .from("notifications")
        .select("id, title, content, type, read, link_type, link_id, created_at")
        .eq("agent_id", agent.id)
        .or(`title.ilike.${ilikePattern},content.ilike.${ilikePattern}`)
        .order("created_at", { ascending: false })
        .limit(perCategoryLimit),

      // Search scheduled jobs (reminders) by title and description
      supabase
        .from("scheduled_jobs")
        .select("id, title, description, job_type, status, next_run_at, created_at")
        .eq("agent_id", agent.id)
        .in("status", ["active", "paused"])
        .or(`title.ilike.${ilikePattern},description.ilike.${ilikePattern}`)
        .order("next_run_at", { ascending: true })
        .limit(perCategoryLimit),

      // Search LinkedIn leads by name, company, title
      supabase
        .from("linkedin_leads")
        .select("id, name, company, title, status, created_at")
        .eq("agent_id", agent.id)
        .or(
          `name.ilike.${ilikePattern},company.ilike.${ilikePattern},title.ilike.${ilikePattern}`
        )
        .order("created_at", { ascending: false })
        .limit(perCategoryLimit),
    ]);

    // Process conversations
    if (conversationsResult.data) {
      for (const conv of conversationsResult.data) {
        results.push({
          id: conv.id,
          type: "conversation",
          title: conv.title || "Untitled Conversation",
          metadata: {
            channelType: conv.channel_type,
            date: conv.updated_at || conv.created_at,
          },
          url: `/?conversation=${conv.id}`,
          score: 1,
        });
      }
    }

    // Process tasks
    if (tasksResult.data) {
      for (const task of tasksResult.data) {
        results.push({
          id: task.id,
          type: "task",
          title: task.title,
          description: task.description
            ? task.description.substring(0, 100)
            : undefined,
          metadata: {
            status: task.status,
            priority: task.priority,
            date: task.due_date || task.created_at,
          },
          url: `/tasks?task=${task.id}`,
          score: 1,
        });
      }
    }

    // Process projects
    if (projectsResult.data) {
      for (const project of projectsResult.data) {
        results.push({
          id: project.id,
          type: "project",
          title: project.title,
          description: project.description
            ? project.description.substring(0, 100)
            : undefined,
          metadata: {
            status: project.status,
            priority: project.priority,
            date: project.created_at,
          },
          url: `/projects/${project.id}`,
          score: 1,
        });
      }
    }

    // Process feedback items
    if (feedbackResult.data) {
      for (const item of feedbackResult.data) {
        results.push({
          id: item.id,
          type: "feedback",
          title: item.title,
          description: item.description
            ? item.description.substring(0, 100)
            : item.problem
            ? item.problem.substring(0, 100)
            : undefined,
          metadata: {
            type: item.type,
            status: item.status,
            priority: item.priority,
            date: item.created_at,
          },
          url:
            item.type === "bug_report"
              ? `/feedback/bugs`
              : `/feedback/features`,
          score: 1,
        });
      }
    }

    // Process messages (link to their conversation)
    if (messagesResult.data) {
      for (const message of messagesResult.data) {
        // Truncate and clean up the content for display
        const contentPreview = message.content
          .substring(0, 150)
          .replace(/\n/g, " ")
          .trim();
        results.push({
          id: message.id,
          type: "message",
          title: contentPreview,
          metadata: {
            role: message.role,
            conversationId: message.conversation_id,
            date: message.created_at,
          },
          url: `/?conversation=${message.conversation_id}`,
          score: 0.8,
        });
      }
    }

    // Process notifications
    if (notificationsResult.data) {
      for (const notif of notificationsResult.data) {
        let url = "/notifications";
        if (notif.link_type && notif.link_id) {
          switch (notif.link_type) {
            case "conversation":
              url = `/?conversation=${notif.link_id}`;
              break;
            case "task":
              url = `/tasks?task=${notif.link_id}`;
              break;
            case "project":
              url = `/projects/${notif.link_id}`;
              break;
          }
        }

        results.push({
          id: notif.id,
          type: "notification",
          title: notif.title,
          description: notif.content
            ? notif.content.substring(0, 100)
            : undefined,
          metadata: {
            type: notif.type,
            status: notif.read ? "read" : "unread",
            date: notif.created_at,
          },
          url,
          score: 0.7,
        });
      }
    }

    // Process scheduled jobs (reminders)
    if (remindersResult.data) {
      for (const job of remindersResult.data) {
        results.push({
          id: job.id,
          type: "reminder",
          title: job.title,
          description: job.description
            ? job.description.substring(0, 100)
            : undefined,
          metadata: {
            type: job.job_type,
            status: job.status,
            date: job.next_run_at || job.created_at,
          },
          url:
            job.job_type === "reminder" ? "/reminders" : "/schedules",
          score: 0.7,
        });
      }
    }

    // Process LinkedIn leads
    if (leadsResult.data) {
      for (const lead of leadsResult.data) {
        results.push({
          id: lead.id,
          type: "lead",
          title: lead.name,
          description: [lead.title, lead.company].filter(Boolean).join(" at "),
          metadata: {
            status: lead.status,
            date: lead.created_at,
          },
          url: "/", // LinkedIn leads don't have a dedicated page yet
          score: 0.6,
        });
      }
    }

    // Sort by score (descending), then by type priority
    const typePriority: Record<SearchResult["type"], number> = {
      conversation: 1,
      task: 2,
      project: 3,
      feedback: 4,
      message: 5,
      notification: 6,
      reminder: 7,
      lead: 8,
    };

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return typePriority[a.type] - typePriority[b.type];
    });

    // Limit total results
    const limitedResults = results.slice(0, limit);

    return new Response(JSON.stringify({ results: limitedResults }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[search] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
