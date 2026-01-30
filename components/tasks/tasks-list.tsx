"use client";

import { useState } from "react";
import {
  Plus,
  ListTodo,
  MoreHorizontal,
  Trash2,
  Check,
  Circle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  project_id: string | null;
  created_at: string | null;
  completed_at: string | null;
  projects?: { title: string } | null;
}

interface Project {
  id: string;
  title: string;
}

interface TasksListProps {
  tasks: Task[];
  projects: Project[];
  agentId: string;
}

export function TasksList({
  tasks: initialTasks,
  projects,
  agentId,
}: TasksListProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    project_id: "",
    due_date: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!newTask.title.trim()) return;
    setIsLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        agent_id: agentId,
        title: newTask.title,
        description: newTask.description || null,
        priority: newTask.priority,
        project_id: newTask.project_id || null,
        due_date: newTask.due_date || null,
        status: "pending",
      })
      .select("*, projects(title)")
      .single();

    if (!error && data) {
      setTasks([data, ...tasks]);
      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        project_id: "",
        due_date: "",
      });
      setIsCreateOpen(false);
    }
    setIsLoading(false);
  };

  const handleToggleComplete = async (task: Task) => {
    const supabase = createClient();
    const newStatus = task.status === "completed" ? "pending" : "completed";
    const { error } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);

    if (!error) {
      setTasks(
        tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: newStatus,
                completed_at:
                  newStatus === "completed" ? new Date().toISOString() : null,
              }
            : t
        )
      );
    }
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (!error) {
      setTasks(tasks.filter((t) => t.id !== id));
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

  const filteredTasks = tasks.filter((task) => {
    if (filter === "pending") return task.status !== "completed";
    if (filter === "completed") return task.status === "completed";
    return true;
  });

  const pendingCount = tasks.filter((t) => t.status !== "completed").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            {pendingCount} pending · {completedCount} completed
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>Add a new task to your list.</DialogDescription>
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
                  <select
                    id="priority"
                    value={newTask.priority}
                    onChange={(e) =>
                      setNewTask({ ...newTask, priority: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
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
              <div className="grid gap-2">
                <Label htmlFor="project">Project (optional)</Label>
                <select
                  id="project"
                  value={newTask.project_id}
                  onChange={(e) =>
                    setNewTask({ ...newTask, project_id: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All ({tasks.length})
        </Button>
        <Button
          variant={filter === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("pending")}
        >
          Pending ({pendingCount})
        </Button>
        <Button
          variant={filter === "completed" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("completed")}
        >
          Completed ({completedCount})
        </Button>
      </div>

      {filteredTasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No tasks found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {filter === "all"
                ? "Create your first task to get started."
                : `No ${filter} tasks.`}
            </p>
            {filter === "all" && (
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Task
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              className={cn(
                "group transition-opacity",
                task.status === "completed" && "opacity-60"
              )}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <Checkbox
                  checked={task.status === "completed"}
                  onCheckedChange={() => handleToggleComplete(task)}
                  className="h-5 w-5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-medium",
                        task.status === "completed" && "line-through"
                      )}
                    >
                      {task.title}
                    </span>
                    {task.projects?.title && (
                      <Badge variant="outline" className="text-xs">
                        {task.projects.title}
                      </Badge>
                    )}
                  </div>
                  {(task.description || task.due_date) && (
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      {task.description && (
                        <span className="truncate">{task.description}</span>
                      )}
                      {task.due_date && (
                        <span className="flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={getPriorityColor(task.priority)}
                >
                  {task.priority}
                </Badge>
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
                    <DropdownMenuItem onClick={() => handleToggleComplete(task)}>
                      {task.status === "completed" ? (
                        <>
                          <Circle className="mr-2 h-4 w-4" />
                          Mark Pending
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Mark Complete
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(task.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
