"use client";

import { UIMessage } from "@ai-sdk/react";
import { Brain, Search, Save, FolderPlus, ListTodo, Check, Loader2 } from "lucide-react";

interface LiveToolIndicatorProps {
  messages: UIMessage[];
  status: string;
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
  research: {
    label: "Researching",
    icon: <Brain className="w-3.5 h-3.5" />,
    description: "Searching the web for information...",
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

// Convert camelCase to Title Case for fallback (e.g., "sendEmail" -> "Send Email")
const formatToolName = (name: string) => {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

export function LiveToolIndicator({ messages, status }: LiveToolIndicatorProps) {
  // Only show during streaming
  if (status !== "streaming") return null;

  // Get the last assistant message (the one being streamed)
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "assistant") return null;

  // Extract tool invocations from the message
  const toolParts = lastMessage.parts.filter(
    (part) => part.type === "tool-invocation" || part.type.startsWith("tool-")
  );

  if (toolParts.length === 0) return null;

  // Get tool info for each tool
  const toolsInfo = toolParts.map((part) => {
    const toolName =
      part.type === "tool-invocation" ? (part as any).toolInvocation?.toolName : part.type.replace("tool-", "");

    const rawState =
      part.type === "tool-invocation" ? (part as any).toolInvocation?.state : (part as any).state;

    const args = part.type === "tool-invocation" ? (part as any).toolInvocation?.args : (part as any).input;

    const isComplete = rawState === "result" || rawState === "output-available" || rawState === "output-error";

    const info = TOOL_DISPLAY_INFO[toolName] || {
      label: formatToolName(toolName),
      icon: <Brain className="w-3.5 h-3.5" />,
      description: "Processing...",
    };

    return { toolName, isComplete, info, args };
  });

  // Find the currently running tool (last incomplete one) or show the last completed one
  const currentTool = toolsInfo.find((t) => !t.isComplete) || toolsInfo[toolsInfo.length - 1];
  const completedCount = toolsInfo.filter((t) => t.isComplete).length;
  const hasTextContent = lastMessage.parts.some((part) => part.type === "text" && (part as any).text?.trim());

  // Check if all tools are complete but no text yet (thinking state)
  const allToolsComplete = completedCount === toolsInfo.length;

  // Don't show if we already have text content streaming (tools are done, response is coming)
  if (hasTextContent && allToolsComplete) return null;

  // Don't show if there's no text content - MessageBubble handles that case now
  if (!hasTextContent) return null;

  // Get query for research tool
  const currentQuery = currentTool?.args?.query as string | undefined;

  // If there's text content, use negative margin to pull up below the chat bubble
  return (
    <div className="flex gap-4 -mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="w-8 h-8 shrink-0" /> {/* Spacer to align with avatar above */}
      <div className="flex flex-col gap-0.5">
        {/* Current/recent tool indicator - no background */}
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <span className="animate-pulse text-primary">{currentTool?.info.icon}</span>
          <span>{currentTool?.info.label}</span>
          {!currentTool?.isComplete && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
          {currentTool?.isComplete && <Check className="w-3.5 h-3.5 text-green-400" />}
        </div>
        {/* Show query for research/search tools */}
        {currentQuery && !currentTool?.isComplete && (
          <span className="text-xs text-muted-foreground/60 italic max-w-[300px] truncate">
            &quot;{currentQuery}&quot;
          </span>
        )}
        {/* Tool count if more than one */}
        {toolsInfo.length > 1 && (
          <span className="text-[11px] text-muted-foreground/50">
            {completedCount}/{toolsInfo.length} tools completed
          </span>
        )}
      </div>
    </div>
  );
}
