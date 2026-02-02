import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { listScheduledJobs } from "@/lib/db/scheduled-jobs";
import { RemindersClient } from "./reminders-client";

export default async function RemindersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in to view reminders</div>;
  }

  const agent = await getAgentForUser(supabase, user.id);
  if (!agent) {
    return <div>No agent configured</div>;
  }

  // Fetch reminders from scheduled_jobs table
  const { jobs } = await listScheduledJobs(supabase, agent.id, {
    jobType: "reminder",
    status: "all",
  });

  return <RemindersClient initialReminders={jobs as any || []} agentId={agent.id} />;
}

