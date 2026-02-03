/**
 * Hook for notifications real-time subscription
 */

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/db/notifications";

export function useNotificationsRealtime(
  agentId: string,
  onInsert: (notification: Notification) => void,
  onUpdate: (notification: Notification) => void,
  onDelete: (notificationId: string) => void
) {
  const supabase = createClient();

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
          onInsert(newNotification);
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
          const updatedNotification: Notification = {
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
          onUpdate(updatedNotification);
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
          onDelete(payload.old.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, supabase, onInsert, onUpdate, onDelete]);
}
