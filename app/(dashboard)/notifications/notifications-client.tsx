"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { CheckCheck, Archive, Trash2, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Notification } from "@/lib/db/notifications";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useNotificationsRealtime } from "@/hooks/use-notifications-realtime";
import { useNotificationBulkActions } from "@/hooks/use-notification-bulk-actions";
import { NotificationFilters, type FilterType, type NotificationType } from "@/components/notifications/notification-filters";
import { NotificationList } from "@/components/notifications/notification-list";

interface NotificationsClientProps {
  initialNotifications: Notification[];
  agentId: string;
}

export function NotificationsClient({
  initialNotifications,
  agentId,
}: NotificationsClientProps) {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<FilterType>("all");
  const [typeFilter, setTypeFilter] = useState<NotificationType>("all");
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [clearMode, setClearMode] = useState<"read" | "all">("read");

  const { isLoading, markAllAsRead, clearNotifications } = useNotificationBulkActions(agentId);

  // Set up realtime subscription
  useNotificationsRealtime(
    agentId,
    (newNotification) => {
      setNotifications((prev) => [newNotification, ...prev]);
    },
    (updatedNotification) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
      );
    },
    (notificationId) => {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    }
  );

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

  const handleDelete = async (notificationId: string) => {
    const { error } = await supabase.from("notifications").delete().eq("id", notificationId);

    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    }
  };

  const handleMarkAllAsReadClick = async () => {
    await markAllAsRead(setNotifications);
  };

  const handleClearNotifications = async () => {
    await clearNotifications(clearMode, setNotifications);
    setIsClearDialogOpen(false);
  };

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
          {/* Mark all as read */}
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsReadClick}
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

      <NotificationFilters
        filter={filter}
        typeFilter={typeFilter}
        onFilterChange={setFilter}
        onTypeFilterChange={setTypeFilter}
        unreadCount={unreadCount}
        readCount={readCount}
        totalCount={notifications.length}
      />

      <NotificationList
        notifications={notifications}
        filter={filter}
        typeFilter={typeFilter}
        onMarkAsRead={handleMarkAsRead}
        onDelete={handleDelete}
      />

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
