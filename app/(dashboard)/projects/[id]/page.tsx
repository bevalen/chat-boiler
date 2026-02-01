import { createClient } from "@/lib/supabase/server";
import { ProjectDetail } from "@/components/projects/project-detail";
import { notFound } from "next/navigation";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
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

  // Get project
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("agent_id", agent.id)
    .single();

  if (!project) {
    notFound();
  }

  // Get tasks for this project
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, projects(id, title)")
    .eq("project_id", id)
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  // Get all projects for task editing (to allow reassigning)
  const { data: allProjects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("agent_id", agent.id)
    .order("title", { ascending: true });

  const assignees = [
    { id: user.id, name: "You", type: "user" as const },
    { id: agent.id, name: "AI Agent", type: "agent" as const },
  ];

  return (
    <ProjectDetail
      project={project}
      tasks={tasks || []}
      allProjects={allProjects || []}
      assignees={assignees}
      agentId={agent.id}
    />
  );
}
