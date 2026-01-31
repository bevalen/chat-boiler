"use client";

import { useChat, UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, Bot, User, Plus, MessageSquare, ChevronLeft, Pencil, Check, X, Trash2, Search, Brain, FolderPlus, ListTodo, Save, Hash, Slack } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Image from "next/image";

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
  };
}

const DEFAULT_STORAGE_KEY = "maia_active_conversation_id";

export function ChatInterface({ 
  agent, 
  user: userInfo,
  apiEndpoint = "/api/chat",
  hideSidebar = false,
  storageKey = DEFAULT_STORAGE_KEY,
  welcomeMessage,
}: ChatInterfaceProps) {
  // Initialize from localStorage if available (and persistence is enabled)
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window !== "undefined" && storageKey) {
      return localStorage.getItem(storageKey);
    }
    return null;
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>("app");

  // Auto-open sidebar on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) {
      setShowSidebar(true);
    }
  }, []);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [pendingTitleGeneration, setPendingTitleGeneration] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);

  // Use a ref to always have the latest conversationId in the transport
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;

  // Memoize transport to avoid unnecessary recreations but use ref for latest ID
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiEndpoint,
        body: () => (conversationIdRef.current ? { conversationId: conversationIdRef.current } : {}),
      }),
    [apiEndpoint]
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  // Load conversations list with channel filter
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const res = await fetch(`/api/conversations?channel=${channelFilter}`);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoadingConversations(false);
    }
  }, [channelFilter]);

  // Load messages for a conversation
  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      const data = await res.json();

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

      setConversationId(id);
      if (window.innerWidth < 768) {
        setShowSidebar(false);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  }, [setMessages]);

  // Start a new conversation (just clear state, create in DB on first message)
  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
    // Clear localStorage when explicitly starting a new conversation
    if (storageKey) localStorage.removeItem(storageKey);
  }, [setMessages, storageKey]);

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
        setEditingTitleId(null);
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
      } finally {
        setDeleteDialogOpen(false);
        setConversationToDelete(null);
      }
    },
    [conversationId, loadConversations, setMessages]
  );

  const confirmDelete = (conv: Conversation) => {
    setConversationToDelete(conv);
    setDeleteDialogOpen(true);
  };

  // Initial load - load conversations list and restore active conversation
  useEffect(() => {
    const init = async () => {
      await loadConversations();
      
      // After loading conversations list, restore the saved conversation if any
      const savedId = storageKey ? localStorage.getItem(storageKey) : null;
      if (savedId) {
        // Verify the conversation still exists before loading
        try {
          const res = await fetch(`/api/conversations/${savedId}/messages`);
          if (res.ok) {
            loadConversation(savedId);
          } else {
            // Conversation no longer exists, clear the saved ID
            if (storageKey) localStorage.removeItem(storageKey);
            setConversationId(null);
          }
        } catch {
          if (storageKey) localStorage.removeItem(storageKey);
          setConversationId(null);
        }
      }
    };
    init();
  }, [loadConversations, loadConversation]);

  // Reload conversations when channel filter changes
  useEffect(() => {
    loadConversations();
  }, [channelFilter, loadConversations]);

  // Realtime subscription for conversations list updates
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel("conversations-list")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "conversations",
        },
        () => {
          // Refresh conversations list when any change occurs
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  // Persist conversationId to localStorage when it changes (if storage is enabled)
  useEffect(() => {
    if (conversationId && storageKey) {
      localStorage.setItem(storageKey, conversationId);
    }
  }, [conversationId, storageKey]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Realtime subscription for new messages (e.g., from cron jobs, other sessions)
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
        (payload) => {
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
            // User messages are already added by useChat, so we should skip them
            // unless they came from an external source (like Slack)
            if (newMessage.role === "user") {
              const isExternalMessage = newMessage.metadata?.channel_source && 
                newMessage.metadata.channel_source !== "app";
              
              if (!isExternalMessage) {
                // This is a local user message - already handled by useChat
                // Check if we have a message with the same content recently
                const recentUserMessages = prev.filter((m) => m.role === "user").slice(-3);
                const isDuplicate = recentUserMessages.some(
                  (m) => m.parts.some((p) => p.type === "text" && (p as { text: string }).text === newMessage.content)
                );
                if (isDuplicate) return prev;
              }
            }

            // Check if this is a scheduled notification (from cron)
            const isScheduledMessage = newMessage.metadata?.type === "scheduled_notification" ||
              newMessage.metadata?.type === "daily_brief" ||
              newMessage.metadata?.type === "scheduled_agent_task";

            // For assistant messages, check for duplicates from streaming response
            if (!isScheduledMessage && newMessage.role === "assistant") {
              // This might be a duplicate from the streaming response
              // Check if we recently added a similar message
              const recentMessages = prev.slice(-3);
              const isDuplicate = recentMessages.some(
                (m) => m.role === "assistant" && 
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

  // Trigger title generation after first exchange
  useEffect(() => {
    if (
      status === "ready" &&
      pendingTitleGeneration &&
      conversationId &&
      messages.length >= 2
    ) {
      setPendingTitleGeneration(false);
      generateTitle(conversationId, messages);
    }
  }, [status, pendingTitleGeneration, conversationId, messages, generateTitle]);

  // Re-focus input when response is complete
  useEffect(() => {
    if (status === "ready" && textareaRef.current) {
      textareaRef.current.focus();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== "ready") return;

    const messageText = input.trim();
    setInput("");

    // If no conversation yet, create one first
    if (!conversationId) {
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
            sendMessage({ text: messageText });
            loadConversations();
          }, 0);
        }
      } catch (error) {
        console.error("Failed to create conversation:", error);
      }
    } else {
      // If this is the first message in an existing conversation, mark for title generation
      if (messages.length === 0) {
        setPendingTitleGeneration(true);
      }
      sendMessage({ text: messageText });
    }
  };

  const startEditingTitle = (conv: Conversation) => {
    setEditingTitleId(conv.id);
    setEditingTitleValue(conv.title || "");
  };

  const cancelEditingTitle = () => {
    setEditingTitleId(null);
    setEditingTitleValue("");
  };

  const saveTitle = () => {
    if (editingTitleId && editingTitleValue.trim()) {
      updateTitle(editingTitleId, editingTitleValue.trim());
    }
  };

  const agentName = agent?.name || "Milo";
  const agentTitle = agent?.title || "AI Assistant";

  return (
    <div className="flex h-full bg-background/50 relative overflow-hidden">
      {/* Conversation Sidebar - hidden when hideSidebar prop is true */}
      {!hideSidebar && (
      <div
        className={`absolute md:relative z-30 h-full bg-background/95 backdrop-blur-md border-r border-white/5 transition-all duration-300 ${
          showSidebar ? "w-72 opacity-100" : "w-0 opacity-0 md:w-0"
        } overflow-hidden`}
      >
        <div className="w-72 h-full flex flex-col">
          <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
            <h3 className="font-semibold">Conversations</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowSidebar(false)} className="md:hidden">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-2 space-y-2">
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="Filter by channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="app">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5" />
                    <span>App</span>
                  </div>
                </SelectItem>
                <SelectItem value="slack">
                  <div className="flex items-center gap-2">
                    <Slack className="h-3.5 w-3.5" />
                    <span>Slack</span>
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>All Channels</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {channelFilter === "app" && (
              <Button onClick={startNewConversation} className="w-full justify-start gap-2" variant="outline">
                <Plus className="h-4 w-4" />
                New conversation
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1 px-2">
            {loadingConversations ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">No conversations yet</div>
            ) : (
              <div className="space-y-1 py-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      conversationId === conv.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-secondary/50 text-muted-foreground"
                    }`}
                  >
                    {editingTitleId === conv.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          className="h-7 text-sm px-2"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTitle();
                            if (e.key === "Escape") cancelEditingTitle();
                          }}
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveTitle}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEditingTitle}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
<button
                                          onClick={() => loadConversation(conv.id)}
                                          className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer"
                                        >
                                          {channelFilter === "all" && conv.channelType === "slack" ? (
                                            <Slack className="h-4 w-4 shrink-0 text-[#4A154B]" />
                                          ) : (
                                            <MessageSquare className="h-4 w-4 shrink-0" />
                                          )}
                                          <span className="truncate">{conv.title || "New conversation"}</span>
                                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingTitle(conv);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDelete(conv);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-white/5 bg-background/80 backdrop-blur-md px-4 flex items-center gap-3 z-20 shrink-0">
          {!hideSidebar && (
            <Button variant="ghost" size="icon" onClick={() => setShowSidebar(!showSidebar)} className="shrink-0">
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
            {agent?.avatarUrl ? (
              <Image src={agent.avatarUrl} alt={agentName} width={32} height={32} className="w-full h-full object-cover" />
            ) : (
              <Bot className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate">{agentName}</h2>
            <p className="text-xs text-muted-foreground truncate">{agentTitle}</p>
          </div>
        </div>

        {/* Background Glow (Very Subtle) */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-[120px] opacity-20" />

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 z-10 scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent" ref={scrollRef}>
          <div className="max-w-3xl mx-auto py-8 space-y-8">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-6 opacity-0 animate-fade-in-up [animation-delay:200ms] fill-mode-forwards">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10 overflow-hidden">
                  {agent?.avatarUrl ? (
                    <Image src={agent.avatarUrl} alt={agentName} width={80} height={80} className="w-full h-full object-cover" />
                  ) : (
                    <Bot className="w-10 h-10 text-primary" />
                  )}
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">
                    {welcomeMessage?.title || "How can I help you today?"}
                  </h2>
                  <p className="text-muted-foreground text-lg max-w-md mx-auto">
                    {welcomeMessage?.subtitle || `I'm ${agentName}, your ${agentTitle}. I can help with tasks, scheduling, and project management.`}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mt-8">
                  <button
                    className="text-sm bg-secondary/50 hover:bg-secondary/80 border border-white/5 rounded-xl p-4 text-left transition-colors cursor-pointer"
                    onClick={() => {
                      setInput("What's on my schedule today?");
                      textareaRef.current?.focus();
                    }}
                  >
                    <span className="font-medium block mb-1">Check Schedule</span>
                    <span className="text-muted-foreground text-xs">&quot;What&apos;s on my schedule today?&quot;</span>
                  </button>
                  <button
                    className="text-sm bg-secondary/50 hover:bg-secondary/80 border border-white/5 rounded-xl p-4 text-left transition-colors cursor-pointer"
                    onClick={() => {
                      setInput("Create a new project for Q1 Marketing");
                      textareaRef.current?.focus();
                    }}
                  >
                    <span className="font-medium block mb-1">New Project</span>
                    <span className="text-muted-foreground text-xs">&quot;Create a new project...&quot;</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1 overflow-hidden">
                        {agent?.avatarUrl ? (
                          <Image src={agent.avatarUrl} alt={agentName} width={32} height={32} className="w-full h-full object-cover" />
                        ) : (
                          <Bot className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    )}

                    <div
                      className={`relative max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-secondary/50 border border-white/5 rounded-tl-sm"
                      }`}
                    >
                      {message.parts.map((part, index) => {
                        if (part.type === "text") {
                          return message.role === "user" ? (
                            <p key={index} className="whitespace-pre-wrap">
                              {part.text}
                            </p>
                          ) : (
                            <div
                              key={index}
                              className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10"
                            >
                              <ReactMarkdown>{part.text}</ReactMarkdown>
                            </div>
                          );
                        }
                        if (part.type === "tool-invocation" || part.type.startsWith("tool-")) {
                          const toolName = part.type === "tool-invocation" 
                            ? (part as any).toolInvocation.toolName 
                            : part.type.replace("tool-", "");
                            
                          const rawState = part.type === "tool-invocation"
                            ? (part as any).toolInvocation.state
                            : (part as any).state;
                            
                          // Map new SDK states to our component states
                          let state: "partial-call" | "call" | "result" = "call";
                          if (rawState === "partial-call" || rawState === "input-streaming") state = "partial-call";
                          else if (rawState === "call" || rawState === "input-available") state = "call";
                          else if (rawState === "result" || rawState === "output-available" || rawState === "output-error") state = "result";
                          
                          const args = part.type === "tool-invocation" 
                            ? (part as any).toolInvocation.args 
                            : (part as any).input;
                            
                          const result = part.type === "tool-invocation" 
                            ? (part as any).toolInvocation.result 
                            : (part as any).output;

                          return (
                            <ToolInvocationDisplay 
                              key={index} 
                              toolName={toolName}
                              state={state}
                              args={args}
                              result={result}
                            />
                          );
                        }
                        return null;
                      })}
                    </div>

                    {message.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1 overflow-hidden">
                        {userInfo?.avatarUrl ? (
                          <Image src={userInfo.avatarUrl} alt={userInfo.name || "You"} width={32} height={32} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {status === "submitted" && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1 overflow-hidden">
                      {agent?.avatarUrl ? (
                        <Image src={agent.avatarUrl} alt={agentName} width={32} height={32} className="w-full h-full object-cover" />
                      ) : (
                        <Bot className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="bg-secondary/50 border border-white/5 rounded-2xl rounded-tl-sm px-5 py-4">
                      <TypingDots />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-white/5 bg-background/80 backdrop-blur-md p-4 z-20 shrink-0">
          <div className="max-w-3xl mx-auto relative">
            <form
              onSubmit={handleSubmit}
              className="relative rounded-2xl bg-secondary/50 border border-white/10 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all"
            >
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask ${agentName} anything...`}
                className="min-h-[56px] max-h-[200px] w-full bg-transparent border-0 focus-visible:ring-0 resize-none py-4 pl-4 pr-14 text-base placeholder:text-muted-foreground/50"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || status !== "ready"}
                className="absolute right-2 bottom-2 h-10 w-10 rounded-xl transition-all hover:scale-105 active:scale-95"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground/40 text-center mt-3 uppercase tracking-wider font-medium">
              MAIA Internal System • Confidential
            </p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{conversationToDelete?.title || "this conversation"}&quot; and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => conversationToDelete && deleteConversation(conversationToDelete.id)}
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

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 h-full">
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" />
    </div>
  );
}

// Tool names mapped to display info
const TOOL_DISPLAY_INFO: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  searchMemory: {
    label: "Searching Memory",
    icon: <Search className="w-3.5 h-3.5" />,
    description: "Looking through past conversations and context...",
  },
  saveToMemory: {
    label: "Saving to Memory",
    icon: <Save className="w-3.5 h-3.5" />,
    description: "Storing this information for later...",
  },
  createProject: {
    label: "Creating Project",
    icon: <FolderPlus className="w-3.5 h-3.5" />,
    description: "Setting up a new project...",
  },
  listProjects: {
    label: "Listing Projects",
    icon: <FolderPlus className="w-3.5 h-3.5" />,
    description: "Fetching your projects...",
  },
  createTask: {
    label: "Creating Task",
    icon: <ListTodo className="w-3.5 h-3.5" />,
    description: "Adding a new task...",
  },
  listTasks: {
    label: "Listing Tasks",
    icon: <ListTodo className="w-3.5 h-3.5" />,
    description: "Fetching your tasks...",
  },
  completeTask: {
    label: "Completing Task",
    icon: <Check className="w-3.5 h-3.5" />,
    description: "Marking task as done...",
  },
};

interface ToolDisplayProps {
  toolName: string;
  state: "partial-call" | "call" | "result";
  args: Record<string, unknown>;
  result?: unknown;
}

function ToolInvocationDisplay({ toolName, state, args, result }: ToolDisplayProps) {
  const toolInfo = TOOL_DISPLAY_INFO[toolName] || {
    label: toolName,
    icon: <Brain className="w-3.5 h-3.5" />,
    description: "Processing...",
  };

  const isLoading = state === "call" || state === "partial-call";
  const isComplete = state === "result";

  // For search results, show count
  const resultSummary = isComplete && result && typeof result === "object" && "resultCount" in (result as Record<string, unknown>)
    ? `Found ${(result as { resultCount: number }).resultCount} result(s)`
    : isComplete
    ? "Done"
    : null;

  return (
    <div className="my-2 flex items-start gap-2">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          isLoading
            ? "bg-primary/10 text-primary border border-primary/20"
            : "bg-green-500/10 text-green-400 border border-green-500/20"
        }`}
      >
        <span className={isLoading ? "animate-pulse" : ""}>{toolInfo.icon}</span>
        <span>{toolInfo.label}</span>
        {isLoading && (
          <Loader2 className="w-3 h-3 animate-spin" />
        )}
        {resultSummary && (
          <span className="text-[10px] opacity-70">• {resultSummary}</span>
        )}
      </div>
      {isLoading && args && "query" in args && (
        <span className="text-xs text-muted-foreground italic">
          &quot;{String(args.query).substring(0, 50)}{String(args.query).length > 50 ? "..." : ""}&quot;
        </span>
      )}
    </div>
  );
}
