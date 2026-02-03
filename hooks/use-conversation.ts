import { useState, useCallback, useRef } from "react";
import { UIMessage } from "@ai-sdk/react";

interface Conversation {
  id: string;
  title: string | null;
  channelType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface UseConversationProps {
  storageKey?: string | null;
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;
}

export function useConversation({ storageKey, setMessages }: UseConversationProps) {
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      // Check URL param first
      const urlConvId = new URLSearchParams(window.location.search).get("conversation");
      if (urlConvId) return urlConvId;
      // Fall back to localStorage
      if (storageKey) return localStorage.getItem(storageKey);
    }
    return null;
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);

  // Track which conversation is currently being loaded to prevent race conditions
  const loadingConversationIdRef = useRef<string | null>(null);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const res = await fetch(`/api/conversations?channel=app`);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  // Load messages for a conversation
  const loadConversation = useCallback(
    async (id: string) => {
      // Skip if already loading this conversation
      if (loadingConversationIdRef.current === id) {
        return;
      }

      // Track which conversation we're loading to prevent race conditions
      loadingConversationIdRef.current = id;

      // Optimistically switch to the new conversation immediately
      setIsLoadingConversation(true);
      setConversationId(id);
      setMessages([]); // Clear messages so skeleton shows

      try {
        const res = await fetch(`/api/conversations/${id}/messages`);

        // Check if we're still loading this conversation (user might have switched)
        if (loadingConversationIdRef.current !== id) {
          return; // Abort - user switched to a different conversation
        }

        if (!res.ok) {
          // Conversation no longer exists, reset state
          console.warn(`Conversation ${id} not found, clearing state`);
          setConversationId(null);
          if (storageKey) localStorage.removeItem(storageKey);
          return;
        }

        const data = await res.json();

        // Double-check we're still on this conversation before updating messages
        if (loadingConversationIdRef.current !== id) {
          return; // Abort - user switched to a different conversation
        }

        if (data.messages) {
          // Convert database messages to UIMessage format
          const uiMessages: UIMessage[] = data.messages.map(
            (msg: { id: string; role: "user" | "assistant"; content: string; createdAt: string }) => ({
              id: msg.id,
              role: msg.role,
              parts: [{ type: "text" as const, text: msg.content }],
              createdAt: new Date(msg.createdAt || Date.now()),
            })
          );
          setMessages(uiMessages);
        }

        // Auto-mark notifications as read for this conversation
        fetch("/api/notifications/mark-by-conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: id }),
        }).catch((err) => {
          console.error("Failed to mark notifications as read:", err);
        });
      } catch (error) {
        console.error("Failed to load conversation:", error);
        // Only reset if we're still trying to load this conversation
        if (loadingConversationIdRef.current === id) {
          setConversationId(null);
          if (storageKey) localStorage.removeItem(storageKey);
        }
      } finally {
        // Only clear loading state if this is still the active load
        if (loadingConversationIdRef.current === id) {
          loadingConversationIdRef.current = null;
          setIsLoadingConversation(false);
        }
      }
    },
    [setMessages, storageKey]
  );

  // Generate title for conversation
  const generateTitle = useCallback(
    async (convId: string, msgs: UIMessage[]) => {
      try {
        const messageData = msgs.map((m) => ({
          role: m.role,
          content: m.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("\n"),
        }));

        await fetch(`/api/conversations/${convId}/title`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: messageData }),
        });

        // Refresh conversations to show new title
        loadConversations();
      } catch (error) {
        console.error("Failed to generate title:", error);
      }
    },
    [loadConversations]
  );

  // Update title manually
  const updateTitle = useCallback(
    async (convId: string, newTitle: string) => {
      try {
        await fetch(`/api/conversations/${convId}/title`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });

        loadConversations();
      } catch (error) {
        console.error("Failed to update title:", error);
      }
    },
    [loadConversations]
  );

  // Delete conversation
  const deleteConversation = useCallback(
    async (convId: string) => {
      try {
        await fetch(`/api/conversations/${convId}`, {
          method: "DELETE",
        });

        // If we deleted the current conversation, clear the chat and localStorage
        if (conversationId === convId) {
          setConversationId(null);
          setMessages([]);
          if (storageKey) localStorage.removeItem(storageKey);
        }

        loadConversations();
      } catch (error) {
        console.error("Failed to delete conversation:", error);
      }
    },
    [conversationId, loadConversations, setMessages, storageKey]
  );

  return {
    conversationId,
    setConversationId,
    conversations,
    isLoadingConversation,
    loadingConversations,
    loadingConversationIdRef,
    loadConversations,
    loadConversation,
    generateTitle,
    updateTitle,
    deleteConversation,
  };
}
