/**
 * Notification list component
 */

import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";
import type { Notification } from "@/lib/db/notifications";
import { NotificationItem } from "./notification-item";
import type { FilterType, NotificationType } from "./notification-filters";

interface NotificationListProps {
  notifications: Notification[];
  filter: FilterType;
  typeFilter: NotificationType;
  onMarkAsRead: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function NotificationList({
  notifications,
  filter,
  typeFilter,
  onMarkAsRead,
  onDelete,
}: NotificationListProps) {
  // Apply filters
  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread" && n.read) return false;
    if (filter === "read" && !n.read) return false;
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    return true;
  });

  if (filteredNotifications.length === 0) {
    return (
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
    );
  }

  return (
    <div className="space-y-2">
      {filteredNotifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
