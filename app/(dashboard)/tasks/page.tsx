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

  // Get user profile
  const { data: userProfile } = await supabase
    .from("users")
    .select("name, avatar_url")
    .eq("id", user.id)
    .single();

  // Get user's agent
  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, avatar_url")
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

  // Get tasks with project info and comment counts
  const { data: tasks } = await supabase
    .from("tasks")
    .select(`
      *,
      projects(title),
      task_comments(count)
    `)
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  // Get projects for the dropdown
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("agent_id", agent.id)
    .eq("status", "active");

  const assignees = [
    { 
      id: user.id, 
      name: userProfile?.name || user.email?.split('@')[0] || "User", 
      type: "user" as const,
      avatar_url: userProfile?.avatar_url
    },
    { 
      id: agent.id, 
      name: agent.name, 
      type: "agent" as const, 
      avatar_url: agent.avatar_url 
    },
  ];

  return (
    <TasksList
      tasks={tasks || []}
      projects={projects || []}
      assignees={assignees}
      agentId={agent.id}
    />
  );
}
