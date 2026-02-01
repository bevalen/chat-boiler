"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  User,
  Bot,
  MessageSquare,
  Activity,
  Send,
  MoreHorizontal,
  Layout,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  assignee_type: string | null;
  assignee_id: string | null;
  blocked_by: string[] | null;
  projects?: { id: string; title: string } | null;
}

export interface Project {
  id: string;
  title: string;
}

export interface TaskComment {
  id: string;
  content: string;
  author_type: string;
  comment_type: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  created_at: string;
  source: string;
}

type TimelineItem = 
  | { type: 'comment'; data: TaskComment }
  | { type: 'activity'; data: ActivityLog };

export interface Assignee {
  id: string;
  name: string;
  type: "user" | "agent";
  avatar_url?: string | null;
}

interface TaskDialogProps {
  task: Task | null;
  projects: Project[];
  assignees?: Assignee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onNavigateToProject?: (projectId: string) => void;
}

export function TaskDialog({
  task,
  projects,
  assignees = [],
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
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Initialize edited task when task opens
  useEffect(() => {
    if (task) {
      setEditedTask({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        due_date: task.due_date,
        project_id: task.project_id,
        assignee_type: task.assignee_type,
        assignee_id: task.assignee_id,
      });
      // Start in "view" mode, but fields are editable directly in this new UI
      setIsEditing(true); 
    }
  }, [task]);

  // Fetch comments and activity
  useEffect(() => {
    if (task && open) {
      fetchTimeline();
    }
  }, [task?.id, open]);

  const fetchTimeline = async () => {
    if (!task) return;
    setIsLoadingTimeline(true);
    const supabase = createClient();
    
    // Fetch comments
    const { data: comments } = await supabase
      .from("task_comments")
      .select("id, content, author_type, comment_type, created_at")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch activity
    const { data: activity } = await supabase
      .from("activity_log")
      .select("id, activity_type, title, description, created_at, source")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const items: TimelineItem[] = [
      ...(comments?.map(c => ({ type: 'comment' as const, data: c as TaskComment })) || []),
      ...(activity?.map(a => ({ type: 'activity' as const, data: a as ActivityLog })) || [])
    ].sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime());

    setTimelineItems(items);
    setIsLoadingTimeline(false);
    
    // Scroll to bottom after load
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleAddComment = async () => {
    if (!task || !newComment.trim()) return;
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: task.id,
        content: newComment,
        author_type: "user",
        comment_type: "note",
      })
      .select()
      .single();

    if (!error && data) {
      setTimelineItems(prev => [...prev, { type: 'comment', data: data as TaskComment }]);
      setNewComment("");
      
      // Scroll to bottom
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  // Auto-save on blur or change for key fields
  const saveField = async (updates: Partial<Task>) => {
    if (!task) return;
    
    // Optimistic update
    setEditedTask(prev => ({ ...prev, ...updates }));
    
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", task.id)
      .select("*, projects(id, title)")
      .single();

    if (!error && data && onUpdate) {
      onUpdate(data as Task);
    }
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
    const newStatus = task.status === "done" ? "todo" : "done";
    const completedAt = newStatus === "done" ? new Date().toISOString() : null;
    
    await saveField({ status: newStatus, completed_at: completedAt });
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "high": return "text-red-500 bg-red-50 border-red-200";
      case "medium": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low": return "text-green-600 bg-green-50 border-green-200";
      default: return "text-gray-500 bg-gray-50 border-gray-200";
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "todo": return "bg-slate-100 text-slate-600 border-slate-200";
      case "in_progress": return "bg-blue-50 text-blue-600 border-blue-200";
      case "waiting_on": return "bg-orange-50 text-orange-600 border-orange-200";
      case "done": return "bg-green-50 text-green-600 border-green-200";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        <DialogTitle className="sr-only">Task Details</DialogTitle>
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-background shrink-0 z-10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
             {/* Project Breadcrumb */}
            <Button 
              variant="ghost" 
              size="sm"
              className="h-6 px-2 text-muted-foreground font-normal text-xs"
              onClick={() => task.project_id && onNavigateToProject?.(task.project_id)}
            >
               <FolderKanban className="h-3 w-3 mr-1.5" />
               {task.projects?.title || "No Project"}
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("capitalize font-medium", getStatusColor(editedTask.status || "todo"))}>
                {(editedTask.status || "todo").replace("_", " ")}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={handleToggleComplete}
              >
                {editedTask.status === 'done' ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
              </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Content - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Task Details */}
          <div className="flex-1 overflow-y-auto min-w-[300px]">
            <div className="max-w-3xl mx-auto p-8 space-y-8">
              
              {/* Title */}
              <div className="space-y-4">
                <Input
                  value={editedTask.title || ""}
                  onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                  onBlur={() => saveField({ title: editedTask.title })}
                  className="text-3xl font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0 resize-none placeholder:text-muted-foreground/50"
                  placeholder="Task Title"
                />
              </div>

              {/* Properties Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-4 bg-muted/20 rounded-lg border border-border/50">
                {/* Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</Label>
                  <Select
                    value={editedTask.status || "todo"}
                    onValueChange={(val) => {
                        const updates: any = { status: val };
                        if (val === 'done') updates.completed_at = new Date().toISOString();
                        else if (task.status === 'done') updates.completed_at = null;
                        saveField(updates);
                    }}
                  >
                    <SelectTrigger className="h-8 bg-transparent border-transparent hover:bg-muted/50 px-2 -ml-2 w-full justify-start shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="waiting_on">Waiting On</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Priority</Label>
                  <Select
                    value={editedTask.priority || "medium"}
                    onValueChange={(val) => saveField({ priority: val })}
                  >
                     <SelectTrigger className="h-8 bg-transparent border-transparent hover:bg-muted/50 px-2 -ml-2 w-full justify-start shadow-none">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", 
                          editedTask.priority === 'high' ? "bg-red-500" : 
                          editedTask.priority === 'medium' ? "bg-yellow-500" : "bg-green-500"
                        )} />
                        <span className="capitalize">{editedTask.priority}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Due Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Due Date</Label>
                   <Input
                    type="date"
                    value={editedTask.due_date || ""}
                    onChange={(e) => saveField({ due_date: e.target.value })}
                    className="h-8 bg-transparent border-transparent hover:bg-muted/50 px-2 -ml-2 w-full shadow-none font-normal"
                  />
                </div>

                 {/* Assignee */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Assignee</Label>
                  <Select
                    value={editedTask.assignee_id ? `${editedTask.assignee_type}:${editedTask.assignee_id}` : "none"}
                    onValueChange={(value) => {
                      if (value === "none") {
                        saveField({ assignee_type: null, assignee_id: null });
                      } else {
                        const [type, id] = value.split(":");
                        saveField({ assignee_type: type, assignee_id: id });
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 bg-transparent border-transparent hover:bg-muted/50 px-2 -ml-2 w-full justify-start shadow-none">
                       {editedTask.assignee_id ? (
                          <div className="flex items-center gap-2">
                             {editedTask.assignee_type === "agent" ? <Bot className="h-3.5 w-3.5 text-purple-500" /> : <User className="h-3.5 w-3.5 text-blue-500" />}
                             <span className="truncate">{getAssigneeName(editedTask.assignee_type, editedTask.assignee_id, assignees)}</span>
                          </div>
                       ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                       )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {assignees.map((assignee) => (
                        <SelectItem key={`${assignee.type}:${assignee.id}`} value={`${assignee.type}:${assignee.id}`}>
                          <div className="flex items-center gap-2">
                            {assignee.type === "agent" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                            {assignee.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Layout className="h-4 w-4 text-muted-foreground" />
                  Description
                </Label>
                <div className="relative min-h-[200px] group">
                   <Textarea
                    value={editedTask.description || ""}
                    onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                    onBlur={() => saveField({ description: editedTask.description })}
                    placeholder="Add a detailed description..."
                    className="min-h-[200px] resize-none border-transparent hover:border-border focus:border-ring p-4 text-base leading-relaxed bg-muted/10 rounded-lg"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Activity & Comments */}
          <div className="w-[380px] border-l bg-muted/10 flex flex-col shrink-0">
            <div className="p-4 border-b bg-background/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Activity
              </h3>
              <Badge variant="secondary" className="font-normal text-xs">{timelineItems.length}</Badge>
            </div>

            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
              <div className="space-y-6">
                {timelineItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        No activity yet
                    </div>
                ) : (
                    timelineItems.map((item, i) => (
                        <div key={i} className="flex gap-3 group">
                            <div className="mt-0.5 shrink-0">
                                {item.type === 'comment' ? (
                                    <Avatar className="h-8 w-8 border">
                                        <AvatarFallback className={cn("text-xs", 
                                            item.data.author_type === 'agent' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                                        )}>
                                            {item.data.author_type === 'agent' ? "AI" : "U"}
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
                                            ? (item.data.author_type === 'user' ? 'You' : 'AI Agent') 
                                            : (item.data.source || 'System')}
                                    </span>
                                    <span>•</span>
                                    <span>{formatDistanceToNow(new Date(item.data.created_at), { addSuffix: true })}</span>
                                </div>
                                
                                {item.type === 'comment' ? (
                                    <div className="text-sm bg-background border rounded-r-lg rounded-bl-lg p-3 shadow-sm">
                                        {item.data.content}
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground">
                                        <p>{item.data.title}</p>
                                        {item.data.description && (
                                            <p className="text-xs mt-1 bg-muted/50 p-1.5 rounded text-muted-foreground/80 font-mono">
                                                {item.data.description}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
              </div>
            </ScrollArea>

            {/* Comment Input */}
            <div className="p-4 bg-background border-t mt-auto">
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
                    placeholder="Write a comment..."
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
               <p className="text-[10px] text-muted-foreground mt-2 text-right">
                  Press Enter to post
               </p>
            </div>
          </div>
        </div>
      </DialogContent>

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

function getAssigneeName(type: string | null, id: string | null, assignees: Assignee[]) {
  if (!type) return "Unassigned";
  const assignee = assignees.find(a => a.id === id && a.type === type);
  return assignee?.name || (type === "agent" ? "AI Agent" : "User");
}
