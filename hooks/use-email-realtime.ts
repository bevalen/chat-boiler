/**
 * Hook for email real-time subscriptions
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Email = Database["public"]["Tables"]["emails"]["Row"];

export function useEmailRealtime(
  agentId: string,
  onEmailInsert: (email: Email) => void,
  onEmailUpdate: (email: Email, oldEmail: Email) => void
) {
  const supabase = createClient();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const channel = supabase
      .channel(`emails-page:${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "emails",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const newEmail = payload.new as Email;
          onEmailInsert(newEmail);
          if (!newEmail.is_read && newEmail.direction === "inbound") {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "emails",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const updatedEmail = payload.new as Email;
          const oldEmail = payload.old as Email;
          onEmailUpdate(updatedEmail, oldEmail);

          if (oldEmail.is_read !== updatedEmail.is_read && updatedEmail.direction === "inbound") {
            if (updatedEmail.is_read) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
            } else {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, supabase, onEmailInsert, onEmailUpdate]);

  return { unreadCount, setUnreadCount };
}
