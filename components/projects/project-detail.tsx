"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Clock,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { createClient } from "@/lib/supabase/client";
import { ItemRow } from "@/components/shared/item-row";
import { TaskDialog, Task, Project } from "@/components/shared/task-dialog";

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
  agentId: string;
}

export function ProjectDetail({
  project: initialProject,
  tasks: initialTasks,
  allProjects,
  agentId,
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

  // Create task dialog state
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
  });
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Delete confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
    await supabase
      .from("tasks")
      .update({ project_id: null })
      .eq("project_id", project.id);

    // Delete project
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id);

    if (!error) {
      router.push("/projects");
    }
    setIsLoading(false);
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;
    setIsCreatingTask(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        agent_id: agentId,
        title: newTask.title,
        description: newTask.description || null,
        priority: newTask.priority,
        project_id: project.id,
        due_date: newTask.due_date || null,
        status: "pending",
      })
      .select("*, projects(id, title)")
      .single();

    if (!error && data) {
      setTasks([data as Task, ...tasks]);
      setNewTask({ title: "", description: "", priority: "medium", due_date: "" });
      setIsCreateTaskOpen(false);
    }
    setIsCreatingTask(false);
  };

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        completed_at:
          newStatus === "completed" ? new Date().toISOString() : null,
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

  const pendingCount = tasks.filter((t) => t.status !== "completed").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header with back button */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/projects")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          {isEditing ? (
            <Input
              value={editedProject.title}
              onChange={(e) =>
                setEditedProject({ ...editedProject, title: e.target.value })
              }
              className="text-2xl font-bold h-auto py-1"
            />
          ) : (
            <h1 className="text-2xl font-bold">{project.title}</h1>
          )}
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className={getStatusColor(project.status)}>
              {project.status}
            </Badge>
            <Badge
              variant="outline"
              className={getPriorityColor(project.priority)}
            >
              {project.priority} priority
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setEditedProject({
                    title: project.title,
                    description: project.description || "",
                    priority: project.priority || "medium",
                    status: project.status || "active",
                  });
                }}
                disabled={isLoading}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isLoading}>
                <Check className="h-4 w-4 mr-1" />
                {isLoading ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Project Details */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Description */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Description
              </Label>
              {isEditing ? (
                <Textarea
                  value={editedProject.description}
                  onChange={(e) =>
                    setEditedProject({
                      ...editedProject,
                      description: e.target.value,
                    })
                  }
                  placeholder="Add a description..."
                  rows={3}
                />
              ) : (
                <p className="text-sm">
                  {project.description || (
                    <span className="text-muted-foreground italic">
                      No description
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Priority & Status (edit mode) */}
            {isEditing && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                    Priority
                  </Label>
                  <Select
                    value={editedProject.priority}
                    onValueChange={(value) =>
                      setEditedProject({ ...editedProject, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                    Status
                  </Label>
                  <Select
                    value={editedProject.status}
                    onValueChange={(value) =>
                      setEditedProject({ ...editedProject, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="pt-2 border-t">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Created{" "}
                  {project.created_at
                    ? new Date(project.created_at).toLocaleDateString()
                    : "Unknown"}
                </span>
                {project.updated_at && (
                  <span>
                    Updated {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Tasks</h2>
            <span className="text-sm text-muted-foreground">
              {pendingCount} pending · {completedCount} completed
            </span>
          </div>
          <Button size="sm" onClick={() => setIsCreateTaskOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Task
          </Button>
        </div>

        {tasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">No tasks yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Add tasks to track work for this project.
              </p>
              <Button onClick={() => setIsCreateTaskOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <ItemRow
                key={task.id}
                title={task.title}
                description={task.description}
                status={task.status}
                priority={task.priority}
                dueDate={task.due_date}
                isCompleted={task.status === "completed"}
                showCheckbox
                onCheckboxChange={() => handleToggleComplete(task)}
                onClick={() => {
                  setSelectedTask(task);
                  setIsTaskDialogOpen(true);
                }}
                variant="task"
              />
            ))}
          </div>
        )}
      </div>

      {/* Task Dialog */}
      <TaskDialog
        task={selectedTask}
        projects={allProjects}
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
            <DialogDescription>
              Create a new task for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newTask.title}
                onChange={(e) =>
                  setNewTask({ ...newTask, title: e.target.value })
                }
                placeholder="Task title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newTask.description}
                onChange={(e) =>
                  setNewTask({ ...newTask, description: e.target.value })
                }
                placeholder="Task description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value) =>
                    setNewTask({ ...newTask, priority: value })
                  }
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
                  onChange={(e) =>
                    setNewTask({ ...newTask, due_date: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateTaskOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={isCreatingTask}>
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
              The tasks will not be deleted but will no longer be associated with
              this project.
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
