"use client";

import { useState } from "react";
import { UIMessage } from "@ai-sdk/react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Pencil, Copy, CheckCheck, Check, X } from "lucide-react";
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
  onEdit?: (messageId: string, newContent: string) => void;
}

export function MessageBubble({
  message,
  isUser,
  agentName,
  agentAvatarUrl,
  userAvatarUrl,
  userName,
  status,
  onEdit,
}: MessageBubbleProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const textContent = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");

  // Extract tool calls from message metadata (only for assistant messages)
  const toolCalls = !isUser && (message as any).metadata?.tool_calls
    ? (message as any).metadata.tool_calls
    : [];

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
