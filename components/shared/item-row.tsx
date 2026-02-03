"use client";

import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Clock, Calendar, FolderKanban, ChevronRight, MessageSquare } from "lucide-react";

interface Assignee {
  id: string;
  name: string;
  type: "user" | "agent";
  avatar_url?: string | null;
}

interface ItemRowProps {
  title: string;
  description?: string | null;
  status: string | null;
  priority: string | null;
  dueDate?: string | null;
  projectName?: string | null;
  assigneeType?: string | null;
  assigneeId?: string | null;
  assignees?: Assignee[];
  commentCount?: number;
  isCompleted?: boolean;
  showCheckbox?: boolean;
  onCheckboxChange?: () => void;
  onClick?: () => void;
  actions?: ReactNode;
  variant?: "task" | "project";
  className?: string;
  showDescription?: boolean;
}

export function ItemRow({
  title,
  description,
  status,
  priority,
  dueDate,
  projectName,
  assigneeType,
  assigneeId,
  assignees = [],
  commentCount,
  isCompleted = false,
  showCheckbox = false,
  onCheckboxChange,
  onClick,
  actions,
  variant = "task",
  className,
  showDescription = true,
}: ItemRowProps) {
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
    if (variant === "project") {
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
    } else {
      switch (status) {
        case "todo":
          return "bg-slate-500/10 text-slate-500 border-slate-500/20";
        case "in_progress":
          return "bg-blue-500/10 text-blue-500 border-blue-500/20";
        case "waiting_on":
          return "bg-orange-500/10 text-orange-500 border-orange-500/20";
        case "done":
          return "bg-green-500/10 text-green-500 border-green-500/20";
        default:
          return "bg-muted text-muted-foreground";
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const isOverdue =
    dueDate && new Date(dueDate) < new Date() && status !== "done";

  const assignee = assigneeType && assigneeId 
    ? assignees.find(a => a.id === assigneeId && a.type === assigneeType)
    : null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors group",
        onClick && "cursor-pointer",
        isCompleted && "opacity-60",
        className
      )}
      onClick={onClick}
    >
      {showCheckbox && (
        <Checkbox
          checked={isCompleted}
          onCheckedChange={() => onCheckboxChange?.()}
          onClick={(e) => e.stopPropagation()}
          className="h-5 w-5 shrink-0 cursor-pointer transition-all hover:scale-110 hover:ring-2 hover:ring-primary/50 rounded"
        />
      )}

      {variant === "project" && (
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FolderKanban className="h-4 w-4 text-primary" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-1.5">
          <span
            className={cn(
              "font-medium truncate",
              isCompleted && "line-through"
            )}
          >
            {title}
          </span>
          {projectName && (
            <Badge 
              variant="outline" 
              className="text-xs w-fit"
              title={projectName}
            >
              {projectName}
            </Badge>
          )}
        </div>
        {variant === "task" && (dueDate || commentCount !== undefined) && (
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            {dueDate && (
              <span
                className={cn(
                  "flex items-center gap-1",
                  isOverdue && "text-red-500"
                )}
              >
                <Calendar className="h-3 w-3" />
                {formatDate(dueDate)}
              </span>
            )}
            {commentCount !== undefined && commentCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {commentCount}
              </span>
            )}
          </div>
        )}
        {variant === "project" && (description || dueDate) && showDescription && (
          <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
            {description && (
              <span className="truncate max-w-[200px]">{description}</span>
            )}
            {dueDate && (
              <span
                className={cn(
                  "flex items-center gap-1 text-xs shrink-0",
                  isOverdue && "text-red-500"
                )}
              >
                <Calendar className="h-3 w-3" />
                {formatDate(dueDate)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {assignee && (
          <div className="flex items-center gap-1.5 mr-1" title={assignee.name}>
            <Avatar className="h-6 w-6 border">
              {assignee.avatar_url && (
                <AvatarImage src={assignee.avatar_url} alt={assignee.name} />
              )}
              <AvatarFallback className={cn("text-[10px]", 
                assignee.type === 'agent' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
              )}>
                {assignee.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
        <Badge
          variant="outline"
          className={cn("text-xs capitalize", getStatusColor(status))}
        >
          {status?.replace("_", " ")}
        </Badge>
        <Badge
          variant="outline"
          className={cn("text-xs", getPriorityColor(priority))}
        >
          {priority}
        </Badge>
        {actions}
        {onClick && (
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );
}
