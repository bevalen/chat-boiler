/**
 * Notification item component
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Notification } from "@/lib/db/notifications";
import { Bell, Clock, MessageSquare, ListTodo, FolderKanban } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function getNotificationIcon(type: Notification["type"]) {
  switch (type) {
    case "reminder":
      return <Clock className="h-5 w-5 text-blue-500" />;
    case "new_message":
      return <MessageSquare className="h-5 w-5 text-green-500" />;
    case "task_update":
      return <ListTodo className="h-5 w-5 text-orange-500" />;
    case "project_update":
      return <FolderKanban className="h-5 w-5 text-purple-500" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
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

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: NotificationItemProps) {
  const router = useRouter();
  const [clicking, setClicking] = useState(false);

  const handleClick = async () => {
    setClicking(true);

    // Mark as read first
    if (!notification.read) {
      await onMarkAsRead(notification.id);
    }

    // Navigate to the linked resource
    if (notification.linkType && notification.linkId) {
      switch (notification.linkType) {
        case "conversation":
          router.push(`/?conversation=${notification.linkId}`);
          break;
        case "task":
          router.push("/tasks");
          break;
        case "project":
          router.push(`/projects/${notification.linkId}`);
          break;
        case "reminder":
          router.push("/reminders");
          break;
      }
    }

    setClicking(false);
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-colors hover:bg-muted/50",
        !notification.read && "bg-muted/30 border-primary/20",
        clicking && "opacity-70"
      )}
    >
      <CardContent className="flex items-start gap-4 p-4">
        <button
          onClick={handleClick}
          disabled={clicking}
          className="flex items-start gap-4 flex-1 text-left cursor-pointer"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            {clicking ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              getNotificationIcon(notification.type)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div
                  className={cn(
                    "font-medium prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-strong:font-semibold",
                    !notification.read && "text-foreground"
                  )}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{notification.title}</ReactMarkdown>
                </div>
                <Badge variant="outline" className="mt-1 text-xs font-normal">
                  {getNotificationTypeName(notification.type)}
                </Badge>
              </div>
              {!notification.read && (
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
              )}
            </div>
            {notification.content && (
              <div className="mt-2 text-sm text-muted-foreground line-clamp-2 prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-strong:font-semibold">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{notification.content}</ReactMarkdown>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {formatTimeAgo(notification.createdAt)}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!notification.read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification.id);
              }}
              title="Mark as read"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
