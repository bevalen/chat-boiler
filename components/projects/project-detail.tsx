"use client";

import { useState, useEffect, useRef } from "react";
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
  Activity,
  Send,
  MoreVertical,
  Filter,
  User,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { TaskDialog, Task, Project, Assignee } from "@/components/shared/task-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

interface ActivityItem {
  type: 'comment' | 'activity';
  id: string;
  content: string; // or title for activity
  description?: string;
  author_type?: string;
  created_at: string;
  source?: string;
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

  // Activity State
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch Activity
  useEffect(() => {
    fetchProjectActivity();
  }, [project.id]);

  const fetchProjectActivity = async () => {
    const supabase = createClient();
    
    // Fetch comments
    const { data: comments } = await supabase
      .from("comments") // Assuming there is a 'comments' table for projects, or we use a unified one. 
      // The schema showed 'comments' table has project_id.
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch activity log
    const { data: activity } = await supabase
      .from("activity_log")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const items: ActivityItem[] = [
      ...(comments?.map((c: any) => ({
        type: 'comment' as const,
        id: c.id,
        content: c.content,
        author_type: c.author_type,
        created_at: c.created_at
      })) || []),
      ...(activity?.map((a: any) => ({
        type: 'activity' as const,
        id: a.id,
        content: a.title,
        description: a.description,
        source: a.source,
        created_at: a.created_at
      })) || [])
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    setActivityItems(items);
    
    setTimeout(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
    }, 100);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from("comments")
      .insert({
        project_id: project.id,
        content: newComment,
        author_type: "user",
        comment_type: "note",
      })
      .select()
      .single();

    if (!error && data) {
      setActivityItems(prev => [...prev, {
        type: 'comment',
        id: data.id,
        content: data.content,
        author_type: data.author_type,
        created_at: data.created_at
      }]);
      setNewComment("");
      setTimeout(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
    }, 100);
    }
  };


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
        status: "todo",
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
    setIsTaskDialogOpen(false);
    setSelectedTask(null);
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "high": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "low": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "active": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "paused": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "completed": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const activeCount = tasks.filter((t) => t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  // Get user info from assignees
  const userAssignee = assignees.find(a => a.type === 'user');
  const userName = userAssignee?.name || 'You';

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-8 p-6">
                {/* Header with Navigation and Actions */}
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="pl-0 text-muted-foreground hover:text-foreground mb-2"
                            onClick={() => router.push("/projects")}
                        >
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Back to Projects
                        </Button>
                        
                        {isEditing ? (
                            <div className="space-y-4 max-w-xl">
                                <Input
                                    value={editedProject.title}
                                    onChange={(e) => setEditedProject({ ...editedProject, title: e.target.value })}
                                    className="text-3xl font-bold h-auto py-2"
                                />
                                <div className="flex gap-4">
                                     <Select
                                        value={editedProject.status || "active"}
                                        onValueChange={(value) => setEditedProject({ ...editedProject, status: value })}
                                    >
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="paused">Paused</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                     <Select
                                        value={editedProject.priority || "medium"}
                                        onValueChange={(value) => setEditedProject({ ...editedProject, priority: value })}
                                    >
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>
                                <div className="flex items-center gap-2 mt-3">
                                    <Badge variant="outline" className={getStatusColor(project.status)}>
                                        {project.status}
                                    </Badge>
                                    <Badge variant="outline" className={getPriorityColor(project.priority)}>
                                        {project.priority} priority
                                    </Badge>
                                    <span className="text-sm text-muted-foreground ml-2">
                                        Last updated {project.updated_at ? new Date(project.updated_at).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                         {isEditing ? (
                            <>
                                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                                <Button onClick={handleSave}>Save Changes</Button>
                            </>
                         ) : (
                             <>
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit Project
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive hover:bg-destructive/10">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                             </>
                         )}
                    </div>
                </div>

                {/* Description */}
                <Card className="bg-muted/30 border-none shadow-sm">
                    <CardContent className="pt-6">
                        <Label className="text-xs uppercase font-bold text-muted-foreground mb-2 block tracking-wider">Description</Label>
                        {isEditing ? (
                            <Textarea
                                value={editedProject.description || ""}
                                onChange={(e) => setEditedProject({ ...editedProject, description: e.target.value })}
                                className="min-h-[100px] bg-background"
                                placeholder="Project description..."
                            />
                        ) : (
                            <div className="text-foreground/90 leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-strong:font-semibold">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{project.description || "No description provided."}</ReactMarkdown>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Separator />

                {/* Tasks Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <ListTodo className="h-5 w-5 text-primary" />
                                Tasks
                            </h2>
                            <Badge variant="secondary" className="ml-2">
                                {activeCount} active
                            </Badge>
                        </div>
                        <Button onClick={() => setIsCreateTaskOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Task
                        </Button>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            {tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="bg-muted/50 p-4 rounded-full mb-4">
                                        <ListTodo className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-medium">No tasks yet</h3>
                                    <p className="text-muted-foreground max-w-sm mt-2 mb-6">
                                        Get started by adding tasks to track progress for this project.
                                    </p>
                                    <Button onClick={() => setIsCreateTaskOpen(true)}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create First Task
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3 p-4">
                                    {tasks.map((task) => (
                                        <ItemRow
                                            key={task.id}
                                            title={task.title}
                                            status={task.status}
                                            priority={task.priority}
                                            dueDate={task.due_date}
                                            assigneeType={task.assignee_type}
                                            assigneeId={task.assignee_id}
                                            assignees={assignees}
                                            commentCount={(task as any).task_comments?.[0]?.count || 0}
                                            isCompleted={task.status === "done"}
                                            showCheckbox
                                            showDescription={false}
                                            onCheckboxChange={() => handleToggleComplete(task)}
                                            onClick={() => {
                                                setSelectedTask(task);
                                                setIsTaskDialogOpen(true);
                                            }}
                                            variant="task"
                                            className="hover:bg-muted/50 transition-colors"
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>

        {/* Right Sidebar - Activity */}
        <div className="w-[350px] border-l bg-muted/10 flex flex-col h-full min-h-0">
            <div className="p-4 border-b bg-background/50 backdrop-blur shrink-0">
                <h3 className="font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Project Activity
                </h3>
            </div>
            
            <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollAreaRef}>
                 <div className="space-y-6 pb-4">
                    {activityItems.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No activity recorded yet.
                        </div>
                    ) : (
                         activityItems.map((item, i) => (
                            <div key={i} className="flex gap-3">
                                <div className="mt-0.5 shrink-0">
                                    {item.type === 'comment' ? (
                                        <Avatar className="h-8 w-8 border">
                                            {item.author_type === 'agent' && agentAvatarUrl ? (
                                                <AvatarImage src={agentAvatarUrl} alt={agentName} />
                                            ) : item.author_type === 'user' && userAssignee?.avatar_url ? (
                                                <AvatarImage src={userAssignee.avatar_url} alt={userName} />
                                            ) : null}
                                            <AvatarFallback className={cn("text-xs", 
                                                item.author_type === 'agent' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                                            )}>
                                                {item.author_type === 'agent' 
                                                    ? (agentName ? agentName.charAt(0).toUpperCase() : "AI") 
                                                    : (userName ? userName.charAt(0).toUpperCase() : "U")}
                                            </AvatarFallback>
                                        </Avatar>
                                    ) : (
                                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center border">
                                            <Activity className="h-4 w-4 text-slate-500" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">
                                        {item.type === 'comment' 
                                            ? (item.author_type === 'user' ? userName : agentName) 
                                            : (item.source || 'System')}
                                    </span>
                                    <span>•</span>
                                    <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                                </div>
                                    
                                    {item.type === 'comment' ? (
                                        <div className="text-sm bg-background border rounded-r-lg rounded-bl-lg p-3 shadow-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-strong:font-semibold">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground">
                                            <p>{item.content}</p>
                                            {item.description && (
                                                <div className="text-xs mt-1 bg-muted/50 p-1.5 rounded text-muted-foreground/80 prose prose-xs dark:prose-invert max-w-none">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.description}</ReactMarkdown>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                 </div>
            </ScrollArea>

            <div className="p-4 bg-background border-t shrink-0">
               <div className="relative">
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                    placeholder="Add a comment..."
                    className="pr-10"
                  />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
               </div>
            </div>
        </div>

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
