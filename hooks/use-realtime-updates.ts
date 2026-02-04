import { useEffect } from "react";
import { UIMessage } from "@ai-sdk/react";
import { createClient } from "@/lib/supabase/client";

interface UseRealtimeUpdatesProps {
  conversationId: string | null;
  agentId?: string;
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;
  loadConversations: () => void;
}

export function useRealtimeUpdates({
  conversationId,
  agentId,
  setMessages,
  loadConversations,
}: UseRealtimeUpdatesProps) {
  // Realtime subscription for conversations list updates
  useEffect(() => {
    // Skip subscription if we don't have an agentId to filter by
    if (!agentId) return;

    const supabase = createClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedLoadConversations = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        loadConversations();
      }, 500); // 500ms debounce
    };

    const channel = supabase
      .channel(`conversations-list:${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
          filter: `agent_id=eq.${agentId}`,
        },
        debouncedLoadConversations
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "conversations",
          filter: `agent_id=eq.${agentId}`,
        },
        debouncedLoadConversations
      )
      .subscribe();

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [agentId, loadConversations]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const newMessage = payload.new as {
            id: string;
            role: "user" | "assistant" | "system";
            content: string;
            created_at: string;
            metadata?: Record<string, unknown>;
          };

          // Only add if not already in messages (avoid duplicates from local sends)
          setMessages((prev) => {
            // Check by ID first
            const existsById = prev.some((m) => m.id === newMessage.id);
            if (existsById) return prev;

            // For user messages, check by content to avoid duplicates
            if (newMessage.role === "user") {
              const isExternalMessage =
                newMessage.metadata?.channel_source && newMessage.metadata.channel_source !== "app";

              if (!isExternalMessage) {
                // Check if we have a message with the same content recently
                const recentUserMessages = prev.filter((m) => m.role === "user").slice(-3);
                const isDuplicate = recentUserMessages.some((m) =>
                  m.parts.some((p) => p.type === "text" && (p as { text: string }).text === newMessage.content)
                );
                if (isDuplicate) return prev;
              }
            }

            // Check if this is a scheduled notification (from cron)
            const isScheduledMessage =
              newMessage.metadata?.type === "scheduled_notification" ||
              newMessage.metadata?.type === "daily_brief" ||
              newMessage.metadata?.type === "scheduled_agent_task";

            // For assistant messages, check for duplicates from streaming response
            if (!isScheduledMessage && newMessage.role === "assistant") {
              const recentMessages = prev.slice(-3);
              const isDuplicate = recentMessages.some(
                (m) =>
                  m.role === "assistant" &&
                  m.parts.some((p) => p.type === "text" && (p as { text: string }).text === newMessage.content)
              );
              if (isDuplicate) return prev;
            }

            const uiMessage: UIMessage = {
              id: newMessage.id,
              role: newMessage.role === "system" ? "assistant" : newMessage.role,
              parts: [{ type: "text" as const, text: newMessage.content }],
            };

            return [...prev, uiMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, setMessages]);
}
