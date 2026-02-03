"use client";

import { useState } from "react";
import { Wrench, ChevronDown, ChevronUp } from "lucide-react";

interface ToolCall {
  name: string;
  timestamp: string;
}

interface ToolCallIndicatorProps {
  toolCalls: ToolCall[];
}

export function ToolCallIndicator({ toolCalls }: ToolCallIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  // Group tool calls by name and count
  const toolCounts = toolCalls.reduce(
    (acc, tc) => {
      acc[tc.name] = (acc[tc.name] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalCalls = toolCalls.length;
  const uniqueTools = Object.keys(toolCounts).length;

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/5 hover:bg-primary/10 border border-primary/10 text-[10px] text-muted-foreground hover:text-foreground transition-colors group"
        title={`${totalCalls} tool call${totalCalls !== 1 ? "s" : ""} made`}
      >
        <Wrench className="w-3 h-3 text-primary" />
        <span className="font-medium">
          {totalCalls} tool{totalCalls !== 1 ? "s" : ""}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-3 h-3 opacity-50 group-hover:opacity-100" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-50 group-hover:opacity-100" />
        )}
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-0.5 px-2 py-1 rounded-md bg-secondary/30 border border-white/5 text-[10px] animate-in fade-in slide-in-from-top-1 duration-200">
          {Object.entries(toolCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([toolName, count]) => (
              <div key={toolName} className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-muted-foreground font-mono">{toolName}</span>
                {count > 1 && (
                  <span className="text-[9px] px-1 rounded bg-primary/10 text-primary font-medium">
                    ×{count}
                  </span>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
