import { createClient } from "@/lib/supabase/server";
import { ProjectsList } from "@/components/projects/projects-list";

export default async function ProjectsPage() {
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

  // Get projects
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  return <ProjectsList projects={projects || []} agentId={agent.id} />;
}
