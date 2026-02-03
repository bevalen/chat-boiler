/**
 * Hook for notification bulk actions (mark all read, clear)
 */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/db/notifications";

export function useNotificationBulkActions(agentId: string) {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  const markAllAsRead = async (
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>
  ) => {
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

  const clearNotifications = async (
    mode: "read" | "all",
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>
  ) => {
    setIsLoading(true);

    let query = supabase.from("notifications").delete().eq("agent_id", agentId);

    if (mode === "read") {
      query = query.eq("read", true);
    }

    const { error } = await query;

    if (!error) {
      if (mode === "read") {
        setNotifications((prev) => prev.filter((n) => !n.read));
      } else {
        setNotifications([]);
      }
    }

    setIsLoading(false);
  };

  return {
    isLoading,
    markAllAsRead,
    clearNotifications,
  };
}
