"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Notification } from "@/lib/db/notifications";

interface UseNotificationsOptions {
  agentId: string | null;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useNotifications({
  agentId,
}: UseNotificationsOptions): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize supabase client to avoid recreating on every render
  const supabase = useMemo(() => createClient(), []);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/notifications?limit=50");
      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark a single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }

      // Optimistically update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error marking notification as read:", err);
      // Refetch on error to sync state
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read");
      }

      // Optimistically update local state
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
      // Refetch on error to sync state
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Set up realtime subscription
  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel(`notifications:${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          // Add new notification to the beginning of the list
          const newNotification = {
            id: payload.new.id,
            agentId: payload.new.agent_id,
            type: payload.new.type,
            title: payload.new.title,
            content: payload.new.content,
            linkType: payload.new.link_type,
            linkId: payload.new.link_id,
            read: payload.new.read,
            createdAt: payload.new.created_at,
          } as Notification;

          setNotifications((prev) => [newNotification, ...prev]);
          if (!newNotification.read) {
            setUnreadCount((prev) => prev + 1);
          }
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
          // Update the notification in the list
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === payload.new.id
                ? {
                    ...n,
                    read: payload.new.read,
                    title: payload.new.title,
                    content: payload.new.content,
                  }
                : n
            )
          );

          // Update unread count if read status changed
          if (payload.old.read !== payload.new.read) {
            setUnreadCount((prev) =>
              payload.new.read ? Math.max(0, prev - 1) : prev + 1
            );
          }
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
          // Remove the notification from the list
          setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
          if (!payload.old.read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, supabase]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
