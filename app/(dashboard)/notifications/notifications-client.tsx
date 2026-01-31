"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  MessageSquare,
  ListTodo,
  FolderKanban,
  Filter,
  Loader2,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
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
import { Notification } from "@/lib/db/notifications";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type FilterType = "all" | "unread" | "read";
type NotificationType = "all" | "reminder" | "new_message" | "task_update" | "project_update";

interface NotificationsClientProps {
  initialNotifications: Notification[];
  agentId: string;
}

export function NotificationsClient({
  initialNotifications,
  agentId,
}: NotificationsClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<FilterType>("all");
  const [typeFilter, setTypeFilter] = useState<NotificationType>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [clickingNotificationId, setClickingNotificationId] = useState<string | null>(null);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [clearMode, setClearMode] = useState<"read" | "all">("read");

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`notifications-page:${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const newNotification: Notification = {
            id: payload.new.id,
            agentId: payload.new.agent_id,
            type: payload.new.type,
            title: payload.new.title,
            content: payload.new.content,
            linkType: payload.new.link_type,
            linkId: payload.new.link_id,
            read: payload.new.read,
            createdAt: payload.new.created_at,
          };
          setNotifications((prev) => [newNotification, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === payload.new.id
                ? { ...n, read: payload.new.read }
                : n
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          setNotifications((prev) =>
            prev.filter((n) => n.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, supabase]);

  const handleMarkAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsLoading(true);
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("agent_id", agentId)
      .eq("read", false);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
    setIsLoading(false);
  };

  const handleDelete = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    }
  };

  const handleClearNotifications = async () => {
    setIsLoading(true);

    let query = supabase
      .from("notifications")
      .delete()
      .eq("agent_id", agentId);

    if (clearMode === "read") {
      query = query.eq("read", true);
    }

    const { error } = await query;

    if (!error) {
      if (clearMode === "read") {
        setNotifications((prev) => prev.filter((n) => !n.read));
      } else {
        setNotifications([]);
      }
    }

    setIsClearDialogOpen(false);
    setIsLoading(false);
  };

  const handleNotificationClick = async (notification: Notification) => {
    setClickingNotificationId(notification.id);
    
    // Mark as read first
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }

    // Navigate to the linked resource
    if (notification.linkType && notification.linkId) {
      switch (notification.linkType) {
        case "conversation":
          // Navigate to chat with conversation ID in query param
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
    
    setClickingNotificationId(null);
  };

  const getNotificationIcon = (type: Notification["type"]) => {
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
  };

  const getNotificationTypeName = (type: Notification["type"]) => {
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
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  // Apply filters
  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread" && n.read) return false;
    if (filter === "read" && !n.read) return false;
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount} unread, {notifications.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Type Filter */}
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
                onCheckedChange={() => setTypeFilter("all")}
              >
                All Types
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={typeFilter === "reminder"}
                onCheckedChange={() => setTypeFilter("reminder")}
              >
                <Clock className="mr-2 h-4 w-4 text-blue-500" />
                Reminders
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={typeFilter === "new_message"}
                onCheckedChange={() => setTypeFilter("new_message")}
              >
                <MessageSquare className="mr-2 h-4 w-4 text-green-500" />
                Messages
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={typeFilter === "task_update"}
                onCheckedChange={() => setTypeFilter("task_update")}
              >
                <ListTodo className="mr-2 h-4 w-4 text-orange-500" />
                Task Updates
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={typeFilter === "project_update"}
                onCheckedChange={() => setTypeFilter("project_update")}
              >
                <FolderKanban className="mr-2 h-4 w-4 text-purple-500" />
                Project Updates
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mark all as read */}
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isLoading}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark All Read
            </Button>
          )}

          {/* Clear notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Archive className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setClearMode("read");
                  setIsClearDialogOpen(true);
                }}
                disabled={readCount === 0}
              >
                <Check className="mr-2 h-4 w-4" />
                Clear Read ({readCount})
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setClearMode("all");
                  setIsClearDialogOpen(true);
                }}
                disabled={notifications.length === 0}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All ({notifications.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={filter === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All ({notifications.length})
        </Button>
        <Button
          variant={filter === "unread" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setFilter("unread")}
        >
          Unread ({unreadCount})
        </Button>
        <Button
          variant={filter === "read" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setFilter("read")}
        >
          Read ({readCount})
        </Button>
      </div>

      {/* Notifications list */}
      {filteredNotifications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No notifications</h3>
            <p className="text-muted-foreground text-sm text-center">
              {filter === "unread"
                ? "You're all caught up!"
                : filter === "read"
                ? "No read notifications to show"
                : "Notifications from reminders, tasks, and projects will appear here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                "group cursor-pointer transition-colors hover:bg-muted/50",
                !notification.read && "bg-muted/30 border-primary/20",
                clickingNotificationId === notification.id && "opacity-70"
              )}
            >
              <CardContent className="flex items-start gap-4 p-4">
                <button
                  onClick={() => handleNotificationClick(notification)}
                  disabled={clickingNotificationId === notification.id}
                  className="flex items-start gap-4 flex-1 text-left cursor-pointer"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    {clickingNotificationId === notification.id ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      getNotificationIcon(notification.type)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className={cn(
                            "font-medium",
                            !notification.read && "text-foreground"
                          )}
                        >
                          {notification.title}
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 text-xs font-normal"
                        >
                          {getNotificationTypeName(notification.type)}
                        </Badge>
                      </div>
                      {!notification.read && (
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    {notification.content && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {notification.content}
                      </p>
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
                        handleMarkAsRead(notification.id);
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
                      handleDelete(notification.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Clear {clearMode === "read" ? "read" : "all"} notifications?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clearMode === "read"
                ? `This will permanently delete ${readCount} read notification${readCount !== 1 ? "s" : ""}.`
                : `This will permanently delete all ${notifications.length} notification${notifications.length !== 1 ? "s" : ""}.`}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearNotifications}
              className={cn(
                clearMode === "all" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                "Clear"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
