import { createClient } from "@/lib/supabase/server";
import { TasksList } from "@/components/tasks/tasks-list";

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get user's agent
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">
          No agent found. Please run the seed script.
        </p>
      </div>
    );
  }

  // Get tasks with project info
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, projects(title)")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  // Get projects for the dropdown
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("agent_id", agent.id)
    .eq("status", "active");

  return (
    <TasksList
      tasks={tasks || []}
      projects={projects || []}
      agentId={agent.id}
    />
  );
}
