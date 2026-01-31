import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { getActivityLog, getActivityStats, ActivityType, ActivitySource } from "@/lib/db/activity-log";

export async function GET(request: Request) {
  try {
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
      return new Response(
        JSON.stringify({ activities: [], total: 0, stats: null }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse query params
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const activityType = url.searchParams.get("type") as ActivityType | null;
    const source = url.searchParams.get("source") as ActivitySource | null;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;
    const includeStats = url.searchParams.get("stats") === "true";

    const [logResult, statsResult] = await Promise.all([
      getActivityLog(supabase, agent.id, {
        limit,
        offset,
        activityType: activityType || undefined,
        source: source || undefined,
        startDate,
        endDate,
      }),
      includeStats ? getActivityStats(supabase, agent.id, 7) : Promise.resolve(null),
    ]);

    if (logResult.error) {
      return new Response(
        JSON.stringify({ error: logResult.error }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        activities: logResult.activities,
        total: logResult.total,
        stats: statsResult,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[activity] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
