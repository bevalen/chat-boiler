"use client";

import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Clock, Calendar, FolderKanban, ChevronRight } from "lucide-react";

interface ItemRowProps {
  title: string;
  description?: string | null;
  status: string | null;
  priority: string | null;
  dueDate?: string | null;
  projectName?: string | null;
  isCompleted?: boolean;
  showCheckbox?: boolean;
  onCheckboxChange?: () => void;
  onClick?: () => void;
  actions?: ReactNode;
  variant?: "task" | "project";
  className?: string;
}

export function ItemRow({
  title,
  description,
  status,
  priority,
  dueDate,
  projectName,
  isCompleted = false,
  showCheckbox = false,
  onCheckboxChange,
  onClick,
  actions,
  variant = "task",
  className,
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

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group",
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
          className="h-5 w-5 shrink-0"
        />
      )}

      {variant === "project" && (
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FolderKanban className="h-4 w-4 text-primary" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-medium truncate",
              isCompleted && "line-through"
            )}
          >
            {title}
          </span>
          {projectName && (
            <Badge variant="outline" className="text-xs shrink-0 max-w-[120px] truncate">
              {projectName}
            </Badge>
          )}
        </div>
        {(description || dueDate) && (
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
