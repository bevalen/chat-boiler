"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Calendar,
  FolderKanban,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  project_id: string | null;
  created_at: string | null;
  completed_at: string | null;
  projects?: { id: string; title: string } | null;
}

export interface Project {
  id: string;
  title: string;
}

interface TaskDialogProps {
  task: Task | null;
  projects: Project[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onNavigateToProject?: (projectId: string) => void;
}

export function TaskDialog({
  task,
  projects,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  onNavigateToProject,
}: TaskDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});

  useEffect(() => {
    if (task) {
      setEditedTask({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        due_date: task.due_date,
        project_id: task.project_id,
      });
    }
    setIsEditing(false);
  }, [task]);

  const handleSave = async () => {
    if (!task) return;
    setIsLoading(true);

    const supabase = createClient();
    const updates: Record<string, unknown> = {};

    if (editedTask.title !== task.title) updates.title = editedTask.title;
    if (editedTask.description !== task.description)
      updates.description = editedTask.description || null;
    if (editedTask.priority !== task.priority)
      updates.priority = editedTask.priority;
    if (editedTask.status !== task.status) {
      updates.status = editedTask.status;
      if (editedTask.status === "completed") {
        updates.completed_at = new Date().toISOString();
      } else if (task.status === "completed") {
        updates.completed_at = null;
      }
    }
    if (editedTask.due_date !== task.due_date)
      updates.due_date = editedTask.due_date || null;
    if (editedTask.project_id !== task.project_id)
      updates.project_id = editedTask.project_id || null;

    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id)
        .select("*, projects(id, title)")
        .single();

      if (!error && data && onUpdate) {
        onUpdate(data as Task);
      }
    }

    setIsLoading(false);
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!task) return;
    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);

    if (!error && onDelete) {
      onDelete(task.id);
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
    }
    setIsLoading(false);
  };

  const handleToggleComplete = async () => {
    if (!task) return;
    const newStatus = task.status === "completed" ? "pending" : "completed";

    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", task.id)
      .select("*, projects(id, title)")
      .single();

    if (!error && data && onUpdate) {
      onUpdate(data as Task);
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
      case "pending":
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
      case "in_progress":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "completed":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Checkbox
              checked={task.status === "completed"}
              onCheckedChange={handleToggleComplete}
              className="mt-1 h-5 w-5"
            />
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editedTask.title || ""}
                  onChange={(e) =>
                    setEditedTask({ ...editedTask, title: e.target.value })
                  }
                  className="text-lg font-semibold"
                />
              ) : (
                <DialogTitle
                  className={cn(
                    "text-lg",
                    task.status === "completed" && "line-through opacity-60"
                  )}
                >
                  {task.title}
                </DialogTitle>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className={getStatusColor(task.status)}>
              {task.status?.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className={getPriorityColor(task.priority)}>
              {task.priority} priority
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Description */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Description
            </Label>
            {isEditing ? (
              <Textarea
                value={editedTask.description || ""}
                onChange={(e) =>
                  setEditedTask({ ...editedTask, description: e.target.value })
                }
                placeholder="Add a description..."
                rows={3}
              />
            ) : (
              <p className="text-sm">
                {task.description || (
                  <span className="text-muted-foreground italic">
                    No description
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Due Date
            </Label>
            {isEditing ? (
              <Input
                type="date"
                value={editedTask.due_date || ""}
                onChange={(e) =>
                  setEditedTask({ ...editedTask, due_date: e.target.value })
                }
              />
            ) : (
              <p className="text-sm">
                {task.due_date ? (
                  new Date(task.due_date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                ) : (
                  <span className="text-muted-foreground italic">No due date</span>
                )}
              </p>
            )}
          </div>

          {/* Project */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-1">
              <FolderKanban className="h-3 w-3" />
              Project
            </Label>
            {isEditing ? (
              <Select
                value={editedTask.project_id || "none"}
                onValueChange={(value) =>
                  setEditedTask({
                    ...editedTask,
                    project_id: value === "none" ? null : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : task.projects ? (
              <Button
                variant="link"
                className="h-auto p-0 text-sm text-primary"
                onClick={() => {
                  if (onNavigateToProject && task.project_id) {
                    onNavigateToProject(task.project_id);
                    onOpenChange(false);
                  }
                }}
              >
                {task.projects.title}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground italic">No project</p>
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
                  value={editedTask.priority || "medium"}
                  onValueChange={(value) =>
                    setEditedTask({ ...editedTask, priority: value })
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
                  value={editedTask.status || "pending"}
                  onValueChange={(value) =>
                    setEditedTask({ ...editedTask, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
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
                {task.created_at
                  ? new Date(task.created_at).toLocaleDateString()
                  : "Unknown"}
              </span>
              {task.completed_at && (
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Completed{" "}
                  {new Date(task.completed_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDeleteClick}
            disabled={isLoading}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedTask({
                      title: task.title,
                      description: task.description,
                      priority: task.priority,
                      status: task.status,
                      due_date: task.due_date,
                      project_id: task.project_id,
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
