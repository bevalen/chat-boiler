"use client";

import { useState } from "react";
import { Plus, FolderKanban, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ProjectsListProps {
  projects: Project[];
  agentId: string;
}

export function ProjectsList({ projects: initialProjects, agentId }: ProjectsListProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    priority: "medium",
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!newProject.title.trim()) return;
    setIsLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        agent_id: agentId,
        title: newProject.title,
        description: newProject.description || null,
        priority: newProject.priority,
        status: "active",
      })
      .select()
      .single();

    if (!error && data) {
      setProjects([data, ...projects]);
      setNewProject({ title: "", description: "", priority: "medium" });
      setIsCreateOpen(false);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("projects").delete().eq("id", id);

    if (!error) {
      setProjects(projects.filter((p) => p.id !== id));
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ status })
      .eq("id", id);

    if (!error) {
      setProjects(
        projects.map((p) => (p.id === id ? { ...p, status } : p))
      );
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "low":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "active":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "paused":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "completed":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Manage your projects and initiatives
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Add a new project to track your work.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newProject.title}
                  onChange={(e) =>
                    setNewProject({ ...newProject, title: e.target.value })
                  }
                  placeholder="Project title"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject({ ...newProject, description: e.target.value })
                  }
                  placeholder="Brief description of the project"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  value={newProject.priority}
                  onChange={(e) =>
                    setNewProject({ ...newProject, priority: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create your first project to start tracking your work.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{project.title}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(project.id, "active")}
                      >
                        Mark Active
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(project.id, "paused")}
                      >
                        Mark Paused
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(project.id, "completed")}
                      >
                        Mark Completed
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(project.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {project.description && (
                  <CardDescription className="line-clamp-2">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="outline" className={getStatusColor(project.status)}>
                    {project.status}
                  </Badge>
                  <Badge variant="outline" className={getPriorityColor(project.priority)}>
                    {project.priority} priority
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
