/**
 * Notification filters component
 */

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Filter, Clock, MessageSquare, ListTodo, FolderKanban } from "lucide-react";
import type { Notification } from "@/lib/db/notifications";

export type FilterType = "all" | "unread" | "read";
export type NotificationType = "all" | "reminder" | "new_message" | "task_update" | "project_update";

interface NotificationFiltersProps {
  filter: FilterType;
  typeFilter: NotificationType;
  onFilterChange: (filter: FilterType) => void;
  onTypeFilterChange: (type: NotificationType) => void;
  unreadCount: number;
  readCount: number;
  totalCount: number;
}

function getNotificationTypeName(type: Notification["type"]): string {
  switch (type) {
    case "reminder":
      return "Reminder";
    case "new_message":
      return "Message";
    case "task_update":
      return "Task Update";
    case "project_update":
      return "Project Update";
    default:
      return "Notification";
  }
}

export function NotificationFilters({
  filter,
  typeFilter,
  onFilterChange,
  onTypeFilterChange,
  unreadCount,
  readCount,
  totalCount,
}: NotificationFiltersProps) {
  return (
    <>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={filter === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onFilterChange("all")}
        >
          All ({totalCount})
        </Button>
        <Button
          variant={filter === "unread" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onFilterChange("unread")}
        >
          Unread ({unreadCount})
        </Button>
        <Button
          variant={filter === "read" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onFilterChange("read")}
        >
          Read ({readCount})
        </Button>
      </div>

      {/* Type Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            {typeFilter === "all" ? "All Types" : getNotificationTypeName(typeFilter as Notification["type"])}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuCheckboxItem
            checked={typeFilter === "all"}
            onCheckedChange={() => onTypeFilterChange("all")}
          >
            All Types
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={typeFilter === "reminder"}
            onCheckedChange={() => onTypeFilterChange("reminder")}
          >
            <Clock className="mr-2 h-4 w-4 text-blue-500" />
            Reminders
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={typeFilter === "new_message"}
            onCheckedChange={() => onTypeFilterChange("new_message")}
          >
            <MessageSquare className="mr-2 h-4 w-4 text-green-500" />
            Messages
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={typeFilter === "task_update"}
            onCheckedChange={() => onTypeFilterChange("task_update")}
          >
            <ListTodo className="mr-2 h-4 w-4 text-orange-500" />
            Task Updates
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={typeFilter === "project_update"}
            onCheckedChange={() => onTypeFilterChange("project_update")}
          >
            <FolderKanban className="mr-2 h-4 w-4 text-purple-500" />
            Project Updates
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
