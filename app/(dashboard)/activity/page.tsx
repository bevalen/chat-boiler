import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { getActivityLog, getActivityStats } from "@/lib/db/activity-log";
import { ActivityClient } from "./activity-client";

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in to view activity</div>;
  }

  const agent = await getAgentForUser(supabase, user.id);
  if (!agent) {
    return <div>No agent configured</div>;
  }

  // Fetch initial activity
  const [logResult, statsResult] = await Promise.all([
    getActivityLog(supabase, agent.id, { limit: 50 }),
    getActivityStats(supabase, agent.id, 7),
  ]);

  return (
    <ActivityClient
      initialActivities={logResult.activities}
      initialTotal={logResult.total}
      initialStats={statsResult}
      agentId={agent.id}
    />
  );
}
