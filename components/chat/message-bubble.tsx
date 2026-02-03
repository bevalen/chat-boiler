"use client";

import { useState } from "react";
import { UIMessage } from "@ai-sdk/react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Pencil, Copy, CheckCheck, Check, X, Brain, Loader2, Search, Save, FolderPlus, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { markdownComponents } from "./markdown-components";
import { ToolCallIndicator } from "./tool-call-indicator";

interface MessageBubbleProps {
  message: UIMessage;
  isUser: boolean;
  agentName: string;
  agentAvatarUrl?: string | null;
  userAvatarUrl?: string | null;
  userName?: string | null;
  status: string;
  /** Whether this is the last message (used for live streaming indicator) */
  isLastMessage?: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
}

// Tool names mapped to display info
const TOOL_DISPLAY_INFO: Record<string, { label: string; icon: React.ReactNode }> = {
  searchMemory: { label: "Searching Memory", icon: <Search className="w-3.5 h-3.5" /> },
  saveToMemory: { label: "Saving to Memory", icon: <Save className="w-3.5 h-3.5" /> },
  research: { label: "Researching", icon: <Brain className="w-3.5 h-3.5" /> },
  createProject: { label: "Creating Project", icon: <FolderPlus className="w-3.5 h-3.5" /> },
  listProjects: { label: "Listing Projects", icon: <FolderPlus className="w-3.5 h-3.5" /> },
  createTask: { label: "Creating Task", icon: <ListTodo className="w-3.5 h-3.5" /> },
  listTasks: { label: "Listing Tasks", icon: <ListTodo className="w-3.5 h-3.5" /> },
  completeTask: { label: "Completing Task", icon: <Check className="w-3.5 h-3.5" /> },
};

// Convert camelCase to Title Case for fallback
const formatToolName = (name: string) => {
  return name.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()).trim();
};

