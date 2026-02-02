import { getAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// This endpoint is called by pg_cron to generate daily briefs
// It should be protected by a secret key in production
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // Verify the request is authorized (simple secret check for MVP)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getAdminClient();

    // Get all active agents
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("id, user_id, name")
      .limit(100); // Limit for MVP

    if (agentsError || !agents?.length) {
      console.log("No agents found for daily brief");
      return NextResponse.json({ message: "No agents found" });
    }

    const results: Array<{ agentId: string; success: boolean; error?: string }> = [];

    for (const agent of agents) {
      try {
        // Get agent's active conversation
        let conversationId: string | null = null;
        
        const { data: existingConv } = await supabase
          .from("conversations")
          .select("id")
          .eq("agent_id", agent.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          // Create conversation if none exists
          const { data: newConv } = await supabase
            .from("conversations")
            .insert({
              agent_id: agent.id,
              channel_type: "app",
              status: "active",
            })
            .select("id")
            .single();
          conversationId = newConv?.id ?? null;
        }

        if (!conversationId) {
          console.error(`Failed to get/create conversation for agent ${agent.id}`);
          continue;
        }

        // Get today's date info
        const today = new Date();
        const dateStr = today.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        // Get active projects
        const { data: projects } = await supabase
          .from("projects")
          .select("id, title, status, priority")
          .eq("agent_id", agent.id)
          .eq("status", "active");

        // Get pending tasks
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, priority, due_date, project_id")
          .eq("agent_id", agent.id)
          .in("status", ["pending", "in_progress"])
          .order("priority", { ascending: true })
          .order("due_date", { ascending: true });

        // Build the daily brief
        let briefContent = `Good morning! Here's your daily brief for ${dateStr}.\n\n`;

        // Calendar section (placeholder - future integration)
        briefContent += `**CALENDAR TODAY**\n`;
        briefContent += `Calendar integration coming soon. Your events will appear here once configured.\n\n`;

        // Projects section
        briefContent += `**ACTIVE PROJECTS (${projects?.length || 0})**\n`;
        if (projects && projects.length > 0) {
          for (const project of projects) {
            briefContent += `- ${project.title} (${project.priority} priority)\n`;
          }
        } else {
          briefContent += `No active projects.\n`;
        }
        briefContent += `\n`;

        // Tasks section
        briefContent += `**PENDING TASKS (${tasks?.length || 0})**\n`;
        if (tasks && tasks.length > 0) {
          // Group by priority
          const highPriority = tasks.filter((t) => t.priority === "high");
          const mediumPriority = tasks.filter((t) => t.priority === "medium");
          const lowPriority = tasks.filter((t) => t.priority === "low");

          if (highPriority.length > 0) {
            briefContent += `\n*High Priority:*\n`;
            for (const task of highPriority) {
              const dueStr = task.due_date
                ? ` (Due: ${new Date(task.due_date).toLocaleDateString()})`
                : "";
              briefContent += `- ${task.title}${dueStr}\n`;
            }
          }

          if (mediumPriority.length > 0) {
            briefContent += `\n*Medium Priority:*\n`;
            for (const task of mediumPriority.slice(0, 5)) {
              briefContent += `- ${task.title}\n`;
            }
            if (mediumPriority.length > 5) {
              briefContent += `  ...and ${mediumPriority.length - 5} more\n`;
            }
          }

          if (lowPriority.length > 0) {
            briefContent += `\n*Low Priority:*\n`;
            for (const task of lowPriority.slice(0, 3)) {
              briefContent += `- ${task.title}\n`;
            }
            if (lowPriority.length > 3) {
              briefContent += `  ...and ${lowPriority.length - 3} more\n`;
            }
          }
        } else {
          briefContent += `No pending tasks. Great job staying on top of things!\n`;
        }

        briefContent += `\n---\nAnything you'd like me to help you focus on today?`;

        // Insert the brief as a message
        const { error: msgError } = await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: briefContent,
          metadata: {
            type: "daily_brief",
            date: today.toISOString().split("T")[0],
          },
        });

        if (msgError) {
          console.error(`Failed to create brief for agent ${agent.id}:`, msgError);
          results.push({ agentId: agent.id, success: false, error: msgError.message });
        } else {
          results.push({ agentId: agent.id, success: true });
        }
      } catch (error) {
        console.error(`Error generating brief for agent ${agent.id}:`, error);
        results.push({
          agentId: agent.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: "Daily briefs generated",
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Daily brief cron error:", error);
    return NextResponse.json(
      { error: "Failed to generate daily briefs" },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing
export async function GET(request: Request) {
  return POST(request);
}
