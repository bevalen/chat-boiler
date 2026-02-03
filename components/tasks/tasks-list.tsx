"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { ItemRow } from "@/components/shared/item-row";
import { TaskDialog, Task, Project, Assignee } from "@/components/shared/task-dialog";

interface TasksListProps {
  tasks: Task[];
  projects: Project[];
  assignees?: Assignee[];
  agentId: string;
}

export function TasksList({
  tasks: initialTasks,
  projects,
  assignees = [],
  agentId,
}: TasksListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState(initialTasks);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    project_id: "",
    due_date: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  // Auto-open task from query param
  useEffect(() => {
    const taskId = searchParams.get('taskId');
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setSelectedTask(task);
        setIsDialogOpen(true);
        // Clear the query param after opening
        router.replace('/tasks', { scroll: false });
      }
    }
  }, [searchParams, tasks, router]);

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
        status: "todo",
      })
      .select("*, projects(id, title)")
      .single();

    if (!error && data) {
      setTasks([data as Task, ...tasks]);
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
    const newStatus = task.status === "done" ? "todo" : "done";
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        completed_at:
          newStatus === "done" ? new Date().toISOString() : null,
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
    setIsDialogOpen(false);
    setSelectedTask(null);
  };

  const handleNavigateToProject = (projectId: string) => {
    setIsDialogOpen(false);
    router.push(`/projects/${projectId}`);
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "active") return task.status !== "done";
    if (filter === "done") return task.status === "done";
    return true;
  });

  const activeCount = tasks.filter((t) => t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            {activeCount} active · {doneCount} done
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
              <div className="grid gap-2">
                <Label htmlFor="project">Project (optional)</Label>
                <Select
                  value={newTask.project_id || "none"}
                  onValueChange={(value) =>
                    setNewTask({
                      ...newTask,
                      project_id: value === "none" ? "" : value,
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
      <div className="flex gap-2 mb-4">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All ({tasks.length})
        </Button>
        <Button
          variant={filter === "active" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("active")}
        >
          Active ({activeCount})
        </Button>
        <Button
          variant={filter === "done" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("done")}
        >
          Done ({doneCount})
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
                : filter === "active"
                ? "No active tasks."
                : "No completed tasks."}
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
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <ItemRow
              key={task.id}
              title={task.title}
              description={task.description}
              status={task.status}
              priority={task.priority}
              dueDate={task.due_date}
              projectName={task.projects?.title}
              isCompleted={task.status === "done"}
              showCheckbox
              onCheckboxChange={() => handleToggleComplete(task)}
              onClick={() => {
                setSelectedTask(task);
                setIsDialogOpen(true);
              }}
              variant="task"
              className="hover:bg-muted/50 transition-colors"
            />
          ))}
        </div>
      )}

      {/* Task Dialog */}
      <TaskDialog
        task={selectedTask}
        projects={projects}
        assignees={assignees}
        agentId={agentId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
        onNavigateToProject={handleNavigateToProject}
      />
    </div>
  );
}