export function MessageBubble({
  message,
  isUser,
  agentName,
  agentAvatarUrl,
  userAvatarUrl,
  userName,
  status,
  isLastMessage = false,
  onEdit,
}: MessageBubbleProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const textContent = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");

  const hasTextContent = message.parts.some((part) => part.type === "text" && (part as any).text?.trim());

  // Extract tool calls from message metadata (only for assistant messages)
  const toolCalls = !isUser && (message as any).metadata?.tool_calls
    ? (message as any).metadata.tool_calls
    : [];

  // Get live tool invocation info for streaming messages
  const toolParts = !isUser ? message.parts.filter(
    (part) => part.type === "tool-invocation" || part.type.startsWith("tool-")
  ) : [];

  const liveToolsInfo = toolParts.map((part) => {
    const toolName = part.type === "tool-invocation" 
      ? (part as any).toolInvocation?.toolName 
      : part.type.replace("tool-", "");
    const rawState = part.type === "tool-invocation" 
      ? (part as any).toolInvocation?.state 
      : (part as any).state;
    const args = part.type === "tool-invocation" 
      ? (part as any).toolInvocation?.args 
      : (part as any).input;
    const isComplete = rawState === "result" || rawState === "output-available" || rawState === "output-error";
    const info = TOOL_DISPLAY_INFO[toolName] || {
      label: formatToolName(toolName),
      icon: <Brain className="w-3.5 h-3.5" />,
    };
    return { toolName, isComplete, info, args };
  });

  const isStreaming = status === "streaming" && isLastMessage && !isUser;
  const showLiveToolIndicator = isStreaming && liveToolsInfo.length > 0;
  const currentTool = liveToolsInfo.find((t) => !t.isComplete) || liveToolsInfo[liveToolsInfo.length - 1];
  const completedCount = liveToolsInfo.filter((t) => t.isComplete).length;
  const allToolsComplete = completedCount === liveToolsInfo.length;
  const isThinking = allToolsComplete && !hasTextContent && showLiveToolIndicator;

  const startEditing = () => {
    setEditValue(textContent);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const saveEdit = () => {
    if (editValue.trim() && onEdit) {
      onEdit(message.id, editValue.trim());
      setIsEditing(false);
      setEditValue("");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent);
    setCopiedMessageId(message.id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  return (
    <div className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1 overflow-hidden">
          {agentAvatarUrl ? (
            <Image src={agentAvatarUrl} alt={agentName} width={32} height={32} className="w-full h-full object-cover" />
          ) : (
            <Bot className="w-5 h-5 text-primary" />
          )}
        </div>
      )}

      <div className="flex flex-col gap-1 max-w-[80%] group relative">
        {isEditing && isUser ? (
          <div className="space-y-2 w-full">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="min-h-[100px] bg-secondary/50 border border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  saveEdit();
                }
                if (e.key === "Escape") {
                  cancelEditing();
                }
              }}
            />
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={cancelEditing}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={saveEdit}
                disabled={!editValue.trim() || status !== "ready"}
              >
                <Check className="h-4 w-4 mr-1" />
                Save & Regenerate
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Live tool indicator when streaming with no text yet */}
            {showLiveToolIndicator && !hasTextContent && (
              <div className="flex flex-col gap-0.5 py-1 animate-in fade-in duration-300">
                {isThinking ? (
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Brain className="w-3.5 h-3.5 animate-pulse text-primary" />
                    <span>Thinking...</span>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="animate-pulse text-primary">{currentTool?.info.icon}</span>
                      <span>{currentTool?.info.label}</span>
                      {!currentTool?.isComplete && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                      {currentTool?.isComplete && <Check className="w-3.5 h-3.5 text-green-400" />}
                    </div>
                    {currentTool?.args?.query && !currentTool?.isComplete && (
                      <span className="text-xs text-muted-foreground/60 italic max-w-[300px] truncate">
                        &quot;{currentTool.args.query as string}&quot;
                      </span>
                    )}
                    {liveToolsInfo.length > 1 && (
                      <span className="text-[11px] text-muted-foreground/50">
                        {completedCount}/{liveToolsInfo.length} tools completed
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
            {message.parts.some((part) => part.type === "text") && (
              <div
                className={`text-sm leading-relaxed ${
                  isUser
                    ? "px-5 py-3 rounded-2xl bg-secondary/50 border border-white/5 rounded-tr-sm"
                    : ""
                }`}
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return isUser ? (
                      <p key={index} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    ) : (
                      <div
                        key={index}
                        className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-2 prose-headings:my-3 prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-lg prose-pre:my-3 prose-table:border prose-table:border-white/10 prose-th:bg-black/30 prose-th:p-2 prose-td:p-2 prose-td:border-t prose-td:border-white/10 prose-strong:text-primary-foreground prose-strong:font-semibold"
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {part.text}
                        </ReactMarkdown>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </>
        )}

        {/* Tool calls indicator for assistant messages */}
        {!isUser && toolCalls.length > 0 && (
          <div className="px-1">
            <ToolCallIndicator toolCalls={toolCalls} />
          </div>
        )}

        {/* Timestamp, Edit, and Copy button row */}
        {!isEditing && (
          <div className={`flex items-center gap-2 px-1 ${isUser ? "justify-end" : "justify-start"}`}>
            {isUser && onEdit && (
              <>
                <button
                  onClick={startEditing}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Edit message"
                  disabled={status !== "ready"}
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={handleCopy}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground cursor-pointer"
                  title={copiedMessageId === message.id ? "Copied!" : "Copy message"}
                >
                  {copiedMessageId === message.id ? (
                    <CheckCheck className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </>
            )}
            {(message as any).createdAt && (
              <span className="text-[10px] text-muted-foreground/50">
                {new Date((message as any).createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            )}
            {!isUser && (
              <button
                onClick={handleCopy}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground cursor-pointer"
                title={copiedMessageId === message.id ? "Copied!" : "Copy message"}
              >
                {copiedMessageId === message.id ? (
                  <CheckCheck className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1 overflow-hidden">
          {userAvatarUrl ? (
            <Image src={userAvatarUrl} alt={userName || "You"} width={32} height={32} className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}
