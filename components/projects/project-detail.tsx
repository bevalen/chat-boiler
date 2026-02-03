"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TaskDialog, Task, Project, Assignee } from "@/components/shared/task-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useProjectActivity } from "@/hooks/use-project-activity";
import { useProjectComments } from "@/hooks/use-project-comments";
import { useCreateTask } from "@/hooks/use-create-task";
import { ProjectDetailHeader } from "./project-detail-header";
import { ProjectDetailDescription } from "./project-detail-description";
import { ProjectDetailTasks } from "./project-detail-tasks";
import { ProjectDetailActivity } from "./project-detail-activity";

interface FullProject {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ProjectDetailProps {
  project: FullProject;
  tasks: Task[];
  allProjects: Project[];
  assignees?: Assignee[];
  agentId: string;
  agentName?: string;
  agentAvatarUrl?: string | null;
}

export function ProjectDetail({
  project: initialProject,
  tasks: initialTasks,
  allProjects,
  assignees = [],
  agentId,
  agentName = "AI Agent",
  agentAvatarUrl,
}: ProjectDetailProps) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [tasks, setTasks] = useState(initialTasks);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editedProject, setEditedProject] = useState({
    title: project.title,
    description: project.description || "",
    priority: project.priority || "medium",
    status: project.status || "active",
  });

  // Task dialog state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  // Delete confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Activity hooks
  const { activityItems, setActivityItems, scrollAreaRef } = useProjectActivity(project.id);
  const { newComment, setNewComment, handleAddComment } = useProjectComments(
    project.id,
    setActivityItems,
    scrollAreaRef
  );

  // Create task hook
  const {
    isCreateTaskOpen,
    setIsCreateTaskOpen,
    newTask,
    setNewTask,
    isCreatingTask,
    handleCreateTask: createTask,
  } = useCreateTask(project.id, agentId, (task) => {
    setTasks([task, ...tasks]);
  });

  const handleSave = async () => {
    setIsLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .update({
        title: editedProject.title,
        description: editedProject.description || null,
        priority: editedProject.priority,
        status: editedProject.status,
      })
      .eq("id", project.id)
      .select()
      .single();

    if (!error && data) {
      setProject(data as FullProject);
      setIsEditing(false);
    }
    setIsLoading(false);
  };

  const handleDelete = async () => {
    setIsLoading(true);

    const supabase = createClient();

    // Unlink tasks first
    await supabase.from("tasks").update({ project_id: null }).eq("project_id", project.id);

    // Delete project
    const { error } = await supabase.from("projects").delete().eq("id", project.id);

    if (!error) {
      router.push("/projects");
    }
    setIsLoading(false);
  };

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
      })
      .eq("id", task.id)
      .select("*, projects(id, title)")
      .single();

    if (!error && data) {
      setTasks(tasks.map((t) => (t.id === task.id ? (data as Task) : t)));
    }
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    setSelectedTask(updatedTask);
  };

  const handleTaskDelete = (taskId: string) => {
    setTasks(tasks.filter((t) => t.id !== taskId));
    setIsTaskDialogOpen(false);
    setSelectedTask(null);
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

  const activeCount = tasks.filter((t) => t.status !== "done").length;

  // Get user info from assignees
  const userAssignee = assignees.find((a) => a.type === "user");
  const userName = userAssignee?.name || "You";
  const userAvatarUrl = userAssignee?.avatar_url || null;

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-8 p-6">
          {/* Header */}
          <ProjectDetailHeader
            project={project}
            isEditing={isEditing}
            editedProject={editedProject}
            onEditChange={setIsEditing}
            onEditedProjectChange={setEditedProject}
            onSave={handleSave}
            onDeleteClick={() => setIsDeleteDialogOpen(true)}
            getPriorityColor={getPriorityColor}
            getStatusColor={getStatusColor}
          />

          {/* Description */}
          <ProjectDetailDescription
            description={project.description}
            isEditing={isEditing}
            editedDescription={editedProject.description}
            onDescriptionChange={(description) =>
              setEditedProject({ ...editedProject, description })
            }
          />

          <Separator />

          {/* Tasks Section */}
          <ProjectDetailTasks
            tasks={tasks}
            assignees={assignees}
            activeCount={activeCount}
            onTaskClick={(task) => {
              setSelectedTask(task);
              setIsTaskDialogOpen(true);
            }}
            onToggleComplete={handleToggleComplete}
            onCreateTaskClick={() => setIsCreateTaskOpen(true)}
          />
        </div>
      </div>

      {/* Right Sidebar - Activity */}
      <ProjectDetailActivity
        activityItems={activityItems}
        newComment={newComment}
        onCommentChange={setNewComment}
        onAddComment={handleAddComment}
        scrollAreaRef={scrollAreaRef}
        agentName={agentName}
        agentAvatarUrl={agentAvatarUrl}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
      />

      {/* Task Dialog */}
      <TaskDialog
        task={selectedTask}
        projects={allProjects}
        assignees={assignees}
        agentId={agentId}
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
      />

      {/* Create Task Dialog */}
      <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task to {project.title}</DialogTitle>
            <DialogDescription>Create a new task for this project.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Task description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTask} disabled={isCreatingTask}>
              {isCreatingTask ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete "{project.title}" and unlink all associated tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
