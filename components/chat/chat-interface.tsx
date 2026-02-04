"use client";

import { useChat, UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
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
import { User } from "lucide-react";
import Image from "next/image";
import { ConversationSidebar } from "./conversation-sidebar";
import { ChatHeader } from "./chat-header";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { WelcomeScreen } from "./welcome-screen";
import { MessageSkeleton } from "./message-skeleton";
import { LiveToolIndicator } from "./live-tool-indicator";
import { TypingDots } from "./typing-dots";
import { useConversation } from "@/hooks/use-conversation";
import { useScrollManagement } from "@/hooks/use-scroll-management";
import { useRealtimeUpdates } from "@/hooks/use-realtime-updates";

interface Conversation {
  id: string;
  title: string | null;
  channelType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface AgentInfo {
  name: string;
  title: string | null;
  avatarUrl: string | null;
}

interface UserInfo {
  name: string | null;
  avatarUrl: string | null;
}

interface ChatInterfaceProps {
  agent?: AgentInfo;
  /** Agent ID for filtering realtime subscriptions */
  agentId?: string;
  user?: UserInfo;
  /** Custom API endpoint (default: /api/chat) */
  apiEndpoint?: string;
  /** Hide the conversation sidebar (for single-purpose chats like feedback) */
  hideSidebar?: boolean;
  /** Custom storage key for conversation ID persistence (set to null to disable persistence) */
  storageKey?: string | null;
  /** Welcome message to show when no messages */
  welcomeMessage?: {
    title: string;
    subtitle: string;
    suggestedPrompts?: Array<{
      title: string;
      prompt: string;
    }>;
  };
}

const DEFAULT_STORAGE_KEY = "chat_active_conversation_id";
const DEFAULT_AGENT_AVATAR = "/logos/profile-icon.png";

export function ChatInterface({
  agent,
  agentId,
  user: userInfo,
  apiEndpoint = "/api/chat",
  hideSidebar = false,
  storageKey = DEFAULT_STORAGE_KEY,
  welcomeMessage,
}: ChatInterfaceProps) {
  const searchParams = useSearchParams();

  const [showSidebar, setShowSidebar] = useState(false);
  const [pendingTitleGeneration, setPendingTitleGeneration] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [input, setInput] = useState("");
  const [wasAborted, setWasAborted] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const hasInitialLoadRunRef = useRef(false);
  const initialLoadCompleteRef = useRef(false);

  // Auto-open sidebar on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) {
      setShowSidebar(true);
    }
  }, []);

  // Memoize transport to avoid unnecessary recreations but use ref for latest ID
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiEndpoint,
        body: () => (conversationIdRef.current ? { conversationId: conversationIdRef.current } : {}),
      }),
    [apiEndpoint]
  );

  const { messages, sendMessage, status, setMessages, stop } = useChat({ transport });

  // Handle stop button - mark response as aborted
  const handleStop = () => {
    setWasAborted(true);
    stop();
  };

  // Custom hooks for conversation management
  const {
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
  } = useConversation({ storageKey, setMessages });

  // Sync conversationId with ref
  conversationIdRef.current = conversationId;

  // Custom hook for scroll management
  const { scrollRef, handleScroll, resetScrollOnSend } = useScrollManagement(messages, status);

  // Custom hook for realtime updates
  useRealtimeUpdates({
    conversationId,
    agentId,
    setMessages,
    loadConversations,
  });

  const isLoading = status === "submitted" || status === "streaming";
  const agentName = agent?.name || "AI Assistant";
  const agentTitle = agent?.title || "AI Assistant";
  const agentAvatarUrl = agent?.avatarUrl || DEFAULT_AGENT_AVATAR;

  // Start a new conversation (just clear state, create in DB on first message)
  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
    // Clear localStorage when explicitly starting a new conversation
    if (storageKey) localStorage.removeItem(storageKey);
    // Focus the textarea after starting new conversation
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [setMessages, storageKey, setConversationId]);

  // Keyboard shortcut: CMD+J to start new conversation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        startNewConversation();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [startNewConversation]);

  // Trigger title generation after first exchange
  useEffect(() => {
    if (status === "ready" && pendingTitleGeneration && conversationId && messages.length >= 2) {
      setPendingTitleGeneration(false);
      generateTitle(conversationId, messages);
    }
  }, [status, pendingTitleGeneration, conversationId, messages, generateTitle]);

  // Re-focus input when response is complete and clear abort state on new message
  useEffect(() => {
    if (status === "ready" && textareaRef.current) {
      textareaRef.current.focus();
    }
    // Clear abort state when starting a new interaction
    if (status === "submitted") {
      setWasAborted(false);
    }
  }, [status]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Initial load - load conversations list and restore active conversation
  useEffect(() => {
    // Prevent double load (React Strict Mode or navigation edge cases)
    if (hasInitialLoadRunRef.current) {
      return;
    }
    hasInitialLoadRunRef.current = true;

    const init = async () => {
      await loadConversations();

      // Check for "new chat" request first
      const urlParams = new URLSearchParams(window.location.search);
      const isNewChat = urlParams.get("new") === "true";

      if (isNewChat) {
        // Clear any stored conversation and start fresh
        if (storageKey) localStorage.removeItem(storageKey);
        setConversationId(null);
        setMessages([]);
        // Clean up the URL by removing the ?new=true param
        const url = new URL(window.location.href);
        url.searchParams.delete("new");
        window.history.replaceState(null, "", url.pathname + url.search);
        return;
      }

      // Check for conversation ID from URL or localStorage
      const urlConvId = urlParams.get("conversation");
      const savedId = urlConvId || (storageKey ? localStorage.getItem(storageKey) : null);

      if (savedId) {
        await loadConversation(savedId);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist conversationId to localStorage and URL when it changes
  useEffect(() => {
    if (conversationId) {
      // Update localStorage
      if (storageKey) {
        localStorage.setItem(storageKey, conversationId);
      }
      // Update URL without triggering navigation
      const url = new URL(window.location.href);
      if (url.searchParams.get("conversation") !== conversationId) {
        url.searchParams.set("conversation", conversationId);
        window.history.replaceState(null, "", url.pathname + url.search);
      }
    } else {
      // Clear URL param when no conversation
      const url = new URL(window.location.href);
      if (url.searchParams.has("conversation")) {
        url.searchParams.delete("conversation");
        window.history.replaceState(null, "", url.pathname + url.search);
      }
    }
  }, [conversationId, storageKey]);

  // Watch for URL changes (e.g., from notifications, browser back/forward)
  useEffect(() => {
    // Skip first run - initial load effect handles that
    if (!initialLoadCompleteRef.current) {
      initialLoadCompleteRef.current = true;
      return;
    }

    const urlConvId = searchParams.get("conversation");
    const isNewChat = searchParams.get("new") === "true";

    // Handle "new chat" request
    if (isNewChat) {
      startNewConversation();
      // Clean up the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState(null, "", url.pathname + url.search);
      return;
    }

    // Skip if we're already loading this conversation
    if (loadingConversationIdRef.current === urlConvId) {
      return;
    }

    // Skip if the current conversation already matches
    if (urlConvId === conversationIdRef.current) {
      return;
    }

    // If URL has a different conversation, load it
    if (urlConvId) {
      loadConversation(urlConvId);
    } else if (conversationIdRef.current) {
      // URL param cleared, clear the conversation
      loadingConversationIdRef.current = null;
      setConversationId(null);
      setMessages([]);
    }
  }, [searchParams, loadConversation, setMessages, startNewConversation, loadingConversationIdRef, setConversationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== "ready" || isCreatingConversation) return;

    const messageText = input.trim();
    setInput("");
    resetScrollOnSend();

    // If no conversation yet, create one first
    if (!conversationId) {
      setOptimisticMessage(messageText);
      setIsCreatingConversation(true);

      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New conversation" }),
        });
        const data = await res.json();

        if (data.conversation) {
          setConversationId(data.conversation.id);
          setPendingTitleGeneration(true);
          // Small delay to ensure state is set before sending
          setTimeout(() => {
            setOptimisticMessage(null);
            sendMessage({ text: messageText });
            loadConversations();
          }, 0);
        }
      } catch (error) {
        console.error("Failed to create conversation:", error);
        setOptimisticMessage(null);
      } finally {
        setIsCreatingConversation(false);
      }
    } else {
      // If this is the first message in an existing conversation, mark for title generation
      if (messages.length === 0) {
        setPendingTitleGeneration(true);
      }
      sendMessage({ text: messageText });
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (status !== "ready") return;

    // Find the index of the message being edited
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // Truncate messages to include only up to (and including) the edited message
    const truncatedMessages = messages.slice(0, messageIndex);

    // Update the messages array with truncated version
    setMessages(truncatedMessages);

    // If we have a conversation, delete the messages after this point from the database
    if (conversationId) {
      try {
        await fetch(`/api/conversations/${conversationId}/messages`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromMessageId: messageId }),
        });
      } catch (error) {
        console.error("Failed to delete messages after edited message:", error);
      }
    }

    // Send the edited message
    sendMessage({ text: newContent });
  };

  const confirmDelete = (conv: Conversation) => {
    setConversationToDelete(conv);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConversation = async () => {
    if (conversationToDelete) {
      await deleteConversation(conversationToDelete.id);
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
    }
  };

  const handleSelectConversation = (id: string) => {
    loadConversation(id);
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  return (
    <div className="flex h-full bg-background/50 relative overflow-hidden">
      {/* Conversation Sidebar */}
      {!hideSidebar && (
        <ConversationSidebar
          conversations={conversations}
          currentConversationId={conversationId}
          loading={loadingConversations}
          showSidebar={showSidebar}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
          onSelectConversation={handleSelectConversation}
          onNewConversation={startNewConversation}
          onUpdateTitle={updateTitle}
          onDeleteConversation={confirmDelete}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <ChatHeader
          agentName={agentName}
          agentTitle={agentTitle}
          agentAvatarUrl={agentAvatarUrl}
          hideSidebar={hideSidebar}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
        />

        {/* Background Glow */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-[120px] opacity-20" />

        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto px-4 z-10 custom-scrollbar"
          ref={scrollRef}
          onScroll={handleScroll}
        >
          <div className="max-w-3xl mx-auto py-8 space-y-8">
            {isLoadingConversation ? (
              <MessageSkeleton />
            ) : messages.length === 0 && !optimisticMessage ? (
              <WelcomeScreen
                agentName={agentName}
                agentTitle={agentTitle}
                agentAvatarUrl={agentAvatarUrl}
                welcomeMessage={welcomeMessage}
                suggestedPrompts={welcomeMessage?.suggestedPrompts}
                onSuggestedPrompt={setInput}
                textareaRef={textareaRef}
              />
            ) : (
              <>
                {messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isUser={message.role === "user"}
                    agentName={agentName}
                    agentAvatarUrl={agentAvatarUrl}
                    userAvatarUrl={userInfo?.avatarUrl}
                    userName={userInfo?.name}
                    status={status}
                    isLastMessage={index === messages.length - 1}
                    onEdit={message.role === "user" ? handleEditMessage : undefined}
                  />
                ))}
                {/* Optimistic message shown while creating first conversation */}
                {optimisticMessage && (
                  <div className="flex gap-4 justify-end">
                    <div className="relative max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed bg-primary text-primary-foreground rounded-tr-sm">
                      <p className="whitespace-pre-wrap">{optimisticMessage}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1 overflow-hidden">
                      {userInfo?.avatarUrl ? (
                        <Image
                          src={userInfo.avatarUrl}
                          alt="You"
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                )}
                {/* Live tool indicator during streaming */}
                <LiveToolIndicator messages={messages} status={status} />
                {/* Abort indicator when response was stopped */}
                {wasAborted && status === "ready" && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
                  <div className="flex gap-4 -mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="w-8 h-8 shrink-0" /> {/* Spacer to align with avatar */}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-600 dark:text-yellow-400">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="font-medium">Response stopped</span>
                    </div>
                  </div>
                )}
                {/* Loading indicator for agent response */}
                {(status === "submitted" || isCreatingConversation) && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1 overflow-hidden">
                      <Image
                        src={agentAvatarUrl}
                        alt={agentName}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="py-2">
                      <TypingDots />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Input area */}
        <MessageInput
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          onStop={handleStop}
          isLoading={isLoading}
          isCreating={isCreatingConversation}
          status={status}
          agentName={agentName}
          textareaRef={textareaRef}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{conversationToDelete?.title || "this conversation"}&quot; and all its
              messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
